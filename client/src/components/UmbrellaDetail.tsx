import { useState, useEffect } from 'react'
import { T, umbrellaColor } from '../lib/theme'
import Ring from './Ring'
import Sparkline from './Sparkline'
import Icon from './Icon'
import {
  listQuestions,
  archiveUmbrella,
  deleteUmbrella,
  getUmbrellaTrend,
  getQuestionTrend,
  getQuestionMultiTrend,
  updateUmbrella,
  listResolutions,
} from '../lib/api'
import type { ApiUmbrellaTrendPoint, ApiQuestionTrendPoint, ApiMultiTrendPoint, ApiResolution } from '../lib/api'
import { useStore } from '../store/useStore'
import type { Umbrella } from '../types/umbrella'
import type { Question } from '../types/umbrella'
import type { NavigateFn } from '../types/nav'
import { EMOJI_OPTIONS, flattenWithDepth, collectDescendantIds } from './umbrella/shared'
import { SubAreasSection } from './umbrella/SubAreasSection'
import { QuestionsSection } from './umbrella/QuestionsSection'
import { ResolutionsSection } from './umbrella/ResolutionsSection'

interface Props {
  umbrella: Umbrella
  navigate: NavigateFn
  goBack: () => void
}

export default function UmbrellaDetail({ umbrella, navigate, goBack }: Props) {
  const color = umbrellaColor(umbrella.name)
  const { loadUmbrellas, umbrellas: allUmbrellas } = useStore()

  // Data loaded from API
  const [questions, setQuestions] = useState<Question[]>([])
  const [loadingQ, setLoadingQ] = useState(true)
  const [resolutionsList, setResolutionsList] = useState<ApiResolution[]>([])
  const [loadingR, setLoadingR] = useState(true)
  const [umbrellaTrend, setUmbrellaTrend] = useState<ApiUmbrellaTrendPoint[]>([])
  const [questionTrends, setQuestionTrends] = useState<Record<string, ApiQuestionTrendPoint[]>>({})
  const [multiTrends, setMultiTrends] = useState<Record<string, ApiMultiTrendPoint[]>>({})

  // Header inline-edit state
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerNameInput, setHeaderNameInput] = useState('')
  const [headerIconInput, setHeaderIconInput] = useState('')
  const [savingHeader, setSavingHeader] = useState(false)

  // Kebab / delete / move state
  const [showKebab, setShowKebab] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveTargetId, setMoveTargetId] = useState<string | null | undefined>(undefined)
  const [moving, setMoving] = useState(false)

  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    setLoadingQ(true)
    listQuestions(umbrella.id)
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoadingQ(false))
  }, [umbrella.id])

  useEffect(() => {
    setLoadingR(true)
    listResolutions(umbrella.id)
      .then(setResolutionsList)
      .catch(() => setResolutionsList([]))
      .finally(() => setLoadingR(false))
  }, [umbrella.id])

  useEffect(() => {
    getUmbrellaTrend(umbrella.id, 42)
      .then(setUmbrellaTrend)
      .catch(() => setUmbrellaTrend([]))
  }, [umbrella.id])

  useEffect(() => {
    if (questions.length === 0) return
    Promise.allSettled(questions.map(q => getQuestionTrend(q.id, 90))).then(results => {
      const map: Record<string, ApiQuestionTrendPoint[]> = {}
      questions.forEach((q, i) => {
        const r = results[i]
        map[q.id] = r.status === 'fulfilled' ? r.value : []
      })
      setQuestionTrends(map)
    })
    const multiQs = questions.filter(q => q.answerType === 'multi_select')
    if (multiQs.length > 0) {
      Promise.allSettled(multiQs.map(q => getQuestionMultiTrend(q.id, 90))).then(results => {
        const map: Record<string, ApiMultiTrendPoint[]> = {}
        multiQs.forEach((q, i) => {
          const r = results[i]
          map[q.id] = r.status === 'fulfilled' ? r.value : []
        })
        setMultiTrends(map)
      })
    }
  }, [questions])

  async function handleSaveHeader() {
    if (!headerNameInput.trim()) return
    setSavingHeader(true)
    try {
      await updateUmbrella(umbrella.id, { name: headerNameInput.trim(), icon: headerIconInput })
      await loadUmbrellas()
      setEditingHeader(false)
    } catch (err) {
      console.error('handleSaveHeader:', err)
    } finally {
      setSavingHeader(false)
    }
  }

  async function handleArchive() {
    try {
      await archiveUmbrella(umbrella.id)
      await loadUmbrellas()
      setToast('המטרייה אורכבה')
      setTimeout(() => { goBack() }, 1200)
    } catch {
      // archive failed silently
    }
  }

  async function handleMove() {
    if (moveTargetId === undefined) return
    setMoving(true)
    try {
      await updateUmbrella(umbrella.id, { parentId: moveTargetId })
      await loadUmbrellas()
      navigate('home')
    } catch (err) {
      console.error('handleMove:', err)
      setMoving(false)
      setShowMoveModal(false)
    }
  }

  async function handleDeleteUmbrella() {
    setDeleting(true)
    try {
      await deleteUmbrella(umbrella.id)
      await loadUmbrellas()
      goBack()
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100%', background: T.bg, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '60px 20px 20px', background: T.bgCard, boxShadow: '0 1px 0 rgba(44,44,42,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button
            onClick={goBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: T.charcoalLight, fontSize: 13, padding: 0,
              fontFamily: 'inherit',
            }}
          >
            <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
              <Icon name="back" size={16} color={T.charcoalLight} />
            </span>
            חזור
          </button>
          {!editingHeader && (
            <button
              onClick={() => setShowKebab(true)}
              aria-label="תפריט"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="kebab" size={22} color={T.charcoalLight} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {editingHeader ? (
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                  {EMOJI_OPTIONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setHeaderIconInput(icon)}
                      style={{
                        width: 34, height: 34, fontSize: 18, borderRadius: 10, border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: headerIconInput === icon ? T.sage : T.sageLight,
                        outline: headerIconInput === icon ? `2px solid ${T.sage}` : 'none',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  value={headerNameInput}
                  onChange={e => setHeaderNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveHeader(); if (e.key === 'Escape') setEditingHeader(false) }}
                  autoFocus
                  style={{
                    width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`,
                    borderRadius: 10, padding: '8px 12px', fontSize: 18, fontWeight: 700,
                    color: T.charcoal, fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box', marginBottom: 10, direction: 'rtl',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleSaveHeader}
                    disabled={!headerNameInput.trim() || savingHeader}
                    style={{
                      flex: 1, background: T.sage, color: '#fff', borderRadius: 10, border: 'none',
                      padding: '7px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', opacity: !headerNameInput.trim() || savingHeader ? 0.5 : 1,
                    }}
                  >
                    {savingHeader ? 'שומר…' : 'שמור'}
                  </button>
                  <button
                    onClick={() => setEditingHeader(false)}
                    style={{
                      flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 10,
                      border: 'none', padding: '7px 0', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: color + '22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                }}>
                  {umbrella.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 2 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: T.charcoal, lineHeight: 1.2 }}>
                      {umbrella.name}
                    </h1>
                  </div>
                  <p style={{ fontSize: 12, color: T.charcoalLight }}>
                    ציון בריאות:{' '}
                    <span style={{ color, fontWeight: 700 }}>
                      {umbrella.computedHealthScore ?? '—'}
                    </span>
                    {umbrella.computedHealthScore !== null && '/100'}
                  </p>
                </div>
              </>
            )}
          </div>
          {!editingHeader && (
            <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
              <Ring score={umbrella.computedHealthScore ?? 0} size={56} stroke={5} color={color} animate={false} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>
                  {umbrella.computedHealthScore ?? '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 20px 0' }}>
        {/* Trend card */}
        <div style={{
          background: T.bgCard, borderRadius: 16, padding: '14px 16px',
          marginBottom: 16, boxShadow: '0 1px 6px rgba(44,44,42,0.05)',
        }}>
          <p style={{ fontSize: 12, color: T.charcoalLight, marginBottom: 10 }}>מגמה ב-6 שבועות</p>
          {umbrellaTrend.length > 0
            ? <Sparkline data={umbrellaTrend.map(p => p.score)} color={color} width={280} height={36} />
            : <p style={{ fontSize: 12, color: T.charcoalLight, fontStyle: 'italic' }}>
                אין נתונים עדיין — ענה על הראיון היומי לבנות מגמה.
              </p>
          }
        </div>

        <SubAreasSection umbrella={umbrella} navigate={navigate} />

        <QuestionsSection
          umbrellaId={umbrella.id}
          color={color}
          questions={questions}
          loadingQ={loadingQ}
          questionTrends={questionTrends}
          multiTrends={multiTrends}
          onQuestionsChange={setQuestions}
        />

        <ResolutionsSection
          umbrellaId={umbrella.id}
          questions={questions}
          resolutionsList={resolutionsList}
          loadingR={loadingR}
          onResolutionsListChange={setResolutionsList}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: T.charcoal, color: '#fff', borderRadius: 20,
          padding: '10px 20px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 100,
          animation: 'nudge-float 0.3s ease both',
        }}>
          {toast}
        </div>
      )}

      {/* Floating sparkle FAB */}
      <button
        onClick={() => navigate('chat')}
        style={{
          position: 'fixed', right: 20, bottom: 100,
          width: 52, height: 52, borderRadius: 18, border: 'none',
          background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
          boxShadow: '0 4px 16px rgba(107,142,153,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          animation: 'sparkle 2.5s ease-in-out infinite',
        }}
      >
        <Icon name="sparkle" size={22} color="#fff" strokeWidth={1.8} />
      </button>

      {/* Kebab bottom sheet */}
      {showKebab && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(44,44,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowKebab(false)}
        >
          <div
            dir="rtl"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: T.bgCard, borderRadius: '20px 20px 0 0', paddingBottom: 40 }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: T.sageMid }} />
            </div>
            {[
              {
                emoji: '✏️', label: 'שינוי שם',
                action: () => { setHeaderNameInput(umbrella.name); setHeaderIconInput(umbrella.icon); setEditingHeader(true); setShowKebab(false) },
              },
              {
                emoji: '🖼️', label: 'שינוי אייקון',
                action: () => { setHeaderNameInput(umbrella.name); setHeaderIconInput(umbrella.icon); setEditingHeader(true); setShowKebab(false) },
              },
              {
                emoji: '📂', label: 'העברה תחת מטרייה אחרת',
                action: () => { setMoveTargetId(undefined); setShowMoveModal(true); setShowKebab(false) },
              },
              {
                emoji: '📦', label: 'ארכוב',
                action: () => { handleArchive(); setShowKebab(false) },
              },
              {
                emoji: '🗑️', label: 'מחיקה', danger: true,
                action: () => { setConfirmDelete(true); setShowKebab(false) },
              },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
                  fontFamily: 'inherit', fontSize: 15, textAlign: 'right',
                  color: (item as { danger?: boolean }).danger ? T.red : T.charcoal,
                }}
              >
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation bottom sheet */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(44,44,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setConfirmDelete(false)}
        >
          <div
            dir="rtl"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: T.bgCard, borderRadius: '20px 20px 0 0', padding: '24px 20px 40px' }}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: T.charcoal, marginBottom: 8 }}>מחיקת מטרייה</p>
            <p style={{ fontSize: 13, color: T.charcoalLight, marginBottom: 20, lineHeight: 1.5 }}>
              פעולה זו תמחק את המטרייה וכל הנתונים שלה — לא ניתן לשחזר.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleDeleteUmbrella}
                disabled={deleting}
                style={{
                  flex: 1, background: T.red, color: '#fff', borderRadius: 12,
                  border: 'none', padding: '13px 0', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'מוחק…' : 'מחק לצמיתות'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 12,
                  border: 'none', padding: '13px 0', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move-under-parent modal */}
      {showMoveModal && (() => {
        const descendantIds = collectDescendantIds(umbrella)
        const flat = flattenWithDepth(allUmbrellas).filter(
          ({ u }) => u.id !== umbrella.id && !descendantIds.has(u.id)
        )
        return (
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(44,44,42,0.5)',
              zIndex: 200, display: 'flex', alignItems: 'flex-end',
            }}
            onClick={() => setShowMoveModal(false)}
          >
            <div
              dir="rtl"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 430, margin: '0 auto',
                background: T.bgCard, borderRadius: '20px 20px 0 0',
                padding: '20px 0 40px',
                maxHeight: '70vh', display: 'flex', flexDirection: 'column',
              }}
            >
              <p style={{
                fontSize: 15, fontWeight: 700, color: T.charcoal,
                padding: '0 20px 14px', borderBottom: `1px solid rgba(44,44,42,0.08)`,
                marginBottom: 0, flexShrink: 0,
              }}>
                העבר מטרייה אל…
              </p>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <button
                  onClick={() => setMoveTargetId(null)}
                  style={{
                    width: '100%', background: moveTargetId === null ? T.blueLight : 'transparent',
                    border: 'none', cursor: 'pointer', padding: '12px 20px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontFamily: 'inherit', textAlign: 'right',
                  }}
                >
                  <span style={{ fontSize: 18 }}>🏠</span>
                  <span style={{
                    fontSize: 14, color: moveTargetId === null ? T.blue : T.charcoal,
                    fontWeight: moveTargetId === null ? 700 : 400,
                  }}>
                    ללא הורה (מטרייה ראשית)
                  </span>
                </button>
                {flat.map(({ u, depth }) => (
                  <button
                    key={u.id}
                    onClick={() => setMoveTargetId(u.id)}
                    style={{
                      width: '100%',
                      background: moveTargetId === u.id ? T.blueLight : 'transparent',
                      border: 'none', cursor: 'pointer',
                      padding: `12px 20px 12px ${20 + depth * 18}px`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontFamily: 'inherit', textAlign: 'right',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{u.icon || '🌿'}</span>
                    <span style={{
                      fontSize: 14, color: moveTargetId === u.id ? T.blue : T.charcoal,
                      fontWeight: moveTargetId === u.id ? 700 : 400,
                    }}>
                      {u.name}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, padding: '14px 20px 0', flexShrink: 0, borderTop: `1px solid rgba(44,44,42,0.08)` }}>
                <button
                  onClick={handleMove}
                  disabled={moveTargetId === undefined || moving}
                  style={{
                    flex: 1, background: T.blue, color: '#fff', borderRadius: 12,
                    border: 'none', padding: '11px 0', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    opacity: moveTargetId === undefined || moving ? 0.5 : 1,
                  }}
                >
                  {moving ? 'מעביר…' : 'אישור'}
                </button>
                <button
                  onClick={() => setShowMoveModal(false)}
                  style={{
                    flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 12,
                    border: 'none', padding: '11px 0', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

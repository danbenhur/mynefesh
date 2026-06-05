import { useState, useEffect, useMemo } from 'react'
import { C } from '../lib/dashboardTheme'
import { umbrellaColor } from '../lib/theme'
import Ring from './Ring'
import Sparkline from './Sparkline'
import Icon from './Icon'
import './dashboard/dashboard.css'
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

// Returns null for sparse-cadence umbrellas (weekly/monthly/annual) where 14 daily points aren't available.
function computeTrendDelta(trend: ApiUmbrellaTrendPoint[]) {
  const pts = trend.filter(p => p.score !== null)
  if (pts.length < 14) return null
  const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted.slice(-14)
  const prev = sorted.slice(-28, -14)
  if (prev.length === 0) return null
  const avg = (arr: typeof recent) => arr.reduce((s, p) => s + (p.score ?? 0), 0) / arr.length
  const delta = Math.round(avg(recent) - avg(prev))
  if (delta > 2)  return { delta, label: `↑ +${delta} מהתקופה הקודמת`, sign: 'up' as const }
  if (delta < -2) return { delta, label: `↓ ${delta} מהתקופה הקודמת`, sign: 'down' as const }
  return { delta, label: `→ ${delta > 0 ? '+' : ''}${delta} מהתקופה הקודמת`, sign: 'flat' as const }
}

interface Props {
  umbrella: Umbrella
  navigate: NavigateFn
  goBack: () => void
}

export default function UmbrellaDetail({ umbrella, navigate, goBack }: Props) {
  const { loadUmbrellas, umbrellas: allUmbrellas } = useStore()

  // Data loaded from API
  const [questions, setQuestions] = useState<Question[]>([])
  const [loadingQ, setLoadingQ] = useState(true)
  const [resolutionsList, setResolutionsList] = useState<ApiResolution[]>([])
  const [loadingR, setLoadingR] = useState(true)
  const [umbrellaTrend, setUmbrellaTrend] = useState<ApiUmbrellaTrendPoint[]>([])
  const [questionTrends, setQuestionTrends] = useState<Record<string, ApiQuestionTrendPoint[]>>({})
  const [multiTrends, setMultiTrends] = useState<Record<string, ApiMultiTrendPoint[]>>({})

  // Header edit state — now drives a bottom sheet instead of inline morphing
  const [showEditSheet, setShowEditSheet] = useState(false)
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

  const trendDelta = useMemo(() => computeTrendDelta(umbrellaTrend), [umbrellaTrend])

  async function handleSaveHeader() {
    if (!headerNameInput.trim()) return
    setSavingHeader(true)
    try {
      await updateUmbrella(umbrella.id, { name: headerNameInput.trim(), icon: headerIconInput })
      await loadUmbrellas()
      setShowEditSheet(false)
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

  const color = umbrellaColor(umbrella.name)
  const headerBg = umbrella?.name
    ? `linear-gradient(180deg, ${color}14 0%, ${C.surface} 100%)`
    : C.surface

  return (
    <div dir="rtl" className="mn-umbrella-page">

      {/* ── Header ── */}
      <header className="mn-umbrella-header" style={{ background: headerBg }}>
        <div className="mn-umbrella-nav-row">
          <button className="mn-umbrella-ghost-btn" onClick={goBack}>
            <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
              <Icon name="back" size={16} color="rgba(44,44,42,0.52)" />
            </span>
            חזור
          </button>
          {!showEditSheet && (
            <button className="mn-umbrella-ghost-btn" aria-label="תפריט" onClick={() => setShowKebab(true)}>
              <Icon name="kebab" size={22} color="rgba(44,44,42,0.52)" strokeWidth={2.5} />
            </button>
          )}
        </div>
        <div className="mn-umbrella-identity-row">
          <div className="mn-umbrella-icon-name">
            <div
              className="mn-umbrella-icon-circle"
              style={{ background: color + '14', borderColor: color + '30' }}
            >
              {umbrella.icon}
            </div>
            <div className="mn-umbrella-name-block">
              <h1 className="mn-umbrella-name">{umbrella.name}</h1>
              <p className="mn-umbrella-health-label">ציון בריאות</p>
            </div>
          </div>
          <div className="mn-umbrella-ring-block">
            <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
              <Ring score={umbrella.computedHealthScore ?? 0} size={60} stroke={5} color={color} animate={false} />
              <span className="mn-umbrella-ring-score" style={{ color }}>
                {umbrella.computedHealthScore ?? '—'}
              </span>
            </div>
            <p className="mn-umbrella-ring-label">שבועיים אחרונים</p>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="mn-umbrella-content">

        {/* Trend card */}
        <div className="mn-hero-card mn-umbrella-trend-card">
          <div className="mn-umbrella-trend-header">
            <span className="mn-hero-eyebrow">מגמה — 6 שבועות</span>
            {trendDelta && (
              <span className={`mn-umbrella-trend-delta ${trendDelta.sign}`}>
                {trendDelta.label}
              </span>
            )}
          </div>
          <div className="mn-chart-wrap">
            {umbrellaTrend.length > 0 ? (
              <Sparkline
                data={umbrellaTrend.map(p => p.score)}
                color={color}
                width={358}
                height={64}
              />
            ) : (
              <div className="mn-umbrella-trend-empty">
                <svg
                  width="100%"
                  height={64}
                  style={{ position: 'absolute', inset: 0, opacity: 0.15 }}
                  preserveAspectRatio="none"
                >
                  <path
                    d="M 0 32 Q 90 44 180 32 Q 270 20 358 32"
                    stroke={C.border}
                    strokeWidth={1.5}
                    fill="none"
                    strokeDasharray="5 5"
                  />
                </svg>
                <p className="mn-umbrella-trend-empty-text">
                  אין נתונים עדיין — ענה על הראיון היומי לבנות מגמה
                </p>
              </div>
            )}
          </div>
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

      {/* ── Toast ── */}
      {toast && <div className="mn-umbrella-toast">{toast}</div>}

      {/* ── FAB ── */}
      <button className="mn-umbrella-fab" onClick={() => navigate('chat')}>
        <Icon name="sparkle" size={22} color="#fff" strokeWidth={1.8} />
      </button>

      {/* ── Edit umbrella sheet ── */}
      {showEditSheet && (
        <div className="mn-sheet-backdrop" onClick={() => setShowEditSheet(false)}>
          <div className="mn-sheet mn-sheet-short" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="mn-sheet-drag-handle" />
            <div className="mn-sheet-titlebar">
              <span className="mn-sheet-title">עריכת מטרייה</span>
              <button className="mn-sheet-close-btn" onClick={() => setShowEditSheet(false)}>✕</button>
            </div>
            <div className="mn-sheet-body">
              <p className="mn-sheet-field-label">אייקון</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {EMOJI_OPTIONS.map(icon => (
                  <button
                    key={icon}
                    onClick={() => setHeaderIconInput(icon)}
                    style={{
                      width: 36, height: 36, fontSize: 18, borderRadius: 10, border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: headerIconInput === icon ? C.bar : C.faint,
                      outline: headerIconInput === icon ? `2px solid ${C.bar}` : 'none',
                      outlineOffset: 1,
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <p className="mn-sheet-field-label">שם</p>
              <input
                className="mn-sheet-input"
                value={headerNameInput}
                onChange={e => setHeaderNameInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveHeader()
                  if (e.key === 'Escape') setShowEditSheet(false)
                }}
                autoFocus
              />
            </div>
            <div className="mn-sheet-action-row">
              <button className="mn-sheet-btn-ghost" onClick={() => setShowEditSheet(false)}>ביטול</button>
              <button
                className="mn-sheet-btn-primary"
                onClick={handleSaveHeader}
                disabled={!headerNameInput.trim() || savingHeader ||
                  (headerNameInput === umbrella.name && headerIconInput === umbrella.icon)}
              >
                {savingHeader ? 'שומר…' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Kebab sheet ── */}
      {showKebab && (
        <div className="mn-sheet-backdrop" onClick={() => setShowKebab(false)}>
          <div className="mn-sheet" dir="rtl" onClick={e => e.stopPropagation()} style={{ paddingBottom: 40 }}>
            <div className="mn-sheet-drag-handle" />
            {[
              {
                emoji: '✏️', label: 'שינוי שם',
                action: () => { setHeaderNameInput(umbrella.name); setHeaderIconInput(umbrella.icon); setShowEditSheet(true); setShowKebab(false) },
              },
              {
                emoji: '🖼️', label: 'שינוי אייקון',
                action: () => { setHeaderNameInput(umbrella.name); setHeaderIconInput(umbrella.icon); setShowEditSheet(true); setShowKebab(false) },
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
                  color: (item as { danger?: boolean }).danger ? C.low : C.ink,
                }}
              >
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Delete confirmation sheet ── */}
      {confirmDelete && (
        <div className="mn-sheet-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="mn-sheet" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="mn-sheet-drag-handle" />
            <div style={{ padding: '8px 20px 24px' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 8 }}>מחיקת מטרייה</p>
              <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
                פעולה זו תמחק את המטרייה וכל הנתונים שלה — לא ניתן לשחזר.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleDeleteUmbrella}
                  disabled={deleting}
                  style={{
                    flex: 1, background: C.low, color: '#fff', borderRadius: 12,
                    border: 'none', padding: '13px 0', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? 'מוחק…' : 'מחק לצמיתות'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    flex: 1, background: C.faint, color: C.muted, borderRadius: 12,
                    border: 'none', padding: '13px 0', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Move-under-parent sheet ── */}
      {showMoveModal && (() => {
        const descendantIds = collectDescendantIds(umbrella)
        const flat = flattenWithDepth(allUmbrellas).filter(
          ({ u }) => u.id !== umbrella.id && !descendantIds.has(u.id)
        )
        return (
          <div
            className="mn-sheet-backdrop"
            onClick={() => setShowMoveModal(false)}
          >
            <div
              className="mn-sheet mn-sheet-tall"
              dir="rtl"
              onClick={e => e.stopPropagation()}
              style={{ paddingBottom: 0 }}
            >
              <div className="mn-sheet-drag-handle" />
              <p style={{
                fontSize: 15, fontWeight: 700, color: C.ink,
                padding: '0 20px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
              }}>
                העבר מטרייה אל…
              </p>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <button
                  onClick={() => setMoveTargetId(null)}
                  style={{
                    width: '100%', background: moveTargetId === null ? C.bar + '26' : 'transparent',
                    border: 'none', cursor: 'pointer', padding: '12px 20px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontFamily: 'inherit', textAlign: 'right',
                  }}
                >
                  <span style={{ fontSize: 18 }}>🏠</span>
                  <span style={{ fontSize: 14, color: moveTargetId === null ? C.bar : C.ink, fontWeight: moveTargetId === null ? 700 : 400 }}>
                    ללא הורה (מטרייה ראשית)
                  </span>
                </button>
                {flat.map(({ u, depth }) => (
                  <button
                    key={u.id}
                    onClick={() => setMoveTargetId(u.id)}
                    style={{
                      width: '100%',
                      background: moveTargetId === u.id ? C.bar + '26' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      padding: `12px 20px 12px ${20 + depth * 18}px`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontFamily: 'inherit', textAlign: 'right',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{u.icon || '🌿'}</span>
                    <span style={{ fontSize: 14, color: moveTargetId === u.id ? C.bar : C.ink, fontWeight: moveTargetId === u.id ? 700 : 400 }}>
                      {u.name}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mn-sheet-action-row">
                <button
                  onClick={handleMove}
                  disabled={moveTargetId === undefined || moving}
                  className="mn-sheet-btn-primary"
                >
                  {moving ? 'מעביר…' : 'אישור'}
                </button>
                <button onClick={() => setShowMoveModal(false)} className="mn-sheet-btn-ghost">ביטול</button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}

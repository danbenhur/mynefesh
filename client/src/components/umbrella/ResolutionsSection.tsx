import { useState } from 'react'
import { T } from '../../lib/theme'
import { createResolution, abandonResolution } from '../../lib/api'
import type { ApiResolution } from '../../lib/api'
import type { Question } from '../../types/umbrella'
import {
  DEFAULT_RESOLUTION_FORM,
  type ResolutionFormState,
  type ResolutionDuration,
  type ResolutionQSource,
  resolutionEndDate,
  resolutionQType,
  todayClientStr,
  addClientDays,
  fmtDate,
} from './shared'

interface Props {
  umbrellaId: string
  questions: Question[]
  resolutionsList: ApiResolution[]
  loadingR: boolean
  onResolutionsListChange: (list: ApiResolution[]) => void
}

export function ResolutionsSection({
  umbrellaId,
  questions,
  resolutionsList,
  loadingR,
  onResolutionsListChange,
}: Props) {
  const [showAddResolution, setShowAddResolution] = useState(false)
  const [resolutionForm, setResolutionForm] = useState<ResolutionFormState>(DEFAULT_RESOLUTION_FORM)
  const [savingR, setSavingR] = useState(false)
  const [detailResolution, setDetailResolution] = useState<ApiResolution | null>(null)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [abandoningR, setAbandoningR] = useState(false)
  const [pastExpanded, setPastExpanded] = useState(false)

  const active = resolutionsList.filter(r => r.status === 'active')
  const past = resolutionsList.filter(r => r.status !== 'active')
  const today = todayClientStr()
  const qType = resolutionQType(resolutionForm, questions)
  const needsThreshold = qType === 'scale'
  const canSave = !!resolutionForm.title.trim()
    && (resolutionForm.qSource === 'existing' ? !!resolutionForm.existingQId : !!resolutionForm.newQText.trim())
    && (!needsThreshold || !!resolutionForm.successThreshold)
    && !savingR

  async function handleSaveResolution() {
    const endDate = resolutionEndDate(resolutionForm)
    const threshold = qType === 'scale' && resolutionForm.successThreshold
      ? parseInt(resolutionForm.successThreshold, 10)
      : null
    if (!resolutionForm.title.trim()) return
    if (resolutionForm.qSource === 'existing' && !resolutionForm.existingQId) return
    if (resolutionForm.qSource === 'new' && !resolutionForm.newQText.trim()) return
    if (qType === 'scale' && !threshold) return
    setSavingR(true)
    try {
      const payload: Parameters<typeof createResolution>[0] = {
        umbrellaId,
        title: resolutionForm.title.trim(),
        startDate: today,
        endDate,
        successThreshold: threshold,
      }
      if (resolutionForm.qSource === 'existing') {
        payload.questionId = resolutionForm.existingQId
      } else {
        payload.newQuestion = {
          text: resolutionForm.newQText.trim(),
          answerType: resolutionForm.newQType,
          ...(resolutionForm.newQType === 'scale' ? { scaleMin: resolutionForm.newQScaleMin, scaleMax: resolutionForm.newQScaleMax } : {}),
        }
      }
      const created = await createResolution(payload)
      onResolutionsListChange([created, ...resolutionsList])
      setResolutionForm(DEFAULT_RESOLUTION_FORM)
      setShowAddResolution(false)
    } catch (err) {
      console.error('handleSaveResolution:', err)
    } finally {
      setSavingR(false)
    }
  }

  async function handleAbandonResolution() {
    if (!detailResolution) return
    setAbandoningR(true)
    try {
      const updated = await abandonResolution(detailResolution.id)
      onResolutionsListChange(resolutionsList.map(r => r.id === updated.id ? updated : r))
      setDetailResolution(null)
      setConfirmAbandon(false)
    } catch (err) {
      console.error('handleAbandonResolution:', err)
    } finally {
      setAbandoningR(false)
    }
  }

  return (
    <div dir="rtl" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.charcoal }}>החלטות</p>
        {!showAddResolution && (
          <button
            onClick={() => { setShowAddResolution(true); setResolutionForm({ ...DEFAULT_RESOLUTION_FORM, existingQId: questions[0]?.id ?? '' }) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.sage, fontFamily: 'inherit', padding: '2px 6px' }}
          >
            + החלטה חדשה
          </button>
        )}
      </div>

      {!loadingR && active.length === 0 && !showAddResolution && (
        <p style={{ fontSize: 12, color: T.charcoalLight, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
          אין החלטות פעילות
        </p>
      )}

      {active.map(r => {
        const p = r.progress
        const pct = p?.percentage ?? 0
        const remaining = p?.daysRemaining ?? 0
        const streak = p?.currentStreak ?? 0
        return (
          <div
            key={r.id}
            onClick={() => { setDetailResolution(r); setConfirmAbandon(false) }}
            style={{
              background: T.bgCard, borderRadius: 14, padding: '14px 16px', marginBottom: 10,
              boxShadow: '0 1px 6px rgba(44,44,42,0.06)', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.charcoal, lineHeight: 1.3, flex: 1 }}>{r.title}</p>
              <span style={{ fontSize: 20, fontWeight: 800, color: pct >= 70 ? T.sage : pct >= 40 ? T.amber : T.red, marginRight: 8 }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 6, background: T.sageLight, borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', background: pct >= 70 ? T.sage : pct >= 40 ? T.amber : T.red, borderRadius: 3, width: `${pct}%`, transition: 'width 0.4s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 11, color: T.charcoalLight }}>
                {p ? `${p.successfulDays}/${p.elapsedDays} ימים` : '—'}
              </span>
              {streak > 0 && (
                <span style={{ fontSize: 11, color: T.amber, fontWeight: 600 }}>🔥 רצף: {streak}</span>
              )}
              <span style={{ fontSize: 11, color: T.charcoalLight, marginRight: 'auto' }}>
                {remaining > 0 ? `נותרו ${remaining} ימים` : 'הסתיים'}
              </span>
            </div>
          </div>
        )
      })}

      {showAddResolution && (
        <div dir="rtl" style={{ background: T.bgCard, borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(44,44,42,0.08)', border: `1px solid ${T.sageMid}`, marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>כותרת</p>
          <input
            value={resolutionForm.title}
            onChange={e => setResolutionForm(f => ({ ...f, title: e.target.value }))}
            placeholder="לדוג׳: ריצה יומית"
            style={{ width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: T.charcoal, fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box', direction: 'rtl' }}
          />

          <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>שאלה</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['existing', 'new'] as ResolutionQSource[]).map(src => (
              <button
                key={src}
                onClick={() => setResolutionForm(f => ({ ...f, qSource: src }))}
                style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: resolutionForm.qSource === src ? T.sage : T.sageLight, color: resolutionForm.qSource === src ? '#fff' : T.charcoalMid, transition: 'all 0.15s' }}
              >
                {src === 'existing' ? 'שאלה קיימת' : 'שאלה חדשה'}
              </button>
            ))}
          </div>

          {resolutionForm.qSource === 'existing' && (
            questions.length === 0
              ? <p style={{ fontSize: 12, color: T.red, marginBottom: 12 }}>אין שאלות במטרייה זו — הוסף שאלה תחילה.</p>
              : <select
                  value={resolutionForm.existingQId}
                  onChange={e => setResolutionForm(f => ({ ...f, existingQId: e.target.value }))}
                  style={{ width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: T.charcoal, fontFamily: 'inherit', outline: 'none', marginBottom: 14, direction: 'rtl' }}
                >
                  {questions.map(q => <option key={q.id} value={q.id}>{q.text.slice(0, 60)}</option>)}
                </select>
          )}

          {resolutionForm.qSource === 'new' && (
            <div style={{ marginBottom: 12 }}>
              <input
                value={resolutionForm.newQText}
                onChange={e => setResolutionForm(f => ({ ...f, newQText: e.target.value }))}
                placeholder="טקסט השאלה..."
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: T.charcoal, fontFamily: 'inherit', outline: 'none', marginBottom: 8, boxSizing: 'border-box', direction: 'rtl' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                {([['boolean', 'כן/לא'], ['boolean_partial', 'כן/לא/חלקית'], ['scale', 'סולם']] as [typeof resolutionForm.newQType, string][]).map(([t, label]) => (
                  <button key={t} onClick={() => setResolutionForm(f => ({ ...f, newQType: t }))}
                    style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, background: resolutionForm.newQType === t ? T.sage : T.sageLight, color: resolutionForm.newQType === t ? '#fff' : T.charcoalMid }}>
                    {label}
                  </button>
                ))}
              </div>
              {resolutionForm.newQType === 'scale' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: T.charcoalMid }}>טווח:</span>
                  <input type="number" value={resolutionForm.newQScaleMin} onChange={e => setResolutionForm(f => ({ ...f, newQScaleMin: Number(e.target.value) }))} style={{ width: 52, background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 8, padding: '4px 6px', fontSize: 12, textAlign: 'center', outline: 'none', fontFamily: 'inherit', color: T.charcoal }} />
                  <span style={{ color: T.charcoalLight }}>—</span>
                  <input type="number" value={resolutionForm.newQScaleMax} onChange={e => setResolutionForm(f => ({ ...f, newQScaleMax: Number(e.target.value) }))} style={{ width: 52, background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 8, padding: '4px 6px', fontSize: 12, textAlign: 'center', outline: 'none', fontFamily: 'inherit', color: T.charcoal }} />
                </div>
              )}
            </div>
          )}

          {needsThreshold && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>סף הצלחה (ערך מינימלי)</p>
              <input
                type="number"
                value={resolutionForm.successThreshold}
                onChange={e => setResolutionForm(f => ({ ...f, successThreshold: e.target.value }))}
                placeholder="לדוג׳: 7"
                style={{ width: 80, background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 10, padding: '6px 10px', fontSize: 13, color: T.charcoal, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }}
              />
            </div>
          )}

          <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>משך</p>
          <div style={{ display: 'flex', gap: 6, marginBottom: resolutionForm.duration === 'custom' ? 10 : 14, flexWrap: 'wrap' }}>
            {([['30', 'חודש'], ['90', '3 חודשים'], ['180', '6 חודשים'], ['custom', 'מותאם']] as [ResolutionDuration, string][]).map(([d, label]) => (
              <button key={d} onClick={() => setResolutionForm(f => ({ ...f, duration: d, customEnd: d === 'custom' ? addClientDays(today, 30) : f.customEnd }))}
                style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: resolutionForm.duration === d ? T.blue : T.blueLight, color: resolutionForm.duration === d ? '#fff' : T.charcoalMid, transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>
          {resolutionForm.duration === 'custom' && (
            <input
              type="date"
              value={resolutionForm.customEnd}
              min={addClientDays(today, 1)}
              onChange={e => setResolutionForm(f => ({ ...f, customEnd: e.target.value }))}
              style={{ background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 10, padding: '6px 10px', fontSize: 13, color: T.charcoal, fontFamily: 'inherit', outline: 'none', marginBottom: 14 }}
            />
          )}

          <p style={{ fontSize: 11, color: T.charcoalLight, marginBottom: 12 }}>
            {today} → {resolutionEndDate(resolutionForm)}
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSaveResolution} disabled={!canSave}
              style={{ flex: 1, background: canSave ? `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)` : T.sageLight, color: canSave ? '#fff' : T.charcoalLight, borderRadius: 10, border: 'none', padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'default', fontFamily: 'inherit', opacity: savingR ? 0.6 : 1 }}>
              {savingR ? 'שומר…' : 'שמור'}
            </button>
            <button onClick={() => { setShowAddResolution(false); setResolutionForm(DEFAULT_RESOLUTION_FORM) }}
              style={{ flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 10, border: 'none', padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setPastExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.charcoalLight, fontFamily: 'inherit', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span style={{ display: 'inline-block', transform: pastExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>›</span>
            החלטות שהסתיימו ({past.length})
          </button>
          {pastExpanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {past.map(r => (
                <div key={r.id} style={{ background: T.bgCard, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.75 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: T.charcoal, fontWeight: 600, marginBottom: 2 }}>{r.title}</p>
                    <p style={{ fontSize: 11, color: T.charcoalLight }}>{fmtDate(String(r.startDate))} — {fmtDate(String(r.endDate))}</p>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: r.status === 'completed' ? T.sage + '22' : T.charcoalLight + '22',
                    color: r.status === 'completed' ? T.sage : T.charcoalLight,
                  }}>
                    {r.status === 'completed' ? 'הושלמה' : 'ננטשה'}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.charcoal, minWidth: 36, textAlign: 'center' }}>
                    {r.finalScore ?? '—'}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resolution detail modal */}
      {detailResolution && (() => {
        const r = detailResolution
        const p = r.progress
        const pct = p?.percentage ?? 0
        const pctColor = pct >= 70 ? T.sage : pct >= 40 ? T.amber : T.red
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(44,44,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
            onClick={() => { setDetailResolution(null); setConfirmAbandon(false) }}
          >
            <div
              dir="rtl"
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: T.bgCard, borderRadius: '20px 20px 0 0', padding: '24px 20px 40px' }}
            >
              <p style={{ fontSize: 17, fontWeight: 700, color: T.charcoal, marginBottom: 4 }}>{r.title}</p>
              <p style={{ fontSize: 12, color: T.charcoalLight, marginBottom: 20 }}>
                {fmtDate(String(r.startDate))} — {fmtDate(String(r.endDate))}
                {p && p.daysRemaining > 0 && ` • נותרו ${p.daysRemaining} ימים`}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: pctColor, lineHeight: 1 }}>{pct}%</span>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, background: T.sageLight, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', background: pctColor, borderRadius: 4, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                  </div>
                  {p && <p style={{ fontSize: 12, color: T.charcoalLight }}>{p.successfulDays} מתוך {p.elapsedDays} ימים הצליחו</p>}
                </div>
              </div>

              {p && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  <div style={{ flex: 1, background: T.bg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.amber }}>{p.currentStreak}</p>
                    <p style={{ fontSize: 11, color: T.charcoalLight }}>רצף נוכחי</p>
                  </div>
                  <div style={{ flex: 1, background: T.bg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.blue }}>{p.longestStreak}</p>
                    <p style={{ fontSize: 11, color: T.charcoalLight }}>רצף הארוך</p>
                  </div>
                  <div style={{ flex: 1, background: T.bg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.charcoal }}>{p.totalDays}</p>
                    <p style={{ fontSize: 11, color: T.charcoalLight }}>סה"כ ימים</p>
                  </div>
                </div>
              )}

              {!confirmAbandon ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setConfirmAbandon(true)}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: `1px solid ${T.red}44`, background: 'transparent', color: T.red, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    נטוש החלטה
                  </button>
                  <button
                    onClick={() => { setDetailResolution(null); setConfirmAbandon(false) }}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: T.sageLight, color: T.charcoalMid, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    סגור
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: T.charcoal, marginBottom: 12 }}>לנטוש את ההחלטה? הציון הנוכחי יישמר.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleAbandonResolution}
                      disabled={abandoningR}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: T.red, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: abandoningR ? 0.6 : 1 }}
                    >
                      {abandoningR ? 'מנטש…' : 'אישור — נטוש'}
                    </button>
                    <button
                      onClick={() => setConfirmAbandon(false)}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: T.sageLight, color: T.charcoalMid, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

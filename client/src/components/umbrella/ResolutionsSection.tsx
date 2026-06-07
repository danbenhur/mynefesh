import { useState, useRef, useEffect } from 'react'
import { C } from '../../lib/dashboardTheme'
import { createResolution, abandonResolution, listResolutions } from '../../lib/api'
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

function getQuestionText(r: ApiResolution, questions: Question[]): string {
  const q = questions.find(q => q.id === r.questionId)
  return q?.text ?? ''
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [detailResolution, setDetailResolution] = useState<ApiResolution | null>(null)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [abandoningR, setAbandoningR] = useState(false)
  const [pastExpanded, setPastExpanded] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const newQTextRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (resolutionForm.qSource === 'new') newQTextRef.current?.focus()
  }, [resolutionForm.qSource])

  const active = resolutionsList.filter(r => r.status === 'active')
  const past = resolutionsList.filter(r => r.status !== 'active')
  const today = todayClientStr()
  const qType = resolutionQType(resolutionForm, questions)
  const needsThreshold = qType === 'scale'
  const canSave = !!resolutionForm.title.trim()
    && (resolutionForm.qSource === 'existing' ? !!resolutionForm.existingQId : !!resolutionForm.newQText.trim())
    && (!needsThreshold || !!resolutionForm.successThreshold)
    && !savingR

  const validationHint = canSave ? null
    : !resolutionForm.title.trim() ? 'הוסף כותרת להחלטה'
    : resolutionForm.qSource === 'existing' && !resolutionForm.existingQId ? 'בחר שאלה קיימת, או עבור ל״שאלה חדשה״'
    : resolutionForm.qSource === 'new' && !resolutionForm.newQText.trim() ? 'הוסף טקסט לשאלה החדשה'
    : needsThreshold && !resolutionForm.successThreshold ? 'הגדר סף הצלחה לשאלת הסולם (גלול למטה)'
    : null

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
    console.log('Resolution payload:', payload)

    // Phase 1 — POST only. If this throws, the resolution was NOT saved.
    let created: ApiResolution | null = null
    try {
      created = await createResolution(payload)
      console.log('Resolution created:', created)
    } catch (err) {
      console.error('Resolution save failed:', { err, payload })

      setSavingR(false)

      if (err instanceof Error) {
        const match = err.message.match(/^API (\d+): (.+)$/s)
        if (match) {
          // Server responded with a known HTTP error status — resolution was NOT saved.
          const httpStatus = parseInt(match[1], 10)
          let serverMsg: string
          try {
            const body = JSON.parse(match[2])
            serverMsg = typeof body.error === 'string' ? body.error : `שגיאת שרת ${httpStatus}`
          } catch {
            serverMsg = `שגיאת שרת ${httpStatus}`
          }
          setSaveError(serverMsg)
          setTimeout(() => setSaveError(null), 4000)
          return
        }
        // TypeError = network failure; SyntaxError = 201 body couldn't parse.
        // Either way the server MAY have committed the record — don't block re-creates.
        // Close the sheet, refresh the list, show an ambiguous warning.
        if (err.name === 'TypeError' || err.name === 'SyntaxError') {
          setResolutionForm(DEFAULT_RESOLUTION_FORM)
          setShowAddResolution(false)
          listResolutions(umbrellaId).then(onResolutionsListChange).catch(console.warn)
          setSuccessMsg('ייתכן שההחלטה נוצרה — רענן אם אינה מופיעה')
          setTimeout(() => setSuccessMsg(null), 4000)
          return
        }
      }

      setSaveError('לא הצלחנו לשמור — נסה שוב')
      setTimeout(() => setSaveError(null), 4000)
      return
    }

    // Phase 2 — UI cleanup. Resolution IS in the database — never show error here.
    setSavingR(false)
    try {
      onResolutionsListChange([created!, ...resolutionsList])
    } catch (err) {
      console.warn('Resolution created but list update failed (refreshes on next load):', err)
    }
    setResolutionForm(DEFAULT_RESOLUTION_FORM)
    setShowAddResolution(false)
    setSuccessMsg('ההחלטה נוצרה')
    setTimeout(() => setSuccessMsg(null), 1500)
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
    <div className="mn-umbrella-section" dir="rtl">
      <div className="mn-umbrella-section-header-row">
        <span className="mn-umbrella-section-eyebrow">החלטות</span>
        {active.length > 0 && <span className="mn-gallery-count">{active.length}</span>}
        {!showAddResolution && (
          <button
            className="mn-umbrella-add-btn"
            onClick={() => {
              setShowAddResolution(true)
              setResolutionForm({ ...DEFAULT_RESOLUTION_FORM, existingQId: questions[0]?.id ?? '' })
            }}
          >
            + החלטה חדשה
          </button>
        )}
      </div>
      {!loadingR && active.length === 0 && !showAddResolution && (
        <p style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
          אין החלטות פעילות
        </p>
      )}

      {active.map(r => {
        const p = r.progress
        const pct = p?.percentage ?? 0
        const pctColor = pct >= 70 ? C.good : pct >= 40 ? C.mid : C.low
        const remaining = p?.daysRemaining ?? 0
        const streak = p?.currentStreak ?? 0
        const remainingLabel = remaining > 0 ? `נותרו ${remaining} ימים` : 'הסתיים'
        const questionText = getQuestionText(r, questions)

        return (
          <button
            key={r.id}
            className="mn-umbrella-resolution-card"
            onClick={() => { setDetailResolution(r); setConfirmAbandon(false) }}
          >
            <p className="mn-umbrella-resolution-title">{r.title}</p>
            {questionText && (
              <p className="mn-umbrella-resolution-question">{questionText}</p>
            )}
            <div className="mn-umbrella-resolution-bar-row">
              <span className="mn-umbrella-resolution-pct-pill">{pct}%</span>
              <div className="mn-umbrella-resolution-bar-track">
                <div
                  className="mn-umbrella-resolution-bar-fill"
                  style={{ width: `${pct}%`, background: pctColor }}
                />
              </div>
            </div>
            <div className="mn-umbrella-resolution-stats">
              <span className="mn-umbrella-resolution-stat">
                {p ? `${p.successfulDays}/${p.elapsedDays} ימים` : '—'}
              </span>
              {streak > 0 &&
                <span className="mn-umbrella-resolution-stat streak">🔥 {streak}</span>
              }
              {r.successThreshold !== null &&
                <span className="mn-umbrella-resolution-stat threshold">≥{r.successThreshold}</span>
              }
              <span className="mn-umbrella-resolution-stat remaining">{remainingLabel}</span>
            </div>
          </button>
        )
      })}

      {showAddResolution && (
        <div className="mn-sheet-backdrop" onClick={() => { setShowAddResolution(false); setResolutionForm(DEFAULT_RESOLUTION_FORM) }}>
          <div className="mn-sheet mn-sheet-tall" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="mn-sheet-drag-handle" />
            <div className="mn-sheet-titlebar">
              <span className="mn-sheet-title">החלטה חדשה</span>
              <button
                className="mn-sheet-close-btn"
                onClick={() => { setShowAddResolution(false); setResolutionForm(DEFAULT_RESOLUTION_FORM) }}
              >
                ✕
              </button>
            </div>
            <div className="mn-sheet-body">
              <p className="mn-sheet-field-label">כותרת</p>
              <input
                className="mn-sheet-input"
                value={resolutionForm.title}
                onChange={e => setResolutionForm(f => ({ ...f, title: e.target.value }))}
                placeholder="לדוג׳: ריצה יומית"
              />

              <p className="mn-sheet-field-label">שאלה</p>
              <div className="mn-sheet-toggle-row">
                {(['existing', 'new'] as ResolutionQSource[]).map(src => (
                  <button
                    key={src}
                    className={`mn-sheet-toggle${resolutionForm.qSource === src ? ' active' : ''}`}
                    onClick={() => setResolutionForm(f => ({ ...f, qSource: src }))}
                  >
                    {src === 'existing' ? 'שאלה קיימת' : 'שאלה חדשה'}
                  </button>
                ))}
              </div>

              {resolutionForm.qSource === 'existing' && (
                questions.length === 0
                  ? <p style={{ fontSize: 12, color: C.low, marginBottom: 12 }}>אין שאלות במטרייה זו — הוסף שאלה תחילה.</p>
                  : <select
                      value={resolutionForm.existingQId}
                      onChange={e => setResolutionForm(f => ({ ...f, existingQId: e.target.value }))}
                      className="mn-sheet-input"
                      style={{ marginTop: 8 }}
                    >
                      {questions.map(q => <option key={q.id} value={q.id}>{q.text.slice(0, 60)}</option>)}
                    </select>
              )}

              {resolutionForm.qSource === 'new' && (
                <div style={{ marginBottom: 12, marginTop: 8 }}>
                  <input
                    ref={newQTextRef}
                    className="mn-sheet-input"
                    value={resolutionForm.newQText}
                    onChange={e => setResolutionForm(f => ({ ...f, newQText: e.target.value }))}
                    placeholder="מה תרצה לעקוב אחריו? (לדוגמה: האם רצתי היום?)"
                    style={{ marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([['boolean', 'כן/לא'], ['boolean_partial', 'כן/לא/חלקית'], ['scale', 'סולם']] as [typeof resolutionForm.newQType, string][]).map(([t, label]) => (
                      <button
                        key={t}
                        className={`mn-sheet-toggle${resolutionForm.newQType === t ? ' active' : ''}`}
                        onClick={() => setResolutionForm(f => ({ ...f, newQType: t }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {resolutionForm.newQType === 'scale' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: C.muted }}>טווח:</span>
                      <input type="number" value={resolutionForm.newQScaleMin}
                        onChange={e => setResolutionForm(f => ({ ...f, newQScaleMin: Number(e.target.value) }))}
                        style={{ width: 52, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 6px', fontSize: 12, textAlign: 'center' as const, outline: 'none', fontFamily: 'inherit', color: C.ink }} />
                      <span style={{ color: C.muted }}>—</span>
                      <input type="number" value={resolutionForm.newQScaleMax}
                        onChange={e => setResolutionForm(f => ({ ...f, newQScaleMax: Number(e.target.value) }))}
                        style={{ width: 52, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 6px', fontSize: 12, textAlign: 'center' as const, outline: 'none', fontFamily: 'inherit', color: C.ink }} />
                    </div>
                  )}
                </div>
              )}

              {needsThreshold && (
                <div style={{ marginBottom: 12 }}>
                  <p className="mn-sheet-field-label">סף הצלחה (ערך מינימלי)</p>
                  <input
                    type="number"
                    value={resolutionForm.successThreshold}
                    onChange={e => setResolutionForm(f => ({ ...f, successThreshold: e.target.value }))}
                    placeholder="לדוג׳: 7"
                    style={{ width: 80, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '6px 10px', fontSize: 13, color: C.ink, fontFamily: 'inherit', outline: 'none', textAlign: 'center' as const }}
                  />
                </div>
              )}

              <p className="mn-sheet-field-label">משך</p>
              <div className="mn-sheet-chips-row" style={{ marginBottom: resolutionForm.duration === 'custom' ? 10 : 14 }}>
                {([['30', '30 ימים'], ['90', '90 ימים'], ['180', '180 ימים'], ['custom', 'מותאם']] as [ResolutionDuration, string][]).map(([d, label]) => (
                  <button
                    key={d}
                    className={`mn-sheet-chip${resolutionForm.duration === d ? ' active' : ''}`}
                    onClick={() => setResolutionForm(f => ({ ...f, duration: d as ResolutionDuration, customEnd: d === 'custom' ? addClientDays(today, 30) : f.customEnd }))}
                  >
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
                  className="mn-sheet-input"
                  style={{ marginBottom: 14 }}
                />
              )}
              <p className="mn-sheet-date-range">{today} → {resolutionEndDate(resolutionForm)}</p>
            </div>

            {/* Validation hint — tells Dan exactly what's still needed */}
            {validationHint && (
              <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '0 20px 10px', flexShrink: 0 }}>
                {validationHint}
              </p>
            )}

            {/* API error feedback */}
            {saveError && (
              <p style={{ fontSize: 12, color: C.low, textAlign: 'center', padding: '0 20px 8px', fontWeight: 600, flexShrink: 0 }}>
                {saveError}
              </p>
            )}

            <div className="mn-sheet-action-row">
              <button
                className="mn-sheet-btn-ghost"
                onClick={() => { setShowAddResolution(false); setResolutionForm(DEFAULT_RESOLUTION_FORM); setSaveError(null) }}
              >
                ביטול
              </button>
              <button
                className="mn-sheet-btn-primary"
                onClick={handleSaveResolution}
                disabled={!canSave}
              >
                {savingR ? 'שומר…' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setPastExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: C.muted, fontFamily: 'inherit', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span style={{ display: 'inline-block', transform: pastExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>›</span>
            החלטות שהסתיימו
            <span className="mn-gallery-count" style={{ marginRight: 4 }}>{past.length}</span>
          </button>
          {pastExpanded && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {past.map(r => (
                <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.75 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: C.ink, fontWeight: 600, marginBottom: 2 }}>{r.title}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>{fmtDate(String(r.startDate))} — {fmtDate(String(r.endDate))}</p>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: r.status === 'completed' ? C.bar + '22' : C.faint,
                    color: r.status === 'completed' ? C.bar : C.muted,
                  }}>
                    {r.status === 'completed' ? 'הושלמה' : 'ננטשה'}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.ink, minWidth: 36, textAlign: 'center' }}>
                    {r.finalScore ?? '—'}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {detailResolution && (() => {
        const r = detailResolution
        const p = r.progress
        const pct = p?.percentage ?? 0
        const pctColor = pct >= 70 ? C.good : pct >= 40 ? C.mid : C.low
        const questionText = getQuestionText(r, questions)
        return (
          <div
            className="mn-sheet-backdrop"
            onClick={() => { setDetailResolution(null); setConfirmAbandon(false) }}
          >
            <div
              className="mn-sheet mn-sheet-tall"
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              <div className="mn-sheet-drag-handle" />
              <div className="mn-sheet-body" style={{ paddingTop: 12 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{r.title}</p>
                {questionText && (
                  <p style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{questionText}</p>
                )}
                <p style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
                  {fmtDate(String(r.startDate))} — {fmtDate(String(r.endDate))}
                  {p && p.daysRemaining > 0 && ` • נותרו ${p.daysRemaining} ימים`}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <span style={{ fontSize: 44, fontWeight: 800, color: pctColor, lineHeight: 1 }}>{pct}%</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 8, background: C.faint, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ height: '100%', background: pctColor, borderRadius: 4, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                    </div>
                    {p && <p style={{ fontSize: 12, color: C.muted }}>{p.successfulDays} מתוך {p.elapsedDays} ימים הצליחו</p>}
                  </div>
                </div>

                {p && (
                  <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    <div style={{ flex: 1, background: C.warmBg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' as const }}>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.mid }}>{p.currentStreak}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>רצף נוכחי</p>
                    </div>
                    <div style={{ flex: 1, background: C.warmBg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' as const }}>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.line }}>{p.longestStreak}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>רצף הארוך</p>
                    </div>
                    <div style={{ flex: 1, background: C.warmBg, borderRadius: 12, padding: '10px 14px', textAlign: 'center' as const }}>
                      <p style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>{p.totalDays}</p>
                      <p style={{ fontSize: 11, color: C.muted }}>סה"כ ימים</p>
                    </div>
                  </div>
                )}

                {!confirmAbandon ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setConfirmAbandon(true)}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: `1px solid ${C.low}44`, background: 'transparent', color: C.low, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      נטוש החלטה
                    </button>
                    <button
                      onClick={() => { setDetailResolution(null); setConfirmAbandon(false) }}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: C.faint, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      סגור
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: C.ink, marginBottom: 12 }}>לנטוש את ההחלטה? הציון הנוכחי יישמר.</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleAbandonResolution}
                        disabled={abandoningR}
                        style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: C.low, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: abandoningR ? 0.6 : 1 }}
                      >
                        {abandoningR ? 'מנטש…' : 'אישור — נטוש'}
                      </button>
                      <button
                        onClick={() => setConfirmAbandon(false)}
                        style={{ flex: 1, padding: '11px 0', borderRadius: 14, border: 'none', background: C.faint, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {successMsg && (
        <div className="mn-umbrella-toast" style={{ background: C.good }}>
          {successMsg}
        </div>
      )}
    </div>
  )
}

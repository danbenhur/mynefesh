import { useState, useEffect } from 'react'
import { T, umbrellaColor } from '../lib/theme'
import { getTodaysInterview, submitInterviewAnswer, completeInterview } from '../lib/api'
import type { ApiComposedQuestion, ApiInterviewSession } from '../lib/api'
import type { NavigateFn } from '../types/nav'
import { useStore } from '../store/useStore'

interface Props {
  navigate: NavigateFn
}

type InterviewState =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'answering'; questions: ApiComposedQuestion[]; session: ApiInterviewSession; index: number; submitting: boolean }
  | { phase: 'done' }
  | { phase: 'error'; message: string }

function ScaleInput({ min, max, value, onSelect }: {
  min: number; max: number; value: number | null; onSelect: (v: number) => void
}) {
  const options: number[] = []
  for (let i = min; i <= max; i++) options.push(i)
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
      {options.map(n => (
        <button
          key={n}
          onClick={() => onSelect(n)}
          style={{
            width: 52, height: 52, borderRadius: 14, border: 'none',
            fontSize: 18, fontWeight: 700,
            background: value === n ? T.sage : T.sageLight,
            color: value === n ? '#fff' : T.charcoal,
            cursor: 'pointer',
            transform: value === n ? 'scale(1.12)' : 'scale(1)',
            boxShadow: value === n ? `0 4px 12px rgba(156,175,136,0.4)` : 'none',
            transition: 'all 0.18s',
            fontFamily: 'inherit',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function BooleanInput({ type, value, onSelect }: {
  type: 'boolean' | 'boolean_partial'
  value: 'yes' | 'no' | 'partial' | null
  onSelect: (v: 'yes' | 'no' | 'partial') => void
}) {
  const opts: Array<{ val: 'yes' | 'no' | 'partial'; label: string }> =
    type === 'boolean_partial'
      ? [{ val: 'yes', label: 'כן' }, { val: 'partial', label: 'חלקית' }, { val: 'no', label: 'לא' }]
      : [{ val: 'yes', label: 'כן' }, { val: 'no', label: 'לא' }]

  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
      {opts.map(o => (
        <button
          key={o.val}
          onClick={() => onSelect(o.val)}
          style={{
            flex: 1, maxWidth: 120, padding: '16px 0', borderRadius: 16, border: 'none',
            fontSize: 18, fontWeight: 700,
            background: value === o.val ? T.sage : T.sageLight,
            color: value === o.val ? '#fff' : T.charcoal,
            cursor: 'pointer',
            boxShadow: value === o.val ? `0 4px 12px rgba(156,175,136,0.4)` : 'none',
            transition: 'all 0.18s',
            fontFamily: 'inherit',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function MultiSelectInput({ options, selected, onToggle }: {
  options: string[]
  selected: string[]
  onToggle: (opt: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map(opt => {
        const isOn = selected.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              width: '100%', padding: '14px 16px',
              borderRadius: 14, border: `2px solid ${isOn ? T.sage : T.sageMid}`,
              background: isOn ? `${T.sage}18` : T.bgCard,
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              border: `2px solid ${isOn ? T.sage : T.sageMid}`,
              background: isOn ? T.sage : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: '#fff',
              transition: 'all 0.15s',
            }}>
              {isOn ? '✓' : ''}
            </span>
            <span style={{ fontSize: 15, fontWeight: isOn ? 600 : 400, color: T.charcoal }}>
              {opt}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CommentBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 16 }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: T.charcoalLight, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
            margin: '0 auto',
          }}
        >
          <span>💬</span>
          <span>הוסף הערה</span>
        </button>
      ) : (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="הערה אופציונלית..."
          rows={3}
          autoFocus
          dir="rtl"
          style={{
            width: '100%', background: T.bgCard, borderRadius: 12,
            border: `1px solid ${T.sageMid}`, padding: '10px 12px',
            fontSize: 13, color: T.charcoal, fontFamily: 'inherit',
            outline: 'none', resize: 'none', boxSizing: 'border-box',
            lineHeight: 1.6, direction: 'rtl',
          }}
        />
      )}
    </div>
  )
}

export default function InterviewScreen({ navigate }: Props) {
  const loadUmbrellas = useStore(s => s.loadUmbrellas)
  const [state, setState] = useState<InterviewState>({ phase: 'loading' })
  const [completeError, setCompleteError] = useState(false)
  const [textValue, setTextValue] = useState('')
  const [scaleValue, setScaleValue] = useState<number | null>(null)
  const [boolValue, setBoolValue] = useState<'yes' | 'no' | 'partial' | null>(null)
  const [multiValue, setMultiValue] = useState<string[]>([])
  const [commentValue, setCommentValue] = useState('')

  useEffect(() => {
    getTodaysInterview()
      .then(({ questions, session }) => {
        if (questions.length === 0) {
          setState({ phase: 'empty' })
          return
        }
        // Resume from current_index
        const index = Math.min(session.currentIndex, questions.length - 1)
        if (session.completedAt) {
          setState({ phase: 'done' })
        } else {
          setState({ phase: 'answering', questions, session, index, submitting: false })
        }
      })
      .catch(() => setState({ phase: 'error', message: 'לא ניתן לטעון את השאלות' }))
  }, [])

  // Reset input fields whenever index advances
  useEffect(() => {
    setTextValue('')
    setScaleValue(null)
    setBoolValue(null)
    setMultiValue([])
    setCommentValue('')
  }, [state.phase === 'answering' ? (state as Extract<InterviewState, { phase: 'answering' }>).index : null])

  function toggleMulti(opt: string) {
    setMultiValue(prev =>
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
    )
  }

  async function handleNext() {
    if (state.phase !== 'answering') return
    const { questions, session, index } = state

    const q = questions[index]
    const payload: Parameters<typeof submitInterviewAnswer>[0] = {
      questionId: q.id,
      comment: commentValue.trim() || null,
    }

    if (q.answerType === 'text') payload.answerText = textValue || ''
    else if (q.answerType === 'scale' && scaleValue !== null) payload.answerScale = scaleValue
    else if ((q.answerType === 'boolean' || q.answerType === 'boolean_partial') && boolValue) payload.answerBoolean = boolValue
    else if (q.answerType === 'multi_select') payload.answerOptions = multiValue
    else return // should not reach here — button is disabled

    setCompleteError(false)
    setState({ ...state, submitting: true })

    try {
      await submitInterviewAnswer(payload)
    } catch {
      setState({ phase: 'answering', questions, session, index, submitting: false })
      return
    }

    if (index + 1 >= questions.length) {
      try {
        await completeInterview()
        loadUmbrellas() // refresh analytics scores in background — don't await
        setState({ phase: 'done' })
      } catch {
        // Answer was saved but session completion failed — show a visible retry prompt
        setCompleteError(true)
        setState({ phase: 'answering', questions, session, index, submitting: false })
      }
    } else {
      setState({ phase: 'answering', questions, session, index: index + 1, submitting: false })
    }
  }

  function canProceed(): boolean {
    if (state.phase !== 'answering') return false
    const q = state.questions[state.index]
    if (q.answerType === 'text') return true // optional text
    if (q.answerType === 'scale') return scaleValue !== null
    if (q.answerType === 'boolean' || q.answerType === 'boolean_partial') return boolValue !== null
    if (q.answerType === 'multi_select') return true // zero selections is valid
    return false
  }

  // Loading
  if (state.phase === 'loading') {
    return (
      <div dir="rtl" style={{
        minHeight: '100%', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 32, height: 32, border: `2px solid ${T.sage}`,
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  // Error
  if (state.phase === 'error') {
    return (
      <div dir="rtl" style={{
        minHeight: '100%', background: T.bg, padding: '80px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>⚠️</p>
        <p style={{ fontSize: 16, color: T.charcoalMid }}>{state.message}</p>
        <button
          onClick={() => navigate('home')}
          style={{
            marginTop: 32, padding: '14px 32px', borderRadius: 16, border: 'none',
            background: T.sage, color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          חזרה לבית
        </button>
      </div>
    )
  }

  // Empty state — no questions today
  if (state.phase === 'empty') {
    return (
      <div dir="rtl" style={{
        minHeight: '100%', background: T.bg, padding: '80px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      }}>
        <p style={{ fontSize: 56, marginBottom: 16 }}>☀️</p>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: T.charcoal, marginBottom: 8 }}>
          אין שאלות להיום
        </h2>
        <p style={{ fontSize: 14, color: T.charcoalLight, lineHeight: 1.7, marginBottom: 32 }}>
          לא מתוכננות שאלות לתאריך זה. חזור מחר!
        </p>
        <button
          onClick={() => navigate('home')}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
            background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
            color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          חזרה לבית
        </button>
      </div>
    )
  }

  // Done / completion screen
  if (state.phase === 'done') {
    return (
      <div dir="rtl" style={{
        minHeight: '100%', background: T.bg, padding: '80px 24px 100px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        animation: 'checkin-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>✅</p>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: T.charcoal, marginBottom: 8 }}>
          סיימתי!
        </h2>
        <p style={{ fontSize: 14, color: T.charcoalMid, lineHeight: 1.7, marginBottom: 40, maxWidth: 280 }}>
          תודה דן 🌿 ענית על כל השאלות להיום. נפש שמרה הכל.
        </p>
        <button
          onClick={() => navigate('home')}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
            background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
            color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          חזרה לבית
        </button>
      </div>
    )
  }

  // Main interview flow
  const { questions, index, submitting } = state
  const q = questions[index]
  const total = questions.length
  const progressPct = Math.round((index / total) * 100)
  const uColor = umbrellaColor(q.umbrellaName)

  return (
    <div dir="rtl" style={{ minHeight: '100%', background: T.bg, paddingBottom: 100 }}>
      {/* Progress bar + header */}
      <div style={{ padding: '52px 20px 0', background: T.bgCard, paddingBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.charcoal }}>ראיון יומי</p>
          <p style={{ fontSize: 13, color: T.charcoalLight }}>{index + 1} / {total}</p>
        </div>
        <div style={{ height: 4, background: T.sageLight, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: T.sage, borderRadius: 4,
            width: `${progressPct}%`,
            transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
          }} />
        </div>
      </div>

      {/* Question card — key forces re-mount animation on each step */}
      <div
        key={`q-${index}`}
        style={{
          padding: '40px 24px',
          animation: 'checkin-in 0.32s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Umbrella badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: `${uColor}22`, borderRadius: 20,
            padding: '6px 14px',
          }}>
            <span style={{ fontSize: 16 }}>{q.umbrellaIcon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: uColor }}>{q.umbrellaName}</span>
          </div>
        </div>

        {/* Question text */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h2 style={{
            fontSize: 20, fontWeight: 700, color: T.charcoal,
            lineHeight: 1.5, maxWidth: 320, margin: '0 auto',
            direction: 'rtl',
          }}>
            {q.text}
          </h2>
        </div>

        {/* Answer input */}
        {q.answerType === 'text' && (
          <textarea
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            placeholder="כתוב כאן..."
            rows={4}
            dir="rtl"
            style={{
              width: '100%', background: T.bgCard, borderRadius: 16,
              border: `1px solid ${T.sageMid}`, padding: 14,
              fontSize: 15, color: T.charcoal, fontFamily: 'inherit',
              outline: 'none', resize: 'none', boxSizing: 'border-box',
              lineHeight: 1.6, direction: 'rtl',
            }}
          />
        )}

        {q.answerType === 'scale' && (
          <ScaleInput
            min={q.scaleMin ?? 1}
            max={q.scaleMax ?? 5}
            value={scaleValue}
            onSelect={setScaleValue}
          />
        )}

        {(q.answerType === 'boolean' || q.answerType === 'boolean_partial') && (
          <BooleanInput
            type={q.answerType}
            value={boolValue}
            onSelect={setBoolValue}
          />
        )}

        {q.answerType === 'multi_select' && (
          <MultiSelectInput
            options={q.options ?? []}
            selected={multiValue}
            onToggle={toggleMulti}
          />
        )}

        {/* Comment box — shown below every answer type */}
        <CommentBox value={commentValue} onChange={setCommentValue} />

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={!canProceed() || submitting}
          style={{
            width: '100%', marginTop: 28, padding: '14px 0',
            borderRadius: 16, border: 'none',
            background: canProceed() && !submitting
              ? `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`
              : T.sageLight,
            color: canProceed() && !submitting ? '#fff' : T.charcoalLight,
            fontSize: 15, fontWeight: 600,
            cursor: canProceed() && !submitting ? 'pointer' : 'default',
            fontFamily: 'inherit',
            transition: 'all 0.18s',
          }}
        >
          {submitting ? '...' : index + 1 === total ? 'סיים ✓' : 'הבא ›'}
        </button>
        {completeError && index + 1 === total && (
          <p style={{
            marginTop: 12, textAlign: 'center',
            fontSize: 13, color: T.red, lineHeight: 1.5,
          }}>
            לא הצלחנו לשמור את הסיום — נסה שוב
          </p>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { C } from '../lib/dashboardTheme'
import { umbrellaColor } from '../lib/theme'
import { getTodaysInterview, submitInterviewAnswer, completeInterview } from '../lib/api'
import type { ApiComposedQuestion, ApiInterviewSession } from '../lib/api'
import type { NavigateFn } from '../types/nav'
import { useStore } from '../store/useStore'
import './dashboard/dashboard.css'

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
    <div className="mn-interview-scale-row">
      {options.map(n => (
        <button
          key={n}
          onClick={() => onSelect(n)}
          className="mn-interview-scale-btn"
          style={{
            background: value === n ? C.bar : 'rgba(156,175,136,0.12)',
            color: value === n ? '#fff' : C.ink,
            transform: value === n ? 'scale(1.12)' : 'scale(1)',
            boxShadow: value === n ? '0 4px 12px rgba(156,175,136,0.35)' : 'none',
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
    <div className="mn-interview-bool-row">
      {opts.map(o => (
        <button
          key={o.val}
          onClick={() => onSelect(o.val)}
          className="mn-interview-bool-btn"
          style={{
            background: value === o.val ? C.bar : 'rgba(156,175,136,0.12)',
            color: value === o.val ? '#fff' : C.ink,
            boxShadow: value === o.val ? '0 4px 12px rgba(156,175,136,0.35)' : 'none',
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
    <div className="mn-interview-multi-list">
      {options.map(opt => {
        const isOn = selected.includes(opt)
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className="mn-interview-multi-btn"
            style={{
              borderColor: isOn ? C.bar : C.border,
              background: isOn ? `${C.bar}18` : C.card,
            }}
          >
            <span
              className="mn-interview-multi-check"
              style={{
                borderColor: isOn ? C.bar : C.border,
                background: isOn ? C.bar : 'transparent',
              }}
            >
              {isOn ? '✓' : ''}
            </span>
            <span style={{ fontSize: 15, fontWeight: isOn ? 600 : 400, color: C.ink }}>
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
    <div className="mn-interview-comment-wrap">
      {!open ? (
        <button onClick={() => setOpen(true)} className="mn-interview-comment-trigger">
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
          className="mn-interview-comment-input"
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
        const index = Math.min(session.currentIndex, questions.length - 1)
        if (session.completedAt) {
          setState({ phase: 'done' })
        } else {
          setState({ phase: 'answering', questions, session, index, submitting: false })
        }
      })
      .catch(() => setState({ phase: 'error', message: 'לא ניתן לטעון את השאלות' }))
  }, [])

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
    else return

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
        loadUmbrellas()
        setState({ phase: 'done' })
      } catch {
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
    if (q.answerType === 'text') return true
    if (q.answerType === 'scale') return scaleValue !== null
    if (q.answerType === 'boolean' || q.answerType === 'boolean_partial') return boolValue !== null
    if (q.answerType === 'multi_select') return true
    return false
  }

  if (state.phase === 'loading') {
    return (
      <div dir="rtl" className="mn-interview-center">
        <div style={{
          width: 32, height: 32,
          border: `2px solid ${C.bar}`, borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div dir="rtl" className="mn-interview-state-panel">
        <p className="mn-interview-state-emoji">⚠️</p>
        <p style={{ fontSize: 16, color: C.muted }}>{state.message}</p>
        <button
          onClick={() => navigate('home')}
          className="mn-interview-primary-btn"
          style={{ marginTop: 32 }}
        >
          חזרה לבית
        </button>
      </div>
    )
  }

  if (state.phase === 'empty') {
    return (
      <div dir="rtl" className="mn-interview-state-panel">
        <p className="mn-interview-state-emoji">☀️</p>
        <h2 className="mn-interview-state-title">אין שאלות להיום</h2>
        <p className="mn-interview-state-body">לא מתוכננות שאלות לתאריך זה. חזור מחר!</p>
        <button onClick={() => navigate('home')} className="mn-interview-primary-btn">
          חזרה לבית
        </button>
      </div>
    )
  }

  if (state.phase === 'done') {
    return (
      <div dir="rtl" className="mn-interview-state-panel mn-interview-done-panel">
        <p className="mn-interview-state-emoji done">✅</p>
        <h2 className="mn-interview-state-title">סיימתי!</h2>
        <p className="mn-interview-state-body">תודה דן 🌿 ענית על כל השאלות להיום. נפש שמרה הכל.</p>
        <button onClick={() => navigate('home')} className="mn-interview-primary-btn">
          חזרה לבית
        </button>
      </div>
    )
  }

  const { questions, index, submitting } = state
  const q = questions[index]
  const total = questions.length
  const progressPct = Math.round((index / total) * 100)
  const uColor = umbrellaColor(q.umbrellaName)
  const active = canProceed() && !submitting

  return (
    <div dir="rtl" className="mn-interview-screen">
      {/* Progress header */}
      <div className="mn-interview-header">
        <div className="mn-interview-header-row">
          <span className="mn-interview-title">ראיון יומי</span>
          <span className="mn-interview-counter">{index + 1} / {total}</span>
        </div>
        <div className="mn-interview-progress-track">
          <div className="mn-interview-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Question card — keyed to force re-mount animation on each step */}
      <div key={`q-${index}`} className="mn-interview-card">
        {/* Umbrella badge */}
        <div className="mn-interview-badge-wrap">
          <div
            className="mn-interview-badge"
            style={{ background: `${uColor}22` }}
          >
            <span style={{ fontSize: 16 }}>{q.umbrellaIcon}</span>
            <span className="mn-interview-badge-label" style={{ color: uColor }}>{q.umbrellaName}</span>
          </div>
        </div>

        {/* Question text */}
        <div className="mn-interview-question-wrap">
          <h2 className="mn-interview-question-text">{q.text}</h2>
        </div>

        {/* Answer input */}
        {q.answerType === 'text' && (
          <textarea
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            placeholder="כתוב כאן..."
            rows={4}
            dir="rtl"
            className="mn-interview-text-input"
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

        <CommentBox value={commentValue} onChange={setCommentValue} />

        <button
          onClick={handleNext}
          disabled={!active}
          className="mn-interview-next-btn"
          style={{
            background: active
              ? `linear-gradient(135deg, ${C.bar} 0%, ${C.line} 100%)`
              : C.faint,
            color: active ? '#fff' : C.muted,
            cursor: active ? 'pointer' : 'default',
          }}
        >
          {submitting ? '...' : index + 1 === total ? 'סיים ✓' : 'הבא ›'}
        </button>

        {completeError && index + 1 === total && (
          <p className="mn-interview-error-msg">
            לא הצלחנו לשמור את הסיום — נסה שוב
          </p>
        )}
      </div>
    </div>
  )
}

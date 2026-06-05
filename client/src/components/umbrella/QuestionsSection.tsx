import { useState, useEffect, useRef, type ReactNode } from 'react'
import { C } from '../../lib/dashboardTheme'
import Sparkline from '../Sparkline'
import Icon from '../Icon'
import { createQuestion, updateQuestion, deleteQuestion } from '../../lib/api'
import type { ApiQuestionTrendPoint, ApiMultiTrendPoint } from '../../lib/api'
import type { Question } from '../../types/umbrella'
import {
  DEFAULT_FORM,
  type FormState,
  cadenceLabel,
  questionToForm,
  formToPayload,
} from './shared'
import { QuestionForm } from './QuestionForm'

function typeAbbrev(q: Question): string {
  switch (q.answerType) {
    case 'scale': return `${q.scaleMin ?? 1}-${q.scaleMax ?? 5}`
    case 'boolean': return 'כן/לא'
    case 'boolean_partial': return 'כן/לא/חלקית'
    case 'multi_select': return `בחירה מרובה (${q.options?.length ?? 0})`
    default: return q.answerType
  }
}

function renderQRight(
  q: Question,
  trends: Record<string, ApiQuestionTrendPoint[]>,
  multi: Record<string, ApiMultiTrendPoint[]>,
  color: string
): ReactNode {
  if (q.answerType === 'text') {
    const latest = (trends[q.id] ?? []).at(-1)
    if (!latest?.answerText)
      return <span className="mn-umbrella-q-no-data">אין תשובות עדיין</span>
    return <span className="mn-umbrella-q-text-answer">{latest.answerText.slice(0, 24)}</span>
  }
  if (q.answerType === 'multi_select') {
    const pts = multi[q.id] ?? []
    if (pts.length === 0)
      return <span className="mn-umbrella-q-no-data">אין תשובות עדיין</span>
    const top = [...pts].sort((a, b) => b.total - a.total).slice(0, 2)
    return (
      <div className="mn-umbrella-q-chips">
        {top.map(p => <span key={p.option} className="mn-umbrella-q-chip">{p.option}</span>)}
      </div>
    )
  }
  const pts = trends[q.id] ?? []
  const latest = pts.at(-1)
  const sparkData = pts
    .filter(p => p.value !== null)
    .map(p => Math.round((p.value ?? 0) * 100))
  if (!latest)
    return (
      <div className="mn-umbrella-q-spark-empty">
        <span className="mn-umbrella-q-no-data">אין תשובות עדיין</span>
      </div>
    )
  const latestNode = (() => {
    if (latest.answerBoolean) {
      const map = {
        yes:     { sym: '✓', col: C.good },
        no:      { sym: '✗', col: C.low },
        partial: { sym: '◐', col: C.mid },
      } as const
      const m = map[latest.answerBoolean as keyof typeof map]
      return m ? <span style={{ color: m.col }}>{m.sym}</span> : null
    }
    if (latest.answerScale !== null) return `${latest.answerScale}/${q.scaleMax ?? 5}`
    if (latest.value !== null) return `${Math.round(latest.value * 100)}%`
    return '—'
  })()
  return (
    <div className="mn-umbrella-q-spark-wrap">
      {sparkData.length > 0 &&
        <Sparkline data={sparkData} color={color} width={52} height={22} />
      }
      <span className="mn-umbrella-q-latest" style={{ color }}>{latestNode}</span>
    </div>
  )
}

interface Props {
  umbrellaId: string
  color: string
  questions: Question[]
  loadingQ: boolean
  questionTrends: Record<string, ApiQuestionTrendPoint[]>
  multiTrends: Record<string, ApiMultiTrendPoint[]>
  onQuestionsChange: (questions: Question[]) => void
}

export function QuestionsSection({
  umbrellaId,
  color,
  questions,
  loadingQ,
  questionTrends,
  multiTrends,
  onQuestionsChange,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addForm, setAddForm] = useState<FormState>(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [qMenuId, setQMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close kebab menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setQMenuId(null)
      }
    }
    if (qMenuId) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [qMenuId])

  async function handleAdd() {
    if (!addForm.text.trim()) return
    setSaving(true)
    try {
      const q = await createQuestion(umbrellaId, formToPayload(addForm))
      onQuestionsChange([...questions, q as Question])
      setAddForm(DEFAULT_FORM)
      setShowAddForm(false)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(q: Question) {
    setEditingId(q.id)
    setEditForm(questionToForm(q))
    setShowAddForm(false)
  }

  async function handleEdit() {
    if (!editForm.text.trim() || !editingId) return
    setSaving(true)
    try {
      const updated = await updateQuestion(editingId, formToPayload(editForm))
      onQuestionsChange(questions.map(q => q.id === editingId ? (updated as Question) : q))
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteQuestion(id)
    onQuestionsChange(questions.filter(q => q.id !== id))
    setConfirmDeleteId(null)
  }

  return (
    <div className="mn-umbrella-section" dir="rtl">
      <div className="mn-umbrella-section-header-row">
        <span className="mn-umbrella-section-eyebrow">שאלות</span>
        {!loadingQ && questions.length > 0 &&
          <span className="mn-gallery-count">{questions.length}</span>
        }
      </div>

      {loadingQ && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
          <div style={{
            width: 20, height: 20, border: `2px solid ${C.bar}`,
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {!loadingQ && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {questions.map(q => (
            <div key={q.id}>
              {editingId === q.id ? (
                <QuestionForm
                  form={editForm}
                  onChange={setEditForm}
                  onSave={handleEdit}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : confirmDeleteId === q.id ? (
                <div style={{
                  background: C.card, borderRadius: 14, padding: '12px 14px',
                  border: `1px solid ${C.low}26`,
                }}>
                  <p style={{ fontSize: 13, color: C.ink, marginBottom: 10 }}>
                    למחוק את השאלה "{q.text}"?
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleDelete(q.id)}
                      style={{
                        flex: 1, background: C.low, color: '#fff', borderRadius: 8,
                        border: 'none', padding: '7px 0', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      מחק
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        flex: 1, background: C.faint, color: C.muted, borderRadius: 8,
                        border: 'none', padding: '7px 0', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mn-umbrella-q-card" style={{ opacity: q.enabled ? 1 : 0.5 }}>
                  <div className="mn-umbrella-q-main">
                    <div className="mn-umbrella-q-text-col">
                      <p className="mn-umbrella-q-text">{q.text}</p>
                      <div className="mn-umbrella-q-pills">
                        <span className="mn-umbrella-q-pill">{cadenceLabel(q)}</span>
                        {q.answerType !== 'text' &&
                          <span className="mn-umbrella-q-pill">{typeAbbrev(q)}</span>
                        }
                      </div>
                    </div>
                    <div className="mn-umbrella-q-right-col">
                      {renderQRight(q, questionTrends, multiTrends, color)}
                    </div>
                    <div className="mn-umbrella-q-kebab-wrap" ref={qMenuId === q.id ? menuRef : undefined}>
                      <button
                        className="mn-umbrella-q-kebab"
                        onClick={() => setQMenuId(id => id === q.id ? null : q.id)}
                      >
                        ⋮
                      </button>
                      {qMenuId === q.id && (
                        <div className="mn-umbrella-q-menu">
                          <button
                            className="mn-umbrella-q-menu-item"
                            onClick={() => { startEdit(q); setQMenuId(null) }}
                          >
                            עריכה
                          </button>
                          <button
                            className="mn-umbrella-q-menu-item danger"
                            onClick={() => { setConfirmDeleteId(q.id); setQMenuId(null) }}
                          >
                            מחיקה
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loadingQ && questions.length === 0 && !showAddForm && (
        <p style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 10, textAlign: 'center' }}>
          אין שאלות עדיין. הוסף שאלות לצ׳ק-אין היומי שלך.
        </p>
      )}

      {showAddForm ? (
        <QuestionForm
          form={addForm}
          onChange={setAddForm}
          onSave={handleAdd}
          onCancel={() => { setShowAddForm(false); setAddForm(DEFAULT_FORM) }}
          saving={saving}
        />
      ) : (
        <button
          className="mn-umbrella-q-add-btn"
          onClick={() => { setShowAddForm(true); setEditingId(null) }}
        >
          <Icon name="plus" size={14} color="rgba(44,44,42,0.52)" />
          + הוספת שאלה
        </button>
      )}

      {/* Per-question trends section deleted — sparklines now integrated into each question card */}
    </div>
  )
}

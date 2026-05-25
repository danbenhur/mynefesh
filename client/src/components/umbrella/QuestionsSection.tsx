import { useState } from 'react'
import { T } from '../../lib/theme'
import Sparkline from '../Sparkline'
import Icon from '../Icon'
import { createQuestion, updateQuestion, deleteQuestion } from '../../lib/api'
import type { ApiQuestionTrendPoint, ApiMultiTrendPoint } from '../../lib/api'
import type { Question } from '../../types/umbrella'
import {
  CADENCE_COLOR,
  DEFAULT_FORM,
  type FormState,
  cadenceLabel,
  questionToForm,
  formToPayload,
} from './shared'
import { QuestionForm } from './QuestionForm'

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

  const regularQs = questions.filter(q => q.answerType !== 'multi_select' && (questionTrends[q.id]?.length ?? 0) > 0)
  const multiQs = questions.filter(q => q.answerType === 'multi_select' && (multiTrends[q.id]?.some(p => p.total > 0)))

  return (
    <>
      {/* Questions list */}
      <div style={{ marginTop: 24 }} dir="rtl">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.charcoal }}>שאלות</p>
          {!loadingQ && (
            <span style={{ fontSize: 11, color: T.charcoalLight }}>
              {questions.length} שאלות
            </span>
          )}
        </div>

        {loadingQ && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <div style={{
              width: 20, height: 20, border: `2px solid ${T.sage}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {!loadingQ && questions.length > 0 && (
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
                    background: T.bgCard, borderRadius: 14, padding: '12px 14px',
                    boxShadow: '0 1px 6px rgba(44,44,42,0.06)',
                    border: `1px solid ${T.red}22`,
                  }}>
                    <p style={{ fontSize: 13, color: T.charcoal, marginBottom: 10 }}>
                      למחוק את השאלה "{q.text}"?
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleDelete(q.id)}
                        style={{
                          flex: 1, background: T.red, color: '#fff', borderRadius: 8,
                          border: 'none', padding: '7px 0', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        מחק
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                          flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 8,
                          border: 'none', padding: '7px 0', fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: T.bgCard, borderRadius: 14, padding: '12px 14px',
                    boxShadow: '0 1px 6px rgba(44,44,42,0.05)',
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    opacity: q.enabled ? 1 : 0.5,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: T.charcoal, lineHeight: 1.4, marginBottom: 6 }}>
                        {q.text}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 20,
                          background: CADENCE_COLOR[q.cadence] + '20',
                          color: CADENCE_COLOR[q.cadence],
                          fontSize: 11, fontWeight: 600,
                        }}>
                          {cadenceLabel(q)}
                        </span>
                        {q.answerType !== 'text' && (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 20,
                            background: T.charcoalLight + '20', color: T.charcoalLight,
                            fontSize: 11, fontWeight: 600,
                          }}>
                            {q.answerType === 'scale'
                              ? `${q.scaleMin ?? 1}-${q.scaleMax ?? 5}`
                              : q.answerType === 'boolean'
                                ? 'כן/לא'
                                : q.answerType === 'boolean_partial'
                                  ? 'כן/לא/חלקית'
                                  : q.answerType === 'multi_select'
                                    ? `בחירה מרובה (${q.options?.length ?? 0})`
                                    : q.answerType}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => startEdit(q)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 11, color: T.blue, fontWeight: 600, fontFamily: 'inherit',
                          padding: '4px 6px',
                        }}
                      >
                        ערוך
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(q.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 11, color: T.red, fontWeight: 600, fontFamily: 'inherit',
                          padding: '4px 6px',
                        }}
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loadingQ && questions.length === 0 && !showAddForm && (
          <p style={{ fontSize: 12, color: T.charcoalLight, fontStyle: 'italic', marginBottom: 10, textAlign: 'center' }}>
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
            onClick={() => { setShowAddForm(true); setEditingId(null) }}
            style={{
              width: '100%', background: 'transparent',
              border: `1.5px dashed ${T.sageMid}`, borderRadius: 14,
              padding: '10px 16px', color: T.charcoalLight, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Icon name="plus" size={14} color={T.charcoalLight} />
            הוסף שאלה
          </button>
        )}
      </div>

      {/* Per-question trends */}
      {(regularQs.length > 0 || multiQs.length > 0) && (
        <div dir="rtl" style={{ marginTop: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: T.charcoal, marginBottom: 10 }}>מגמות לפי שאלה</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {regularQs.map(q => {
              const pts = questionTrends[q.id] ?? []
              const latest = pts[pts.length - 1]
              const sparkData = pts
                .filter(p => p.value !== null)
                .map(p => Math.round((p.value ?? 0) * 100))
              const latestDisplay = (() => {
                if (!latest) return '—'
                if (latest.answerBoolean) {
                  const HE: Record<string, string> = { yes: 'כן', no: 'לא', partial: 'חלקית' }
                  return HE[latest.answerBoolean] ?? latest.answerBoolean
                }
                if (latest.answerScale !== null) return String(latest.answerScale)
                if (latest.answerText) return latest.answerText.slice(0, 18)
                if (latest.value !== null) return `${Math.round(latest.value * 100)}%`
                return '—'
              })()
              return (
                <div
                  key={q.id}
                  style={{
                    background: T.bgCard, borderRadius: 14, padding: '10px 14px',
                    boxShadow: '0 1px 4px rgba(44,44,42,0.05)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: T.charcoal, lineHeight: 1.4 }}>{q.text}</p>
                  </div>
                  {sparkData.length > 0 && (
                    <Sparkline data={sparkData} color={color} width={50} height={20} />
                  )}
                  <span style={{
                    fontSize: 12, fontWeight: 700, color, flexShrink: 0,
                    minWidth: 28, textAlign: 'center',
                  }}>
                    {latestDisplay}
                  </span>
                </div>
              )
            })}
            {multiQs.map(q => {
              const pts = multiTrends[q.id] ?? []
              const maxTotal = Math.max(...pts.map(p => p.total), 1)
              return (
                <div
                  key={q.id}
                  style={{
                    background: T.bgCard, borderRadius: 14, padding: '10px 14px',
                    boxShadow: '0 1px 4px rgba(44,44,42,0.05)',
                  }}
                >
                  <p style={{ fontSize: 12, color: T.charcoal, lineHeight: 1.4, marginBottom: 8 }}>{q.text}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {pts.map(p => (
                      <div key={p.option} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: T.charcoalLight, minWidth: 80, textAlign: 'right' }}>
                          {p.option}
                        </span>
                        <div style={{ flex: 1, height: 10, background: T.sageLight, borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 5,
                            width: `${Math.round((p.total / maxTotal) * 100)}%`,
                            background: color,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 20, textAlign: 'center' }}>
                          {p.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

import { useState, useEffect } from 'react'
import { T, umbrellaColor } from '../lib/theme'
import Ring from './Ring'
import Sparkline from './Sparkline'
import Icon from './Icon'
import { listQuestions, createQuestion, updateQuestion, deleteQuestion, archiveUmbrella, deleteUmbrella, getUmbrellaTrend, getQuestionTrend, createUmbrella } from '../lib/api'
import type { ApiUmbrellaTrendPoint, ApiQuestionTrendPoint } from '../lib/api'
import { useStore } from '../store/useStore'
import type { Umbrella } from '../types/umbrella'
import type { Question, Cadence, AnswerType } from '../types/umbrella'
import type { NavigateFn } from '../types/nav'

const PRIORITY_COLOR: Record<string, string> = {
  high: T.red,
  medium: T.amber,
  low: T.blue,
}

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

const CADENCE_COLOR: Record<Cadence, string> = {
  daily: T.sage,
  weekly: T.blue,
  monthly: T.amber,
  annual: T.purple,
}

const CADENCE_HE: Record<Cadence, string> = {
  daily: 'יומי',
  weekly: 'שבועי',
  monthly: 'חודשי',
  annual: 'שנתי',
}

function cadenceLabel(q: Question): string {
  if (q.cadence === 'daily') return 'יומי'
  if (q.cadence === 'weekly') return `שבועי - ${q.dayOfWeek !== null ? HE_DAYS[q.dayOfWeek] : '?'}`
  if (q.cadence === 'monthly') return `חודשי - ${q.dayOfMonth ?? '?'}`
  if (q.cadence === 'annual') return `שנתי - ${q.dayOfMonth ?? '?'}/${q.monthOfYear ?? '?'}`
  return q.cadence
}

function relativeDate(dateStr: string): string {
  const diffDays = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diffDays === 0) return 'היום'
  if (diffDays === 1) return 'אתמול'
  if (diffDays < 7) return `לפני ${diffDays} ימים`
  if (diffDays < 30) return `לפני ${Math.round(diffDays / 7)} שבועות`
  return `לפני ${Math.round(diffDays / 30)} חודשים`
}

function lastActivity(u: Umbrella): string {
  if (!u.history.length) return '—'
  const sorted = [...u.history].sort((a, b) => b.date.localeCompare(a.date))
  return relativeDate(sorted[0].date)
}

function childSparkData(u: Umbrella): number[] {
  if (u.computedTrend && u.computedTrend.length > 0) return u.computedTrend
  return [...u.history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(h => h.score)
}

interface FormState {
  text: string
  cadence: Cadence
  dayOfWeek: number
  dayOfMonth: number
  monthOfYear: number
  answerType: AnswerType
  scaleMin: number
  scaleMax: number
}

const DEFAULT_FORM: FormState = {
  text: '',
  cadence: 'daily',
  dayOfWeek: 0,
  dayOfMonth: 1,
  monthOfYear: 1,
  answerType: 'text',
  scaleMin: 1,
  scaleMax: 5,
}

function questionToForm(q: Question): FormState {
  return {
    text: q.text,
    cadence: q.cadence,
    dayOfWeek: q.dayOfWeek ?? 0,
    dayOfMonth: q.dayOfMonth ?? 1,
    monthOfYear: q.monthOfYear ?? 1,
    answerType: q.answerType,
    scaleMin: q.scaleMin ?? 1,
    scaleMax: q.scaleMax ?? 5,
  }
}

function formToPayload(f: FormState) {
  return {
    text: f.text,
    cadence: f.cadence,
    dayOfWeek: f.cadence === 'weekly' ? f.dayOfWeek : null,
    dayOfMonth: (f.cadence === 'monthly' || f.cadence === 'annual') ? f.dayOfMonth : null,
    monthOfYear: f.cadence === 'annual' ? f.monthOfYear : null,
    answerType: f.answerType,
    scaleMin: f.answerType === 'scale' ? f.scaleMin : null,
    scaleMax: f.answerType === 'scale' ? f.scaleMax : null,
    position: 0,
    enabled: true,
  }
}

interface QuestionFormProps {
  form: FormState
  onChange: (f: FormState) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}

function QuestionForm({ form, onChange, onSave, onCancel, saving }: QuestionFormProps) {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    onChange({ ...form, [k]: v })

  return (
    <div dir="rtl" style={{
      background: T.bgCard, borderRadius: 16, padding: 16,
      boxShadow: '0 2px 12px rgba(44,44,42,0.08)',
      border: `1px solid ${T.sageMid}`,
    }}>
      {/* Question text */}
      <textarea
        value={form.text}
        onChange={e => set('text', e.target.value)}
        placeholder="מה תרצה לשאול?"
        rows={2}
        style={{
          width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`,
          borderRadius: 10, padding: '8px 12px', fontSize: 13, color: T.charcoal,
          fontFamily: 'inherit', outline: 'none', resize: 'none',
          boxSizing: 'border-box', marginBottom: 12, lineHeight: 1.5,
        }}
      />

      {/* Cadence */}
      <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        תדירות
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['daily', 'weekly', 'monthly', 'annual'] as Cadence[]).map(c => (
          <button
            key={c}
            onClick={() => set('cadence', c)}
            style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              background: form.cadence === c ? CADENCE_COLOR[c] : T.sageLight,
              color: form.cadence === c ? '#fff' : T.charcoalMid,
              transition: 'all 0.15s',
            }}
          >
            {CADENCE_HE[c]}
          </button>
        ))}
      </div>

      {/* Conditional scheduling fields */}
      {form.cadence === 'weekly' && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            יום בשבוע
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {HE_DAYS.map((day, i) => (
              <button
                key={i}
                onClick={() => set('dayOfWeek', i)}
                style={{
                  padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12,
                  background: form.dayOfWeek === i ? T.blue : T.blueLight,
                  color: form.dayOfWeek === i ? '#fff' : T.charcoalMid,
                  transition: 'all 0.15s',
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {(form.cadence === 'monthly' || form.cadence === 'annual') && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            יום בחודש
          </p>
          <select
            value={form.dayOfMonth}
            onChange={e => set('dayOfMonth', Number(e.target.value))}
            style={{
              background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 10,
              padding: '6px 12px', fontSize: 13, color: T.charcoal, fontFamily: 'inherit',
              outline: 'none', cursor: 'pointer',
            }}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {form.cadence === 'annual' && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            חודש
          </p>
          <select
            value={form.monthOfYear}
            onChange={e => set('monthOfYear', Number(e.target.value))}
            style={{
              background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 10,
              padding: '6px 12px', fontSize: 13, color: T.charcoal, fontFamily: 'inherit',
              outline: 'none', cursor: 'pointer',
            }}
          >
            {HE_MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Answer type */}
      <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        סוג תשובה
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {([
          ['text', 'טקסט'],
          ['scale', 'סולם'],
          ['boolean', 'כן/לא'],
          ['boolean_partial', 'כן/לא/חלקית'],
        ] as [AnswerType, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => set('answerType', t)}
            style={{
              padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              background: form.answerType === t ? T.sage : T.sageLight,
              color: form.answerType === t ? '#fff' : T.charcoalMid,
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {form.answerType === 'scale' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: T.charcoalMid }}>מינימום</span>
            <input
              type="number"
              value={form.scaleMin}
              onChange={e => set('scaleMin', Number(e.target.value))}
              min={0}
              style={{
                width: 56, background: T.bg, border: `1px solid ${T.sageMid}`,
                borderRadius: 8, padding: '5px 8px', fontSize: 13,
                color: T.charcoal, fontFamily: 'inherit', outline: 'none', textAlign: 'center',
              }}
            />
          </div>
          <span style={{ color: T.charcoalLight }}>—</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: T.charcoalMid }}>מקסימום</span>
            <input
              type="number"
              value={form.scaleMax}
              onChange={e => set('scaleMax', Number(e.target.value))}
              min={1}
              style={{
                width: 56, background: T.bg, border: `1px solid ${form.scaleMin >= form.scaleMax ? T.red : T.sageMid}`,
                borderRadius: 8, padding: '5px 8px', fontSize: 13,
                color: T.charcoal, fontFamily: 'inherit', outline: 'none', textAlign: 'center',
              }}
            />
          </div>
          {form.scaleMin >= form.scaleMax && (
            <span style={{ fontSize: 11, color: T.red }}>מינ׳ חייב להיות קטן ממקסימום</span>
          )}
        </div>
      )}

      {form.answerType !== 'scale' && <div style={{ marginBottom: 6 }} />}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={!form.text.trim() || saving || (form.answerType === 'scale' && form.scaleMin >= form.scaleMax)}
          style={{
            flex: 1, background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
            color: '#fff', borderRadius: 10, border: 'none', padding: '9px 0',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            opacity: !form.text.trim() || saving || (form.answerType === 'scale' && form.scaleMin >= form.scaleMax) ? 0.5 : 1,
          }}
        >
          {saving ? 'שומר…' : 'שמור'}
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 10,
            border: 'none', padding: '9px 0', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ביטול
        </button>
      </div>
    </div>
  )
}

interface Props {
  umbrella: Umbrella
  navigate: NavigateFn
  goBack: () => void
}

export default function UmbrellaDetail({ umbrella, navigate, goBack }: Props) {
  const color = umbrellaColor(umbrella.name)
  const { loadUmbrellas } = useStore()

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([])
  const [loadingQ, setLoadingQ] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addForm, setAddForm] = useState<FormState>(DEFAULT_FORM)
  const [editForm, setEditForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Child umbrella creation state
  const [showCreateChild, setShowCreateChild] = useState(false)
  const [childName, setChildName] = useState('')
  const [childIcon, setChildIcon] = useState('🏠')
  const [creatingChild, setCreatingChild] = useState(false)

  // Archive / delete state
  const [archiving, setArchiving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Analytics trends
  const [umbrellaTrend, setUmbrellaTrend] = useState<ApiUmbrellaTrendPoint[]>([])
  const [questionTrends, setQuestionTrends] = useState<Record<string, ApiQuestionTrendPoint[]>>({})

  useEffect(() => {
    setLoadingQ(true)
    listQuestions(umbrella.id)
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoadingQ(false))
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
  }, [questions])

  async function handleAdd() {
    if (!addForm.text.trim()) return
    setSaving(true)
    try {
      const q = await createQuestion(umbrella.id, formToPayload(addForm))
      setQuestions(prev => [...prev, q as Question])
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
      setQuestions(prev => prev.map(q => q.id === editingId ? (updated as Question) : q))
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteQuestion(id)
    setQuestions(prev => prev.filter(q => q.id !== id))
    setConfirmDeleteId(null)
  }

  async function handleCreateChild() {
    if (!childName.trim()) return
    setCreatingChild(true)
    try {
      await createUmbrella({ name: childName.trim(), icon: childIcon, parentId: umbrella.id })
      await loadUmbrellas()
      setChildName('')
      setChildIcon('🏠')
      setShowCreateChild(false)
    } finally {
      setCreatingChild(false)
    }
  }

  async function handleArchive() {
    setArchiving(true)
    try {
      await archiveUmbrella(umbrella.id)
      await loadUmbrellas()
      setToast('המטרייה אורכבה')
      setTimeout(() => { goBack() }, 1200)
    } catch {
      setArchiving(false)
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
        <button
          onClick={goBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: T.charcoalLight, fontSize: 13, marginBottom: 16, padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
            <Icon name="back" size={16} color={T.charcoalLight} />
          </span>
          חזור
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: color + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
            }}>
              {umbrella.icon}
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.charcoal, lineHeight: 1.2, marginBottom: 2 }}>
                {umbrella.name}
              </h1>
              <p style={{ fontSize: 12, color: T.charcoalLight }}>
                ציון בריאות:{' '}
                <span style={{ color, fontWeight: 700 }}>
                  {umbrella.computedHealthScore ?? '—'}
                </span>
                {umbrella.computedHealthScore !== null && '/100'}
              </p>
            </div>
          </div>
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

        {/* Sub-areas */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.charcoal }}>תתי-מטריות</p>
            {!showCreateChild && (
              <button
                onClick={() => setShowCreateChild(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, color: T.sage,
                  fontFamily: 'inherit', padding: '2px 6px',
                }}
              >
                + הוסף
              </button>
            )}
          </div>

          {umbrella.children.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {umbrella.children.map(child => {
                const childColor = umbrellaColor(child.name)
                const sparkData = childSparkData(child)
                const openTasks = child.tasks.filter(t => t.status !== 'done')
                const topTask = openTasks[0]

                return (
                  <div
                    key={child.id}
                    style={{
                      background: T.bgCard, borderRadius: 16, padding: '14px 16px',
                      boxShadow: '0 1px 8px rgba(44,44,42,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: T.charcoal, marginBottom: 1 }}>
                          {child.name}
                        </p>
                        <p style={{ fontSize: 11, color: T.charcoalLight }}>פעילות: {lastActivity(child)}</p>
                      </div>
                      {sparkData.length > 0 && (
                        <Sparkline data={sparkData} color={childColor} width={50} height={20} />
                      )}
                      <span style={{ fontSize: 18, fontWeight: 700, color: child.computedHealthScore !== null ? childColor : T.charcoalLight, flexShrink: 0 }}>
                        {child.computedHealthScore ?? '—'}
                      </span>
                    </div>

                    {topTask && (
                      <div style={{
                        marginTop: 10, paddingTop: 10,
                        borderTop: '1px solid rgba(44,44,42,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: PRIORITY_COLOR[topTask.priority] ?? T.charcoalLight,
                          }} />
                          <span style={{ fontSize: 12, color: T.charcoalMid, flex: 1 }}>{topTask.title}</span>
                        </div>
                        <button
                          onClick={() => navigate('chat')}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 700,
                            color: PRIORITY_COLOR[topTask.priority] ?? T.sage,
                            fontFamily: 'inherit', flexShrink: 0, padding: '0 0 0 8px',
                          }}
                        >
                          שאל את Nefesh ←
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {umbrella.children.length === 0 && !showCreateChild && (
            <p style={{
              fontSize: 13, color: T.charcoalLight, textAlign: 'center',
              padding: '20px 0', fontStyle: 'italic',
            }}>
              אין תתי-מטרות עדיין
            </p>
          )}

          {showCreateChild && (
            <div dir="rtl" style={{
              background: T.bgCard, borderRadius: 16, padding: 16,
              boxShadow: '0 1px 8px rgba(44,44,42,0.06)',
              marginTop: umbrella.children.length > 0 ? 10 : 0,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.charcoal, marginBottom: 12 }}>
                תת-מטרייה חדשה
              </p>
              <input
                value={childName}
                onChange={e => setChildName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateChild()}
                placeholder="שם (לדוג׳ בריאות)"
                autoFocus
                style={{
                  width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`,
                  borderRadius: 10, padding: '8px 12px', fontSize: 13, color: T.charcoal,
                  outline: 'none', marginBottom: 12, fontFamily: 'inherit',
                  boxSizing: 'border-box', direction: 'rtl',
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {['🏠','👨‍👩‍👧‍👦','💰','🧒','✨','💪','📚','🎵','🌍','❤️','🕍','💼'].map(icon => (
                  <button
                    key={icon}
                    onClick={() => setChildIcon(icon)}
                    style={{
                      width: 36, height: 36, fontSize: 18, borderRadius: 10, border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: childIcon === icon ? T.sage : T.sageLight,
                      outline: childIcon === icon ? `2px solid ${T.sage}` : 'none',
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCreateChild}
                  disabled={!childName.trim() || creatingChild}
                  style={{
                    flex: 1, background: T.sage, color: '#fff', borderRadius: 10, border: 'none',
                    padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'inherit', opacity: !childName.trim() || creatingChild ? 0.5 : 1,
                  }}
                >
                  {creatingChild ? 'יוצר…' : 'צור'}
                </button>
                <button
                  onClick={() => { setShowCreateChild(false); setChildName(''); setChildIcon('🏠') }}
                  style={{
                    flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 10,
                    border: 'none', padding: '9px 0', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Questions section ─────────────────────────────────── */}
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
                                  : 'כן/לא/חלקית'}
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

        {/* ── Per-question trends ───────────────────────────────── */}
        {(() => {
          const questionsWithData = questions.filter(q => (questionTrends[q.id]?.length ?? 0) > 0)
          if (questionsWithData.length === 0) return null
          return (
            <div dir="rtl" style={{ marginTop: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: T.charcoal, marginBottom: 10 }}>מגמות לפי שאלה</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {questionsWithData.map(q => {
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
              </div>
            </div>
          )
        })()}

        {/* ── Archive / Delete section ──────────────────────────── */}
        <div dir="rtl" style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid rgba(44,44,42,0.08)` }}>
          {confirmDelete ? (
            <div style={{
              background: '#fff5f5', border: `1px solid ${T.red}33`,
              borderRadius: 14, padding: '14px 16px',
            }}>
              <p style={{ fontSize: 13, color: T.charcoal, marginBottom: 4, fontWeight: 600 }}>
                האם אתה בטוח?
              </p>
              <p style={{ fontSize: 12, color: T.charcoalLight, marginBottom: 14, lineHeight: 1.5 }}>
                פעולה זו תמחק את המטרייה וכל הנתונים שלה — לא ניתן לשחזר.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleDeleteUmbrella}
                  disabled={deleting}
                  style={{
                    flex: 1, background: T.red, color: '#fff', borderRadius: 10,
                    border: 'none', padding: '9px 0', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? 'מוחק…' : 'מחק לצמיתות'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 10,
                    border: 'none', padding: '9px 0', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleArchive}
                disabled={archiving}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
                  background: T.sageLight, color: T.charcoalMid,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: archiving ? 0.6 : 1,
                }}
              >
                {archiving ? 'מארכב…' : '📦 ארכוב המטרייה'}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 14,
                  border: `1px solid ${T.red}44`, background: 'transparent',
                  color: T.red, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                מחק המטרייה
              </button>
            </div>
          )}
        </div>
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
    </div>
  )
}

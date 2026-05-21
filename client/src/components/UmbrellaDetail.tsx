import { useState, useEffect } from 'react'
import { T, umbrellaColor } from '../lib/theme'
import Ring from './Ring'
import Sparkline from './Sparkline'
import Icon from './Icon'
import { listQuestions, createQuestion, updateQuestion, deleteQuestion, archiveUmbrella, deleteUmbrella, getUmbrellaTrend, getQuestionTrend, createUmbrella, getQuestionMultiTrend, updateUmbrella, listResolutions, createResolution, abandonResolution } from '../lib/api'
import type { ApiUmbrellaTrendPoint, ApiQuestionTrendPoint, ApiMultiTrendPoint, ApiResolution } from '../lib/api'
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
  options: string[]
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
  options: [],
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
    options: q.options ?? [],
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
    options: f.answerType === 'multi_select' ? f.options : null,
    position: 0,
    enabled: true,
  }
}

function OptionsManager({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const [draft, setDraft] = useState('')

  function addOption() {
    const trimmed = draft.trim()
    if (!trimmed || options.includes(trimmed)) return
    onChange([...options, trimmed])
    setDraft('')
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        אפשרויות
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              flex: 1, fontSize: 13, color: T.charcoal,
              background: T.sageLight, borderRadius: 8, padding: '6px 10px',
            }}>
              {opt}
            </span>
            <button
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 16, color: T.charcoalLight, lineHeight: 1, padding: '0 2px',
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addOption()}
          placeholder="הוסף אפשרות..."
          style={{
            flex: 1, background: T.bg, border: `1px solid ${T.sageMid}`,
            borderRadius: 8, padding: '6px 10px', fontSize: 13, color: T.charcoal,
            fontFamily: 'inherit', outline: 'none', direction: 'rtl',
          }}
        />
        <button
          onClick={addOption}
          disabled={!draft.trim() || options.includes(draft.trim())}
          style={{
            background: T.sage, color: '#fff', border: 'none', borderRadius: 8,
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', opacity: !draft.trim() || options.includes(draft.trim()) ? 0.5 : 1,
          }}
        >
          הוסף
        </button>
      </div>
    </div>
  )
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
          ['multi_select', 'בחירה מרובה'],
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

      {form.answerType === 'multi_select' && (
        <OptionsManager
          options={form.options}
          onChange={opts => set('options', opts)}
        />
      )}

      {form.answerType !== 'scale' && form.answerType !== 'multi_select' && <div style={{ marginBottom: 6 }} />}

      {/* Actions */}
      {form.answerType === 'multi_select' && form.options.length < 2 && (
        <p style={{ fontSize: 11, color: T.red, marginBottom: 8 }}>נדרשות לפחות 2 אפשרויות</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={!form.text.trim() || saving || (form.answerType === 'scale' && form.scaleMin >= form.scaleMax) || (form.answerType === 'multi_select' && form.options.length < 2)}
          style={{
            flex: 1, background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
            color: '#fff', borderRadius: 10, border: 'none', padding: '9px 0',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            opacity: !form.text.trim() || saving || (form.answerType === 'scale' && form.scaleMin >= form.scaleMax) || (form.answerType === 'multi_select' && form.options.length < 2) ? 0.5 : 1,
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

// ─── Resolution helpers ────────────────────────────────────────────────────────

type ResolutionQSource = 'existing' | 'new'
type ResolutionDuration = '30' | '90' | '180' | 'custom'

interface ResolutionFormState {
  title: string
  qSource: ResolutionQSource
  existingQId: string
  newQText: string
  newQType: 'boolean' | 'boolean_partial' | 'scale'
  newQScaleMin: number
  newQScaleMax: number
  duration: ResolutionDuration
  customEnd: string
  successThreshold: string
}

function todayClientStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addClientDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const DEFAULT_RESOLUTION_FORM: ResolutionFormState = {
  title: '',
  qSource: 'existing',
  existingQId: '',
  newQText: '',
  newQType: 'boolean',
  newQScaleMin: 1,
  newQScaleMax: 10,
  duration: '30',
  customEnd: '',
  successThreshold: '',
}

function resolutionEndDate(form: ResolutionFormState): string {
  const today = todayClientStr()
  if (form.duration === '30') return addClientDays(today, 30)
  if (form.duration === '90') return addClientDays(today, 90)
  if (form.duration === '180') return addClientDays(today, 180)
  return form.customEnd || addClientDays(today, 30)
}

function resolutionQType(form: ResolutionFormState, questions: Question[]): string {
  if (form.qSource === 'new') return form.newQType
  return questions.find(q => q.id === form.existingQId)?.answerType ?? ''
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMOJI_OPTIONS = ['🏠','👨‍👩‍👧‍👦','💰','🧒','✨','💪','📚','🎵','🌍','❤️','🕍','💼','🎯','🔥','⚡','🌟']

function flattenWithDepth(list: Umbrella[], depth = 0): Array<{ u: Umbrella; depth: number }> {
  return list.flatMap(u => [{ u, depth }, ...flattenWithDepth(u.children, depth + 1)])
}

function collectDescendantIds(u: Umbrella): Set<string> {
  const ids = new Set<string>()
  function walk(node: Umbrella) { ids.add(node.id); node.children.forEach(walk) }
  u.children.forEach(walk)
  return ids
}

interface Props {
  umbrella: Umbrella
  navigate: NavigateFn
  goBack: () => void
}

export default function UmbrellaDetail({ umbrella, navigate, goBack }: Props) {
  const color = umbrellaColor(umbrella.name)
  const { loadUmbrellas, umbrellas: allUmbrellas } = useStore()

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

  // Resolutions state
  const [resolutionsList, setResolutionsList] = useState<ApiResolution[]>([])
  const [loadingR, setLoadingR] = useState(true)
  const [showAddResolution, setShowAddResolution] = useState(false)
  const [resolutionForm, setResolutionForm] = useState<ResolutionFormState>(DEFAULT_RESOLUTION_FORM)
  const [savingR, setSavingR] = useState(false)
  const [detailResolution, setDetailResolution] = useState<ApiResolution | null>(null)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [abandoningR, setAbandoningR] = useState(false)
  const [pastExpanded, setPastExpanded] = useState(false)

  // Header inline-edit state
  const [editingHeader, setEditingHeader] = useState(false)
  const [headerNameInput, setHeaderNameInput] = useState('')
  const [headerIconInput, setHeaderIconInput] = useState('')
  const [savingHeader, setSavingHeader] = useState(false)

  // Move-under-parent state
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveTargetId, setMoveTargetId] = useState<string | null | undefined>(undefined)
  const [moving, setMoving] = useState(false)

  // Analytics trends
  const [umbrellaTrend, setUmbrellaTrend] = useState<ApiUmbrellaTrendPoint[]>([])
  const [questionTrends, setQuestionTrends] = useState<Record<string, ApiQuestionTrendPoint[]>>({})
  const [multiTrends, setMultiTrends] = useState<Record<string, ApiMultiTrendPoint[]>>({})

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

  async function handleSaveResolution() {
    const today = todayClientStr()
    const endDate = resolutionEndDate(resolutionForm)
    const qType = resolutionQType(resolutionForm, questions)
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
        umbrellaId: umbrella.id,
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
      setResolutionsList(prev => [created, ...prev])
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
      setResolutionsList(prev => prev.map(r => r.id === updated.id ? updated : r))
      setDetailResolution(null)
      setConfirmAbandon(false)
    } catch (err) {
      console.error('handleAbandonResolution:', err)
    } finally {
      setAbandoningR(false)
    }
  }

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
            {editingHeader ? (
              <div style={{ flex: 1 }}>
                {/* Emoji picker */}
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
                {/* Name input */}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: T.charcoal, lineHeight: 1.2 }}>
                      {umbrella.name}
                    </h1>
                    <button
                      onClick={() => { setHeaderNameInput(umbrella.name); setHeaderIconInput(umbrella.icon); setEditingHeader(true) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: T.charcoalLight, padding: '2px 4px', lineHeight: 1,
                        fontSize: 15, fontFamily: 'inherit', flexShrink: 0,
                      }}
                      title="ערוך שם ואייקון"
                    >
                      ✎
                    </button>
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
                    onClick={() => navigate('umbrella', { umbrellaId: child.id })}
                    style={{
                      background: T.bgCard, borderRadius: 16, padding: '14px 16px',
                      boxShadow: '0 1px 8px rgba(44,44,42,0.05)',
                      cursor: 'pointer',
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
                          onClick={(e) => { e.stopPropagation(); navigate('chat') }}
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

        {/* ── Per-question trends ───────────────────────────────── */}
        {(() => {
          const regularQs = questions.filter(q => q.answerType !== 'multi_select' && (questionTrends[q.id]?.length ?? 0) > 0)
          const multiQs = questions.filter(q => q.answerType === 'multi_select' && (multiTrends[q.id]?.some(p => p.total > 0)))
          if (regularQs.length === 0 && multiQs.length === 0) return null
          return (
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
          )
        })()}

        {/* ── Resolutions section ──────────────────────────────── */}
        {(() => {
          const active = resolutionsList.filter(r => r.status === 'active')
          const past = resolutionsList.filter(r => r.status !== 'active')
          const today = todayClientStr()
          const qType = resolutionQType(resolutionForm, questions)
          const needsThreshold = qType === 'scale'
          const canSave = !!resolutionForm.title.trim()
            && (resolutionForm.qSource === 'existing' ? !!resolutionForm.existingQId : !!resolutionForm.newQText.trim())
            && (!needsThreshold || !!resolutionForm.successThreshold)
            && !savingR

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

              {/* Active resolution cards */}
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
                    {/* Progress bar */}
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

              {/* Create form */}
              {showAddResolution && (
                <div dir="rtl" style={{ background: T.bgCard, borderRadius: 16, padding: 16, boxShadow: '0 2px 12px rgba(44,44,42,0.08)', border: `1px solid ${T.sageMid}`, marginBottom: 12 }}>
                  {/* Title */}
                  <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>כותרת</p>
                  <input
                    value={resolutionForm.title}
                    onChange={e => setResolutionForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="לדוג׳: ריצה יומית"
                    style={{ width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: T.charcoal, fontFamily: 'inherit', outline: 'none', marginBottom: 14, boxSizing: 'border-box', direction: 'rtl' }}
                  />

                  {/* Question source toggle */}
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

                  {/* Success threshold (scale questions only) */}
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

                  {/* Duration presets */}
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

              {/* Past resolutions */}
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
                onClick={() => { setMoveTargetId(undefined); setShowMoveModal(true) }}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
                  background: T.blueLight, color: T.blue,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                מעבר תחת מטרייה אחרת
              </button>
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

              {/* Big % + bar */}
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
                {/* Root option */}
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
                    fontSize: 14, color: moveTargetId === null ? T.blue : T.charcoal, fontWeight: moveTargetId === null ? 700 : 400,
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

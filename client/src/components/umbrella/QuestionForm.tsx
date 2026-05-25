import { useState } from 'react'
import { T } from '../../lib/theme'
import type { Cadence, AnswerType } from '../../types/umbrella'
import {
  HE_DAYS,
  HE_MONTHS,
  CADENCE_COLOR,
  CADENCE_HE,
  type FormState,
} from './shared'

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

export function QuestionForm({ form, onChange, onSave, onCancel, saving }: QuestionFormProps) {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    onChange({ ...form, [k]: v })

  const isInvalid =
    !form.text.trim() ||
    saving ||
    (form.answerType === 'scale' && form.scaleMin >= form.scaleMax) ||
    (form.answerType === 'multi_select' && form.options.length < 2)

  return (
    <div dir="rtl" style={{
      background: T.bgCard, borderRadius: 16, padding: 16,
      boxShadow: '0 2px 12px rgba(44,44,42,0.08)',
      border: `1px solid ${T.sageMid}`,
    }}>
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
                width: 56, background: T.bg,
                border: `1px solid ${form.scaleMin >= form.scaleMax ? T.red : T.sageMid}`,
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

      {form.answerType === 'multi_select' && form.options.length < 2 && (
        <p style={{ fontSize: 11, color: T.red, marginBottom: 8 }}>נדרשות לפחות 2 אפשרויות</p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSave}
          disabled={isInvalid}
          style={{
            flex: 1,
            background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
            color: '#fff', borderRadius: 10, border: 'none', padding: '9px 0',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            opacity: isInvalid ? 0.5 : 1,
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

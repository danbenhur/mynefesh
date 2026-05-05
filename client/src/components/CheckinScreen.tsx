import { useState } from 'react'
import { useStore } from '../store/useStore'
import { T } from '../lib/theme'
import type { NavigateFn } from '../types/nav'
import type { Umbrella, Task } from '../types/umbrella'

const STEPS = [
  {
    question: 'How are you feeling about your finances this week?',
    emojis: ['😰', '😟', '😐', '😊', '😄'],
    labels: ['Stressed', 'Worried', 'Neutral', 'OK', 'Great'],
  },
  {
    question: 'How connected do you feel with your family?',
    emojis: ['😔', '😕', '😐', '😊', '🥰'],
    labels: ['Distant', 'Low', 'Neutral', 'Good', 'Close'],
  },
  {
    question: "How's your spiritual practice going this week?",
    emojis: ['❌', '😶', '😐', '🙏', '✨'],
    labels: ['Missed', 'Minimal', 'Some', 'Good', 'Flowing'],
  },
  {
    question: "How's your physical health and energy?",
    emojis: ['😴', '😪', '😐', '😊', '⚡'],
    labels: ['Exhausted', 'Low', 'OK', 'Good', 'Energized'],
  },
]

function collectTasks(us: Umbrella[]): Task[] {
  return us.flatMap(u => [...u.tasks, ...collectTasks(u.children)])
}

interface Props {
  navigate: NavigateFn
}

export default function CheckinScreen({ navigate }: Props) {
  const umbrellas = useStore(s => s.umbrellas)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [freeText, setFreeText] = useState('')
  const [done, setDone] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  const allTasks = collectTasks(umbrellas)
  const highTask = allTasks.find(t => t.priority === 'high' && t.status !== 'done')
  const todaysFocus = highTask?.title ?? 'Take a moment for yourself'

  const totalSteps = STEPS.length + 1 // 4 emoji + 1 freetext
  const progressPct = done ? 100 : Math.round((step / totalSteps) * 100)

  function handleEmojiAnswer(answerIdx: number) {
    if (advancing) return
    setAnswers(prev => ({ ...prev, [step]: answerIdx }))
    setAdvancing(true)
    setTimeout(() => {
      setAdvancing(false)
      if (step < STEPS.length - 1) {
        setStep(s => s + 1)
      } else {
        setStep(STEPS.length) // advance to free text step
      }
    }, 320)
  }

  function handleComplete() {
    setDone(true)
  }

  if (done) {
    return (
      <div style={{
        minHeight: '100%', background: T.bg, paddingBottom: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '80px 24px 100px', textAlign: 'center',
        animation: 'checkin-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>🌿</p>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: T.charcoal, marginBottom: 8 }}>Check-in complete</h2>
        <p style={{ fontSize: 14, color: T.charcoalMid, lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>
          Thank you, Dan. Nefesh has noted everything. Keep going — small steps add up.
        </p>

        {/* Today's focus card */}
        <div style={{
          width: '100%', background: T.bgCard, borderRadius: 16, padding: '16px 20px',
          marginBottom: 24, boxShadow: '0 1px 8px rgba(44,44,42,0.06)', textAlign: 'left',
        }}>
          <p style={{ fontSize: 11, color: T.charcoalLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Today's focus
          </p>
          <p style={{ fontSize: 15, fontWeight: 600, color: T.charcoal }}>{todaysFocus}</p>
        </div>

        <button
          onClick={() => navigate('chat')}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
            background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
            color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Talk to Nefesh
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', background: T.bg, paddingBottom: 100 }}>
      {/* Progress bar + header */}
      <div style={{ padding: '52px 20px 0', background: T.bgCard, paddingBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.charcoal }}>Daily Check-in</p>
          <p style={{ fontSize: 13, color: T.charcoalLight }}>
            {step < STEPS.length ? `${step + 1} / ${totalSteps}` : `${totalSteps} / ${totalSteps}`}
          </p>
        </div>
        <div style={{ height: 4, background: T.sageLight, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: T.sage, borderRadius: 4,
            width: `${progressPct}%`,
            transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
          }} />
        </div>
      </div>

      {/* Step content */}
      <div
        key={step}
        style={{
          padding: '40px 24px',
          animation: 'checkin-in 0.32s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {step < STEPS.length ? (
          /* Emoji question step */
          <>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <p style={{ fontSize: 52, marginBottom: 20 }}>{STEPS[step].emojis[2]}</p>
              <h2 style={{
                fontSize: 20, fontWeight: 700, color: T.charcoal,
                lineHeight: 1.4, maxWidth: 300, margin: '0 auto',
              }}>
                {STEPS[step].question}
              </h2>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {STEPS[step].emojis.map((emoji, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => handleEmojiAnswer(i)}
                    disabled={advancing}
                    style={{
                      width: 52, height: 52, borderRadius: 16, border: 'none',
                      cursor: advancing ? 'default' : 'pointer', fontSize: 26,
                      background: answers[step] === i ? T.sage : T.sageLight,
                      transform: answers[step] === i ? 'scale(1.12)' : 'scale(1)',
                      boxShadow: answers[step] === i ? `0 4px 12px rgba(156,175,136,0.4)` : 'none',
                      transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {emoji}
                  </button>
                  <span style={{ fontSize: 9, color: T.charcoalLight, textAlign: 'center', maxWidth: 44 }}>
                    {STEPS[step].labels[i]}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Free text step */
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.charcoal, lineHeight: 1.4 }}>
                Anything on your mind you'd like Nefesh to know?
              </h2>
            </div>
            <textarea
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Share anything — thoughts, worries, wins…"
              rows={5}
              style={{
                width: '100%', background: T.bgCard, borderRadius: 16,
                border: `1px solid ${T.sageMid}`, padding: 14,
                fontSize: 14, color: T.charcoal, fontFamily: 'inherit',
                outline: 'none', resize: 'none', boxSizing: 'border-box',
                minHeight: 120, lineHeight: 1.6,
              }}
            />
            <button
              onClick={handleComplete}
              style={{
                width: '100%', marginTop: 16, padding: '14px 0',
                borderRadius: 16, border: 'none',
                background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
                color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Complete Check-in
            </button>
          </>
        )}
      </div>
    </div>
  )
}

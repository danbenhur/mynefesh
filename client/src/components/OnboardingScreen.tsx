import { useState } from 'react'
import { T } from '../lib/theme'
import { completeOnboarding } from '../lib/api'

interface Props {
  onComplete: () => void
}

const STARTER_AREAS = [
  { name: 'רוחניות', icon: '🕍' },
  { name: 'בריאות', icon: '💪' },
  { name: 'כסף', icon: '💰' },
  { name: 'קשרים', icon: '👨‍👩‍👧‍👦' },
  { name: 'ילדים', icon: '🧒' },
  { name: 'עבודה', icon: '💼' },
  { name: 'תחביבים', icon: '🎨' },
  { name: 'פיתוח אישי', icon: '📚' },
]

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleArea(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function handleComplete() {
    if (selected.size === 0) {
      setError('בחר לפחות תחום אחד להתחיל')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const umbrellaList = STARTER_AREAS
        .filter(a => selected.has(a.name))
        .map(a => ({ name: a.name, icon: a.icon }))
      await completeOnboarding(umbrellaList)
      setStep(3)
    } catch (err) {
      setError('שגיאה — נסה שוב')
      console.error('[onboarding]', err)
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100vh',
    background: T.bg, padding: '24px', textAlign: 'center',
    maxWidth: 430, margin: '0 auto',
  }

  if (step === 1) {
    return (
      <div style={containerStyle}>
        <p style={{ fontSize: 64, marginBottom: 16 }}>🌿</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.charcoal, marginBottom: 8 }}>
          ברוך הבא ל-myNefesh
        </h1>
        <p style={{ fontSize: 14, color: T.charcoalLight, marginBottom: 48, lineHeight: 1.6 }}>
          המזכיר האישי שלך — מנהל כל תחומי החיים במקום אחד.
          <br />נתחיל בהגדרת תחומי החיים שלך.
        </p>
        <button
          onClick={() => setStep(2)}
          style={{
            background: T.sage, color: '#fff', border: 'none',
            borderRadius: 24, padding: '14px 36px',
            fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          בוא נתחיל ←
        </button>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div style={{ ...containerStyle, justifyContent: 'flex-start', paddingTop: 48 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: T.charcoal, marginBottom: 8 }}>
          אילו תחומים חשובים לך?
        </h2>
        <p style={{ fontSize: 13, color: T.charcoalLight, marginBottom: 24 }}>
          בחר את מה שרוצה לעקוב אחריו. תוכל להוסיף עוד מאוחר יותר.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12, width: '100%', marginBottom: 24,
        }}>
          {STARTER_AREAS.map(area => {
            const isOn = selected.has(area.name)
            return (
              <button
                key={area.name}
                onClick={() => toggleArea(area.name)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '16px 12px', borderRadius: 16,
                  border: `2px solid ${isOn ? T.sage : 'rgba(44,44,42,0.12)'}`,
                  background: isOn ? `${T.sage}18` : '#fff',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 32, marginBottom: 8 }}>{area.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.charcoal }}>{area.name}</span>
              </button>
            )
          })}
        </div>

        {error && (
          <p style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</p>
        )}

        <button
          onClick={handleComplete}
          disabled={loading}
          style={{
            background: selected.size > 0 ? T.sage : 'rgba(44,44,42,0.2)',
            color: '#fff', border: 'none',
            borderRadius: 24, padding: '14px 36px',
            fontSize: 16, fontWeight: 600,
            cursor: selected.size > 0 ? 'pointer' : 'default',
            fontFamily: 'inherit', width: '100%',
          }}
        >
          {loading ? 'שומר...' : `סיים (${selected.size} תחומים)`}
        </button>
      </div>
    )
  }

  // Step 3: success
  return (
    <div style={containerStyle}>
      <p style={{ fontSize: 64, marginBottom: 16 }}>✅</p>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: T.charcoal, marginBottom: 8 }}>
        הכל מוכן!
      </h2>
      <p style={{ fontSize: 14, color: T.charcoalLight, marginBottom: 48 }}>
        האזורים שלך הוגדרו. בוא נתחיל לעקוב!
      </p>
      <button
        onClick={onComplete}
        style={{
          background: T.sage, color: '#fff', border: 'none',
          borderRadius: 24, padding: '14px 36px',
          fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        כנס לאפליקציה →
      </button>
    </div>
  )
}

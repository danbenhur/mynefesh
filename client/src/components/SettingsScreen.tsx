import { useState, useEffect } from 'react'
import { T } from '../lib/theme'
import Icon from './Icon'
import { getSettings, updateSettings } from '../lib/api'
import type { NavigateFn } from '../types/nav'

interface Props {
  navigate: NavigateFn
  goBack: () => void
}

export default function SettingsScreen({ goBack }: Props) {
  const [checkinTime, setCheckinTime] = useState('21:00')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSettings()
      .then(s => {
        setCheckinTime(s.checkinTime)
        setPhoneNumber(s.phoneNumber ?? '')
      })
      .catch(() => setError('שגיאה בטעינת ההגדרות'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const updated = await updateSettings({ checkinTime, phoneNumber })
      setCheckinTime(updated.checkinTime)
      setPhoneNumber(updated.phoneNumber ?? '')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('שגיאה בשמירה. בדוק את הפורמט.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div dir="rtl" style={{ minHeight: '100%', background: T.bg, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        padding: '52px 20px 20px',
        background: T.bgCard,
        boxShadow: '0 1px 0 rgba(44,44,42,0.06)',
      }}>
        <button
          onClick={goBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            color: T.charcoalLight, fontSize: 13, marginBottom: 16, padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <Icon name="chevron" size={16} color={T.charcoalLight} />
          חזור
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: T.charcoal, lineHeight: 1.2 }}>
          הגדרות צ'ק-אין יומי
        </h1>
        <p style={{ fontSize: 13, color: T.charcoalLight, marginTop: 4 }}>
          Nefesh ישלח לך הודעת WhatsApp כל ערב
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div style={{
            width: 24, height: 24, border: `2px solid ${T.sage}`,
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      ) : (
        <div style={{ padding: '24px 20px 0' }}>
          {/* Checkin time */}
          <div style={{
            background: T.bgCard, borderRadius: 16,
            boxShadow: '0 1px 6px rgba(44,44,42,0.05)',
            marginBottom: 12, overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(44,44,42,0.06)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                זמן צ'ק-אין יומי
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 14, color: T.charcoal, fontWeight: 500 }}>שלח הודעה בשעה</p>
                <input
                  type="time"
                  value={checkinTime}
                  onChange={e => setCheckinTime(e.target.value)}
                  style={{
                    background: T.sageLight, border: 'none', borderRadius: 10,
                    padding: '6px 12px', fontSize: 15, fontWeight: 700,
                    color: T.charcoal, fontFamily: 'inherit', outline: 'none',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: T.charcoalLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                מספר WhatsApp
              </p>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+972501234567"
                dir="ltr"
                style={{
                  width: '100%', background: T.bg,
                  border: `1px solid ${T.sageMid}`, borderRadius: 10,
                  padding: '10px 12px', fontSize: 14, color: T.charcoal,
                  fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: 11, color: T.charcoalLight, marginTop: 6 }}>
                פורמט: +972501234567 (הכנס את המספר שלך עם קידומת המדינה)
              </p>
            </div>
          </div>

          {/* How it works */}
          <div style={{
            background: T.blueLight, borderRadius: 16, padding: '14px 16px',
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.blue, marginBottom: 8 }}>
              ✨ איך זה עובד
            </p>
            <p style={{ fontSize: 12, color: T.charcoalMid, lineHeight: 1.7 }}>
              כל ערב בשעה שבחרת, Nefesh ישלח לך הודעת WhatsApp.
              תוכל לדחות עד פעמיים (1 שעה כל פעם).
              אחרי 2 דחיות — Nefesh יסיים בחמימות ויחכה למחרת.
              ענה "בוצע" כשסיימת את הצ'ק-אין.
            </p>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: T.red, marginBottom: 12, textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
              background: saved
                ? T.sage
                : `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
              color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {saving ? 'שומר…' : saved ? '✓ נשמר!' : 'שמור'}
          </button>
        </div>
      )}
    </div>
  )
}

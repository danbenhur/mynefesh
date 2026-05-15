import { useState, useEffect } from 'react'
import { T } from '../lib/theme'
import Icon from './Icon'
import { getSettings, updateSettings, getSandboxStatus, markSandboxJoined } from '../lib/api'
import type { NavigateFn } from '../types/nav'

interface Props {
  navigate: NavigateFn
  goBack: () => void
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13, padding: 0,
        background: value ? '#6B8F71' : '#D8D5CF',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

export default function SettingsScreen({ goBack }: Props) {
  const [checkinTime, setCheckinTime] = useState('21:00')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [shabbatMode, setShabbatMode] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [sandboxStatus, setSandboxStatus] = useState<'unknown' | 'active' | 'expired'>('unknown')
  const [markingJoined, setMarkingJoined] = useState(false)

  useEffect(() => {
    Promise.all([getSettings(), getSandboxStatus()])
      .then(([s, sb]) => {
        setCheckinTime(s.checkinTime)
        setPhoneNumber(s.phoneNumber ?? '')
        setShabbatMode(s.shabbatMode)
        setSandboxStatus(sb.sandboxStatus)
      })
      .catch(() => setError('שגיאה בטעינת ההגדרות'))
      .finally(() => setLoading(false))
  }, [])

  async function handleMarkJoined() {
    setMarkingJoined(true)
    try {
      await markSandboxJoined()
      setSandboxStatus('active')
    } catch {
      // silent — banner stays visible
    } finally {
      setMarkingJoined(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const updated = await updateSettings({ checkinTime, phoneNumber, shabbatMode })
      setCheckinTime(updated.checkinTime)
      setPhoneNumber(updated.phoneNumber ?? '')
      setShabbatMode(updated.shabbatMode)
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

      {sandboxStatus === 'expired' && (
        <div style={{
          margin: '12px 20px 0',
          background: '#FFF3CD', borderRadius: 14, padding: '14px 16px',
          border: '1px solid #FFE08A',
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#7A5C00', marginBottom: 6 }}>
            ⚠️ חיבור ה-Sandbox פג תוקפו
          </p>
          <p style={{ fontSize: 12, color: '#7A5C00', lineHeight: 1.6, marginBottom: 10 }}>
            הודעות WhatsApp לא יגיעו עד שתחדש את ה-sandbox.
            שלח &quot;join &lt;קוד&gt;&quot; לדף ה-WhatsApp של Twilio, ואז לחץ למטה.
          </p>
          <button
            onClick={handleMarkJoined}
            disabled={markingJoined}
            style={{
              background: '#E6A817', border: 'none', borderRadius: 10,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              color: '#fff', cursor: markingJoined ? 'default' : 'pointer',
              fontFamily: 'inherit', opacity: markingJoined ? 0.7 : 1,
            }}
          >
            {markingJoined ? 'שומר…' : 'סימנתי כמחודש ✓'}
          </button>
        </div>
      )}

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

          {/* Shabbat mode */}
          <div style={{
            background: T.bgCard, borderRadius: 16,
            boxShadow: '0 1px 6px rgba(44,44,42,0.05)',
            marginBottom: 12, overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 14, color: T.charcoal, fontWeight: 500 }}>מצב שבת</p>
                <p style={{ fontSize: 12, color: T.charcoalLight, marginTop: 2 }}>
                  {`ללא הודעות מיום שישי 17:00 עד מוצ"ש 21:00`}
                </p>
              </div>
              <Toggle value={shabbatMode} onChange={setShabbatMode} />
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

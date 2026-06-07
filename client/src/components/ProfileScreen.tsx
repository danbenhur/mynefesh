import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { C } from '../lib/dashboardTheme'
import { umbrellaColor } from '../lib/theme'
import Ring from './Ring'
import Icon from './Icon'
import { getSettings, updateSettings } from '../lib/api'
import type { NavigateFn } from '../types/nav'
import './dashboard/dashboard.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

interface AuthUser {
  id: string
  username: string
  displayName: string
  avatar?: string
}

interface Props {
  user?: AuthUser
  navigate: NavigateFn
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="mn-profile-toggle"
      style={{ background: value ? C.bar : 'rgba(44,44,42,0.18)' }}
    >
      <span
        className="mn-profile-toggle-thumb"
        style={{ left: value ? 21 : 3 }}
      />
    </button>
  )
}

// TODO: wire when multi-tenant + per-user settings are in
// function Chips<V extends string>({
//   options, value, onChange,
// }: {
//   options: Array<{ value: V; label: string }>
//   value: V
//   onChange: (v: V) => void
// }) {
//   return (
//     <div style={{ display: 'flex', gap: 6 }}>
//       {options.map(opt => (
//         <button
//           key={opt.value}
//           onClick={() => onChange(opt.value)}
//           style={{
//             padding: '4px 10px', borderRadius: 8, border: 'none',
//             cursor: 'pointer', fontFamily: 'inherit',
//             background: value === opt.value ? C.bar : C.faint,
//             color: value === opt.value ? '#fff' : C.muted,
//             fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
//           }}
//         >
//           {opt.label}
//         </button>
//       ))}
//     </div>
//   )
// }

function Row({
  label, detail, right, last, onClick,
}: {
  label: string
  detail?: string
  right?: React.ReactNode
  last?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`mn-profile-row${last ? ' last' : ''}${onClick ? ' clickable' : ''}`}
    >
      <div className="mn-profile-row-label-col">
        <p className="mn-profile-row-label">{label}</p>
        {detail && <p className="mn-profile-row-detail">{detail}</p>}
      </div>
      {right && <div className="mn-profile-row-right">{right}</div>}
    </div>
  )
}

export default function ProfileScreen({ user, navigate }: Props) {
  const umbrellas = useStore(s => s.umbrellas)

  const [shabbatMode, setShabbatMode] = useState(true)

  // TODO: wire when multi-tenant + per-user settings are in
  // const [morningBrief, setMorningBrief] = useState(true)
  // const [aiNudges, setAiNudges] = useState(true)
  // const [personality, setPersonality] = useState<'warm' | 'direct' | 'spiritual'>('warm')
  // const [language, setLanguage] = useState<'en' | 'he'>('en')

  useEffect(() => {
    getSettings().then(s => {
      setShabbatMode(s.shabbatMode)
    }).catch(() => {})
  }, [])

  async function handleShabbatToggle(v: boolean) {
    setShabbatMode(v)
    try {
      await updateSettings({ shabbatMode: v })
    } catch {
      setShabbatMode(!v)
    }
  }

  async function handleLogout() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
    window.location.reload()
  }

  const displayName = user?.displayName ?? 'Dan'

  return (
    <div dir="rtl" className="mn-profile-screen">
      {/* Header — avatar + name */}
      <div className="mn-profile-header">
        {user?.avatar ? (
          <img src={user.avatar} alt={displayName} className="mn-profile-avatar" />
        ) : (
          <div className="mn-profile-avatar-fallback">👨‍👩‍👧‍👦</div>
        )}
        <p className="mn-profile-name">{displayName}</p>
        <div className="mn-profile-badge-row">
          <span className="mn-profile-badge-dot" />
          <span className="mn-profile-badge-label">myNefesh Pro</span>
        </div>
      </div>

      {/* Umbrella health rings */}
      {umbrellas.length > 0 && (
        <div className="mn-profile-rings-strip">
          {umbrellas.map(u => {
            const color = umbrellaColor(u.name)
            const ringColor = u.computedHealthScore !== null ? color : C.muted
            return (
              <div key={u.id} className="mn-profile-ring-item">
                <div className="mn-profile-ring-wrap">
                  <Ring score={u.computedHealthScore ?? 0} size={36} stroke={3} color={ringColor} animate={false} />
                  <div className="mn-profile-ring-score" style={{ color: ringColor }}>
                    {u.computedHealthScore ?? '—'}
                  </div>
                </div>
                <span className="mn-profile-ring-name">{u.name}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="mn-profile-body">
        {/* Notifications */}
        <p className="mn-profile-eyebrow">התראות</p>
        <div className="mn-profile-card">
          {/* TODO: wire when multi-tenant + per-user settings are in */}
          {/* <Row
            label="תקציר בוקר"
            detail="כל יום בשעה 7:30"
            right={<Toggle value={morningBrief} onChange={setMorningBrief} />}
          /> */}
          {/* <Row
            label="הצעות AI"
            detail="הצעות יזומות"
            right={<Toggle value={aiNudges} onChange={setAiNudges} />}
          /> */}
          <Row
            label="מצב שבת"
            detail="שקט מהדלקת נרות שישי"
            right={<Toggle value={shabbatMode} onChange={handleShabbatToggle} />}
          />
          <Row
            label="צ'ק-אין WhatsApp"
            detail="הגדרות שליחה יומית"
            right={<span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}><Icon name="chevron" size={18} color={C.muted} /></span>}
            last
            onClick={() => navigate('settings')}
          />
        </div>

        {/* TODO: wire when multi-tenant + per-user settings are in */}
        {/* Nefesh AI — personality + language chips */}
        {/* <p className="mn-profile-eyebrow">Nefesh AI</p>
        <div className="mn-profile-card">
          <Row
            label="אישיות"
            detail="איך Nefesh מתקשר"
            right={
              <Chips
                options={[
                  { value: 'warm' as const, label: 'חם' },
                  { value: 'direct' as const, label: 'ישיר' },
                  { value: 'spiritual' as const, label: 'רוחני' },
                ]}
                value={personality}
                onChange={setPersonality}
              />
            }
          />
          <Row
            label="שפה"
            detail="שפת הממשק ו-AI"
            right={
              <Chips
                options={[
                  { value: 'en' as const, label: 'EN' },
                  { value: 'he' as const, label: 'עב' },
                ]}
                value={language}
                onChange={setLanguage}
              />
            }
            last
          />
        </div> */}

        {/* Privacy & Data */}
        <p className="mn-profile-eyebrow">פרטיות ונתונים</p>
        <div className="mn-profile-card">
          <Row
            label="הנתונים שלי"
            detail="מאוחסן מקומית + מוצפן"
            right={<Icon name="lock" size={18} color={C.muted} />}
          />
          <Row
            label="מטריות"
            detail={`${umbrellas.length} ${umbrellas.length === 1 ? 'תחום מוגדר' : 'תחומים מוגדרים'}`}
            right={<span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}><Icon name="chevron" size={18} color={C.muted} /></span>}
            last
          />
        </div>

        {/* Account */}
        <p className="mn-profile-eyebrow">חשבון</p>
        <div className="mn-profile-card">
          <button onClick={handleLogout} className="mn-profile-logout-btn">
            <span className="mn-profile-logout-label">התנתק</span>
            <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
              <Icon name="chevron" size={18} color={C.low} />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

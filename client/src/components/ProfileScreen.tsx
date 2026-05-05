import { useState } from 'react'
import { useStore } from '../store/useStore'
import { T, umbrellaColor } from '../lib/theme'
import Ring from './Ring'
import Icon from './Icon'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

interface AuthUser {
  id: string
  username: string
  displayName: string
  avatar?: string
}

interface Props {
  user?: AuthUser
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13, padding: 0,
        background: value ? T.sage : '#D8D5CF',
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

function Chips<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '4px 10px', borderRadius: 8, border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
            background: value === opt.value ? T.sage : T.sageLight,
            color: value === opt.value ? '#fff' : T.charcoalMid,
            fontSize: 12, fontWeight: 500,
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, color: T.charcoalLight,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      paddingLeft: 4, marginBottom: 6, marginTop: 24,
    }}>
      {title}
    </p>
  )
}

function Row({
  label, detail, right, last,
}: {
  label: string
  detail?: string
  right?: React.ReactNode
  last?: boolean
}) {
  return (
    <div style={{
      padding: '14px 16px', minHeight: 52,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: last ? 'none' : '1px solid rgba(44,44,42,0.06)',
    }}>
      <div>
        <p style={{ fontSize: 14, color: T.charcoal, fontWeight: 500 }}>{label}</p>
        {detail && <p style={{ fontSize: 12, color: T.charcoalLight, marginTop: 2 }}>{detail}</p>}
      </div>
      {right && <div style={{ flexShrink: 0, marginLeft: 12 }}>{right}</div>}
    </div>
  )
}

export default function ProfileScreen({ user }: Props) {
  const umbrellas = useStore(s => s.umbrellas)

  const [notifications, setNotifications] = useState({
    morningBrief: true,
    aiNudges: true,
    shabbatMode: false,
  })
  const [personality, setPersonality] = useState<'warm' | 'direct' | 'spiritual'>('warm')
  const [language, setLanguage] = useState<'en' | 'he'>('en')

  async function handleLogout() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
    window.location.reload()
  }

  const displayName = user?.displayName ?? 'Dan'

  return (
    <div style={{ minHeight: '100%', background: T.bg, paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 24px', textAlign: 'center' }}>
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt={displayName}
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 12, display: 'block', margin: '0 auto 12px' }}
          />
        ) : (
          <div style={{
            width: 72, height: 72, borderRadius: 24, margin: '0 auto 12px',
            background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>
            👨‍👩‍👧‍👦
          </div>
        )}
        <p style={{ fontSize: 20, fontWeight: 700, color: T.charcoal, marginBottom: 4 }}>{displayName}</p>
        <p style={{ fontSize: 13, color: T.charcoalLight, marginBottom: 8 }}>
          Kfar Chabad, Israel · Father of 11
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.sage }} />
          <span style={{ fontSize: 13, color: T.charcoalMid }}>myNefesh Pro</span>
          <span style={{ fontSize: 13, color: T.charcoalLight }}>•</span>
          <span style={{ fontSize: 13, color: T.charcoalLight }}>Member since 2024</span>
        </div>
      </div>

      {/* Umbrella health rings */}
      {umbrellas.length > 0 && (
        <div style={{
          background: T.bgCard, marginBottom: 8, padding: '16px 20px',
          display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap',
        }}>
          {umbrellas.map(u => {
            const color = umbrellaColor(u.name)
            return (
              <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ position: 'relative', width: 36, height: 36 }}>
                  <Ring score={u.healthScore} size={36} stroke={3} color={color} animate={false} />
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color }}>{u.healthScore}</span>
                  </div>
                </div>
                <span style={{
                  fontSize: 9, color: T.charcoalLight,
                  maxWidth: 44, textAlign: 'center',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {u.name}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '0 20px' }}>
        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <div style={{ background: T.bgCard, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(44,44,42,0.05)' }}>
          <Row
            label="Morning brief"
            detail="Daily at 7:30 AM"
            right={<Toggle value={notifications.morningBrief} onChange={v => setNotifications(n => ({ ...n, morningBrief: v }))} />}
          />
          <Row
            label="AI Nudges"
            detail="Proactive suggestions"
            right={<Toggle value={notifications.aiNudges} onChange={v => setNotifications(n => ({ ...n, aiNudges: v }))} />}
          />
          <Row
            label="Shabbat mode"
            detail="Quiet from Friday sundown"
            right={<Toggle value={notifications.shabbatMode} onChange={v => setNotifications(n => ({ ...n, shabbatMode: v }))} />}
            last
          />
        </div>

        {/* Nefesh AI */}
        <SectionHeader title="Nefesh AI" />
        <div style={{ background: T.bgCard, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(44,44,42,0.05)' }}>
          <Row
            label="Personality"
            detail="How Nefesh communicates"
            right={
              <Chips
                options={[
                  { value: 'warm' as const, label: 'Warm' },
                  { value: 'direct' as const, label: 'Direct' },
                  { value: 'spiritual' as const, label: 'Spiritual' },
                ]}
                value={personality}
                onChange={setPersonality}
              />
            }
          />
          <Row
            label="Language"
            detail="Interface & AI language"
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
        </div>

        {/* Privacy & Data */}
        <SectionHeader title="Privacy & Data" />
        <div style={{ background: T.bgCard, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(44,44,42,0.05)' }}>
          <Row
            label="My data"
            detail="All stored locally + encrypted"
            right={<Icon name="lock" size={18} color={T.charcoalLight} />}
          />
          <Row
            label="Umbrellas"
            detail={`${umbrellas.length} area${umbrellas.length === 1 ? '' : 's'} configured`}
            right={<Icon name="chevron" size={18} color={T.charcoalLight} />}
            last
          />
        </div>

        {/* Account */}
        <SectionHeader title="Account" />
        <div style={{ background: T.bgCard, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(44,44,42,0.05)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '14px 16px', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 14, color: T.red, fontWeight: 500 }}>Log out</span>
            <Icon name="chevron" size={18} color={T.red} />
          </button>
        </div>
      </div>
    </div>
  )
}

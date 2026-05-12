import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { T, umbrellaColor } from '../lib/theme'
import Ring from './Ring'
import Sparkline from './Sparkline'
import Icon from './Icon'
import { getSandboxStatus, markSandboxJoined } from '../lib/api'
import type { NavigateFn } from '../types/nav'
import type { Umbrella } from '../types/umbrella'

const NUDGES = [
  {
    bg: T.amberLight,
    accent: T.amber,
    emoji: '🎂',
    title: "Sarah's birthday",
    body: 'Coming up in 3 weeks. Time to plan something special.',
  },
  {
    bg: T.blueLight,
    accent: T.blue,
    emoji: '💰',
    title: 'Financial review overdue',
    body: "You haven't reviewed your expenses this month.",
  },
  {
    bg: T.sageLight,
    accent: T.sage,
    emoji: '✨',
    title: 'Shabbat prep',
    body: 'Friday starts at 7:22pm. A few things to prepare.',
  },
]

const ICON_PICKS = ['🏠', '👨‍👩‍👧‍👦', '💰', '🧒', '✨', '💪', '📚', '🎵', '🌍', '❤️', '🕍', '💼']

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function dateString() {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const now = new Date()
  return `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`
}

function sparklineData(u: Umbrella): number[] {
  const sorted = [...u.history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(h => h.score)
  return sorted.length >= 2 ? sorted : [u.healthScore]
}

interface CreateFormProps {
  newName: string
  setNewName: (v: string) => void
  newIcon: string
  setNewIcon: (v: string) => void
  creating: boolean
  onCreate: () => void
  onCancel: () => void
}

function CreateForm({ newName, setNewName, newIcon, setNewIcon, creating, onCreate, onCancel }: CreateFormProps) {
  return (
    <div style={{ background: T.bgCard, borderRadius: 16, padding: 16, boxShadow: '0 1px 8px rgba(44,44,42,0.06)' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: T.charcoal, marginBottom: 12 }}>New umbrella</p>
      <input
        value={newName}
        onChange={e => setNewName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onCreate()}
        placeholder="Name (e.g. Health)"
        autoFocus
        style={{
          width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`,
          borderRadius: 10, padding: '8px 12px', fontSize: 13, color: T.charcoal,
          outline: 'none', marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {ICON_PICKS.map(icon => (
          <button
            key={icon}
            onClick={() => setNewIcon(icon)}
            style={{
              width: 36, height: 36, fontSize: 18, borderRadius: 10, border: 'none',
              cursor: 'pointer', fontFamily: 'inherit',
              background: newIcon === icon ? T.sage : T.sageLight,
              outline: newIcon === icon ? `2px solid ${T.sage}` : 'none',
            }}
          >
            {icon}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCreate}
          disabled={!newName.trim() || creating}
          style={{
            flex: 1, background: T.sage, color: '#fff', borderRadius: 10, border: 'none',
            padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', opacity: !newName.trim() || creating ? 0.5 : 1,
          }}
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 10, border: 'none',
            padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

interface Props {
  navigate: NavigateFn
}

export default function HomeScreen({ navigate }: Props) {
  const { umbrellas, loading, addUmbrella } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🏠')
  const [creating, setCreating] = useState(false)
  const [sandboxExpired, setSandboxExpired] = useState(false)
  const [markingJoined, setMarkingJoined] = useState(false)

  useEffect(() => {
    getSandboxStatus()
      .then(s => { if (s.sandboxStatus === 'expired') setSandboxExpired(true) })
      .catch(() => { /* silent — banner is optional */ })
  }, [])

  async function handleMarkJoined() {
    setMarkingJoined(true)
    try {
      await markSandboxJoined()
      setSandboxExpired(false)
    } catch {
      // silent
    } finally {
      setMarkingJoined(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    await addUmbrella(newName.trim(), newIcon)
    setNewName('')
    setNewIcon('🏠')
    setShowCreate(false)
    setCreating(false)
  }

  const overallScore = umbrellas.length
    ? Math.round(umbrellas.reduce((s, u) => s + u.healthScore, 0) / umbrellas.length)
    : 0

  const lowCount = umbrellas.filter(u => u.healthScore < 60).length
  const supportingLine = umbrellas.length === 0
    ? 'Add umbrellas to see your wellness score.'
    : lowCount > 0
      ? `${lowCount} area${lowCount === 1 ? '' : 's'} need attention this week.`
      : 'All areas looking good this week.'

  return (
    <div style={{ minHeight: '100%', background: T.bg, paddingBottom: 24 }}>
      {/* Greeting header */}
      <div style={{ padding: '64px 20px 0' }}>
        <p style={{ fontSize: 13, color: T.charcoalLight, marginBottom: 2 }}>{greeting()}, Dan 👋</p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.charcoal, lineHeight: 1.2, marginBottom: 4 }}>
          How's your world today?
        </h1>
        <p style={{ fontSize: 13, color: T.charcoalLight, marginBottom: 24 }}>{dateString()}</p>
      </div>

      {/* Sandbox expiry banner */}
      {sandboxExpired && (
        <div style={{ padding: '0 20px', marginBottom: 12 }}>
          <div style={{
            background: '#FFF3CD', borderRadius: 14, padding: '14px 16px',
            border: '1px solid #FFE08A',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#7A5C00', marginBottom: 4 }}>
                WhatsApp sandbox expired
              </p>
              <p style={{ fontSize: 12, color: '#7A5C00', lineHeight: 1.5, marginBottom: 8 }}>
                Check-ins won't send until you re-join the Twilio sandbox. Go to Settings to renew.
              </p>
              <button
                onClick={handleMarkJoined}
                disabled={markingJoined}
                style={{
                  background: '#E6A817', border: 'none', borderRadius: 8,
                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  color: '#fff', cursor: markingJoined ? 'default' : 'pointer',
                  fontFamily: 'inherit', opacity: markingJoined ? 0.7 : 1,
                }}
              >
                {markingJoined ? 'Saving…' : "I've re-joined ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wellness Score card */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{
          background: T.bgCard, borderRadius: 20, padding: 20,
          boxShadow: '0 2px 12px rgba(44,44,42,0.06)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
            <Ring score={overallScore} size={100} stroke={8} color={T.sage} animate />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: T.charcoal, lineHeight: 1 }}>
                {umbrellas.length ? overallScore : '—'}
              </span>
              <span style={{ fontSize: 10, color: T.charcoalLight }}>/100</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: T.charcoal, marginBottom: 4 }}>Life Wellness Score</p>
            <p style={{ fontSize: 12, color: T.charcoalMid, lineHeight: 1.5, marginBottom: 10 }}>{supportingLine}</p>
            {umbrellas.length > 0 && overallScore >= 50 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: T.sageLight, color: T.sage,
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.sage }} />
                Good momentum
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI Nudges */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Icon name="sparkle" size={16} color={T.amber} />
          <span style={{ fontSize: 15, fontWeight: 600, color: T.charcoal }}>Nefesh suggests</span>
          <span style={{ fontSize: 12, color: T.charcoalLight, marginLeft: 2 }}>3 nudges</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {NUDGES.map((nudge, i) => (
            <button
              key={nudge.title}
              onClick={() => navigate('chat')}
              style={{
                background: nudge.bg, borderRadius: 16, padding: '14px 16px',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'flex-start', gap: 12, fontFamily: 'inherit',
                animation: `nudge-float 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms both`,
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{nudge.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: T.charcoal, marginBottom: 2 }}>{nudge.title}</p>
                <p style={{ fontSize: 12, color: T.charcoalMid, lineHeight: 1.5 }}>{nudge.body}</p>
              </div>
              <Icon name="chevron" size={16} color={nudge.accent} />
            </button>
          ))}
        </div>
      </div>

      {/* Life Umbrellas */}
      <div style={{ padding: '0 20px' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: T.charcoal, marginBottom: 12 }}>Life Umbrellas</p>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{
              width: 28, height: 28, border: `2px solid ${T.sage}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {!loading && umbrellas.length === 0 && (
          <div>
            <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>🌿</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: T.charcoal, marginBottom: 4 }}>No umbrellas yet</p>
              <p style={{ fontSize: 13, color: T.charcoalLight, marginBottom: 16 }}>
                Create your first life area to get started
              </p>
              {!showCreate && (
                <button
                  onClick={() => setShowCreate(true)}
                  style={{
                    background: T.sage, color: '#fff', padding: '10px 20px',
                    borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  + Create umbrella
                </button>
              )}
            </div>
            {showCreate && (
              <CreateForm
                newName={newName} setNewName={setNewName}
                newIcon={newIcon} setNewIcon={setNewIcon}
                creating={creating} onCreate={handleCreate}
                onCancel={() => { setShowCreate(false); setNewName(''); setNewIcon('🏠') }}
              />
            )}
          </div>
        )}

        {!loading && umbrellas.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
              {umbrellas.map((u, i) => {
                const color = umbrellaColor(u.name)
                const data = sparklineData(u)
                const isLastOdd = umbrellas.length % 2 === 1 && i === umbrellas.length - 1
                return (
                  <button
                    key={u.id}
                    onClick={() => navigate('umbrella', { umbrellaId: u.id })}
                    style={{
                      gridColumn: isLastOdd ? '1 / -1' : undefined,
                      background: T.bgCard, borderRadius: 16, padding: 14,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      boxShadow: '0 1px 8px rgba(44,44,42,0.05)', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: color + '22',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>
                        {u.icon}
                      </div>
                      <Sparkline data={data} color={color} width={50} height={20} />
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.charcoal, marginBottom: 2 }}>{u.name}</p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color }}>{u.healthScore}</span>
                      <span style={{ fontSize: 11, color: T.charcoalLight }}>/100</span>
                    </div>
                  </button>
                )
              })}
            </div>

            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  width: '100%', background: 'transparent',
                  border: `1.5px dashed ${T.sageMid}`, borderRadius: 16,
                  padding: '12px 16px', color: T.charcoalLight, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Icon name="plus" size={14} color={T.charcoalLight} />
                Add umbrella
              </button>
            ) : (
              <CreateForm
                newName={newName} setNewName={setNewName}
                newIcon={newIcon} setNewIcon={setNewIcon}
                creating={creating} onCreate={handleCreate}
                onCancel={() => { setShowCreate(false); setNewName(''); setNewIcon('🏠') }}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

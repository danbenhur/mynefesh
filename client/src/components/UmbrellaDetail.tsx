import { T, umbrellaColor } from '../lib/theme'
import Ring from './Ring'
import Sparkline from './Sparkline'
import Icon from './Icon'
import type { Umbrella } from '../types/umbrella'
import type { NavigateFn } from '../types/nav'

const PRIORITY_COLOR: Record<string, string> = {
  high: T.red,
  medium: T.amber,
  low: T.blue,
}

function relativeDate(dateStr: string): string {
  const diffDays = Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.round(diffDays / 7)}w ago`
  return `${Math.round(diffDays / 30)}mo ago`
}

function lastActivity(u: Umbrella): string {
  if (!u.history.length) return '—'
  const sorted = [...u.history].sort((a, b) => b.date.localeCompare(a.date))
  return relativeDate(sorted[0].date)
}

function childSparkData(u: Umbrella): number[] {
  const sorted = [...u.history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(h => h.score)
  return sorted.length >= 2 ? sorted : [u.healthScore]
}

interface Props {
  umbrella: Umbrella
  navigate: NavigateFn
  goBack: () => void
}

export default function UmbrellaDetail({ umbrella, navigate, goBack }: Props) {
  const color = umbrellaColor(umbrella.name)

  const trendData = [...umbrella.history]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(h => h.score)

  return (
    <div style={{ minHeight: '100%', background: T.bg, paddingBottom: 100 }}>
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
          <Icon name="back" size={16} color={T.charcoalLight} />
          Back
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
                Health score: <span style={{ color, fontWeight: 700 }}>{umbrella.healthScore}</span>/100
              </p>
            </div>
          </div>
          <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
            <Ring score={umbrella.healthScore} size={56} stroke={5} color={color} animate={false} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{umbrella.healthScore}</span>
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
          <p style={{ fontSize: 12, color: T.charcoalLight, marginBottom: 10 }}>6-week trend</p>
          {trendData.length >= 2
            ? <Sparkline data={trendData} color={color} width={240} height={36} />
            : <p style={{ fontSize: 12, color: T.charcoalLight, fontStyle: 'italic' }}>
                No trend data yet. Check-in regularly to build your history.
              </p>
          }
        </div>

        {/* Sub-areas */}
        {umbrella.children.length > 0 && (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: T.charcoal, marginBottom: 10 }}>Sub-areas</p>
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
                        <p style={{ fontSize: 11, color: T.charcoalLight }}>Last: {lastActivity(child)}</p>
                      </div>
                      <Sparkline data={sparkData} color={childColor} width={50} height={20} />
                      <span style={{ fontSize: 18, fontWeight: 700, color: childColor, flexShrink: 0 }}>
                        {child.healthScore}
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
                          Ask Nefesh →
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {umbrella.children.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: T.charcoalLight, fontSize: 13 }}>
            No sub-areas yet.
          </div>
        )}
      </div>

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

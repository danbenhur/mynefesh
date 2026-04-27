import type { HealthSnapshot } from '../types/umbrella'

interface Props {
  history: HealthSnapshot[]
  width?: number
  height?: number
}

export default function Sparkline({ history, width = 120, height = 36 }: Props) {
  if (history.length < 2) return null

  const scores = history.map(h => h.score)
  const min = Math.max(0, Math.min(...scores) - 10)
  const max = Math.min(100, Math.max(...scores) + 10)
  const range = max - min || 1

  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * width
    const y = height - ((s - min) / range) * height
    return `${x},${y}`
  })

  const last = scores[scores.length - 1]
  const color = last >= 75 ? '#22c55e' : last >= 50 ? '#f59e0b' : '#ef4444'
  const lastX = width
  const lastY = height - ((last - min) / range) * height

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  )
}

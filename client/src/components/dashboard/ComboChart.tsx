import { useRef, useState, useLayoutEffect } from 'react'
import type { TimeseriesResponse } from '../../lib/api'
import type { DashColors } from '../../lib/dashboardTheme'

export type ChartMode = 'combo' | 'stacked' | 'question' | 'goal' | 'movingavg'

interface Props {
  gran: TimeseriesResponse
  mode?: ChartMode
  colors: DashColors
  height?: number
}

function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function movingAvg(scores: number[], window = 5): number[] {
  return scores.map((_, i) => {
    const slice = scores.slice(Math.max(0, i - window + 1), i + 1)
    return Math.round(slice.reduce((s, v) => s + v, 0) / slice.length)
  })
}

export default function ComboChart({ gran, mode = 'combo', colors, height = 130 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { points, projection } = gran
  const n = points.length
  const padL = 4
  const padR = 4
  const padT = 8
  const padB = 20

  const chartW = width - padL - padR
  const chartH = height - padT - padB

  function xOf(i: number) {
    return padL + (i / Math.max(n - 1, 1)) * chartW
  }
  function yOf(v: number) {
    return padT + (1 - v / 100) * chartH
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!width) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left - padL
    const idx = Math.round((mx / chartW) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }

  function handleTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    if (!width || !e.touches[0]) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.touches[0].clientX - rect.left - padL
    const idx = Math.round((mx / chartW) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }

  const barW = n > 1 ? Math.max(2, (chartW / n) * 0.6) : 12

  const scores = points.map(p => p.score)
  const avgScores = mode === 'movingavg' ? movingAvg(scores) : scores

  const linePts = avgScores.map((s, i) => ({ x: xOf(i), y: yOf(s) }))
  const linePath = catmullRomPath(linePts)

  const gridLines = [25, 50, 75]

  const hi = hoverIdx ?? -1
  const tipPoint = hi >= 0 ? points[hi] : null
  const tipX = hi >= 0 ? xOf(hi) : 0
  const tipY = hi >= 0 ? yOf(points[hi].score) : 0

  return (
    <div ref={containerRef} className="mn-chart-wrap">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setHoverIdx(null)}
          style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
        >
          {/* Grid lines */}
          {gridLines.map(g => (
            <line
              key={g}
              x1={padL} y1={yOf(g)} x2={padL + chartW} y2={yOf(g)}
              stroke={colors.grid}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ))}

          {/* Bars */}
          {mode !== 'movingavg' && points.map((pt, i) => {
            const cx = xOf(i)
            const isProjected = i >= projection
            const alpha = isProjected ? 0.28 : 0.55

            if (mode === 'stacked' && pt.segments && pt.segments.length > 0) {
              let cumY = padT + chartH
              const n_segs = pt.segments.length
              return (
                <g key={i}>
                  {pt.segments.map((seg, si) => {
                    const barH = Math.max(1, (seg.value / 100) * chartH / n_segs)
                    const rectY = cumY - barH
                    cumY = rectY
                    return (
                      <rect
                        key={si}
                        x={cx - barW / 2}
                        y={rectY}
                        width={barW}
                        height={barH}
                        fill={seg.color}
                        opacity={isProjected ? 0.3 : 0.7}
                        rx={1}
                      />
                    )
                  })}
                </g>
              )
            }

            // combo / question / goal / movingavg: single bar = score
            const barH = Math.max(2, (pt.score / 100) * chartH)
            const barY = yOf(pt.score)
            return (
              <rect
                key={i}
                x={cx - barW / 2}
                y={barY}
                width={barW}
                height={barH}
                fill={colors.bar}
                opacity={alpha}
                rx={2}
              />
            )
          })}

          {/* Score line */}
          {linePath && (
            <>
              <path
                d={linePath}
                fill="none"
                stroke={colors.line}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {n <= 12 && linePts.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={colors.line} opacity={0.7} />
              ))}
            </>
          )}

          {/* Hover crosshair + tooltip */}
          {hi >= 0 && tipPoint && (
            <>
              <line
                x1={tipX} y1={padT} x2={tipX} y2={padT + chartH}
                stroke={colors.muted}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <circle cx={tipX} cy={tipY} r={4} fill={colors.line} />
              {(() => {
                const boxW = 90
                const boxH = 52
                let bx = tipX + 8
                if (bx + boxW > width - 4) bx = tipX - boxW - 8
                const by = Math.max(padT, tipY - boxH / 2)
                return (
                  <g>
                    <rect
                      x={bx} y={by} width={boxW} height={boxH}
                      rx={7} fill={colors.tipBg}
                      style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }}
                    />
                    <text x={bx + 8} y={by + 16} fontSize={10} fill={colors.muted} fontFamily="inherit">
                      {tipPoint.label}
                    </text>
                    <text x={bx + 8} y={by + 33} fontSize={15} fontWeight="700" fill={colors.ink} fontFamily="inherit">
                      {tipPoint.score}
                    </text>
                    <text x={bx + 34} y={by + 33} fontSize={10} fill={colors.muted} fontFamily="inherit">
                      /100
                    </text>
                  </g>
                )
              })()}
            </>
          )}

          {/* X-axis labels (sparse) */}
          {(() => {
            const step = n <= 12 ? 1 : n <= 30 ? 5 : 3
            return points
              .filter((_, i) => i % step === 0 || i === n - 1)
              .map((pt, _, arr) => {
                const origIdx = points.indexOf(pt)
                if (origIdx < 0) return null
                const x = xOf(origIdx)
                const prevX = arr[arr.indexOf(pt) - 1]
                  ? xOf(points.indexOf(arr[arr.indexOf(pt) - 1]))
                  : -999
                if (x - prevX < 28) return null
                return (
                  <text
                    key={origIdx}
                    x={x}
                    y={height - 4}
                    fontSize={9}
                    textAnchor="middle"
                    fill={colors.muted}
                    fontFamily="inherit"
                  >
                    {pt.label.split(' ')[0]}
                  </text>
                )
              })
          })()}
        </svg>
      )}
    </div>
  )
}

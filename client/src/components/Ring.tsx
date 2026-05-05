import { useState, useEffect } from 'react'
import { T } from '../lib/theme'

interface Props {
  score: number
  size?: number
  stroke?: number
  color?: string
  animate?: boolean
}

export default function Ring({ score, size = 120, stroke = 9, color = T.sage, animate = true }: Props) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const target = circumference * (1 - score / 100)
  const center = size / 2

  const [offset, setOffset] = useState(() => (animate ? circumference : target))

  useEffect(() => {
    if (!animate) {
      setOffset(target)
      return
    }
    const id = setTimeout(() => setOffset(target), 50)
    return () => clearTimeout(id)
  }, [score, animate, target])

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', display: 'block' }}
    >
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={T.sageLight}
        strokeWidth={stroke}
      />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={animate ? { transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' } : undefined}
      />
    </svg>
  )
}

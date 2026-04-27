interface Props {
  score: number
  size?: number
}

export default function HealthRing({ score, size = 56 }: Props) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 75 ? '#22c55e' :
    score >= 50 ? '#f59e0b' :
    '#ef4444'

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        className="text-white/10"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className="rotate-90 origin-center"
        style={{
          transform: 'rotate(90deg)',
          transformOrigin: '50% 50%',
          fontSize: size < 48 ? 10 : 13,
          fontWeight: 700,
          fill: color,
          fontFamily: 'inherit',
        }}
      >
        {score}
      </text>
    </svg>
  )
}

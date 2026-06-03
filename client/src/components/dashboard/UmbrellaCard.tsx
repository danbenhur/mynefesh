import type { MockUmbrella } from './MockData'
import type { DashColors } from '../../lib/dashboardTheme'
import DashIcon from './Icons'
import type { DashIconName } from './Icons'
import DashSparkline from './Sparkline'

interface Props {
  umbrella: MockUmbrella
  colors: DashColors
  onClick?: () => void
}

export default function DashUmbrellaCard({ umbrella, colors, onClick }: Props) {
  const { he, color, iconKey, score, delta, spark } = umbrella

  const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const deltaLabel = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '→0'

  const isValidIcon = (k: string): k is DashIconName =>
    ['people','money','kids','spirit','health','home','umbrella','chat','checkin','profile',
     'sun','moon','bell','spark','send','close','arrow','logo'].includes(k)

  return (
    <button className="mn-ucard" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="mn-ucard-top">
        <div className="mn-ucard-icon-wrap">
          {isValidIcon(iconKey)
            ? <DashIcon name={iconKey} size={18} color={color} strokeWidth={1.8} />
            : <span style={{ fontSize: 16 }}>{iconKey}</span>
          }
          <span className="mn-ucard-dot" style={{ background: color }} />
        </div>
        <DashSparkline data={spark} color={color} width={52} height={24} />
      </div>

      <p className="mn-ucard-name" style={{ color: colors.ink }}>{he}</p>

      <div className="mn-ucard-bottom">
        <span className="mn-ucard-score" style={{ color }}>{score ?? '—'}</span>
        <span className="mn-ucard-denom">/100</span>
        <span className={`mn-ucard-delta ${deltaClass}`}>{deltaLabel}</span>
      </div>

      <p className="mn-ucard-updated">{umbrella.updated}</p>
    </button>
  )
}

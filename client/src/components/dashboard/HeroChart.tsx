import { useState } from 'react'
import type { MockData } from './MockData'
import { UMBRELLA_DEFS } from './MockData'
import type { DashColors } from '../../lib/dashboardTheme'
import ComboChart from './ComboChart'
import type { ChartMode } from './ComboChart'

type Granularity = 'day' | 'week' | 'month' | 'year'

const TIME_TABS: { key: Granularity; label: string }[] = [
  { key: 'day',   label: 'יום'  },
  { key: 'week',  label: 'שבוע' },
  { key: 'month', label: 'חודש' },
  { key: 'year',  label: 'שנה'  },
]

const SLICE_TABS: { key: ChartMode; label: string }[] = [
  { key: 'combo',    label: 'כללי'       },
  { key: 'stacked',  label: 'לפי מטריה' },
  { key: 'question', label: 'לפי שאלה'  },
  { key: 'goal',     label: 'יעדים'      },
  { key: 'movingavg', label: 'ממוצע נע' },
]

interface Props {
  data: MockData
  colors: DashColors
}

export default function HeroChart({ data, colors }: Props) {
  const [gran, setGran] = useState<Granularity>('week')
  const [mode, setMode] = useState<ChartMode>('combo')

  const pts = data.granularity[gran].points
  const currentScore = pts[pts.length - 1].score
  const prevScore    = pts.length >= 2 ? pts[pts.length - 2].score : currentScore
  const delta        = currentScore - prevScore
  const avg          = Math.round(pts.reduce((s, p) => s + p.score, 0) / pts.length)

  const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const deltaLabel = delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : '→'

  return (
    <div className="mn-hero-card">
      <p className="mn-hero-eyebrow">מבט-על · רווחה כללית</p>

      {/* Score row */}
      <div className="mn-hero-score-row">
        <span className="mn-hero-score">{currentScore}</span>
        <span className={`mn-hero-delta ${deltaClass}`}>{deltaLabel}</span>
        <span className="mn-hero-avg">ממוצע {avg}</span>
      </div>

      {/* Time tabs */}
      <div className="mn-tabs" role="tablist" aria-label="טווח זמן">
        {TIME_TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={gran === t.key}
            className={`mn-tab${gran === t.key ? ' active' : ''}`}
            onClick={() => setGran(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Slice tabs */}
      <div className="mn-tabs slice" role="tablist" aria-label="תצוגה">
        {SLICE_TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={mode === t.key}
            className={`mn-tab${mode === t.key ? ' active' : ''}`}
            onClick={() => setMode(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ComboChart
        gran={data.granularity[gran]}
        mode={mode}
        colors={colors}
        height={130}
      />

      {/* Legend */}
      <div className="mn-legend">
        {UMBRELLA_DEFS.map(u => (
          <span key={u.key} className="mn-legend-item">
            <span className="mn-legend-dot" style={{ background: u.color }} />
            {u.he}
          </span>
        ))}
      </div>
    </div>
  )
}

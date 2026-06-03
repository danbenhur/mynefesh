import { useState, useEffect, useRef, useCallback } from 'react'
import { getTimeseries } from '../../lib/api'
import type { TimeseriesResponse, TimeseriesSlice, TimeseriesGranularity } from '../../lib/api'
import type { DashColors } from '../../lib/dashboardTheme'
import ComboChart from './ComboChart'
import type { ChartMode } from './ComboChart'

const TIME_TABS: { key: TimeseriesGranularity; label: string }[] = [
  { key: 'day',   label: 'יום'  },
  { key: 'week',  label: 'שבוע' },
  { key: 'month', label: 'חודש' },
  { key: 'year',  label: 'שנה'  },
]

const SLICE_TABS: { key: ChartMode; label: string }[] = [
  { key: 'combo',     label: 'כללי'      },
  { key: 'stacked',   label: 'לפי מטריה' },
  { key: 'question',  label: 'לפי שאלה'  },
  { key: 'goal',      label: 'יעדים'     },
  { key: 'movingavg', label: 'ממוצע נע'  },
]

interface Props {
  colors: DashColors
}

// Cache lives for the lifetime of the page — shared across mounts via module-level ref
const _cache = new Map<string, TimeseriesResponse>()

export default function HeroChart({ colors }: Props) {
  const [gran, setGran] = useState<TimeseriesGranularity>('week')
  const [mode, setMode] = useState<ChartMode>('combo')
  const [data, setData] = useState<TimeseriesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  // Abort controller ref so in-flight requests are cancelled when tabs change fast
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (slice: ChartMode, granularity: TimeseriesGranularity) => {
    // movingavg reuses combo data — only the line smoothing differs (done client-side)
    const effectiveSlice: TimeseriesSlice = slice === 'movingavg' ? 'combo' : slice
    // question + goal ignore granularity — normalise the cache key so we don't re-fetch on gran change
    const keyGran: TimeseriesGranularity =
      effectiveSlice === 'question' || effectiveSlice === 'goal' ? 'week' : granularity
    const cacheKey = `${effectiveSlice}:${keyGran}`

    if (_cache.has(cacheKey)) {
      setData(_cache.get(cacheKey)!)
      setError(false)
      return
    }

    // Cancel the previous in-flight request
    abortRef.current?.abort()
    abortRef.current = null

    setLoading(true)
    setError(false)

    try {
      const result = await getTimeseries(effectiveSlice, keyGran)
      _cache.set(cacheKey, result)
      setData(result)
    } catch (e: unknown) {
      // Ignore AbortError — it just means the user switched tabs quickly
      if (e instanceof Error && e.name === 'AbortError') return
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(mode, gran)
  }, [mode, gran, fetchData])

  // Derive headline from the fetched data
  const pts = data?.points ?? []
  const currentScore = pts.length > 0 ? pts[pts.length - 1].score : null
  const prevScore    = pts.length >= 2 ? pts[pts.length - 2].score : currentScore
  const delta        = currentScore != null && prevScore != null ? currentScore - prevScore : null
  const avg          = pts.length > 0
    ? Math.round(pts.reduce((s, p) => s + p.score, 0) / pts.length)
    : null

  const deltaClass = delta == null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const deltaLabel = delta == null ? '→' : delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : '→'

  return (
    <div className="mn-hero-card">
      <p className="mn-hero-eyebrow">מבט-על · רווחה כללית</p>

      {/* Score row */}
      <div className="mn-hero-score-row">
        <span className="mn-hero-score">
          {currentScore != null ? currentScore : '—'}
        </span>
        {delta != null && (
          <span className={`mn-hero-delta ${deltaClass}`}>{deltaLabel}</span>
        )}
        {avg != null && (
          <span className="mn-hero-avg">ממוצע {avg}</span>
        )}
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

      {/* Chart area */}
      {error ? (
        <div className="mn-chart-wrap" style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: colors.muted }}>לא ניתן לטעון נתונים</span>
        </div>
      ) : pts.length === 0 && !loading ? (
        <div className="mn-chart-wrap" style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: colors.muted }}>אין נתונים עדיין</span>
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.4 : 1, transition: 'opacity 0.2s' }}>
          <ComboChart
            gran={data ?? { points: [], projection: 0 }}
            mode={mode}
            colors={colors}
            height={130}
          />
        </div>
      )}

      {/* Legend — only in stacked mode when umbrella data is available */}
      {mode === 'stacked' && (data?.umbrellas ?? []).length > 0 && (
        <div className="mn-legend">
          {data!.umbrellas!.map(u => (
            <span key={u.id} className="mn-legend-item">
              <span className="mn-legend-dot" style={{ background: u.color }} />
              {u.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

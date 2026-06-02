import { useState, useEffect } from 'react'
import { C } from '../lib/dashboardTheme'
import { MOCK_DATA } from './dashboard/MockData'
import HeroChart from './dashboard/HeroChart'
import DashUmbrellaCard from './dashboard/UmbrellaCard'
import { getSandboxStatus, markSandboxJoined, listArchivedUmbrellas } from '../lib/api'
import type { NavigateFn } from '../types/nav'
import './dashboard/dashboard.css'

function hebrewGreeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return 'לילה טוב, דן 🌙'
  if (h < 12) return 'בוקר טוב, דן ☀️'
  if (h < 17) return 'צהריים טובים, דן 🌤️'
  if (h < 20) return 'אחר הצהריים, דן 🌅'
  return 'ערב טוב, דן 🌙'
}

function dateString(): string {
  const DAYS   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']
  const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
  const now = new Date()
  return `יום ${DAYS[now.getDay()]}, ${now.getDate()} ב${MONTHS[now.getMonth()]}`
}

interface Props {
  navigate: NavigateFn
}

export default function HomeScreen({ navigate }: Props) {
  const [sandboxExpired, setSandboxExpired]   = useState(false)
  const [markingJoined, setMarkingJoined]     = useState(false)
  const [archivedCount, setArchivedCount]     = useState(0)

  useEffect(() => {
    getSandboxStatus()
      .then(s => { if (s.sandboxStatus === 'expired') setSandboxExpired(true) })
      .catch(() => {})
    listArchivedUmbrellas()
      .then(list => setArchivedCount(list.length))
      .catch(() => {})
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

  return (
    <div dir="rtl" lang="he" className="mn-screen">

      {/* ── Greeting ─────────────────────────────────────── */}
      <div className="mn-greeting">
        <p className="mn-greeting-time">{hebrewGreeting()}</p>
        <p className="mn-greeting-sub">{dateString()}</p>
      </div>

      {/* ── Sandbox expiry banner ─────────────────────────── */}
      {sandboxExpired && (
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <div style={{
            background: '#FFF3CD', borderRadius: 14, padding: '14px 16px',
            border: '1px solid #FFE08A', display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#7A5C00', marginBottom: 4 }}>
                Sandbox WhatsApp פג תוקפו
              </p>
              <p style={{ fontSize: 12, color: '#7A5C00', lineHeight: 1.5, marginBottom: 8 }}>
                צ׳ק-אינים לא יישלחו עד שתצטרף מחדש.
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
                {markingJoined ? 'שומר…' : 'הצטרפתי מחדש ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero chart ───────────────────────────────────── */}
      <HeroChart data={MOCK_DATA} colors={C} />

      {/* ── Gallery ──────────────────────────────────────── */}
      <section className="mn-gallery-section">
        <div className="mn-gallery-header">
          <h2>המטריות שלי</h2>
          <span className="mn-gallery-count">{MOCK_DATA.umbrellas.length}</span>
        </div>

        <div className="mn-gallery-wrap">
          <div className="mn-gallery-grid">
            {MOCK_DATA.umbrellas.map(u => (
              <DashUmbrellaCard
                key={u.key}
                umbrella={u}
                colors={C}
                onClick={undefined}
              />
            ))}
          </div>
        </div>

        {/* Archived link — real data */}
        {archivedCount > 0 && (
          <button
            onClick={() => navigate('archived')}
            style={{
              display: 'block', margin: '14px auto 0', background: 'none', border: 'none',
              color: C.muted, fontSize: 12, cursor: 'pointer',
              fontFamily: 'inherit', textDecoration: 'underline',
            }}
          >
            ארכיון ({archivedCount})
          </button>
        )}
      </section>

    </div>
  )
}

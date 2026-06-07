import { useState, useEffect } from 'react'
import { C } from '../lib/dashboardTheme'
import { umbrellaColor } from '../lib/theme'
import Icon from './Icon'
import { listArchivedUmbrellas, unarchiveUmbrella } from '../lib/api'
import { useStore } from '../store/useStore'
import type { ApiUmbrella } from '../lib/api'
import type { NavigateFn } from '../types/nav'
import './dashboard/dashboard.css'

interface Props {
  navigate: NavigateFn
  goBack: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
  return `${day} ב${months[d.getMonth()]} ${d.getFullYear()}`
}

export default function ArchivedScreen({ goBack }: Props) {
  const { loadUmbrellas } = useStore()
  const [items, setItems] = useState<ApiUmbrella[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    listArchivedUmbrellas()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleRestore(id: string) {
    setRestoringId(id)
    try {
      await unarchiveUmbrella(id)
      setItems(prev => prev.filter(u => u.id !== id))
      await loadUmbrellas()
    } catch {
      // silent
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="mn-archived-screen">
      {/* Header */}
      <div className="mn-archived-header">
        <button onClick={goBack} className="mn-archived-back-btn">
          <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}>
            <Icon name="back" size={16} color={C.muted} />
          </span>
          חזור
        </button>
        <h1 className="mn-archived-title">📦 ארכיון</h1>
        <p className="mn-archived-subtitle">מטריות מוסתרות — ניתן לשחזר בכל עת</p>
      </div>

      <div className="mn-archived-body">
        {loading && (
          <div className="mn-archived-spinner-wrap">
            <div className="mn-archived-spinner" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="mn-archived-empty">
            <p className="mn-archived-empty-icon">📭</p>
            <p className="mn-archived-empty-title">הארכיון ריק</p>
            <p className="mn-archived-empty-body">מטריות שתארכב יופיעו כאן</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="mn-archived-list">
            {items.map(u => {
              const color = umbrellaColor(u.name)
              return (
                <div key={u.id} className="mn-archived-item">
                  <div
                    className="mn-archived-icon-wrap"
                    style={{ background: `${color}22` }}
                  >
                    {u.icon}
                  </div>
                  <div className="mn-archived-text">
                    <p className="mn-archived-name">{u.name}</p>
                    <p className="mn-archived-date">
                      אורכב ב-{u.archivedAt ? formatDate(u.archivedAt) : '—'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(u.id)}
                    disabled={restoringId === u.id}
                    className="mn-archived-restore-btn"
                    style={{ opacity: restoringId === u.id ? 0.5 : 1 }}
                  >
                    {restoringId === u.id ? '…' : 'שחזר'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

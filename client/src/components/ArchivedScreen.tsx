import { useState, useEffect } from 'react'
import { T, umbrellaColor } from '../lib/theme'
import Icon from './Icon'
import { listArchivedUmbrellas, unarchiveUmbrella } from '../lib/api'
import { useStore } from '../store/useStore'
import type { ApiUmbrella } from '../lib/api'
import type { NavigateFn } from '../types/nav'

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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.charcoal }}>📦 ארכיון</h1>
        <p style={{ fontSize: 13, color: T.charcoalLight, marginTop: 4 }}>מטריות מוסתרות — ניתן לשחזר בכל עת</p>
      </div>

      <div style={{ padding: '20px 20px 0' }} dir="rtl">
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div style={{
              width: 24, height: 24, border: `2px solid ${T.sage}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.charcoalLight }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>📭</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: T.charcoal, marginBottom: 4 }}>הארכיון ריק</p>
            <p style={{ fontSize: 13 }}>מטריות שתארכב יופיעו כאן</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(u => {
              const color = umbrellaColor(u.name)
              return (
                <div
                  key={u.id}
                  style={{
                    background: T.bgCard, borderRadius: 16, padding: '14px 16px',
                    boxShadow: '0 1px 6px rgba(44,44,42,0.05)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: 0.85,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: color + '22',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                    {u.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.charcoal, marginBottom: 2 }}>{u.name}</p>
                    <p style={{ fontSize: 11, color: T.charcoalLight }}>
                      אורכב ב-{u.archivedAt ? formatDate(u.archivedAt) : '—'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(u.id)}
                    disabled={restoringId === u.id}
                    style={{
                      background: T.sageLight, color: T.charcoalMid, borderRadius: 10,
                      border: 'none', padding: '7px 14px', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                      opacity: restoringId === u.id ? 0.5 : 1,
                    }}
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

import { useState, useEffect } from 'react'
import { T } from '../lib/theme'
import { listInvites, addInvite, revokeInvite } from '../lib/api'
import type { ApiInvite } from '../lib/api'
import type { NavigateFn } from '../types/nav'

interface Props {
  navigate: NavigateFn
  goBack: () => void
}

export default function AdminScreen({ goBack }: Props) {
  const [invites, setInvites] = useState<ApiInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const data = await listInvites()
      setInvites(data)
    } catch {
      setError('שגיאה בטעינת הרשימה')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await addInvite(email.trim(), notes.trim() || undefined)
      setEmail('')
      setNotes('')
      await load()
    } catch {
      setError('שגיאה בהוספת הזמנה')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeInvite(id)
      await load()
    } catch {
      setError('שגיאה בביטול הזמנה')
    }
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 16px 0', marginBottom: 20,
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '0 0 32px' }}>
      <div style={headerStyle}>
        <button
          onClick={goBack}
          style={{
            background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', padding: 4, color: T.charcoal,
          }}
        >
          ←
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: T.charcoal, margin: 0 }}>
          ניהול הזמנות
        </h1>
      </div>

      {/* Add invite form */}
      <div style={{ padding: '0 16px', marginBottom: 24 }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="email"
            placeholder="כתובת מייל"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(44,44,42,0.2)',
              background: '#fff', fontSize: 14, fontFamily: 'inherit', direction: 'ltr',
            }}
          />
          <input
            type="text"
            placeholder="הערות (אופציונלי)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{
              padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(44,44,42,0.2)',
              background: '#fff', fontSize: 14, fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={submitting || !email.trim()}
            style={{
              background: T.sage, color: '#fff', border: 'none',
              borderRadius: 24, padding: '12px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {submitting ? 'שולח...' : 'הזמן משתמש'}
          </button>
        </form>
        {error && <p style={{ color: '#c0392b', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Invite list */}
      <div style={{ padding: '0 16px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: T.charcoalLight, marginBottom: 12 }}>
          רשימת מוזמנים
        </h2>
        {loading ? (
          <p style={{ color: T.charcoalLight, fontSize: 13 }}>טוען...</p>
        ) : invites.length === 0 ? (
          <p style={{ color: T.charcoalLight, fontSize: 13 }}>אין מוזמנים עדיין</p>
        ) : (
          invites.map(invite => (
            <div
              key={invite.id}
              style={{
                background: invite.revokedAt ? 'rgba(44,44,42,0.05)' : '#fff',
                borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                border: '1px solid rgba(44,44,42,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                opacity: invite.revokedAt ? 0.6 : 1,
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: T.charcoal, margin: 0 }} dir="ltr">
                  {invite.email}
                </p>
                {invite.notes && (
                  <p style={{ fontSize: 12, color: T.charcoalLight, margin: '2px 0 0' }}>
                    {invite.notes}
                  </p>
                )}
                <p style={{ fontSize: 11, color: T.charcoalLight, margin: '2px 0 0' }}>
                  {invite.revokedAt ? `בוטל ${new Date(invite.revokedAt).toLocaleDateString('he-IL')}` : `הוזמן ${new Date(invite.invitedAt).toLocaleDateString('he-IL')}`}
                </p>
              </div>
              {!invite.revokedAt && (
                <button
                  onClick={() => handleRevoke(invite.id)}
                  style={{
                    background: 'none', border: '1px solid rgba(192,57,43,0.4)',
                    borderRadius: 8, padding: '4px 10px', fontSize: 12,
                    color: '#c0392b', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  בטל
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

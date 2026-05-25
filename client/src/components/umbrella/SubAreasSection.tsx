import { useState } from 'react'
import { T, umbrellaColor } from '../../lib/theme'
import Sparkline from '../Sparkline'
import { createUmbrella } from '../../lib/api'
import { useStore } from '../../store/useStore'
import type { Umbrella } from '../../types/umbrella'
import type { NavigateFn } from '../../types/nav'
import { lastActivity, childSparkData, PRIORITY_COLOR } from './shared'

interface Props {
  umbrella: Umbrella
  navigate: NavigateFn
}

export function SubAreasSection({ umbrella, navigate }: Props) {
  const { loadUmbrellas } = useStore()
  const [showCreateChild, setShowCreateChild] = useState(false)
  const [childName, setChildName] = useState('')
  const [childIcon, setChildIcon] = useState('🏠')
  const [creatingChild, setCreatingChild] = useState(false)

  async function handleCreateChild() {
    if (!childName.trim()) return
    setCreatingChild(true)
    try {
      await createUmbrella({ name: childName.trim(), icon: childIcon, parentId: umbrella.id })
      await loadUmbrellas()
      setChildName('')
      setChildIcon('🏠')
      setShowCreateChild(false)
    } finally {
      setCreatingChild(false)
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: T.charcoal }}>תתי-מטריות</p>
        {!showCreateChild && (
          <button
            onClick={() => setShowCreateChild(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: T.sage,
              fontFamily: 'inherit', padding: '2px 6px',
            }}
          >
            + הוסף
          </button>
        )}
      </div>

      {umbrella.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {umbrella.children.map(child => {
            const childColor = umbrellaColor(child.name)
            const sparkData = childSparkData(child)
            const openTasks = child.tasks.filter(t => t.status !== 'done')
            const topTask = openTasks[0]

            return (
              <div
                key={child.id}
                onClick={() => navigate('umbrella', { umbrellaId: child.id })}
                style={{
                  background: T.bgCard, borderRadius: 16, padding: '14px 16px',
                  boxShadow: '0 1px 8px rgba(44,44,42,0.05)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: T.charcoal, marginBottom: 1 }}>
                      {child.name}
                    </p>
                    <p style={{ fontSize: 11, color: T.charcoalLight }}>פעילות: {lastActivity(child)}</p>
                  </div>
                  {sparkData.length > 0 && (
                    <Sparkline data={sparkData} color={childColor} width={50} height={20} />
                  )}
                  <span style={{
                    fontSize: 18, fontWeight: 700, flexShrink: 0,
                    color: child.computedHealthScore !== null ? childColor : T.charcoalLight,
                  }}>
                    {child.computedHealthScore ?? '—'}
                  </span>
                </div>

                {topTask && (
                  <div style={{
                    marginTop: 10, paddingTop: 10,
                    borderTop: '1px solid rgba(44,44,42,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: PRIORITY_COLOR[topTask.priority] ?? T.charcoalLight,
                      }} />
                      <span style={{ fontSize: 12, color: T.charcoalMid, flex: 1 }}>{topTask.title}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate('chat') }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 700,
                        color: PRIORITY_COLOR[topTask.priority] ?? T.sage,
                        fontFamily: 'inherit', flexShrink: 0, padding: '0 0 0 8px',
                      }}
                    >
                      שאל את Nefesh ←
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {umbrella.children.length === 0 && !showCreateChild && (
        <p style={{
          fontSize: 13, color: T.charcoalLight, textAlign: 'center',
          padding: '20px 0', fontStyle: 'italic',
        }}>
          אין תתי-מטרות עדיין
        </p>
      )}

      {showCreateChild && (
        <div dir="rtl" style={{
          background: T.bgCard, borderRadius: 16, padding: 16,
          boxShadow: '0 1px 8px rgba(44,44,42,0.06)',
          marginTop: umbrella.children.length > 0 ? 10 : 0,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: T.charcoal, marginBottom: 12 }}>
            תת-מטרייה חדשה
          </p>
          <input
            value={childName}
            onChange={e => setChildName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateChild()}
            placeholder="שם (לדוג׳ בריאות)"
            autoFocus
            style={{
              width: '100%', background: T.bg, border: `1px solid ${T.sageMid}`,
              borderRadius: 10, padding: '8px 12px', fontSize: 13, color: T.charcoal,
              outline: 'none', marginBottom: 12, fontFamily: 'inherit',
              boxSizing: 'border-box', direction: 'rtl',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['🏠', '👨‍👩‍👧‍👦', '💰', '🧒', '✨', '💪', '📚', '🎵', '🌍', '❤️', '🕍', '💼'].map(icon => (
              <button
                key={icon}
                onClick={() => setChildIcon(icon)}
                style={{
                  width: 36, height: 36, fontSize: 18, borderRadius: 10, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: childIcon === icon ? T.sage : T.sageLight,
                  outline: childIcon === icon ? `2px solid ${T.sage}` : 'none',
                }}
              >
                {icon}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCreateChild}
              disabled={!childName.trim() || creatingChild}
              style={{
                flex: 1, background: T.sage, color: '#fff', borderRadius: 10, border: 'none',
                padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', opacity: !childName.trim() || creatingChild ? 0.5 : 1,
              }}
            >
              {creatingChild ? 'יוצר…' : 'צור'}
            </button>
            <button
              onClick={() => { setShowCreateChild(false); setChildName(''); setChildIcon('🏠') }}
              style={{
                flex: 1, background: T.sageLight, color: T.charcoalMid, borderRadius: 10,
                border: 'none', padding: '9px 0', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

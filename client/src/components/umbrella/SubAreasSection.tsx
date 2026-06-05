import { useState } from 'react'
import { C } from '../../lib/dashboardTheme'
import { umbrellaColor } from '../../lib/theme'
import Sparkline from '../Sparkline'
import { createUmbrella } from '../../lib/api'
import { useStore } from '../../store/useStore'
import type { Umbrella } from '../../types/umbrella'
import type { NavigateFn } from '../../types/nav'
import { lastActivity, childSparkData } from './shared'

const PRIORITY_MAP: Record<string, string> = {
  high:   C.low,    // #CC8A6E
  medium: C.mid,    // #EF9F27
  low:    C.bar,    // #9CAF88
}

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
    <div className="mn-umbrella-section" dir="rtl">
      <div className="mn-umbrella-section-header-row">
        <span className="mn-umbrella-section-eyebrow">תתי-מטריות</span>
        {umbrella.children.length > 0 &&
          <span className="mn-gallery-count">{umbrella.children.length}</span>
        }
        {!showCreateChild && (
          <button className="mn-umbrella-add-btn" onClick={() => setShowCreateChild(true)}>
            + הוסף
          </button>
        )}
      </div>

      {umbrella.children.length > 0 && (
        <div className="mn-umbrella-subareas-list">
          {umbrella.children.map(child => {
            const childColor = umbrellaColor(child.name)
            const sparkData = childSparkData(child)
            const openTasks = child.tasks.filter(t => t.status !== 'done')
            const topTask = openTasks[0]

            return (
              <button
                key={child.id}
                className="mn-umbrella-subarea-card"
                style={{ padding: 0, border: `1px solid ${C.border}` }}
                onClick={() => navigate('umbrella', { umbrellaId: child.id })}
              >
                <div className="mn-umbrella-subarea-main">
                  <div
                    className="mn-umbrella-subarea-icon"
                    style={{ background: childColor + '14', borderColor: childColor + '28' }}
                  >
                    {child.icon || '🌿'}
                  </div>
                  <div className="mn-umbrella-subarea-text">
                    <p className="mn-umbrella-subarea-name">{child.name}</p>
                    <p className="mn-umbrella-subarea-activity">פעילות: {lastActivity(child)}</p>
                  </div>
                  <div className="mn-umbrella-subarea-right">
                    <span
                      className="mn-umbrella-subarea-score"
                      style={{ color: child.computedHealthScore !== null ? childColor : C.muted }}
                    >
                      {child.computedHealthScore ?? '—'}
                    </span>
                    {sparkData.length > 0 &&
                      <Sparkline data={sparkData} color={childColor} width={52} height={20} />
                    }
                  </div>
                </div>

                {topTask && (
                  <div className="mn-umbrella-task-preview">
                    <span
                      className="mn-umbrella-priority-dot"
                      style={{ background: PRIORITY_MAP[topTask.priority] ?? C.muted }}
                    />
                    <span className="mn-umbrella-task-title">{topTask.title}</span>
                    <button
                      className="mn-umbrella-ask-nefesh"
                      onClick={e => { e.stopPropagation(); navigate('chat') }}
                    >
                      שאל את Nefesh ←
                    </button>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* No empty-state text — section header affordance is sufficient */}

      {showCreateChild && (
        <div className="mn-umbrella-create-form" dir="rtl">
          <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 12 }}>
            תת-מטרייה חדשה
          </p>
          <input
            value={childName}
            onChange={e => setChildName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateChild()}
            placeholder="שם (לדוג׳ בריאות)"
            autoFocus
            style={{
              width: '100%', background: C.warmBg, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '8px 12px', fontSize: 13, color: C.ink,
              outline: 'none', marginBottom: 12, fontFamily: 'inherit',
              boxSizing: 'border-box' as const, direction: 'rtl' as const,
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 12 }}>
            {['🏠', '👨‍👩‍👧‍👦', '💰', '🧒', '✨', '💪', '📚', '🎵', '🌍', '❤️', '🕍', '💼'].map(icon => (
              <button
                key={icon}
                onClick={() => setChildIcon(icon)}
                style={{
                  width: 36, height: 36, fontSize: 18, borderRadius: 10, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: childIcon === icon ? C.bar : C.faint,
                  outline: childIcon === icon ? `2px solid ${C.bar}` : 'none',
                  outlineOffset: 1,
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
                flex: 1, background: C.bar, color: '#fff', borderRadius: 10, border: 'none',
                padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', opacity: !childName.trim() || creatingChild ? 0.5 : 1,
              }}
            >
              {creatingChild ? 'יוצר…' : 'צור'}
            </button>
            <button
              onClick={() => { setShowCreateChild(false); setChildName(''); setChildIcon('🏠') }}
              style={{
                flex: 1, background: C.faint, color: C.muted, borderRadius: 10,
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

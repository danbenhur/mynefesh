import { T } from '../lib/theme'
import Icon from './Icon'
import type { IconName } from './Icon'

export type NavScreen = 'home' | 'umbrellas' | 'chat' | 'checkin' | 'profile'

interface NavItem {
  id: NavScreen
  icon: IconName
  label: string
  center?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home',      icon: 'home',     label: 'Home' },
  { id: 'umbrellas', icon: 'umbrellas', label: 'Umbrellas' },
  { id: 'chat',      icon: 'chat',     label: 'Nefesh', center: true },
  { id: 'checkin',   icon: 'checkin',  label: 'Check-in' },
  { id: 'profile',   icon: 'profile',  label: 'Profile' },
]

interface Props {
  active: NavScreen
  onNavigate: (screen: NavScreen) => void
}

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 430,
      height: 82,
      background: 'rgba(245,241,232,0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(44,44,42,0.07)',
      display: 'flex',
      alignItems: 'flex-end',
      paddingBottom: 12,
      zIndex: 100,
    }}>
      {NAV_ITEMS.map(item => {
        const isActive = active === item.id

        if (item.center) {
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
                marginTop: -20,
                boxShadow: '0 4px 16px rgba(107,142,153,0.38)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon name="chat" size={22} color="#FFFFFF" strokeWidth={1.8} />
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? T.sage : T.charcoalLight,
              }}>
                {item.label}
              </span>
            </button>
          )
        }

        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
            }}
          >
            <Icon
              name={item.icon}
              size={22}
              color={isActive ? T.sage : T.charcoalLight}
              strokeWidth={isActive ? 2 : 1.6}
            />
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? T.sage : T.charcoalLight,
            }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

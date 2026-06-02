export type PaletteName = 'Sage' | 'Dusk' | 'Clay'

export interface DashColors {
  bar: string
  line: string
  amber: string
  warmBg: string
  bg: string
  surface: string
  card: string
  cardAlt: string
  ink: string
  muted: string
  faint: string
  grid: string
  border: string
  good: string
  mid: string
  low: string
  tipBg: string
  tipInk: string
  navBg: string
}

type Palette = { bar: string; line: string; amber: string; warmBg: string }

const PALETTES: Record<PaletteName, Palette> = {
  Sage: { bar: '#9CAF88', line: '#6B8E99', amber: '#EF9F27', warmBg: '#F5F1E8' },
  Dusk: { bar: '#8FA3B0', line: '#A98AB0', amber: '#E8A34D', warmBg: '#EDEFEB' },
  Clay: { bar: '#C7A06F', line: '#B07B5E', amber: '#E0913A', warmBg: '#F3ECE0' },
}

export function makeColors(name: PaletteName = 'Sage', dark = false): DashColors {
  const p = PALETTES[name]
  if (dark) {
    return {
      ...p,
      bg: '#1A1917', surface: '#232220', card: '#2A2724', cardAlt: '#221F1D',
      ink: '#ECE7DC', muted: 'rgba(236,231,220,0.62)', faint: 'rgba(236,231,220,0.13)',
      grid: 'rgba(236,231,220,0.13)', border: 'rgba(236,231,220,0.14)',
      good: '#86B57F', mid: p.amber, low: '#D89A82',
      tipBg: '#322E2A', tipInk: '#ECE7DC',
      navBg: 'rgba(35,34,32,0.92)',
    }
  }
  return {
    ...p,
    bg: p.warmBg, surface: '#FBF8F1', card: '#FFFFFF', cardAlt: '#FCFAF4',
    ink: '#2C2C2A', muted: 'rgba(44,44,42,0.52)', faint: 'rgba(44,44,42,0.05)',
    grid: 'rgba(44,44,42,0.09)', border: 'rgba(44,44,42,0.08)',
    good: '#6FA06B', mid: p.amber, low: '#CC8A6E',
    tipBg: '#FFFFFF', tipInk: '#2C2C2A',
    navBg: 'rgba(251,248,241,0.92)',
  }
}

export const C = makeColors('Sage', false)

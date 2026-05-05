export const T = {
  sage: '#9CAF88',
  sageLight: '#EBF0E6',
  sageMid: '#C5D4B9',
  blue: '#6B8E99',
  blueLight: '#E4EDF0',
  bg: '#F5F1E8',
  bgCard: '#FFFFFF',
  charcoal: '#2C2C2A',
  charcoalMid: '#5A5A57',
  charcoalLight: '#9C9C98',
  amber: '#EF9F27',
  amberLight: '#FDF2E0',
  red: '#E06B6B',
  redLight: '#FBEAEA',
  purple: '#A584C0',
} as const

const UMBRELLA_COLORS: Record<string, string> = {
  people: '#9CAF88',
  money: '#6B8E99',
  kids: '#EF9F27',
  spirit: '#A584C0',
  spirituality: '#A584C0',
  health: '#E06B6B',
}

export function umbrellaColor(name: string): string {
  return UMBRELLA_COLORS[name.toLowerCase()] ?? T.sage
}

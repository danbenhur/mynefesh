function mulberry32(seed: number): () => number {
  return function (): number {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function smoothSeries(rng: () => number, n: number, start: number, lo: number, hi: number): number[] {
  const out: number[] = [start]
  for (let i = 1; i < n; i++) {
    const delta = (rng() - 0.46) * 14
    out.push(Math.max(lo, Math.min(hi, Math.round(out[i - 1] + delta))))
  }
  return out
}

export interface MockPoint {
  label: string
  bars: number[]   // 0-100, one per umbrella
  score: number    // 0-100 overall wellness
}

export interface MockGranularity {
  points: MockPoint[]
  barLabel: string
  projection: number  // index of the "today" (last real) point
}

export interface MockUmbrella {
  key: string
  he: string
  color: string
  iconKey: string
  score: number
  delta: number
  updated: string
  spark: number[]   // 8 data points
}

export interface MockQuestion {
  he: string
  bars: number[]
  color: string
}

export interface MockGoal {
  he: string
  color: string
  actual: number
  target: number
}

export interface MockData {
  granularity: {
    day: MockGranularity
    week: MockGranularity
    month: MockGranularity
    year: MockGranularity
  }
  umbrellas: MockUmbrella[]
  questions: MockQuestion[]
  goals: MockGoal[]
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function dayLabels(n: number): string[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (n - 1 - i))
    return `${d.getDate()} ${HEBREW_MONTHS[d.getMonth()]}`
  })
}

function weekLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `שבוע ${i + 1}`)
}

function monthLabels(n: number): string[] {
  const now = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)
    return HEBREW_MONTHS[d.getMonth()]
  })
}

function yearLabels(n: number): string[] {
  const y = new Date().getFullYear()
  return Array.from({ length: n }, (_, i) => String(y - n + 1 + i))
}

// Prototype umbrella colors (from data.jsx)
export const UMBRELLA_DEFS = [
  { key: 'people', he: 'אנשים',   color: '#6B8E99', iconKey: 'people' },
  { key: 'money',  he: 'כסף',     color: '#C9A24B', iconKey: 'money'  },
  { key: 'kids',   he: 'ילדים',   color: '#9CAF88', iconKey: 'kids'   },
  { key: 'spirit', he: 'רוחניות', color: '#A98AB0', iconKey: 'spirit' },
  { key: 'health', he: 'בריאות',  color: '#CC8A6E', iconKey: 'health' },
] as const

function buildGranularity(
  rng: () => number,
  labels: string[],
  startScores: number[],
  barLabel: string,
): MockGranularity {
  const n = labels.length
  const series = startScores.map(s => smoothSeries(rng, n, s, 28, 96))
  const points: MockPoint[] = labels.map((label, i) => ({
    label,
    bars: series.map(s => s[i]),
    score: Math.round(series.reduce((sum, s) => sum + s[i], 0) / series.length),
  }))
  return { points, barLabel, projection: n - 1 }
}

function buildMockData(): MockData {
  const rng = mulberry32(42)

  const startScores = [72, 65, 80, 58, 70]

  const day   = buildGranularity(rng, dayLabels(30),   startScores, 'יום')
  const week  = buildGranularity(rng, weekLabels(12),  startScores, 'שבוע')
  const month = buildGranularity(rng, monthLabels(12), startScores, 'חודש')
  const year  = buildGranularity(rng, yearLabels(5),   startScores, 'שנה')

  const umbrellas: MockUmbrella[] = UMBRELLA_DEFS.map((def, i) => {
    const pts = day.points
    const score = Math.round(pts[pts.length - 1].bars[i])
    const prev  = Math.round(pts[Math.max(0, pts.length - 8)].bars[i])
    return {
      key: def.key,
      he: def.he,
      color: def.color,
      iconKey: def.iconKey,
      score,
      delta: score - prev,
      updated: 'אתמול',
      spark: pts.slice(-8).map(p => Math.round(p.bars[i])),
    }
  })

  const qColors = ['#9CAF88', '#A98AB0', '#CC8A6E', '#C9A24B', '#6B8E99']
  const qTexts  = [
    'האם דיברתי עם כל ילד היום?',
    'האם התפללתי ערבית?',
    'האם עשיתי פעילות גופנית?',
    'האם בדקתי את ההוצאות?',
    'כמה שינה קיבלתי?',
  ]
  const questions: MockQuestion[] = qTexts.map((he, i) => ({
    he,
    bars: Array.from({ length: 30 }, () => Math.round(rng() * 100)),
    color: qColors[i],
  }))

  const goals: MockGoal[] = UMBRELLA_DEFS.map((def, i) => ({
    he: def.he,
    color: def.color,
    actual: Math.round(startScores[i] + (rng() - 0.5) * 20),
    target: 80,
  }))

  return { granularity: { day, week, month, year }, umbrellas, questions, goals }
}

export const MOCK_DATA: MockData = buildMockData()

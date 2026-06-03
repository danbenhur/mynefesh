import { and, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { questionAnswers, umbrellaQuestions, umbrellas, resolutions } from '../db/schema.js'
import { computeResolutionProgress, todayJerusalem } from './resolutions.js'

export type Granularity = 'day' | 'week' | 'month' | 'year'
export type Slice = 'combo' | 'stacked' | 'question' | 'goal' | 'movingavg'

// 5-color cycle matching the prototype palette
const COLORS = ['#6B8E99', '#C9A24B', '#9CAF88', '#A98AB0', '#CC8A6E']

const HE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] // 0=Sun … 6=Sat
const HE_MONTHS_SHORT = [
  'ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ',
  'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ',
]

export interface ChartSegment {
  umbrellaId: string
  name: string
  color: string
  value: number // 0–100
}

export interface TimeseriesPoint {
  label: string
  score: number // 0–100
  bars: number  // answer count
  segments?: ChartSegment[]
}

export interface TimeseriesResponse {
  points: TimeseriesPoint[]
  projection: number
  umbrellas?: Array<{ id: string; name: string; color: string }>
}

// Add N days to a YYYY-MM-DD date string (safe at noon UTC)
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Generate the ordered list of bucket keys + the sinceDate for WHERE clauses.
// day/week/month: buckets are YYYY-MM-DD strings
// year: buckets are YYYY-MM strings
function dateBuckets(granularity: Granularity): { buckets: string[]; sinceDate: string } {
  const today = todayJerusalem()

  if (granularity === 'year') {
    const [y, m] = today.split('-').map(Number)
    const buckets: string[] = []
    for (let i = 11; i >= 0; i--) {
      let mo = m - i
      let yr = y
      while (mo <= 0) { mo += 12; yr-- }
      buckets.push(`${yr}-${String(mo).padStart(2, '0')}`)
    }
    return { buckets, sinceDate: buckets[0] + '-01' }
  }

  const count = granularity === 'day' ? 9 : granularity === 'week' ? 7 : 30
  const buckets: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    buckets.push(addDays(today, -i))
  }
  return { buckets, sinceDate: buckets[0] }
}

// Human-readable label for a bucket key given its granularity.
// day/month → day-of-month number; week → Hebrew day initial; year → Hebrew month abbreviation
function getLabel(granularity: Granularity, bucket: string): string {
  if (granularity === 'year') {
    const mo = parseInt(bucket.split('-')[1], 10)
    return HE_MONTHS_SHORT[mo - 1]
  }
  // noon UTC → same calendar day as any timezone including Jerusalem
  const d = new Date(bucket + 'T12:00:00Z')
  if (granularity === 'week') return HE_DAYS[d.getUTCDay()]
  return String(d.getUTCDate()) // day + month: day-of-month
}

// Overall score + answer count per time bucket
export async function getCombo(granularity: Granularity): Promise<TimeseriesResponse> {
  const db = getDb()
  const { buckets, sinceDate } = dateBuckets(granularity)

  if (granularity === 'year') {
    const rows = await db
      .select({
        bucket: sql<string>`to_char(${questionAnswers.interviewDate}, 'YYYY-MM')`,
        score:  sql<string>`ROUND(AVG(${questionAnswers.answerNormalized}) * 100)`,
        bars:   sql<string>`COUNT(*)`,
      })
      .from(questionAnswers)
      .where(and(
        gte(questionAnswers.interviewDate, sinceDate),
        isNotNull(questionAnswers.answerNormalized),
      ))
      .groupBy(sql`to_char(${questionAnswers.interviewDate}, 'YYYY-MM')`)
      .orderBy(sql`1`)

    const map = new Map(rows.map(r => [
      r.bucket,
      { score: Number(r.score) || 0, bars: Number(r.bars) || 0 },
    ]))
    const points = buckets.map(b => ({
      label: getLabel('year', b),
      score: map.get(b)?.score ?? 0,
      bars:  map.get(b)?.bars  ?? 0,
    }))
    return { points, projection: Math.max(0, points.length - 1) }
  }

  const rows = await db
    .select({
      date:  questionAnswers.interviewDate,
      score: sql<string>`ROUND(AVG(${questionAnswers.answerNormalized}) * 100)`,
      bars:  sql<string>`COUNT(*)`,
    })
    .from(questionAnswers)
    .where(and(
      gte(questionAnswers.interviewDate, sinceDate),
      isNotNull(questionAnswers.answerNormalized),
    ))
    .groupBy(questionAnswers.interviewDate)
    .orderBy(questionAnswers.interviewDate)

  const map = new Map(rows.map(r => [
    String(r.date).slice(0, 10),
    { score: Number(r.score) || 0, bars: Number(r.bars) || 0 },
  ]))
  const points = buckets.map(b => ({
    label: getLabel(granularity, b),
    score: map.get(b)?.score ?? 0,
    bars:  map.get(b)?.bars  ?? 0,
  }))
  return { points, projection: Math.max(0, points.length - 1) }
}

// Per-umbrella health scores per time bucket (top-level umbrellas only)
export async function getStacked(granularity: Granularity): Promise<TimeseriesResponse> {
  const db = getDb()
  const { buckets, sinceDate } = dateBuckets(granularity)

  // Fetch top-level non-archived umbrellas for the legend / segment list
  const topLevel = await db
    .select({ id: umbrellas.id, name: umbrellas.name })
    .from(umbrellas)
    .where(and(isNull(umbrellas.parentId), isNull(umbrellas.archivedAt)))
    .orderBy(umbrellas.position)

  const umbrellaColors = topLevel.map((u, i) => ({
    id: u.id, name: u.name, color: COLORS[i % COLORS.length],
  }))
  const topIds = topLevel.map(u => u.id)

  if (topIds.length === 0) {
    const points = buckets.map(b => ({ label: getLabel(granularity, b), score: 0, bars: 0, segments: [] }))
    return { points, projection: Math.max(0, points.length - 1), umbrellas: [] }
  }

  // Query health scores per (bucket, umbrella) — only for top-level umbrellas
  let bucketMap: Map<string, Map<string, number>>

  if (granularity === 'year') {
    const rows = await db
      .select({
        bucket:     sql<string>`to_char(${questionAnswers.interviewDate}, 'YYYY-MM')`,
        umbrellaId: umbrellaQuestions.umbrellaId,
        score:      sql<string>`ROUND(AVG(${questionAnswers.answerNormalized}) * 100)`,
      })
      .from(questionAnswers)
      .innerJoin(umbrellaQuestions, eq(questionAnswers.questionId, umbrellaQuestions.id))
      .where(and(
        gte(questionAnswers.interviewDate, sinceDate),
        isNotNull(questionAnswers.answerNormalized),
        inArray(umbrellaQuestions.umbrellaId, topIds),
      ))
      .groupBy(
        sql`to_char(${questionAnswers.interviewDate}, 'YYYY-MM')`,
        umbrellaQuestions.umbrellaId,
      )
      .orderBy(sql`1`)

    bucketMap = new Map()
    for (const r of rows) {
      if (!bucketMap.has(r.bucket)) bucketMap.set(r.bucket, new Map())
      bucketMap.get(r.bucket)!.set(r.umbrellaId, Number(r.score) || 0)
    }
  } else {
    const rows = await db
      .select({
        date:       questionAnswers.interviewDate,
        umbrellaId: umbrellaQuestions.umbrellaId,
        score:      sql<string>`ROUND(AVG(${questionAnswers.answerNormalized}) * 100)`,
      })
      .from(questionAnswers)
      .innerJoin(umbrellaQuestions, eq(questionAnswers.questionId, umbrellaQuestions.id))
      .where(and(
        gte(questionAnswers.interviewDate, sinceDate),
        isNotNull(questionAnswers.answerNormalized),
        inArray(umbrellaQuestions.umbrellaId, topIds),
      ))
      .groupBy(questionAnswers.interviewDate, umbrellaQuestions.umbrellaId)
      .orderBy(questionAnswers.interviewDate)

    bucketMap = new Map()
    for (const r of rows) {
      const key = String(r.date).slice(0, 10)
      if (!bucketMap.has(key)) bucketMap.set(key, new Map())
      bucketMap.get(key)!.set(r.umbrellaId, Number(r.score) || 0)
    }
  }

  const points: TimeseriesPoint[] = buckets.map(b => {
    const segData = bucketMap.get(b) ?? new Map<string, number>()
    const segments: ChartSegment[] = umbrellaColors.map(u => ({
      umbrellaId: u.id,
      name: u.name,
      color: u.color,
      value: segData.get(u.id) ?? 0,
    }))
    const active = segments.filter(s => s.value > 0)
    const overall = active.length > 0
      ? Math.round(active.reduce((s, seg) => s + seg.value, 0) / active.length)
      : 0
    return {
      label: getLabel(granularity, b),
      score: overall,
      bars: segData.size,
      segments,
    }
  })

  return { points, projection: Math.max(0, points.length - 1), umbrellas: umbrellaColors }
}

// Top 5 questions by answer frequency (last 30 days). Granularity is ignored — always 30-day window.
export async function getByQuestion(): Promise<TimeseriesResponse> {
  const db = getDb()
  const since = addDays(todayJerusalem(), -29)

  const rows = await db
    .select({
      text:  umbrellaQuestions.text,
      score: sql<string>`ROUND(AVG(${questionAnswers.answerNormalized}) * 100)`,
      bars:  sql<string>`COUNT(*)`,
    })
    .from(questionAnswers)
    .innerJoin(umbrellaQuestions, eq(questionAnswers.questionId, umbrellaQuestions.id))
    .where(and(
      gte(questionAnswers.interviewDate, since),
      isNotNull(questionAnswers.answerNormalized),
    ))
    .groupBy(questionAnswers.questionId, umbrellaQuestions.text)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(5)

  const points: TimeseriesPoint[] = rows.map(r => ({
    label: r.text.length > 22 ? r.text.slice(0, 20) + '…' : r.text,
    score: Number(r.score) || 0,
    bars:  Number(r.bars)  || 0,
  }))
  return { points, projection: points.length }
}

// Active resolutions as progress bars. Granularity is ignored.
export async function getGoals(): Promise<TimeseriesResponse> {
  const db = getDb()

  const activeRes = await db
    .select({
      title:            resolutions.title,
      questionId:       resolutions.questionId,
      startDate:        resolutions.startDate,
      endDate:          resolutions.endDate,
      successThreshold: resolutions.successThreshold,
    })
    .from(resolutions)
    .where(eq(resolutions.status, 'active'))

  if (activeRes.length === 0) return { points: [], projection: 0 }

  const qIds = activeRes.map(r => r.questionId)
  const qRows = await db
    .select({ id: umbrellaQuestions.id, answerType: umbrellaQuestions.answerType })
    .from(umbrellaQuestions)
    .where(inArray(umbrellaQuestions.id, qIds))

  const answerTypeMap = new Map(qRows.map(q => [q.id, q.answerType as string]))

  const points: TimeseriesPoint[] = []
  for (const res of activeRes) {
    const answerType = answerTypeMap.get(res.questionId) ?? 'boolean'
    const progress = await computeResolutionProgress(
      {
        questionId: res.questionId,
        startDate: String(res.startDate),
        endDate: String(res.endDate),
        successThreshold: res.successThreshold,
      },
      answerType,
    )
    points.push({
      label: res.title.length > 22 ? res.title.slice(0, 20) + '…' : res.title,
      score: progress.percentage,
      bars:  progress.elapsedDays,
    })
  }

  return { points, projection: points.length }
}

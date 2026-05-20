import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { umbrellaQuestions, umbrellas } from '../db/schema.js'

export interface ComposedQuestion {
  id: string
  umbrellaId: string
  umbrellaName: string
  umbrellaIcon: string
  umbrellaColor: string | null
  text: string
  cadence: 'daily' | 'weekly' | 'monthly' | 'annual'
  answerType: 'text' | 'scale' | 'boolean' | 'boolean_partial' | 'multi_select'
  scaleMin: number | null
  scaleMax: number | null
  options: string[] | null
  position: number
}

function jerusalemDateParts(date: Date): { dow: number; dom: number; moy: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date)

  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const dom = parseInt(get('day'), 10)
  const moy = parseInt(get('month'), 10)

  // Intl weekday 'short' in en-GB: Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const dowMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
  }
  const dow = dowMap[get('weekday')] ?? 0

  return { dow, dom, moy }
}

export async function composeTodaysQuestions(date: Date): Promise<ComposedQuestion[]> {
  const db = getDb()
  const { dow, dom, moy } = jerusalemDateParts(date)

  const rows = await db
    .select({
      q: umbrellaQuestions,
      u: {
        id: umbrellas.id,
        name: umbrellas.name,
        icon: umbrellas.icon,
        position: umbrellas.position,
      },
    })
    .from(umbrellaQuestions)
    .innerJoin(umbrellas, eq(umbrellaQuestions.umbrellaId, umbrellas.id))
    .where(eq(umbrellaQuestions.enabled, true))
    .orderBy(asc(umbrellas.position), asc(umbrellaQuestions.position))

  const matching = rows.filter(({ q }) => {
    switch (q.cadence) {
      case 'daily':
        return true
      case 'weekly':
        return q.dayOfWeek === dow
      case 'monthly':
        return q.dayOfMonth === dom
      case 'annual':
        return q.dayOfMonth === dom && q.monthOfYear === moy
      default:
        return false
    }
  })

  return matching.map(({ q, u }) => ({
    id: q.id,
    umbrellaId: q.umbrellaId,
    umbrellaName: u.name,
    umbrellaIcon: u.icon,
    umbrellaColor: null, // color is derived client-side from umbrella name
    text: q.text,
    cadence: q.cadence,
    answerType: q.answerType,
    scaleMin: q.scaleMin,
    scaleMax: q.scaleMax,
    options: (q.options as string[] | null) ?? null,
    position: q.position,
  }))
}

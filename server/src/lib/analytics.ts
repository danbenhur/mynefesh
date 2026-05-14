import { and, eq, gte, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { questionAnswers, umbrellaQuestions } from '../db/schema.js'

function sinceDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// AVG(answer_normalized) over the last N days, scaled 0-100.
// Returns null when there are no answers for that umbrella.
export async function computeUmbrellaHealthScore(umbrellaId: string, days = 14): Promise<number | null> {
  const db = getDb()
  const [row] = await db
    .select({ avg: sql<string>`AVG(${questionAnswers.answerNormalized})` })
    .from(questionAnswers)
    .innerJoin(umbrellaQuestions, eq(questionAnswers.questionId, umbrellaQuestions.id))
    .where(and(
      eq(umbrellaQuestions.umbrellaId, umbrellaId),
      gte(questionAnswers.interviewDate, sinceDate(days)),
      isNotNull(questionAnswers.answerNormalized),
    ))

  if (row.avg == null) return null
  return Math.round(Number(row.avg) * 100)
}

// Per-day average score (0-100) for one umbrella over the last N days.
// Days with no answers are omitted — caller should handle gaps.
export async function getUmbrellaDailyTrend(umbrellaId: string, days = 42): Promise<{ date: string; score: number }[]> {
  const db = getDb()
  const rows = await db
    .select({
      date: questionAnswers.interviewDate,
      avg: sql<string>`AVG(${questionAnswers.answerNormalized})`,
    })
    .from(questionAnswers)
    .innerJoin(umbrellaQuestions, eq(questionAnswers.questionId, umbrellaQuestions.id))
    .where(and(
      eq(umbrellaQuestions.umbrellaId, umbrellaId),
      gte(questionAnswers.interviewDate, sinceDate(days)),
      isNotNull(questionAnswers.answerNormalized),
    ))
    .groupBy(questionAnswers.interviewDate)
    .orderBy(questionAnswers.interviewDate)

  return rows.map(r => ({ date: r.date, score: Math.round(Number(r.avg) * 100) }))
}

// Per-day answer data for a single question over the last N days.
export async function getQuestionDailyTrend(questionId: string, days = 90): Promise<{
  date: string
  value: number | null
  answerText: string | null
  answerScale: number | null
  answerBoolean: string | null
}[]> {
  const db = getDb()
  const rows = await db
    .select({
      date: questionAnswers.interviewDate,
      value: questionAnswers.answerNormalized,
      answerText: questionAnswers.answerText,
      answerScale: questionAnswers.answerScale,
      answerBoolean: questionAnswers.answerBoolean,
    })
    .from(questionAnswers)
    .where(and(
      eq(questionAnswers.questionId, questionId),
      gte(questionAnswers.interviewDate, sinceDate(days)),
    ))
    .orderBy(questionAnswers.interviewDate)

  return rows.map(r => ({
    date: r.date,
    value: r.value,
    answerText: r.answerText,
    answerScale: r.answerScale,
    answerBoolean: r.answerBoolean,
  }))
}

// Batch version: one query for all umbrellas, returns umbrellaId → score map.
// Umbrellas with no answer data are omitted from the map (caller gets undefined/null).
export async function getAllUmbrellaHealthScores(days = 14): Promise<Record<string, number | null>> {
  const db = getDb()
  const rows = await db
    .select({
      umbrellaId: umbrellaQuestions.umbrellaId,
      avg: sql<string>`AVG(${questionAnswers.answerNormalized})`,
    })
    .from(questionAnswers)
    .innerJoin(umbrellaQuestions, eq(questionAnswers.questionId, umbrellaQuestions.id))
    .where(and(
      gte(questionAnswers.interviewDate, sinceDate(days)),
      isNotNull(questionAnswers.answerNormalized),
    ))
    .groupBy(umbrellaQuestions.umbrellaId)

  const out: Record<string, number | null> = {}
  for (const r of rows) {
    out[r.umbrellaId] = Math.round(Number(r.avg) * 100)
  }
  return out
}

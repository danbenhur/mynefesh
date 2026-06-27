import { Router } from 'express'
import { z } from 'zod'
import { and, eq, asc } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { umbrellas, umbrellaQuestions } from '../db/schema.js'

type QRow = typeof umbrellaQuestions.$inferSelect

function qShape(q: QRow) {
  return {
    id: q.id,
    umbrellaId: q.umbrellaId,
    text: q.text,
    cadence: q.cadence,
    dayOfWeek: q.dayOfWeek,
    dayOfMonth: q.dayOfMonth,
    monthOfYear: q.monthOfYear,
    answerType: q.answerType,
    scaleMin: q.scaleMin,
    scaleMax: q.scaleMax,
    options: (q.options as string[] | null) ?? null,
    position: q.position,
    enabled: q.enabled,
  }
}

const ANSWER_TYPES = ['text', 'scale', 'boolean', 'boolean_partial', 'multi_select'] as const

const scaleCheck = (data: { answerType?: string; scaleMin?: number | null; scaleMax?: number | null }) => {
  if (data.answerType === 'scale') {
    if (data.scaleMin == null || data.scaleMax == null) return false
    return data.scaleMin < data.scaleMax
  }
  return true
}

const multiSelectCheck = (data: { answerType?: string; options?: string[] | null }) => {
  if (data.answerType === 'multi_select') return (data.options?.length ?? 0) >= 2
  return true
}

const CreateSchema = z.object({
  text: z.string().min(1),
  cadence: z.enum(['daily', 'weekly', 'monthly', 'annual']),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  answerType: z.enum(ANSWER_TYPES).default('text'),
  scaleMin: z.number().int().nullable().optional(),
  scaleMax: z.number().int().nullable().optional(),
  options: z.array(z.string().min(1)).min(2).max(20).nullable().optional(),
  position: z.number().int().default(0),
  enabled: z.boolean().default(true),
}).refine(scaleCheck, {
  message: 'scale requires scaleMin and scaleMax with scaleMin < scaleMax',
  path: ['scaleMin'],
}).refine(multiSelectCheck, {
  message: 'multi_select requires at least 2 options',
  path: ['options'],
})

const PatchSchema = z.object({
  text: z.string().min(1).optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly', 'annual']).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  answerType: z.enum(ANSWER_TYPES).optional(),
  scaleMin: z.number().int().nullable().optional(),
  scaleMax: z.number().int().nullable().optional(),
  options: z.array(z.string().min(1)).min(2).max(20).nullable().optional(),
  position: z.number().int().optional(),
  enabled: z.boolean().optional(),
}).strict().refine(scaleCheck, {
  message: 'scale requires scaleMin < scaleMax',
  path: ['scaleMin'],
}).refine(multiSelectCheck, {
  message: 'multi_select requires at least 2 options',
  path: ['options'],
})

// Mounted at /api/umbrellas — handles /:umbrellaId/questions
export const umbrellaQuestionsRouter = Router()

umbrellaQuestionsRouter.get('/:umbrellaId/questions', async (req, res) => {
  try {
    const db = getDb()
    const rows = await db
      .select()
      .from(umbrellaQuestions)
      .where(and(
        eq(umbrellaQuestions.umbrellaId, req.params.umbrellaId),
        eq(umbrellaQuestions.userId, req.user!.id),
      ))
      .orderBy(asc(umbrellaQuestions.position), asc(umbrellaQuestions.createdAt))
    res.json(rows.map(qShape))
  } catch (err) {
    console.error('GET questions:', err)
    res.status(500).json({ error: 'Failed to fetch questions' })
  }
})

umbrellaQuestionsRouter.post('/:umbrellaId/questions', async (req, res) => {
  const parse = CreateSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  try {
    const db = getDb()

    // Verify the umbrella belongs to this user
    const [umb] = await db
      .select({ id: umbrellas.id })
      .from(umbrellas)
      .where(and(eq(umbrellas.id, req.params.umbrellaId), eq(umbrellas.userId, req.user!.id)))
      .limit(1)
    if (!umb) { res.status(404).json({ error: 'Umbrella not found' }); return }

    const [row] = await db
      .insert(umbrellaQuestions)
      .values({ ...parse.data, umbrellaId: req.params.umbrellaId, userId: req.user!.id })
      .returning()
    res.status(201).json(qShape(row))
  } catch (err) {
    console.error('POST questions:', err)
    res.status(500).json({ error: 'Failed to create question' })
  }
})

// Mounted at /api/questions — handles /:id (patch + delete)
export const questionsRouter = Router()

questionsRouter.patch('/:id', async (req, res) => {
  const parse = PatchSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  try {
    const db = getDb()
    const [row] = await db
      .update(umbrellaQuestions)
      .set({ ...parse.data, updatedAt: new Date() })
      .where(and(eq(umbrellaQuestions.id, req.params.id), eq(umbrellaQuestions.userId, req.user!.id)))
      .returning()
    if (!row) { res.status(404).json({ error: 'Question not found' }); return }
    res.json(qShape(row))
  } catch (err) {
    console.error('PATCH questions/:id:', err)
    res.status(500).json({ error: 'Failed to update question' })
  }
})

questionsRouter.delete('/:id', async (req, res) => {
  try {
    const db = getDb()
    const [row] = await db
      .delete(umbrellaQuestions)
      .where(and(eq(umbrellaQuestions.id, req.params.id), eq(umbrellaQuestions.userId, req.user!.id)))
      .returning()
    if (!row) { res.status(404).json({ error: 'Question not found' }); return }
    res.status(204).end()
  } catch (err) {
    console.error('DELETE questions/:id:', err)
    res.status(500).json({ error: 'Failed to delete question' })
  }
})

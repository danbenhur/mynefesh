import { Router } from 'express'
import { z } from 'zod'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { umbrellaQuestions } from '../db/schema.js'

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
    position: q.position,
    enabled: q.enabled,
  }
}

const CreateSchema = z.object({
  text: z.string().min(1),
  cadence: z.enum(['daily', 'weekly', 'monthly', 'annual']),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  answerType: z.enum(['text', 'scale']).default('text'),
  position: z.number().int().default(0),
  enabled: z.boolean().default(true),
})

const PatchSchema = z.object({
  text: z.string().min(1).optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly', 'annual']).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  answerType: z.enum(['text', 'scale']).optional(),
  position: z.number().int().optional(),
  enabled: z.boolean().optional(),
}).strict()

// Mounted at /api/umbrellas — handles /:umbrellaId/questions
export const umbrellaQuestionsRouter = Router()

umbrellaQuestionsRouter.get('/:umbrellaId/questions', async (req, res) => {
  try {
    const db = getDb()
    const rows = await db
      .select()
      .from(umbrellaQuestions)
      .where(eq(umbrellaQuestions.umbrellaId, req.params.umbrellaId))
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
    const [row] = await db
      .insert(umbrellaQuestions)
      .values({ ...parse.data, umbrellaId: req.params.umbrellaId })
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
      .where(eq(umbrellaQuestions.id, req.params.id))
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
      .where(eq(umbrellaQuestions.id, req.params.id))
      .returning()
    if (!row) { res.status(404).json({ error: 'Question not found' }); return }
    res.status(204).end()
  } catch (err) {
    console.error('DELETE questions/:id:', err)
    res.status(500).json({ error: 'Failed to delete question' })
  }
})

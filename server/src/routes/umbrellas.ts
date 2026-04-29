import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { umbrellas, tasks, reminders, healthHistory } from '../db/schema.js'

const router = Router()

type UmbrellaRow = typeof umbrellas.$inferSelect
type TaskRow = typeof tasks.$inferSelect
type ReminderRow = typeof reminders.$inferSelect
type HistoryRow = typeof healthHistory.$inferSelect

function taskShape(t: TaskRow) {
  return {
    id: t.id,
    umbrellaId: t.umbrellaId,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueAt ? t.dueAt.toISOString().split('T')[0] : undefined,
    position: t.position,
  }
}

function reminderShape(r: ReminderRow) {
  return {
    id: r.id,
    umbrellaId: r.umbrellaId,
    message: r.message,
    triggerDate: r.triggerAt.toISOString().split('T')[0],
    isRecurring: r.isRecurring,
  }
}

function historyShape(h: HistoryRow) {
  return {
    date: h.recordedAt.toISOString().split('T')[0],
    score: h.score,
  }
}

function umbrellaShape(
  u: UmbrellaRow,
  uTasks: TaskRow[],
  uReminders: ReminderRow[],
  uHistory: HistoryRow[]
) {
  return {
    id: u.id,
    name: u.name,
    icon: u.icon,
    parentId: u.parentId,
    healthScore: u.healthScore,
    notes: u.notes,
    position: u.position,
    tasks: uTasks.map(taskShape),
    reminders: uReminders.map(reminderShape),
    history: uHistory.map(historyShape),
    children: [], // client assembles tree from parentId
  }
}

// GET /api/umbrellas — flat list; client builds tree from parentId
router.get('/', async (_req, res) => {
  try {
    const db = getDb()
    const [allUmbrellas, allTasks, allReminders, allHistory] = await Promise.all([
      db.select().from(umbrellas),
      db.select().from(tasks),
      db.select().from(reminders),
      db.select().from(healthHistory),
    ])
    const result = allUmbrellas
      .sort((a, b) => a.position - b.position)
      .map(u => umbrellaShape(
        u,
        allTasks.filter(t => t.umbrellaId === u.id),
        allReminders.filter(r => r.umbrellaId === u.id),
        allHistory.filter(h => h.umbrellaId === u.id),
      ))
    res.json(result)
  } catch (err) {
    console.error('GET /umbrellas:', err)
    res.status(500).json({ error: 'Failed to fetch umbrellas' })
  }
})

const CreateSchema = z.object({
  name: z.string().min(1),
  icon: z.string().default(''),
  parentId: z.string().uuid().nullable().optional(),
  healthScore: z.number().int().min(0).max(100).default(50),
  notes: z.array(z.string()).default([]),
  position: z.number().int().default(0),
})

// POST /api/umbrellas
router.post('/', async (req, res) => {
  const parse = CreateSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  try {
    const db = getDb()
    const [row] = await db.insert(umbrellas).values(parse.data).returning()
    res.status(201).json(umbrellaShape(row, [], [], []))
  } catch (err) {
    console.error('POST /umbrellas:', err)
    res.status(500).json({ error: 'Failed to create umbrella' })
  }
})

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
  notes: z.array(z.string()).optional(),
  position: z.number().int().optional(),
}).strict()

// PATCH /api/umbrellas/:id
router.patch('/:id', async (req, res) => {
  const parse = PatchSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  if (Object.keys(parse.data).length === 0) {
    res.status(400).json({ error: 'No fields to update' })
    return
  }
  try {
    const db = getDb()
    const [row] = await db.update(umbrellas)
      .set({ ...parse.data, updatedAt: new Date() })
      .where(eq(umbrellas.id, req.params.id))
      .returning()
    if (!row) { res.status(404).json({ error: 'Umbrella not found' }); return }
    res.json(umbrellaShape(row, [], [], []))
  } catch (err) {
    console.error('PATCH /umbrellas/:id:', err)
    res.status(500).json({ error: 'Failed to update umbrella' })
  }
})

// DELETE /api/umbrellas/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb()
    const [row] = await db.delete(umbrellas)
      .where(eq(umbrellas.id, req.params.id))
      .returning()
    if (!row) { res.status(404).json({ error: 'Umbrella not found' }); return }
    res.status(204).end()
  } catch (err) {
    console.error('DELETE /umbrellas/:id:', err)
    res.status(500).json({ error: 'Failed to delete umbrella' })
  }
})

export default router

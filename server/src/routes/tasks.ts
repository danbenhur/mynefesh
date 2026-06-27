import { Router } from 'express'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { tasks } from '../db/schema.js'

const router = Router()

type TaskRow = typeof tasks.$inferSelect

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

// GET /api/tasks?umbrella=:id
router.get('/', async (req, res) => {
  const umbrellaId = req.query.umbrella as string | undefined
  try {
    const db = getDb()
    const userId = req.user!.id
    const rows = umbrellaId
      ? await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.umbrellaId, umbrellaId)))
      : await db.select().from(tasks).where(eq(tasks.userId, userId))
    res.json(rows.map(taskShape))
  } catch (err) {
    console.error('GET /tasks:', err)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

const CreateSchema = z.object({
  umbrellaId: z.string().uuid(),
  title: z.string().min(1),
  status: z.enum(['todo', 'in-progress', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().optional(),
  position: z.number().int().default(0),
})

// POST /api/tasks
router.post('/', async (req, res) => {
  const parse = CreateSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  const { dueDate, ...rest } = parse.data
  try {
    const db = getDb()
    const [row] = await db.insert(tasks).values({
      ...rest,
      userId: req.user!.id,
      dueAt: dueDate ? new Date(dueDate) : null,
    }).returning()
    res.status(201).json(taskShape(row))
  } catch (err) {
    console.error('POST /tasks:', err)
    res.status(500).json({ error: 'Failed to create task' })
  }
})

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(['todo', 'in-progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().nullable().optional(),
  position: z.number().int().optional(),
}).strict()

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  const parse = PatchSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  const { dueDate, ...rest } = parse.data
  const setValues: Partial<typeof tasks.$inferInsert> & { updatedAt: Date } = {
    ...rest,
    updatedAt: new Date(),
  }
  if (dueDate !== undefined) {
    setValues.dueAt = dueDate ? new Date(dueDate) : null
  }
  try {
    const db = getDb()
    const [owned] = await db.select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.user!.id)))
      .limit(1)
    if (!owned) { res.status(404).json({ error: 'Task not found' }); return }

    const [row] = await db.update(tasks)
      .set(setValues)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.user!.id)))
      .returning()
    if (!row) { res.status(404).json({ error: 'Task not found' }); return }
    res.json(taskShape(row))
  } catch (err) {
    console.error('PATCH /tasks/:id:', err)
    res.status(500).json({ error: 'Failed to update task' })
  }
})

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb()
    const [owned] = await db.select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.user!.id)))
      .limit(1)
    if (!owned) { res.status(404).json({ error: 'Task not found' }); return }

    const [row] = await db.delete(tasks)
      .where(and(eq(tasks.id, req.params.id), eq(tasks.userId, req.user!.id)))
      .returning()
    if (!row) { res.status(404).json({ error: 'Task not found' }); return }
    res.status(204).end()
  } catch (err) {
    console.error('DELETE /tasks/:id:', err)
    res.status(500).json({ error: 'Failed to delete task' })
  }
})

export default router

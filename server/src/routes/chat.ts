import { Router } from 'express'
import { z } from 'zod'
import { desc, ne, asc } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '../db/index.js'
import { chatMessages, umbrellas, tasks, reminders } from '../db/schema.js'
import { getAllUmbrellaHealthScores } from '../lib/analytics.js'

const router = Router()
const client = new Anthropic()

const BASE_SYSTEM = `You are Dan's personal life-management AI — a proactive, caring secretary for his myNefesh app. You help him track and improve his life "umbrellas": areas of life like People, Money, Kids, Spirituality, Health, and any others he creates.

You have full visibility into his current umbrellas, sub-areas, tasks, and reminders via the <user_context> block below. Reference them naturally — by name, with specifics. When something is mid-flight (a task due soon, an overdue reminder), say so unprompted.

About Dan:
- Married, 11 children, lives in Kfar Chabad, Israel
- Front-end developer (React/TypeScript), musician, Chassidus teacher
- Deeply committed to spiritual life, family, and community
- Overloaded with obligations across many domains

How to behave:
- Be warm but efficient. Dan is busy.
- Push back when his goals seem off. Don't over-praise.
- Tie suggestions to his actual data — not generic advice.
- If something looks stale or unattended, gently surface it.
- Speak in English unless he writes in Hebrew.
- You can READ his data but cannot yet modify it. If he asks you to update an umbrella, add a task, or change a score — acknowledge what you can see and tell him that direct editing from chat is coming soon; for now he can make the change in the app.`

function esc(s: string, attr = false): string {
  let r = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (attr) r = r.replace(/"/g, '&quot;')
  return r
}

async function buildContextBlock(): Promise<string> {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  const [allUmbrellas, openTasks, allReminders, computedScores] = await Promise.all([
    db.select().from(umbrellas).orderBy(asc(umbrellas.position)),
    db.select().from(tasks).where(ne(tasks.status, 'done')),
    db.select().from(reminders),
    getAllUmbrellaHealthScores(14),
  ])

  const umbrellaLines: string[] = []
  for (const u of allUmbrellas) {
    const uReminders = allReminders.filter(r => r.umbrellaId === u.id)
    const score = computedScores[u.id]
    const scoreDisplay = score != null ? String(score) : 'no data yet'
    umbrellaLines.push(
      `  <umbrella id="${u.id}" name="${esc(u.name, true)}" icon="${esc(u.icon, true)}" parent_id="${u.parentId ?? ''}">`,
      `    <health_score>${scoreDisplay}</health_score>`,
    )
    for (const note of u.notes) {
      umbrellaLines.push(`    <note>${esc(note)}</note>`)
    }
    for (const r of uReminders) {
      umbrellaLines.push(
        `    <reminder message="${esc(r.message, true)}" trigger_date="${r.triggerAt.toISOString().split('T')[0]}" recurring="${r.isRecurring}"/>`
      )
    }
    umbrellaLines.push('  </umbrella>')
  }

  const taskLines = openTasks.map(t => {
    const due = t.dueAt ? ` due_at="${t.dueAt.toISOString().split('T')[0]}"` : ''
    return `  <task id="${t.id}" umbrella_id="${t.umbrellaId}" title="${esc(t.title, true)}" status="${t.status}" priority="${t.priority}"${due}/>`
  })

  return [
    '<user_context>',
    `  <current_date>${today}</current_date>`,
    '  <umbrellas>',
    ...umbrellaLines,
    '  </umbrellas>',
    '  <tasks>',
    ...taskLines,
    '  </tasks>',
    '</user_context>',
  ].join('\n')
}

// GET /api/chat/history?limit=50
router.get('/history', async (req, res) => {
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string) || 50))
  try {
    const db = getDb()
    const rows = await db.select()
      .from(chatMessages)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
    res.json(rows.reverse().map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt.toISOString(),
    })))
  } catch (err) {
    console.error('GET /chat/history:', err)
    res.status(500).json({ error: 'Failed to fetch chat history' })
  }
})

const AppendSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})

// POST /api/chat/history — append a single message
router.post('/history', async (req, res) => {
  const parse = AppendSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() })
    return
  }
  try {
    const db = getDb()
    const [row] = await db.insert(chatMessages).values(parse.data).returning()
    res.status(201).json({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.createdAt.toISOString(),
    })
  } catch (err) {
    console.error('POST /chat/history:', err)
    res.status(500).json({ error: 'Failed to save message' })
  }
})

// POST /api/chat — SSE streaming to Claude with live umbrella context
router.post('/', async (req, res) => {
  const { messages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  if (!messages?.length) {
    res.status(400).json({ error: 'messages required' })
    return
  }

  // The client sends its local message array; we only need the latest user turn.
  // History is sourced from the DB so it stays authoritative across sessions.
  const currentUserContent = messages.at(-1)?.content ?? ''
  if (!currentUserContent) {
    res.status(400).json({ error: 'no user message found' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  let fullResponse = ''

  try {
    // Fetch context and history in parallel — both degrade gracefully if DB is down
    const [contextBlock, historyRows] = await Promise.all([
      buildContextBlock().catch(err => {
        console.error('Context build failed (non-fatal):', err)
        return ''
      }),
      (async () => {
        try {
          const db = getDb()
          const rows = await db.select()
            .from(chatMessages)
            .orderBy(desc(chatMessages.createdAt))
            .limit(20)
          return rows.reverse() // chronological for Claude
        } catch {
          return []
        }
      })(),
    ])

    const systemPrompt = contextBlock
      ? `${BASE_SYSTEM}\n\n${contextBlock}`
      : BASE_SYSTEM

    // DB history + current user turn (current turn not yet persisted)
    const claudeMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...historyRows.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: currentUserContent },
    ]

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: claudeMessages,
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        fullResponse += event.delta.text
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()

    // Persist user + assistant messages after stream (non-fatal)
    if (fullResponse) {
      try {
        const db = getDb()
        await db.insert(chatMessages).values([
          { role: 'user', content: currentUserContent },
          { role: 'assistant', content: fullResponse },
        ])
      } catch (persistErr) {
        console.error('Failed to persist chat messages (non-fatal):', persistErr)
      }
    }
  } catch (err) {
    console.error('POST /api/chat:', err)
    res.write(`data: ${JSON.stringify({ error: 'Failed to reach AI' })}\n\n`)
    res.end()
  }
})

export default router

import { Router } from 'express'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '../db/index.js'
import { chatMessages } from '../db/schema.js'

const router = Router()
const client = new Anthropic()

const SYSTEM_PROMPT = `You are MyNefesh, Dan's personal AI life secretary. You know him deeply and speak to him directly, like a trusted advisor who always has his back.

About Dan:
- Married with 11 children, lives in Kfar Chabad, Israel
- Front-end developer (React/TypeScript), musician, Chassidus teacher
- Deeply committed to his spiritual life, family, and community
- Overloaded with obligations across many life domains

Dan organizes his life into "Umbrellas" — areas of life with health scores (0–100):
- 👨‍👩‍👧‍👦 People (score: 72, trending up) — relationships with wife, community
- 💰 Money (score: 55, trending up) — income, expenses. Has urgent task: pay city bills by May 1
- 🧒 Kids (score: 78, trending up) — 11 children
- ✨ Spirituality (score: 83, trending up) — Chassidus, davening, learning. Preparing a shiur
- 💪 Health (score: 61, trending up) — needs to schedule annual blood test (overdue)

Your job:
- Be proactive, warm, and direct — not robotic
- Surface what matters before he has to ask
- Help him think through decisions, not just answer questions
- Keep responses concise — Dan is busy
- Speak in English (unless he writes in Hebrew/English mix)
- Never be sycophantic. Just be real with him.`

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

// POST /api/chat — SSE streaming to Claude
router.post('/', async (req, res) => {
  const { messages } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  if (!messages?.length) {
    res.status(400).json({ error: 'messages required' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  let fullResponse = ''

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
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

    // Persist after stream completes — non-fatal if DB is unavailable
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMsg && fullResponse) {
      try {
        const db = getDb()
        await db.insert(chatMessages).values([
          { role: 'user', content: lastUserMsg.content },
          { role: 'assistant', content: fullResponse },
        ])
      } catch (persistErr) {
        console.error('Failed to persist chat messages (non-fatal):', persistErr)
      }
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Failed to reach AI' })}\n\n`)
    res.end()
  }
})

export default router

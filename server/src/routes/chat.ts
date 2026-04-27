import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'

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
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Failed to reach AI' })}\n\n`)
    res.end()
  }
})

export default router

import { useState, useCallback } from 'react'
import type { Message } from '../types/chat'

function uid() {
  return Math.random().toString(36).slice(2)
}

const OPENING_MESSAGE: Message = {
  id: 'system-open',
  role: 'assistant',
  content: "Hey Dan 👋 Quick heads up — your blood test is overdue and city bills are due May 1st. What do you want to tackle first, or is there something else on your mind?",
  timestamp: new Date(),
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE])
  const [isStreaming, setIsStreaming] = useState(false)

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    const assistantId = uid()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    // Build the API messages array (exclude the static opening message)
    const apiMessages = [...messages, userMsg]
      .filter(m => m.role !== 'system' && m.id !== 'system-open')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Add the opening message as the first assistant turn if it's the only prior message
    if (messages.length === 1 && messages[0].id === 'system-open') {
      apiMessages.unshift({ role: 'assistant', content: OPENING_MESSAGE.content })
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok || !res.body) throw new Error('Bad response')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') continue

          try {
            const { text, error } = JSON.parse(payload)
            if (error) throw new Error(error)
            if (text) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + text } : m
                )
              )
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Something went wrong. Try again.' }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }, [messages, isStreaming])

  return { messages, send, isStreaming }
}

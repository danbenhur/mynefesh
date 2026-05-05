import { useState, useCallback } from 'react'
import type { Message } from '../types/chat'

function uid() {
  return Math.random().toString(36).slice(2)
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
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

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: [{ role: 'user', content: text.trim() }] }),
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
            const { text: chunk, error } = JSON.parse(payload)
            if (error) throw new Error(error as string)
            if (chunk) {
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
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
          m.id === assistantId ? { ...m, content: 'Something went wrong. Try again.' } : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming])

  return { messages, send, isStreaming }
}

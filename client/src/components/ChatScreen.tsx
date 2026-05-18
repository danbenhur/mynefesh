import { useEffect, useRef, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { getChatHistory } from '../lib/api'
import { T } from '../lib/theme'
import Icon from './Icon'
import type { Message } from '../types/chat'

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function SparkleAvatar({ size }: { size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: `linear-gradient(135deg, ${T.sage} 0%, ${T.blue} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      animation: 'sparkle 2.5s ease-in-out infinite',
    }}>
      <Icon name="sparkle" size={size * 0.5} color="#fff" strokeWidth={1.8} />
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: T.sage,
            animation: `typing 1.2s ${delay}s ease-in-out infinite`,
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  )
}

export default function ChatScreen() {
  const [dbMessages, setDbMessages] = useState<Message[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const { messages: liveMessages, send, isStreaming } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getChatHistory(50)
      .then(rows => {
        setDbMessages(rows.map(r => ({
          id: r.id,
          role: r.role as 'user' | 'assistant',
          content: r.content,
          timestamp: new Date(r.timestamp),
        })))
        setHistoryLoaded(true)
      })
      .catch(() => {
        setHistoryLoaded(true)
      })
  }, [])

  const allMessages = [...dbMessages, ...liveMessages]
  const showTyping = isStreaming && liveMessages.length > 0 && liveMessages[liveMessages.length - 1].content === ''

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages.length, showTyping])

  function handleSend() {
    if (!input.trim() || isStreaming) return
    send(input.trim())
    setInput('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
      {/* Header */}
      <div style={{
        padding: '52px 20px 16px',
        background: T.bg,
        borderBottom: `1px solid rgba(44,44,42,0.06)`,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <SparkleAvatar size={40} />
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: T.charcoal, lineHeight: 1 }}>Nefesh</p>
          <p style={{ fontSize: 11, color: T.sage, fontWeight: 500, marginTop: 3 }}>● תמיד כאן</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
        {!historyLoaded && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{
              width: 24, height: 24, border: `2px solid ${T.sage}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {historyLoaded && allMessages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', padding: '40px 24px', textAlign: 'center',
          }}>
            <SparkleAvatar size={56} />
            <p style={{ fontSize: 15, fontWeight: 600, color: T.charcoal, marginTop: 16, marginBottom: 6 }}>
              Nefesh
            </p>
            <p style={{ fontSize: 13, color: T.charcoalLight, lineHeight: 1.6 }}>
              Nefesh מוכן. התחל שיחה.
            </p>
          </div>
        )}

        {historyLoaded && allMessages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          const isLive = idx >= dbMessages.length
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: 8,
                marginBottom: 10,
                animation: isLive ? 'slide-up-chat 0.2s ease both' : undefined,
              }}
            >
              {!isUser && <SparkleAvatar size={28} />}
              <div style={{
                maxWidth: '72%',
                background: isUser ? T.bgCard : T.sageLight,
                borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                padding: '10px 14px',
                boxShadow: '0 1px 6px rgba(44,44,42,0.06)',
              }}>
                <p style={{
                  fontSize: 13.5, color: T.charcoal, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', margin: 0,
                }}>
                  {msg.content}
                </p>
                <p style={{ fontSize: 10, color: T.charcoalLight, textAlign: 'right', marginTop: 4 }}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          )
        })}

        {showTyping && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
            <SparkleAvatar size={28} />
            <div style={{
              background: T.sageLight,
              borderRadius: '4px 16px 16px 16px',
              padding: '10px 14px',
              boxShadow: '0 1px 6px rgba(44,44,42,0.06)',
            }}>
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 16 }} />
      </div>

      {/* Input row */}
      <div style={{
        flexShrink: 0,
        borderTop: `1px solid rgba(44,44,42,0.08)`,
        padding: '10px 16px 86px',
        background: T.bg,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: T.bgCard, borderRadius: 22, height: 44,
          border: '1px solid rgba(44,44,42,0.1)', padding: '0 16px',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Nefesh…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 14, color: T.charcoal, fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={isStreaming}
          style={{
            width: 44, height: 44, borderRadius: 12, border: 'none',
            background: T.sageLight, cursor: isStreaming ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, opacity: isStreaming ? 0.5 : 1,
          }}
        >
          {input.trim()
            ? <Icon name="send" size={18} color={T.sage} strokeWidth={1.8} />
            : <Icon name="mic" size={18} color={T.charcoalLight} strokeWidth={1.6} />
          }
        </button>
      </div>
    </div>
  )
}

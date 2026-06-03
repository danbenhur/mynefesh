import { useEffect, useRef, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { getChatHistory } from '../lib/api'
import { C } from '../lib/dashboardTheme'
import Icon from './Icon'
import type { Message } from '../types/chat'
import './dashboard/dashboard.css'

function formatTime(d: Date): string {
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function NefeshAvatar({ size }: { size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: `linear-gradient(135deg, ${C.bar} 0%, ${C.line} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      animation: 'sparkle 2.5s ease-in-out infinite',
    }}>
      <Icon name="sparkle" size={Math.round(size * 0.48)} color="#fff" strokeWidth={1.8} />
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: C.bar,
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
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
      .catch(() => setHistoryLoaded(true))
  }, [])

  const allMessages = [...dbMessages, ...liveMessages]

  const lastLive = liveMessages.length > 0 ? liveMessages[liveMessages.length - 1] : null
  const streamingMsgId = isStreaming && lastLive?.role === 'assistant' && lastLive.content !== ''
    ? lastLive.id
    : null
  const showTypingDots = isStreaming && lastLive?.role === 'assistant' && lastLive.content === ''

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages.length, showTypingDots])

  function handleSend() {
    if (!input.trim() || isStreaming) return
    send(input.trim())
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div className="mn-chat-screen" dir="rtl">

      {/* Header */}
      <div className="mn-chat-header">
        <NefeshAvatar size={38} />
        <div className="mn-chat-header-text">
          <span className="mn-chat-header-name">Nefesh</span>
          <span className="mn-chat-header-status">● תמיד כאן</span>
        </div>
      </div>

      {/* Messages — dir=ltr keeps assistant-left / user-right layout */}
      <div className="mn-chat-messages" dir="ltr">

        {!historyLoaded && (
          <div className="mn-chat-loading">
            <div style={{
              width: 22, height: 22,
              border: `2px solid ${C.bar}`, borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {historyLoaded && allMessages.length === 0 && !isStreaming && (
          <div className="mn-chat-empty">
            <NefeshAvatar size={52} />
            <p className="mn-chat-empty-title">שלום, דן</p>
            <p className="mn-chat-empty-body">
              שאל אותי כל דבר על חייך — אני מכיר את המטריות שלך, התשובות שלך, והתקדמות שלך.
            </p>
          </div>
        )}

        {historyLoaded && allMessages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          // Skip empty assistant placeholder — typing dots handle this state
          if (!isUser && msg.content === '') return null
          const isLive = idx >= dbMessages.length
          const isStreamTarget = msg.id === streamingMsgId
          return (
            <div
              key={msg.id}
              className={`mn-chat-bubble-wrap ${isUser ? 'user' : 'assistant'}`}
              style={{ animation: isLive ? 'slide-up-chat 0.2s ease both' : undefined }}
            >
              {!isUser && <NefeshAvatar size={26} />}
              <div className={`mn-chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                <p className="mn-chat-bubble-text">
                  {msg.content}
                  {isStreamTarget && <span className="mn-chat-cursor" />}
                </p>
                <p className="mn-chat-time">{formatTime(msg.timestamp)}</p>
              </div>
            </div>
          )
        })}

        {showTypingDots && (
          <div className="mn-chat-bubble-wrap assistant">
            <NefeshAvatar size={26} />
            <div className="mn-chat-bubble assistant">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 16 }} />
      </div>

      {/* Input bar — dir=ltr keeps send button on right */}
      <div className="mn-chat-input-bar" dir="ltr">
        <div className="mn-chat-input-pill">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="הודעה ל-Nefesh…"
            dir="rtl"
            rows={1}
            className="mn-chat-textarea"
          />
        </div>
        <button
          className={`mn-chat-send-btn${input.trim() ? ' active' : ''}`}
          onClick={handleSend}
          disabled={isStreaming}
          aria-label={input.trim() ? 'שלח' : 'קלט קולי'}
        >
          {input.trim()
            ? <Icon name="send" size={17} color="#fff" strokeWidth={1.8} />
            : <Icon name="mic" size={17} color={C.muted} strokeWidth={1.6} />
          }
        </button>
      </div>
    </div>
  )
}

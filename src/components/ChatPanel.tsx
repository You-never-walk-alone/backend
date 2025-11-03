"use client";
import React, { useEffect, useRef, useState } from 'react'
import { useWallet } from '@/contexts/WalletContext'
import { MessageSquare, Sparkles, Loader2, Smile } from 'lucide-react'

interface ChatPanelProps {
  eventId: number
}

interface ChatMessageView {
  id: string
  user_id: string
  content: string
  created_at: string
}

export default function ChatPanel({ eventId }: ChatPanelProps) {
  const { account, connectWallet, formatAddress } = useWallet()
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [showEmojis, setShowEmojis] = useState(false)

  const quickPrompts = [
    '这条预测的依据是什么？',
    '有没有最新进展？',
    '我认为概率更高的理由是…'
  ]

  useEffect(() => {
    const es = new EventSource(`/api/chat/stream?eventId=${eventId}`)
    const onMessages = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data)
        if (Array.isArray(data)) {
          setMessages(prev => {
            const merged = [...prev]
            for (const m of data) {
              if (!merged.find(x => x.id === m.id)) merged.push(m)
            }
            merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            return merged
          })
        }
      } catch (e) {}
    }
    es.addEventListener('messages', onMessages)
    es.onerror = () => {}
    return () => es.close()
  }, [eventId])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  const sendMessage = async () => {
    if (!input.trim()) return
    if (!account) {
      setError('请先连接钱包后再发送消息')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, content: input, walletAddress: account })
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t)
      }
      setInput('')
    } catch (e: any) {
      setError(e?.message || '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-3xl border border-purple-200/50 bg-white/60 backdrop-blur-xl shadow-lg overflow-hidden">
      {/* 顶部：渐变与状态 */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-7 h-7 bg-white/20 rounded-xl">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="font-semibold">即时交流</div>
          <Sparkles className="w-4 h-4 opacity-90" />
        </div>
        <div className="text-xs opacity-90">
          {account ? `你：${formatAddress(account)}` : '未连接钱包'}
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={listRef} className="h-72 overflow-y-auto p-4 space-y-3 bg-white/60">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm">暂无消息，快来开启讨论吧！</div>
        )}
        {messages.map((m, i) => {
          const mine = !!account && !!m.user_id && String(account).toLowerCase() === String(m.user_id).toLowerCase()
          const prev = i > 0 ? messages[i - 1] : null
          const dateChanged = prev && new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString()
          return (
            <React.Fragment key={m.id}>
              {dateChanged && (
                <div className="flex justify-center">
                  <span className="text-xs text-gray-500 bg-white/80 border border-gray-200 rounded-full px-3 py-1">
                    {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className={`flex items-end gap-3 ${mine ? 'justify-end' : ''}`}>
                {/* 头像 */}
                <div className={`${mine ? 'order-2' : ''} w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold`}> 
                  {formatAddress(m.user_id).slice(0,2)}
                </div>
                {/* 气泡 */}
                <div className={`${mine ? 'order-1' : ''} max-w-[80%]`}> 
                  <div className={`${mine 
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' 
                    : 'bg-white text-gray-800 border border-gray-200'} rounded-2xl px-3 py-2 shadow-sm`}> 
                    <div className="text-xs opacity-80 mb-1">
                      <span className="mr-2">{formatAddress(m.user_id)}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <div className="leading-relaxed break-words">{m.content}</div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* 输入区 */}
      <div className="p-3 border-t border-gray-100 bg-white relative">
        {!account ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">发送消息需连接钱包</div>
            <button onClick={() => connectWallet()} className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl text-sm">连接钱包</button>
          </div>
        ) : (
          <>
            {/* 快捷提示 */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInput(p)}
                  className="text-xs px-2 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"
                  rows={2}
                  className="w-full resize-none px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white/80"
                />
                {/* 表情选择 */}
                <div className="absolute right-2 bottom-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                    onClick={() => setShowEmojis(v => !v)}
                    aria-label="选择表情"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> : <Smile className="w-4 h-4 text-purple-600" />}
                  </button>
                </div>
                {showEmojis && (
                  <div className="absolute right-0 bottom-12 z-10 bg-white border border-gray-200 rounded-xl shadow p-2 grid grid-cols-6 gap-1">
                    {['🙂','🔥','🚀','💡','🎯','👏','📈','🤔','✅','❗','✨','📌'].map((emo) => (
                      <button
                        key={emo}
                        className="text-base px-1 py-1 hover:bg-gray-100 rounded"
                        type="button"
                        onClick={() => setInput(prev => prev + emo)}
                      >{emo}</button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={sendMessage} disabled={sending} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {sending ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />发送中…</span>
                ) : '发送'}
              </button>
            </div>
          </>
        )}
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>
    </div>
  )
}
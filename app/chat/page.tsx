'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  domain?: string
  timestamp: Date
}

const DOMAINS: Record<string, { icon: string; name: string; color: string; bg: string; border: string }> = {
  agriculture: { icon: '🌱', name: 'Agriculture AI', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  medical:     { icon: '🏥', name: 'Medical AI',     color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30' },
  legal:       { icon: '⚖️', name: 'Legal AI',       color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/30' },
  life:        { icon: '✨', name: 'Life Coach AI',  color: 'text-purple-400',bg: 'bg-purple-500/10',border: 'border-purple-500/30' },
  relationship:{ icon: '💞', name: 'Relationship AI',color: 'text-pink-400',  bg: 'bg-pink-500/10',  border: 'border-pink-500/30' },
  engineering: { icon: '⚙️', name: 'Engineering AI', color: 'text-orange-400',bg: 'bg-orange-500/10',border: 'border-orange-500/30' },
  general:     { icon: '🤖', name: 'GreenWeb AI',    color: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30' },
}

function getSuggestedQuestions(domain: string): string[] {
  const suggestions: Record<string, string[]> = {
    agriculture: ['How do I treat fungal disease in wheat crops?', 'Best irrigation for tomatoes?', 'Organic aphid control', 'Soil pH for corn growth'],
    medical: ['Symptoms of high blood pressure?', 'Managing type 2 diabetes naturally?', 'Foods for immune support', 'Vitamin D deficiency signs'],
    legal: ['My rights as a tenant?', 'How to review a job contract?', 'Steps for small claims court', 'What is wrongful termination?'],
    life: ['How to build better habits?', 'Morning routines for productivity', 'Overcome procrastination?', 'Setting SMART goals'],
    relationship: ['Improve communication with partner?', 'Dealing with difficult family?', 'Rebuild trust after conflict?', 'Healthy relationship boundaries'],
    engineering: ['Design a REST API for a social app', 'Optimize database queries?', 'Explain microservices', 'React performance best practices'],
    general: ['What can you help me with?', 'Tell me about your capabilities', 'How does AI work?', 'Latest tech trends?'],
  }
  return suggestions[domain] || suggestions.general
}

function formatMessage(content: string): string {
  return content
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
}

function ChatContent() {
  const searchParams = useSearchParams()
  const domainKey = searchParams.get('domain') || 'general'
  const initialQ = searchParams.get('q') || ''
  const domainInfo = DOMAINS[domainKey] || DOMAINS.general

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState(initialQ)
  const [loading, setLoading] = useState(false)
  const [activeDomain, setActiveDomain] = useState(domainKey)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasInitialized = useRef(false)
  const activeDomainInfo = DOMAINS[activeDomain] || DOMAINS.general

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (initialQ && !hasInitialized.current) {
      hasInitialized.current = true
      setTimeout(() => handleSend(initialQ), 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = async (text?: string) => {
    const messageText = (text || input).trim()
    if (!messageText || loading) return
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: messageText, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })), domain: activeDomain }),
      })
      if (!response.ok) throw new Error('API Error')
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', domain: activeDomain, timestamp: new Date() }
      setMessages(prev => [...prev, assistantMsg])
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content || ''
                if (delta) setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m))
              } catch {}
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: '⚠️ Error: Please add your AI API key (OPENAI_API_KEY) to Railway environment variables and redeploy.', timestamp: new Date() }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <div className="flex h-screen bg-[#080B0F] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-64 border-r border-white/5 bg-black/20">
        <div className="p-4 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">🌿</div>
            <span className="font-black text-sm">GreenWeb <span className="text-green-400">AI</span></span>
          </Link>
        </div>
        <div className="p-3 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 px-2">AI Experts</p>
          <div className="space-y-1">
            {Object.entries(DOMAINS).map(([key, info]) => (
              <button key={key} onClick={() => setActiveDomain(key)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                  activeDomain === key ? info.bg + ' ' + info.border + ' border text-white font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/5'
                ].join(' ')}>
                <span className="text-lg">{info.icon}</span>
                <span>{info.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 border-t border-white/5">
          <button onClick={() => setMessages([])} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 hover:text-white transition-all">
            + New Chat
          </button>
        </div>
      </div>
      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between bg-black/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{activeDomainInfo.icon}</span>
            <div>
              <h1 className={"font-bold text-base " + activeDomainInfo.color}>{activeDomainInfo.name}</h1>
              <p className="text-xs text-gray-500">Specialized AI Expert</p>
            </div>
          </div>
          <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">← Home</Link>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-6xl mb-4">{activeDomainInfo.icon}</div>
              <h2 className={"text-2xl font-black mb-2 " + activeDomainInfo.color}>{activeDomainInfo.name}</h2>
              <p className="text-gray-500 text-sm max-w-md mb-8">Ask me anything — I'm your specialized AI expert.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                {getSuggestedQuestions(activeDomain).map((q, i) => (
                  <button key={i} onClick={() => handleSend(q)} className={activeDomainInfo.bg + ' border ' + activeDomainInfo.border + ' text-gray-300 hover:text-white text-sm px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.02]'}>
                    💬 {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={'chat-message flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm mr-3 flex-shrink-0 mt-1">{activeDomainInfo.icon}</div>}
              <div className={'max-w-2xl rounded-2xl px-4 py-3 ' + (m.role === 'user' ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white' : 'bg-white/5 border border-white/8 text-gray-100')}>
                {m.role === 'assistant'
                  ? <div className="ai-response text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatMessage(m.content) }} />
                  : <p className="text-sm leading-relaxed">{m.content}</p>
                }
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-sm mr-3">{activeDomainInfo.icon}</div>
              <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                {[0,1,2].map(i => <span key={i} className="typing-dot w-2 h-2 rounded-full bg-green-400 block" />)}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t border-white/5 p-4 bg-black/10">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3 bg-white/5 border border-white/10 focus-within:border-green-500/40 rounded-2xl p-3 transition-colors">
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={'Ask ' + activeDomainInfo.name + ' anything...'}
                className="flex-1 bg-transparent outline-none text-white placeholder-gray-600 text-sm resize-none max-h-32" rows={1}
              />
              <button onClick={() => handleSend()} disabled={!input.trim() || loading}
                className={!input.trim() || loading ? 'p-2.5 rounded-xl bg-white/5 text-gray-600 cursor-not-allowed' : 'p-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-lg'}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
            <p className="text-xs text-gray-700 text-center mt-2">Enter to send · Shift+Enter for new line · For informational purposes only</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return <Suspense fallback={<div className="h-screen bg-[#080B0F] flex items-center justify-center text-white">Loading...</div>}><ChatContent /></Suspense>
              }

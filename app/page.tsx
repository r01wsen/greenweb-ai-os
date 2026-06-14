'use client'
import { useState } from 'react'
import Link from 'next/link'

const domains = [
  {
    id: 'agriculture',
    icon: '🌱',
    title: 'Agriculture AI',
    subtitle: 'Smart Farming Expert',
    desc: 'Crop planning, soil analysis, pest control, irrigation management, yield optimization & sustainable farming guidance.',
    color: 'from-green-500 to-emerald-600',
    glow: 'shadow-green-500/20',
    border: 'hover:border-green-500/50',
    badge: 'Farming',
    examples: ['How to treat wheat rust?', 'Best crops for clay soil?', 'Organic pest control methods'],
  },
  {
    id: 'medical',
    icon: '🏥',
    title: 'Medical AI',
    subtitle: 'Health & Wellness Advisor',
    desc: 'Symptom analysis, health guidance, medication information, nutrition planning & preventive care recommendations.',
    color: 'from-red-500 to-rose-600',
    glow: 'shadow-red-500/20',
    border: 'hover:border-red-500/50',
    badge: 'Health',
    examples: ['Symptoms of high blood pressure?', 'Diabetes management tips', 'Natural remedies for insomnia'],
  },
  {
    id: 'legal',
    icon: '⚖️',
    title: 'Legal AI',
    subtitle: 'Legal Research Assistant',
    desc: 'Contract analysis, legal research, rights guidance, document drafting & navigating complex legal situations.',
    color: 'from-blue-500 to-indigo-600',
    glow: 'shadow-blue-500/20',
    border: 'hover:border-blue-500/50',
    badge: 'Law',
    examples: ['Is my rental contract valid?', 'Employee rights explained', 'How to file a complaint?'],
  },
  {
    id: 'life',
    icon: '✨',
    title: 'Life Coach AI',
    subtitle: 'Personal Development Guide',
    desc: 'Goal setting, productivity systems, mindfulness practices, career planning & building healthy life habits.',
    color: 'from-purple-500 to-violet-600',
    glow: 'shadow-purple-500/20',
    border: 'hover:border-purple-500/50',
    badge: 'Lifestyle',
    examples: ['How to build better habits?', 'Morning routine ideas', 'Overcome procrastination'],
  },
  {
    id: 'relationship',
    icon: '💞',
    title: 'Relationship AI',
    subtitle: 'Emotional Intelligence Coach',
    desc: 'Communication skills, conflict resolution, dating advice, family dynamics & building meaningful connections.',
    color: 'from-pink-500 to-rose-500',
    glow: 'shadow-pink-500/20',
    border: 'hover:border-pink-500/50',
    badge: 'Social',
    examples: ['How to improve communication?', 'Dealing with a difficult family member', 'Building trust in relationships'],
  },
  {
    id: 'engineering',
    icon: '⚙️',
    title: 'Engineering AI',
    subtitle: 'Technical Problem Solver',
    desc: 'Code generation, system architecture, debugging, technical design patterns & solving complex engineering challenges.',
    color: 'from-orange-500 to-amber-600',
    glow: 'shadow-orange-500/20',
    border: 'hover:border-orange-500/50',
    badge: 'Tech',
    examples: ['Design a REST API for my app', 'Debug this Python error', 'Best database for my project?'],
  },
]

export default function Home() {
  const [query, setQuery] = useState('')
  const [activeDomain, setActiveDomain] = useState<string | null>(null)

  const handleAsk = (q?: string) => {
    const text = q || query
    if (!text.trim()) return
    const domain = activeDomain || 'general'
    window.location.href = `/chat?domain=${domain}&q=${encodeURIComponent(text)}`
  }

  return (
    <main className="min-h-screen bg-[#080B0F] text-white overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-lg shadow-lg shadow-green-500/30">
              🌿
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-white">GreenWeb</span>
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent"> AI OS</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <Link href="/chat" className="hover:text-white transition-colors">Chat</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
          </div>
          <Link
            href="/chat"
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-green-900/40 hover:shadow-green-900/60 hover:-translate-y-0.5"
          >
            Launch AI →
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-4 py-2 rounded-full mb-8 tracking-wide">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          MULTI-DOMAIN AI INTELLIGENCE SYSTEM
        </div>

        <h1 className="text-6xl md:text-8xl font-black mb-6 leading-[0.9] tracking-tighter">
          <span className="text-white">Your AI</span>
          <br />
          <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
            Superpower
          </span>
        </h1>

        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Six specialized AI experts in one platform. Agriculture, Medicine, Law, Life Coaching,
          Relationships, and Engineering — all powered by advanced AI intelligence.
        </p>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-6">
          <div className="relative flex items-center bg-white/5 border border-white/10 hover:border-green-500/40 focus-within:border-green-500/60 rounded-2xl p-1.5 transition-all shadow-2xl">
            <div className="flex items-center gap-3 px-4 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              className="flex-1 bg-transparent outline-none text-white placeholder-gray-500 text-base py-3 pr-4"
              placeholder="Ask anything... crop disease, legal rights, medical symptoms..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
            />
            <button
              onClick={() => handleAsk()}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold px-6 py-3 rounded-xl transition-all text-sm whitespace-nowrap"
            >
              Ask AI ✦
            </button>
          </div>

          {/* Quick suggestions */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['Treat wheat fungal disease?', 'Is my contract valid?', 'High BP symptoms?', 'Improve my relationship?', 'Build a REST API'].map(s => (
              <button
                key={s}
                onClick={() => handleAsk(s)}
                className="text-xs text-gray-500 hover:text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-full transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Domain Cards */}
      <section className="relative max-w-7xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black mb-3 text-white">Choose Your Expert AI</h2>
          <p className="text-gray-500">Click a domain to start a specialized conversation</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {domains.map(domain => (
            <Link
              key={domain.id}
              href={`/chat?domain=${domain.id}`}
              className={`group relative bg-white/3 border border-white/8 ${domain.border} rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${domain.glow} overflow-hidden cursor-pointer`}
            >
              {/* Card glow */}
              <div className={`absolute inset-0 bg-gradient-to-br ${domain.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500 rounded-2xl`} />

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{domain.icon}</div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg bg-gradient-to-r ${domain.color} text-white opacity-80`}>
                  {domain.badge}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-black text-white mb-0.5 group-hover:text-green-300 transition-colors">
                {domain.title}
              </h3>
              <p className="text-xs font-medium text-gray-500 mb-3">{domain.subtitle}</p>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">{domain.desc}</p>

              {/* Example questions */}
              <div className="space-y-1.5 mb-5">
                {domain.examples.slice(0, 2).map(ex => (
                  <div key={ex} className="text-xs text-gray-600 bg-white/3 rounded-lg px-3 py-1.5 truncate">
                    💬 {ex}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className={`flex items-center gap-2 text-sm font-semibold bg-gradient-to-r ${domain.color} bg-clip-text text-transparent`}>
                Start chatting
                <span className="group-hover:translate-x-1 transition-transform inline-block text-gray-400 group-hover:text-green-400">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-t border-white/5 bg-white/2 py-14 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { v: '6', l: 'AI Expert Domains', icon: '🧠' },
            { v: '∞', l: 'Knowledge Base', icon: '📚' },
            { v: '24/7', l: 'Always Available', icon: '⚡' },
            { v: '100%', l: 'Free to Start', icon: '🎯' },
          ].map(({ v, l, icon }) => (
            <div key={l} className="group">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-4xl font-black bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent mb-1">
                {v}
              </div>
              <div className="text-gray-500 text-sm">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black mb-3">How GreenWeb AI Works</h2>
          <p className="text-gray-500">Intelligent, specialized, and always available</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Choose Your Domain', desc: 'Select from 6 specialized AI experts or ask anything in general mode', icon: '🎯' },
            { step: '02', title: 'Ask Your Question', desc: 'Type your question naturally — the AI understands context and nuance', icon: '💬' },
            { step: '03', title: 'Get Expert Answers', desc: 'Receive detailed, actionable intelligence tailored to your specific need', icon: '✅' },
          ].map(item => (
            <div key={item.step} className="relative bg-white/3 border border-white/8 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">{item.icon}</div>
              <div className="text-xs font-black text-green-400 mb-3 tracking-widest">{item.step}</div>
              <h3 className="text-lg font-black text-white mb-3">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-6 pb-20 text-center">
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/20 rounded-3xl p-12">
          <h2 className="text-4xl font-black mb-4">Ready to get started?</h2>
          <p className="text-gray-400 mb-8 text-lg">Access all 6 AI experts instantly. No signup required.</p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-lg font-black px-10 py-4 rounded-2xl transition-all shadow-2xl shadow-green-900/50 hover:-translate-y-1"
          >
            🚀 Launch GreenWeb AI
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-xl">🌿</span>
          <span className="font-black text-gray-300">GreenWeb AI OS</span>
        </div>
        <p className="text-gray-600 text-sm">Multi-domain AI intelligence platform. For informational purposes only — not a substitute for professional advice.</p>
        <div className="flex justify-center gap-6 mt-4 text-xs text-gray-600">
          <Link href="/chat?domain=agriculture" className="hover:text-gray-400 transition-colors">Agriculture</Link>
          <Link href="/chat?domain=medical" className="hover:text-gray-400 transition-colors">Medical</Link>
          <Link href="/chat?domain=legal" className="hover:text-gray-400 transition-colors">Legal</Link>
          <Link href="/chat?domain=life" className="hover:text-gray-400 transition-colors">Life Coach</Link>
          <Link href="/chat?domain=relationship" className="hover:text-gray-400 transition-colors">Relationships</Link>
          <Link href="/chat?domain=engineering" className="hover:text-gray-400 transition-colors">Engineering</Link>
        </div>
      </footer>
    </main>
  )
}

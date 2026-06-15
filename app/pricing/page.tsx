'use client'

import { useState } from 'react'
import Link from 'next/link'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    color: 'border-gray-700',
    badge: null,
    description: 'Perfect for small family farms and pilot programs.',
    features: [
      'Up to 3 farm locations',
      'Up to 50 IoT sensors',
      'Up to 5 robots in fleet',
      'Basic sensor dashboards',
      'Crop batch calendar',
      'Automation rules (IF-THEN)',
      'Customer buyer portal',
      'Email support',
    ],
    notIncluded: ['AI Vision crop diagnosis', 'Generative PDF reports', 'Video consultations', 'White-label'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149,
    color: 'border-green-600',
    badge: 'Most Popular',
    description: 'For growing agribusinesses with multiple farms.',
    features: [
      'Up to 10 farm locations',
      'Up to 200 IoT sensors',
      'Up to 20 robots in fleet',
      'AI Vision crop disease diagnosis',
      'Generative PDF reports',
      'Monthly + investor briefings',
      'Video consultations (Whereby/Twilio)',
      'Voice field commander',
      'n8n automation orchestration',
      'Crop digital twin timelines',
      'Priority support (24h response)',
    ],
    notIncluded: ['White-label', 'Custom AI models'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    color: 'border-purple-600',
    badge: 'Full Power',
    description: 'For large agribusiness enterprises and cooperatives.',
    features: [
      'Unlimited farm locations',
      'Unlimited sensors',
      'Unlimited robot fleet',
      'All Professional features',
      'Custom AI model fine-tuning',
      'Dedicated n8n instance',
      'White-label ready',
      'Multi-organization management',
      'Custom SLA guarantee',
      'Dedicated account manager',
      'On-premise deployment option',
    ],
    notIncluded: [],
  },
]

async function handleSubscribe(tier: string) {
  const response = await fetch('/api/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_checkout', tier }),
  })
  const data = await response.json() as { checkout_url?: string; error?: string }
  if (data.checkout_url) {
    window.location.href = data.checkout_url
  } else {
    alert(data.error ?? 'Failed to start checkout. Please try again.')
  }
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [annual, setAnnual] = useState(false)

  async function subscribe(tier: string) {
    setLoading(tier)
    try {
      await handleSubscribe(tier)
    } finally {
      setLoading(null)
    }
  }

  const discount = annual ? 0.8 : 1

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <span className="font-bold text-white">AgriSphere</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Log In</Link>
            <Link href="/signup" className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-screen-xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-green-900/30 border border-green-800 text-green-300 text-xs px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          14-day free trial on all plans
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          Farm Intelligence That Pays<br className="hidden sm:block" /> For Itself
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          From single-farm automation to enterprise-scale agribusiness management.
          Real IoT data, real AI decisions, real results.
        </p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-full p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!annual ? 'bg-green-600 text-white' : 'text-gray-400'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${annual ? 'bg-green-600 text-white' : 'text-gray-400'}`}
          >
            Annual
            <span className="ml-1.5 text-xs bg-green-700 text-green-200 px-1.5 py-0.5 rounded-full">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-screen-xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 ${plan.color} bg-gray-900 p-8 flex flex-col`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${plan.id === 'professional' ? 'bg-green-600 text-white' : 'bg-purple-600 text-white'}`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-400">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">
                    ${Math.round(plan.price * discount)}
                  </span>
                  <span className="text-gray-400 mb-1">/mo</span>
                </div>
                {annual && (
                  <p className="text-xs text-green-400 mt-1">
                    Billed ${Math.round(plan.price * discount * 12)}/year (save ${Math.round(plan.price * 12 * 0.2)})
                  </p>
                )}
              </div>

              <button
                onClick={() => subscribe(plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all mb-8
                  ${plan.id === 'professional'
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : plan.id === 'enterprise'
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'
                  }
                  ${loading === plan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading === plan.id ? 'Loading...' : plan.id === 'enterprise' ? 'Contact Sales' : 'Start Free Trial'}
              </button>

              <div className="space-y-3 flex-1">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <span className="text-green-400 text-sm mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-sm text-gray-300">{f}</span>
                  </div>
                ))}
                {plan.notIncluded.map((f) => (
                  <div key={f} className="flex items-start gap-2 opacity-40">
                    <span className="text-gray-600 text-sm mt-0.5 flex-shrink-0">✗</span>
                    <span className="text-sm text-gray-500">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Features Breakdown */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-center text-white mb-3">Everything You Need to Run a Smart Farm</h2>
          <p className="text-center text-gray-400 mb-12">Every plan includes the full AgriSphere platform foundation.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {[
              { icon: '📡', title: 'Real-time IoT', desc: 'MQTT/WiFi sensor arrays with live telemetry dashboards' },
              { icon: '🤖', title: 'Robot Fleet', desc: 'GPS-tracked autonomous drones and ground rovers' },
              { icon: '🎙️', title: 'Voice Commands', desc: 'Hands-free field logging with Whisper AI' },
              { icon: '🌿', title: 'Crop Lifecycle', desc: 'Template-driven calendar with auto-populated milestones' },
              { icon: '⚙️', title: 'IF-THEN Automation', desc: 'Threshold triggers for irrigation, fertigation, alerts' },
              { icon: '🔍', title: 'AI Vision', desc: 'GPT-4o / Claude crop disease and pest diagnostics' },
              { icon: '📊', title: 'Smart Reports', desc: 'Generative investor briefings and sustainability scores' },
              { icon: '🛒', title: 'Buyer Portal', desc: 'Customer transparency, orders, invoicing, QR traceability' },
              { icon: '🔒', title: 'Enterprise Security', desc: 'Row-Level Security, multi-tenant data isolation' },
              { icon: '📞', title: 'Video Consult', desc: 'Live P2P sessions between operators and agronomists' },
              { icon: '💳', title: 'Billing Built-in', desc: 'Stripe-powered SaaS subscriptions with auto-tier upgrades' },
              { icon: '🌍', title: 'Multi-tenant', desc: 'Unlimited organizations, each fully isolated' },
            ].map((item) => (
              <div key={item.title} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-green-800 transition-colors">
                <span className="text-2xl mb-3 block">{item.icon}</span>
                <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-10">Common Questions</h2>
          <div className="space-y-4">
            {[
              { q: 'Can I try before paying?', a: 'Yes — every plan comes with a 14-day free trial. No credit card required to start.' },
              { q: 'What hardware is supported?', a: 'AgriSphere works with ESP32, Raspberry Pi, and any MQTT/WiFi-capable sensor. We provide firmware templates for quick setup.' },
              { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. Plan changes take effect immediately via Stripe. Downgrades take effect at the next billing cycle.' },
              { q: 'Is my farm data private?', a: 'Completely. PostgreSQL Row-Level Security ensures your data is isolated from all other tenants at the database level.' },
              { q: 'Do I need technical skills to set up?', a: 'Basic setup (sensors, farm creation) requires no code. Advanced automation rules and n8n workflows may need technical knowledge.' },
              { q: 'Can I white-label for my clients?', a: 'Yes on Enterprise. We provide full white-label support including custom domains and brand theming.' },
            ].map((item) => (
              <div key={item.q} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-2">{item.q}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 bg-gradient-to-r from-green-950 to-emerald-950 border border-green-800 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Ready to Automate Your Farm?</h2>
          <p className="text-gray-400 mb-8">Join farms worldwide already saving 30%+ on labor and resource costs.</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-8 py-4 rounded-xl text-sm transition-colors"
          >
            Start Your Free 14-Day Trial
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <p className="text-xs text-gray-600 mt-3">No credit card required · Cancel anytime</p>
        </div>
      </div>
    </div>
  )
}

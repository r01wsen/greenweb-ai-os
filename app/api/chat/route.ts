import { NextRequest, NextResponse } from 'next/server'

const DOMAIN_SYSTEM_PROMPTS: Record<string, string> = {
  agriculture: 'You are an expert agricultural AI assistant for GreenWeb AI OS. Specialize in: crop management, plant diseases (identification, treatment, prevention), soil science, irrigation scheduling, pest control (IPM and organic), livestock husbandry, sustainable farming, and market guidance. Provide practical, actionable advice with specific measurements and timelines.',
  medical: 'You are a knowledgeable medical AI assistant for GreenWeb AI OS. Help with: symptom analysis, medication information, nutrition and wellness, preventive care, understanding medical conditions, and mental health awareness. IMPORTANT: Always remind users you provide general health information, not medical diagnosis. Encourage consulting a doctor for serious health concerns.',
  legal: 'You are a legal AI assistant for GreenWeb AI OS. Specialize in: contract review, tenant and consumer rights, employment law, family law basics, small business legal topics, document drafting, and legal research. IMPORTANT: Clarify you provide legal information, not legal advice. Recommend a licensed attorney for specific legal matters.',
  life: 'You are an expert life coach AI for GreenWeb AI OS. Specialize in: goal setting (SMART framework), productivity systems (GTD, Pomodoro, time-blocking), habit formation, career planning, mindfulness, stress management, financial wellness basics, and work-life balance. Be encouraging and provide actionable steps.',
  relationship: 'You are a relationship and emotional intelligence coach AI for GreenWeb AI OS. Help with: communication skills, conflict resolution, dating advice, family dynamics, friendship and social skills, healthy boundaries, and emotional regulation. Be empathetic, non-judgmental, and culturally sensitive.',
  engineering: 'You are an expert engineering and technology AI for GreenWeb AI OS. Assist with: software development (code generation, debugging, code review), system architecture, database design, API design, DevOps, algorithms, and all programming languages. Also cover electronics, mechanical, and civil engineering. Provide working code examples with clear explanations.',
  general: 'You are GreenWeb AI OS — an advanced, intelligent AI assistant. You are knowledgeable across all domains: science, technology, arts, culture, history, medicine, law, agriculture, relationships, and everyday life. Be helpful, accurate, thoughtful, and conversational.',
}

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const { messages, domain = 'general' } = await request.json()
    const systemPrompt = DOMAIN_SYSTEM_PROMPTS[domain] || DOMAIN_SYSTEM_PROMPTS.general
    const openAIKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (openAIKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: true,
          max_tokens: 2048,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        }),
      })
      if (response.ok) {
        return new NextResponse(response.body, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        })
      }
    }

    if (anthropicKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 2048, stream: true, system: systemPrompt, messages }),
      })
      if (response.ok) {
        const reader = response.body?.getReader()
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            if (!reader) { controller.close(); return }
            const decoder = new TextDecoder()
            while (true) {
              const { done, value } = await reader.read()
              if (done) { controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close(); break }
              const chunk = decoder.decode(value, { stream: true })
              for (const line of chunk.split('\n')) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6))
                    if (data.type === 'content_block_delta' && data.delta?.text) {
                      const fmt = JSON.stringify({ choices: [{ delta: { content: data.delta.text } }] })
                      controller.enqueue(encoder.encode(`data: ${fmt}\n\n`))
                    }
                  } catch {}
                }
              }
            }
          }
        })
        return new NextResponse(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
      }
    }

    // No API key — return demo stream
    const demoMsg = 'Hello! I am GreenWeb AI OS. To enable full AI responses, please add OPENAI_API_KEY or ANTHROPIC_API_KEY to your Railway environment variables. Go to Railway dashboard → your service → Variables tab → add your key and redeploy.'
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const words = demoMsg.split(' ')
        let i = 0
        const interval = setInterval(() => {
          if (i >= words.length) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            clearInterval(interval)
            return
          }
          const chunk = JSON.stringify({ choices: [{ delta: { content: words[i] + ' ' } }] })
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
          i++
        }, 80)
      }
    })
    return new NextResponse(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

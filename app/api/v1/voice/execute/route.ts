import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data with audio field' }, { status: 400 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const farmId = formData.get('farm_id')?.toString() ?? ''

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    const openAIKey = process.env.OPENAI_API_KEY

    if (!openAIKey) {
      // Graceful fallback when no key configured
      return NextResponse.json({
        transcript: '',
        error: 'OPENAI_API_KEY not configured. Set it in your environment to enable voice transcription.',
        fallback: true,
      }, { status: 200 })
    }

    // Build multipart request for OpenAI Whisper
    const whisperForm = new FormData()
    whisperForm.append('file', audioFile, 'recording.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'en')
    whisperForm.append('response_format', 'verbose_json')
    whisperForm.append('temperature', '0.2')
    // Prompt helps Whisper understand domain-specific vocabulary
    whisperForm.append(
      'prompt',
      'AgriSphere farm management commands: irrigation, valve, zone, fertilizer, NPK, harvest, liters, kilograms, robot, drone, soil moisture, pH, EC, fertigation, scouting, pest, fungicide.'
    )

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAIKey}` },
      body: whisperForm,
    })

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text()
      console.error('[Voice API] Whisper error:', errText)
      return NextResponse.json({ error: `Transcription failed: ${errText}` }, { status: 500 })
    }

    const whisperData = await whisperResponse.json() as {
      text: string
      language?: string
      duration?: number
      segments?: Array<{ text: string; confidence: number }>
    }

    const transcript = whisperData.text?.trim() ?? ''
    const avgConfidence = whisperData.segments
      ? whisperData.segments.reduce((sum, s) => sum + (s.confidence ?? 0), 0) / whisperData.segments.length
      : null

    return NextResponse.json({
      transcript,
      language: whisperData.language,
      duration_seconds: whisperData.duration,
      confidence: avgConfidence,
      farm_id: farmId,
    })
  } catch (error) {
    console.error('[Voice API] Unhandled error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

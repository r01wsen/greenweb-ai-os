import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { user, supabase }
}

// ─── Vision Analysis: Crop Disease / Pest Severity ───────────────────────────

async function analyzeCropImage(
  imageBase64: string,
  mimeType: string,
  farmId: string,
  zone: string,
  cropName?: string
) {
  const openAIKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const systemPrompt = `You are an expert agricultural plant pathologist and agronomist AI.
Analyze crop images for disease, pest damage, nutrient deficiencies, and environmental stress.

Return a JSON object with this exact schema:
{
  "diagnosis": "string — primary diagnosis (e.g., 'Late Blight (Phytophthora infestans)')",
  "confidence": number — 0.0 to 1.0,
  "severity": "none" | "mild" | "moderate" | "severe" | "critical",
  "severity_pct": number — 0 to 100 estimated affected area,
  "category": "disease" | "pest" | "nutrient_deficiency" | "abiotic_stress" | "healthy",
  "symptoms_observed": string[] — list of visible symptoms,
  "affected_plant_parts": string[] — e.g. ["leaves", "stems"],
  "recommended_actions": string[] — specific, actionable steps in order of priority,
  "urgency": "monitor" | "treat_within_week" | "treat_within_48h" | "treat_immediately",
  "chemical_options": string[] — optional pesticide/fungicide names if applicable,
  "organic_options": string[] — organic/IPM alternatives,
  "follow_up_days": number — when to scout again,
  "additional_notes": string
}`

  const userPrompt = `Analyze this crop image.
Farm ID: ${farmId}
Zone: ${zone}
${cropName ? `Crop: ${cropName}` : ''}
Provide comprehensive diagnosis.`

  if (openAIKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
            ],
          },
        ],
      }),
    })
    if (response.ok) {
      const data = await response.json() as { choices: Array<{ message: { content: string } }> }
      return JSON.parse(data.choices[0].message.content)
    }
  }

  if (anthropicKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: userPrompt },
          ],
        }],
      }),
    })
    if (response.ok) {
      const data = await response.json() as { content: Array<{ text: string }> }
      const text = data.content[0].text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) return JSON.parse(jsonMatch[0])
    }
  }

  throw new Error('No AI model available for vision analysis.')
}

// ─── Generative Report Builder ────────────────────────────────────────────────

async function generateAgriReport(params: {
  farmId: string
  reportType: 'monthly_summary' | 'crop_lifecycle' | 'desertification_projection' | 'investor_briefing' | 'pest_severity_map'
  farmData: Record<string, unknown>
  dateRange?: { from: string; to: string }
}) {
  const openAIKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const REPORT_PROMPTS: Record<string, string> = {
    monthly_summary: `Generate a comprehensive monthly farm operations report. Include executive summary, sensor trends, crop progress, resource consumption (water, fertilizer), robot utilization, anomalies detected, and recommended next-month priorities. Format with clear sections.`,
    crop_lifecycle: `Generate a detailed crop lifecycle timeline report. Map each growth stage with expected vs actual sensor readings, activity completion rates, yield projections, and risk flags. Include a Gantt-style text timeline.`,
    desertification_projection: `Analyze soil health trends and generate a 12-month desertification risk projection. Include soil moisture trend analysis, EC drift patterns, organic matter depletion risk, and concrete regenerative agriculture interventions.`,
    investor_briefing: `Generate an investor-grade farm performance briefing. Include: production yields vs projections, ROI per crop batch, technology utilization (IoT/robotics), water efficiency ratios, ESG metrics, and 6-month revenue outlook with confidence intervals.`,
    pest_severity_map: `Generate a pest and disease severity report for the farm. Map observed incidents by zone and crop type, calculate economic damage thresholds, rank risk zones, and prescribe an integrated pest management (IPM) calendar.`,
  }

  const systemPrompt = `You are a senior agricultural data scientist generating professional farm intelligence reports.
Use the provided farm data to generate accurate, data-driven insights. 
Format reports in clean Markdown with headers, bullet points, and data tables where appropriate.
Always include specific numbers from the data provided. Never hallucinate metrics.`

  const userPrompt = `${REPORT_PROMPTS[params.reportType]}

Farm Data:
${JSON.stringify(params.farmData, null, 2)}
${params.dateRange ? `Date Range: ${params.dateRange.from} to ${params.dateRange.to}` : ''}`

  if (openAIKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    if (response.ok) {
      const data = await response.json() as { choices: Array<{ message: { content: string } }> }
      return data.choices[0].message.content
    }
  }

  if (anthropicKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (response.ok) {
      const data = await response.json() as { content: Array<{ text: string }> }
      return data.content[0].text
    }
  }

  throw new Error('No AI model available for report generation.')
}

// ─── Video/RTC Session Invites ────────────────────────────────────────────────

async function createVideoSession(params: {
  farmId: string
  hostId: string
  participantEmail: string
  sessionType: 'agronomist_consult' | 'pest_review' | 'investor_tour' | 'team_standup'
  scheduledAt?: string
}) {
  const wherebyKey = process.env.WHEREBY_API_KEY
  const twilioSid = process.env.TWILIO_ACCOUNT_SID
  const twilioToken = process.env.TWILIO_AUTH_TOKEN

  if (wherebyKey) {
    const endDate = new Date()
    endDate.setHours(endDate.getHours() + 4)

    const response = await fetch('https://api.whereby.dev/v1/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wherebyKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endDate: endDate.toISOString(),
        fields: ['hostRoomUrl'],
        roomNamePrefix: `agrisphere-${params.farmId.slice(0, 8)}`,
        roomMode: 'normal',
      }),
    })

    if (response.ok) {
      const data = await response.json() as { meetingId: string; roomUrl: string; hostRoomUrl: string }
      return {
        provider: 'whereby',
        meetingId: data.meetingId,
        guestUrl: data.roomUrl,
        hostUrl: data.hostRoomUrl,
        expiresAt: endDate.toISOString(),
      }
    }
  }

  if (twilioSid && twilioToken) {
    const roomName = `agrisphere-${params.farmId.slice(0, 8)}-${Date.now()}`
    const response = await fetch(`https://video.twilio.com/v1/Rooms`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ UniqueName: roomName, Type: 'group' }).toString(),
    })

    if (response.ok) {
      const data = await response.json() as { sid: string }
      return {
        provider: 'twilio',
        meetingId: data.sid,
        roomName,
        guestUrl: `/video/join/${data.sid}`,
        hostUrl: `/video/host/${data.sid}`,
        expiresAt: new Date(Date.now() + 4 * 3600000).toISOString(),
      }
    }
  }

  // Fallback: return a placeholder invite
  const sessionId = crypto.randomUUID()
  return {
    provider: 'internal',
    meetingId: sessionId,
    guestUrl: `/video/join/${sessionId}`,
    hostUrl: `/video/host/${sessionId}`,
    expiresAt: new Date(Date.now() + 4 * 3600000).toISOString(),
    warning: 'No video provider configured. Set WHEREBY_API_KEY or TWILIO credentials.',
  }
}

// ─── Main Route Handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') ?? ''

    // ── Multipart: vision analysis ──
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const mode = formData.get('mode')?.toString() ?? 'vision'

      if (mode === 'vision') {
        const file = formData.get('image') as File | null
        if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

        const farmId = formData.get('farm_id')?.toString() ?? ''
        const zone = formData.get('zone')?.toString() ?? 'unknown'
        const cropName = formData.get('crop_name')?.toString()

        const arrayBuffer = await file.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const mimeType = file.type || 'image/jpeg'

        const analysis = await analyzeCropImage(base64, mimeType, farmId, zone, cropName)

        // Store analysis result in Supabase
        await supabase.from('vision_analyses').insert({
          farm_id: farmId,
          zone,
          crop_name: cropName ?? null,
          analysis_result: analysis,
          confidence: analysis.confidence,
          severity: analysis.severity,
          analyzed_by: user.id,
        })

        return NextResponse.json({ success: true, analysis })
      }

      return NextResponse.json({ error: 'Unknown multipart mode' }, { status: 400 })
    }

    // ── JSON: report generation or video session ──
    const body = await request.json() as {
      mode: 'report' | 'video_session' | 'digital_twin'
      report_type?: string
      farm_id?: string
      farm_data?: Record<string, unknown>
      date_range?: { from: string; to: string }
      // video session
      participant_email?: string
      session_type?: string
      scheduled_at?: string
    }

    if (body.mode === 'report') {
      if (!body.report_type || !body.farm_id) {
        return NextResponse.json({ error: 'report_type and farm_id are required' }, { status: 400 })
      }

      // Fetch real farm data for the report
      const [
        { data: farm },
        { data: recentReadings },
        { data: cropBatches },
        { data: robotTasks },
        { data: alerts },
      ] = await Promise.all([
        supabase.from('farms').select('*').eq('id', body.farm_id).single(),
        supabase.from('sensor_readings').select('*, sensor:sensors(sensor_type)').eq('farm_id', body.farm_id).order('recorded_at', { ascending: false }).limit(500),
        supabase.from('crop_batches').select('*').eq('farm_id', body.farm_id).order('created_at', { ascending: false }).limit(20),
        supabase.from('robot_tasks').select('*').eq('farm_id', body.farm_id).order('created_at', { ascending: false }).limit(50),
        supabase.from('alerts').select('*').eq('farm_id', body.farm_id).order('created_at', { ascending: false }).limit(100),
      ])

      const farmData = {
        farm,
        sensorReadings: recentReadings,
        cropBatches,
        robotTasks,
        alerts,
        ...body.farm_data,
      }

      const reportMarkdown = await generateAgriReport({
        farmId: body.farm_id,
        reportType: body.report_type as 'monthly_summary',
        farmData,
        dateRange: body.date_range,
      })

      // Persist report
      const { data: saved } = await supabase.from('generated_reports').insert({
        farm_id: body.farm_id,
        report_type: body.report_type,
        content_markdown: reportMarkdown,
        generated_by: user.id,
      }).select().single()

      return NextResponse.json({ success: true, report: reportMarkdown, report_id: saved?.id })
    }

    if (body.mode === 'video_session') {
      if (!body.farm_id || !body.participant_email) {
        return NextResponse.json({ error: 'farm_id and participant_email required' }, { status: 400 })
      }

      const session = await createVideoSession({
        farmId: body.farm_id,
        hostId: user.id,
        participantEmail: body.participant_email,
        sessionType: (body.session_type ?? 'agronomist_consult') as 'agronomist_consult',
        scheduledAt: body.scheduled_at,
      })

      // Persist session record
      await supabase.from('video_sessions').insert({
        farm_id: body.farm_id,
        host_id: user.id,
        participant_email: body.participant_email,
        session_type: body.session_type ?? 'agronomist_consult',
        provider: session.provider,
        meeting_id: session.meetingId,
        guest_url: session.guestUrl,
        host_url: session.hostUrl,
        expires_at: session.expiresAt,
        scheduled_at: body.scheduled_at ?? null,
      })

      return NextResponse.json({ success: true, session })
    }

    if (body.mode === 'digital_twin') {
      // Digital twin: generate crop growth simulation timeline
      const { farm_id, farm_data } = body
      if (!farm_id) return NextResponse.json({ error: 'farm_id required' }, { status: 400 })

      const { data: activeBatches } = await supabase
        .from('crop_batches')
        .select('*, crop_template:crop_templates(*)')
        .eq('farm_id', farm_id)
        .eq('status', 'active')

      const report = await generateAgriReport({
        farmId: farm_id,
        reportType: 'crop_lifecycle',
        farmData: { activeBatches, ...farm_data },
      })

      return NextResponse.json({ success: true, digital_twin_report: report })
    }

    return NextResponse.json({ error: 'Unknown mode. Use: vision, report, video_session, digital_twin' }, { status: 400 })
  } catch (error) {
    console.error('[/api/generative] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const farmId = searchParams.get('farm_id')
  const reportType = searchParams.get('report_type')

  if (!farmId) return NextResponse.json({ error: 'farm_id required' }, { status: 400 })

  const { user, supabase } = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = supabase
    .from('generated_reports')
    .select('id, report_type, created_at, generated_by')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (reportType) query.eq('report_type', reportType)

  const { data: reports, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// This endpoint forwards hardware commands to n8n orchestrator
// n8n then publishes to MQTT broker -> ESP32/Raspberry Pi actuators

async function getServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  )
}

export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    farmId: string
    zone: string
    command: 'OPEN' | 'CLOSE' | 'PULSE'
    duration_seconds?: number
    sensor_feedback?: boolean
  }

  const { farmId, zone, command, duration_seconds } = body

  if (!farmId || !zone || !command) {
    return NextResponse.json({ error: 'farmId, zone, and command are required' }, { status: 400 })
  }

  // Verify user has access to this farm
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const { data: farm } = await supabase
    .from('farms')
    .select('id, name')
    .eq('id', farmId)
    .eq('organization_id', profile?.organization_id ?? '')
    .single()

  if (!farm) {
    return NextResponse.json({ error: 'Farm not found or access denied' }, { status: 403 })
  }

  // Log the command to Supabase first
  const { data: valveCmd } = await supabase
    .from('valve_commands')
    .insert({
      farm_id: farmId,
      organization_id: profile?.organization_id,
      zone,
      command,
      duration_seconds: duration_seconds ?? null,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
      execution_status: 'pending',
    })
    .select()
    .single()

  // Forward to n8n webhook orchestrator
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
  if (!n8nWebhookUrl) {
    // Log warning but don't fail — hardware may be directly MQTT-connected
    console.warn('[IoT] N8N_WEBHOOK_URL not configured. Command logged to DB only.')
    return NextResponse.json({
      success: true,
      command_id: valveCmd?.id,
      message: `Command ${command} queued for zone ${zone}. n8n webhook not configured — set N8N_WEBHOOK_URL.`,
      hardware_sent: false,
    })
  }

  try {
    const n8nPayload = {
      event: 'valve_command',
      farm_id: farmId,
      farm_name: farm.name,
      zone,
      command,
      duration_seconds: duration_seconds ?? null,
      command_id: valveCmd?.id,
      issued_by: user.id,
      timestamp: new Date().toISOString(),
      // MQTT target topic pattern: agrisphere/{farmId}/irrigation/{zone}/control
      mqtt_topic: `agrisphere/${farmId}/irrigation/${zone.replace(/\s+/g, '_').toLowerCase()}/control`,
      mqtt_payload: JSON.stringify({
        cmd: command,
        zone,
        duration: duration_seconds ?? (command === 'OPEN' ? 0 : null),
        ts: Date.now(),
      }),
    }

    const n8nResponse = await fetch(`${n8nWebhookUrl}/agrisphere-iot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgriSphere-Secret': process.env.N8N_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify(n8nPayload),
    })

    if (n8nResponse.ok) {
      // Mark command as sent
      await supabase
        .from('valve_commands')
        .update({ execution_status: 'sent', executed_at: new Date().toISOString() })
        .eq('id', valveCmd?.id ?? '')

      return NextResponse.json({
        success: true,
        command_id: valveCmd?.id,
        message: `Command ${command} sent to zone ${zone} via n8n.`,
        hardware_sent: true,
      })
    } else {
      const errText = await n8nResponse.text()
      console.error('[IoT] n8n webhook error:', errText)

      await supabase
        .from('valve_commands')
        .update({ execution_status: 'failed' })
        .eq('id', valveCmd?.id ?? '')

      return NextResponse.json({
        success: false,
        command_id: valveCmd?.id,
        message: `n8n delivery failed: ${errText}`,
        hardware_sent: false,
      }, { status: 502 })
    }
  } catch (err) {
    console.error('[IoT] Network error sending to n8n:', err)

    await supabase
      .from('valve_commands')
      .update({ execution_status: 'failed' })
      .eq('id', valveCmd?.id ?? '')

    return NextResponse.json({
      success: false,
      command_id: valveCmd?.id,
      error: 'Failed to reach n8n orchestrator',
    }, { status: 503 })
  }
}

// GET /api/v1/iot/valve-control?farm_id=... — get recent valve commands
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const farmId = searchParams.get('farm_id')
  const zone = searchParams.get('zone')

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = supabase
    .from('valve_commands')
    .select('*')
    .order('issued_at', { ascending: false })
    .limit(50)

  if (farmId) query.eq('farm_id', farmId)
  if (zone) query.eq('zone', zone)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ commands: data })
}

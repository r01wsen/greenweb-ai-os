import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

// Browser client (singleton pattern for client components)
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  return browserClient
}

// Service role client for server-side admin operations
export function getSupabaseServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Required for server-side admin operations.')
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Real-time subscription helper for sensor data
export function createSensorRealtimeChannel(
  farmId: string,
  onUpdate: (payload: Record<string, unknown>) => void
) {
  const client = getSupabaseBrowserClient()
  return client
    .channel(`sensor_readings_farm_${farmId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sensor_readings',
        filter: `farm_id=eq.${farmId}`,
      },
      (payload) => {
        onUpdate(payload.new as Record<string, unknown>)
      }
    )
    .subscribe()
}

// Real-time subscription helper for robot fleet updates
export function createRobotRealtimeChannel(
  farmId: string,
  onUpdate: (payload: Record<string, unknown>) => void
) {
  const client = getSupabaseBrowserClient()
  return client
    .channel(`robotics_fleet_farm_${farmId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'robotics_fleet',
        filter: `farm_id=eq.${farmId}`,
      },
      (payload) => {
        onUpdate(payload.new as Record<string, unknown>)
      }
    )
    .subscribe()
}

// Real-time subscription helper for alerts
export function createAlertRealtimeChannel(
  organizationId: string,
  onAlert: (payload: Record<string, unknown>) => void
) {
  const client = getSupabaseBrowserClient()
  return client
    .channel(`alerts_org_${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `organization_id=eq.${organizationId}`,
      },
      (payload) => {
        onAlert(payload.new as Record<string, unknown>)
      }
    )
    .subscribe()
}

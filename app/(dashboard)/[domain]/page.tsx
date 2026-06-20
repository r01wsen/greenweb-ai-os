import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import type { UserRole, Farm, GlobalAdminStats, FarmDashboardStats } from '@/lib/supabase/types'
import { GlobalAdminDashboard } from '@/components/dashboard/GlobalAdminDashboard'
import { FarmOwnerDashboard } from '@/components/dashboard/FarmOwnerDashboard'
import { CustomerPortal } from '@/components/dashboard/CustomerPortal'

interface DomainPageProps {
  params: { domain: string }
  searchParams: { farm_id?: string }
}

async function getServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

async function getUserProfile(supabase: ReturnType<typeof createServerClient>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, organization:organizations(*)')
    .eq('id', user.id)
    .single()

  if (error) return null
  return profile
}

async function getGlobalAdminStats(supabase: ReturnType<typeof createServerClient>): Promise<GlobalAdminStats> {
  const [
    { count: orgCount },
    { count: farmCount },
    { count: sensorCount },
    { count: robotCount },
    { data: activeAlerts },
    { data: criticalAlerts },
    { data: regionData },
    { data: tierData },
  ] = await Promise.all([
    supabase.from('organizations').select('*', { count: 'exact', head: true }),
    supabase.from('farms').select('*', { count: 'exact', head: true }),
    supabase.from('sensors').select('*', { count: 'exact', head: true }),
    supabase.from('robotics_fleet').select('*', { count: 'exact', head: true }),
    supabase.from('alerts').select('id', { count: 'exact' }).eq('is_resolved', false),
    supabase.from('alerts').select('id', { count: 'exact' }).eq('is_resolved', false).eq('severity', 'critical'),
    supabase.from('farms').select('region').then(async ({ data }) => {
      const regionMap: Record<string, number> = {}
      data?.forEach((f: { region: string }) => {
        regionMap[f.region] = (regionMap[f.region] || 0) + 1
      })
      return {
        data: Object.entries(regionMap).map(([region, farm_count]) => ({
          region,
          farm_count,
          sensor_count: 0,
        })),
      }
    }),
    supabase.from('organizations').select('tier').then(async ({ data }) => {
      const tierMap: Record<string, number> = {}
      data?.forEach((o: { tier: string }) => {
        tierMap[o.tier] = (tierMap[o.tier] || 0) + 1
      })
      return { data: tierMap }
    }),
  ])

  return {
    totalOrganizations: orgCount ?? 0,
    totalFarms: farmCount ?? 0,
    totalSensors: sensorCount ?? 0,
    totalRobots: robotCount ?? 0,
    activeAlerts: activeAlerts?.length ?? 0,
    criticalAlerts: criticalAlerts?.length ?? 0,
    regionBreakdown: regionData ?? [],
    orgTierBreakdown: (tierData as Record<string, number>) ?? {},
  }
}

async function getFarmDashboardStats(
  supabase: ReturnType<typeof createServerClient>,
  farmId: string,
  organizationId: string
): Promise<FarmDashboardStats | null> {
  const [
    { data: farm },
    { count: activeSensors },
    { count: totalSensors },
    { count: activeRobots },
    { count: totalRobots },
    { count: activeBatches },
    { count: pendingActivities },
    { count: unreadAlerts },
    { count: criticalAlerts },
    { data: recentReadings },
  ] = await Promise.all([
    supabase.from('farms').select('*').eq('id', farmId).eq('organization_id', organizationId).single(),
    supabase
      .from('sensors')
      .select('*', { count: 'exact', head: true })
      .eq('farm_id', farmId)
      .eq('status', 'online'),
    supabase
      .from('sensors')
      .select('*', { count: 'exact', head: true })
      .eq('farm_id', farmId),
    supabase
      .from('robotics_fleet')
      .select('*', { count: 'exact', head: true })
      .eq('farm_id', farmId)
      .in('status', ['active', 'autonomous', 'manual']),
    supabase
      .from('robotics_fleet')
      .select('*', { count: 'exact', head: true })
      .eq('farm_id', farmId),
    supabase
      .from('crop_batches')
      .select('*', { count: 'exact', head: true })
      .eq('farm_id', farmId)
      .eq('status', 'active'),
    supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('farm_id', farmId)
      .eq('status', 'scheduled'),
    supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('farm_id', farmId)
      .eq('is_read', false),
    supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .eq('farm_id', farmId)
      .eq('is_resolved', false)
      .eq('severity', 'critical'),
    supabase
      .from('sensor_readings')
      .select('*, sensor:sensors(sensor_type)')
      .eq('farm_id', farmId)
      .order('recorded_at', { ascending: false })
      .limit(20),
  ])

  if (!farm) return null

  const readingsMap: Record<string, unknown> = {}
  recentReadings?.forEach((r) => {
    const key = (r.sensor as { sensor_type: string })?.sensor_type
    if (key && !readingsMap[key]) {
      readingsMap[key] = r
    }
  })

  return {
    farm: farm as Farm,
    activeSensors: activeSensors ?? 0,
    totalSensors: totalSensors ?? 0,
    activeRobots: activeRobots ?? 0,
    totalRobots: totalRobots ?? 0,
    activeCropBatches: activeBatches ?? 0,
    pendingActivities: pendingActivities ?? 0,
    unreadAlerts: unreadAlerts ?? 0,
    criticalAlerts: criticalAlerts ?? 0,
    recentReadings: readingsMap as Record<string, import('@/lib/supabase/types').SensorReading>,
  }
}

async function getCustomerOrders(supabase: ReturnType<typeof createServerClient>, customerId: string) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return []
  return orders
}

export default async function DomainDashboardPage({ params, searchParams }: DomainPageProps) {
  const supabase = await getServerSupabase()
  const profile = await getUserProfile(supabase)

  if (!profile) {
    redirect('/login')
  }

  const role: UserRole = profile.role
  const { domain } = params
  const { farm_id } = searchParams

  // Platform admin sees the global cross-farm aggregator view
  if (role === 'platform_admin') {
    const stats = await getGlobalAdminStats(supabase)
    // Fetch all farms for the audit dropdown
    const { data: allFarms } = await supabase
      .from('farms')
      .select('id, name, slug, region, organization_id, organizations(name)')
      .order('name')
      .limit(500)

    return (
      <GlobalAdminDashboard
        profile={profile}
        stats={stats}
        allFarms={(allFarms ?? []) as Farm[]}
        selectedFarmId={farm_id}
      />
    )
  }

  // Farm owners and operators see the farm-specific operational view
  if (role === 'farm_owner' || role === 'operator') {
    const organizationId = profile.organization_id

    // Determine which farm to show (first farm if none specified)
    let targetFarmId = farm_id
    if (!targetFarmId) {
      const { data: firstFarm } = await supabase
        .from('farms')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .single()
      targetFarmId = firstFarm?.id
    }

    if (!targetFarmId) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">No Farms Found</h2>
            <p className="text-gray-400">Contact your platform administrator to set up a farm.</p>
          </div>
        </div>
      )
    }

    // Fetch all farms in the organization for switching
    const { data: orgFarms } = await supabase
      .from('farms')
      .select('id, name, slug, is_active')
      .eq('organization_id', organizationId)
      .order('name')

    const dashboardStats = await getFarmDashboardStats(supabase, targetFarmId, organizationId)

    if (!dashboardStats) {
      redirect('/dashboard/agrisphere')
    }

    // Fetch sensors for the farm
    const { data: sensors } = await supabase
      .from('sensors')
      .select('*')
      .eq('farm_id', targetFarmId)
      .order('sensor_type')

    // Fetch robotics fleet
    const { data: robots } = await supabase
      .from('robotics_fleet')
      .select('*')
      .eq('farm_id', targetFarmId)
      .order('name')

    // Fetch automation rules
    const { data: automationRules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('farm_id', targetFarmId)
      .eq('is_active', true)
      .order('name')

    // Fetch active crop batches for calendar
    const { data: cropBatches } = await supabase
      .from('crop_batches')
      .select('*, crop_template:crop_templates(name, variety)')
      .eq('farm_id', targetFarmId)
      .in('status', ['planned', 'active'])
      .order('planting_date')

    // Fetch activity logs for the 7-day calendar view
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 3)
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 4)

    const { data: weekActivities } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('farm_id', targetFarmId)
      .gte('scheduled_date', sevenDaysAgo.toISOString().split('T')[0])
      .lte('scheduled_date', sevenDaysFromNow.toISOString().split('T')[0])
      .order('scheduled_date')

    // Fetch recent alerts
    const { data: alerts } = await supabase
      .from('alerts')
      .select('*')
      .eq('farm_id', targetFarmId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(10)

    return (
      <FarmOwnerDashboard
        profile={profile}
        stats={dashboardStats}
        orgFarms={(orgFarms ?? []) as Farm[]}
        sensors={sensors ?? []}
        robots={robots ?? []}
        automationRules={automationRules ?? []}
        cropBatches={cropBatches ?? []}
        weekActivities={weekActivities ?? []}
        alerts={alerts ?? []}
        role={role}
      />
    )
  }

  // Customer / Buyer portal — restricted to product transparency and orders
  if (role === 'customer') {
    const userId = profile.id
    const orders = await getCustomerOrders(supabase, userId)

    // Fetch products available to this customer's organization
    const { data: products } = await supabase
      .from('products')
      .select('*, farm:farms(name, region), crop_batch:crop_batches(name, planting_date, status)')
      .eq('is_available', true)
      .order('created_at', { ascending: false })
      .limit(100)

    return (
      <CustomerPortal
        profile={profile}
        orders={orders ?? []}
        products={(products ?? []) as import('@/lib/supabase/types').Product[]}
      />
    )
  }

  // Fallback — should not reach here
  redirect('/login')
}

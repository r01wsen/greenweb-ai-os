'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type {
  FarmDashboardStats, Farm, Sensor, RoboticsFleet,
  AutomationRule, CropBatch, ActivityLog, Alert, UserRole, Profile
} from '@/lib/supabase/types'
import { createSensorRealtimeChannel, createRobotRealtimeChannel, createAlertRealtimeChannel, getSupabaseBrowserClient } from '@/lib/supabase/client'
import { VoiceCommander } from '@/components/ai/VoiceCommander'

interface FarmOwnerDashboardProps {
  profile: Profile & { organization: { name: string; id: string } }
  stats: FarmDashboardStats
  orgFarms: Farm[]
  sensors: Sensor[]
  robots: RoboticsFleet[]
  automationRules: AutomationRule[]
  cropBatches: CropBatch[]
  weekActivities: ActivityLog[]
  alerts: Alert[]
  role: UserRole
}

// ─── Sensor Gauge ───────────────────────────────────────────────────────────

const SENSOR_META: Record<string, { label: string; unit: string; min: number; max: number; color: string; icon: string }> = {
  air_temperature:  { label: 'Air Temp',     unit: '°C',    min: 0,    max: 50,   color: '#f97316', icon: '🌡️' },
  air_humidity:     { label: 'Humidity',     unit: '%',     min: 0,    max: 100,  color: '#38bdf8', icon: '💧' },
  soil_moisture:    { label: 'Soil Moisture', unit: '%',    min: 0,    max: 100,  color: '#4ade80', icon: '🌱' },
  soil_npk:         { label: 'Soil NPK',     unit: 'mg/kg', min: 0,    max: 500,  color: '#a78bfa', icon: '🧪' },
  soil_ec:          { label: 'Soil EC',      unit: 'dS/m',  min: 0,    max: 10,   color: '#fbbf24', icon: '⚡' },
  co2:              { label: 'CO₂',          unit: 'ppm',   min: 300,  max: 2000, color: '#6ee7b7', icon: '☁️' },
  leaf_wetness:     { label: 'Leaf Wetness', unit: '%',     min: 0,    max: 100,  color: '#34d399', icon: '🍃' },
  ph:               { label: 'pH',           unit: 'pH',    min: 0,    max: 14,   color: '#e879f9', icon: '🔬' },
  light_par:        { label: 'Light PAR',    unit: 'µmol',  min: 0,    max: 2000, color: '#fde68a', icon: '☀️' },
  flow_rate:        { label: 'Flow Rate',    unit: 'L/min', min: 0,    max: 50,   color: '#93c5fd', icon: '🚿' },
  tank_level:       { label: 'Tank Level',   unit: '%',     min: 0,    max: 100,  color: '#67e8f9', icon: '🪣' },
}

function SensorGauge({ sensor, latestValue }: { sensor: Sensor; latestValue?: number }) {
  const meta = SENSOR_META[sensor.sensor_type] ?? { label: sensor.sensor_type, unit: '', min: 0, max: 100, color: '#9ca3af', icon: '📡' }
  const value = latestValue ?? 0
  const pct = Math.min(100, Math.max(0, ((value - meta.min) / (meta.max - meta.min)) * 100))
  const isAlert = sensor.alert_min !== null && value < sensor.alert_min || sensor.alert_max !== null && value > sensor.alert_max
  const statusColor = sensor.status === 'online' ? 'text-green-400' : sensor.status === 'offline' ? 'text-gray-500' : 'text-yellow-400'

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-3 transition-all ${isAlert ? 'border-red-600 shadow-red-900/30 shadow-lg' : 'border-gray-800 hover:border-gray-700'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <div>
            <p className="text-xs font-semibold text-gray-300">{meta.label}</p>
            <p className="text-xs text-gray-500">{sensor.location_zone}</p>
          </div>
        </div>
        <span className={`text-xs font-medium ${statusColor}`}>{sensor.status}</span>
      </div>
      <div>
        <div className="flex items-end justify-between mb-1">
          <span className="text-2xl font-bold text-white">{sensor.status === 'offline' ? '—' : value.toFixed(1)}</span>
          <span className="text-xs text-gray-500">{meta.unit}</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: isAlert ? '#f87171' : meta.color }}
          />
        </div>
        {sensor.battery_percent !== null && (
          <p className="text-xs text-gray-600 mt-1">🔋 {sensor.battery_percent}%</p>
        )}
      </div>
    </div>
  )
}

// ─── 7-Day Activity Calendar ─────────────────────────────────────────────────

function ActivityCalendar({ activities }: { activities: ActivityLog[] }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - 3 + i)
    return d
  })

  const activityByDate: Record<string, ActivityLog[]> = {}
  activities.forEach((a) => {
    const key = a.scheduled_date.split('T')[0]
    if (!activityByDate[key]) activityByDate[key] = []
    activityByDate[key].push(a)
  })

  const typeColors: Record<string, string> = {
    planting: 'bg-green-700 text-green-100',
    fertigation: 'bg-blue-700 text-blue-100',
    scouting: 'bg-yellow-700 text-yellow-100',
    pest_control: 'bg-orange-700 text-orange-100',
    harvesting: 'bg-purple-700 text-purple-100',
    pruning: 'bg-pink-700 text-pink-100',
    soil_prep: 'bg-amber-700 text-amber-100',
    post_harvest: 'bg-cyan-700 text-cyan-100',
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, idx) => {
        const key = day.toISOString().split('T')[0]
        const dayActivities = activityByDate[key] ?? []
        const isToday = idx === 3
        return (
          <div key={key} className={`rounded-xl p-2 min-h-[120px] border ${isToday ? 'border-green-600 bg-green-950/30' : 'border-gray-800 bg-gray-900/50'}`}>
            <div className="mb-2 text-center">
              <p className="text-xs text-gray-500">{day.toLocaleDateString('en', { weekday: 'short' })}</p>
              <p className={`text-sm font-bold ${isToday ? 'text-green-400' : 'text-gray-300'}`}>{day.getDate()}</p>
            </div>
            <div className="space-y-1">
              {dayActivities.slice(0, 4).map((a) => (
                <div key={a.id} className={`text-xs px-1.5 py-0.5 rounded truncate ${typeColors[a.activity_type] ?? 'bg-gray-700 text-gray-300'}`} title={a.name}>
                  {a.name}
                </div>
              ))}
              {dayActivities.length > 4 && (
                <p className="text-xs text-gray-500 text-center">+{dayActivities.length - 4} more</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Robot Fleet Card ────────────────────────────────────────────────────────

function RobotCard({ robot }: { robot: RoboticsFleet }) {
  const statusColor: Record<string, string> = {
    idle: 'text-gray-400',
    active: 'text-green-400',
    autonomous: 'text-cyan-400',
    manual: 'text-yellow-400',
    charging: 'text-blue-400',
    error: 'text-red-400',
  }
  const typeIcon: Record<string, string> = {
    drone: '🚁', ground_rover: '🤖', arm: '🦾', conveyor: '🏭', harvester: '🌾',
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{typeIcon[robot.robot_type] ?? '🤖'}</span>
          <div>
            <p className="text-sm font-semibold text-white">{robot.name}</p>
            <p className="text-xs text-gray-500">{robot.model}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold ${statusColor[robot.status] ?? 'text-gray-400'}`}>{robot.status}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Battery</span>
          <span className={robot.battery_percent < 20 ? 'text-red-400' : 'text-green-400'}>{robot.battery_percent}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${robot.battery_percent < 20 ? 'bg-red-500' : robot.battery_percent < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${robot.battery_percent}%` }}
          />
        </div>
        {robot.current_task && (
          <p className="text-xs text-cyan-400 truncate">▶ {robot.current_task}</p>
        )}
        {robot.gps_latitude && robot.gps_longitude && (
          <p className="text-xs text-gray-500">📍 {robot.gps_latitude.toFixed(5)}, {robot.gps_longitude.toFixed(5)}</p>
        )}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{robot.operation_mode}</span>
          <span>{robot.total_runtime_hours.toFixed(1)}h runtime</span>
        </div>
      </div>
    </div>
  )
}

// ─── Automation Rule Card ────────────────────────────────────────────────────

function AutomationRuleCard({ rule }: { rule: AutomationRule }) {
  const [toggling, setToggling] = useState(false)
  const supabase = getSupabaseBrowserClient()

  async function toggleRule() {
    setToggling(true)
    await supabase.from('automation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    setToggling(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold text-white">{rule.name}</p>
          {rule.description && <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>}
        </div>
        <button
          onClick={toggleRule}
          disabled={toggling}
          className={`relative w-10 h-5 rounded-full transition-colors ${rule.is_active ? 'bg-green-600' : 'bg-gray-700'}`}
          aria-label={rule.is_active ? 'Disable rule' : 'Enable rule'}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.is_active ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </div>
      <div className="bg-gray-800/60 rounded-lg p-2 text-xs font-mono text-gray-300 space-y-0.5">
        <p className="text-yellow-300">IF sensor {rule.trigger_operator} {rule.trigger_threshold}</p>
        <p className="text-cyan-300">→ {rule.action_type.replace('_', ' ')}</p>
        {rule.trigger_count > 0 && <p className="text-gray-500">Triggered {rule.trigger_count}×</p>}
      </div>
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

type DashboardTab = 'overview' | 'sensors' | 'robots' | 'automation' | 'calendar' | 'voice'

export function FarmOwnerDashboard({
  profile, stats, orgFarms, sensors, robots,
  automationRules, cropBatches, weekActivities, alerts, role,
}: FarmOwnerDashboardProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [liveReadings, setLiveReadings] = useState<Record<string, number>>({})
  const [liveAlerts, setLiveAlerts] = useState<Alert[]>(alerts)
  const [liveRobots, setLiveRobots] = useState<RoboticsFleet[]>(robots)

  // Build initial readings from stats
  useEffect(() => {
    const initialReadings: Record<string, number> = {}
    Object.entries(stats.recentReadings).forEach(([type, reading]) => {
      if (reading) initialReadings[type] = reading.value
    })
    setLiveReadings(initialReadings)
  }, [stats.recentReadings])

  // Subscribe to real-time sensor readings
  useEffect(() => {
    const channel = createSensorRealtimeChannel(stats.farm.id, (payload) => {
      const p = payload as { sensor_type?: string; value?: number; sensor?: { sensor_type?: string } }
      const sensorType = p.sensor_type ?? p.sensor?.sensor_type
      if (sensorType && typeof p.value === 'number') {
        setLiveReadings((prev) => ({ ...prev, [sensorType]: p.value as number }))
      }
    })
    return () => { channel.unsubscribe() }
  }, [stats.farm.id])

  // Subscribe to real-time robot updates
  useEffect(() => {
    const channel = createRobotRealtimeChannel(stats.farm.id, (payload) => {
      setLiveRobots((prev) =>
        prev.map((r) => r.id === (payload as { id: string }).id ? { ...r, ...payload } as RoboticsFleet : r)
      )
    })
    return () => { channel.unsubscribe() }
  }, [stats.farm.id])

  // Subscribe to real-time alerts
  useEffect(() => {
    const channel = createAlertRealtimeChannel(profile.organization.id, (payload) => {
      setLiveAlerts((prev) => [payload as Alert, ...prev].slice(0, 20))
    })
    return () => { channel.unsubscribe() }
  }, [profile.organization.id])

  const handleVoiceCommand = useCallback((action: string, entities: Record<string, unknown>) => {
    console.log('[VoiceCommander] Action:', action, 'Entities:', entities)
  }, [])

  const TABS: { id: DashboardTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'sensors', label: 'Sensors', icon: '📡' },
    { id: 'robots', label: 'Fleet', icon: '🤖' },
    { id: 'automation', label: 'Automation', icon: '⚙️' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'voice', label: 'Voice AI', icon: '🎙️' },
  ]

  const unresolvedCritical = liveAlerts.filter((a) => !a.is_resolved && a.severity === 'critical')

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top Nav */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex-shrink-0 flex items-center justify-center">
              <span className="text-base">🌿</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{stats.farm.name}</p>
              <p className="text-xs text-gray-400 truncate">{stats.farm.region}</p>
            </div>
          </div>

          {/* Farm Switcher */}
          {orgFarms.length > 1 && (
            <select
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-green-600 hidden sm:block"
              defaultValue={stats.farm.id}
              onChange={(e) => router.push(`/dashboard/agrisphere?farm_id=${e.target.value}`)}
            >
              {orgFarms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            {unresolvedCritical.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-900 text-red-300 text-xs font-semibold border border-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {unresolvedCritical.length} critical
              </span>
            )}
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${role === 'farm_owner' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>
              {role === 'farm_owner' ? 'Owner' : 'Operator'}
            </span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-screen-xl mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">

        {/* ─── Overview ─────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: 'Online Sensors', value: `${stats.activeSensors}/${stats.totalSensors}`, color: 'text-green-400' },
                { label: 'Active Robots', value: `${stats.activeRobots}/${stats.totalRobots}`, color: 'text-cyan-400' },
                { label: 'Crop Batches', value: stats.activeCropBatches, color: 'text-emerald-400' },
                { label: 'Activities Due', value: stats.pendingActivities, color: 'text-yellow-400' },
                { label: 'Alerts', value: stats.unreadAlerts, color: stats.unreadAlerts > 0 ? 'text-red-400' : 'text-green-400' },
                { label: 'Critical', value: stats.criticalAlerts, color: stats.criticalAlerts > 0 ? 'text-red-400' : 'text-green-400' },
                { label: 'Area (ha)', value: stats.farm.area_hectares, color: 'text-blue-400' },
                { label: 'Farm Type', value: stats.farm.farm_type.replace('_', ' '), color: 'text-purple-400' },
              ].map((item) => (
                <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
                  <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Quick sensor preview — top 6 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Live Sensors (Top 6)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {sensors.slice(0, 6).map((s) => (
                  <SensorGauge key={s.id} sensor={s} latestValue={liveReadings[s.sensor_type]} />
                ))}
              </div>
            </div>

            {/* Alerts feed */}
            {liveAlerts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Alerts</h2>
                <div className="space-y-2">
                  {liveAlerts.slice(0, 5).map((alert) => {
                    const colors = { info: 'border-blue-800 bg-blue-950/20', warning: 'border-yellow-800 bg-yellow-950/20', critical: 'border-red-800 bg-red-950/30' }
                    return (
                      <div key={alert.id} className={`flex items-start gap-3 border rounded-lg px-4 py-3 ${colors[alert.severity]}`}>
                        <span className="text-base">{alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{alert.title}</p>
                          <p className="text-xs text-gray-400">{alert.message}</p>
                          <p className="text-xs text-gray-600 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Crop batches */}
            {cropBatches.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Crop Batches</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cropBatches.slice(0, 6).map((batch) => {
                    const planted = new Date(batch.planting_date)
                    const harvest = new Date(batch.expected_harvest_date)
                    const today = new Date()
                    const totalDays = Math.max(1, (harvest.getTime() - planted.getTime()) / 86400000)
                    const elapsed = Math.max(0, (today.getTime() - planted.getTime()) / 86400000)
                    const pct = Math.min(100, (elapsed / totalDays) * 100)
                    return (
                      <div key={batch.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                        <p className="text-sm font-semibold text-white">{batch.name}</p>
                        <p className="text-xs text-gray-500 mb-3">{batch.zone} · {batch.area_m2}m²</p>
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Planted {planted.toLocaleDateString()}</span>
                            <span>{Math.round(pct)}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-gray-600 mt-1">Est. harvest: {harvest.toLocaleDateString()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Sensors ──────────────────────────────── */}
        {activeTab === 'sensors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">IoT Sensor Array</h2>
              <span className="text-xs text-gray-500">{stats.activeSensors} online / {stats.totalSensors} total</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sensors.map((s) => (
                <SensorGauge key={s.id} sensor={s} latestValue={liveReadings[s.sensor_type]} />
              ))}
            </div>
          </div>
        )}

        {/* ─── Robots ───────────────────────────────── */}
        {activeTab === 'robots' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Robotics Fleet</h2>
              <span className="text-xs text-gray-500">{stats.activeRobots} active / {stats.totalRobots} total</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {liveRobots.map((robot) => (
                <RobotCard key={robot.id} robot={robot} />
              ))}
              {liveRobots.length === 0 && (
                <div className="col-span-full text-center py-16 text-gray-500">
                  <p className="text-4xl mb-3">🤖</p>
                  <p className="font-medium">No robots registered on this farm yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Automation ───────────────────────────── */}
        {activeTab === 'automation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Automation Rules</h2>
              <span className="text-xs text-gray-500">{automationRules.filter((r) => r.is_active).length} active rules</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {automationRules.map((rule) => (
                <AutomationRuleCard key={rule.id} rule={rule} />
              ))}
              {automationRules.length === 0 && (
                <div className="col-span-full text-center py-16 text-gray-500">
                  <p className="text-4xl mb-3">⚙️</p>
                  <p className="font-medium">No automation rules configured yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Calendar ─────────────────────────────── */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">7-Day Activity Matrix</h2>
              <span className="text-xs text-gray-500">{weekActivities.length} events this week</span>
            </div>
            <ActivityCalendar activities={weekActivities} />
          </div>
        )}

        {/* ─── Voice AI ─────────────────────────────── */}
        {activeTab === 'voice' && (
          <div className="max-w-2xl mx-auto">
            <VoiceCommander farmId={stats.farm.id} onActionExecuted={handleVoiceCommand} />
          </div>
        )}
      </main>
    </div>
  )
}

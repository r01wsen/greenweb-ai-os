'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GlobalAdminStats, Farm, Profile } from '@/lib/supabase/types'

interface GlobalAdminDashboardProps {
  profile: Profile & { organization: { name: string } }
  stats: GlobalAdminStats
  allFarms: Farm[]
  selectedFarmId?: string
}

const SEVERITY_COLORS = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  critical: 'text-red-400',
}

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-1 hover:border-green-600 transition-colors">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function AlertBadge({ count, label }: { count: number; label: string }) {
  const color = count > 0 ? 'bg-red-900 text-red-300 border-red-700' : 'bg-gray-800 text-gray-400 border-gray-700'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {count > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
      {count} {label}
    </span>
  )
}

export function GlobalAdminDashboard({ profile, stats, allFarms, selectedFarmId }: GlobalAdminDashboardProps) {
  const router = useRouter()
  const [farmSearch, setFarmSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('all')

  const regions = ['all', ...Array.from(new Set(allFarms.map((f) => f.region))).sort()]

  const filteredFarms = allFarms.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(farmSearch.toLowerCase())
    const matchRegion = regionFilter === 'all' || f.region === regionFilter
    return matchSearch && matchRegion
  })

  function jumpToFarm(farmId: string) {
    router.push(`/dashboard/agrisphere?farm_id=${farmId}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top Nav */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-white text-sm">AgriSphere</span>
              <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">Platform Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AlertBadge count={stats.criticalAlerts} label="Critical" />
            <AlertBadge count={stats.activeAlerts} label="Active Alerts" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-xs font-bold">
              {profile.full_name?.charAt(0) ?? 'A'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">Global Platform Overview</h1>
          <p className="text-sm text-gray-400 mt-1">Cross-organization fleet, climate, and billing aggregator</p>
        </div>

        {/* KPI Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Organizations" value={stats.totalOrganizations} sub="Active tenants" />
          <StatCard label="Total Farms" value={stats.totalFarms} sub="Across all orgs" color="text-green-400" />
          <StatCard label="IoT Sensors" value={stats.totalSensors} sub="Hardware nodes" color="text-blue-400" />
          <StatCard label="Robot Fleet" value={stats.totalRobots} sub="Deployed units" color="text-cyan-400" />
          <StatCard label="Active Alerts" value={stats.activeAlerts} sub="Unresolved" color={stats.activeAlerts > 0 ? 'text-yellow-400' : 'text-green-400'} />
          <StatCard label="Critical" value={stats.criticalAlerts} sub="Needs action" color={stats.criticalAlerts > 0 ? 'text-red-400' : 'text-green-400'} />
        </div>

        {/* Org Billing Tiers */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Subscription Tier Distribution</h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(stats.orgTierBreakdown).map(([tier, count]) => {
              const colors: Record<string, string> = {
                starter: 'border-gray-600 text-gray-300',
                professional: 'border-blue-600 text-blue-300',
                enterprise: 'border-purple-600 text-purple-300',
              }
              return (
                <div key={tier} className={`border rounded-lg p-4 text-center ${colors[tier] ?? 'border-gray-700 text-white'}`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs uppercase mt-1 font-medium capitalize">{tier}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Region Map + Farm Audit */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Region Breakdown */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Region Statistics</h2>
            <div className="space-y-3">
              {stats.regionBreakdown.map((r) => (
                <div key={r.region} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{r.region}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${Math.min(100, (r.farm_count / (stats.totalFarms || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{r.farm_count}</span>
                  </div>
                </div>
              ))}
              {stats.regionBreakdown.length === 0 && (
                <p className="text-sm text-gray-500">No regional data available.</p>
              )}
            </div>
          </div>

          {/* Farm Audit Selector */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Farm Node Audit</h2>
            <div className="flex gap-2 mb-4 flex-wrap">
              <input
                type="text"
                value={farmSearch}
                onChange={(e) => setFarmSearch(e.target.value)}
                placeholder="Search farms..."
                className="flex-1 min-w-[140px] bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-600"
              />
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-600"
              >
                {regions.map((r) => (
                  <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredFarms.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No farms match your filter.</p>
              )}
              {filteredFarms.map((farm) => (
                <button
                  key={farm.id}
                  onClick={() => jumpToFarm(farm.id)}
                  className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg border transition-all
                    ${selectedFarmId === farm.id
                      ? 'bg-green-900/40 border-green-600 text-white'
                      : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                    }`}
                >
                  <div>
                    <p className="text-sm font-medium">{farm.name}</p>
                    <p className="text-xs text-gray-500">{farm.region} · {farm.farm_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${farm.is_active ? 'bg-green-400' : 'bg-gray-600'}`} />
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Platform-wide system status */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Platform System Health</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'API Gateway', status: 'operational' },
              { label: 'IoT MQTT Broker', status: 'operational' },
              { label: 'n8n Orchestrator', status: 'operational' },
              { label: 'AI Inference', status: 'operational' },
              { label: 'Supabase DB', status: 'operational' },
              { label: 'Realtime WS', status: 'operational' },
              { label: 'Edge Workers', status: 'operational' },
              { label: 'Object Storage', status: 'operational' },
            ].map((service) => (
              <div key={service.label} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-gray-300 truncate">{service.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

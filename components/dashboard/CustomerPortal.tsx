'use client'

import { useState } from 'react'
import type { Order, Product, Profile, LogisticsStatus } from '@/lib/supabase/types'

interface CustomerPortalProps {
  profile: Profile & { organization: { name: string } }
  orders: Order[]
  products: Product[]
}

const STATUS_META: Record<LogisticsStatus, { label: string; color: string; icon: string; step: number }> = {
  pending:    { label: 'Pending',     color: 'bg-gray-700 text-gray-300',    icon: '🕐', step: 1 },
  processing: { label: 'Processing',  color: 'bg-blue-900 text-blue-300',    icon: '⚙️', step: 2 },
  packed:     { label: 'Packed',      color: 'bg-indigo-900 text-indigo-300', icon: '📦', step: 3 },
  shipped:    { label: 'Shipped',     color: 'bg-purple-900 text-purple-300', icon: '🚚', step: 4 },
  in_transit: { label: 'In Transit',  color: 'bg-cyan-900 text-cyan-300',    icon: '🛣️', step: 5 },
  delivered:  { label: 'Delivered',   color: 'bg-green-900 text-green-300',  icon: '✅', step: 6 },
  returned:   { label: 'Returned',    color: 'bg-red-900 text-red-300',      icon: '↩️', step: 0 },
}

function OrderTracker({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false)
  const meta = STATUS_META[order.status]
  const STEPS: LogisticsStatus[] = ['pending', 'processing', 'packed', 'shipped', 'in_transit', 'delivered']

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between p-5 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <p className="text-sm font-semibold text-white">#{order.order_number}</p>
            <p className="text-xs text-gray-400 mt-0.5">{order.items.length} items · {order.currency} {order.total.toFixed(2)}</p>
            <p className="text-xs text-gray-600">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Progress Bar */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-1">
          {STEPS.map((step, idx) => {
            const stepMeta = STATUS_META[step]
            const isActive = stepMeta.step <= meta.step
            const isCurrent = step === order.status
            return (
              <div key={step} className="flex items-center flex-1">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all
                  ${isCurrent ? 'bg-green-500 text-white ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900'
                    : isActive ? 'bg-green-800 text-green-300'
                    : 'bg-gray-800 text-gray-600'}`}
                  title={stepMeta.label}
                >
                  {isActive ? '✓' : idx + 1}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-0.5 ${isActive && order.status !== STEPS[idx] ? 'bg-green-700' : 'bg-gray-800'}`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          {STEPS.map((step) => (
            <span key={step} className="text-xs text-gray-600 flex-1 text-center">{STATUS_META[step].label}</span>
          ))}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-4">
          {/* Items */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Order Items</h4>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-sm text-white">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{item.quantity} {item.unit} × {order.currency} {item.unit_price.toFixed(2)}</p>
                  </div>
                  <span className="text-sm font-semibold text-white">{order.currency} {item.total_price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Subtotal</span><span>{order.currency} {order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Tax</span><span>{order.currency} {order.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Shipping</span><span>{order.currency} {order.shipping.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white border-t border-gray-700 pt-1.5 mt-1">
              <span>Total</span><span>{order.currency} {order.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Shipping */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Delivery Details</h4>
            <p className="text-sm text-gray-300">
              {order.shipping_address.street}, {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
            </p>
            {order.tracking_number && (
              <p className="text-xs text-cyan-400 mt-1">Tracking: {order.tracking_number}</p>
            )}
            {order.estimated_delivery && (
              <p className="text-xs text-gray-500 mt-1">Est. delivery: {new Date(order.estimated_delivery).toLocaleDateString()}</p>
            )}
          </div>

          {/* Invoice */}
          {order.invoice_url && (
            <a
              href={order.invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-green-400 hover:text-green-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Invoice
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-green-700 transition-colors">
      {product.image_urls?.[0] ? (
        <div className="h-36 bg-gray-800 overflow-hidden">
          <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-36 bg-gradient-to-br from-green-950 to-gray-900 flex items-center justify-center text-4xl">🌾</div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-white leading-tight">{product.name}</p>
          <p className="text-sm font-bold text-green-400 whitespace-nowrap">{product.currency} {product.unit_price.toFixed(2)}</p>
        </div>
        <p className="text-xs text-gray-500">{product.category} · per {product.unit}</p>
        <p className="text-xs text-gray-400 line-clamp-2">{product.description}</p>
        <div className="flex flex-wrap gap-1">
          {product.certifications.map((cert) => (
            <span key={cert} className="text-xs bg-green-900/40 text-green-300 border border-green-800 px-1.5 py-0.5 rounded-full">
              {cert}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={product.stock_quantity > 0 ? 'text-green-400' : 'text-red-400'}>
            {product.stock_quantity > 0 ? `${product.stock_quantity} ${product.unit} in stock` : 'Out of stock'}
          </span>
          {product.qr_code && <span className="text-gray-600">QR: {product.qr_code}</span>}
        </div>
      </div>
    </div>
  )
}

export function CustomerPortal({ profile, orders, products }: CustomerPortalProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'transparency'>('orders')

  const pendingOrders = orders.filter((o) => !['delivered', 'returned'].includes(o.status))
  const completedOrders = orders.filter((o) => ['delivered', 'returned'].includes(o.status))
  const totalSpend = orders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-screen-lg mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-base">🛒</div>
            <div>
              <p className="text-sm font-bold text-white">AgriSphere Buyer Portal</p>
              <p className="text-xs text-gray-400">Welcome, {profile.full_name}</p>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-emerald-900 text-emerald-300 font-medium">Customer</span>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-lg mx-auto px-4 flex gap-1">
          {([
            { id: 'orders', label: 'My Orders', icon: '📦' },
            { id: 'products', label: 'Products', icon: '🌾' },
            { id: 'transparency', label: 'Transparency', icon: '🔍' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors
                ${activeTab === tab.id ? 'border-green-500 text-green-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-screen-lg mx-auto px-4 py-6 space-y-6">

        {/* ─── Orders ──────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{orders.length}</p>
                <p className="text-xs text-gray-500 mt-1">Total Orders</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-yellow-400">{pendingOrders.length}</p>
                <p className="text-xs text-gray-500 mt-1">In Progress</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{totalSpend.toFixed(0)}</p>
                <p className="text-xs text-gray-500 mt-1">Total Spend</p>
              </div>
            </div>

            {pendingOrders.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Orders</h2>
                <div className="space-y-3">
                  {pendingOrders.map((order) => (
                    <OrderTracker key={order.id} order={order} />
                  ))}
                </div>
              </div>
            )}

            {completedOrders.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Order History</h2>
                <div className="space-y-3">
                  {completedOrders.map((order) => (
                    <OrderTracker key={order.id} order={order} />
                  ))}
                </div>
              </div>
            )}

            {orders.length === 0 && (
              <div className="text-center py-20 text-gray-500">
                <p className="text-5xl mb-4">📭</p>
                <p className="text-lg font-medium">No orders yet.</p>
                <p className="text-sm mt-1">Browse available products to place your first order.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── Products ─────────────────────────────── */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white">Available Products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
              {products.length === 0 && (
                <div className="col-span-full text-center py-16 text-gray-500">
                  <p className="text-4xl mb-3">🌾</p>
                  <p>No products currently available.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Transparency ─────────────────────────── */}
        {activeTab === 'transparency' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Farm Transparency & Traceability</h2>
              <p className="text-sm text-gray-400">Complete crop lifecycle visibility from seed to shelf.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                { icon: '🌱', title: 'Crop Origins', desc: 'Each product is linked to a specific crop batch with GPS-verified farm coordinates, planting dates, and variety provenance.' },
                { icon: '🧪', title: 'Input Records', desc: 'Full log of fertilizers, pesticides, and irrigation inputs applied per batch, with application dates and quantities.' },
                { icon: '🤖', title: 'Autonomous Monitoring', desc: 'IoT sensor arrays and robot scouts continuously log field conditions — no human approximations, only hardware-verified data.' },
                { icon: '📜', title: 'Certifications', desc: 'Organic, GAP, GlobalG.A.P., and other certification documents are attached to each product listing with verification links.' },
                { icon: '🌡️', title: 'Post-Harvest Chain', desc: 'Cold-chain temperature logs from harvest to packing to your door, ensuring product quality is never compromised.' },
                { icon: '♻️', title: 'Sustainability Score', desc: 'Water usage efficiency, carbon footprint per kilogram, and biodiversity impact scores powered by real sensor data.' },
              ].map((item) => (
                <div key={item.title} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-green-800 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-sm text-gray-400 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

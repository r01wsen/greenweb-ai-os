import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// ─── Stripe Pricing Tiers ─────────────────────────────────────────────────────
// Set STRIPE_SECRET_KEY and these price IDs in your Vercel env vars

const STRIPE_PLANS = {
  starter: {
    name: 'Starter',
    price_id: process.env.STRIPE_PRICE_STARTER ?? '',
    price_monthly: 49,
    currency: 'USD',
    features: ['Up to 3 farms', 'Up to 50 sensors', 'Up to 5 robots', 'Basic reports', 'Email support'],
    max_farms: 3,
    max_sensors: 50,
    max_robots: 5,
  },
  professional: {
    name: 'Professional',
    price_id: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
    price_monthly: 149,
    currency: 'USD',
    features: ['Up to 10 farms', 'Up to 200 sensors', 'Up to 20 robots', 'AI vision analysis', 'Generative reports', 'Video consultations', 'Priority support'],
    max_farms: 10,
    max_sensors: 200,
    max_robots: 20,
  },
  enterprise: {
    name: 'Enterprise',
    price_id: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
    price_monthly: 499,
    currency: 'USD',
    features: ['Unlimited farms', 'Unlimited sensors', 'Unlimited robots', 'Custom AI models', 'Dedicated n8n instance', 'White-label option', 'SLA guarantee', 'Dedicated support'],
    max_farms: 9999,
    max_sensors: 9999,
    max_robots: 9999,
  },
}

async function getServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } }
  )
}

async function getStripe() {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not configured.')
  const Stripe = (await import('stripe')).default
  return new Stripe(stripeKey, { apiVersion: '2024-04-10' })
}

// GET /api/billing — return pricing plans and current subscription status
export async function GET() {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ plans: STRIPE_PLANS, subscription: null })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ plans: STRIPE_PLANS, subscription: null })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('tier, stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at')
    .eq('id', profile.organization_id)
    .single()

  return NextResponse.json({
    plans: STRIPE_PLANS,
    current_tier: org?.tier ?? 'starter',
    subscription: {
      status: org?.subscription_status ?? 'active',
      stripe_subscription_id: org?.stripe_subscription_id,
      trial_ends_at: org?.trial_ends_at,
    },
  })
}

// POST /api/billing — create checkout session or customer portal
export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as {
    action: 'create_checkout' | 'customer_portal' | 'cancel'
    tier?: keyof typeof STRIPE_PLANS
    success_url?: string
    cancel_url?: string
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, email')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single()

  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const stripe = await getStripe()
  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (body.action === 'create_checkout') {
    const plan = STRIPE_PLANS[body.tier ?? 'professional']
    if (!plan.price_id) {
      return NextResponse.json({ error: `Stripe price ID for ${body.tier} is not configured.` }, { status: 500 })
    }

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.billing_email,
        name: org.name,
        metadata: { organization_id: org.id },
      })
      customerId = customer.id
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.price_id, quantity: 1 }],
      success_url: `${origin}/dashboard/agrisphere?billing=success&tier=${body.tier}`,
      cancel_url: `${origin}/pricing?billing=cancelled`,
      subscription_data: {
        metadata: { organization_id: org.id, tier: body.tier },
        trial_period_days: org.tier === 'starter' ? 14 : undefined,
      },
      metadata: { organization_id: org.id, tier: body.tier ?? 'professional' },
    })

    return NextResponse.json({ checkout_url: session.url })
  }

  if (body.action === 'customer_portal') {
    if (!org.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found. Subscribe first.' }, { status: 400 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/dashboard/agrisphere?section=billing`,
    })

    return NextResponse.json({ portal_url: session.url })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

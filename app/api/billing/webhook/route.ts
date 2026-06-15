import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const TIER_LIMITS: Record<string, { max_farms: number; max_sensors: number; max_robots: number }> = {
  starter:      { max_farms: 3,    max_sensors: 50,   max_robots: 5 },
  professional: { max_farms: 10,   max_sensors: 200,  max_robots: 20 },
  enterprise:   { max_farms: 9999, max_sensors: 9999, max_robots: 9999 },
}

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey || !webhookSecret) {
    console.error('[Stripe Webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: { type: string; data: { object: Record<string, unknown> } }

  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret) as typeof event
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceSupabase()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        metadata?: { organization_id?: string; tier?: string }
        subscription?: string
        customer?: string
      }
      const orgId = session.metadata?.organization_id
      const tier = session.metadata?.tier ?? 'professional'
      const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.professional

      if (orgId) {
        await supabase.from('organizations').update({
          tier,
          stripe_subscription_id: session.subscription,
          stripe_customer_id: session.customer,
          subscription_status: 'active',
          max_farms: limits.max_farms,
          max_sensors: limits.max_sensors,
          max_robots: limits.max_robots,
        }).eq('id', orgId)

        console.log(`[Stripe Webhook] org ${orgId} upgraded to ${tier}`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as {
        id: string
        status: string
        metadata?: { organization_id?: string; tier?: string }
        items?: { data?: Array<{ price?: { metadata?: { tier?: string } } }> }
      }
      const orgId = sub.metadata?.organization_id
      const tier = sub.metadata?.tier
        ?? sub.items?.data?.[0]?.price?.metadata?.tier
        ?? 'professional'
      const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.professional

      if (orgId) {
        await supabase.from('organizations').update({
          tier,
          subscription_status: sub.status,
          max_farms: limits.max_farms,
          max_sensors: limits.max_sensors,
          max_robots: limits.max_robots,
        }).eq('id', orgId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as {
        metadata?: { organization_id?: string }
      }
      const orgId = sub.metadata?.organization_id

      if (orgId) {
        // Downgrade to starter on cancellation
        await supabase.from('organizations').update({
          tier: 'starter',
          subscription_status: 'cancelled',
          stripe_subscription_id: null,
          max_farms: TIER_LIMITS.starter.max_farms,
          max_sensors: TIER_LIMITS.starter.max_sensors,
          max_robots: TIER_LIMITS.starter.max_robots,
        }).eq('id', orgId)

        console.log(`[Stripe Webhook] org ${orgId} subscription cancelled, downgraded to starter`)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as {
        customer?: string
        subscription?: string
        hosted_invoice_url?: string
      }

      // Find org by stripe customer id and create an alert
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('stripe_customer_id', invoice.customer ?? '')
        .single()

      if (org) {
        await supabase.from('organizations').update({
          subscription_status: 'past_due',
        }).eq('id', org.id)

        console.error(`[Stripe Webhook] Payment failed for org ${org.id}`)
      }
      break
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}

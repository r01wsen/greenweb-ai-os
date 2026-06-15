# 🌿 AgriSphere — Autonomous Farm Management Platform

> **Multi-tenant AI-powered farm management, IoT automation, and robotics command center.**
> Built on Next.js 14, Supabase, n8n, and hybrid AI (Cloud + Local Ollama).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/r01wsen/greenweb-ai-os)

---

## 🗺️ What's Built

### Role-Based Dashboard System
| Role | Access |
|------|--------|
| **Platform Admin** | Cross-farm aggregator, org billing tiers, global robot fleet, regional stats, farm audit jump |
| **Farm Owner** | Sensor gauges, 7-day activity calendar, automation rules, robot fleet, crop batches, AI voice |
| **Operator** | Same as Farm Owner (write access to operational controls) |
| **Customer / Buyer** | Order tracking, product catalog, farm transparency & traceability |

### Core Feature Modules
- **📡 IoT Sensor Array** — Real-time Air Temp, Humidity, Soil NPK, EC, CO₂, Leaf Wetness, pH, Flow Rate
- **🤖 Robotics Fleet** — GPS tracking, battery monitoring, task dispatch (drone, rover, harvester, arm)
- **⚙️ Automation Rules** — IF-THEN threshold triggers → valve control, MQTT, webhooks, robot tasks
- **📅 7-Day Activity Calendar** — Template-driven crop lifecycle with auto-populated milestone activities
- **🎙️ Voice Field Commander** — Web Audio API + OpenAI Whisper + client-side intent routing
- **🔍 AI Vision Diagnosis** — GPT-4o / Claude multipart crop disease detection with severity scoring
- **📊 Generative Reports** — Monthly summaries, investor briefings, desertification projections, digital twins
- **📞 Video Consultations** — Whereby / Twilio WebRTC P2P sessions between operators and agronomists
- **🛒 Customer Buyer Portal** — Order tracking, delivery status, farm transparency, invoices
- **💳 Stripe SaaS Billing** — 3-tier plans (Starter $49 / Pro $149 / Enterprise $499) with webhooks
- **🔒 Multi-Tenant RLS** — PostgreSQL Row-Level Security isolates every organization completely

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Auth + DB | Supabase (PostgreSQL + pgvector + RLS) |
| Realtime | Supabase Realtime (WebSocket postgres_changes) |
| AI Models | OpenAI GPT-4o, Whisper, Claude claude-opus-4-5 |
| IoT Bridge | n8n (MQTT → ESP32/Raspberry Pi actuators) |
| Payments | Stripe (subscriptions, webhooks, customer portal) |
| Video | Whereby / Twilio Video WebRTC |
| Deployment | Vercel (Edge + Node.js runtimes) |
| Local AI | Ollama (optional private inference) |

---

## 📁 Project Structure

```
greenweb-ai-os/
├── app/
│   ├── (dashboard)/[domain]/page.tsx    # RBAC role-aware dashboard router
│   ├── api/
│   │   ├── chat/route.ts               # Multi-domain AI chat (existing)
│   │   ├── billing/route.ts            # Stripe checkout + customer portal
│   │   ├── billing/webhook/route.ts    # Stripe lifecycle webhooks
│   │   ├── generative/route.ts         # Vision, reports, video, digital twins
│   │   └── v1/
│   │       ├── voice/execute/route.ts  # OpenAI Whisper transcription
│   │       └── iot/valve-control/route.ts  # n8n/MQTT hardware bridge
│   └── pricing/page.tsx                # Public SaaS pricing page
├── components/
│   ├── dashboard/
│   │   ├── GlobalAdminDashboard.tsx    # Cross-farm admin view
│   │   ├── FarmOwnerDashboard.tsx      # Full operational dashboard
│   │   └── CustomerPortal.tsx          # Buyer portal
│   └── ai/
│       └── VoiceCommander.tsx          # Web Audio API field commander
├── lib/supabase/
│   ├── types.ts                        # All TypeScript interfaces
│   └── client.ts                       # Browser + server clients + realtime
└── supabase/migrations/
    └── 001_agrisphere_core_schema.sql  # 22 tables + RLS + triggers
```

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/r01wsen/greenweb-ai-os.git
cd greenweb-ai-os
npm install
```

### 2. Set Up Environment
```bash
cp .env.example .env.local
# Fill in your Supabase, Stripe, OpenAI keys
```

### 3. Run Supabase Migration
```bash
npx supabase db push
# Or paste supabase/migrations/001_agrisphere_core_schema.sql into Supabase SQL editor
```

### 4. Start Development
```bash
npm run dev
```

---

## 🔑 Required Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only) |
| `OPENAI_API_KEY` | For GPT-4o vision + Whisper voice |
| `ANTHROPIC_API_KEY` | Fallback for vision + reports |
| `STRIPE_SECRET_KEY` | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `N8N_WEBHOOK_URL` | Your n8n instance for IoT bridge |

See `.env.example` for full list including optional Whereby, Twilio, Ollama.

---

## 💰 Monetization (SaaS Plans)

| Plan | Price | Farms | Sensors | Robots |
|------|-------|-------|---------|--------|
| Starter | $49/mo | 3 | 50 | 5 |
| Professional | $149/mo | 10 | 200 | 20 |
| Enterprise | $499/mo | Unlimited | Unlimited | Unlimited |

Annual billing saves 20%. Stripe customer portal for self-serve plan management.

---

## 📡 IoT Hardware Setup

AgriSphere talks to hardware via n8n → MQTT broker → ESP32/Raspberry Pi.

**Sensor data flows:**
`Hardware → MQTT → n8n → Supabase sensor_readings → Realtime → Dashboard`

**Command flows:**
`Dashboard → /api/v1/iot/valve-control → n8n → MQTT → Actuator`

MQTT topic pattern: `agrisphere/{farmId}/irrigation/{zone}/control`

---

## 🗄️ Database Schema (22 Tables)

Organizations → Profiles → Farms → Sensors → SensorReadings
→ AutomationRules → RoboticsFleet → RobotTasks
→ CropTemplates → CropTemplateActivities → CropBatches → ActivityLogs
→ Products → Orders → Alerts → VoiceCommandLogs
→ VisionAnalyses → GeneratedReports → VideoSessions
→ ProductionLogs → InputLogs → ValveCommands

All tables have Row-Level Security (RLS) with organization-scoped policies.

---

## 📄 License

MIT — built for scale, designed for profit.

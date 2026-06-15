-- ============================================================
-- AgriSphere Core Schema - Migration 001
-- Multi-tenant PostgreSQL schema with Row-Level Security (RLS)
-- All tables are organization-scoped for full tenant isolation
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─── ENUMS ──────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('platform_admin', 'farm_owner', 'operator', 'customer');
CREATE TYPE sensor_protocol AS ENUM ('wifi', 'mqtt', 'lorawan', 'zigbee', 'bluetooth');
CREATE TYPE sensor_status AS ENUM ('online', 'offline', 'warning', 'error', 'maintenance');
CREATE TYPE robot_status AS ENUM ('idle', 'active', 'autonomous', 'manual', 'charging', 'error');
CREATE TYPE automation_trigger_type AS ENUM ('threshold', 'schedule', 'manual', 'event');
CREATE TYPE crop_activity_type AS ENUM (
  'planting', 'germination', 'fertigation', 'scouting',
  'pruning', 'pest_control', 'harvesting', 'post_harvest', 'soil_prep'
);
CREATE TYPE logistics_status AS ENUM (
  'pending', 'processing', 'packed', 'shipped', 'in_transit', 'delivered', 'returned'
);
CREATE TYPE org_tier AS ENUM ('starter', 'professional', 'enterprise');
CREATE TYPE farm_type AS ENUM ('greenhouse', 'open_field', 'hydroponic', 'vertical', 'mixed');

-- ─── ORGANIZATIONS (Multi-tenant root) ──────────────────────────────────────

CREATE TABLE organizations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  tier             org_tier NOT NULL DEFAULT 'starter',
  billing_email    TEXT NOT NULL,
  region           TEXT NOT NULL DEFAULT 'global',
  max_farms        INTEGER NOT NULL DEFAULT 3,
  max_sensors      INTEGER NOT NULL DEFAULT 50,
  max_robots       INTEGER NOT NULL DEFAULT 5,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'active',
  trial_ends_at    TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PROFILES (Extends auth.users) ──────────────────────────────────────────

CREATE TABLE profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  full_name             TEXT NOT NULL DEFAULT '',
  avatar_url            TEXT,
  role                  user_role NOT NULL DEFAULT 'operator',
  phone                 TEXT,
  timezone              TEXT NOT NULL DEFAULT 'UTC',
  preferred_language    TEXT NOT NULL DEFAULT 'en',
  onboarding_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── FARMS ──────────────────────────────────────────────────────────────────

CREATE TABLE farms (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  altitude_m      REAL,
  area_hectares   REAL NOT NULL DEFAULT 1.0,
  country         TEXT NOT NULL DEFAULT 'Unknown',
  region          TEXT NOT NULL DEFAULT 'Unknown',
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  farm_type       farm_type NOT NULL DEFAULT 'open_field',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- ─── SENSORS ────────────────────────────────────────────────────────────────

CREATE TABLE sensors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id             UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hardware_uid        TEXT NOT NULL UNIQUE,  -- MAC or device serial
  name                TEXT NOT NULL,
  sensor_type         TEXT NOT NULL,
  protocol            sensor_protocol NOT NULL DEFAULT 'mqtt',
  firmware_version    TEXT,
  ip_address          TEXT,
  mqtt_topic          TEXT,
  location_zone       TEXT NOT NULL DEFAULT 'default',
  location_description TEXT,
  battery_percent     REAL,
  signal_strength_dbm REAL,
  status              sensor_status NOT NULL DEFAULT 'offline',
  last_seen_at        TIMESTAMPTZ,
  calibration_offset  REAL NOT NULL DEFAULT 0.0,
  alert_min           REAL,
  alert_max           REAL,
  raw_value_matrix    JSONB NOT NULL DEFAULT '{}',  -- full raw payload from hardware
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sensors_farm_id ON sensors(farm_id);
CREATE INDEX idx_sensors_status ON sensors(status);
CREATE INDEX idx_sensors_hardware_uid ON sensors(hardware_uid);

-- ─── SENSOR READINGS (Time-series) ──────────────────────────────────────────

CREATE TABLE sensor_readings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sensor_id       UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  value           REAL NOT NULL,
  unit            TEXT NOT NULL DEFAULT '',
  quality_score   REAL NOT NULL DEFAULT 1.0 CHECK (quality_score BETWEEN 0 AND 1),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sensor_readings_farm_time ON sensor_readings(farm_id, recorded_at DESC);
CREATE INDEX idx_sensor_readings_sensor_time ON sensor_readings(sensor_id, recorded_at DESC);

-- ─── AUTOMATION RULES ───────────────────────────────────────────────────────

CREATE TABLE automation_rules (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id               UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type          automation_trigger_type NOT NULL DEFAULT 'threshold',
  trigger_sensor_id     UUID REFERENCES sensors(id) ON DELETE SET NULL,
  trigger_operator      TEXT NOT NULL DEFAULT '<' CHECK (trigger_operator IN ('<', '>', '<=', '>=', '==', '!=')),
  trigger_threshold     REAL,
  trigger_cron          TEXT,  -- cron expression for scheduled triggers
  action_type           TEXT NOT NULL CHECK (action_type IN ('webhook', 'mqtt_publish', 'notification', 'valve_control', 'robot_task')),
  action_webhook_url    TEXT,
  action_mqtt_topic     TEXT,
  action_mqtt_payload   TEXT,
  action_device_id      UUID,
  action_device_command TEXT,
  notification_channels TEXT[] NOT NULL DEFAULT '{}',
  cooldown_minutes      INTEGER NOT NULL DEFAULT 15,
  last_triggered_at     TIMESTAMPTZ,
  trigger_count         INTEGER NOT NULL DEFAULT 0,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_farm ON automation_rules(farm_id);
CREATE INDEX idx_automation_rules_active ON automation_rules(is_active);

-- ─── ROBOTICS FLEET ─────────────────────────────────────────────────────────

CREATE TABLE robotics_fleet (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id              UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hardware_uid         TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  model                TEXT NOT NULL DEFAULT 'Unknown',
  robot_type           TEXT NOT NULL DEFAULT 'ground_rover' CHECK (robot_type IN ('drone', 'ground_rover', 'arm', 'conveyor', 'harvester')),
  status               robot_status NOT NULL DEFAULT 'idle',
  operation_mode       TEXT NOT NULL DEFAULT 'manual' CHECK (operation_mode IN ('manual', 'autonomous', 'semi_autonomous')),
  current_task         TEXT,
  gps_latitude         DOUBLE PRECISION,
  gps_longitude        DOUBLE PRECISION,
  gps_altitude_m       REAL,
  heading_degrees      REAL,
  speed_mps            REAL,
  battery_percent      REAL NOT NULL DEFAULT 100,
  battery_voltage      REAL,
  total_runtime_hours  REAL NOT NULL DEFAULT 0,
  firmware_version     TEXT,
  last_heartbeat_at    TIMESTAMPTZ,
  assigned_zone        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_robotics_fleet_farm ON robotics_fleet(farm_id);
CREATE INDEX idx_robotics_fleet_status ON robotics_fleet(status);

-- ─── ROBOT TASKS ────────────────────────────────────────────────────────────

CREATE TABLE robot_tasks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  robot_id            UUID NOT NULL REFERENCES robotics_fleet(id) ON DELETE CASCADE,
  farm_id             UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_type           TEXT NOT NULL CHECK (task_type IN ('scouting', 'spraying', 'harvesting', 'mapping', 'delivery', 'charging', 'maintenance')),
  status              TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority            INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  description         TEXT NOT NULL DEFAULT '',
  waypoints           JSONB NOT NULL DEFAULT '[]',
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  duration_seconds    INTEGER,
  distance_meters     REAL,
  battery_used_percent REAL,
  result_data         JSONB NOT NULL DEFAULT '{}',
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_robot_tasks_robot ON robot_tasks(robot_id);
CREATE INDEX idx_robot_tasks_farm_status ON robot_tasks(farm_id, status);

-- ─── CROP TEMPLATES ─────────────────────────────────────────────────────────

CREATE TABLE crop_templates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  variety               TEXT NOT NULL DEFAULT '',
  crop_family           TEXT NOT NULL DEFAULT '',
  typical_duration_days INTEGER NOT NULL DEFAULT 90,
  description           TEXT,
  planting_density_per_m2 REAL,
  optimal_temp_min_c    REAL,
  optimal_temp_max_c    REAL,
  optimal_humidity_min  REAL,
  optimal_humidity_max  REAL,
  optimal_ph_min        REAL,
  optimal_ph_max        REAL,
  is_public             BOOLEAN NOT NULL DEFAULT FALSE,
  embedding             vector(1536),  -- for semantic crop search via pgvector
  created_by            UUID NOT NULL REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CROP TEMPLATE ACTIVITIES ────────────────────────────────────────────────

CREATE TABLE crop_template_activities (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_template_id      UUID NOT NULL REFERENCES crop_templates(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  activity_type         crop_activity_type NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  day_offset_from_planting INTEGER NOT NULL DEFAULT 0,
  duration_days         INTEGER NOT NULL DEFAULT 1,
  is_mandatory          BOOLEAN NOT NULL DEFAULT TRUE,
  inputs                JSONB NOT NULL DEFAULT '[]',  -- [{name, quantity, unit}]
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crop_template_activities_template ON crop_template_activities(crop_template_id);

-- ─── CROP BATCHES ────────────────────────────────────────────────────────────

CREATE TABLE crop_batches (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id               UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  crop_template_id      UUID REFERENCES crop_templates(id) ON DELETE SET NULL,
  name                  TEXT NOT NULL,
  zone                  TEXT NOT NULL DEFAULT 'default',
  area_m2               REAL NOT NULL DEFAULT 100,
  planting_date         DATE NOT NULL,
  expected_harvest_date DATE NOT NULL,
  actual_harvest_date   DATE,
  status                TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'harvested', 'failed')),
  quantity_planted      REAL NOT NULL DEFAULT 0,
  quantity_harvested    REAL,
  unit                  TEXT NOT NULL DEFAULT 'kg',
  notes                 TEXT,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crop_batches_farm ON crop_batches(farm_id);
CREATE INDEX idx_crop_batches_status ON crop_batches(status);

-- ─── AUTO-POPULATE ACTIVITIES ON CROP BATCH CREATION ────────────────────────

CREATE OR REPLACE FUNCTION populate_crop_batch_activities()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_logs (
    crop_batch_id, farm_id, organization_id,
    crop_template_activity_id, activity_type, name,
    scheduled_date, status, created_at, updated_at
  )
  SELECT
    NEW.id,
    NEW.farm_id,
    NEW.organization_id,
    cta.id,
    cta.activity_type,
    cta.name,
    NEW.planting_date + cta.day_offset_from_planting,
    'scheduled',
    NOW(),
    NOW()
  FROM crop_template_activities cta
  WHERE cta.crop_template_id = NEW.crop_template_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── ACTIVITY LOGS ───────────────────────────────────────────────────────────

CREATE TABLE activity_logs (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crop_batch_id             UUID NOT NULL REFERENCES crop_batches(id) ON DELETE CASCADE,
  farm_id                   UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  crop_template_activity_id UUID REFERENCES crop_template_activities(id) ON DELETE SET NULL,
  activity_type             crop_activity_type NOT NULL,
  name                      TEXT NOT NULL,
  scheduled_date            DATE NOT NULL,
  completed_date            DATE,
  status                    TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'skipped')),
  performed_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes                     TEXT,
  attachments               TEXT[] NOT NULL DEFAULT '{}',
  inputs_used               JSONB NOT NULL DEFAULT '[]',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_farm_date ON activity_logs(farm_id, scheduled_date);
CREATE INDEX idx_activity_logs_batch ON activity_logs(crop_batch_id);

-- Attach trigger after activity_logs table exists
CREATE TRIGGER trg_populate_crop_batch_activities
  AFTER INSERT ON crop_batches
  FOR EACH ROW
  WHEN (NEW.crop_template_id IS NOT NULL)
  EXECUTE FUNCTION populate_crop_batch_activities();

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  crop_batch_id   UUID REFERENCES crop_batches(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  sku             TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'produce',
  unit            TEXT NOT NULL DEFAULT 'kg',
  unit_price      REAL NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  stock_quantity  REAL NOT NULL DEFAULT 0,
  certifications  TEXT[] NOT NULL DEFAULT '{}',
  qr_code         TEXT,
  description     TEXT,
  image_urls      TEXT[] NOT NULL DEFAULT '{}',
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(farm_id, sku)
);

-- ─── ORDERS ──────────────────────────────────────────────────────────────────

CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  farm_id          UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  customer_id      UUID NOT NULL REFERENCES profiles(id),
  order_number     TEXT NOT NULL UNIQUE DEFAULT 'ORD-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
  status           logistics_status NOT NULL DEFAULT 'pending',
  items            JSONB NOT NULL DEFAULT '[]',
  subtotal         REAL NOT NULL DEFAULT 0,
  tax              REAL NOT NULL DEFAULT 0,
  shipping         REAL NOT NULL DEFAULT 0,
  total            REAL NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'USD',
  shipping_address JSONB NOT NULL DEFAULT '{}',
  tracking_number  TEXT,
  estimated_delivery TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  notes            TEXT,
  invoice_url      TEXT,
  stripe_payment_intent_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_farm ON orders(farm_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ─── ALERTS ──────────────────────────────────────────────────────────────────

CREATE TABLE alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id      UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type   TEXT NOT NULL CHECK (alert_type IN ('sensor_threshold', 'robot_error', 'automation_failure', 'climate', 'fire', 'security', 'system')),
  severity     TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL DEFAULT '',
  source_id    UUID,
  source_type  TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  is_resolved  BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_farm_unresolved ON alerts(farm_id, is_resolved, created_at DESC);
CREATE INDEX idx_alerts_org_critical ON alerts(organization_id, severity, is_resolved);

-- ─── VOICE COMMAND LOGS ──────────────────────────────────────────────────────

CREATE TABLE voice_command_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id          UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id),
  raw_transcript   TEXT NOT NULL,
  parsed_intent    TEXT NOT NULL,
  parsed_entities  JSONB NOT NULL DEFAULT '{}',
  action_taken     TEXT,
  action_success   BOOLEAN,
  confidence_score REAL,
  audio_duration_ms INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── VISION ANALYSES ─────────────────────────────────────────────────────────

CREATE TABLE vision_analyses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  zone            TEXT NOT NULL DEFAULT 'unknown',
  crop_name       TEXT,
  image_url       TEXT,
  analysis_result JSONB NOT NULL DEFAULT '{}',
  confidence      REAL,
  severity        TEXT,
  analyzed_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vision_analyses_farm ON vision_analyses(farm_id, created_at DESC);

-- ─── GENERATED REPORTS ───────────────────────────────────────────────────────

CREATE TABLE generated_reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id          UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type      TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  pdf_url          TEXT,
  generated_by     UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── VIDEO SESSIONS ──────────────────────────────────────────────────────────

CREATE TABLE video_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id           UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  host_id           UUID NOT NULL REFERENCES profiles(id),
  participant_email TEXT NOT NULL,
  session_type      TEXT NOT NULL DEFAULT 'agronomist_consult',
  provider          TEXT NOT NULL DEFAULT 'internal',
  meeting_id        TEXT NOT NULL,
  guest_url         TEXT NOT NULL,
  host_url          TEXT NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PRODUCTION LOGS (Voice: milk, harvest) ──────────────────────────────────

CREATE TABLE production_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id      UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  log_type     TEXT NOT NULL CHECK (log_type IN ('milk', 'harvest', 'eggs', 'honey', 'custom')),
  quantity     REAL NOT NULL,
  unit         TEXT NOT NULL,
  crop_name    TEXT,
  group_id     TEXT,
  recorded_by  UUID REFERENCES profiles(id),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes        TEXT
);

CREATE INDEX idx_production_logs_farm ON production_logs(farm_id, recorded_at DESC);

-- ─── INPUT LOGS (Fertilizer, pesticide applications) ─────────────────────────

CREATE TABLE input_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id      UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  input_type   TEXT NOT NULL CHECK (input_type IN ('fertilizer', 'pesticide', 'fungicide', 'herbicide', 'water', 'custom')),
  quantity     REAL NOT NULL,
  unit         TEXT NOT NULL,
  product_name TEXT,
  zone         TEXT,
  applied_by   UUID REFERENCES profiles(id),
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes        TEXT
);

-- ─── VALVE COMMANDS ──────────────────────────────────────────────────────────

CREATE TABLE valve_commands (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id    UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  zone       TEXT NOT NULL,
  command    TEXT NOT NULL CHECK (command IN ('OPEN', 'CLOSE', 'PULSE')),
  duration_seconds INTEGER,  -- for PULSE
  issued_by  UUID REFERENCES profiles(id),
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  execution_status TEXT DEFAULT 'pending' CHECK (execution_status IN ('pending', 'sent', 'confirmed', 'failed'))
);

-- ─── updated_at TRIGGER ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','profiles','farms','sensors','automation_rules',
    'robotics_fleet','crop_templates','crop_batches','activity_logs',
    'products','orders'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t, t
    );
  END LOOP;
END;
$$;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

-- Enable RLS on all tenant tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','profiles','farms','sensors','sensor_readings',
    'automation_rules','robotics_fleet','robot_tasks','crop_templates',
    'crop_template_activities','crop_batches','activity_logs','products',
    'orders','alerts','voice_command_logs','vision_analyses',
    'generated_reports','video_sessions','production_logs',
    'input_logs','valve_commands'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

-- ── Helper function: get current user's org id ────────────────────────────────
CREATE OR REPLACE FUNCTION auth_organization_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper function: is platform admin ───────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT role = 'platform_admin' FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── organizations ─────────────────────────────────────────────────────────────
CREATE POLICY "orgs_read_own" ON organizations
  FOR SELECT USING (
    auth_is_platform_admin() OR id = auth_organization_id()
  );

CREATE POLICY "orgs_platform_admin_all" ON organizations
  FOR ALL USING (auth_is_platform_admin());

-- ── profiles ──────────────────────────────────────────────────────────────────
CREATE POLICY "profiles_read_own_org" ON profiles
  FOR SELECT USING (
    auth_is_platform_admin()
    OR organization_id = auth_organization_id()
  );

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ── farms ─────────────────────────────────────────────────────────────────────
CREATE POLICY "farms_read_own_org" ON farms
  FOR SELECT USING (
    auth_is_platform_admin()
    OR organization_id = auth_organization_id()
  );

CREATE POLICY "farms_write_own_org" ON farms
  FOR ALL USING (
    auth_is_platform_admin()
    OR (
      organization_id = auth_organization_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('farm_owner', 'platform_admin')
    )
  );

-- ── sensors ───────────────────────────────────────────────────────────────────
CREATE POLICY "sensors_read_own_org" ON sensors
  FOR SELECT USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

CREATE POLICY "sensors_write_owner_or_operator" ON sensors
  FOR ALL USING (
    auth_is_platform_admin()
    OR (
      organization_id = auth_organization_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('farm_owner', 'operator', 'platform_admin')
    )
  );

-- ── sensor_readings ───────────────────────────────────────────────────────────
CREATE POLICY "sensor_readings_read_own_org" ON sensor_readings
  FOR SELECT USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

CREATE POLICY "sensor_readings_insert_own_org" ON sensor_readings
  FOR INSERT WITH CHECK (organization_id = auth_organization_id());

-- ── automation_rules ──────────────────────────────────────────────────────────
CREATE POLICY "automation_rules_own_org" ON automation_rules
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── robotics_fleet ────────────────────────────────────────────────────────────
CREATE POLICY "robotics_fleet_own_org" ON robotics_fleet
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── robot_tasks ───────────────────────────────────────────────────────────────
CREATE POLICY "robot_tasks_own_org" ON robot_tasks
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── crop_templates ────────────────────────────────────────────────────────────
CREATE POLICY "crop_templates_read" ON crop_templates
  FOR SELECT USING (
    auth_is_platform_admin()
    OR organization_id = auth_organization_id()
    OR is_public = TRUE
  );

CREATE POLICY "crop_templates_write_own_org" ON crop_templates
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── crop_template_activities ──────────────────────────────────────────────────
CREATE POLICY "crop_template_activities_own_org" ON crop_template_activities
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── crop_batches ──────────────────────────────────────────────────────────────
CREATE POLICY "crop_batches_own_org" ON crop_batches
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── activity_logs ─────────────────────────────────────────────────────────────
CREATE POLICY "activity_logs_own_org" ON activity_logs
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── products ──────────────────────────────────────────────────────────────────
CREATE POLICY "products_read_available" ON products
  FOR SELECT USING (
    auth_is_platform_admin()
    OR organization_id = auth_organization_id()
    OR is_available = TRUE
  );

CREATE POLICY "products_write_own_org" ON products
  FOR ALL USING (
    auth_is_platform_admin()
    OR (
      organization_id = auth_organization_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('farm_owner', 'platform_admin')
    )
  );

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE POLICY "orders_customer_own" ON orders
  FOR SELECT USING (
    auth_is_platform_admin()
    OR customer_id = auth.uid()
    OR organization_id = auth_organization_id()
  );

CREATE POLICY "orders_customer_insert" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "orders_farm_update" ON orders
  FOR UPDATE USING (
    auth_is_platform_admin()
    OR (
      organization_id = auth_organization_id()
      AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('farm_owner', 'operator', 'platform_admin')
    )
  );

-- ── alerts ────────────────────────────────────────────────────────────────────
CREATE POLICY "alerts_own_org" ON alerts
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── voice_command_logs ────────────────────────────────────────────────────────
CREATE POLICY "voice_logs_own_org" ON voice_command_logs
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── vision_analyses ───────────────────────────────────────────────────────────
CREATE POLICY "vision_analyses_own_org" ON vision_analyses
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── generated_reports ─────────────────────────────────────────────────────────
CREATE POLICY "generated_reports_own_org" ON generated_reports
  FOR ALL USING (
    auth_is_platform_admin() OR organization_id = auth_organization_id()
  );

-- ── video_sessions ────────────────────────────────────────────────────────────
CREATE POLICY "video_sessions_own_org" ON video_sessions
  FOR ALL USING (
    auth_is_platform_admin()
    OR organization_id = auth_organization_id()
    OR host_id = auth.uid()
  );

-- ── production_logs, input_logs, valve_commands ───────────────────────────────
CREATE POLICY "production_logs_own_org" ON production_logs
  FOR ALL USING (auth_is_platform_admin() OR organization_id = auth_organization_id());

CREATE POLICY "input_logs_own_org" ON input_logs
  FOR ALL USING (auth_is_platform_admin() OR organization_id = auth_organization_id());

CREATE POLICY "valve_commands_own_org" ON valve_commands
  FOR ALL USING (auth_is_platform_admin() OR organization_id = auth_organization_id());

-- ─── PROFILE AUTO-CREATE ON SIGNUP ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, organization_id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'organization_id')::UUID,
      (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
    ),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'operator')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

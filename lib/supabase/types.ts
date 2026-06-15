// AgriSphere - Supabase Database Types
// Auto-generated and extended for AgriSphere multi-tenant platform

export type UserRole = 'platform_admin' | 'farm_owner' | 'operator' | 'customer'

export type SensorProtocol = 'wifi' | 'mqtt' | 'lorawan' | 'zigbee' | 'bluetooth'

export type SensorStatus = 'online' | 'offline' | 'warning' | 'error' | 'maintenance'

export type RobotStatus = 'idle' | 'active' | 'autonomous' | 'manual' | 'charging' | 'error'

export type AutomationTriggerType = 'threshold' | 'schedule' | 'manual' | 'event'

export type CropActivityType =
  | 'planting'
  | 'germination'
  | 'fertigation'
  | 'scouting'
  | 'pruning'
  | 'pest_control'
  | 'harvesting'
  | 'post_harvest'
  | 'soil_prep'

export type LogisticsStatus =
  | 'pending'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'in_transit'
  | 'delivered'
  | 'returned'

export interface Organization {
  id: string
  name: string
  slug: string
  tier: 'starter' | 'professional' | 'enterprise'
  billing_email: string
  region: string
  max_farms: number
  max_sensors: number
  max_robots: number
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  phone: string | null
  timezone: string
  preferred_language: string
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface Farm {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  latitude: number
  longitude: number
  altitude_m: number | null
  area_hectares: number
  country: string
  region: string
  timezone: string
  farm_type: 'greenhouse' | 'open_field' | 'hydroponic' | 'vertical' | 'mixed'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Sensor {
  id: string
  farm_id: string
  organization_id: string
  hardware_uid: string
  name: string
  sensor_type:
    | 'air_temperature'
    | 'air_humidity'
    | 'soil_moisture'
    | 'soil_npk'
    | 'soil_ec'
    | 'co2'
    | 'leaf_wetness'
    | 'light_par'
    | 'wind_speed'
    | 'rainfall'
    | 'ph'
    | 'flow_rate'
    | 'tank_level'
  protocol: SensorProtocol
  firmware_version: string | null
  ip_address: string | null
  mqtt_topic: string | null
  location_zone: string
  location_description: string | null
  battery_percent: number | null
  signal_strength_dbm: number | null
  status: SensorStatus
  last_seen_at: string | null
  calibration_offset: number
  alert_min: number | null
  alert_max: number | null
  raw_value_matrix: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SensorReading {
  id: string
  sensor_id: string
  farm_id: string
  organization_id: string
  value: number
  unit: string
  quality_score: number
  recorded_at: string
}

export interface AutomationRule {
  id: string
  farm_id: string
  organization_id: string
  name: string
  description: string | null
  is_active: boolean
  trigger_type: AutomationTriggerType
  trigger_sensor_id: string | null
  trigger_operator: '<' | '>' | '<=' | '>=' | '==' | '!='
  trigger_threshold: number | null
  trigger_cron: string | null
  action_type: 'webhook' | 'mqtt_publish' | 'notification' | 'valve_control' | 'robot_task'
  action_webhook_url: string | null
  action_mqtt_topic: string | null
  action_mqtt_payload: string | null
  action_device_id: string | null
  action_device_command: string | null
  notification_channels: string[]
  cooldown_minutes: number
  last_triggered_at: string | null
  trigger_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface RoboticsFleet {
  id: string
  farm_id: string
  organization_id: string
  hardware_uid: string
  name: string
  model: string
  robot_type: 'drone' | 'ground_rover' | 'arm' | 'conveyor' | 'harvester'
  status: RobotStatus
  operation_mode: 'manual' | 'autonomous' | 'semi_autonomous'
  current_task: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  gps_altitude_m: number | null
  heading_degrees: number | null
  speed_mps: number | null
  battery_percent: number
  battery_voltage: number | null
  total_runtime_hours: number
  firmware_version: string | null
  last_heartbeat_at: string | null
  assigned_zone: string | null
  created_at: string
  updated_at: string
}

export interface RobotTask {
  id: string
  robot_id: string
  farm_id: string
  organization_id: string
  task_type: 'scouting' | 'spraying' | 'harvesting' | 'mapping' | 'delivery' | 'charging' | 'maintenance'
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  priority: number
  description: string
  waypoints: Array<{ lat: number; lng: number; alt?: number; action?: string }>
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
  distance_meters: number | null
  battery_used_percent: number | null
  result_data: Record<string, unknown>
  created_by: string
  created_at: string
}

export interface CropTemplate {
  id: string
  organization_id: string
  name: string
  variety: string
  crop_family: string
  typical_duration_days: number
  description: string | null
  planting_density_per_m2: number | null
  optimal_temp_min_c: number | null
  optimal_temp_max_c: number | null
  optimal_humidity_min: number | null
  optimal_humidity_max: number | null
  optimal_ph_min: number | null
  optimal_ph_max: number | null
  is_public: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface CropTemplateActivity {
  id: string
  crop_template_id: string
  organization_id: string
  activity_type: CropActivityType
  name: string
  description: string | null
  day_offset_from_planting: number
  duration_days: number
  is_mandatory: boolean
  inputs: Array<{ name: string; quantity: number; unit: string }>
  notes: string | null
  created_at: string
}

export interface CropBatch {
  id: string
  farm_id: string
  organization_id: string
  crop_template_id: string
  name: string
  zone: string
  area_m2: number
  planting_date: string
  expected_harvest_date: string
  actual_harvest_date: string | null
  status: 'planned' | 'active' | 'harvested' | 'failed'
  quantity_planted: number
  quantity_harvested: number | null
  unit: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  crop_batch_id: string
  farm_id: string
  organization_id: string
  crop_template_activity_id: string | null
  activity_type: CropActivityType
  name: string
  scheduled_date: string
  completed_date: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped'
  performed_by: string | null
  notes: string | null
  attachments: string[]
  inputs_used: Array<{ name: string; quantity: number; unit: string; cost?: number }>
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  farm_id: string
  organization_id: string
  crop_batch_id: string | null
  name: string
  sku: string
  category: string
  unit: string
  unit_price: number
  currency: string
  stock_quantity: number
  certifications: string[]
  qr_code: string | null
  description: string | null
  image_urls: string[]
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  organization_id: string
  farm_id: string
  customer_id: string
  order_number: string
  status: LogisticsStatus
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit: string
    unit_price: number
    total_price: number
  }>
  subtotal: number
  tax: number
  shipping: number
  total: number
  currency: string
  shipping_address: {
    street: string
    city: string
    state: string
    country: string
    zip: string
  }
  tracking_number: string | null
  estimated_delivery: string | null
  delivered_at: string | null
  notes: string | null
  invoice_url: string | null
  created_at: string
  updated_at: string
}

export interface VoiceCommandLog {
  id: string
  farm_id: string
  organization_id: string
  user_id: string
  raw_transcript: string
  parsed_intent: string
  parsed_entities: Record<string, unknown>
  action_taken: string | null
  action_success: boolean | null
  confidence_score: number | null
  audio_duration_ms: number | null
  created_at: string
}

export interface Alert {
  id: string
  farm_id: string
  organization_id: string
  alert_type: 'sensor_threshold' | 'robot_error' | 'automation_failure' | 'climate' | 'fire' | 'security' | 'system'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  source_id: string | null
  source_type: string | null
  is_read: boolean
  is_resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

// Dashboard aggregation types
export interface FarmDashboardStats {
  farm: Farm
  activeSensors: number
  totalSensors: number
  activeRobots: number
  totalRobots: number
  activeCropBatches: number
  pendingActivities: number
  unreadAlerts: number
  criticalAlerts: number
  recentReadings: Record<string, SensorReading>
}

export interface GlobalAdminStats {
  totalOrganizations: number
  totalFarms: number
  totalSensors: number
  totalRobots: number
  activeAlerts: number
  criticalAlerts: number
  regionBreakdown: Array<{ region: string; farm_count: number; sensor_count: number }>
  orgTierBreakdown: Record<string, number>
}

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

// ─── Intent Routing Map ──────────────────────────────────────────────────────

type IntentAction =
  | 'log_milk'
  | 'open_valve'
  | 'close_valve'
  | 'log_harvest'
  | 'log_fertilizer'
  | 'dispatch_robot'
  | 'trigger_irrigation'
  | 'stop_irrigation'
  | 'log_pest_observation'
  | 'log_sensor_anomaly'
  | 'schedule_activity'
  | 'unknown'

interface ParsedIntent {
  action: IntentAction
  entities: {
    quantity?: number
    unit?: string
    zone?: string
    group?: string
    crop?: string
    pest?: string
    sensor_type?: string
    value?: number
    robot_name?: string
    valve_id?: string
    date?: string
    notes?: string
  }
  confidence: number
  raw: string
}

interface VoiceCommandResult {
  transcript: string
  intent: ParsedIntent
  success: boolean
  message: string
}

// Intent pattern matching rules
const INTENT_PATTERNS: Array<{
  action: IntentAction
  patterns: RegExp[]
  extract: (match: RegExpMatchArray, full: string) => ParsedIntent['entities']
}> = [
  {
    action: 'log_milk',
    patterns: [
      /log\s+(\d+(?:\.\d+)?)\s*(liters?|l|litres?|kg|gallons?)\s+(?:of\s+)?milk(?:\s+for\s+(?:group|pen)\s+(\w+))?/i,
    ],
    extract: (m) => ({
      quantity: parseFloat(m[1]),
      unit: m[2]?.toLowerCase() ?? 'liters',
      group: m[3],
    }),
  },
  {
    action: 'open_valve',
    patterns: [
      /open\s+(?:irrigation\s+)?valve(?:\s+(?:in|at|for)?\s+(?:zone|area|section)?\s*([\w\s]+?))?(?:\s+now)?$/i,
      /start\s+(?:irrigation|watering)(?:\s+(?:in|at|for)?\s+(?:zone|area|section)?\s*([\w\s]+?))?/i,
    ],
    extract: (m) => ({ zone: m[1]?.trim() }),
  },
  {
    action: 'close_valve',
    patterns: [
      /close\s+(?:irrigation\s+)?valve(?:\s+(?:in|at|for)?\s+(?:zone|area|section)?\s*([\w\s]+?))?/i,
      /stop\s+(?:irrigation|watering)(?:\s+(?:in|at|for)?\s+(?:zone|area|section)?\s*([\w\s]+?))?/i,
    ],
    extract: (m) => ({ zone: m[1]?.trim() }),
  },
  {
    action: 'log_harvest',
    patterns: [
      /(?:log|record)\s+(\d+(?:\.\d+)?)\s*(kg|lbs?|tons?|boxes|crates|units)\s+(?:of\s+)?(\w+)\s+(?:harvest|harvested)/i,
    ],
    extract: (m) => ({
      quantity: parseFloat(m[1]),
      unit: m[2],
      crop: m[3],
    }),
  },
  {
    action: 'log_fertilizer',
    patterns: [
      /(?:log|record|applied?)\s+(\d+(?:\.\d+)?)\s*(kg|liters?|l)\s+(?:of\s+)?([\w\s]+?)\s+(?:fertilizer|fert|nutrient)/i,
    ],
    extract: (m) => ({
      quantity: parseFloat(m[1]),
      unit: m[2],
      notes: m[3]?.trim(),
    }),
  },
  {
    action: 'dispatch_robot',
    patterns: [
      /(?:send|dispatch|deploy)\s+(?:robot\s+)?([\w\s]+?)\s+(?:to|for)\s+([\w\s]+)/i,
    ],
    extract: (m) => ({
      robot_name: m[1]?.trim(),
      zone: m[2]?.trim(),
    }),
  },
  {
    action: 'log_pest_observation',
    patterns: [
      /(?:spotted|observed|found|logged)\s+([\w\s]+?)\s+(?:pest|infestation|disease)(?:\s+in\s+([\w\s]+?))?(?:\s+zone)?/i,
    ],
    extract: (m) => ({
      pest: m[1]?.trim(),
      zone: m[2]?.trim(),
    }),
  },
  {
    action: 'log_sensor_anomaly',
    patterns: [
      /(?:sensor|reading|level)\s+([\w_\s]+?)\s+(?:is|at|reads?)\s+(\d+(?:\.\d+)?)\s*([a-zA-Z%/°]+)?(?:\s+in\s+([\w\s]+))?/i,
    ],
    extract: (m) => ({
      sensor_type: m[1]?.trim().toLowerCase().replace(/\s+/g, '_'),
      value: parseFloat(m[2]),
      unit: m[3],
      zone: m[4]?.trim(),
    }),
  },
]

function parseIntent(transcript: string): ParsedIntent {
  const lower = transcript.toLowerCase().trim()

  for (const rule of INTENT_PATTERNS) {
    for (const pattern of rule.patterns) {
      const match = lower.match(pattern)
      if (match) {
        return {
          action: rule.action,
          entities: rule.extract(match, lower),
          confidence: 0.88,
          raw: transcript,
        }
      }
    }
  }

  return {
    action: 'unknown',
    entities: { notes: transcript },
    confidence: 0.0,
    raw: transcript,
  }
}

// ─── Execute intent against Supabase & API ───────────────────────────────────

async function executeIntent(
  intent: ParsedIntent,
  farmId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseBrowserClient()

  // Log voice command regardless of outcome
  await supabase.from('voice_command_logs').insert({
    farm_id: farmId,
    user_id: userId,
    raw_transcript: intent.raw,
    parsed_intent: intent.action,
    parsed_entities: intent.entities,
    confidence_score: intent.confidence,
  })

  switch (intent.action) {
    case 'log_milk': {
      const { error } = await supabase.from('production_logs').insert({
        farm_id: farmId,
        log_type: 'milk',
        quantity: intent.entities.quantity,
        unit: intent.entities.unit ?? 'liters',
        group_id: intent.entities.group ?? null,
        recorded_by: userId,
        recorded_at: new Date().toISOString(),
      })
      if (error) return { success: false, message: `Failed to log milk: ${error.message}` }
      return { success: true, message: `Logged ${intent.entities.quantity} ${intent.entities.unit ?? 'liters'} of milk${intent.entities.group ? ` for group ${intent.entities.group}` : ''}.` }
    }

    case 'open_valve':
    case 'close_valve': {
      const command = intent.action === 'open_valve' ? 'OPEN' : 'CLOSE'
      const { error } = await supabase.from('valve_commands').insert({
        farm_id: farmId,
        zone: intent.entities.zone ?? 'default',
        command,
        issued_by: userId,
        issued_at: new Date().toISOString(),
      })
      if (error) return { success: false, message: `Failed to ${command.toLowerCase()} valve: ${error.message}` }

      // Trigger n8n webhook for hardware execution
      try {
        await fetch('/api/v1/iot/valve-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ farmId, zone: intent.entities.zone, command }),
        })
      } catch (_) { /* n8n hook is best-effort */ }

      return { success: true, message: `Valve ${command.toLowerCase()}d${intent.entities.zone ? ` in zone ${intent.entities.zone}` : ''}.` }
    }

    case 'log_harvest': {
      const { error } = await supabase.from('production_logs').insert({
        farm_id: farmId,
        log_type: 'harvest',
        quantity: intent.entities.quantity,
        unit: intent.entities.unit,
        crop_name: intent.entities.crop,
        recorded_by: userId,
        recorded_at: new Date().toISOString(),
      })
      if (error) return { success: false, message: `Failed to log harvest: ${error.message}` }
      return { success: true, message: `Harvest recorded: ${intent.entities.quantity} ${intent.entities.unit} of ${intent.entities.crop}.` }
    }

    case 'log_fertilizer': {
      const { error } = await supabase.from('input_logs').insert({
        farm_id: farmId,
        input_type: 'fertilizer',
        quantity: intent.entities.quantity,
        unit: intent.entities.unit,
        product_name: intent.entities.notes,
        applied_by: userId,
        applied_at: new Date().toISOString(),
      })
      if (error) return { success: false, message: `Failed to log fertilizer: ${error.message}` }
      return { success: true, message: `Fertilizer application logged: ${intent.entities.quantity} ${intent.entities.unit} of ${intent.entities.notes}.` }
    }

    case 'dispatch_robot': {
      const { data: robot } = await supabase
        .from('robotics_fleet')
        .select('id')
        .eq('farm_id', farmId)
        .ilike('name', `%${intent.entities.robot_name ?? ''}%`)
        .limit(1)
        .single()

      if (!robot) return { success: false, message: `Robot "${intent.entities.robot_name}" not found.` }

      await supabase.from('robot_tasks').insert({
        robot_id: robot.id,
        farm_id: farmId,
        task_type: 'scouting',
        status: 'queued',
        priority: 5,
        description: `Voice dispatch to zone: ${intent.entities.zone}`,
        waypoints: [],
        created_by: userId,
      })
      return { success: true, message: `Robot dispatched to ${intent.entities.zone}.` }
    }

    case 'log_pest_observation': {
      await supabase.from('alerts').insert({
        farm_id: farmId,
        alert_type: 'sensor_threshold',
        severity: 'warning',
        title: `Pest Observation: ${intent.entities.pest}`,
        message: `Voice-logged pest sighting${intent.entities.zone ? ` in ${intent.entities.zone}` : ''}. Immediate scouting recommended.`,
        is_read: false,
        is_resolved: false,
      })
      return { success: true, message: `Pest observation logged for ${intent.entities.pest}${intent.entities.zone ? ` in zone ${intent.entities.zone}` : ''}.` }
    }

    case 'log_sensor_anomaly': {
      await supabase.from('alerts').insert({
        farm_id: farmId,
        alert_type: 'sensor_threshold',
        severity: 'warning',
        title: `Sensor Anomaly: ${intent.entities.sensor_type}`,
        message: `Field worker reported ${intent.entities.sensor_type} reading of ${intent.entities.value} ${intent.entities.unit ?? ''}${intent.entities.zone ? ` in zone ${intent.entities.zone}` : ''}.`,
        is_read: false,
        is_resolved: false,
      })
      return { success: true, message: `Anomaly logged for ${intent.entities.sensor_type} = ${intent.entities.value} ${intent.entities.unit ?? ''}.` }
    }

    default:
      return {
        success: false,
        message: 'Command not recognized. Try: "Log 50 kg tomato harvest" or "Open irrigation valve in zone 3".',
      }
  }
}

// ─── Audio Chunker ───────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'requesting' | 'recording' | 'processing' | 'done' | 'error'

interface VoiceCommanderProps {
  farmId: string
  onActionExecuted?: (action: string, entities: Record<string, unknown>) => void
}

export function VoiceCommander({ farmId, onActionExecuted }: VoiceCommanderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState<VoiceCommandResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [history, setHistory] = useState<VoiceCommandResult[]>([])
  const [manualInput, setManualInput] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  function visualizeAudio(stream: MediaStream) {
    const ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser

    function tick() {
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(dataArray)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      setAudioLevel(avg / 255)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  async function startRecording() {
    try {
      setError(null)
      setResult(null)
      setTranscript('')
      setRecordingState('requesting')

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      audioChunksRef.current = []

      visualizeAudio(stream)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        setAudioLevel(0)
        stream.getTracks().forEach((t) => t.stop())
        await processAudio()
      }

      recorder.start(250) // chunk every 250ms
      setRecordingState('recording')
    } catch (err) {
      setError('Microphone access denied. Please allow microphone permissions in your browser.')
      setRecordingState('error')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setRecordingState('processing')
    }
  }

  async function processAudio() {
    try {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      formData.append('farm_id', farmId)

      const response = await fetch('/api/v1/voice/execute', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`)
      }

      const { transcript: t } = await response.json() as { transcript: string }
      setTranscript(t)
      await handleTranscript(t)
    } catch (err) {
      // Fallback: if API unavailable, allow manual confirmation
      setError('Voice processing unavailable. Use the text input below.')
      setRecordingState('error')
    }
  }

  async function handleTranscript(text: string) {
    const intent = parseIntent(text)
    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()

    const execResult = await executeIntent(intent, farmId, user?.id ?? 'anonymous')

    const cmdResult: VoiceCommandResult = {
      transcript: text,
      intent,
      success: execResult.success,
      message: execResult.message,
    }

    setResult(cmdResult)
    setHistory((prev) => [cmdResult, ...prev].slice(0, 10))
    setRecordingState('done')

    if (execResult.success) {
      onActionExecuted?.(intent.action, intent.entities)
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualInput.trim()) return
    setTranscript(manualInput)
    setRecordingState('processing')
    setManualInput('')
    await handleTranscript(manualInput)
  }

  const EXAMPLE_COMMANDS = [
    'Log 10 liters of milk for group B',
    'Open irrigation valve in zone 3',
    'Log 200 kg tomato harvest',
    'Close irrigation valve in zone 1',
    'Dispatch robot Scout-1 to north field',
    'Spotted aphid pest in greenhouse section B',
    'Soil moisture reading is 12% in zone 4',
  ]

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Voice Field Commander</h2>
          <p className="text-xs text-gray-400 mt-0.5">Hands-free farm telemetry logging</p>
        </div>
        <span className="text-xs bg-green-900/40 text-green-300 border border-green-800 px-2 py-1 rounded-full">🎙️ Field AI</span>
      </div>

      {/* Mic Button */}
      <div className="px-6 py-8 flex flex-col items-center gap-6">
        <div className="relative">
          {/* Audio level rings */}
          {recordingState === 'recording' && (
            <>
              <div
                className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"
                style={{ transform: `scale(${1 + audioLevel * 0.5})` }}
              />
              <div
                className="absolute inset-0 rounded-full bg-red-500/10"
                style={{ transform: `scale(${1 + audioLevel * 1.2})` }}
              />
            </>
          )}
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={(e) => { e.preventDefault(); startRecording() }}
            onTouchEnd={(e) => { e.preventDefault(); stopRecording() }}
            disabled={recordingState === 'processing' || recordingState === 'requesting'}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-3xl transition-all shadow-xl
              ${recordingState === 'recording'
                ? 'bg-red-600 scale-110 shadow-red-900/50'
                : recordingState === 'processing'
                ? 'bg-yellow-700 cursor-not-allowed'
                : 'bg-green-700 hover:bg-green-600 active:scale-95'
              }`}
            aria-label="Hold to record voice command"
          >
            {recordingState === 'processing' ? (
              <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : '🎙️'}
          </button>
        </div>

        <p className="text-sm text-gray-400 text-center">
          {recordingState === 'idle' && 'Hold mic button to record a command'}
          {recordingState === 'requesting' && 'Requesting microphone access...'}
          {recordingState === 'recording' && (
            <span className="text-red-400 font-semibold animate-pulse">Recording... Release to process</span>
          )}
          {recordingState === 'processing' && (
            <span className="text-yellow-400">Transcribing and executing...</span>
          )}
          {recordingState === 'done' && 'Command processed successfully'}
          {recordingState === 'error' && <span className="text-red-400">Error occurred</span>}
        </p>

        {/* Result */}
        {result && (
          <div className={`w-full rounded-xl border p-4 ${result.success ? 'border-green-700 bg-green-950/30' : 'border-red-700 bg-red-950/20'}`}>
            {transcript && (
              <p className="text-xs text-gray-400 mb-2">
                <span className="font-semibold text-gray-300">Heard: </span>"{transcript}"
              </p>
            )}
            <p className="text-xs text-gray-400 mb-1">
              <span className="font-semibold text-gray-300">Intent: </span>
              <span className="font-mono">{result.intent.action}</span>
              <span className="ml-2 text-gray-600">({Math.round(result.intent.confidence * 100)}% confidence)</span>
            </p>
            <p className={`text-sm font-medium ${result.success ? 'text-green-300' : 'text-red-300'}`}>
              {result.success ? '✅' : '❌'} {result.message}
            </p>
          </div>
        )}

        {error && (
          <div className="w-full rounded-xl border border-red-800 bg-red-950/20 p-3">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Manual Text Fallback */}
        <form onSubmit={handleManualSubmit} className="w-full flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Or type a command manually..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-600"
          />
          <button
            type="submit"
            disabled={!manualInput.trim() || recordingState === 'processing'}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            Run
          </button>
        </form>
      </div>

      {/* Example Commands */}
      <div className="px-6 pb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Example Commands</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              onClick={() => { setManualInput(cmd) }}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full transition-colors border border-gray-700"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Command History */}
      {history.length > 0 && (
        <div className="border-t border-gray-800 px-6 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Commands</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history.map((h, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className={h.success ? 'text-green-400' : 'text-red-400'}>{h.success ? '✓' : '✗'}</span>
                <div className="min-w-0">
                  <p className="text-gray-400 truncate">"{h.transcript}"</p>
                  <p className="text-gray-600">{h.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

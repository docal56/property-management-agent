/** Default demo agent; override with NEXT_PUBLIC_ELEVENLABS_AGENT_ID. */
export const DEFAULT_ELEVENLABS_AGENT_ID =
  "agent_5301kp8hy4f8fdhrn0w8vz8q2p6e"

/** Must match ElevenLabs “server location” / data residency for the agent. */
export type ElevenLabsServerLocation =
  | "us"
  | "global"
  | "eu-residency"
  | "in-residency"

const SERVER_LOCATIONS = new Set<ElevenLabsServerLocation>([
  "us",
  "global",
  "eu-residency",
  "in-residency",
])

export function getElevenLabsAgentId(): string {
  const id = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID?.trim()
  return id && id.length > 0 ? id : DEFAULT_ELEVENLABS_AGENT_ID
}

/**
 * Region for LiveKit (browser) + Conversational AI API (server token route).
 * Use `eu-residency` or `in-residency` when the agent is on EU/India residency.
 */
export function getElevenLabsServerLocation():
  | ElevenLabsServerLocation
  | undefined {
  const raw = (
    process.env.ELEVENLABS_SERVER_LOCATION ??
    process.env.NEXT_PUBLIC_ELEVENLABS_SERVER_LOCATION
  )?.trim()
  if (!raw) return undefined
  if (!SERVER_LOCATIONS.has(raw as ElevenLabsServerLocation)) return undefined
  return raw as ElevenLabsServerLocation
}

/**
 * Use WebSocket audio instead of WebRTC (LiveKit). Helps on strict networks
 * that block UDP/WebRTC. Does not work with private agents that require a
 * server-issued WebRTC token unless you also use a signed WebSocket URL.
 */
export function preferElevenLabsVoiceWebSocket(): boolean {
  return (
    process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_WEBSOCKET?.toLowerCase() ===
    "true"
  )
}

import {
  ElevenLabsClient,
  ElevenLabsEnvironment,
} from "@elevenlabs/elevenlabs-js"
import { NextResponse } from "next/server"
import {
  getElevenLabsAgentId,
  getElevenLabsServerLocation,
} from "@/lib/elevenlabs-agent"

function createConversationalClient(apiKey: string) {
  const loc = getElevenLabsServerLocation()
  const environment =
    loc === "eu-residency"
      ? ElevenLabsEnvironment.ProductionEu
      : loc === "in-residency"
        ? ElevenLabsEnvironment.ProductionIndia
        : undefined
  return new ElevenLabsClient({
    apiKey,
    ...(environment ? { environment } : {}),
  })
}

/**
 * WebRTC voice requires a conversation token. Public agents can get one from
 * ElevenLabs without an API key (the browser does that). Agents with
 * "authentication" / private access need a server-side key via getWebrtcToken.
 *
 * Returns 501 when ELEVENLABS_API_KEY is unset so the client can fall back to
 * the public agentId-only token fetch.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server API key not configured" },
      { status: 501 }
    )
  }

  // Always use the server env agent id. The client bundles NEXT_PUBLIC_* at
  // compile time; comparing to a client-sent id caused 400s in dev when those
  // values drifted (stale chunk, env edit before dev restart, etc.).
  const agentId = getElevenLabsAgentId()

  try {
    const client = createConversationalClient(apiKey)
    const { token } = await client.conversationalAi.conversations.getWebrtcToken(
      { agentId }
    )
    return NextResponse.json({ token })
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not create conversation token"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

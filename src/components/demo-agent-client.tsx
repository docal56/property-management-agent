"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ui/conversation"
import { Orb } from "@/components/ui/orb"
import { ShimmeringText } from "@/components/ui/shimmering-text"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  ConversationProvider,
  useConversation,
} from "@elevenlabs/react"
import type { AgentState } from "@/components/ui/orb"
import { MessagesSquare, PhoneIcon, SendHorizontal } from "lucide-react"
import {
  getElevenLabsAgentId,
  getElevenLabsServerLocation,
  preferElevenLabsVoiceWebSocket,
} from "@/lib/elevenlabs-agent"

const AGENT_ID = getElevenLabsAgentId()

async function fetchServerWebRtcConversationToken(): Promise<string | null> {
  const res = await fetch("/api/elevenlabs/webrtc-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
  if (res.ok) {
    const data = (await res.json()) as { token?: string }
    return typeof data.token === "string" ? data.token : null
  }
  if (res.status === 501) return null
  const err = (await res.json().catch(() => ({}))) as { error?: string }
  throw new Error(
    err.error ?? `Voice token request failed (${res.status})`
  )
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type DemoTab = "phone" | "messaging"

function formatElevenLabsUserError(msg: unknown): string {
  const s = typeof msg === "string" ? msg : "Connection error"
  if (/could not establish pc connection/i.test(s)) {
    console.warn(
      "[ElevenLabs] WebRTC/LiveKit failed. Check VPN/firewall, set NEXT_PUBLIC_ELEVENLABS_SERVER_LOCATION if your agent is EU/India residency, or NEXT_PUBLIC_ELEVENLABS_VOICE_WEBSOCKET=true (public agents). See .env.example."
    )
    return `${s} — Often a VPN, strict Wi‑Fi, or the wrong ElevenLabs region. Try another network, turn VPN off, or ask your team to adjust the env vars in .env.example.`
  }
  return s
}

function EndCallIcon({ className }: { className?: string }) {
  const clipPathId = useId().replace(/:/g, "")
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height="54"
      viewBox="0 0 54 54"
      width="54"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill="#D61212"
        height="49"
        rx="24.5"
        width="49"
        x="2.5"
        y="2.5"
      />
      <rect
        height="49"
        rx="24.5"
        stroke="white"
        strokeWidth="5"
        width="49"
        x="2.5"
        y="2.5"
      />
      <g clipPath={`url(#${clipPathId})`}>
        <path
          d="M23.2291 25.3878C23.0515 25.4536 22.9016 25.5779 22.8041 25.7403C22.7067 25.9027 22.6674 26.0934 22.6928 26.2811L22.7576 26.7643C22.7942 27.0204 22.7707 27.2816 22.6889 27.527C22.607 27.7725 22.4692 27.9956 22.2862 28.1785L20.5185 29.9463C20.2059 30.2588 19.782 30.4344 19.34 30.4344C18.8979 30.4344 18.474 30.2588 18.1615 29.9463L16.3937 28.1785C16.0811 27.866 15.9055 27.442 15.9055 27C15.9055 26.558 16.0811 26.134 16.3937 25.8215C19.2067 23.0084 23.022 21.4281 27.0003 21.4281C30.9785 21.4281 34.7938 23.0084 37.6069 25.8215C37.9194 26.134 38.095 26.558 38.095 27C38.095 27.442 37.9194 27.866 37.6069 28.1785L35.8391 29.9463C35.5266 30.2588 35.1026 30.4344 34.6606 30.4344C34.2186 30.4344 33.7947 30.2588 33.4821 29.9463L31.7143 28.1785C31.5314 27.9956 31.3935 27.7725 31.3117 27.527C31.2299 27.2816 31.2063 27.0204 31.2429 26.7643L31.3119 26.2817C31.3374 26.0909 31.2962 25.8972 31.1951 25.7334C31.094 25.5696 30.9394 25.4458 30.7574 25.3831C28.3164 24.5527 25.669 24.5544 23.2291 25.3878Z"
          fill="white"
        />
      </g>
      <defs>
        <clipPath id={clipPathId}>
          <rect
            fill="white"
            height="20"
            transform="translate(41.1423 27) rotate(135)"
            width="20"
          />
        </clipPath>
      </defs>
    </svg>
  )
}

// Figma 1:65 / 1:71 — flat pills, no shadow. Do not use TabsList variant="line": it forces data-active:bg-transparent on the trigger (invisible white text on white).
const tabTriggerClass =
  "inline-flex h-auto min-h-0 min-w-[152px] shrink-0 flex-initial items-center justify-center gap-1 rounded-[100px] border-0 p-3 text-base font-medium " +
  "!shadow-none data-active:!shadow-none group-data-[variant=default]/tabs-list:data-active:!shadow-none " +
  "bg-[#f4f4f4] text-[#525252] hover:bg-[#ebebeb] [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-[#525252] " +
  "data-active:!bg-[#3860d5] data-active:!text-white data-active:hover:!bg-[#3860d5] " +
  "data-active:[&_svg]:text-white " +
  "focus-visible:ring-2 focus-visible:ring-[#3860d5]/40 focus-visible:ring-offset-0"

function DemoInner() {
  const [activeTab, setActiveTab] = useState<DemoTab>("phone")
  const [phoneMessages, setPhoneMessages] = useState<ChatMessage[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [textInput, setTextInput] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isTextOnlyModeRef = useRef(true)
  const pendingTextRef = useRef<string | null>(null)

  const conversation = useConversation({
    onMessage: (message) => {
      if (!message.message?.trim()) return
      if (message.role === "agent") {
        const row = { role: "assistant" as const, content: message.message }
        if (isTextOnlyModeRef.current) {
          setChatMessages((prev) => [...prev, row])
        } else {
          setPhoneMessages((prev) => [...prev, row])
        }
        return
      }
      if (!isTextOnlyModeRef.current && message.role === "user") {
        setPhoneMessages((prev) => [
          ...prev,
          { role: "user", content: message.message },
        ])
      }
    },
    onError: (msg) => {
      console.error("ElevenLabs:", msg)
      setErrorMessage(formatElevenLabsUserError(msg))
    },
  })

  const startConversation = useCallback(
    async (textOnly: boolean, skipClearMessages = false) => {
      isTextOnlyModeRef.current = textOnly
      if (!skipClearMessages) {
        if (textOnly) {
          setChatMessages([])
        } else {
          setPhoneMessages([])
        }
      }
      if (textOnly) {
        conversation.startSession({
          agentId: AGENT_ID,
          connectionType: "websocket",
          overrides: { conversation: { textOnly: true } },
        })
        return
      }
      if (preferElevenLabsVoiceWebSocket()) {
        conversation.startSession({
          agentId: AGENT_ID,
          connectionType: "websocket",
          overrides: { conversation: { textOnly: false } },
        })
        return
      }
      let token: string | null = null
      try {
        token = await fetchServerWebRtcConversationToken()
      } catch (e) {
        console.error(e)
        setErrorMessage(
          e instanceof Error ? e.message : "Could not start voice session"
        )
        return
      }
      if (token) {
        conversation.startSession({
          conversationToken: token,
          connectionType: "webrtc",
          overrides: { conversation: { textOnly: false } },
        })
      } else {
        conversation.startSession({
          agentId: AGENT_ID,
          connectionType: "webrtc",
          overrides: { conversation: { textOnly: false } },
        })
      }
    },
    [conversation]
  )

  const { status, mode, endSession } = conversation

  const disconnectSession = useCallback(() => {
    endSession()
    pendingTextRef.current = null
  }, [endSession])

  const handleTabChange = useCallback(
    (value: string) => {
      const next = value as DemoTab
      if (next === activeTab) return
      disconnectSession()
      setErrorMessage(null)
      setActiveTab(next)
    },
    [activeTab, disconnectSession]
  )

  const flushPendingText = useCallback(() => {
    const pending = pendingTextRef.current
    if (pending) {
      pendingTextRef.current = null
      conversation.sendUserMessage(pending)
    }
  }, [conversation])

  const handleCall = useCallback(async () => {
    if (status === "disconnected" || status === "error") {
      setErrorMessage(null)
      await startConversation(false)
    } else if (status === "connected") {
      endSession()
    }
  }, [status, endSession, startConversation])

  const handleSendText = useCallback(async () => {
    const trimmed = textInput.trim()
    if (!trimmed) return

    if (status === "disconnected" || status === "error") {
      setTextInput("")
      setChatMessages([{ role: "user", content: trimmed }])
      pendingTextRef.current = trimmed
      try {
        await startConversation(true, true)
      } catch (e) {
        console.error(e)
        pendingTextRef.current = null
      }
      return
    }

    if (status === "connected") {
      setChatMessages((prev) => [...prev, { role: "user", content: trimmed }])
      setTextInput("")
      conversation.sendUserMessage(trimmed)
    }
  }, [textInput, status, conversation, startConversation])

  useEffect(() => {
    if (status === "connected") {
      flushPendingText()
    }
  }, [status, flushPendingText])

  const isVoiceSession =
    status === "connected" && !isTextOnlyModeRef.current

  const orbAgentState: AgentState = (() => {
    if (activeTab !== "phone") return null
    if (status === "connecting") return "thinking"
    if (!isVoiceSession) return null
    return mode === "speaking" ? "talking" : "listening"
  })()

  const getInputVolume = useCallback(() => {
    const raw = conversation.getInputVolume?.() ?? 0
    return Math.min(1, Math.pow(raw, 0.5) * 2.5)
  }, [conversation])

  const getOutputVolume = useCallback(() => {
    const raw = conversation.getOutputVolume?.() ?? 0
    return Math.min(1, Math.pow(raw, 0.5) * 2.5)
  }, [conversation])

  const isCallActive = isVoiceSession

  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <Tabs
        className="flex min-h-0 flex-1 flex-col gap-0"
        onValueChange={handleTabChange}
        value={activeTab}
      >
        <div className="flex shrink-0 justify-center px-4 pt-4">
          <TabsList className="inline-flex h-auto w-fit gap-4 rounded-none border-0 bg-transparent p-0 shadow-none">
            <TabsTrigger className={tabTriggerClass} value="phone">
              <PhoneIcon aria-hidden />
              Phone Call
            </TabsTrigger>
            <TabsTrigger className={tabTriggerClass} value="messaging">
              <MessagesSquare aria-hidden />
              Text Message
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          className="mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
          value="phone"
        >
          <section className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-10 pt-6">
              {/* Figma Call Orb (1:90): 300×300 orb,44×44 button with top at y=278 → half button overlaps orb bottom */}
              <div className="relative mx-auto size-[300px] max-h-[min(40vh,300px)] max-w-[min(85vw,300px)] shrink-0">
                <Orb
                  agentState={orbAgentState}
                  className="size-full overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                  colors={["#6b94f8", "#3860d5"]}
                  getInputVolume={getInputVolume}
                  getOutputVolume={getOutputVolume}
                  volumeMode="manual"
                />
                <div className="absolute left-1/2 top-full z-10 -translate-x-1/2 -translate-y-1/2">
                  <Button
                    className={cn(
                      "size-16 shrink-0 rounded-full p-0 transition-transform",
                      status === "connecting" && "animate-pulse",
                      isCallActive
                        ? "border-0 bg-transparent shadow-none hover:bg-black/[0.04]"
                        : "border-[5px] border-white bg-[#1f1f1f] text-white hover:bg-[#2a2a2a]"
                    )}
                    onClick={() => void handleCall()}
                    disabled={status === "connecting"}
                    size="icon"
                    type="button"
                  >
                    {isCallActive ? (
                      <EndCallIcon className="size-[54px] shrink-0" />
                    ) : (
                      <PhoneIcon className="size-5" strokeWidth={2} />
                    )}
                    <span className="sr-only">
                      {isCallActive ? "End call" : "Start call"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
            <div
              aria-live="polite"
              className="flex min-h-[24px] shrink-0 items-center justify-center px-4 pb-6 text-center text-[14px] text-[#6c6c6c]"
            >
              {status === "connecting" ? (
                <ShimmeringText text="Connecting to agent…" />
              ) : isCallActive ? (
                mode === "speaking" ? (
                  "Agent is speaking"
                ) : (
                  "Listening…"
                )
              ) : (
                "Tap the phone to start a call"
              )}
            </div>
            {errorMessage && activeTab === "phone" && (
              <p className="text-destructive px-4 pb-4 text-center text-sm">
                {errorMessage}
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent
          className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
          value="messaging"
        >
          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <div className="mx-auto flex min-h-0 w-full max-w-[640px] flex-1 flex-col px-4">
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="flex min-w-0 flex-col gap-4 pb-4 pt-6">
                {chatMessages.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
                    <p className="text-[14px] text-[#6c6c6c]">
                      {status === "connecting" ? (
                        <ShimmeringText text="Connecting…" />
                      ) : (
                        "No messages yet"
                      )}
                    </p>
                    <p className="text-[14px] text-[#a3a3a3]">
                      Send a message to chat with the agent over text.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      className={cn(
                        "flex w-full",
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      )}
                      key={`${index}-${message.content.slice(0, 12)}`}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-[24px] px-4 py-3 text-left text-[14px] font-normal leading-normal tracking-normal",
                          message.role === "user"
                            ? "bg-[#f5f5f5] text-[#1f1f1f]"
                            : "bg-[#1f1f1f] text-white"
                        )}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="shrink-0 pb-4">
              <div className="relative h-[122px] w-full rounded-[24px] border border-solid border-[#e6e6e6] bg-white">
                <textarea
                  className="size-full resize-none rounded-[24px] border-0 bg-transparent px-4 pt-4 text-base text-[#1f1f1f] outline-none placeholder:text-[#6c6c6c]"
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void handleSendText()
                    }
                  }}
                  placeholder="Send a message to the agent..."
                  rows={3}
                  value={textInput}
                />
                <Button
                  className="absolute right-[17px] bottom-[17px] size-10 rounded-full bg-[#1f1f1f] text-white hover:bg-[#2a2a2a] disabled:bg-neutral-300"
                  disabled={!textInput.trim()}
                  onClick={() => void handleSendText()}
                  size="icon"
                  type="button"
                >
                  <SendHorizontal className="size-5" strokeWidth={2} />
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </div>
            {errorMessage && activeTab === "messaging" && (
              <p className="text-destructive pb-2 text-center text-[14px]">
                {errorMessage}
              </p>
            )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function DemoAgentClient() {
  const serverLocation = getElevenLabsServerLocation()
  return (
    <ConversationProvider
      {...(serverLocation ? { serverLocation } : {})}
    >
      <DemoInner />
    </ConversationProvider>
  )
}

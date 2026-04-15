"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ui/conversation"
import { Input } from "@/components/ui/input"
import { Message, MessageContent } from "@/components/ui/message"
import { Orb } from "@/components/ui/orb"
import { Response } from "@/components/ui/response"
import { ShimmeringText } from "@/components/ui/shimmering-text"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ConversationProvider,
  useConversation,
} from "@elevenlabs/react"
import type { AgentState } from "@/components/ui/orb"
import { MessageCircleIcon, PhoneIcon, SendIcon } from "lucide-react"

const AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "agent_5301kp8hy4f8fdhrn0w8vz8q2p6e"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

function DemoInner() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [textInput, setTextInput] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const isTextOnlyModeRef = useRef(true)
  const pendingTextRef = useRef<string | null>(null)

  const conversation = useConversation({
    onMessage: (message) => {
      if (!message.message?.trim()) return
      if (message.role === "agent") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: message.message },
        ])
        return
      }
      if (!isTextOnlyModeRef.current && message.role === "user") {
        setMessages((prev) => [...prev, { role: "user", content: message.message }])
      }
    },
    onError: (msg) => {
      console.error("ElevenLabs:", msg)
      setErrorMessage(typeof msg === "string" ? msg : "Connection error")
    },
  })

  const getMicStream = useCallback(async () => {
    if (mediaStreamRef.current) return mediaStreamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamRef.current = stream
    setErrorMessage(null)
    return stream
  }, [])

  const startConversation = useCallback(
    async (textOnly: boolean, skipClearMessages = false) => {
      isTextOnlyModeRef.current = textOnly
      if (!skipClearMessages) {
        setMessages([])
      }
      if (!textOnly) {
        await getMicStream()
      }
      conversation.startSession({
        agentId: AGENT_ID,
        connectionType: textOnly ? "websocket" : "webrtc",
        overrides: {
          conversation: { textOnly },
        },
      })
    },
    [conversation, getMicStream]
  )

  const { status, mode, endSession } = conversation

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
      try {
        await startConversation(false)
      } catch (e) {
        console.error(e)
        if (e instanceof DOMException && e.name === "NotAllowedError") {
          setErrorMessage("Microphone access is required for voice.")
        }
      }
    } else if (status === "connected") {
      endSession()
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
    }
  }, [status, endSession, startConversation])

  const handleSendText = useCallback(async () => {
    const trimmed = textInput.trim()
    if (!trimmed) return

    if (status === "disconnected" || status === "error") {
      setTextInput("")
      setMessages([{ role: "user", content: trimmed }])
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
      setMessages((prev) => [...prev, { role: "user", content: trimmed }])
      setTextInput("")
      conversation.sendUserMessage(trimmed)
    }
  }, [textInput, status, conversation, startConversation])

  useEffect(() => {
    if (status === "connected") {
      flushPendingText()
    }
  }, [status, flushPendingText])

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const orbAgentState: AgentState = (() => {
    if (status === "connecting") return "thinking"
    if (status !== "connected") return null
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

  const isCallActive = status === "connected"

  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-center border-b border-border px-4 py-3">
        <p className="text-foreground font-medium">Reloc8 Demo</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative flex min-h-[240px] flex-[1.4] flex-col border-r border-border">
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
            <Orb
              agentState={orbAgentState}
              className="size-[min(72vw,420px)] max-h-[min(50vh,420px)] overflow-hidden rounded-full border-2 border-[#e8e8e8]"
              colors={["#60a5fa", "#1e3a8a"]}
              getInputVolume={getInputVolume}
              getOutputVolume={getOutputVolume}
              volumeMode="manual"
            />
            <div className="absolute bottom-[12%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-6">
              <Button
                className={cn(
                  "size-14 rounded-full border border-border bg-foreground text-background shadow-lg",
                  "hover:bg-foreground/90"
                )}
                onClick={() => void handleCall()}
                disabled={status === "connecting"}
                size="icon"
                type="button"
                variant="secondary"
              >
                {isCallActive ? (
                  <PhoneIcon className="size-6 rotate-[135deg]" />
                ) : (
                  <PhoneIcon className="size-6" />
                )}
                <span className="sr-only">
                  {isCallActive ? "End call" : "Start call"}
                </span>
              </Button>
            </div>
          </div>
          {errorMessage && (
            <p className="text-destructive px-4 pb-2 text-center text-sm">
              {errorMessage}
            </p>
          )}
        </section>

        <section className="bg-muted/30 flex min-h-0 min-w-0 flex-1 flex-col">
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="flex min-w-0 flex-col gap-2 p-4 pb-2">
              {messages.length === 0 ? (
                <ConversationEmptyState
                  className="text-muted-foreground"
                  description="Call or send a message to start a new conversation."
                  icon={<MessageCircleIcon className="size-10 opacity-40" />}
                  title={
                    status === "connecting" ? (
                      <ShimmeringText text="Connecting…" />
                    ) : (
                      "No messages yet"
                    )
                  }
                />
              ) : (
                messages.map((message, index) => (
                  <Message from={message.role} key={`${index}-${message.content.slice(0, 20)}`}>
                    <MessageContent className="max-w-full min-w-0">
                      <Response className="w-auto [overflow-wrap:anywhere] whitespace-pre-wrap">
                        {message.content}
                      </Response>
                    </MessageContent>
                  </Message>
                ))
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="shrink-0 border-t border-border bg-background p-4">
            <div className="relative flex items-center gap-2">
              <Input
                className="h-12 rounded-xl border-input bg-background pr-12 text-base shadow-sm"
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void handleSendText()
                  }
                }}
                placeholder="Send a message to start a chat."
                value={textInput}
              />
              <Button
                className="absolute right-1.5 size-9 rounded-full"
                disabled={!textInput.trim()}
                onClick={() => void handleSendText()}
                size="icon"
                type="button"
              >
                <SendIcon className="size-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export function DemoAgentClient() {
  return (
    <ConversationProvider>
      <DemoInner />
    </ConversationProvider>
  )
}

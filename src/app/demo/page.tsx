import type { Metadata } from "next"
import { DemoAgentClient } from "@/components/demo-agent-client"

export const metadata: Metadata = {
  title: "Reloc8 Demo",
  description: "Voice agent demo",
}

export default function DemoPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DemoAgentClient />
    </div>
  )
}

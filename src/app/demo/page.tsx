import type { Metadata } from "next"
import { DemoAgentClient } from "@/components/demo-agent-client"

export const metadata: Metadata = {
  title: "Reloc8 Demo",
  description: "Voice agent demo",
}

export default function DemoPage() {
  return (
    <div className="flex min-h-dvh w-full flex-col overflow-hidden bg-[#ffffff] px-3 py-4 sm:px-4">
      <DemoAgentClient />
    </div>
  )
}

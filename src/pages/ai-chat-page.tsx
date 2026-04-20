import { useEffect, useMemo, useRef, useState } from "react"

import { Composer } from "@/components/ai/composer"
import { MarkdownView } from "@/components/ai/markdown-view"
import { AiSettingsDialog } from "@/components/ai/settings-dialog"
import { ToolTrace, type ToolTraceEntry } from "@/components/ai/tool-trace"
import type { AiChatMessage, AiStreamEvent } from "@/lib/ai-stream"
import { streamAiChat } from "@/lib/ai-stream"
import type { AppUser } from "@/types"

type Turn =
  | { id: string; role: "user"; content: string }
  | {
      id: string
      role: "assistant"
      content: string
      tools: ToolTraceEntry[]
      streaming?: boolean
      error?: string
    }

function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

type Props = { user: AppUser }

export function AiChatPage({ user }: Props) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [turns])

  const send = async () => {
    const text = input.trim()
    if (!text) return
    const userTurn: Turn = { id: newId(), role: "user", content: text }
    const assistantTurn: Turn = {
      id: newId(),
      role: "assistant",
      content: "",
      tools: [],
      streaming: true,
    }
    setInput("")
    setTurns((prev) => [...prev, userTurn, assistantTurn])
    setBusy(true)

    const history: AiChatMessage[] = turnsToMessages([...turns, userTurn])
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamAiChat(history, {
        signal: controller.signal,
        onEvent: (ev) => applyEvent(assistantTurn.id, ev),
      })
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        applyEvent(assistantTurn.id, { type: "error", message: (err as Error).message })
      }
    } finally {
      markStreamingDone(assistantTurn.id)
      abortRef.current = null
      setBusy(false)
    }
  }

  const stop = () => {
    abortRef.current?.abort()
  }

  const applyEvent = (turnId: string, ev: AiStreamEvent) => {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.id !== turnId || t.role !== "assistant") return t
        if (ev.type === "content") {
          return { ...t, content: t.content + ev.delta }
        }
        if (ev.type === "tool_start") {
          const entry: ToolTraceEntry = {
            id: ev.id || newId(),
            name: ev.name,
            args: ev.args,
            pending: true,
          }
          return { ...t, tools: [...t.tools, entry] }
        }
        if (ev.type === "tool_end") {
          const tools = t.tools.map((tool) =>
            tool.id === ev.id
              ? {
                  ...tool,
                  pending: false,
                  result: ev.result,
                  error: ev.error,
                  durationMs: ev.durationMs,
                }
              : tool,
          )
          return { ...t, tools }
        }
        if (ev.type === "error") {
          return { ...t, error: ev.message }
        }
        if (ev.type === "done") {
          return { ...t, streaming: false }
        }
        return t
      }),
    )
  }

  const markStreamingDone = (turnId: string) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === turnId && t.role === "assistant" ? { ...t, streaming: false } : t)),
    )
  }

  const clear = () => {
    setTurns([])
  }

  const isAdmin = user.role === "admin"
  const hasMessages = turns.length > 0

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "1fr auto",
        height: "calc(100vh - 96px)",
        maxWidth: 860,
        margin: "0 auto",
        width: "100%",
        minHeight: 0,
      }}
    >
      <div
        ref={scrollRef}
        style={{
          overflowY: "auto",
          paddingTop: 8,
          paddingBottom: 16,
          minHeight: 0,
        }}
      >
        <ChatHeader
          onSettings={isAdmin ? () => setSettingsOpen(true) : undefined}
          onClear={hasMessages ? clear : undefined}
        />
        {!hasMessages ? <EmptyState /> : null}
        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} />
        ))}
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={send}
        onStop={stop}
        busy={busy}
        disabled={false}
      />

      <AiSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function turnsToMessages(turns: Turn[]): AiChatMessage[] {
  const out: AiChatMessage[] = []
  for (const turn of turns) {
    if (turn.role === "user") {
      out.push({ role: "user", content: turn.content })
    } else if (turn.role === "assistant") {
      // We only replay the text content in history; the server re-runs the
      // tool loop itself if the assistant wants more tools next turn.
      out.push({ role: "assistant", content: turn.content })
    }
  }
  return out
}

function ChatHeader({
  onSettings,
  onClear,
}: {
  onSettings?: () => void
  onClear?: () => void
}) {
  return (
    <div
      className="row between"
      style={{
        padding: "2px 4px 12px",
        position: "sticky",
        top: 0,
        background: "var(--bg)",
        zIndex: 5,
      }}
    >
      <div>
        <div className="gv-h2">Clinical assistant</div>
        <div className="hint mt-4">
          Reads your CGM, treatments and loop status via tools. Streaming.
        </div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {onClear ? (
          <button className="pill-btn" onClick={onClear} style={{ height: 28, fontSize: 11.5 }}>
            Clear
          </button>
        ) : null}
        {onSettings ? (
          <button
            className="pill-btn"
            onClick={onSettings}
            style={{ height: 28, fontSize: 11.5 }}
          >
            Settings
          </button>
        ) : null}
      </div>
    </div>
  )
}

function EmptyState() {
  const prompts = useMemo(
    () => [
      "How is today going so far?",
      "What happened around lunchtime today?",
      "Are there any patterns in nocturnal lows this week?",
      "Compare this week's TIR to last week's and explain the difference.",
      "My post-pasta spike hit 254 — is my I:C ratio right?",
    ],
    [],
  )
  return (
    <div style={{ padding: "40px 4px", display: "grid", gap: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div className="gv-h1" style={{ fontSize: 22 }}>
          What should we look at?
        </div>
        <div className="hint mt-8" style={{ maxWidth: 520, margin: "0 auto" }}>
          The assistant has read-only access to your glucose, treatments and
          loop status. It will call tools to fetch the numbers before
          answering — you'll see each tool call inline.
        </div>
      </div>
      <div style={{ display: "grid", gap: 8, maxWidth: 520, margin: "0 auto", width: "100%" }}>
        {prompts.map((p) => (
          <div
            key={p}
            style={{
              padding: "10px 14px",
              border: "1px solid var(--line)",
              borderRadius: 10,
              fontSize: 13,
              color: "var(--ink-2)",
              background: "var(--surface)",
            }}
          >
            “{p}”
          </div>
        ))}
      </div>
    </div>
  )
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "8px 0",
        }}
      >
        <div
          style={{
            maxWidth: "80%",
            background: "var(--ink)",
            color: "var(--bg)",
            padding: "10px 14px",
            borderRadius: 14,
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {turn.content}
        </div>
      </div>
    )
  }
  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            background: "var(--ink)",
            color: "var(--bg)",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          G
        </div>
        <div style={{ minWidth: 0 }}>
          {turn.tools.length > 0 ? (
            <div style={{ marginBottom: 6 }}>
              {turn.tools.map((t) => (
                <ToolTrace key={t.id} entry={t} />
              ))}
            </div>
          ) : null}
          {turn.content ? <MarkdownView text={turn.content} /> : null}
          {turn.streaming && !turn.content ? (
            <div className="hint" style={{ fontSize: 12 }}>
              thinking…
            </div>
          ) : null}
          {turn.streaming && turn.content ? (
            <span
              className="mono"
              style={{
                display: "inline-block",
                width: 6,
                height: 14,
                background: "var(--ink)",
                verticalAlign: "middle",
                marginLeft: 2,
                animation: "gvFade 900ms ease-in-out infinite",
              }}
            />
          ) : null}
          {turn.error ? (
            <div
              style={{
                marginTop: 8,
                padding: "8px 12px",
                background: "color-mix(in oklch, var(--st-low) 10%, transparent)",
                border: "1px solid color-mix(in oklch, var(--st-low) 30%, transparent)",
                borderRadius: 8,
                color: "var(--st-low)",
                fontSize: 12.5,
              }}
            >
              {turn.error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

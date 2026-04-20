import { useState } from "react"

export type ToolTraceEntry = {
  id: string
  name: string
  args?: unknown
  result?: unknown
  error?: string
  durationMs?: number
  pending?: boolean
}

/**
 * Collapsible inline display of a tool call — one per turn. Clinicians
 * generally don't need to see every call, but being able to expand and
 * verify the exact args/results builds trust.
 */
export function ToolTrace({ entry }: { entry: ToolTraceEntry }) {
  const [open, setOpen] = useState(false)
  const icon = entry.pending ? "⋯" : entry.error ? "!" : "✓"
  const color = entry.pending
    ? "var(--ink-4)"
    : entry.error
      ? "var(--st-low)"
      : "var(--st-in)"
  return (
    <div
      style={{
        margin: "4px 0",
        border: "1px solid var(--line)",
        borderRadius: 8,
        background: "var(--bg-2)",
        fontSize: 12,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          textAlign: "left",
        }}
      >
        <span
          className="mono"
          style={{ color, fontWeight: 600, width: 14, textAlign: "center" }}
        >
          {icon}
        </span>
        <span className="mono" style={{ color: "var(--ink)" }}>
          {entry.name}
        </span>
        {entry.pending ? (
          <span className="hint mono" style={{ fontSize: 11 }}>
            running…
          </span>
        ) : entry.error ? (
          <span className="hint mono" style={{ fontSize: 11, color: "var(--st-low)" }}>
            {entry.error}
          </span>
        ) : entry.durationMs != null ? (
          <span className="hint mono" style={{ fontSize: 11 }}>
            {entry.durationMs}ms
          </span>
        ) : null}
        <span style={{ marginLeft: "auto", color: "var(--ink-4)", fontSize: 10 }}>
          {open ? "hide" : "details"}
        </span>
      </button>
      {open ? (
        <div
          className="mono"
          style={{
            borderTop: "1px solid var(--line-2)",
            padding: "8px 10px",
            fontSize: 11,
            lineHeight: 1.55,
            color: "var(--ink-3)",
            whiteSpace: "pre-wrap",
          }}
        >
          <div style={{ color: "var(--ink-4)" }}>args</div>
          <div style={{ marginBottom: 8 }}>{stringify(entry.args)}</div>
          <div style={{ color: "var(--ink-4)" }}>{entry.error ? "error" : "result"}</div>
          <div>{entry.error ?? stringify(entry.result)}</div>
        </div>
      ) : null}
    </div>
  )
}

function stringify(v: unknown): string {
  if (v == null) return "—"
  try {
    const text = typeof v === "string" ? v : JSON.stringify(v, null, 2)
    if (text.length > 2000) return text.slice(0, 2000) + "\n…"
    return text
  } catch {
    return String(v)
  }
}

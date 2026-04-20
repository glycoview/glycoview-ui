import { useEffect, useRef } from "react"

type Props = {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  onStop?: () => void
  disabled?: boolean
  busy?: boolean
  placeholder?: string
}

/**
 * ChatGPT-style composer. Auto-grows to fit content up to a cap, Enter sends,
 * Shift+Enter newline, Esc stops when a stop callback is supplied.
 */
export function Composer({ value, onChange, onSubmit, onStop, disabled, busy, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = Math.min(200, el.scrollHeight) + "px"
  }, [value])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (busy && e.key === "Escape" && onStop) {
      e.preventDefault()
      onStop()
      return
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!disabled && !busy && value.trim().length > 0) onSubmit()
    }
  }

  const canSend = !disabled && !busy && value.trim().length > 0

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        background: "var(--bg)",
        paddingTop: 8,
        paddingBottom: 12,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 8,
          alignItems: "end",
          padding: 10,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          boxShadow: "0 1px 2px oklch(0 0 0 / 4%), 0 0 0 1px var(--line)",
        }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? "Ask about today's glucose, last-week trends, or paste a pattern you've noticed…"}
          style={{
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--ink)",
            fontSize: 14,
            fontFamily: "inherit",
            lineHeight: 1.5,
            padding: "6px 4px",
            minHeight: 24,
            maxHeight: 200,
          }}
          disabled={disabled}
        />
        {busy && onStop ? (
          <button
            type="button"
            onClick={onStop}
            className="pill-btn"
            style={{ height: 34, padding: "0 14px", alignSelf: "end" }}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => canSend && onSubmit()}
            className="pill-btn is-primary"
            style={{ height: 34, padding: "0 14px", alignSelf: "end" }}
            disabled={!canSend}
          >
            Send
          </button>
        )}
      </div>
      <div
        className="hint mono"
        style={{ fontSize: 10.5, marginTop: 6, textAlign: "center", color: "var(--ink-4)" }}
      >
        Enter to send · Shift+Enter for newline · Esc to stop
      </div>
    </div>
  )
}

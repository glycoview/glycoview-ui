import type { TimeInRangeBand } from "@/types"

type Props = {
  bands: TimeInRangeBand[]
  compact?: boolean
}

const ORDER = ["Severe low", "Low", "Target", "High", "Very high"] as const

/**
 * Horizontal 5-band time-in-range stack. Canonical clinical layout — one
 * colored bar per range with a small legend row underneath.
 */
export function TIRBar({ bands, compact = false }: Props) {
  const map = new Map(bands.map((b) => [b.label, b]))
  const ordered = ORDER.map((label) => map.get(label)).filter(Boolean) as TimeInRangeBand[]
  const total = ordered.reduce((sum, b) => sum + b.percent, 0) || 1

  const colorFor = (label: string): string => {
    switch (label) {
      case "Severe low":
        return "var(--st-vlow)"
      case "Low":
        return "var(--st-low)"
      case "Target":
        return "var(--st-in)"
      case "High":
        return "var(--st-high)"
      case "Very high":
        return "var(--st-vhigh)"
      default:
        return "var(--ink-3)"
    }
  }

  const barHeight = compact ? 10 : 14

  return (
    <div>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: barHeight,
          borderRadius: 999,
          overflow: "hidden",
          border: "1px solid var(--line)",
          background: "var(--bg-2)",
        }}
      >
        {ordered.map((b) => {
          const width = `${(b.percent / total) * 100}%`
          return (
            <div
              key={b.label}
              title={`${b.label} (${b.range}) · ${b.percent.toFixed(1)}%`}
              style={{
                width,
                background: colorFor(b.label),
                opacity: b.label === "Target" ? 0.95 : 0.85,
              }}
            />
          )
        })}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${ordered.length}, 1fr)`,
          gap: 4,
          marginTop: 6,
        }}
      >
        {ordered.map((b) => (
          <div
            key={b.label}
            style={{
              minWidth: 0,
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10.5,
                color: "var(--ink-4)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: colorFor(b.label),
                  flex: "0 0 8px",
                }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {shortLabel(b.label)}
              </span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", marginTop: 2 }}
            >
              {b.percent.toFixed(1)}
              <span style={{ color: "var(--ink-4)", fontSize: 10 }}>%</span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 9.5, color: "var(--ink-4)", marginTop: 1 }}
            >
              {b.range}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function shortLabel(label: string): string {
  switch (label) {
    case "Severe low":
      return "S·low"
    case "Very high":
      return "V·high"
    default:
      return label
  }
}

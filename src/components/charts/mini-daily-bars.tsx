import type { DailySummary } from "@/types"

type Props = {
  days: DailySummary[]
  accessor: (d: DailySummary) => number
  colorFor?: (value: number, max: number) => string
  /** horizontal guide line at this value (e.g. target 180) */
  guide?: number
  height?: number
  emptyLabel?: string
}

/**
 * Compact 14-day (or N-day) bar chart. One bar per day so clinicians can see
 * variance day-to-day at a glance. Last bar is slightly thicker so "today" or
 * the most recent day stands out.
 */
export function MiniDailyBars({
  days,
  accessor,
  colorFor,
  guide,
  height = 46,
  emptyLabel = "—",
}: Props) {
  if (!days.length) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          color: "var(--ink-4)",
          fontSize: 11,
        }}
      >
        {emptyLabel}
      </div>
    )
  }
  const vals = days.map(accessor)
  const max = Math.max(1, ...vals, guide ?? 0)
  const W = 240
  const H = height
  const PAD = 4
  const n = days.length
  const gap = 1.5
  const barW = Math.max(3, (W - PAD * 2 - gap * (n - 1)) / n)

  const y = (v: number) => PAD + (1 - v / max) * (H - PAD * 2)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      {guide != null ? (
        <line
          x1={PAD}
          x2={W - PAD}
          y1={y(guide)}
          y2={y(guide)}
          stroke="var(--ink-4)"
          strokeDasharray="2 3"
          strokeWidth="1"
          opacity={0.6}
        />
      ) : null}
      {days.map((d, i) => {
        const v = accessor(d)
        const x = PAD + i * (barW + gap)
        const yTop = y(v)
        const color = colorFor ? colorFor(v, max) : "var(--accent-2)"
        const isLast = i === n - 1
        return (
          <rect
            key={d.date ?? i}
            x={x}
            y={yTop}
            width={barW}
            height={Math.max(1, H - PAD - yTop)}
            fill={color}
            opacity={isLast ? 1 : 0.8}
            rx={1.2}
          />
        )
      })}
    </svg>
  )
}

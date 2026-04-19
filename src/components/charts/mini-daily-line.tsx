import type { DailySummary } from "@/types"

type Props = {
  days: DailySummary[]
  accessor: (d: DailySummary) => number
  color?: string
  /** horizontal guide lines (e.g. 70 / 180) */
  guides?: number[]
  height?: number
  domain?: [number, number]
  emptyLabel?: string
}

/**
 * Compact line chart over N daily summaries. Last point is highlighted.
 */
export function MiniDailyLine({
  days,
  accessor,
  color = "var(--accent-2)",
  guides = [],
  height = 46,
  domain,
  emptyLabel = "—",
}: Props) {
  if (days.length < 2) {
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
  const min = domain?.[0] ?? Math.min(...vals, ...guides) * 0.9
  const max = domain?.[1] ?? Math.max(...vals, ...guides) * 1.05
  const range = Math.max(1, max - min)
  const W = 240
  const H = height
  const PAD = 3
  const x = (i: number) => PAD + (i / (days.length - 1)) * (W - PAD * 2)
  const y = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2)

  const d = vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ")
  const area = d + ` L ${x(vals.length - 1)} ${H - PAD} L ${x(0)} ${H - PAD} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="mdlGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.25} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {guides.map((g) => (
        <line
          key={g}
          x1={PAD}
          x2={W - PAD}
          y1={y(g)}
          y2={y(g)}
          stroke="var(--ink-4)"
          strokeDasharray="2 3"
          strokeWidth="1"
          opacity={0.45}
        />
      ))}
      <path d={area} fill="url(#mdlGrad)" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r={2.5} fill={color} />
    </svg>
  )
}

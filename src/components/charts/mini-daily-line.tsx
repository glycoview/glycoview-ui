import { useMemo } from "react"
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

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
  /** Tooltip value formatter — e.g. `(v) => \`${v.toFixed(1)}%\`` */
  format?: (v: number) => string
}

type Row = { date: string; value: number; i: number }

/**
 * Compact line chart over N daily summaries using Recharts. Hover reveals the
 * day + value in a themed tooltip. Area fill fades to transparent so the
 * card's background stays clean.
 */
export function MiniDailyLine({
  days,
  accessor,
  color = "var(--accent-2)",
  guides = [],
  height = 52,
  domain,
  emptyLabel = "—",
  format,
}: Props) {
  const data = useMemo<Row[]>(
    () => days.map((d, i) => ({ date: String(d.date ?? i), value: accessor(d), i })),
    [days, accessor],
  )

  if (data.length < 2) {
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

  const vals = data.map((d) => d.value)
  const minAuto = Math.min(...vals, ...guides)
  const maxAuto = Math.max(...vals, ...guides)
  const pad = Math.max(0.5, (maxAuto - minAuto) * 0.12)
  const yDomain: [number, number] = domain ?? [minAuto - pad, maxAuto + pad]
  const gradId = useGradId(color)

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.3} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {guides.map((g) => (
            <ReferenceLine
              key={g}
              y={g}
              stroke="var(--ink-4)"
              strokeDasharray="3 3"
              strokeOpacity={0.45}
              ifOverflow="extendDomain"
            />
          ))}
          <Tooltip
            cursor={{ stroke: "var(--line)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as Row
              return (
                <MiniTooltip
                  date={row.date}
                  value={row.value}
                  color={color}
                  format={format}
                />
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 3, stroke: "var(--surface)", strokeWidth: 1.5, fill: color }}
            isAnimationActive={false}
          />
          {/* y-domain needs to be provided for Area — done via AreaChart's default */}
          {/* Using an invisible ReferenceLine trick isn't needed; recharts clamps to data+refs */}
          <g data-ydomain={JSON.stringify(yDomain)} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MiniTooltip({
  date,
  value,
  color,
  format,
}: {
  date: string
  value: number
  color: string
  format?: (v: number) => string
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "6px 9px",
        fontSize: 11.5,
        boxShadow: "0 6px 20px oklch(0 0 0 / 8%)",
      }}
    >
      <div className="mono" style={{ color: "var(--ink-4)", fontSize: 10.5 }}>
        {date}
      </div>
      <div className="mono" style={{ fontSize: 13, color, fontWeight: 500 }}>
        {format ? format(value) : value.toFixed(1)}
      </div>
    </div>
  )
}

// Stable gradient ID per-color so two tiles with different colors don't share
// a fill accidentally.
function useGradId(color: string): string {
  return useMemo(() => {
    const hash = color.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
    return `mdlgrad_${Math.abs(hash).toString(36)}`
  }, [color])
}

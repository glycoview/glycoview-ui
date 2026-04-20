import { useMemo } from "react"
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import type { DailySummary } from "@/types"

type Props = {
  days: DailySummary[]
  accessor: (d: DailySummary) => number
  colorFor?: (value: number, max: number) => string
  /** horizontal guide line at this value (e.g. target 180) */
  guide?: number
  height?: number
  emptyLabel?: string
  /** Tooltip formatter. */
  format?: (v: number) => string
}

type Row = { date: string; value: number; i: number }

/**
 * Compact per-day bar chart built on Recharts. Last bar rendered at full
 * opacity so "today" stands out. Hover reveals a themed tooltip with the
 * exact value.
 */
export function MiniDailyBars({
  days,
  accessor,
  colorFor,
  guide,
  height = 52,
  emptyLabel = "—",
  format,
}: Props) {
  const data = useMemo<Row[]>(
    () => days.map((d, i) => ({ date: String(d.date ?? i), value: accessor(d), i })),
    [days, accessor],
  )

  if (!data.length) {
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
  const max = Math.max(1, ...vals, guide ?? 0)
  const resolveColor = colorFor ?? (() => "var(--accent-2)")

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap={2}>
          {guide != null ? (
            <ReferenceLine
              y={guide}
              stroke="var(--ink-4)"
              strokeDasharray="3 3"
              strokeOpacity={0.55}
              ifOverflow="extendDomain"
            />
          ) : null}
          <Tooltip
            cursor={{ fill: "var(--line-3)", opacity: 0.45 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as Row
              const color = resolveColor(row.value, max)
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
                    {row.date}
                  </div>
                  <div className="mono" style={{ fontSize: 13, color, fontWeight: 500 }}>
                    {format ? format(row.value) : row.value.toFixed(1)}
                  </div>
                </div>
              )
            }}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={d.date ?? i}
                fill={resolveColor(d.value, max)}
                fillOpacity={i === data.length - 1 ? 1 : 0.82}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

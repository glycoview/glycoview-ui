import { useMemo } from "react"
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { DailySummary } from "@/lib/design-data"

import { chartColors } from "./chart-colors"

type Props = {
  days: DailySummary[]
  /** Show the dotted 70% guide line. Default true. */
  showGuide?: boolean
  height?: number
}

type Row = { date: string; dow: string; tir: number; i: number }

/**
 * 14-day TIR-per-day bar strip. One bar per day, color-coded (green ≥ 70,
 * amber ≥ 50, red otherwise). Built on Recharts so hover reveals the exact
 * TIR value for any day.
 */
export function DayStrip({ days, showGuide = true, height = 96 }: Props) {
  const c = chartColors()
  const data = useMemo<Row[]>(
    () =>
      days.map((d, i) => ({
        date: d.date ?? String(i),
        dow: d.dow ?? "",
        tir: d.tir ?? 0,
        i,
      })),
    [days],
  )

  if (!data.length) {
    return <div className="hint">No recent days available.</div>
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap={3}>
          {showGuide ? (
            <ReferenceLine
              y={70}
              stroke="var(--ink-4)"
              strokeDasharray="3 3"
              strokeOpacity={0.45}
              label={{
                value: "target 70%",
                position: "insideTopRight",
                fill: "var(--ink-4)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            />
          ) : null}
          <XAxis
            dataKey="dow"
            tickFormatter={(d: string) => (d ? d[0] : "")}
            stroke="var(--ink-4)"
            tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--ink-4)" }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickFormatter={(v: number) => `${v}`}
            stroke="var(--ink-4)"
            tick={{ fontSize: 9.5, fontFamily: "var(--font-mono)", fill: "var(--ink-4)" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "var(--line-3)", opacity: 0.45 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as Row
              const colorKey = row.tir >= 70 ? c.inR : row.tir >= 50 ? c.high : c.vhigh
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
                  <div className="mono" style={{ fontSize: 13, color: colorKey, fontWeight: 500 }}>
                    TIR {row.tir.toFixed(1)}%
                  </div>
                </div>
              )
            }}
          />
          <Bar dataKey="tir" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => {
              const fill = d.tir >= 70 ? c.inR : d.tir >= 50 ? c.high : c.vhigh
              return (
                <Cell
                  key={i}
                  fill={fill}
                  fillOpacity={i === data.length - 1 ? 1 : 0.85}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

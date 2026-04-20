import { Line, LineChart, ReferenceLine, ResponsiveContainer } from "recharts"

import type { GluPoint } from "@/lib/design-data"

import { chartColors } from "./chart-colors"

type SparklineProps = {
  pts: GluPoint[]
  height?: number
  color?: string
  thresholds?: [number, number]
}

/**
 * Thin Recharts-backed sparkline. Two dashed guides mark the low/high
 * thresholds; the line traces glucose with the last point highlighted via
 * `activeDot` on hover.
 */
export function Sparkline({
  pts,
  height = 44,
  color,
  thresholds = [70, 180],
}: SparklineProps) {
  if (!pts.length) return null
  const c = chartColors()
  const stroke = color || c.ink
  const data = pts.map((p, i) => ({ i, v: p.v }))
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <ReferenceLine y={thresholds[0]} stroke={c.low} strokeDasharray="3 3" strokeOpacity={0.45} />
          <ReferenceLine y={thresholds[1]} stroke={c.high} strokeDasharray="3 3" strokeOpacity={0.45} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.6}
            dot={false}
            activeDot={{ r: 3, stroke: "var(--surface)", strokeWidth: 1.5, fill: stroke }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

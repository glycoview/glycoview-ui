import { useMemo } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { Progress } from "@/lib/goals-api"

type Props = {
  progress: Progress
  targetDate?: string
  goodDirection: "higher" | "lower"
  height?: number
  /** When true, render a compact chart without axis labels (for goal cards). */
  compact?: boolean
}

type Row = {
  date: string
  day: number
  value: number | null
  projected: number | null
  met: boolean
  isProjection: boolean
}

/**
 * Interactive goal-progress chart. Uses Recharts' ComposedChart with:
 *   - area for the observed daily series (colored by met/not-met)
 *   - dashed line for the linear projection into the future
 *   - reference line for the target value
 *   - tooltip on hover showing value + date + met state
 */
export function GoalChart({ progress, targetDate, goodDirection, height = 180, compact = false }: Props) {
  const { data, xTicks, yDomain, targetLabel } = useMemo(() => {
    const observed = progress.dailySeries.map((d, i) => ({
      date: d.date,
      day: i,
      value: d.value,
      projected: null as number | null,
      met: d.met,
      isProjection: false,
    }))

    // Extend with projection rows if we have a trajectory and a target date.
    const rows: Row[] = [...observed]
    if (progress.trajectory && targetDate && observed.length >= 2) {
      const last = observed[observed.length - 1]
      const dayMs = 24 * 60 * 60 * 1000
      const lastDate = Date.parse(last.date + "T00:00:00Z")
      const targetMs = Date.parse(targetDate + "T00:00:00Z")
      if (Number.isFinite(lastDate) && Number.isFinite(targetMs) && targetMs > lastDate) {
        const daysAhead = Math.min(365, Math.round((targetMs - lastDate) / dayMs))
        for (let k = 1; k <= daysAhead; k++) {
          const dDate = new Date(lastDate + k * dayMs).toISOString().slice(0, 10)
          rows.push({
            date: dDate,
            day: observed.length - 1 + k,
            value: null,
            projected: last.value + progress.trajectory.slopePerDay * k,
            met: false,
            isProjection: true,
          })
        }
        // Stitch the observed endpoint into the projection series for a
        // continuous dashed line.
        rows[observed.length - 1].projected = last.value
      }
    }

    // y-domain: a padded envelope around values AND target so the target line
    // is always visible.
    const vals = rows
      .flatMap((r) => [r.value, r.projected])
      .filter((v): v is number => v !== null && Number.isFinite(v))
    const pool = [...vals, progress.targetValue]
    let ymin = Math.min(...pool)
    let ymax = Math.max(...pool)
    if (ymin === ymax) {
      ymin -= 1
      ymax += 1
    }
    const pad = (ymax - ymin) * 0.15
    ymin -= pad
    ymax += pad

    // 4 evenly spaced ticks on x.
    const n = rows.length
    const tickCount = Math.min(5, Math.max(2, Math.floor(n / 3)))
    const xTicks: number[] = []
    for (let i = 0; i < tickCount; i++) {
      const idx = Math.round(((n - 1) * i) / Math.max(1, tickCount - 1))
      xTicks.push(idx)
    }

    return {
      data: rows,
      xTicks,
      yDomain: [ymin, ymax] as [number, number],
      targetLabel: `target ${formatVal(progress.targetValue, progress.unit)}`,
    }
  }, [progress, targetDate])

  const metColor = progress.met ? "var(--st-in)" : "var(--accent-2)"
  const goodColor = "var(--st-in)"
  const badColor = goodDirection === "higher" ? "var(--st-low)" : "var(--st-vhigh)"

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: compact ? 12 : 20, left: 0, bottom: compact ? 0 : 6 }}
        >
          <defs>
            <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={metColor} stopOpacity={0.35} />
              <stop offset="1" stopColor={metColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="var(--line-2)" strokeDasharray="2 4" />

          <XAxis
            dataKey="day"
            type="number"
            domain={[0, Math.max(1, data.length - 1)]}
            ticks={xTicks}
            tickFormatter={(i: number) => shortDate(data[i]?.date ?? "")}
            stroke="var(--ink-4)"
            fontSize={10.5}
            tick={{ fill: "var(--ink-4)", fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            interval={0}
          />
          <YAxis
            domain={yDomain}
            stroke="var(--ink-4)"
            fontSize={10.5}
            tick={{ fill: "var(--ink-4)", fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={compact ? 34 : 44}
            tickFormatter={(v: number) => formatAxis(v, progress.unit)}
          />

          <Tooltip
            cursor={{ stroke: "var(--line)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as Row
              const value = row.value ?? row.projected
              if (value === null || value === undefined) return null
              return (
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 12,
                    boxShadow: "0 6px 20px oklch(0 0 0 / 10%)",
                  }}
                >
                  <div className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>
                    {row.date}
                  </div>
                  <div className="mono" style={{ fontSize: 14, marginTop: 2, fontWeight: 500 }}>
                    {formatVal(value, progress.unit)}
                  </div>
                  {row.isProjection ? (
                    <div style={{ color: "var(--accent-2)", fontSize: 11, marginTop: 2 }}>
                      projected
                    </div>
                  ) : (
                    <div
                      style={{
                        color: row.met ? goodColor : badColor,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {row.met ? "on target" : "below target"}
                    </div>
                  )}
                </div>
              )
            }}
          />

          <ReferenceLine
            y={progress.targetValue}
            stroke="var(--ink-3)"
            strokeDasharray="5 4"
            strokeWidth={1.25}
            label={{
              value: targetLabel,
              position: "insideTopRight",
              fill: "var(--ink-3)",
              fontSize: 10.5,
              fontFamily: "var(--font-mono)",
            }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={metColor}
            strokeWidth={2}
            fill="url(#goalFill)"
            dot={{ r: 2.8, stroke: "var(--surface)", strokeWidth: 1, fill: metColor }}
            activeDot={{ r: 4.5, stroke: "var(--surface)", strokeWidth: 1.5 }}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke="var(--accent-2)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{ r: 3.5 }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatVal(v: number, unit: string): string {
  if (!Number.isFinite(v)) return "—"
  if (unit === "%") return `${v.toFixed(1)}%`
  if (unit === "mg/dL") return `${Math.round(v)} mg/dL`
  if (unit === "events") return `${Math.round(v)}`
  if (unit === "min") return `${Math.round(v)} min`
  return v.toFixed(1)
}

function formatAxis(v: number, unit: string): string {
  if (unit === "%") return `${Math.round(v)}`
  if (unit === "mg/dL") return `${Math.round(v)}`
  if (unit === "events") return `${Math.round(v)}`
  if (unit === "min") return `${Math.round(v)}`
  return v.toFixed(1)
}

function shortDate(iso: string): string {
  if (!iso || iso.length < 10) return ""
  return iso.slice(5)
}

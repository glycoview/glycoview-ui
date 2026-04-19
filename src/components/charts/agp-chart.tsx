import { useMemo } from "react"
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { TrendBucket } from "@/types"

type AGPChartProps = {
  buckets: TrendBucket[]
  height?: number
  showBands?: boolean
  showOuter?: boolean
  showInner?: boolean
  showMedian?: boolean
}

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

function fmtHour(h: number): string {
  return `${String(Math.floor(h)).padStart(2, "0")}:00`
}

export function AGPChart({
  buckets,
  height = 340,
  showBands = true,
  showOuter = true,
  showInner = true,
  showMedian = true,
}: AGPChartProps) {
  const data = useMemo(() => {
    // Recharts needs values aligned per row so we emit stacked deltas:
    // p10Base = p10, p10to25 = p25 - p10, ...
    const rows = buckets.map((b) => ({
      hour: b.hour,
      points: b.points ?? 0,
      p10: round(b.p10),
      p25: round(b.p25),
      p50: round(b.p50),
      p75: round(b.p75),
      p90: round(b.p90),
      // Stacked-area layers: the outer band is the p10 -> p90 envelope,
      // the inner is p25 -> p75. We plot them as independent Areas with
      // y = [lo, hi] pairs using Recharts' "range area" support.
    }))
    // Wrap around to hour 24 so the chart reaches the right edge.
    const last = rows[rows.length - 1]
    if (last && last.hour !== 24) {
      rows.push({ ...last, hour: 24 })
    }
    return rows
  }, [buckets])

  function round(v: number): number {
    return Math.round(v)
  }

  // Build the p10-p90 and p25-p75 band data as value pairs (Recharts accepts
  // `[lo, hi]` for Area when given an array dataKey).
  const bandData = useMemo(
    () =>
      data.map((d) => ({
        hour: d.hour,
        band_outer: [d.p10, d.p90] as [number, number],
        band_inner: [d.p25, d.p75] as [number, number],
        p50: d.p50,
        p10: d.p10,
        p90: d.p90,
        p25: d.p25,
        p75: d.p75,
        points: d.points,
      })),
    [data],
  )

  return (
    <div style={{ width: "100%" }}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={bandData} margin={{ top: 12, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="var(--line-2)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[0, 24]}
            ticks={HOUR_TICKS}
            tickFormatter={(v) => fmtHour(Number(v))}
            tick={{ fontSize: 11, fontFamily: "Geist Mono", fill: "var(--ink-4)" }}
            stroke="var(--line)"
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
          />
          <YAxis
            type="number"
            domain={[40, 350]}
            ticks={[54, 70, 140, 180, 250]}
            tick={{ fontSize: 11, fontFamily: "Geist Mono", fill: "var(--ink-4)" }}
            stroke="var(--line)"
            axisLine={false}
            tickLine={false}
            width={38}
          />

          {showBands && (
            <>
              <ReferenceArea y1={70} y2={180} fill="var(--st-in)" fillOpacity={0.05} stroke="none" />
              <ReferenceLine y={70} stroke="var(--st-low)" strokeDasharray="4 4" strokeOpacity={0.55} />
              <ReferenceLine y={180} stroke="var(--st-high)" strokeDasharray="4 4" strokeOpacity={0.55} />
            </>
          )}

          {showOuter && (
            <Area
              type="monotone"
              dataKey="band_outer"
              stroke="none"
              fill="var(--ink)"
              fillOpacity={0.1}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {showInner && (
            <Area
              type="monotone"
              dataKey="band_inner"
              stroke="none"
              fill="var(--ink)"
              fillOpacity={0.18}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {showMedian && (
            <Line
              type="monotone"
              dataKey="p50"
              stroke="var(--ink)"
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--ink)", fill: "var(--surface)", strokeWidth: 1.6 }}
              isAnimationActive={false}
            />
          )}

          <Tooltip
            cursor={{ stroke: "var(--ink)", strokeDasharray: "3 3", strokeOpacity: 0.4 }}
            isAnimationActive={false}
            content={(props: any) => <AGPTooltip {...props} />}
          />

          <Brush
            dataKey="hour"
            height={22}
            stroke="var(--line)"
            fill="var(--bg-2)"
            travellerWidth={8}
            tickFormatter={(v) => fmtHour(Number(v))}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function AGPTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as {
    hour: number
    p10: number
    p25: number
    p50: number
    p75: number
    p90: number
    points: number
  }
  if (!d) return null
  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--bg)",
        padding: "10px 12px",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.5,
        boxShadow: "0 10px 30px oklch(0 0 0 / 35%)",
        minWidth: 180,
      }}
    >
      <div className="mono" style={{ opacity: 0.7, fontSize: 11 }}>
        {fmtHour(d.hour)}
      </div>
      <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
          {d.p50}
        </span>
        <span className="mono" style={{ opacity: 0.7, fontSize: 10 }}>
          median
        </span>
      </div>
      <div className="mono" style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
        25–75 &nbsp;{d.p25}–{d.p75}
      </div>
      <div className="mono" style={{ fontSize: 11, opacity: 0.7 }}>
        10–90 &nbsp;{d.p10}–{d.p90}
      </div>
      <div className="mono" style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
        {d.points} readings
      </div>
    </div>
  )
}

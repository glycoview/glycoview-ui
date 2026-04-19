import { useMemo, useState } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { EventPoint, GlucosePoint } from "@/types"

type DailyTraceProps = {
  rangeStart: number
  glucose: GlucosePoint[]
  carbs?: EventPoint[]
  boluses?: EventPoint[]
  smbs?: EventPoint[]
  tempBasals?: EventPoint[]
  basalProfile?: EventPoint[]
  smbgs?: EventPoint[]
  height?: number
  showBands?: boolean
}

// Minute-of-day domain
const DAY_MIN = 0
const DAY_MAX = 24 * 60

const HOUR_TICKS = [0, 180, 360, 540, 720, 900, 1080, 1260, 1440]

function minuteOfDay(at: number, rangeStart: number): number {
  const minutes = Math.round((at - rangeStart) / 60000)
  return Math.max(0, Math.min(DAY_MAX, minutes))
}

function formatHHMM(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MAX, Math.round(minutes)))
  const h = Math.floor(clamped / 60) % 24
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function classify(v: number): "vlow" | "low" | "in" | "high" | "vhigh" {
  if (v < 54) return "vlow"
  if (v < 70) return "low"
  if (v <= 180) return "in"
  if (v <= 250) return "high"
  return "vhigh"
}

const STATE_COLOR: Record<ReturnType<typeof classify>, string> = {
  vlow: "var(--st-vlow)",
  low: "var(--st-low)",
  in: "var(--st-in)",
  high: "var(--st-high)",
  vhigh: "var(--st-vhigh)",
}

type GluRow = { t: number; glucose: number; state: string }
type BolusRow = { t: number; u: number; kind: "bolus" | "smb"; label: string }
type CarbRow = { t: number; g: number; label: string }

type Series = {
  glucose: GluRow[]
  boluses: BolusRow[]
  smbs: BolusRow[]
  carbs: CarbRow[]
  smbgs: { t: number; v: number }[]
  basalSteps: { t: number; rate: number }[]
  tempBasals: { t: number; rate: number; duration: number }[]
}

function buildSeries(props: DailyTraceProps): Series {
  const { glucose, boluses = [], smbs = [], carbs = [], basalProfile = [], tempBasals = [], smbgs = [], rangeStart } = props

  const gluRows: GluRow[] = glucose
    .map((p) => ({ t: minuteOfDay(p.at, rangeStart), glucose: Math.round(p.value), state: classify(p.value) }))
    .sort((a, b) => a.t - b.t)

  const bolusRows: BolusRow[] = boluses.map((b) => ({
    t: minuteOfDay(b.at, rangeStart),
    u: Math.round(b.value * 100) / 100,
    kind: "bolus",
    label: b.subtitle || b.label,
  }))

  const smbRows: BolusRow[] = smbs.map((b) => ({
    t: minuteOfDay(b.at, rangeStart),
    u: Math.round(b.value * 100) / 100,
    kind: "smb",
    label: b.subtitle || b.label,
  }))

  const carbRows: CarbRow[] = carbs.map((c) => ({
    t: minuteOfDay(c.at, rangeStart),
    g: Math.round(c.value),
    label: c.subtitle || c.label,
  }))

  const smbgRows = smbgs.map((s) => ({ t: minuteOfDay(s.at, rangeStart), v: Math.round(s.value) }))

  // Basal steps: profile gives scheduled boundaries. We emit a step series
  // from 00:00 → 24:00 with flat sections.
  const basalSortedByT = [...basalProfile]
    .map((b) => ({ t: minuteOfDay(b.at, rangeStart), rate: b.value }))
    .sort((a, b) => a.t - b.t)
  if (basalSortedByT.length > 0 && basalSortedByT[0].t > 0) {
    basalSortedByT.unshift({ t: 0, rate: basalSortedByT[0].rate })
  }
  if (basalSortedByT.length === 0) {
    basalSortedByT.push({ t: 0, rate: 0 })
  }
  // Close the series at the end of the day.
  const basalSteps: { t: number; rate: number }[] = []
  for (let i = 0; i < basalSortedByT.length; i++) {
    basalSteps.push(basalSortedByT[i])
    const next = basalSortedByT[i + 1]
    if (next) {
      basalSteps.push({ t: next.t - 0.001, rate: basalSortedByT[i].rate })
    }
  }
  basalSteps.push({ t: DAY_MAX, rate: basalSortedByT[basalSortedByT.length - 1].rate })

  const tempBasalRows = tempBasals.map((t) => ({
    t: minuteOfDay(t.at, rangeStart),
    rate: t.value,
    duration: t.duration || 30,
  }))

  return {
    glucose: gluRows,
    boluses: bolusRows,
    smbs: smbRows,
    carbs: carbRows,
    smbgs: smbgRows,
    basalSteps,
    tempBasals: tempBasalRows,
  }
}

type TooltipProps = {
  active?: boolean
  payload?: Array<unknown>
  label?: string | number
  series: Series
}
function GlucoseTooltip({ active, payload, label, series }: TooltipProps) {
  if (!active || !payload?.length) return null
  const minute = Number(label)
  // Find nearest glucose point to the hovered minute
  const glu: GluRow | null = series.glucose.length ? (nearest(series.glucose, minute) as GluRow | null) : null
  const nearbyEvents = eventsNear(series, minute, 10)

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
        {formatHHMM(minute)}
      </div>
      {glu ? (
        <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
            {glu.glucose}
          </span>
          <span className="mono" style={{ opacity: 0.7, fontSize: 10 }}>
            mg/dL · {glu.state}
          </span>
        </div>
      ) : null}
      {nearbyEvents.length > 0 ? (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid color-mix(in oklch, var(--bg) 20%, transparent)" }}>
          {nearbyEvents.slice(0, 4).map((e, i) => (
            <div key={i} className="mono" style={{ fontSize: 11, opacity: 0.85 }}>
              · {e}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function nearest<T extends { t: number }>(rows: T[], target: number): T | null {
  if (!rows.length) return null
  let best = rows[0]
  let bestDist = Math.abs(best.t - target)
  for (let i = 1; i < rows.length; i++) {
    const d = Math.abs(rows[i].t - target)
    if (d < bestDist) {
      best = rows[i]
      bestDist = d
    }
  }
  return best
}

function eventsNear(series: Series, minute: number, window: number): string[] {
  const out: string[] = []
  for (const c of series.carbs) if (Math.abs(c.t - minute) <= window) out.push(`Carbs ${c.g}g${c.label ? ` · ${c.label}` : ""}`)
  for (const b of series.boluses) if (Math.abs(b.t - minute) <= window) out.push(`Bolus ${b.u}U`)
  for (const s of series.smbs) if (Math.abs(s.t - minute) <= window) out.push(`SMB ${s.u}U`)
  for (const f of series.smbgs) if (Math.abs(f.t - minute) <= window) out.push(`Fingerstick ${f.v}`)
  return out
}

export function DailyTrace({ height = 380, showBands = true, ...rest }: DailyTraceProps) {
  const series = useMemo(() => buildSeries(rest), [rest])
  const [range, setRange] = useState<[number, number]>([DAY_MIN, DAY_MAX])

  const gluHeight = Math.round(height * 0.72)
  const basalHeight = height - gluHeight

  // Per-state glucose lines (split so each segment is colored by range).
  const byState = useMemo(() => splitByState(series.glucose), [series.glucose])

  if (!series.glucose.length) {
    return (
      <div
        style={{
          height,
          display: "grid",
          placeItems: "center",
          color: "var(--ink-4)",
          fontSize: 12,
        }}
      >
        No glucose readings for this day.
      </div>
    )
  }

  return (
    <div style={{ width: "100%" }}>
      <ResponsiveContainer width="100%" height={gluHeight}>
        <ComposedChart data={series.glucose} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line-2)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={range}
            ticks={HOUR_TICKS}
            tickFormatter={(v) => formatHHMM(v as number)}
            tick={{ fontSize: 11, fontFamily: "Geist Mono", fill: "var(--ink-4)" }}
            stroke="var(--line)"
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
            height={0}
            hide
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
              <ReferenceArea y1={40} y2={54} fill="var(--st-vlow)" fillOpacity={0.08} stroke="none" />
              <ReferenceArea y1={54} y2={70} fill="var(--st-low)" fillOpacity={0.08} stroke="none" />
              <ReferenceArea y1={70} y2={180} fill="var(--st-in)" fillOpacity={0.05} stroke="none" />
              <ReferenceArea y1={180} y2={250} fill="var(--st-high)" fillOpacity={0.06} stroke="none" />
              <ReferenceArea y1={250} y2={350} fill="var(--st-vhigh)" fillOpacity={0.08} stroke="none" />
              <ReferenceLine y={70} stroke="var(--st-low)" strokeDasharray="4 4" strokeOpacity={0.6} />
              <ReferenceLine y={180} stroke="var(--st-high)" strokeDasharray="4 4" strokeOpacity={0.6} />
            </>
          )}

          <Tooltip
            cursor={{ stroke: "var(--ink)", strokeDasharray: "3 3", strokeOpacity: 0.4 }}
            content={(props: any) => <GlucoseTooltip {...props} series={series} />}
            isAnimationActive={false}
          />

          {/* Area under full curve for depth */}
          <Area
            type="monotone"
            dataKey="glucose"
            stroke="none"
            fill="var(--st-in)"
            fillOpacity={0.08}
            isAnimationActive={false}
          />

          {/* Colored segments by range */}
          {byState.map((seg, i) => (
            <Line
              key={i}
              data={seg.points}
              dataKey="glucose"
              type="monotone"
              stroke={STATE_COLOR[seg.state]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--ink)", strokeWidth: 1.5, fill: "var(--surface)" }}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}

          {/* Events as Scatter overlays */}
          {series.carbs.length > 0 && (
            <Scatter
              data={series.carbs.map((c) => ({ t: c.t, y: 320, g: c.g, label: c.label }))}
              shape={(props: any) => <CarbMarker {...props} />}
              isAnimationActive={false}
              yAxisId={0}
            />
          )}
          {series.boluses.length > 0 && (
            <Scatter
              data={series.boluses.map((b) => ({ t: b.t, y: 56, u: b.u }))}
              shape={(props: any) => <BolusMarker {...props} />}
              isAnimationActive={false}
            />
          )}
          {series.smbs.length > 0 && (
            <Scatter
              data={series.smbs.map((b) => ({ t: b.t, y: 48, u: b.u }))}
              shape={(props: any) => <SMBMarker {...props} />}
              isAnimationActive={false}
            />
          )}
          {series.smbgs.length > 0 && (
            <Scatter
              data={series.smbgs.map((s) => ({ t: s.t, y: s.v }))}
              shape={(props: any) => <SMBGMarker {...props} />}
              isAnimationActive={false}
              dataKey="y"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height={basalHeight}>
        <ComposedChart data={series.basalSteps} margin={{ top: 2, right: 16, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="var(--line-2)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={range}
            ticks={HOUR_TICKS}
            tickFormatter={(v) => formatHHMM(v as number)}
            tick={{ fontSize: 11, fontFamily: "Geist Mono", fill: "var(--ink-4)" }}
            stroke="var(--line)"
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
          />
          <YAxis
            type="number"
            domain={[0, "dataMax + 0.3"]}
            tick={{ fontSize: 10, fontFamily: "Geist Mono", fill: "var(--ink-4)" }}
            stroke="var(--line)"
            axisLine={false}
            tickLine={false}
            width={38}
            tickFormatter={(v) => `${v}`}
          />
          <Area
            type="stepAfter"
            dataKey="rate"
            stroke="var(--basal)"
            strokeWidth={1.2}
            fill="var(--basal)"
            fillOpacity={0.28}
            isAnimationActive={false}
          />
          {series.tempBasals.map((t, i) => (
            <ReferenceArea
              key={i}
              x1={t.t}
              x2={Math.min(DAY_MAX, t.t + t.duration)}
              y1={0}
              y2={t.rate}
              fill={t.rate === 0 ? "var(--st-low)" : "var(--bolus)"}
              fillOpacity={0.35}
              stroke={t.rate === 0 ? "var(--st-low)" : "var(--bolus)"}
              strokeOpacity={0.6}
              strokeWidth={1}
            />
          ))}
          <Tooltip
            cursor={{ stroke: "var(--ink)", strokeDasharray: "3 3", strokeOpacity: 0.3 }}
            formatter={(value: any) => [`${(Number(value) || 0).toFixed(2)} U/h`, "basal"]}
            labelFormatter={(v) => formatHHMM(Number(v))}
            contentStyle={{
              background: "var(--ink)",
              border: "none",
              borderRadius: 6,
              color: "var(--bg)",
              fontSize: 11,
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Range quick-pick controls — snap zoom to clinically useful windows */}
      <div className="row" style={{ marginTop: 6, gap: 4, justifyContent: "flex-end" }}>
        {[
          ["Full day", [DAY_MIN, DAY_MAX] as [number, number]],
          ["AM", [0, 720] as [number, number]],
          ["PM", [720, DAY_MAX] as [number, number]],
          ["Overnight", [0, 420] as [number, number]],
          ["Meal windows", [360, 1260] as [number, number]],
        ].map(([label, win]) => (
          <button
            key={label as string}
            type="button"
            className={"chip" + (range[0] === (win as [number, number])[0] && range[1] === (win as [number, number])[1] ? " is-on" : "")}
            onClick={() => setRange(win as [number, number])}
          >
            {label as string}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ───── custom event markers ───── */
function CarbMarker({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const g = payload.g as number
  const r = Math.min(10, 4 + g / 8)
  return (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={r} fill="var(--carbs)" opacity={0.92} />
      <text textAnchor="middle" y={3} fontSize={9} fontFamily="Geist Mono" fill="var(--surface)" fontWeight={600}>
        {g}
      </text>
    </g>
  )
}

function BolusMarker({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const s = Math.min(9, 4 + Number(payload?.u || 0))
  return (
    <g transform={`translate(${cx},${cy})`}>
      <polygon points={`0,-${s} ${s * 0.85},${s * 0.55} -${s * 0.85},${s * 0.55}`} fill="var(--bolus)" opacity={0.95} />
      <text textAnchor="middle" y={s + 10} fontSize={9} fontFamily="Geist Mono" fill="var(--ink-3)">
        {Number(payload?.u || 0).toFixed(1)}
      </text>
    </g>
  )
}

function SMBMarker({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const r = Math.max(1.5, Math.min(3, (Number(payload?.u || 0) * 6) + 1.5))
  return <circle cx={cx} cy={cy} r={r} fill="var(--smb)" opacity={0.8} />
}

function SMBGMarker({ cx, cy }: any) {
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="var(--bg)" stroke="var(--ink)" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={1.8} fill="var(--ink)" />
    </g>
  )
}

/* ───── helpers ───── */
function splitByState(rows: GluRow[]): { state: ReturnType<typeof classify>; points: GluRow[] }[] {
  const segments: { state: ReturnType<typeof classify>; points: GluRow[] }[] = []
  let current: { state: ReturnType<typeof classify>; points: GluRow[] } | null = null
  rows.forEach((row) => {
    const s = classify(row.glucose)
    if (!current || current.state !== s) {
      if (current && current.points.length > 0) {
        // Bridge the boundary so segments visually connect
        current.points.push(row)
      }
      current = { state: s, points: [row] }
      segments.push(current)
    } else {
      current.points.push(row)
    }
  })
  return segments
}

import { useMemo, useState } from "react"
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { EventPoint, GlucosePoint } from "@/types"

/* ───────────── types ───────────── */
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

type Window = "4h" | "6h" | "12h" | "24h"

type GluRow = { t: number; v: number; state: State }
type BolusRow = { t: number; u: number; label: string }
type CarbRow = { t: number; g: number; label: string }
type BasalRow = { t: number; rate: number }
type IobRow = { t: number; iob: number }

/* ───────────── constants ───────────── */
const DAY_MIN = 0
const DAY_MAX = 24 * 60
const DIA_MIN = 240 // insulin duration of action in minutes
const TICK_MINUTES: Record<Window, number[]> = {
  "4h": generateTicks(60),
  "6h": generateTicks(60),
  "12h": generateTicks(120),
  "24h": generateTicks(180),
}

function generateTicks(stepMin: number): number[] {
  const out: number[] = []
  for (let m = 0; m <= DAY_MAX; m += stepMin) out.push(m)
  return out
}

type State = "vlow" | "low" | "in" | "high" | "vhigh"

const STATE_COLOR: Record<State, string> = {
  vlow: "var(--st-vlow)",
  low: "var(--st-low)",
  in: "var(--st-in)",
  high: "var(--st-high)",
  vhigh: "var(--st-vhigh)",
}

function classify(v: number): State {
  if (v < 54) return "vlow"
  if (v < 70) return "low"
  if (v <= 180) return "in"
  if (v <= 250) return "high"
  return "vhigh"
}

function minuteOfDay(at: number, rangeStart: number): number {
  return Math.max(0, Math.min(DAY_MAX, Math.round((at - rangeStart) / 60000)))
}

function formatHHMM(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MAX, Math.round(minutes)))
  const h = Math.floor(clamped / 60) % 24
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/* ───── simple IOB model (linear decay over DIA) ───── */
function iobSeries(
  events: { t: number; u: number }[],
  stepMin = 5,
): IobRow[] {
  const rows: IobRow[] = []
  for (let t = 0; t <= DAY_MAX; t += stepMin) {
    let sum = 0
    for (const e of events) {
      const dt = t - e.t
      if (dt <= 0 || dt >= DIA_MIN) continue
      // piecewise: instant onset → linear decay to zero at DIA
      const onset = dt < 15 ? dt / 15 : 1
      const decay = Math.max(0, 1 - (dt - 15) / (DIA_MIN - 15))
      sum += e.u * onset * decay
    }
    rows.push({ t, iob: Math.round(sum * 100) / 100 })
  }
  return rows
}

/* ───── basal step sequence (scheduled + temp) ───── */
function expandBasal(rangeStart: number, profile: EventPoint[], temps: EventPoint[]): BasalRow[] {
  const sched = [...profile]
    .map((p) => ({ t: minuteOfDay(p.at, rangeStart), rate: p.value }))
    .sort((a, b) => a.t - b.t)

  if (sched.length === 0) sched.push({ t: 0, rate: 0 })
  if (sched[0].t > 0) sched.unshift({ t: 0, rate: sched[0].rate })

  // Apply temps on top. Each temp has start minute, duration, rate.
  const points: BasalRow[] = []
  for (let t = 0; t <= DAY_MAX; t += 5) {
    let rate = 0
    for (let i = 0; i < sched.length; i++) {
      if (sched[i].t <= t) rate = sched[i].rate
    }
    for (const temp of temps) {
      const tStart = minuteOfDay(temp.at, rangeStart)
      const tEnd = tStart + (temp.duration || 30)
      if (t >= tStart && t < tEnd) rate = temp.value
    }
    points.push({ t, rate: Math.round(rate * 1000) / 1000 })
  }
  return points
}

/* ───────────── component ───────────── */
export function DailyTrace({
  rangeStart,
  glucose,
  carbs = [],
  boluses = [],
  smbs = [],
  tempBasals = [],
  basalProfile = [],
  smbgs = [],
  height = 520,
  showBands = true,
}: DailyTraceProps) {
  const [win, setWin] = useState<Window>("24h")
  const [domain, setDomain] = useState<[number, number]>([DAY_MIN, DAY_MAX])

  const data = useMemo(() => {
    const glu: GluRow[] = glucose
      .map((g) => ({ t: minuteOfDay(g.at, rangeStart), v: Math.round(g.value), state: classify(g.value) }))
      .sort((a, b) => a.t - b.t)

    const bol: BolusRow[] = boluses.map((b) => ({
      t: minuteOfDay(b.at, rangeStart),
      u: roundTo(b.value, 2),
      label: b.subtitle || b.label,
    }))
    const smb: BolusRow[] = smbs.map((b) => ({
      t: minuteOfDay(b.at, rangeStart),
      u: roundTo(b.value, 2),
      label: b.subtitle || b.label,
    }))
    const carb: CarbRow[] = carbs.map((c) => ({
      t: minuteOfDay(c.at, rangeStart),
      g: Math.round(c.value),
      label: c.subtitle || c.label,
    }))
    const smbgRows = smbgs.map((s) => ({ t: minuteOfDay(s.at, rangeStart), v: Math.round(s.value) }))

    const basal = expandBasal(rangeStart, basalProfile, tempBasals)
    const iob = iobSeries([...bol, ...smb])

    return { glu, bol, smb, carb, smbgRows, basal, iob }
  }, [rangeStart, glucose, carbs, boluses, smbs, tempBasals, basalProfile, smbgs])

  const setWindow = (w: Window) => {
    setWin(w)
    const endOfGlucose = data.glu.length ? data.glu[data.glu.length - 1].t : DAY_MAX
    const lengths: Record<Window, number> = { "4h": 240, "6h": 360, "12h": 720, "24h": DAY_MAX }
    const len = lengths[w]
    if (len >= DAY_MAX) {
      setDomain([0, DAY_MAX])
    } else {
      const end = Math.min(DAY_MAX, endOfGlucose + 10)
      const start = Math.max(0, end - len)
      setDomain([start, end])
    }
  }

  const ticks = TICK_MINUTES[win]

  const basalHeight = 38
  const iobHeight = 80
  const chartHeight = Math.max(260, height - basalHeight - iobHeight - 16)

  if (!data.glu.length) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: 12 }}>
        No glucose readings for this day.
      </div>
    )
  }

  // Stretch glucose dot data with a y2 (always equals v) so we can scatter-plot.
  const scatterGlu = data.glu.map((d) => ({ x: d.t, y: d.v, state: d.state }))
  const scatterBol = data.bol.map((d) => ({ x: d.t, y: 310, u: d.u }))
  const scatterSmb = data.smb.map((d) => ({ x: d.t, y: 285, u: d.u }))
  const scatterCarb = data.carb.map((d) => ({ x: d.t, y: 330, g: d.g }))
  const scatterSmbg = data.smbgRows.map((d) => ({ x: d.t, y: d.v }))

  return (
    <div style={{ width: "100%" }}>
      {/* Top strip: basal schedule as a thin step area */}
      <ResponsiveContainer width="100%" height={basalHeight}>
        <ComposedChart data={data.basal} margin={{ top: 4, right: 12, bottom: 0, left: 42 }}>
          <XAxis dataKey="t" type="number" domain={domain} hide />
          <YAxis type="number" domain={[0, "dataMax + 0.2"]} hide />
          <Area
            type="stepAfter"
            dataKey="rate"
            stroke="var(--basal)"
            strokeWidth={1.2}
            fill="var(--basal)"
            fillOpacity={0.35}
            isAnimationActive={false}
          />
          {tempBasals.map((t, i) => (
            <ReferenceArea
              key={i}
              x1={minuteOfDay(t.at, rangeStart)}
              x2={Math.min(DAY_MAX, minuteOfDay(t.at, rangeStart) + (t.duration || 30))}
              fill={t.value === 0 ? "var(--st-low)" : "var(--bolus)"}
              fillOpacity={0.22}
              stroke="none"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Main: glucose dots + bolus / smb / carb markers + fingersticks */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart margin={{ top: 8, right: 12, bottom: 0, left: 2 }}>
          <CartesianGrid stroke="var(--line-2)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            type="number"
            dataKey="x"
            domain={domain}
            ticks={ticks}
            tickFormatter={(v) => formatHHMM(Number(v))}
            tick={{ fontSize: 11, fontFamily: "Geist Mono", fill: "var(--ink-4)" }}
            stroke="var(--line)"
            tickLine={false}
            allowDataOverflow
            axisLine={{ stroke: "var(--line)" }}
            height={0}
            hide
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[40, 350]}
            ticks={[70, 100, 180, 250]}
            tick={{ fontSize: 11, fontFamily: "Geist Mono", fill: "var(--ink-3)" }}
            stroke="var(--line)"
            axisLine={false}
            tickLine={false}
            width={42}
          />

          {showBands && (
            <>
              <ReferenceArea y1={40} y2={54} fill="var(--st-vlow)" fillOpacity={0.08} stroke="none" />
              <ReferenceArea y1={54} y2={70} fill="var(--st-low)" fillOpacity={0.08} stroke="none" />
              <ReferenceArea y1={70} y2={180} fill="var(--st-in)" fillOpacity={0.05} stroke="none" />
              <ReferenceArea y1={180} y2={250} fill="var(--st-high)" fillOpacity={0.06} stroke="none" />
              <ReferenceArea y1={250} y2={350} fill="var(--st-vhigh)" fillOpacity={0.08} stroke="none" />
              <ReferenceLine
                y={70}
                stroke="var(--st-low)"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                strokeWidth={1}
              />
              <ReferenceLine y={100} stroke="var(--st-in)" strokeOpacity={0.55} strokeWidth={1} />
              <ReferenceLine
                y={180}
                stroke="var(--st-high)"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                strokeWidth={1}
              />
            </>
          )}

          {/* Fingersticks: ringed dots on top of everything */}
          <Scatter
            data={scatterSmbg}
            dataKey="y"
            shape={(props: any) => <SMBGMarker {...props} />}
            isAnimationActive={false}
          />

          {/* Glucose readings as dots colored by range */}
          <Scatter
            data={scatterGlu}
            dataKey="y"
            shape={(props: any) => <GluDot {...props} />}
            isAnimationActive={false}
          />

          {/* Carb markers at the very top */}
          <Scatter
            data={scatterCarb}
            dataKey="y"
            shape={(props: any) => <CarbMarker {...props} />}
            isAnimationActive={false}
          />

          {/* Bolus: big labeled triangles */}
          <Scatter
            data={scatterBol}
            dataKey="y"
            shape={(props: any) => <BolusMarker {...props} />}
            isAnimationActive={false}
          />

          {/* SMB: tiny labeled triangles */}
          <Scatter
            data={scatterSmb}
            dataKey="y"
            shape={(props: any) => <SMBMarker {...props} />}
            isAnimationActive={false}
          />

          <Tooltip
            cursor={{ stroke: "var(--ink)", strokeDasharray: "3 3", strokeOpacity: 0.35 }}
            isAnimationActive={false}
            content={(props: any) => <HoverTooltip {...props} data={data} />}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Bottom: IOB area strip */}
      <ResponsiveContainer width="100%" height={iobHeight}>
        <ComposedChart data={data.iob} margin={{ top: 0, right: 12, bottom: 20, left: 2 }}>
          <defs>
            <linearGradient id="iobGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--bolus)" stopOpacity={0.55} />
              <stop offset="1" stopColor="var(--bolus)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line-2)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={domain}
            ticks={ticks}
            tickFormatter={(v) => formatHHMM(Number(v))}
            tick={{ fontSize: 11, fontFamily: "Geist Mono", fill: "var(--ink-4)" }}
            stroke="var(--line)"
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
          />
          <YAxis
            type="number"
            domain={[0, "dataMax + 0.5"]}
            tick={{ fontSize: 10, fontFamily: "Geist Mono", fill: "var(--ink-4)" }}
            stroke="var(--line)"
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Area
            type="monotone"
            dataKey="iob"
            stroke="var(--bolus)"
            strokeWidth={1.5}
            fill="url(#iobGrad)"
            isAnimationActive={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--ink)", strokeDasharray: "3 3", strokeOpacity: 0.3 }}
            formatter={(value: any) => [`${Number(value).toFixed(2)} U`, "IOB"]}
            labelFormatter={(v) => formatHHMM(Number(v))}
            contentStyle={{
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 6,
              fontSize: 11,
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Range tabs */}
      <div className="row" style={{ marginTop: 8, gap: 6, justifyContent: "flex-end" }}>
        {(["4h", "6h", "12h", "24h"] as const).map((w) => (
          <button
            key={w}
            type="button"
            className={"tab" + (win === w ? " is-active" : "")}
            onClick={() => setWindow(w)}
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ───────────── markers ───────────── */
function GluDot({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const state = payload?.state as State
  return <circle cx={cx} cy={cy} r={3} fill={STATE_COLOR[state] || "var(--ink)"} stroke="none" />
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

function CarbMarker({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const g = Number(payload?.g || 0)
  const r = Math.min(10, 5 + g / 8)
  return (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={r} fill="var(--carbs)" opacity={0.95} />
      <text textAnchor="middle" y={3} fontSize={9} fontFamily="Geist Mono" fill="var(--surface)" fontWeight={600}>
        {g}
      </text>
    </g>
  )
}

function BolusMarker({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const u = Number(payload?.u || 0)
  const s = Math.max(5, Math.min(10, 4 + u * 0.4))
  return (
    <g transform={`translate(${cx},${cy})`}>
      <text textAnchor="middle" y={-s - 3} fontSize={10} fontFamily="Geist Mono" fill="var(--ink)" fontWeight={600}>
        {u.toFixed(u >= 1 ? 1 : 2)}
      </text>
      {/* Downward triangle, outlined + filled for pop */}
      <polygon
        points={`0,${s} ${s * 0.9},${-s * 0.7} ${-s * 0.9},${-s * 0.7}`}
        fill="var(--bolus)"
        stroke="var(--surface)"
        strokeWidth={0.8}
      />
    </g>
  )
}

function SMBMarker({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const u = Number(payload?.u || 0)
  const s = Math.max(2.8, Math.min(5, 2 + u * 4))
  const label = formatSmb(u)
  return (
    <g transform={`translate(${cx},${cy})`}>
      <text textAnchor="middle" y={-s - 1} fontSize={8} fontFamily="Geist Mono" fill="var(--smb)" opacity={0.85}>
        {label}
      </text>
      <polygon
        points={`0,${s} ${s * 0.85},${-s * 0.6} ${-s * 0.85},${-s * 0.6}`}
        fill="var(--smb)"
        opacity={0.9}
      />
    </g>
  )
}

function formatSmb(u: number): string {
  if (u >= 0.1) return u.toFixed(2).replace(/^0\./, ".")
  return u.toFixed(2).replace(/^0\./, ".")
}

/* ───── tooltip ───── */
type HoverData = {
  glu: GluRow[]
  bol: BolusRow[]
  smb: BolusRow[]
  carb: CarbRow[]
  smbgRows: { t: number; v: number }[]
  basal: BasalRow[]
  iob: IobRow[]
}

function HoverTooltip({ active, label, data }: { active?: boolean; label?: number | string; data: HoverData }) {
  if (!active) return null
  const minute = Number(label)
  const glu = nearest(data.glu, minute)
  const basal = nearest(data.basal, minute)
  const iob = nearest(data.iob, minute)

  const nearby: string[] = []
  const window = 8
  data.bol.forEach((b) => {
    if (Math.abs(b.t - minute) <= window) nearby.push(`Bolus ${b.u.toFixed(1)}U`)
  })
  data.smb.forEach((b) => {
    if (Math.abs(b.t - minute) <= window) nearby.push(`SMB ${b.u.toFixed(2)}U`)
  })
  data.carb.forEach((c) => {
    if (Math.abs(c.t - minute) <= window) nearby.push(`Carbs ${c.g}g`)
  })
  data.smbgRows.forEach((s) => {
    if (Math.abs(s.t - minute) <= window) nearby.push(`Fingerstick ${s.v}`)
  })

  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--bg)",
        padding: "10px 12px",
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.55,
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
            {glu.v}
          </span>
          <span className="mono" style={{ opacity: 0.7, fontSize: 10 }}>
            mg/dL · {glu.state}
          </span>
        </div>
      ) : null}
      <div
        className="mono"
        style={{ fontSize: 11, opacity: 0.85, marginTop: 4, display: "flex", gap: 10 }}
      >
        {basal ? <span>basal {basal.rate.toFixed(2)} U/h</span> : null}
        {iob ? <span>IOB {iob.iob.toFixed(2)} U</span> : null}
      </div>
      {nearby.length > 0 ? (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid color-mix(in oklch, var(--bg) 20%, transparent)" }}>
          {nearby.slice(0, 4).map((e, i) => (
            <div key={i} className="mono" style={{ fontSize: 11, opacity: 0.85 }}>
              · {e}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ───── utilities ───── */
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

function roundTo(v: number, decimals: number): number {
  const pow = 10 ** decimals
  return Math.round(v * pow) / pow
}

// Keep the Bar import used in case we later switch to bar-style basal. No-op now.
const _keep = Bar
void _keep

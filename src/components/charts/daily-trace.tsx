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

/* ───────────── props ───────────── */
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
  showRangeTabs?: boolean
  defaultWindow?: Window
}

type Window = "4h" | "6h" | "12h" | "24h"

/* ───────────── constants ───────────── */
const DAY_MAX = 24 * 60
const DIA_MIN = 240 // insulin duration of action (minutes)

/* marker reservation band at top of glucose plane */
const CARB_Y = 340
const BOLUS_Y = 315
const SMB_Y = 290

/* ───────────── helpers ───────────── */
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

function generateTicks(stepMin: number): number[] {
  const out: number[] = []
  for (let m = 0; m <= DAY_MAX; m += stepMin) out.push(m)
  return out
}

function pickTicks(_win: Window, domain: [number, number]): number[] {
  const span = domain[1] - domain[0]
  const step = span <= 360 ? 30 : span <= 720 ? 60 : 180
  const ticks = generateTicks(step)
  return ticks.filter((t) => t >= domain[0] && t <= domain[1])
}

function roundTo(v: number, decimals: number): number {
  const pow = 10 ** decimals
  return Math.round(v * pow) / pow
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

function smbLabel(u: number): string {
  // Show Trio-style comma-decimal (e.g. ".05", ".25")
  if (u >= 1) return u.toFixed(1)
  return u.toFixed(2).replace(/^0\./, ".")
}

/* ───────────── IOB model ───────────── */
function iobSeries(events: { t: number; u: number }[], stepMin = 5) {
  const rows: { t: number; iob: number }[] = []
  for (let t = 0; t <= DAY_MAX; t += stepMin) {
    let sum = 0
    for (const e of events) {
      const dt = t - e.t
      if (dt <= 0 || dt >= DIA_MIN) continue
      const onset = dt < 15 ? dt / 15 : 1
      const decay = Math.max(0, 1 - (dt - 15) / (DIA_MIN - 15))
      sum += e.u * onset * decay
    }
    rows.push({ t, iob: Math.round(sum * 100) / 100 })
  }
  return rows
}

/* ───────────── component ───────────── */
export function DailyTrace({
  rangeStart,
  glucose,
  carbs = [],
  boluses = [],
  smbs = [],
  tempBasals = [],
  basalProfile: _basalProfile = [],
  smbgs = [],
  height = 480,
  showBands = true,
  showRangeTabs = true,
  defaultWindow = "24h",
}: DailyTraceProps) {
  const [win, setWin] = useState<Window>(defaultWindow)

  const data = useMemo(() => {
    const glu = glucose
      .map((g) => ({ t: minuteOfDay(g.at, rangeStart), v: Math.round(g.value), state: classify(g.value) }))
      .sort((a, b) => a.t - b.t)

    const bol = boluses.map((b) => ({
      t: minuteOfDay(b.at, rangeStart),
      u: roundTo(b.value, 2),
    }))
    const smb = smbs.map((b) => ({
      t: minuteOfDay(b.at, rangeStart),
      u: roundTo(b.value, 2),
    }))
    const carb = carbs.map((c) => ({
      t: minuteOfDay(c.at, rangeStart),
      g: Math.round(c.value),
    }))
    const smbgRows = smbgs.map((s) => ({ t: minuteOfDay(s.at, rangeStart), v: Math.round(s.value) }))
    const iob = iobSeries([...bol, ...smb])

    return { glu, bol, smb, carb, smbgRows, iob }
  }, [rangeStart, glucose, carbs, boluses, smbs, smbgs])

  const domain = useMemo<[number, number]>(() => {
    const lengths: Record<Window, number> = { "4h": 240, "6h": 360, "12h": 720, "24h": DAY_MAX }
    const len = lengths[win]
    if (len >= DAY_MAX) return [0, DAY_MAX]
    const endOfGlu = data.glu.length ? data.glu[data.glu.length - 1].t : DAY_MAX
    const end = Math.min(DAY_MAX, endOfGlu + 10)
    return [Math.max(0, end - len), end]
  }, [data.glu, win])

  const ticks = pickTicks(win, domain)

  if (!data.glu.length) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: 12 }}>
        No glucose readings for this day.
      </div>
    )
  }

  const iobHeight = Math.min(90, Math.max(70, Math.round(height * 0.18)))
  const chartHeight = height - iobHeight - (showRangeTabs ? 28 : 0)

  /* Merge glucose + markers into a single main-chart data array so the Tooltip
     can reliably see them at the hovered x-coordinate. */
  type MergedRow = {
    t: number
    glucose?: number
    state?: State
    bolus?: number
    smb?: number
    carb?: number
    smbg?: number
  }
  const merged: MergedRow[] = []
  const byT = new Map<number, MergedRow>()
  const upsert = (t: number): MergedRow => {
    let row = byT.get(t)
    if (!row) {
      row = { t }
      byT.set(t, row)
      merged.push(row)
    }
    return row
  }
  data.glu.forEach((g) => {
    const row = upsert(g.t)
    row.glucose = g.v
    row.state = g.state
  })
  data.bol.forEach((b) => {
    upsert(b.t).bolus = b.u
  })
  data.smb.forEach((b) => {
    upsert(b.t).smb = b.u
  })
  data.carb.forEach((c) => {
    upsert(c.t).carb = c.g
  })
  data.smbgRows.forEach((s) => {
    upsert(s.t).smbg = s.v
  })
  merged.sort((a, b) => a.t - b.t)

  return (
    <div style={{ width: "100%" }}>
      {/* Main glucose panel */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={merged} margin={{ top: 10, right: 12, bottom: 0, left: 2 }}>
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
            allowDataOverflow
          />
          <YAxis
            type="number"
            domain={[40, 350]}
            ticks={[70, 100, 180, 250]}
            tick={{ fontSize: 11, fontFamily: "Geist Mono", fill: "var(--ink-3)" }}
            stroke="var(--line)"
            axisLine={false}
            tickLine={false}
            width={42}
            allowDataOverflow
          />

          {showBands && (
            <>
              <ReferenceArea y1={40} y2={54} fill="var(--st-vlow)" fillOpacity={0.08} stroke="none" />
              <ReferenceArea y1={54} y2={70} fill="var(--st-low)" fillOpacity={0.08} stroke="none" />
              <ReferenceArea y1={70} y2={180} fill="var(--st-in)" fillOpacity={0.05} stroke="none" />
              <ReferenceArea y1={180} y2={250} fill="var(--st-high)" fillOpacity={0.06} stroke="none" />
              <ReferenceArea y1={250} y2={275} fill="var(--st-vhigh)" fillOpacity={0.08} stroke="none" />
              <ReferenceLine y={70} stroke="var(--st-low)" strokeDasharray="4 4" strokeOpacity={0.7} />
              <ReferenceLine y={100} stroke="var(--st-in)" strokeOpacity={0.55} />
              <ReferenceLine y={180} stroke="var(--st-high)" strokeDasharray="4 4" strokeOpacity={0.7} />
            </>
          )}

          {/* Temp basal overlays — faint bands only, no extra strip */}
          {tempBasals.map((t, i) => {
            const x1 = minuteOfDay(t.at, rangeStart)
            const x2 = Math.min(DAY_MAX, x1 + (t.duration || 30))
            const isSuspend = t.value === 0
            return (
              <ReferenceArea
                key={`tb-${i}`}
                x1={x1}
                x2={x2}
                y1={40}
                y2={60}
                fill={isSuspend ? "var(--st-low)" : "var(--bolus)"}
                fillOpacity={0.25}
                stroke="none"
              />
            )
          })}

          {/* Hidden Line to anchor Tooltip cursor to glucose data — never rendered visibly */}
          <Line
            type="monotone"
            dataKey="glucose"
            stroke="transparent"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            connectNulls
          />

          {/* Fingerstick rings — at their real y, drawn first so dots can cover */}
          <Scatter
            dataKey="smbg"
            data={merged}
            shape={(props: any) => <SMBGMarker {...props} />}
            isAnimationActive={false}
          />

          {/* Glucose dots */}
          <Scatter
            dataKey="glucose"
            data={merged}
            shape={(props: any) => <GluDot {...props} />}
            isAnimationActive={false}
          />

          {/* Carb circles at the very top */}
          <Scatter
            data={data.carb.map((d) => ({ t: d.t, y: CARB_Y, g: d.g }))}
            dataKey="y"
            shape={(props: any) => <CarbMarker {...props} />}
            isAnimationActive={false}
          />

          {/* Bolus triangles — big, labeled */}
          <Scatter
            data={data.bol.map((d) => ({ t: d.t, y: BOLUS_Y, u: d.u }))}
            dataKey="y"
            shape={(props: any) => <BolusMarker {...props} />}
            isAnimationActive={false}
          />

          {/* SMB triangles — small, labeled */}
          <Scatter
            data={data.smb.map((d) => ({ t: d.t, y: SMB_Y, u: d.u }))}
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

      {/* IOB strip */}
      <ResponsiveContainer width="100%" height={iobHeight}>
        <ComposedChart data={data.iob} margin={{ top: 2, right: 12, bottom: 22, left: 2 }}>
          <defs>
            <linearGradient id="iobGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--bolus)" stopOpacity={0.55} />
              <stop offset="1" stopColor="var(--bolus)" stopOpacity={0.08} />
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
            allowDataOverflow
          />
          <YAxis
            type="number"
            domain={[0, "dataMax + 0.4"]}
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

      {showRangeTabs && (
        <div className="row" style={{ marginTop: 6, gap: 6, justifyContent: "flex-end" }}>
          {(["4h", "6h", "12h", "24h"] as const).map((w) => (
            <button
              key={w}
              type="button"
              className={"tab" + (win === w ? " is-active" : "")}
              onClick={() => setWin(w)}
              style={{ padding: "4px 10px", fontSize: 12 }}
            >
              {w}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────── markers ───────────── */
function GluDot({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const state = payload?.state as State | undefined
  if (!state) return null
  return <circle cx={cx} cy={cy} r={3.2} fill={STATE_COLOR[state]} stroke="none" />
}

function SMBGMarker({ cx, cy, payload }: any) {
  if (cx == null || cy == null || payload?.smbg == null) return null
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
  const r = Math.min(11, 5 + g / 8)
  return (
    <g transform={`translate(${cx},${cy})`}>
      <circle r={r} fill="var(--carbs)" opacity={0.95} />
      <text
        textAnchor="middle"
        y={3}
        fontSize={9}
        fontFamily="Geist Mono"
        fill="var(--surface)"
        fontWeight={600}
      >
        {g}
      </text>
    </g>
  )
}

function BolusMarker({ cx, cy, payload }: any) {
  if (cx == null || cy == null) return null
  const u = Number(payload?.u || 0)
  const s = Math.max(5, Math.min(10, 4 + u * 0.45))
  return (
    <g transform={`translate(${cx},${cy})`}>
      <text
        textAnchor="middle"
        y={-s - 4}
        fontSize={10}
        fontFamily="Geist Mono"
        fill="var(--ink)"
        fontWeight={600}
      >
        {u >= 1 ? u.toFixed(1) : u.toFixed(2)}
      </text>
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
  const s = Math.max(2.6, Math.min(4.6, 2 + u * 4))
  return (
    <g transform={`translate(${cx},${cy})`}>
      <text
        textAnchor="middle"
        y={-s - 2}
        fontSize={8}
        fontFamily="Geist Mono"
        fill="var(--smb)"
        opacity={0.9}
      >
        {smbLabel(u)}
      </text>
      <polygon
        points={`0,${s} ${s * 0.85},${-s * 0.6} ${-s * 0.85},${-s * 0.6}`}
        fill="var(--smb)"
        opacity={0.9}
      />
    </g>
  )
}

/* ───────────── tooltip ───────────── */
type HoverData = {
  glu: { t: number; v: number; state: State }[]
  bol: { t: number; u: number }[]
  smb: { t: number; u: number }[]
  carb: { t: number; g: number }[]
  smbgRows: { t: number; v: number }[]
  iob: { t: number; iob: number }[]
}

function HoverTooltip({
  active,
  label,
  data,
}: {
  active?: boolean
  label?: number | string
  data: HoverData
}) {
  if (!active || label == null) return null
  const minute = Number(label)
  if (!Number.isFinite(minute)) return null

  const glu = nearest(data.glu, minute)
  const iob = nearest(data.iob, minute)

  const window = 10
  const near: string[] = []
  data.bol.forEach((b) => {
    if (Math.abs(b.t - minute) <= window) near.push(`Bolus ${b.u.toFixed(b.u >= 1 ? 1 : 2)}U`)
  })
  data.smb.forEach((b) => {
    if (Math.abs(b.t - minute) <= window) near.push(`SMB ${smbLabel(b.u)}U`)
  })
  data.carb.forEach((c) => {
    if (Math.abs(c.t - minute) <= window) near.push(`Carbs ${c.g}g`)
  })
  data.smbgRows.forEach((s) => {
    if (Math.abs(s.t - minute) <= window) near.push(`Fingerstick ${s.v}`)
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
      {iob ? (
        <div className="mono" style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
          IOB {iob.iob.toFixed(2)} U
        </div>
      ) : null}
      {near.length > 0 ? (
        <div
          style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: "1px solid color-mix(in oklch, var(--bg) 20%, transparent)",
          }}
        >
          {near.slice(0, 5).map((e, i) => (
            <div key={i} className="mono" style={{ fontSize: 11, opacity: 0.9 }}>
              · {e}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}


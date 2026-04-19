import { useRef, useState } from "react"

import { DAY, type DayData } from "@/lib/design-data"

import { chartColors } from "./chart-colors"

type DailyTraceProps = {
  height?: number
  showBands?: boolean
  showSmb?: boolean
  hover?: boolean
  data?: DayData
}

export function DailyTrace({
  height = 380,
  showBands = true,
  showSmb = true,
  hover = true,
  data,
}: DailyTraceProps) {
  const c = chartColors()
  const W = 1120
  const H = height
  const PAD = { l: 44, r: 20, t: 14, b: 26 }
  const CARB_H = 32
  const BASAL_H = 48
  const GLU_TOP = PAD.t + CARB_H + 4
  const GLU_BOT = H - PAD.b - BASAL_H - 8
  const GLU_H = GLU_BOT - GLU_TOP

  const MIN = 40
  const MAX = 300
  const x = (minutes: number) => PAD.l + (minutes / (24 * 60)) * (W - PAD.l - PAD.r)
  const y = (mgdl: number) =>
    GLU_BOT - Math.max(0, Math.min(1, (mgdl - MIN) / (MAX - MIN))) * GLU_H

  const source = data ?? DAY
  const { pts, boluses, smbs, carbs, smbgs, basalProfile, temp } = source

  type Step = { start: number; end: number; rate: number; kind: string }
  let steps: Step[] = []
  const ps = [
    ...basalProfile.map((p) => ({ t: p.h * 60, r: p.r })),
    { t: 24 * 60, r: basalProfile[basalProfile.length - 1].r },
  ]
  for (let i = 0; i < ps.length - 1; i++) {
    steps.push({ start: ps[i].t, end: ps[i + 1].t, rate: ps[i].r, kind: "profile" })
  }
  const overlay = (tstart: number, tend: number, rate: number, kind: string) => {
    const next: Step[] = []
    steps.forEach((s) => {
      if (s.end <= tstart || s.start >= tend) next.push(s)
      else {
        if (s.start < tstart) next.push({ start: s.start, end: tstart, rate: s.rate, kind: s.kind })
        next.push({ start: Math.max(s.start, tstart), end: Math.min(s.end, tend), rate, kind })
        if (s.end > tend) next.push({ start: tend, end: s.end, rate: s.rate, kind: s.kind })
      }
    })
    steps = next
  }
  temp.forEach((t) => overlay(t.start, t.end, t.rate, t.kind))

  const BMAX = 1.6
  const basalY = (r: number) =>
    PAD.t + CARB_H + GLU_H + 8 + BASAL_H - (r / BMAX) * (BASAL_H - 2)
  const basalBase = PAD.t + CARB_H + GLU_H + 8 + BASAL_H

  const classify = (v: number) => {
    if (v < 54) return "vlow"
    if (v < 70) return "low"
    if (v <= 180) return "in"
    if (v <= 250) return "high"
    return "vhigh"
  }
  type Seg = { cls: string; points: { t: number; v: number }[] }
  const segs: Seg[] = []
  let curSeg: Seg | null = null
  pts.forEach((p) => {
    const cls = classify(p.v)
    if (!curSeg || curSeg.cls !== cls) {
      if (curSeg) curSeg.points.push({ t: p.t, v: p.v })
      curSeg = { cls, points: [] }
      if (segs.length) {
        const last = segs[segs.length - 1].points.slice(-1)[0]
        if (last) curSeg.points.push(last)
      }
      segs.push(curSeg)
    }
    curSeg.points.push({ t: p.t, v: p.v })
  })

  const colorFor: Record<string, string> = {
    in: c.inR,
    low: c.low,
    vlow: c.vlow,
    high: c.vhigh,
    vhigh: c.vhigh,
  }

  const smoothPath = (points: { t: number; v: number }[]) => {
    if (points.length < 2) return ""
    let d = `M ${x(points[0].t)} ${y(points[0].v)}`
    for (let i = 1; i < points.length; i++) {
      const p = points[i]
      const pr = points[i - 1]
      const cx = (x(pr.t) + x(p.t)) / 2
      d += ` Q ${x(pr.t)} ${y(pr.v)} ${cx} ${(y(pr.v) + y(p.v)) / 2}`
    }
    const last = points[points.length - 1]
    d += ` T ${x(last.t)} ${y(last.v)}`
    return d
  }

  const [hoverX, setHoverX] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const onMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if (!hover || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const rx = ((e.clientX - r.left) / r.width) * W
    if (rx < PAD.l || rx > W - PAD.r) {
      setHoverX(null)
      return
    }
    setHoverX(rx)
  }
  const onLeave = () => setHoverX(null)

  const hoverMin = hoverX !== null ? ((hoverX - PAD.l) / (W - PAD.l - PAD.r)) * 24 * 60 : null
  const hoverPoint =
    hoverMin !== null
      ? pts.reduce((a, b) => (Math.abs(b.t - hoverMin) < Math.abs(a.t - hoverMin) ? b : a))
      : null

  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21]
  const mgLabels = [54, 70, 140, 180, 250]

  if (pts.length === 0) {
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
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block" }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <defs>
        <clipPath id="gluClip">
          <rect x={PAD.l} y={GLU_TOP} width={W - PAD.l - PAD.r} height={GLU_H} />
        </clipPath>
        <linearGradient id="gradIn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c.inR} stopOpacity="0.12" />
          <stop offset="1" stopColor={c.inR} stopOpacity="0" />
        </linearGradient>
      </defs>

      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={PAD.t + CARB_H}
        y2={PAD.t + CARB_H}
        stroke={c.line}
      />
      <text x={PAD.l - 8} y={PAD.t + 14} textAnchor="end" fontSize="10" fontFamily="Geist Mono" fill={c.ink4}>
        carbs
      </text>
      {carbs.map((k, i) => {
        const cx = x(k.t)
        const size = 4 + Math.min(10, k.g / 8)
        return (
          <g key={i} transform={`translate(${cx}, ${PAD.t})`}>
            <line x1="0" x2="0" y1={CARB_H} y2={10} stroke={c.carbs} strokeWidth="1" strokeDasharray="2 2" />
            <circle cx="0" cy={size + 2} r={size} fill={c.carbs} opacity="0.92" />
            <text x="0" y={size + 5} textAnchor="middle" fontSize="9" fontFamily="Geist Mono" fill={c.surface} fontWeight="600">
              {k.g}
            </text>
          </g>
        )
      })}

      {showBands && (
        <g>
          <rect x={PAD.l} y={y(54)} width={W - PAD.l - PAD.r} height={GLU_BOT - y(54)} fill={c.vlow} opacity="0.06" />
          <rect x={PAD.l} y={y(70)} width={W - PAD.l - PAD.r} height={y(54) - y(70)} fill={c.low} opacity="0.06" />
          <rect x={PAD.l} y={y(140)} width={W - PAD.l - PAD.r} height={y(70) - y(140)} fill={c.inR} opacity="0.05" />
          <rect x={PAD.l} y={y(250)} width={W - PAD.l - PAD.r} height={y(180) - y(250)} fill={c.high} opacity="0.05" />
          <rect x={PAD.l} y={GLU_TOP} width={W - PAD.l - PAD.r} height={y(250) - GLU_TOP} fill={c.vhigh} opacity="0.07" />
          {[70, 180].map((m) => (
            <line
              key={m}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(m)}
              y2={y(m)}
              stroke={m === 70 ? c.low : c.high}
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.55"
            />
          ))}
        </g>
      )}

      {mgLabels.map((m) => (
        <g key={m}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(m)} y2={y(m)} stroke={c.line2} strokeDasharray="2 4" opacity="0.9" />
          <text x={PAD.l - 6} y={y(m) + 3} textAnchor="end" fontSize="10" fontFamily="Geist Mono" fill={c.ink4}>
            {m}
          </text>
        </g>
      ))}

      {hourLabels.map((h) => (
        <line
          key={h}
          x1={x(h * 60)}
          x2={x(h * 60)}
          y1={GLU_TOP}
          y2={GLU_BOT}
          stroke={c.line2}
          strokeDasharray="2 6"
          opacity="0.7"
        />
      ))}

      <g clipPath="url(#gluClip)">
        {boluses.map((b, i) => {
          const cx = x(b.t)
          const size = 4 + Math.min(8, b.u)
          return (
            <g key={i} transform={`translate(${cx}, ${GLU_TOP + 8})`}>
              <polygon
                points={`0,-${size} ${size * 0.8},${size * 0.5} -${size * 0.8},${size * 0.5}`}
                fill={c.bolus}
                opacity="0.92"
              />
              <text x="0" y={size + 10} textAnchor="middle" fontSize="9" fontFamily="Geist Mono" fill={c.ink3}>
                {b.u}U
              </text>
            </g>
          )
        })}

        {showSmb &&
          smbs.map((s, i) => (
            <circle
              key={i}
              cx={x(s.t)}
              cy={y(pts.find((p) => p.t === s.t)?.v ?? 140)}
              r="1.8"
              fill={c.smb}
              opacity="0.75"
            />
          ))}
      </g>

      <g clipPath="url(#gluClip)">
        {segs.map((s, i) => (
          <path
            key={i}
            d={smoothPath(s.points)}
            fill="none"
            stroke={colorFor[s.cls]}
            strokeWidth="2.1"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <path
          d={`${smoothPath(pts)} L ${x(pts[pts.length - 1].t)} ${GLU_BOT} L ${x(pts[0].t)} ${GLU_BOT} Z`}
          fill="url(#gradIn)"
        />
      </g>

      {smbgs.map((s, i) => (
        <g key={i}>
          <circle cx={x(s.t)} cy={y(s.v)} r="5" fill={c.bg} stroke={c.ink} strokeWidth="1.5" />
          <circle cx={x(s.t)} cy={y(s.v)} r="1.8" fill={c.ink} />
        </g>
      ))}

      <text x={PAD.l - 8} y={basalBase - BASAL_H + 10} textAnchor="end" fontSize="10" fontFamily="Geist Mono" fill={c.ink4}>
        U/h
      </text>
      <line x1={PAD.l} x2={W - PAD.r} y1={basalBase} y2={basalBase} stroke={c.line} />
      {steps.map((s, i) => {
        const x1 = x(s.start)
        const x2 = x(s.end)
        const yy = basalY(s.rate)
        const fill =
          s.kind === "profile" ? c.basal : s.kind === "increased" ? c.bolus : c.smb
        return (
          <g key={i}>
            <rect
              x={x1}
              y={yy}
              width={x2 - x1}
              height={basalBase - yy}
              fill={fill}
              opacity={s.kind === "profile" ? 0.28 : 0.55}
            />
            <line x1={x1} x2={x2} y1={yy} y2={yy} stroke={fill} strokeWidth="1.3" />
          </g>
        )
      })}

      {hourLabels.map((h) => (
        <text
          key={h}
          x={x(h * 60)}
          y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fontFamily="Geist Mono"
          fill={c.ink4}
        >
          {String(h).padStart(2, "0")}:00
        </text>
      ))}

      {hoverX !== null && hoverPoint && (
        <g>
          <line
            x1={hoverX}
            x2={hoverX}
            y1={GLU_TOP}
            y2={basalBase}
            stroke={c.ink}
            strokeDasharray="3 3"
            opacity="0.4"
          />
          <circle cx={x(hoverPoint.t)} cy={y(hoverPoint.v)} r="4" fill={c.surface} stroke={c.ink} strokeWidth="1.5" />
          <g transform={`translate(${Math.min(hoverX + 8, W - 180)}, ${GLU_TOP + 6})`}>
            <rect width="170" height="52" rx="6" fill={c.ink} opacity="0.95" />
            <text x="10" y="18" fontSize="11" fontFamily="Geist Mono" fill={c.bg} opacity="0.7">
              {String(Math.floor(hoverPoint.t / 60)).padStart(2, "0")}:
              {String(hoverPoint.t % 60).padStart(2, "0")}
            </text>
            <text x="10" y="36" fontSize="15" fontFamily="Geist" fontWeight="600" fill={c.bg}>
              {hoverPoint.v}{" "}
              <tspan fontSize="10" opacity="0.7">
                mg/dL
              </tspan>
            </text>
            <text x="100" y="36" fontSize="10" fontFamily="Geist Mono" fill={c.bg} opacity="0.7">
              {classify(hoverPoint.v)}
            </text>
          </g>
        </g>
      )}
    </svg>
  )
}

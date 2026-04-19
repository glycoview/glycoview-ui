import { useMemo, useRef, useState } from "react"

import { AGP as MOCK_AGP, type AGPBucket } from "@/lib/design-data"

import { chartColors } from "./chart-colors"

type AGPChartProps = {
  height?: number
  showBands?: boolean
  showOuter?: boolean
  showInner?: boolean
  showMedian?: boolean
  buckets?: AGPBucket[]
}

export function AGPChart({
  height = 340,
  showBands = true,
  showOuter = true,
  showInner = true,
  showMedian = true,
  buckets,
}: AGPChartProps) {
  const c = chartColors()
  const AGP = buckets && buckets.length > 0 ? buckets : MOCK_AGP
  const W = 1120
  const H = height
  const PAD = { l: 44, r: 20, t: 18, b: 28 }
  const MIN = 40
  const MAX = 300
  const x = (h: number) => PAD.l + (h / 23) * (W - PAD.l - PAD.r)
  const y = (v: number) =>
    PAD.t + (1 - (Math.max(MIN, Math.min(MAX, v)) - MIN) / (MAX - MIN)) * (H - PAD.t - PAD.b)

  const band = (low: keyof (typeof AGP)[number], high: keyof (typeof AGP)[number]) => {
    const top = AGP.map((b) => `${x(b.hour)},${y(b[high] as number)}`).join(" ")
    const bot = [...AGP].reverse().map((b) => `${x(b.hour)},${y(b[low] as number)}`).join(" ")
    return `${top} ${bot}`
  }
  const median = AGP.map((b) => `${x(b.hour)},${y(b.p50)}`).join(" ")

  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21]
  const mgLabels = [54, 70, 140, 180, 250]

  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverH, setHoverH] = useState<number | null>(null)
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null)
  const [drag, setDrag] = useState<number | null>(null)

  const hoverBin =
    hoverH != null ? AGP.reduce((a, b) => (Math.abs(b.hour - hoverH) < Math.abs(a.hour - hoverH) ? b : a)) : null

  const toHour = (e: React.MouseEvent<SVGSVGElement>): number | null => {
    if (!svgRef.current) return null
    const r = svgRef.current.getBoundingClientRect()
    const rx = ((e.clientX - r.left) / r.width) * W
    if (rx < PAD.l || rx > W - PAD.r) return null
    return ((rx - PAD.l) / (W - PAD.l - PAD.r)) * 23
  }

  const onMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const h = toHour(e)
    setHoverH(h)
    if (drag !== null && h !== null) {
      setSel({ a: Math.min(drag, h), b: Math.max(drag, h) })
    }
  }
  const onDown: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const h = toHour(e)
    if (h == null) return
    setDrag(h)
    setSel({ a: h, b: h })
  }
  const onUp = () => {
    if (drag !== null && sel && Math.abs(sel.b - sel.a) < 0.4) setSel(null)
    setDrag(null)
  }

  const selStats = useMemo(() => {
    if (!sel) return null
    const bins = AGP.filter((b) => b.hour >= sel.a && b.hour <= sel.b)
    if (!bins.length) return null
    const avg = Math.round(bins.reduce((a, b) => a + b.p50, 0) / bins.length)
    const lo = Math.round(Math.min(...bins.map((b) => b.p10)))
    const hi = Math.round(Math.max(...bins.map((b) => b.p90)))
    return { avg, lo, hi, hours: sel.b - sel.a }
  }, [sel])

  const fmtH = (h: number) =>
    `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{
        display: "block",
        cursor: drag !== null ? "ew-resize" : "crosshair",
        userSelect: "none",
      }}
      onMouseMove={onMove}
      onMouseLeave={() => {
        setHoverH(null)
        setDrag(null)
      }}
      onMouseDown={onDown}
      onMouseUp={onUp}
    >
      {showBands && (
        <g>
          <rect x={PAD.l} y={y(180)} width={W - PAD.l - PAD.r} height={y(70) - y(180)} fill={c.inR} opacity="0.05" />
          <line x1={PAD.l} x2={W - PAD.r} y1={y(70)} y2={y(70)} stroke={c.low} strokeDasharray="4 4" opacity="0.5" />
          <line x1={PAD.l} x2={W - PAD.r} y1={y(180)} y2={y(180)} stroke={c.high} strokeDasharray="4 4" opacity="0.5" />
        </g>
      )}

      {mgLabels.map((m) => (
        <g key={m}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(m)} y2={y(m)} stroke={c.line2} strokeDasharray="2 4" />
          <text x={PAD.l - 6} y={y(m) + 3} textAnchor="end" fontSize="10" fontFamily="Geist Mono" fill={c.ink4}>
            {m}
          </text>
        </g>
      ))}

      {sel && (
        <rect
          x={x(sel.a)}
          y={PAD.t}
          width={Math.max(1, x(sel.b) - x(sel.a))}
          height={H - PAD.t - PAD.b}
          fill={c.ink}
          opacity="0.06"
        />
      )}

      {showOuter && <polygon points={band("p10", "p90")} fill={c.ink} opacity="0.08" />}
      {showInner && <polygon points={band("p25", "p75")} fill={c.ink} opacity="0.16" />}
      {showMedian && (
        <polyline points={median} fill="none" stroke={c.ink} strokeWidth="2.4" strokeLinejoin="round" />
      )}

      {showInner &&
        AGP.map((b, i) => (
          <g key={i}>
            <circle cx={x(b.hour)} cy={y(b.p25)} r="1.5" fill={c.ink3} />
            <circle cx={x(b.hour)} cy={y(b.p75)} r="1.5" fill={c.ink3} />
          </g>
        ))}

      {hourLabels.map((h) => (
        <text
          key={h}
          x={x(h)}
          y={H - 8}
          textAnchor="middle"
          fontSize="10"
          fontFamily="Geist Mono"
          fill={c.ink4}
        >
          {String(h).padStart(2, "0")}:00
        </text>
      ))}

      {hoverH != null && hoverBin && drag === null && (
        <g>
          <line
            x1={x(hoverBin.hour)}
            x2={x(hoverBin.hour)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke={c.ink}
            strokeDasharray="3 3"
            opacity="0.4"
          />
          {showOuter && (
            <>
              <line x1={x(hoverBin.hour) - 6} x2={x(hoverBin.hour) + 6} y1={y(hoverBin.p10)} y2={y(hoverBin.p10)} stroke={c.ink3} strokeWidth="1.2" />
              <line x1={x(hoverBin.hour) - 6} x2={x(hoverBin.hour) + 6} y1={y(hoverBin.p90)} y2={y(hoverBin.p90)} stroke={c.ink3} strokeWidth="1.2" />
            </>
          )}
          {showInner && (
            <>
              <line x1={x(hoverBin.hour) - 8} x2={x(hoverBin.hour) + 8} y1={y(hoverBin.p25)} y2={y(hoverBin.p25)} stroke={c.ink} strokeWidth="1.4" />
              <line x1={x(hoverBin.hour) - 8} x2={x(hoverBin.hour) + 8} y1={y(hoverBin.p75)} y2={y(hoverBin.p75)} stroke={c.ink} strokeWidth="1.4" />
            </>
          )}
          <circle cx={x(hoverBin.hour)} cy={y(hoverBin.p50)} r="4" fill={c.surface} stroke={c.ink} strokeWidth="1.6" />
          <g transform={`translate(${Math.min(x(hoverBin.hour) + 10, W - 220)}, ${PAD.t + 6})`}>
            <rect width="210" height="78" rx="6" fill={c.ink} opacity="0.96" />
            <text x="12" y="18" fontSize="11" fontFamily="Geist Mono" fill={c.bg} opacity="0.7">
              {String(hoverBin.hour).padStart(2, "0")}:00
            </text>
            <text x="12" y="38" fontSize="15" fontFamily="Geist" fontWeight="600" fill={c.bg}>
              median <tspan fontFamily="Geist Mono">{hoverBin.p50.toFixed(0)}</tspan>
            </text>
            <text x="12" y="56" fontSize="11" fontFamily="Geist Mono" fill={c.bg} opacity="0.85">
              25–75 {hoverBin.p25.toFixed(0)}–{hoverBin.p75.toFixed(0)}
            </text>
            <text x="12" y="70" fontSize="11" fontFamily="Geist Mono" fill={c.bg} opacity="0.65">
              10–90 {hoverBin.p10.toFixed(0)}–{hoverBin.p90.toFixed(0)}
            </text>
          </g>
        </g>
      )}

      {sel && selStats && sel.b - sel.a > 0.3 && (
        <g>
          <line x1={x(sel.a)} x2={x(sel.a)} y1={PAD.t} y2={H - PAD.b} stroke={c.ink} strokeWidth="1" opacity="0.5" />
          <line x1={x(sel.b)} x2={x(sel.b)} y1={PAD.t} y2={H - PAD.b} stroke={c.ink} strokeWidth="1" opacity="0.5" />
          <g
            transform={`translate(${Math.max(PAD.l + 4, Math.min(x((sel.a + sel.b) / 2) - 120, W - 244))}, ${H - PAD.b - 56})`}
          >
            <rect width="240" height="44" rx="6" fill={c.surface} stroke={c.ink} strokeWidth="1" opacity="0.98" />
            <text x="12" y="17" fontSize="10" fontFamily="Geist Mono" fill={c.ink4}>
              SELECTION · {fmtH(sel.a)}–{fmtH(sel.b)}
            </text>
            <text x="12" y="34" fontSize="12" fontFamily="Geist Mono" fill={c.ink}>
              avg <tspan fontWeight="600">{selStats.avg}</tspan> · range{" "}
              <tspan fontWeight="600">
                {selStats.lo}–{selStats.hi}
              </tspan>
            </text>
          </g>
        </g>
      )}
    </svg>
  )
}

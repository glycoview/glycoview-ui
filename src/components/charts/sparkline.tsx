import type { GluPoint } from "@/lib/design-data"

import { chartColors } from "./chart-colors"

type SparklineProps = {
  pts: GluPoint[]
  height?: number
  color?: string
  thresholds?: [number, number]
}

export function Sparkline({
  pts,
  height = 44,
  color,
  thresholds = [70, 180],
}: SparklineProps) {
  const c = chartColors()
  const W = 240
  const H = height
  if (!pts.length) return null
  const ys = pts.map((p) => p.v)
  const min = Math.min(...ys, thresholds[0] - 10)
  const max = Math.max(...ys, thresholds[1] + 10)
  const x = (i: number) => (i / Math.max(1, pts.length - 1)) * W
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.v)}`).join(" ")
  const stroke = color || c.ink
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <line x1="0" x2={W} y1={y(thresholds[0])} y2={y(thresholds[0])} stroke={c.low} strokeDasharray="3 3" opacity="0.5" />
      <line x1="0" x2={W} y1={y(thresholds[1])} y2={y(thresholds[1])} stroke={c.high} strokeDasharray="3 3" opacity="0.5" />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].v)} r="3" fill={stroke} />
    </svg>
  )
}

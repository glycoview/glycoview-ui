import { useMemo } from "react"

import type { Progress } from "@/lib/goals-api"

type Props = {
  progress: Progress
  targetDate?: string
  goodDirection: "higher" | "lower"
  height?: number
}

/**
 * Draws the daily series with a target line, a trend projection line and the
 * "fail region" shaded. Pure SVG so we don't pull another chart dep.
 */
export function GoalChart({ progress, targetDate, goodDirection, height = 170 }: Props) {
  const { targetValue } = progress
  const padL = 38
  const padR = 12
  const padT = 10
  const padB = 22

  const { pts, xMin, xMax, yMin, yMax, dates } = useMemo(() => {
    const dates = progress.dailySeries.map((d) => d.date)
    const base = progress.dailySeries.map((d, i) => ({ x: i, y: d.value, met: d.met, date: d.date }))
    let xMin = 0
    let xMax = Math.max(1, base.length - 1)
    let yMin = Math.min(progress.targetValue, ...base.map((b) => b.y))
    let yMax = Math.max(progress.targetValue, ...base.map((b) => b.y))
    if (yMin === yMax) {
      yMin -= 5
      yMax += 5
    }
    const pad = (yMax - yMin) * 0.12
    yMin -= pad
    yMax += pad
    // If trajectory projects to target date, stretch x axis so the projection
    // line continues past the last observation.
    if (progress.trajectory && targetDate && dates.length > 0) {
      const lastDate = dates[dates.length - 1]
      const extra = daysBetweenDates(lastDate, targetDate)
      if (extra > 0) xMax = base.length - 1 + extra
    }
    return { pts: base, xMin, xMax, yMin, yMax, dates }
  }, [progress, targetDate])

  const w = 640
  const h = height
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const toX = (x: number) => padL + ((x - xMin) / Math.max(1, xMax - xMin)) * innerW
  const toY = (y: number) => padT + (1 - (y - yMin) / Math.max(1e-9, yMax - yMin)) * innerH

  // Trajectory projection line (if we have enough days)
  const proj = progress.trajectory
  const projPath = useMemo(() => {
    if (!proj) return null
    if (pts.length < 2) return null
    const last = pts[pts.length - 1]
    const endX = xMax
    const endY = last.y + proj.slopePerDay * (endX - last.x)
    return { x1: last.x, y1: last.y, x2: endX, y2: endY }
  }, [proj, pts, xMax])

  // Filled polyline
  const linePath = useMemo(() => {
    if (pts.length === 0) return ""
    return pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`)
      .join(" ")
  }, [pts, xMin, xMax, yMin, yMax])

  const targetY = toY(targetValue)
  const failY = goodDirection === "higher" ? toY(yMin) : toY(yMax)
  const failHeight = Math.abs(failY - targetY)

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      style={{ display: "block" }}
      preserveAspectRatio="none"
    >
      <rect
        x={padL}
        y={goodDirection === "higher" ? targetY : padT}
        width={innerW}
        height={goodDirection === "higher" ? failHeight : targetY - padT}
        fill="color-mix(in oklch, var(--st-low) 10%, transparent)"
      />
      <rect
        x={padL}
        y={goodDirection === "higher" ? padT : targetY}
        width={innerW}
        height={goodDirection === "higher" ? targetY - padT : failHeight}
        fill="color-mix(in oklch, var(--st-in) 10%, transparent)"
      />

      {/* grid */}
      {[0, 1, 2, 3].map((i) => {
        const y = padT + (i / 3) * innerH
        return (
          <line
            key={i}
            x1={padL}
            y1={y}
            x2={w - padR}
            y2={y}
            stroke="var(--line-2)"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        )
      })}

      {/* y-axis ticks */}
      {[yMin, (yMin + yMax) / 2, yMax].map((yv, i) => (
        <text
          key={i}
          x={padL - 6}
          y={toY(yv) + 4}
          fontSize={10}
          fill="var(--ink-4)"
          fontFamily="var(--font-mono)"
          textAnchor="end"
        >
          {formatAxisValue(yv, progress.unit)}
        </text>
      ))}

      {/* Target line */}
      <line
        x1={padL}
        y1={targetY}
        x2={w - padR}
        y2={targetY}
        stroke="var(--ink-3)"
        strokeWidth={1.25}
        strokeDasharray="5 4"
      />
      <text
        x={w - padR - 4}
        y={targetY - 4}
        fontSize={10}
        fill="var(--ink-3)"
        textAnchor="end"
        fontFamily="var(--font-mono)"
      >
        target {formatAxisValue(targetValue, progress.unit)}
      </text>

      {/* Projection */}
      {projPath ? (
        <line
          x1={toX(projPath.x1)}
          y1={toY(projPath.y1)}
          x2={toX(projPath.x2)}
          y2={toY(projPath.y2)}
          stroke="var(--accent-2)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.85}
        />
      ) : null}

      {/* Daily series */}
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={1.75} />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={toX(p.x)}
          cy={toY(p.y)}
          r={2.8}
          fill={p.met ? "var(--st-in)" : "var(--st-vhigh)"}
          stroke="var(--surface)"
          strokeWidth={1}
        />
      ))}

      {/* x-axis labels — first and last */}
      {dates.length > 0 ? (
        <text x={padL} y={h - 6} fontSize={10} fill="var(--ink-4)" fontFamily="var(--font-mono)">
          {shortDate(dates[0])}
        </text>
      ) : null}
      {dates.length > 0 ? (
        <text
          x={toX(pts[pts.length - 1]?.x ?? 0)}
          y={h - 6}
          fontSize={10}
          fill="var(--ink-4)"
          fontFamily="var(--font-mono)"
          textAnchor="middle"
        >
          {shortDate(dates[dates.length - 1])}
        </text>
      ) : null}
      {targetDate && projPath ? (
        <text
          x={toX(projPath.x2) - 4}
          y={h - 6}
          fontSize={10}
          fill="var(--accent-2)"
          fontFamily="var(--font-mono)"
          textAnchor="end"
        >
          {shortDate(targetDate)}
        </text>
      ) : null}

    </svg>
  )
}

function formatAxisValue(v: number, unit: string): string {
  if (unit === "%") return v.toFixed(0) + "%"
  if (unit === "mg/dL") return v.toFixed(0)
  if (unit === "events") return v.toFixed(0)
  if (unit === "min") return v.toFixed(0)
  return v.toFixed(1)
}

function shortDate(iso: string): string {
  // YYYY-MM-DD → MM-DD
  if (!iso || iso.length < 10) return iso
  return iso.slice(5)
}

function daysBetweenDates(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00Z")
  const db = Date.parse(b + "T00:00:00Z")
  if (Number.isNaN(da) || Number.isNaN(db)) return 0
  return Math.round((db - da) / (24 * 3600 * 1000))
}


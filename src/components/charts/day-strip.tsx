import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import type { DailySummary } from "@/lib/design-data"

type Props = {
  days: DailySummary[]
  /** Show the three-tier legend underneath. Default true. */
  showLegend?: boolean
}

type Cell = {
  date: string
  dow: string
  tir: number
  row: number // 0=Mon … 6=Sun
  col: number // 0-indexed calendar week
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

/**
 * GitHub-contribution-style heatmap of 14-day TIR. Click any cell to jump to
 * the Daily view for that date. Empty cells (no data yet) render as ghosts.
 *
 * Color scale:
 *   - TIR ≥ 70%  green
 *   - 50 ≤ TIR < 70  amber
 *   - TIR < 50  red
 */
export function DayStrip({ days, showLegend = true }: Props) {
  const navigate = useNavigate()

  const { cells, cols } = useMemo(() => {
    // Sort by date to be safe, then bucket into (row=Mon..Sun, col=week).
    const sorted = [...days]
      .filter((d) => d.date)
      .sort((a, b) => a.date.localeCompare(b.date))

    if (!sorted.length) return { cells: [], cols: 0 }

    const firstDate = new Date(sorted[0].date + "T00:00:00")
    const dayOfWeek = (d: Date) => (d.getDay() + 6) % 7 // Mon=0..Sun=6
    const firstCol = 0 // relative to first day
    const out: Cell[] = []
    let maxCol = 0
    for (const d of sorted) {
      const dt = new Date(d.date + "T00:00:00")
      const diffDays = Math.round((dt.getTime() - firstDate.getTime()) / (24 * 3600 * 1000))
      const row = dayOfWeek(dt)
      // Start the first day in col 0; then advance a column each week boundary.
      // We want Mondays to line up, so col = (diffDays + startRowOffset) // 7.
      const startRowOffset = dayOfWeek(firstDate)
      const col = firstCol + Math.floor((diffDays + startRowOffset) / 7)
      if (col > maxCol) maxCol = col
      out.push({
        date: d.date,
        dow: d.dow ?? DOW[row],
        tir: d.tir ?? 0,
        row,
        col,
      })
    }
    return { cells: out, cols: maxCol + 1 }
  }, [days])

  if (!cells.length) {
    return <div className="hint">No recent days available.</div>
  }

  // Build a 7×cols grid (7 rows of days-of-week, variable columns of weeks).
  const grid: (Cell | null)[][] = Array.from({ length: 7 }, () => Array(cols).fill(null))
  for (const c of cells) grid[c.row][c.col] = c

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `20px repeat(${cols}, 1fr)`,
          gridTemplateRows: "repeat(7, 18px)",
          gap: 4,
        }}
      >
        {/* Row labels (Mon/Wed/Fri) */}
        {DOW.map((label, i) => (
          <div
            key={`lbl-${i}`}
            style={{
              gridColumn: 1,
              gridRow: i + 1,
              fontSize: 9.5,
              fontFamily: "var(--font-mono)",
              color: "var(--ink-4)",
              lineHeight: "18px",
              textAlign: "right",
              paddingRight: 4,
              visibility: i % 2 === 0 ? "visible" : "hidden",
            }}
          >
            {label}
          </div>
        ))}

        {grid.flatMap((row, r) =>
          row.map((cell, c) => {
            const key = `c-${r}-${c}`
            const col = c + 2 // +2: first col is labels (1), grid starts at 2
            if (!cell) {
              return (
                <div
                  key={key}
                  style={{
                    gridColumn: col,
                    gridRow: r + 1,
                    background: "var(--line-3)",
                    borderRadius: 3,
                    opacity: 0.55,
                  }}
                />
              )
            }
            const { fill, level } = colorForTIR(cell.tir)
            return (
              <button
                key={key}
                type="button"
                onClick={() => navigate(`/daily?date=${cell.date}`)}
                title={`${cell.date} (${cell.dow}) · TIR ${cell.tir.toFixed(1)}%`}
                className="day-cell"
                data-level={level}
                style={{
                  gridColumn: col,
                  gridRow: r + 1,
                  background: fill,
                  border: "1px solid color-mix(in oklch, black 6%, transparent)",
                  borderRadius: 3,
                  padding: 0,
                  cursor: "pointer",
                  transition: "transform 120ms ease, box-shadow 120ms ease",
                }}
                aria-label={`${cell.date} time-in-range ${cell.tir.toFixed(1)} percent`}
              />
            )
          }),
        )}
      </div>

      {showLegend ? (
        <div
          className="hint mono"
          style={{
            marginTop: 10,
            display: "flex",
            gap: 10,
            alignItems: "center",
            fontSize: 10.5,
          }}
        >
          <span>TIR</span>
          <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
            <LegendSwatch fill="var(--st-low)" /> &lt;&nbsp;50%
          </span>
          <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
            <LegendSwatch fill="var(--st-high)" /> 50-70%
          </span>
          <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
            <LegendSwatch fill="var(--st-in)" /> &ge;&nbsp;70%
          </span>
          <span style={{ marginLeft: "auto" }}>click a day to open it</span>
        </div>
      ) : null}
    </div>
  )
}

function LegendSwatch({ fill }: { fill: string }) {
  return (
    <span
      style={{
        width: 11,
        height: 11,
        borderRadius: 2,
        background: fill,
        display: "inline-block",
      }}
    />
  )
}

function colorForTIR(tir: number): { fill: string; level: 0 | 1 | 2 | 3 } {
  // Three-tier clinical scale plus a "very high" shade for ≥ 85% so 95% days
  // feel distinct from 72% days (mirrors GitHub's contribution intensity).
  if (tir < 50) return { fill: "var(--st-low)", level: 1 }
  if (tir < 70) return { fill: "var(--st-high)", level: 2 }
  if (tir < 85) return { fill: "var(--st-in)", level: 3 }
  return {
    fill: "color-mix(in oklch, var(--st-in) 100%, black 10%)",
    level: 3,
  }
}

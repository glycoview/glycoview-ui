import type { DailySummary } from "@/lib/design-data"

import { chartColors } from "./chart-colors"

export function DayStrip({ days }: { days: DailySummary[] }) {
  const c = chartColors()
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${days.length}, 1fr)`,
        gap: 2,
      }}
    >
      {days.map((d, i) => {
        const t = d.tir
        const fill = t >= 70 ? c.inR : t >= 50 ? c.high : c.vhigh
        return (
          <div key={i} style={{ display: "grid", gap: 3 }}>
            <div
              style={{
                height: 36,
                borderRadius: 4,
                background: fill,
                opacity: 0.25 + (t / 100) * 0.75,
              }}
            />
            <div
              className="mono"
              style={{ fontSize: 9.5, color: "var(--ink-4)", textAlign: "center" }}
            >
              {d.dow[0]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

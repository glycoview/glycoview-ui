import type { ReactNode } from "react"

type Props = {
  title: string
  value: string | number
  unit?: string
  sub?: string
  color?: string
  chart?: ReactNode
}

/**
 * Overview-style metric tile with a distinct per-tile chart rendered below
 * the headline number. Pass a different `chart` ReactNode to each tile — a
 * sparkline, bar chart, progress bar, etc.
 */
export function MetricTile({ title, value, unit, sub, color, chart }: Props) {
  return (
    <div className="panel">
      <div style={{ padding: 14 }}>
        <div className="kicker">{title}</div>
        <div className="row" style={{ alignItems: "baseline", gap: 6, marginTop: 6 }}>
          <div className="num-xl mono" style={{ fontSize: 26, color: color || "var(--ink)" }}>
            {value}
          </div>
          {unit ? <span className="mono hint">{unit}</span> : null}
        </div>
        {chart ? <div style={{ marginTop: 10 }}>{chart}</div> : null}
        {sub ? <div className="hint mt-8">{sub}</div> : null}
      </div>
    </div>
  )
}

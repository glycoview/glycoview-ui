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
 * Overview-style metric tile. The chart rows fills the bottom so multiple
 * tiles line up regardless of how long `sub` is.
 */
export function MetricTile({ title, value, unit, sub, color, chart }: Props) {
  return (
    <div className="metric-tile">
      <div className="kicker">{title}</div>
      <div className="metric-tile__value">
        <span className="mono" style={{ color: color || "var(--ink)" }}>
          {value}
        </span>
        {unit ? <span className="mono metric-tile__unit">{unit}</span> : null}
      </div>
      {chart ? <div className="metric-tile__chart">{chart}</div> : null}
      {sub ? <div className="metric-tile__sub">{sub}</div> : null}
    </div>
  )
}

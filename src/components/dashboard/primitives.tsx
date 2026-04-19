import type { ReactNode } from "react"

import { Sparkline } from "@/components/charts/sparkline"
import type { GluPoint } from "@/lib/design-data"
import { Icons } from "@/lib/design-icons"

export function PanelHead({
  title,
  sub,
  right,
}: {
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="panel__head">
      <div className="flex-1">
        <div className="gv-h3">{title}</div>
        {sub ? <div className="hint mt-4">{sub}</div> : null}
      </div>
      {right}
    </div>
  )
}

export function KPI({
  label,
  value,
  unit,
  sub,
  trend,
  good,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  trend?: string
  good?: boolean
}) {
  return (
    <div>
      <div className="kicker">{label}</div>
      <div className="row" style={{ alignItems: "baseline", gap: 6, marginTop: 6 }}>
        <div className="num-xl mono" style={{ fontSize: 30, letterSpacing: "-0.02em" }}>
          {value}
        </div>
        {unit ? <span className="mono hint">{unit}</span> : null}
      </div>
      {trend ? (
        <div className="hint mono mt-4" style={{ color: good ? "var(--st-in)" : "var(--ink-3)" }}>
          {trend}
        </div>
      ) : null}
      {sub && !trend ? <div className="hint mt-4">{sub}</div> : null}
    </div>
  )
}

export function Stat({
  label,
  value,
  foot,
  trend,
  mono,
}: {
  label: string
  value: string
  foot?: string
  trend?: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="kicker">{label}</div>
      <div className="row" style={{ alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <div className={"num-xl " + (mono ? "mono" : "")} style={{ fontSize: 20 }}>
          {value}
        </div>
        {trend ? (
          <span className="hint mono" style={{ color: "var(--st-in)" }}>
            {trend}
          </span>
        ) : null}
      </div>
      {foot ? <div className="hint">{foot}</div> : null}
    </div>
  )
}

export function MetricCard({
  title,
  value,
  unit,
  spark,
  color,
  foot,
}: {
  title: string
  value: string | number
  unit?: string
  spark?: GluPoint[]
  color?: string
  foot?: string
}) {
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
        {spark ? (
          <div style={{ marginTop: 8 }}>
            <Sparkline pts={spark} color={color} />
          </div>
        ) : null}
        {foot ? <div className="hint mt-8">{foot}</div> : null}
      </div>
    </div>
  )
}

export function AlertRow({
  kind,
  time,
  title,
  detail,
}: {
  kind: "low" | "high" | "info"
  time: string
  title: string
  detail: string
}) {
  const color = kind === "low" ? "var(--st-low)" : kind === "high" ? "var(--st-vhigh)" : "var(--ink-3)"
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr auto",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--line-2)",
      }}
    >
      <div className="mono hint" style={{ paddingTop: 3 }}>
        {time}
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 500, color }}>
          <span className="dot" style={{ background: color, boxShadow: "none" }} />
          {title}
        </div>
        <div className="hint mt-4">{detail}</div>
      </div>
      <button className="pill-btn" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}>
        Open
      </button>
    </div>
  )
}

export function DeviceRowItem({ d }: { d: import("@/lib/design-data").DeviceRow }) {
  const Icon =
    d.kind === "CGM" ? Icons.Drop : d.kind === "Pump" ? Icons.Bolt : d.kind === "Bridge" ? Icons.Pi : Icons.Device
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr auto",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--line-2)",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--line-3)",
          display: "grid",
          placeItems: "center",
          color: "var(--ink-3)",
        }}
      >
        <Icon size={15} />
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
          {d.name} <span className="hint mono">· {d.kind}</span>
        </div>
        <div className="hint">
          {d.status}
          {d.battery ? ` · battery ${d.battery}%` : ""}
          {d.reservoir ? ` · ${d.reservoir}` : ""}
          {d.badge ? ` · ${d.badge}` : ""}
        </div>
      </div>
      <span className="mono hint">{d.lastSeen === 0 ? "now" : `${Math.abs(d.lastSeen)}m`}</span>
    </div>
  )
}

export function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="kicker">{k}</div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 13, marginTop: 3, fontWeight: 500 }}>
        {v}
      </div>
    </div>
  )
}

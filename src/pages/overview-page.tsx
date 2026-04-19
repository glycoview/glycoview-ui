import { useMemo, useState } from "react"

import { DayStrip } from "@/components/charts/day-strip"
import { TIRStack } from "@/components/charts/tir-stack"
import {
  KPI,
  MetricCard,
  PanelHead,
} from "@/components/dashboard/primitives"
import { adaptDailySummaries, adaptPoints, adaptTIR } from "@/lib/backend-adapters"
import { useApiResource } from "@/lib/api"
import type { GluPoint } from "@/lib/design-data"
import { Icons } from "@/lib/design-icons"
import type { OverviewResponse, TrendsResponse } from "@/types"


export function OverviewPage({ token }: { token: string }) {
  const overview = useApiResource<OverviewResponse>("/app/api/overview", token)
  const trends = useApiResource<TrendsResponse>("/app/api/trends?days=14", token)
  const [range, setRange] = useState<"3h" | "6h" | "24h" | "7d">("24h")

  const breakdown = useMemo(
    () => (overview.data ? adaptTIR(overview.data.timeInRange, overview.data.narrowRange?.percent) : null),
    [overview.data],
  )
  const sparkline: GluPoint[] = useMemo(
    () => (overview.data ? adaptPoints(overview.data.sparkline) : []),
    [overview.data],
  )
  const summaries = useMemo(
    () => (trends.data ? adaptDailySummaries(trends.data.daysSummary) : []),
    [trends.data],
  )

  if (overview.error) {
    return <ErrorBanner message={overview.error.message} />
  }
  if (overview.loading || !overview.data || !breakdown) {
    return <LoadingBanner label="Loading overview…" />
  }

  const data = overview.data
  const current = data.current
  const currentValNum = parseFloat(numericPart(current.value))
  const currentClass = !currentValNum
    ? "in"
    : currentValNum < 70
      ? "low"
      : currentValNum > 180
        ? "high"
        : "in"

  const tir = data.timeInRange.find((b) => b.label === "Target")
  const tirDelta = data.narrowRange?.percent ?? 0

  return (
    <>
      <div className="gv-grid gv-grid-hero" style={{ marginBottom: 16 }}>
        <div className="panel" style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ padding: 20, flex: 1 }}>
            <div className="row between">
              <div className="kicker">{current.label}</div>
              <span className="badge">
                <span className="dot" />
                {current.detail ? "Streaming" : "Awaiting data"}
              </span>
            </div>
            <div
              className="num-xl mono mt-8"
              style={{
                fontSize: 78,
                lineHeight: 1,
                color: accentColor(current.accent) || `var(--st-${currentClass})`,
              }}
            >
              {current.value.replace(/\s*mg\/dL/i, "")}
            </div>
            <div className="row mt-8" style={{ gap: 10, alignItems: "baseline" }}>
              <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                mg/dL
              </span>
              {current.delta ? (
                <span className="badge" style={{ color: `var(--st-${currentClass})` }}>
                  {current.delta}
                </span>
              ) : null}
              {current.detail ? (
                <span className="hint mono" style={{ marginLeft: "auto" }}>
                  {current.detail}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="panel">
          <div
            style={{
              padding: 16,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
            }}
          >
            <KPI
              label="Time in range"
              value={tir ? Math.round(tir.percent).toString() : "–"}
              unit="%"
              sub={`70–180 mg/dL · tight ${Math.round(tirDelta)}%`}
              good
            />
            {data.metrics.slice(0, 2).map((m) => (
              <KPI
                key={m.id ?? m.label}
                label={m.label}
                value={numericPart(m.value) || m.value}
                unit={unitPart(m.value)}
                sub={m.detail}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <PanelHead
          title="Today · glucose trace"
          sub="Live glucose — carbs and boluses overlay when available"
          right={
            <div className="row" style={{ gap: 8 }}>
              <div className="tabs">
                {(["3h", "6h", "24h", "7d"] as const).map((t) => (
                  <button
                    key={t}
                    className={"tab" + (t === range ? " is-active" : "")}
                    onClick={() => setRange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="badge">
                <span className="dot" style={{ background: "var(--carbs)" }} />
                Carbs
              </span>
              <span className="badge">
                <span className="dot" style={{ background: "var(--bolus)" }} />
                Bolus
              </span>
            </div>
          }
        />
        <div style={{ padding: "6px 6px 16px" }}>
          {sparkline.length > 0 ? (
            <OverviewSparkTrace pts={sparkline} height={380} />
          ) : (
            <div
              style={{
                height: 380,
                display: "grid",
                placeItems: "center",
                color: "var(--ink-4)",
                fontSize: 12,
              }}
            >
              Waiting for glucose readings…
            </div>
          )}
        </div>
      </div>

      <div className="gv-grid gv-grid-2 mt-16">
        <div className="panel">
          <PanelHead title="Range distribution" sub="Rolling review window" />
          <div className="panel__body">
            <TIRStack showTight breakdown={breakdown} />
          </div>
        </div>
        <div className="panel">
          <PanelHead title="14-day pattern" sub="TIR heatmap" />
          <div className="panel__body">
            {summaries.length > 0 ? (
              <DayStrip days={summaries} />
            ) : (
              <div className="hint">No recent days available.</div>
            )}
            <div className="row between mt-16">
              {data.metrics.slice(0, 3).map((m) => (
                <span key={m.id ?? m.label} className="hint">
                  {m.label}{" "}
                  <b className="mono" style={{ color: "var(--ink)" }}>
                    {m.value}
                  </b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="gv-grid gv-grid-4 mt-16">
        {data.metrics.slice(0, 4).map((m) => (
          <MetricCard
            key={m.id ?? m.label}
            title={m.label}
            value={numericPart(m.value) || m.value}
            unit={unitPart(m.value)}
            color={severityColor(m.accent, m.warning)}
            spark={sparkline.length > 0 ? sparkline.slice(-96) : undefined}
            foot={m.detail}
          />
        ))}
      </div>

      <div className="gv-grid gv-grid-2 mt-16">
        <div className="panel">
          <PanelHead title="Recent activity" sub="Latest treatments and device updates" />
          <div className="panel__tight panel__body" style={{ padding: 0 }}>
            {data.activity.length === 0 ? (
              <div className="hint" style={{ padding: 16 }}>
                No recent activity.
              </div>
            ) : (
              data.activity.slice(0, 6).map((a, i) => (
                <ActivityRow
                  key={i}
                  at={a.at}
                  title={a.title}
                  detail={a.detail}
                  accent={a.accent}
                  kind={a.kind}
                />
              ))
            )}
          </div>
        </div>
        <div className="panel">
          <PanelHead title="Devices" right={<span className="hint mono">{data.devices.length}</span>} />
          <div style={{ padding: 0 }}>
            {data.devices.length === 0 ? (
              <div className="hint" style={{ padding: 16 }}>
                No device feeds yet.
              </div>
            ) : (
              data.devices.map((d) => (
                <div
                  key={d.name}
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
                    <DeviceIcon kind={d.kind} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {d.name}
                      <span className="hint mono"> · {d.kind}</span>
                    </div>
                    <div className="hint">
                      {[d.status, d.battery, d.reservoir, d.badge].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="mono hint">{formatRelative(d.lastSeen)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function OverviewSparkTrace({ pts, height }: { pts: GluPoint[]; height: number }) {
  // Simple trace plotted full-width using indices for x — good when we only have sparkline data
  const W = 1120
  const PAD = { l: 44, r: 20, t: 14, b: 26 }
  const inner = { top: PAD.t, bot: height - PAD.b }
  const xs = (i: number) => PAD.l + (i / Math.max(1, pts.length - 1)) * (W - PAD.l - PAD.r)
  const min = 40
  const max = 300
  const ys = (v: number) =>
    inner.bot - Math.max(0, Math.min(1, (v - min) / (max - min))) * (inner.bot - inner.top)

  const mgLabels = [54, 70, 140, 180, 250]

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(p.v)}`).join(" ")
  const area =
    path +
    ` L ${xs(pts.length - 1)} ${inner.bot} L ${xs(0)} ${inner.bot} Z`

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="ovGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--st-in)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--st-in)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[70, 180].map((m) => (
        <line
          key={m}
          x1={PAD.l}
          x2={W - PAD.r}
          y1={ys(m)}
          y2={ys(m)}
          stroke={m === 70 ? "var(--st-low)" : "var(--st-high)"}
          strokeDasharray="4 4"
          strokeWidth="1"
          opacity="0.55"
        />
      ))}
      {mgLabels.map((m) => (
        <g key={m}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={ys(m)}
            y2={ys(m)}
            stroke="var(--line-2)"
            strokeDasharray="2 4"
            opacity="0.9"
          />
          <text
            x={PAD.l - 6}
            y={ys(m) + 3}
            textAnchor="end"
            fontSize="10"
            fontFamily="Geist Mono"
            fill="var(--ink-4)"
          >
            {m}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#ovGrad)" />
      <path
        d={path}
        fill="none"
        stroke="var(--st-in)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ActivityRow({
  at,
  title,
  detail,
  accent,
  kind,
}: {
  at: number
  title: string
  detail: string
  accent?: string
  kind: string
}) {
  const lowish = kind === "low" || kind === "rose" || kind === "pink"
  const color = accentColor(accent) || (lowish ? "var(--st-low)" : "var(--ink-3)")
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
        {formatRelative(at)}
      </div>
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13.5,
            fontWeight: 500,
            color,
          }}
        >
          <span className="dot" style={{ background: color, boxShadow: "none" }} />
          {title}
        </div>
        <div className="hint mt-4">{detail}</div>
      </div>
      <span className="hint mono">{kind}</span>
    </div>
  )
}

function DeviceIcon({ kind }: { kind: string }) {
  const lower = kind.toLowerCase()
  if (lower.includes("cgm") || lower.includes("sensor")) return <Icons.Drop size={15} />
  if (lower.includes("pump")) return <Icons.Bolt size={15} />
  if (lower.includes("bridge") || lower.includes("pi")) return <Icons.Pi size={15} />
  return <Icons.Device size={15} />
}

function LoadingBanner({ label }: { label: string }) {
  return (
    <div
      className="panel"
      style={{ padding: 24, display: "flex", alignItems: "center", gap: 10 }}
    >
      <span className="dot" />
      <span className="hint">{label}</span>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="panel"
      style={{
        padding: 24,
        borderColor: "color-mix(in oklch, var(--st-low) 40%, var(--line))",
        color: "var(--st-low)",
      }}
    >
      {message}
    </div>
  )
}

function accentColor(accent?: string): string | null {
  if (!accent) return null
  switch (accent) {
    case "rose":
    case "pink":
      return "var(--st-low)"
    case "amber":
    case "orange":
      return "var(--st-vhigh)"
    case "cool":
    case "blue":
    case "violet":
    case "cyan":
      return "var(--ink)"
    case "green":
    case "emerald":
      return "var(--st-in)"
    default:
      return null
  }
}

function severityColor(accent?: string, warning?: boolean): string | undefined {
  if (warning) return "var(--st-low)"
  return accentColor(accent) ?? undefined
}

function numericPart(value: string): string {
  const match = value.match(/-?\d+(\.\d+)?/)
  return match ? match[0] : ""
}

function unitPart(value: string): string {
  const match = value.match(/-?\d+(\.\d+)?\s*(.*)/)
  return match ? match[2].trim() : ""
}

function formatRelative(ms: number): string {
  if (!ms) return "—"
  const diff = Date.now() - ms
  const mins = Math.max(0, Math.round(diff / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}


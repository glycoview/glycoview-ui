import { useMemo } from "react"

import { DailyTrace } from "@/components/charts/daily-trace"
import { DayStrip } from "@/components/charts/day-strip"
import { MiniDailyBars } from "@/components/charts/mini-daily-bars"
import { MiniDailyLine } from "@/components/charts/mini-daily-line"
import { TIRStack } from "@/components/charts/tir-stack"
import {
  KPI,
  PanelHead,
} from "@/components/dashboard/primitives"
import { MetricTile } from "@/components/dashboard/metric-tile"
import { adaptDailySummaries, adaptTIR } from "@/lib/backend-adapters"
import { useApiResource } from "@/lib/api"
import { Icons } from "@/lib/design-icons"
import type { DailyResponse, DailySummary, OverviewResponse, TrendsResponse } from "@/types"

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function OverviewPage({ token }: { token: string }) {
  const overview = useApiResource<OverviewResponse>("/app/api/overview", token)
  const trends = useApiResource<TrendsResponse>("/app/api/trends?days=14", token)
  const daily = useApiResource<DailyResponse>(`/app/api/daily?date=${todayIso()}`, token)

  const breakdown = useMemo(
    () => (overview.data ? adaptTIR(overview.data.timeInRange, overview.data.narrowRange?.percent) : null),
    [overview.data],
  )
  const summaries = useMemo(
    () => (trends.data ? adaptDailySummaries(trends.data.daysSummary) : []),
    [trends.data],
  )
  const backendDays: DailySummary[] = trends.data?.daysSummary ?? []

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
          sub="Carbs, boluses, SMBs and IOB overlayed on live glucose"
          right={
            <div className="row" style={{ gap: 8 }}>
              <span className="badge">
                <span className="dot" style={{ background: "var(--carbs)" }} />
                Carbs
              </span>
              <span className="badge">
                <span className="dot" style={{ background: "var(--bolus)" }} />
                Bolus
              </span>
              <span className="badge">
                <span className="dot" style={{ background: "var(--smb)" }} />
                SMB
              </span>
            </div>
          }
        />
        <div style={{ padding: "6px 6px 16px" }}>
          {daily.data && daily.data.glucose.length > 0 ? (
            <DailyTrace
              height={460}
              showBands
              defaultWindow="6h"
              rangeStart={daily.data.rangeStart}
              glucose={daily.data.glucose}
              carbs={daily.data.carbs}
              boluses={daily.data.boluses ?? daily.data.insulin}
              smbs={daily.data.smbs ?? []}
              tempBasals={daily.data.tempBasals ?? []}
              basalProfile={daily.data.basalProfile}
              smbgs={daily.data.smbgs ?? []}
            />
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
              {daily.loading ? "Loading today's trace…" : "No glucose readings for today yet."}
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
        <AvgGlucoseTile days={backendDays} />
        <TirDailyTile days={backendDays} />
        <DailyCarbsTile days={backendDays} />
        <DailyInsulinTile days={backendDays} />
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

/* ───── 4-tile metric strip ───── */

function avg(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function AvgGlucoseTile({ days }: { days: DailySummary[] }) {
  const value = avg(days.filter((d) => d.avgGlucose > 0).map((d) => d.avgGlucose))
  return (
    <MetricTile
      title="Avg glucose · 14d"
      value={value ? Math.round(value).toString() : "—"}
      unit="mg/dL"
      sub="daily averages over the last two weeks"
      chart={
        <MiniDailyLine
          days={days}
          accessor={(d) => d.avgGlucose}
          color="var(--ink)"
          guides={[154]}
          domain={[60, 260]}
        />
      }
    />
  )
}

function TirDailyTile({ days }: { days: DailySummary[] }) {
  const value = avg(days.map((d) => d.tir))
  return (
    <MetricTile
      title="Time in range · 14d"
      value={value ? Math.round(value).toString() : "—"}
      unit="%"
      sub="per-day · green ≥ 70% · target"
      color="var(--st-in)"
      chart={
        <MiniDailyBars
          days={days}
          accessor={(d) => d.tir}
          guide={70}
          colorFor={(v) => (v >= 70 ? "var(--st-in)" : v >= 50 ? "var(--st-high)" : "var(--st-vhigh)")}
        />
      }
    />
  )
}

function DailyCarbsTile({ days }: { days: DailySummary[] }) {
  const vals = days.filter((d) => d.carbs > 0).map((d) => d.carbs)
  const value = avg(vals)
  return (
    <MetricTile
      title="Carbs · avg daily"
      value={value ? Math.round(value).toString() : "—"}
      unit="g/day"
      sub={`${vals.length}/${days.length} days with logged carbs`}
      color="var(--carbs)"
      chart={
        <MiniDailyBars
          days={days}
          accessor={(d) => d.carbs}
          colorFor={() => "var(--carbs)"}
        />
      }
    />
  )
}

function DailyInsulinTile({ days }: { days: DailySummary[] }) {
  const vals = days.filter((d) => d.insulin > 0).map((d) => d.insulin)
  const value = avg(vals)
  return (
    <MetricTile
      title="Insulin · avg daily TDD"
      value={value ? value.toFixed(1) : "—"}
      unit="U/day"
      sub="bars show daily total dose"
      color="var(--bolus)"
      chart={
        <MiniDailyBars
          days={days}
          accessor={(d) => d.insulin}
          colorFor={() => "var(--bolus)"}
        />
      }
    />
  )
}

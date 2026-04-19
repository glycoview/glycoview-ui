import { useMemo, useState } from "react"

import { DailyTrace } from "@/components/charts/daily-trace"
import { TIRStack } from "@/components/charts/tir-stack"
import { KPI, PanelHead, Stat } from "@/components/dashboard/primitives"
import { adaptTIR, eventLabel } from "@/lib/backend-adapters"
import { useApiResource } from "@/lib/api"
import { Icons } from "@/lib/design-icons"
import type { DailyResponse } from "@/types"

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function DailyPage({ token }: { token: string }) {
  const [date, setDate] = useState(() => todayIso())
  const { data, loading, error } = useApiResource<DailyResponse>(
    `/app/api/daily?date=${date}`,
    token,
  )

  const breakdown = useMemo(() => (data ? adaptTIR(data.timeInRange) : null), [data])

  if (error) {
    return <ErrorBanner message={error.message} />
  }
  if (loading || !data || !breakdown) {
    return <LoadingBanner label="Loading day…" />
  }

  const tir = data.timeInRange.find((b) => b.label === "Target")
  const avgMetric = data.metrics.find((m) => m.id === "avg")?.value ?? "—"
  const carbsMetric = data.metrics.find((m) => m.id === "carbs")?.value ?? "—"
  const insulinMetric = data.metrics.find((m) => m.id === "insulin")?.value ?? "—"

  return (
    <>
      <div className="gv-grid gv-grid-hero" style={{ marginBottom: 16 }}>
        <div className="panel" style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ padding: 20, flex: 1 }}>
            <div className="row between">
              <div className="kicker">{data.dateLabel || date}</div>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="pill-btn"
                  style={{ height: 26, padding: "0 8px" }}
                  onClick={() => setDate(addDays(date, -1))}
                  title="Previous day"
                >
                  <Icons.ChevronL size={12} />
                </button>
                <button
                  className="pill-btn"
                  style={{ height: 26, padding: "0 8px" }}
                  onClick={() => setDate(addDays(date, 1))}
                  disabled={date >= todayIso()}
                  title="Next day"
                >
                  <Icons.ChevronR size={12} />
                </button>
              </div>
            </div>
            <div
              className="num-xl mono mt-8"
              style={{ fontSize: 54, lineHeight: 1, letterSpacing: "-0.03em" }}
            >
              {tir ? tir.percent.toFixed(1) : "—"}
              <span style={{ color: "var(--ink-4)", fontSize: 22, marginLeft: 4 }}>%</span>
            </div>
            <div className="row mt-8" style={{ gap: 10, alignItems: "baseline" }}>
              <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                in range · 70–180
              </span>
            </div>
            <div className="row mt-16" style={{ gap: 18 }}>
              <Stat label="Avg" value={avgMetric} foot="glucose" mono />
              <Stat label="Readings" value={data.glucose.length.toString()} foot="5-min buckets" mono />
              <Stat label="Insulin" value={insulinMetric} mono />
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
            <KPI label="Carbs" value={numericPart(carbsMetric)} unit={unitPart(carbsMetric)} />
            <KPI
              label="Insulin"
              value={numericPart(insulinMetric)}
              unit={unitPart(insulinMetric)}
            />
            <KPI
              label="Events"
              value={data.metrics.find((m) => m.id === "events")?.value ?? "0"}
              sub={`${data.carbs.length + (data.boluses?.length ?? data.insulin.length)} logged`}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <PanelHead
          title="Trace · 00:00–24:00"
          sub="Glucose with carb entries, boluses, and basal profile overlay"
          right={
            <div className="row" style={{ gap: 8 }}>
              <div className="tabs">
                {["Day", "Week", "Month"].map((t, i) => (
                  <button key={t} className={"tab" + (i === 0 ? " is-active" : "")}>
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
              <span className="badge">
                <span className="dot" style={{ background: "var(--smb)" }} />
                SMB
              </span>
              <span className="badge">
                <span className="dot" style={{ background: "var(--basal)" }} />
                Basal
              </span>
            </div>
          }
        />
        <div style={{ padding: "6px 6px 16px" }}>
          <DailyTrace
            height={520}
            showBands
            rangeStart={data.rangeStart}
            glucose={data.glucose}
            carbs={data.carbs}
            boluses={data.boluses ?? data.insulin}
            smbs={data.smbs ?? []}
            tempBasals={data.tempBasals ?? []}
            basalProfile={data.basalProfile}
            smbgs={data.smbgs ?? []}
          />
        </div>
      </div>

      <div className="gv-grid gv-grid-3 mt-16">
        <div className="panel">
          <PanelHead title="Time in range" />
          <div className="panel__body">
            <TIRStack showTight={false} breakdown={breakdown} />
          </div>
        </div>

        <div className="panel">
          <PanelHead
            title="Meals and carbs"
            right={<span className="hint mono">{data.carbs.length} entries</span>}
          />
          <div style={{ padding: 0, maxHeight: 360, overflow: "auto" }}>
            {data.carbs.length === 0 ? (
              <div className="hint" style={{ padding: 16 }}>
                No carb entries for this day.
              </div>
            ) : (
              data.carbs.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto",
                    gap: 12,
                    padding: "11px 16px",
                    borderBottom: "1px solid var(--line-2)",
                    alignItems: "center",
                  }}
                >
                  <div className="mono hint">{hhmmLocal(m.at, data.rangeStart)}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{eventLabel(m)}</div>
                    <div className="hint">{m.kind}</div>
                  </div>
                  <span className="mono">
                    {m.value}
                    <span style={{ color: "var(--ink-4)" }}>g</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <PanelHead
            title="Insulin events"
            right={<span className="hint mono">{data.insulin.length} entries</span>}
          />
          <div style={{ padding: 0, maxHeight: 360, overflow: "auto" }}>
            {data.insulin.length === 0 ? (
              <div className="hint" style={{ padding: 16 }}>
                No insulin entries for this day.
              </div>
            ) : (
              data.insulin.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr auto",
                    gap: 12,
                    padding: "9px 16px",
                    borderBottom: "1px solid var(--line-2)",
                    alignItems: "center",
                  }}
                >
                  <div className="mono hint">{hhmmLocal(e.at, data.rangeStart)}</div>
                  <div>
                    <div style={{ fontSize: 13 }}>{eventLabel(e)}</div>
                    <div className="hint">{e.kind}</div>
                  </div>
                  <span className="mono" style={{ color: "var(--bolus)" }}>
                    {e.value}
                    <span style={{ color: "var(--ink-4)" }}>U</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function numericPart(value: string): string {
  const match = value.match(/-?\d+(\.\d+)?/)
  return match ? match[0] : value
}

function unitPart(value: string): string {
  const match = value.match(/-?\d+(\.\d+)?\s*(.*)/)
  return match ? match[2].trim() : ""
}

function hhmmLocal(at: number, dayStart: number): string {
  if (!at) return "--:--"
  const ms = at - dayStart
  const totalMin = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
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

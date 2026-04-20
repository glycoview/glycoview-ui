import { useMemo, useState } from "react"

import { AGPChart } from "@/components/charts/agp-chart"
import { TIRBar } from "@/components/charts/tir-bar"
import { TIRStack } from "@/components/charts/tir-stack"
import { PanelHead, Stat } from "@/components/dashboard/primitives"
import { adaptTIR } from "@/lib/backend-adapters"
import { useApiResource } from "@/lib/api"
import { ea1cFromMgDl, gmiFromMgDl } from "@/lib/gmi"
import { formatDateISO, userTimeZone } from "@/lib/time"
import type { TrendsResponse } from "@/types"

export function TrendsPage({ token }: { token: string }) {
  const [days, setDays] = useState<number>(14)
  const [pct, setPct] = useState({ outer: true, inner: true, median: true })
  const toggle = (k: keyof typeof pct) => setPct((p) => ({ ...p, [k]: !p[k] }))

  const { data, loading, error } = useApiResource<TrendsResponse>(
    `/app/api/trends?days=${days}`,
    token,
  )

  const agp = useMemo(() => (data ? data.agp : []), [data])
  const breakdown = useMemo(() => (data ? adaptTIR(data.timeInRange) : null), [data])
  const nonEmptyBuckets = useMemo(
    () => (data ? data.agp.filter((b) => (b.points ?? 0) > 0).length : 0),
    [data],
  )

  if (error) return <ErrorBanner message={error.message} />
  if (loading || !data || !breakdown) return <LoadingBanner label="Loading trends…" />

  const avg = data.metrics.find((m) => m.id === "avg")?.value ?? "—"
  const cv = data.metrics.find((m) => m.id === "cv")?.value ?? "—"
  const sensor = data.metrics.find((m) => m.id === "sensor")?.value ?? "—"
  const tir = data.timeInRange.find((b) => b.label === "Target")
  const readings = data.agp.reduce((sum, b) => sum + (b.points ?? 0), 0)
  const avgGlucoseNum = parseFloat(numericPart(avg))
  const gmi = gmiFromMgDl(avgGlucoseNum)
  const ea1c = ea1cFromMgDl(avgGlucoseNum)

  return (
    <>
      <div className="gv-grid gv-grid-hero" style={{ marginBottom: 16 }}>
        <div className="panel" style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ padding: 20, flex: 1 }}>
            <div className="row between">
              <div className="kicker">Ambulatory glucose profile</div>
              <div className="tabs">
                {[7, 14, 30, 90].map((d) => (
                  <button
                    key={d}
                    className={"tab" + (d === days ? " is-active" : "")}
                    onClick={() => setDays(d)}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div
              className="num-xl mono mt-8"
              style={{ fontSize: "clamp(40px, 8vw, 54px)", lineHeight: 1, letterSpacing: "-0.03em" }}
            >
              {numericPart(avg) || "—"}
              <span style={{ color: "var(--ink-4)", fontSize: 22, marginLeft: 4 }}>
                {unitPart(avg)}
              </span>
            </div>
            <div className="row mt-8" style={{ gap: 10, alignItems: "baseline" }}>
              <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                {data.rangeLabel}
              </span>
              <span className="badge">
                <span className="dot" />
                {days}d window
              </span>
            </div>
            <div className="row mt-16" style={{ gap: 18 }}>
              <Stat label="Readings" value={readings.toLocaleString()} foot={`${days}d coverage`} mono />
              <Stat label="Sensor wear" value={sensor} foot="target ≥ 80" mono />
              <Stat label="Glucose var." value={cv} foot="CV target ≤ 36" mono />
            </div>
          </div>
        </div>

        <div className="panel">
          <div style={{ padding: 18, display: "grid", gap: 16 }}>
            <div>
              <div className="row between" style={{ alignItems: "baseline" }}>
                <div className="kicker">Time in range · {days}d</div>
                <div className="mono num-xl" style={{ fontSize: 22, color: "var(--st-in)" }}>
                  {tir ? Math.round(tir.percent).toString() : "—"}
                  <span style={{ fontSize: 12, color: "var(--ink-4)" }}>%</span>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <TIRBar bands={data.timeInRange} compact />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                paddingTop: 14,
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <KpiCell
                label={`GMI · ${days}d`}
                value={gmi ? gmi.toFixed(1) : "—"}
                unit="%"
              />
              <KpiCell
                label="eA1C · ADAG"
                value={ea1c ? ea1c.toFixed(1) : "—"}
                unit="%"
              />
              <KpiCell label="Avg glucose" value={numericPart(avg) || avg} unit={unitPart(avg)} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                paddingTop: 14,
                borderTop: "1px solid var(--line-2)",
              }}
            >
              <KpiCell label="Variability" value={numericPart(cv) || cv} unit={unitPart(cv)} />
              <KpiCell
                label="Sensor wear"
                value={numericPart(sensor) || sensor}
                unit={unitPart(sensor)}
              />
              <KpiCell
                label="Best day"
                value={
                  data.daysSummary.length > 0
                    ? Math.round(Math.max(...data.daysSummary.map((d) => d.tir))).toString()
                    : "—"
                }
                unit="% TIR"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <PanelHead
          title="Glucose percentiles"
          sub="Hover for per-bin readout · click-drag to select a time window"
          right={
            <div className="row" style={{ gap: 6 }}>
              <button
                className={"chip" + (pct.outer ? " is-on" : "")}
                onClick={() => toggle("outer")}
              >
                <span className="chip__sw" style={{ background: "var(--ink)", opacity: 0.22 }} />
                10–90
              </button>
              <button
                className={"chip" + (pct.inner ? " is-on" : "")}
                onClick={() => toggle("inner")}
              >
                <span className="chip__sw" style={{ background: "var(--ink)", opacity: 0.42 }} />
                25–75
              </button>
              <button
                className={"chip" + (pct.median ? " is-on" : "")}
                onClick={() => toggle("median")}
              >
                <span className="chip__sw" style={{ background: "var(--ink)" }} />
                median
              </button>
            </div>
          }
        />
        <div style={{ padding: "6px 6px 16px" }}>
          {nonEmptyBuckets >= 6 ? (
            <AGPChart
              height={460}
              showBands
              showOuter={pct.outer}
              showInner={pct.inner}
              showMedian={pct.median}
              buckets={agp}
            />
          ) : (
            <div
              style={{
                height: 460,
                display: "grid",
                placeItems: "center",
                color: "var(--ink-4)",
                fontSize: 12,
              }}
            >
              Not enough readings yet to draw percentiles ({nonEmptyBuckets}/24 hours covered).
            </div>
          )}
        </div>
      </div>

      <div className="gv-grid gv-grid-3 mt-16">
        <div className="panel">
          <PanelHead title="Range distribution" sub={`${days}d aggregate`} />
          <div className="panel__body">
            <TIRStack showTight={false} breakdown={breakdown} />
          </div>
        </div>

        <div className="panel" style={{ gridColumn: "span 2" }}>
          <PanelHead
            title="Daily summary"
            right={<span className="hint mono">{data.daysSummary.length} days</span>}
          />
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            {data.daysSummary.length === 0 ? (
              <div className="hint" style={{ padding: 16 }}>
                No daily summaries available.
              </div>
            ) : (
              <div className="table-scroll">
              <table className="tbl" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Avg</th>
                    <th>GMI</th>
                    <th>eA1C</th>
                    <th>TIR</th>
                    <th>Carbs</th>
                    <th>Insulin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daysSummary
                    .slice()
                    .reverse()
                    .map((d) => {
                      const dayGmi = gmiFromMgDl(d.avgGlucose)
                      const dayEa1c = ea1cFromMgDl(d.avgGlucose)
                      return (
                      <tr key={d.date} className="clickable">
                        <td>
                          <div className="mono">
                            {formatDateISO(d.date, userTimeZone())}
                          </div>
                          <div className="hint">{d.day}</div>
                        </td>
                        <td className="mono">{Math.round(d.avgGlucose)}</td>
                        <td
                          className="mono"
                          style={{
                            color:
                              !dayGmi
                                ? undefined
                                : dayGmi <= 7
                                  ? "var(--st-in)"
                                  : dayGmi <= 8
                                    ? "var(--st-high)"
                                    : "var(--st-vhigh)",
                          }}
                        >
                          {dayGmi ? dayGmi.toFixed(1) + "%" : "—"}
                        </td>
                        <td className="mono hint">{dayEa1c ? dayEa1c.toFixed(1) + "%" : "—"}</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <span className="mono" style={{ minWidth: 38 }}>
                              {Math.round(d.tir)}%
                            </span>
                            <div className="meter" style={{ flex: 1, minWidth: 60 }}>
                              <span
                                style={{
                                  width: `${Math.min(100, d.tir)}%`,
                                  background:
                                    d.tir >= 70
                                      ? "var(--st-in)"
                                      : d.tir >= 50
                                        ? "var(--st-high)"
                                        : "var(--st-vhigh)",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="mono">{Math.round(d.carbs)}g</td>
                        <td className="mono">{d.insulin.toFixed(1)}U</td>
                      </tr>
                    )
                    })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function numericPart(value: string): string {
  const match = value.match(/-?\d+(\.\d+)?/)
  return match ? match[0] : ""
}

function unitPart(value: string): string {
  const match = value.match(/-?\d+(\.\d+)?\s*(.*)/)
  return match ? match[2].trim() : ""
}

function KpiCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="kicker" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 4, marginTop: 4 }}>
        <div className="mono num-xl" style={{ fontSize: 18 }}>
          {value}
        </div>
        {unit ? (
          <span className="mono hint" style={{ fontSize: 10 }}>
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  )
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

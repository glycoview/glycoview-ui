import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { MetricCard, PanelHead } from "@/components/dashboard/primitives"
import { useApiResource } from "@/lib/api"
import { Icons } from "@/lib/design-icons"
import type { ProfileResponse, SchedulePoint } from "@/types"

export function ProfilePage({ token }: { token: string }) {
  const { data, loading, error } = useApiResource<ProfileResponse>("/app/api/profile", token)

  if (error) return <ErrorBanner message={error.message} />
  if (loading || !data) return <LoadingBanner label="Loading profile…" />

  const basal = data.basalSchedule
  const ic = data.carbRatios
  const isf = data.sensitivity
  const targets = data.targets

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div
          style={{
            padding: 20,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 20,
            alignItems: "center",
          }}
        >
          <div
            className="av"
            style={{
              width: 56,
              height: 56,
              fontSize: 14,
              borderRadius: 14,
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            ME
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.015em" }}>
              My profile
            </div>
            <div className="hint mt-4">{data.headline || "Therapy profile"}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="pill-btn">
              <Icons.Compass size={13} />
              Export profile
            </button>
            <button className="pill-btn is-primary">
              <Icons.Plus size={13} />
              New note
            </button>
          </div>
        </div>
      </div>

      <div className="gv-grid gv-grid-4" style={{ marginBottom: 16 }}>
        {data.metrics.slice(0, 4).map((m) => (
          <MetricCard
            key={m.id ?? m.label}
            title={m.label}
            value={numericPart(m.value) || m.value}
            unit={unitPart(m.value)}
            foot={m.detail}
          />
        ))}
        {data.metrics.length === 0 ? (
          <>
            <MetricCard title="Profile" value="—" foot="No therapy metrics" />
            <MetricCard title="Basal share" value="—" />
            <MetricCard title="Carb ratio" value="—" />
            <MetricCard title="Sensitivity" value="—" />
          </>
        ) : null}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <PanelHead
          title="Basal profile"
          sub="24-hour rate schedule · U/h"
          right={
            <div className="row" style={{ gap: 6 }}>
              <button className="pill-btn" style={{ height: 26, fontSize: 11.5 }}>
                <Icons.Compass size={12} />
                Duplicate
              </button>
              <button className="pill-btn" style={{ height: 26, fontSize: 11.5 }}>
                <Icons.Plus size={12} />
                Segment
              </button>
            </div>
          }
        />
        {basal.length === 0 ? (
          <div className="hint" style={{ padding: 16 }}>
            No basal schedule configured.
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 16px 0" }}>
              <BasalCurve rows={basal} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${basal.length}, 1fr)`,
                borderTop: "1px solid var(--line)",
                marginTop: 8,
              }}
            >
              {basal.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    borderRight: i < basal.length - 1 ? "1px solid var(--line-2)" : "none",
                  }}
                >
                  <div className="mono hint" style={{ fontSize: 10.5 }}>
                    {r.time}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}
                  >
                    {r.value}
                  </div>
                  {r.label ? (
                    <div className="hint" style={{ fontSize: 10.5, marginTop: 2 }}>
                      {r.label}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="gv-grid gv-grid-3">
        <ScheduleCard title="Carb ratios" subtitle="grams of carb per 1 U" rows={ic} />
        <ScheduleCard title="Insulin sensitivity" subtitle="drop in mg/dL per 1 U" rows={isf} />
        <ScheduleCard title="Glucose targets" subtitle="target setpoint" rows={targets} />
      </div>

      {data.notes.length > 0 ? (
        <div className="panel mt-16">
          <PanelHead
            title="Notes"
            right={
              <button className="pill-btn" style={{ height: 26, fontSize: 11.5 }}>
                <Icons.Plus size={12} />
                Add note
              </button>
            }
          />
          <div style={{ padding: 0 }}>
            {data.notes.map((n, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--line-2)",
                  alignItems: "start",
                }}
              >
                <div className="mono hint" style={{ paddingTop: 2 }}>
                  {n.kind || "note"}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{n.title}</div>
                  <div className="hint mt-4">{n.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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

function BasalCurve({ rows }: { rows: SchedulePoint[] }) {
  const segs = rows.map((r, i) => {
    const startMin = parseTimeToMinutes(r.time)
    const endMin = i < rows.length - 1 ? parseTimeToMinutes(rows[i + 1].time) : 24 * 60
    return { start: startMin / 60, end: endMin / 60, rate: parseFloat(r.value) || 0 }
  })
  // Build per-hour data so Recharts renders a step profile smoothly.
  const data: { hour: number; rate: number }[] = []
  for (let h = 0; h <= 24; h += 0.25) {
    const seg = segs.find((s) => h >= s.start && h < s.end) ?? segs[segs.length - 1]
    data.push({ hour: h, rate: seg?.rate ?? 0 })
  }
  const maxRate = Math.max(1.2, ...segs.map((s) => s.rate * 1.25))

  return (
    <div style={{ width: "100%", height: 130 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, left: -14, bottom: 4 }}>
          <defs>
            <linearGradient id="basalFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--basal)" stopOpacity={0.35} />
              <stop offset="1" stopColor="var(--basal)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line-2)" strokeDasharray="2 4" />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[0, 24]}
            ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
            tickFormatter={(h: number) => `${String(Math.floor(h)).padStart(2, "0")}:00`}
            stroke="var(--line)"
            tickLine={false}
            tick={{ fontSize: 10.5, fontFamily: "var(--font-mono)", fill: "var(--ink-4)" }}
            axisLine={{ stroke: "var(--line)" }}
          />
          <YAxis
            domain={[0, maxRate]}
            tickFormatter={(v: number) => v.toFixed(1)}
            stroke="var(--ink-4)"
            axisLine={false}
            tickLine={false}
            width={36}
            tick={{ fontSize: 10.5, fontFamily: "var(--font-mono)", fill: "var(--ink-4)" }}
          />
          {[0.4, 0.8, 1.2].map((r) => (
            <ReferenceLine
              key={r}
              y={r}
              stroke="var(--line-2)"
              strokeDasharray="2 4"
              ifOverflow="hidden"
            />
          ))}
          <Tooltip
            cursor={{ stroke: "var(--line)", strokeWidth: 1 }}
            formatter={(v) => [`${Number(v).toFixed(2)} U/h`, "basal"]}
            labelFormatter={(h) => {
              const n = Number(h)
              const hh = Math.floor(n)
              const mm = Math.round((n % 1) * 60)
              return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
            }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
              padding: "6px 9px",
            }}
          />
          <Area
            type="stepAfter"
            dataKey="rate"
            stroke="var(--basal)"
            strokeWidth={1.8}
            fill="url(#basalFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((p) => parseInt(p) || 0)
  return (h || 0) * 60 + (m || 0)
}

function ScheduleCard({
  title,
  subtitle,
  rows,
}: {
  title: string
  subtitle: string
  rows: SchedulePoint[]
}) {
  return (
    <div className="panel">
      <PanelHead
        title={title}
        sub={subtitle}
        right={
          <button className="pill-btn" style={{ height: 26, fontSize: 11.5 }}>
            <Icons.Plus size={12} />
            Segment
          </button>
        }
      />
      <div style={{ padding: 0 }}>
        {rows.length === 0 ? (
          <div className="hint" style={{ padding: 16 }}>
            No schedule entries.
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "64px 1fr",
                gap: 10,
                padding: "10px 16px",
                borderBottom: i < rows.length - 1 ? "1px solid var(--line-2)" : "none",
                alignItems: "center",
              }}
            >
              <div className="mono hint">{r.time}</div>
              <div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
                  {r.value}
                </div>
                {r.label ? (
                  <div className="hint" style={{ fontSize: 10.5 }}>
                    {r.label}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
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

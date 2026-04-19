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
  const W = 1100
  const H = 110
  const PAD = { l: 8, r: 8, t: 10, b: 8 }
  const BMAX = Math.max(
    1.6,
    ...rows.map((r) => parseFloat(r.value) || 0).map((v) => v * 1.2),
  )
  const x = (h: number) => PAD.l + (h / 24) * (W - PAD.l - PAD.r)
  const y = (r: number) => PAD.t + (1 - r / BMAX) * (H - PAD.t - PAD.b)
  const base = H - PAD.b

  const segs = rows.map((r, i) => {
    const startMin = parseTimeToMinutes(r.time)
    const endMin =
      i < rows.length - 1 ? parseTimeToMinutes(rows[i + 1].time) : 24 * 60
    return {
      start: startMin / 60,
      end: endMin / 60,
      rate: parseFloat(r.value) || 0,
    }
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      {[0.4, 0.8, 1.2].map((r) => (
        <line
          key={r}
          x1={PAD.l}
          x2={W - PAD.r}
          y1={y(r)}
          y2={y(r)}
          stroke="var(--line-2)"
          strokeDasharray="2 4"
        />
      ))}
      {[0, 6, 12, 18, 24].map((h) => (
        <line
          key={h}
          x1={x(h)}
          x2={x(h)}
          y1={PAD.t}
          y2={base}
          stroke="var(--line-2)"
          strokeDasharray="2 6"
          opacity="0.6"
        />
      ))}
      {segs.map((s, i) => (
        <rect
          key={i}
          x={x(s.start)}
          y={y(s.rate)}
          width={x(s.end) - x(s.start)}
          height={base - y(s.rate)}
          fill="var(--basal)"
          opacity="0.28"
        />
      ))}
      {segs.map((s, i) => (
        <line
          key={i}
          x1={x(s.start)}
          x2={x(s.end)}
          y1={y(s.rate)}
          y2={y(s.rate)}
          stroke="var(--basal)"
          strokeWidth="1.8"
        />
      ))}
      {segs.slice(1).map((s, i) => (
        <line
          key={i}
          x1={x(s.start)}
          x2={x(s.start)}
          y1={y(segs[i].rate)}
          y2={y(s.rate)}
          stroke="var(--basal)"
          strokeWidth="1.2"
          opacity="0.6"
        />
      ))}
      {segs.map((s, i) => (
        <text
          key={i}
          x={(x(s.start) + x(s.end)) / 2}
          y={y(s.rate) - 4}
          textAnchor="middle"
          fontSize="10"
          fontFamily="Geist Mono"
          fill="var(--ink-3)"
        >
          {s.rate.toFixed(2)}
        </text>
      ))}
    </svg>
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

import { MetricCard, PanelHead } from "@/components/dashboard/primitives"
import { useApiResource } from "@/lib/api"
import { Icons } from "@/lib/design-icons"
import type { DevicesResponse } from "@/types"

export function DevicesPage({ token }: { token: string }) {
  const { data, loading, error } = useApiResource<DevicesResponse>("/app/api/devices", token)

  if (error) return <ErrorBanner message={error.message} />
  if (loading || !data) return <LoadingBanner label="Loading devices…" />

  return (
    <>
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
            <MetricCard title="Feeds" value={data.cards.length.toString()} />
            <MetricCard title="Active" value="—" />
            <MetricCard title="Alerts" value="—" />
            <MetricCard title="Version" value="—" />
          </>
        ) : null}
      </div>

      <div className="panel">
        <PanelHead
          title="Connected devices"
          sub={data.headline}
          right={
            <button className="pill-btn">
              <Icons.Plus size={13} />
              Pair new
            </button>
          }
        />
        {data.cards.length === 0 ? (
          <div className="hint" style={{ padding: 16 }}>
            No device feeds reported yet.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Device</th>
                <th>Status</th>
                <th>Battery</th>
                <th>Reservoir</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.cards.map((d) => (
                <tr key={d.name} className="clickable">
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: "var(--line-3)",
                          display: "grid",
                          placeItems: "center",
                          color: "var(--ink-3)",
                        }}
                      >
                        <DeviceIcon kind={d.kind} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
                        <div className="hint mono">{d.kind}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge--in">
                      <span className="dot" />
                      {d.status}
                    </span>
                  </td>
                  <td className="mono">{d.battery || "—"}</td>
                  <td className="mono">{d.reservoir || "—"}</td>
                  <td>
                    <span className="mono hint">{formatRelative(d.lastSeen)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.activity.length > 0 ? (
        <div className="panel mt-16">
          <PanelHead title="Integration activity" />
          <div style={{ padding: 0 }}>
            {data.activity.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr auto",
                  gap: 10,
                  padding: "11px 16px",
                  borderBottom: "1px solid var(--line-2)",
                }}
              >
                <div className="mono hint">{formatRelative(a.at)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.title}</div>
                  <div className="hint">{a.detail}</div>
                </div>
                <span className="mono hint">{a.kind}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function DeviceIcon({ kind }: { kind: string }) {
  const lower = kind.toLowerCase()
  if (lower.includes("cgm") || lower.includes("sensor")) return <Icons.Drop size={13} />
  if (lower.includes("pump")) return <Icons.Bolt size={13} />
  if (lower.includes("bridge") || lower.includes("pi")) return <Icons.Pi size={13} />
  return <Icons.Device size={13} />
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
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
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

import { TIR as MOCK_TIR, type TIRBreakdown } from "@/lib/design-data"

import { chartColors } from "./chart-colors"

type TIRStackProps = {
  showTight?: boolean
  compact?: boolean
  breakdown?: TIRBreakdown
}

export function TIRStack({ showTight = true, compact = false, breakdown }: TIRStackProps) {
  const c = chartColors()
  const t = breakdown ?? MOCK_TIR
  const bands = [
    { key: "vhigh", label: "Very High", range: ">250", pct: t.vhigh, color: c.vhigh },
    { key: "high", label: "High", range: "181–250", pct: t.high - t.vhigh, color: c.high },
    { key: "in", label: "In range", range: "70–180", pct: t.inWide - t.low, color: c.inR },
    { key: "low", label: "Low", range: "54–69", pct: t.low - t.vlow, color: c.low },
    { key: "vlow", label: "Very Low", range: "<54", pct: t.vlow, color: c.vlow },
  ].map((b) => ({ ...b, pct: Math.max(0, b.pct) }))

  const total = bands.reduce((a, b) => a + b.pct, 0) || 1

  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 14, alignItems: "stretch" }}>
      <div
        style={{
          width: 44,
          height: compact ? 160 : 200,
          display: "flex",
          flexDirection: "column",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--line)",
        }}
      >
        {bands.map((b) => (
          <div
            key={b.key}
            style={{
              background: b.color,
              height: `${(b.pct / total) * 100}%`,
              opacity: b.key === "in" ? 0.9 : 0.85,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bands.map((b) => (
          <div
            key={b.key}
            style={{
              display: "grid",
              gridTemplateColumns: "10px 1fr auto",
              gap: 10,
              alignItems: "center",
              padding: "4px 0",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: b.color,
                opacity: 0.95,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: "-0.01em" }}>{b.label}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
                {b.range} mg/dL
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono num-xl" style={{ fontSize: 15 }}>
                {b.pct.toFixed(1)}
                <span style={{ color: "var(--ink-4)", fontSize: 10 }}>%</span>
              </div>
            </div>
          </div>
        ))}
        {showTight && (
          <div
            style={{
              marginTop: 6,
              paddingTop: 8,
              borderTop: "1px dashed var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              Tight target <span className="mono" style={{ color: "var(--ink-4)" }}>70–140</span>
            </div>
            <div className="mono num-xl" style={{ fontSize: 15 }}>
              {t.inTight.toFixed(1)}
              <span style={{ color: "var(--ink-4)", fontSize: 10 }}>%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

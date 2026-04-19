import type { AGPBucket, BasalProfileStep, Bolus, Carb, DailySummary, DayData, GluPoint, SMB, SMBG, TempBasal, TIRBreakdown } from "@/lib/design-data"
import type { DailyResponse, DailySummary as BackendDailySummary, EventPoint, GlucosePoint, TimeInRangeBand, TrendBucket } from "@/types"

/**
 * Convert a unix-ms timestamp within `day` into minutes-of-day (0..1439).
 */
function minuteOfDay(at: number, dayStart: number): number {
  return Math.max(0, Math.min(24 * 60 - 1, Math.round((at - dayStart) / 60000)))
}

/**
 * Build chart-ready DayData from backend DailyResponse.
 * - glucose → pts (minute-of-day + mg/dL)
 * - insulin events are treated as meal boluses (backend doesn't split SMBs yet)
 * - carbs → carbs
 * - basalProfile → step boundaries
 */
export function adaptDailyResponse(resp: DailyResponse): DayData & { hasData: boolean } {
  const dayStart = resp.rangeStart || startOfDayMs(resp.glucose[0]?.at ?? Date.now())
  const pts: GluPoint[] = resp.glucose.map((g) => ({
    t: minuteOfDay(g.at, dayStart),
    v: Math.round(g.value),
  }))

  const carbs: Carb[] = resp.carbs.map((c) => ({
    t: minuteOfDay(c.at, dayStart),
    g: c.value,
    note: c.subtitle || c.label || "",
  }))

  // Treat insulin events as meal boluses. Backend doesn't separate SMBs today.
  const boluses: Bolus[] = resp.insulin.map((i) => ({
    t: minuteOfDay(i.at, dayStart),
    u: i.value,
    kind: "meal",
    note: i.subtitle || i.label || "",
  }))

  const basalProfile: BasalProfileStep[] = dedupeBasalSteps(
    resp.basalProfile.map((b) => ({
      h: minuteOfDay(b.at, dayStart) / 60,
      r: b.value,
    })),
  )

  return {
    pts,
    boluses,
    smbs: [] as SMB[],
    carbs,
    smbgs: [] as SMBG[],
    basalProfile: basalProfile.length > 0 ? basalProfile : [{ h: 0, r: 0.8 }],
    temp: [] as TempBasal[],
    hasData: pts.length > 0,
  }
}

function dedupeBasalSteps(rows: BasalProfileStep[]): BasalProfileStep[] {
  const out: BasalProfileStep[] = []
  const seen = new Set<number>()
  for (const row of rows.sort((a, b) => a.h - b.h)) {
    const key = Math.round(row.h * 60) // minute resolution
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function startOfDayMs(at: number): number {
  const d = new Date(at)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * Build AGP buckets from backend TrendBucket[].
 * Backend already matches the prototype shape.
 */
export function adaptAGP(buckets: TrendBucket[]): AGPBucket[] {
  return buckets.map((b) => ({
    hour: b.hour,
    p10: b.p10,
    p25: b.p25,
    p50: b.p50,
    p75: b.p75,
    p90: b.p90,
  }))
}

/**
 * Convert backend TIR bands into the 6-band breakdown the TIRStack needs.
 * Backend bands order: Severe low, Low, Target, High, Very high (percent each).
 */
export function adaptTIR(bands: TimeInRangeBand[], tightPercent?: number): TIRBreakdown {
  const byLabel: Record<string, number> = {}
  for (const b of bands) byLabel[b.label.toLowerCase()] = b.percent

  const vlow = byLabel["severe low"] ?? 0
  const low = byLabel["low"] ?? 0
  const inWide = byLabel["target"] ?? 0
  const high = byLabel["high"] ?? 0
  const vhigh = byLabel["very high"] ?? 0

  // inWide includes low in prototype's accounting (inWide = low + target)
  // TIRStack calculates `inWide - low` for the displayed in-range bar.
  const inWideCombined = inWide + low

  return {
    vlow,
    low: low + vlow,
    inTight: tightPercent ?? 0,
    inRange: low + inWide,
    inWide: inWideCombined,
    high: high + vhigh,
    vhigh,
  }
}

/**
 * Convert backend sparkline points to chart points.
 */
export function adaptPoints(points: GlucosePoint[]): GluPoint[] {
  return points.map((p, i) => ({ t: i, v: Math.round(p.value) }))
}

/**
 * Convert backend daily summaries → DayStrip input.
 */
export function adaptDailySummaries(rows: BackendDailySummary[]): DailySummary[] {
  return rows.map((d) => {
    const ts = d.date
    const dt = ts ? new Date(ts) : null
    const iso = dt ? dt.toISOString().slice(0, 10) : ""
    return {
      date: iso,
      dow: d.day || (dt ? dt.toLocaleDateString("en-US", { weekday: "short" }) : ""),
      avg: Math.round(d.avgGlucose),
      tir: d.tir,
      carbs: Math.round(d.carbs),
      insulin: Math.round(d.insulin * 10) / 10,
      lows: 0,
    }
  })
}

/**
 * Extract a numeric metric value by id from a Metric list.
 * Returns null if not found or not parseable.
 */
export function numericMetric(
  metrics: Array<{ id?: string; value: string }>,
  id: string,
): number | null {
  const m = metrics.find((x) => x.id === id)
  if (!m) return null
  const match = m.value.match(/-?\d+(\.\d+)?/)
  if (!match) return null
  return parseFloat(match[0])
}

/**
 * Format a unix-ms timestamp as HH:MM (UTC).
 */
export function hhmmUtc(at: number): string {
  if (!at) return "--:--"
  const d = new Date(at)
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
}

/**
 * Unwrap event shape variants for generic event rows.
 */
export function eventLabel(event: EventPoint): string {
  return event.subtitle || event.label || event.kind
}

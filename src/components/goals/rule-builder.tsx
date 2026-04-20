import { useMemo } from "react"

import type {
  Aggregate,
  Daypart,
  Operator,
  Predicate,
  PredicateKind,
} from "@/lib/goals-api"

// ─────────────────────────────────────────────────────────────────────────────
// Metadata for every aggregate — drives the builder UI, labels and units.
// ─────────────────────────────────────────────────────────────────────────────

type AggSpec = {
  id: Aggregate
  label: string
  unit: string
  category: "range" | "variability" | "events" | "metric"
  help: string
  // Controls which extra inputs show up in the builder.
  hasThresholdArg?: boolean // time_below / time_above → threshold
  hasRangeArgs?: boolean // tir → low/high
  hasFilter?: boolean // count / time_duration → glucose filter
  defaultValue: number
  defaultOp: Operator
  goodDirection: "higher" | "lower"
  scale?: [number, number] // slider hint
}

export const AGG_SPECS: AggSpec[] = [
  {
    id: "tir",
    label: "Time in range",
    unit: "%",
    category: "range",
    help: "Share of readings inside a glucose band (e.g. 70-180).",
    hasRangeArgs: true,
    defaultValue: 70,
    defaultOp: ">=",
    goodDirection: "higher",
    scale: [0, 100],
  },
  {
    id: "time_below",
    label: "Time below threshold",
    unit: "%",
    category: "range",
    help: "Share of readings below a threshold (e.g. < 70 mg/dL).",
    hasThresholdArg: true,
    defaultValue: 4,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [0, 100],
  },
  {
    id: "time_above",
    label: "Time above threshold",
    unit: "%",
    category: "range",
    help: "Share of readings above a threshold (e.g. > 180 mg/dL).",
    hasThresholdArg: true,
    defaultValue: 25,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [0, 100],
  },
  {
    id: "gmi",
    label: "Glucose Management Index (GMI)",
    unit: "%",
    category: "metric",
    help: "3.31 + 0.02392 × mean glucose. ADA target ≤ 7.0% for adults with T1D.",
    defaultValue: 7.0,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [5, 12],
  },
  {
    id: "ea1c",
    label: "Estimated A1c (ADAG)",
    unit: "%",
    category: "metric",
    help: "(avg mg/dL + 46.7) / 28.7 — classical ADAG eA1C.",
    defaultValue: 7.0,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [5, 12],
  },
  {
    id: "avg",
    label: "Average glucose",
    unit: "mg/dL",
    category: "metric",
    help: "Mean of all readings in the window.",
    defaultValue: 154,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [70, 300],
  },
  {
    id: "cv",
    label: "Coefficient of variation (CV)",
    unit: "%",
    category: "variability",
    help: "SD ÷ mean × 100. CGM consensus target ≤ 36%.",
    defaultValue: 36,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [10, 60],
  },
  {
    id: "sd",
    label: "Standard deviation",
    unit: "mg/dL",
    category: "variability",
    help: "How much readings spread around the mean.",
    defaultValue: 55,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [10, 100],
  },
  { id: "p10", label: "10th percentile glucose", unit: "mg/dL", category: "variability", help: "10% of readings are below this.", defaultValue: 70, defaultOp: ">=", goodDirection: "higher", scale: [40, 200] },
  { id: "p25", label: "25th percentile glucose", unit: "mg/dL", category: "variability", help: "Lower quartile.", defaultValue: 90, defaultOp: ">=", goodDirection: "higher", scale: [40, 200] },
  { id: "p50", label: "Median glucose", unit: "mg/dL", category: "metric", help: "Middle value — robust to outliers.", defaultValue: 130, defaultOp: "<=", goodDirection: "lower", scale: [70, 250] },
  { id: "p75", label: "75th percentile glucose", unit: "mg/dL", category: "variability", help: "Upper quartile.", defaultValue: 170, defaultOp: "<=", goodDirection: "lower", scale: [100, 300] },
  { id: "p90", label: "90th percentile glucose", unit: "mg/dL", category: "variability", help: "Only 10% of readings higher than this.", defaultValue: 200, defaultOp: "<=", goodDirection: "lower", scale: [100, 350] },
  {
    id: "count",
    label: "Event count",
    unit: "events",
    category: "events",
    help: "How many readings matched the filter in the window (e.g. < 54 mg/dL).",
    hasFilter: true,
    defaultValue: 0,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [0, 50],
  },
  {
    id: "time_duration",
    label: "Time where filter matches",
    unit: "min",
    category: "events",
    help: "Total minutes spent with filter true (e.g. < 54 mg/dL).",
    hasFilter: true,
    defaultValue: 30,
    defaultOp: "<=",
    goodDirection: "lower",
    scale: [0, 600],
  },
]

export function findSpec(agg: Aggregate): AggSpec {
  return AGG_SPECS.find((s) => s.id === agg) ?? AGG_SPECS[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// Presets — the one-click starters from which people can tweak further.
// ─────────────────────────────────────────────────────────────────────────────

export type Preset = {
  id: string
  title: string
  rationale: string
  actionPlan?: string
  predicate: Predicate
}

export const PRESETS: Preset[] = [
  {
    id: "tir70-180_70pct_14d",
    title: "Time-in-range ≥ 70 % (14 days)",
    rationale: "ADA/EASD consensus target for adults with T1D / T2D.",
    actionPlan: "Bolus 10-15 min before meals; keep basal within 10% of needs.",
    predicate: {
      kind: "threshold",
      aggregate: "tir",
      args: { low: 70, high: 180 },
      op: ">=",
      value: 70,
      window: { kind: "trailing_days", days: 14 },
    },
  },
  {
    id: "tbr_u70_4pct",
    title: "Time below 70 mg/dL ≤ 4 %",
    rationale: "Consensus hypo-safety target — reduces alarm fatigue and fear.",
    actionPlan: "Relax targets post-exercise; reduce correction at night.",
    predicate: {
      kind: "threshold",
      aggregate: "time_below",
      args: { threshold: 70 },
      op: "<=",
      value: 4,
      window: { kind: "trailing_days", days: 14 },
    },
  },
  {
    id: "severe_lows_0_per_week",
    title: "No readings < 54 mg/dL per week",
    rationale: "Severe hypoglycemia is the single highest-risk CGM metric.",
    actionPlan: "Alert threshold at 65 mg/dL; pre-bed snack if IOB > 0.5 U.",
    predicate: {
      kind: "threshold",
      aggregate: "count",
      filter: { glucoseLt: 54 },
      op: "<=",
      value: 0,
      window: { kind: "trailing_days", days: 7 },
      perUnit: { kind: "week", requireAll: true },
    },
  },
  {
    id: "gmi_7",
    title: "GMI ≤ 7.0 %",
    rationale: "Glucose Management Index — an A1c proxy from 14d mean glucose.",
    predicate: {
      kind: "threshold",
      aggregate: "gmi",
      op: "<=",
      value: 7,
      window: { kind: "trailing_days", days: 14 },
    },
  },
  {
    id: "cv_36",
    title: "Coefficient of variation ≤ 36 %",
    rationale: "CV ≤ 36 % separates stable from unstable glucose patterns.",
    predicate: {
      kind: "threshold",
      aggregate: "cv",
      op: "<=",
      value: 36,
      window: { kind: "trailing_days", days: 14 },
    },
  },
  {
    id: "night_range",
    title: "Nighttime time-in-range ≥ 80 %",
    rationale: "Stable nights correlate with better next-day control.",
    predicate: {
      kind: "threshold",
      aggregate: "tir",
      args: { low: 70, high: 180 },
      filter: { daypart: "night" },
      op: ">=",
      value: 80,
      window: { kind: "trailing_days", days: 14 },
    },
  },
  {
    id: "p90_down_200",
    title: "90th percentile glucose ≤ 200 mg/dL",
    rationale: "Tail-risk — caps how high the worst 10 % of readings go.",
    predicate: {
      kind: "threshold",
      aggregate: "p90",
      op: "<=",
      value: 200,
      window: { kind: "trailing_days", days: 14 },
    },
  },
  {
    id: "tight_range_50",
    title: "Tight range 70-140 ≥ 50 %",
    rationale: "Tight range is emerging as the next benchmark beyond TIR 70-180.",
    predicate: {
      kind: "threshold",
      aggregate: "tir",
      args: { low: 70, high: 140 },
      op: ">=",
      value: 50,
      window: { kind: "trailing_days", days: 14 },
    },
  },
]

export function emptyPredicate(): Predicate {
  return {
    kind: "threshold",
    aggregate: "tir",
    args: { low: 70, high: 180 },
    op: ">=",
    value: 70,
    window: { kind: "trailing_days", days: 14 },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule builder UI
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  value: Predicate
  onChange: (next: Predicate) => void
}

export function RuleBuilder({ value, onChange }: Props) {
  const spec = useMemo(() => findSpec(value.aggregate), [value.aggregate])

  const setAgg = (agg: Aggregate) => {
    const nextSpec = findSpec(agg)
    const next: Predicate = {
      kind: value.kind,
      aggregate: agg,
      op: nextSpec.defaultOp,
      value: nextSpec.defaultValue,
      window: value.window,
      perUnit: value.perUnit,
      args: nextSpec.hasRangeArgs
        ? { low: 70, high: 180 }
        : nextSpec.hasThresholdArg
          ? { threshold: agg === "time_below" ? 70 : 180 }
          : undefined,
      filter: nextSpec.hasFilter ? value.filter ?? { glucoseLt: 54 } : value.filter,
    }
    onChange(next)
  }

  const setKind = (kind: PredicateKind) => onChange({ ...value, kind })
  const setOp = (op: Operator) => onChange({ ...value, op })
  const setValue = (v: number) => onChange({ ...value, value: v })
  const setValue2 = (v: number) => onChange({ ...value, value2: v })
  const setDays = (days: number) => onChange({ ...value, window: { ...value.window, days } })
  const setArg = (key: string, v: number) =>
    onChange({ ...value, args: { ...(value.args ?? {}), [key]: v } })
  const setFilter = (f: Partial<Predicate["filter"] & {}>) =>
    onChange({ ...value, filter: { ...(value.filter ?? {}), ...f } })
  const setDaypart = (dp: Daypart) => setFilter({ daypart: dp || undefined })
  const setPerUnit = (kind: "" | "day" | "week") =>
    onChange({ ...value, perUnit: kind ? { kind, requireAll: true } : null })

  const grouped = useMemo(() => {
    const by: Record<string, AggSpec[]> = {}
    for (const s of AGG_SPECS) {
      by[s.category] = by[s.category] ?? []
      by[s.category].push(s)
    }
    return by
  }, [])

  return (
    <div className="rb">
      <div className="rb__row">
        <div className="rb__label">I want</div>
        <select
          className="rb__select"
          value={value.aggregate}
          onChange={(e) => setAgg(e.target.value as Aggregate)}
        >
          {Object.entries(grouped).map(([cat, list]) => (
            <optgroup key={cat} label={categoryLabel(cat)}>
              {list.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {spec.hasRangeArgs ? (
        <div className="rb__row">
          <div className="rb__label">inside the band</div>
          <NumInput
            value={(value.args?.low as number) ?? 70}
            onChange={(v) => setArg("low", v)}
            suffix="mg/dL"
          />
          <span className="rb__sep">–</span>
          <NumInput
            value={(value.args?.high as number) ?? 180}
            onChange={(v) => setArg("high", v)}
            suffix="mg/dL"
          />
        </div>
      ) : null}

      {spec.hasThresholdArg ? (
        <div className="rb__row">
          <div className="rb__label">threshold</div>
          <NumInput
            value={(value.args?.threshold as number) ?? (value.aggregate === "time_below" ? 70 : 180)}
            onChange={(v) => setArg("threshold", v)}
            suffix="mg/dL"
          />
        </div>
      ) : null}

      {spec.hasFilter ? (
        <div className="rb__row">
          <div className="rb__label">only when glucose is</div>
          <select
            className="rb__select rb__select--sm"
            value={
              value.filter?.glucoseLt !== undefined
                ? "lt"
                : value.filter?.glucoseGt !== undefined
                  ? "gt"
                  : "lt"
            }
            onChange={(e) => {
              const kind = e.target.value
              if (kind === "lt") setFilter({ glucoseLt: value.filter?.glucoseLt ?? 54, glucoseGt: undefined })
              else setFilter({ glucoseGt: value.filter?.glucoseGt ?? 250, glucoseLt: undefined })
            }}
          >
            <option value="lt">below</option>
            <option value="gt">above</option>
          </select>
          <NumInput
            value={value.filter?.glucoseLt ?? value.filter?.glucoseGt ?? 54}
            onChange={(v) =>
              value.filter?.glucoseGt !== undefined
                ? setFilter({ glucoseGt: v })
                : setFilter({ glucoseLt: v })
            }
            suffix="mg/dL"
          />
        </div>
      ) : null}

      <div className="rb__row">
        <div className="rb__label">to be</div>
        <select className="rb__select rb__select--sm" value={value.op} onChange={(e) => setOp(e.target.value as Operator)}>
          <option value=">=">at least (≥)</option>
          <option value="<=">at most (≤)</option>
          <option value=">">greater than (&gt;)</option>
          <option value="<">less than (&lt;)</option>
          <option value="==">exactly (=)</option>
          <option value="between">between</option>
        </select>
        <NumInput value={value.value} onChange={setValue} suffix={spec.unit} />
        {value.op === "between" ? (
          <>
            <span className="rb__sep">and</span>
            <NumInput value={value.value2 ?? value.value + 10} onChange={setValue2} suffix={spec.unit} />
          </>
        ) : null}
      </div>

      <div className="rb__row">
        <div className="rb__label">trailing window</div>
        <NumInput value={value.window.days} onChange={setDays} suffix="days" min={1} max={365} />
        <span className="rb__sep">measured</span>
        <select
          className="rb__select rb__select--sm"
          value={value.perUnit?.kind ?? ""}
          onChange={(e) => setPerUnit(e.target.value as "" | "day" | "week")}
        >
          <option value="">as a whole</option>
          <option value="day">per day</option>
          <option value="week">per week</option>
        </select>
      </div>
      <p className="rb__help" style={{ margin: 0 }}>
        Only data from your <b>start date</b> onward counts — the effective window shrinks if the
        goal is younger than the trailing length.
      </p>

      {spec.hasFilter ? null : (
        <div className="rb__row">
          <div className="rb__label">daypart</div>
          <select
            className="rb__select rb__select--sm"
            value={value.filter?.daypart ?? ""}
            onChange={(e) => setDaypart(e.target.value as Daypart)}
          >
            <option value="">anytime</option>
            <option value="night">night (00-06)</option>
            <option value="morning">morning (06-12)</option>
            <option value="afternoon">afternoon (12-18)</option>
            <option value="evening">evening (18-24)</option>
          </select>
        </div>
      )}

      <div className="rb__row">
        <div className="rb__label">evaluation</div>
        <select
          className="rb__select rb__select--sm"
          value={value.kind}
          onChange={(e) => setKind(e.target.value as PredicateKind)}
        >
          <option value="threshold">met if predicate is true today</option>
          <option value="trend">must trend toward target over time</option>
        </select>
      </div>

      {value.kind === "trend" ? (
        <div className="rb__row">
          <div className="rb__label">fit slope over</div>
          <NumInput
            value={value.trendOverDays ?? Math.max(7, Math.min(value.window.days, 14))}
            onChange={(v) => onChange({ ...value, trendOverDays: v })}
            suffix="days"
            min={3}
            max={90}
          />
        </div>
      ) : null}

      <p className="rb__help">{spec.help}</p>
    </div>
  )
}

function categoryLabel(cat: string) {
  switch (cat) {
    case "range":
      return "Range & exposure"
    case "variability":
      return "Variability & percentiles"
    case "events":
      return "Events (count / duration)"
    case "metric":
      return "Overall metrics"
    default:
      return cat
  }
}

function NumInput({
  value,
  onChange,
  suffix,
  min,
  max,
}: {
  value: number
  onChange: (v: number) => void
  suffix?: string
  min?: number
  max?: number
}) {
  return (
    <label className="rb__num">
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(v)
        }}
      />
      {suffix ? <span>{suffix}</span> : null}
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable predicate summary (used in cards and Glyco messages)
// ─────────────────────────────────────────────────────────────────────────────

export function summarisePredicate(p: Predicate): string {
  const spec = findSpec(p.aggregate)
  let subject = spec.label
  if (spec.hasRangeArgs) {
    const lo = p.args?.low ?? 70
    const hi = p.args?.high ?? 180
    subject = `Time in ${lo}-${hi} mg/dL`
  } else if (spec.hasThresholdArg) {
    const t = p.args?.threshold
    subject = p.aggregate === "time_below" ? `Time below ${t} mg/dL` : `Time above ${t} mg/dL`
  }
  if (spec.hasFilter && p.filter) {
    if (p.filter.glucoseLt !== undefined) subject = `${p.aggregate === "count" ? "Readings" : "Minutes"} below ${p.filter.glucoseLt} mg/dL`
    else if (p.filter.glucoseGt !== undefined) subject = `${p.aggregate === "count" ? "Readings" : "Minutes"} above ${p.filter.glucoseGt} mg/dL`
  }
  if (p.filter?.daypart) subject += ` · ${p.filter.daypart}`
  const comparator =
    p.op === ">=" ? "≥" : p.op === "<=" ? "≤" : p.op === "between" ? "between" : p.op
  const rhs =
    p.op === "between"
      ? `${p.value} – ${p.value2 ?? "?"} ${spec.unit}`
      : `${p.value}${spec.unit ? " " + spec.unit : ""}`
  const window = `trailing ${p.window.days} d`
  const perUnit = p.perUnit ? ` · every ${p.perUnit.kind}` : ""
  return `${subject} ${comparator} ${rhs} · ${window}${perUnit}`
}

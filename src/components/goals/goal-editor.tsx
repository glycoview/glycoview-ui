import { useEffect, useMemo, useRef, useState } from "react"

import { GoalChart } from "@/components/goals/goal-chart"
import {
  PRESETS,
  RuleBuilder,
  emptyPredicate,
  findSpec,
  summarisePredicate,
  type Preset,
} from "@/components/goals/rule-builder"
import {
  createGoal,
  previewPredicate,
  updateGoal,
  type Goal,
  type GoalWithProgress,
  type Predicate,
  type Progress,
} from "@/lib/goals-api"
import { todayInTz, userTimeZone } from "@/lib/time"

type Props = {
  initial?: GoalWithProgress | null
  onClose: () => void
  onSaved: (goal: GoalWithProgress) => void
}

export function GoalEditor({ initial, onClose, onSaved }: Props) {
  const tz = userTimeZone()
  const today = todayInTz(tz)
  const [title, setTitle] = useState(initial?.title ?? "")
  const [rationale, setRationale] = useState(initial?.rationale ?? "")
  const [actionPlan, setActionPlan] = useState(initial?.actionPlan ?? "")
  const [startDate, setStartDate] = useState(initial?.startDate || today)
  const [targetDate, setTargetDate] = useState(initial?.targetDate || "")
  const [predicate, setPredicate] = useState<Predicate>(initial?.predicate ?? emptyPredicate())
  const [preview, setPreview] = useState<Progress | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const summary = useMemo(() => summarisePredicate(predicate), [predicate])
  const spec = findSpec(predicate.aggregate)

  // Debounced live preview. Any edit to the predicate kicks off a preview call.
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      previewPredicate(predicate, targetDate || undefined, tz)
        .then((p) => {
          setPreview(p)
          setPreviewError(null)
        })
        .catch((e) => setPreviewError(e?.message ?? "preview failed"))
    }, 200)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [predicate, targetDate, tz])

  const applyPreset = (p: Preset) => {
    setTitle((t) => (t.trim() ? t : p.title))
    setRationale((r) => (r.trim() ? r : p.rationale))
    if (p.actionPlan) setActionPlan((a) => (a.trim() ? a : p.actionPlan!))
    setPredicate(p.predicate)
  }

  const valid = title.trim().length >= 2 && startDate

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setSubmitting(true)
    setErr(null)
    try {
      const payload: Omit<Goal, "id" | "createdAt" | "updatedAt" | "status"> & { status?: "active" } = {
        title: title.trim(),
        predicate,
        startDate,
        targetDate: targetDate || "",
        rationale: rationale.trim() || undefined,
        actionPlan: actionPlan.trim() || undefined,
      }
      const saved = initial?.id
        ? await updateGoal(initial.id, { ...payload, predicate })
        : await createGoal(payload)
      onSaved(saved)
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Save failed"
      setErr(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <form
        className="modal"
        style={{ maxWidth: 820 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal__head">
          <div>
            <div className="gv-h3">{initial?.id ? "Edit goal" : "New goal"}</div>
            <div className="hint mt-4">
              Build a mathematical predicate against your CGM data. Live preview updates as you type.
            </div>
          </div>
          <button type="button" className="pill-btn" onClick={onClose} style={{ height: 26, fontSize: 11.5 }}>
            Close
          </button>
        </div>

        <div className="modal__body" style={{ maxHeight: "72vh" }}>
          {!initial?.id ? (
            <div>
              <div className="kicker">Start from a preset</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, marginTop: 8 }}>
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="goal-preset"
                    onClick={() => applyPreset(p)}
                    title={p.rationale}
                  >
                    <b>{p.title}</b>
                    <span className="hint" style={{ fontSize: 11 }}>{p.rationale}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="label">Title</div>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Stable nights – no lows"
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="label">Start date</div>
              <input
                className="input mono"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <div className="label">Target date (optional)</div>
              <input
                className="input mono"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={startDate}
              />
              <div className="help">Leave empty for an ongoing goal without a deadline.</div>
            </div>
          </div>

          <div>
            <div className="label">Rule</div>
            <RuleBuilder value={predicate} onChange={setPredicate} />
            <div className="hint mt-4 mono" style={{ fontSize: 11.5 }}>{summary}</div>
          </div>

          <div className="panel" style={{ padding: 14 }}>
            <div className="row between" style={{ alignItems: "baseline" }}>
              <div className="kicker">Live preview · last {predicate.window.days} days</div>
              <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
                <div className="mono num-xl" style={{ fontSize: 22, color: preview?.met ? "var(--st-in)" : "var(--ink)" }}>
                  {preview ? formatValue(preview.currentValue, preview.unit) : "—"}
                </div>
                <span className="hint mono">target {preview ? formatValue(preview.targetValue, preview.unit) : "—"}</span>
                {preview ? (
                  <span className={"badge " + stateBadgeClass(preview.state)}>{labelForState(preview.state)}</span>
                ) : null}
              </div>
            </div>
            {previewError ? (
              <div className="hint mt-4" style={{ color: "var(--st-low)" }}>{previewError}</div>
            ) : null}
            {preview && preview.dailySeries.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <GoalChart
                  progress={preview}
                  targetDate={targetDate || undefined}
                  goodDirection={spec.goodDirection}
                  height={180}
                />
              </div>
            ) : preview ? (
              <div className="hint mt-8">No readings in this window yet — the series will fill in as data arrives.</div>
            ) : (
              <div className="hint mt-8">Computing preview…</div>
            )}
            {preview?.narrative ? (
              <div className="hint mt-8" style={{ color: "var(--ink-2)" }}>{preview.narrative}</div>
            ) : null}
            {preview?.nudge ? (
              <div className="hint mt-4" style={{ color: "var(--accent-2)" }}>{preview.nudge}</div>
            ) : null}
          </div>

          <div>
            <div className="label">Why this goal (optional)</div>
            <textarea
              className="input"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={2}
              placeholder="Clinical reasoning the doctor and patient agreed on."
            />
          </div>

          <div>
            <div className="label">Action plan (optional)</div>
            <textarea
              className="input"
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              rows={2}
              placeholder="Concrete behaviours to move the needle — Glyco can help turn this into a checklist."
            />
          </div>

          {err ? <div className="hint" style={{ color: "var(--st-low)" }}>{err}</div> : null}
        </div>

        <div className="modal__foot">
          <div className="hint mono">{tz}</div>
          <button type="button" className="pill-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="pill-btn is-primary" disabled={!valid || submitting}>
            {submitting ? "Saving…" : initial?.id ? "Save changes" : "Create goal"}
          </button>
        </div>
      </form>
    </div>
  )
}

export function formatValue(v: number, unit: string): string {
  if (!Number.isFinite(v)) return "—"
  if (unit === "%") return `${v.toFixed(1)}%`
  if (unit === "mg/dL") return `${Math.round(v)} mg/dL`
  if (unit === "events") return `${Math.round(v)}`
  if (unit === "min") return `${Math.round(v)} min`
  return v.toFixed(1)
}

export function stateBadgeClass(state: string): string {
  switch (state) {
    case "smashing":
    case "on_track":
    case "achieved":
      return "badge--in"
    case "at_risk":
      return "badge--high"
    case "behind":
      return "badge--low"
    default:
      return ""
  }
}

export function labelForState(state: string): string {
  switch (state) {
    case "smashing":
      return "Crushing it"
    case "on_track":
      return "On track"
    case "at_risk":
      return "At risk"
    case "behind":
      return "Behind"
    case "achieved":
      return "Achieved"
    default:
      return "Ongoing"
  }
}

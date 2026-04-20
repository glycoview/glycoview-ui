import { useMemo, useState } from "react"

import { PanelHead } from "@/components/dashboard/primitives"
import { GoalChart } from "@/components/goals/goal-chart"
import {
  GoalEditor,
  formatValue,
  labelForState,
  stateBadgeClass,
} from "@/components/goals/goal-editor"
import { summarisePredicate, findSpec } from "@/components/goals/rule-builder"
import {
  deleteGoal,
  setGoalStatus,
  useGoals,
  type GoalWithProgress,
} from "@/lib/goals-api"
import { Icons } from "@/lib/design-icons"
import { userTimeZone } from "@/lib/time"

export function GoalsPage() {
  const tz = userTimeZone()
  const [includeArchived, setIncludeArchived] = useState(false)
  const { data, loading, error, refresh } = useGoals(tz, includeArchived)
  const [editing, setEditing] = useState<GoalWithProgress | null | "new">(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const active = useMemo(() => (data ?? []).filter((g) => g.status === "active"), [data])
  const achieved = useMemo(() => (data ?? []).filter((g) => g.status === "achieved"), [data])
  const paused = useMemo(() => (data ?? []).filter((g) => g.status === "paused"), [data])
  const archived = useMemo(() => (data ?? []).filter((g) => g.status === "archived"), [data])

  const stats = useMemo(() => {
    const list = active
    if (!list.length) return null
    let onTrack = 0
    let smashing = 0
    let atRisk = 0
    let behind = 0
    for (const g of list) {
      const s = g.progress?.state ?? "ongoing"
      if (s === "on_track") onTrack++
      else if (s === "smashing") smashing++
      else if (s === "at_risk") atRisk++
      else if (s === "behind") behind++
    }
    return { total: list.length, onTrack, smashing, atRisk, behind }
  }, [active])

  if (loading) {
    return <div className="panel" style={{ padding: 24 }}><span className="hint">Loading goals…</span></div>
  }
  if (error) {
    return (
      <div className="panel" style={{ padding: 24, color: "var(--st-low)" }}>
        {error.message}
      </div>
    )
  }

  return (
    <>
      <div className="gv-grid gv-grid-hero" style={{ marginBottom: 16 }}>
        <div className="panel" style={{ padding: 20 }}>
          <div className="kicker">Your goals</div>
          <div className="row" style={{ alignItems: "baseline", gap: 10, marginTop: 6 }}>
            <div className="num-xl mono" style={{ fontSize: "clamp(40px, 8vw, 62px)", lineHeight: 1 }}>
              {stats?.total ?? 0}
            </div>
            <span className="hint mono">active</span>
          </div>
          <div className="hint mt-8">
            {stats
              ? `${stats.smashing} crushing · ${stats.onTrack} on track · ${stats.atRisk} at risk · ${stats.behind} behind`
              : "No active goals yet. Start with a preset — TIR, hypo safety, GMI and more."}
          </div>
          <div className="row mt-16" style={{ gap: 8 }}>
            <button
              className="pill-btn is-primary"
              type="button"
              onClick={() => setEditing("new")}
            >
              <Icons.Plus size={13} /> New goal
            </button>
            <label className="pill-btn" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Show archived
            </label>
          </div>
        </div>
        <div className="panel" style={{ padding: 20 }}>
          <div className="kicker">How this works</div>
          <div className="mt-8" style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
            Every goal is a <b>predicate</b> — a math rule evaluated daily against your CGM data.
            Pick from presets like <i>Time in range ≥ 70%</i> or build your own: percentiles,
            event counts, night-only filters, weekly caps. Glyco reads every goal with{" "}
            <span className="mono">get_goals</span> so you can ask it "am I on track?" any time.
          </div>
          <div className="mt-8" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span className="badge badge--in">on track = meeting or projected to meet</span>
            <span className="badge badge--high">at risk = small gap, fixable</span>
            <span className="badge badge--low">behind = missing by &gt; 20%</span>
          </div>
        </div>
      </div>

      {actionError ? (
        <div className="panel" style={{ padding: 14, color: "var(--st-low)", marginBottom: 12 }}>
          {actionError}
        </div>
      ) : null}

      {active.length === 0 && achieved.length === 0 && paused.length === 0 ? (
        <EmptyState onCreate={() => setEditing("new")} />
      ) : null}

      {active.length > 0 ? (
        <Section title="Active" sub="Evaluated live against your CGM data">
          <GoalGrid
            goals={active}
            onEdit={(g) => setEditing(g)}
            onArchive={async (g) => {
              try {
                await setGoalStatus(g.id, "archived")
                refresh()
              } catch (e: unknown) {
                setActionError((e as { message?: string })?.message ?? "archive failed")
              }
            }}
            onMarkAchieved={async (g) => {
              try {
                await setGoalStatus(g.id, "achieved")
                refresh()
              } catch (e: unknown) {
                setActionError((e as { message?: string })?.message ?? "status update failed")
              }
            }}
            onDelete={async (g) => {
              if (!confirm(`Delete "${g.title}"?`)) return
              try {
                await deleteGoal(g.id)
                refresh()
              } catch (e: unknown) {
                setActionError((e as { message?: string })?.message ?? "delete failed")
              }
            }}
          />
        </Section>
      ) : null}

      {achieved.length > 0 ? (
        <Section title="Achieved" sub="Celebrate the wins">
          <GoalGrid goals={achieved} onEdit={(g) => setEditing(g)} onDelete={async (g) => {
            if (!confirm(`Delete "${g.title}"?`)) return
            try { await deleteGoal(g.id); refresh() } catch (e) { setActionError((e as { message?: string })?.message ?? "delete failed") }
          }} />
        </Section>
      ) : null}

      {paused.length > 0 ? (
        <Section title="Paused">
          <GoalGrid goals={paused} onEdit={(g) => setEditing(g)} onDelete={async (g) => {
            if (!confirm(`Delete "${g.title}"?`)) return
            try { await deleteGoal(g.id); refresh() } catch (e) { setActionError((e as { message?: string })?.message ?? "delete failed") }
          }} />
        </Section>
      ) : null}

      {includeArchived && archived.length > 0 ? (
        <Section title="Archived">
          <GoalGrid goals={archived} onEdit={(g) => setEditing(g)} onDelete={async (g) => {
            if (!confirm(`Delete "${g.title}"?`)) return
            try { await deleteGoal(g.id); refresh() } catch (e) { setActionError((e as { message?: string })?.message ?? "delete failed") }
          }} />
        </Section>
      ) : null}

      {editing ? (
        <GoalEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      ) : null}
    </>
  )
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <PanelHead title={title} sub={sub} />
      <div className="panel__body">{children}</div>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="panel" style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 36, color: "var(--accent-2)" }}>
        <Icons.Sparkles size={36} />
      </div>
      <div className="gv-h3 mt-8">No goals yet</div>
      <div className="hint mt-8">
        Pick a preset or build a custom predicate. Your progress updates automatically as new CGM
        data streams in.
      </div>
      <div className="mt-16">
        <button className="pill-btn is-primary" onClick={onCreate} type="button">
          <Icons.Plus size={13} /> Create my first goal
        </button>
      </div>
    </div>
  )
}

function GoalGrid({
  goals,
  onEdit,
  onArchive,
  onMarkAchieved,
  onDelete,
}: {
  goals: GoalWithProgress[]
  onEdit: (g: GoalWithProgress) => void
  onArchive?: (g: GoalWithProgress) => void
  onMarkAchieved?: (g: GoalWithProgress) => void
  onDelete?: (g: GoalWithProgress) => void
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
      {goals.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          onEdit={() => onEdit(g)}
          onArchive={onArchive ? () => onArchive(g) : undefined}
          onMarkAchieved={onMarkAchieved ? () => onMarkAchieved(g) : undefined}
          onDelete={onDelete ? () => onDelete(g) : undefined}
        />
      ))}
    </div>
  )
}

function GoalCard({
  goal,
  onEdit,
  onArchive,
  onMarkAchieved,
  onDelete,
}: {
  goal: GoalWithProgress
  onEdit: () => void
  onArchive?: () => void
  onMarkAchieved?: () => void
  onDelete?: () => void
}) {
  const progress = goal.progress
  const spec = findSpec(goal.predicate.aggregate)
  const stateClass = progress ? stateBadgeClass(progress.state) : ""
  const accent = progress?.met
    ? "var(--st-in)"
    : progress?.state === "behind"
      ? "var(--st-low)"
      : progress?.state === "at_risk"
        ? "var(--st-vhigh)"
        : "var(--ink)"

  const daysAhead = progress?.trajectory?.daysAheadOfSchedule
  const projected = progress?.trajectory?.projectedAtTarget

  return (
    <div
      className="panel"
      style={{
        borderColor:
          progress?.met
            ? "color-mix(in oklch, var(--st-in) 40%, var(--line))"
            : progress?.state === "behind"
              ? "color-mix(in oklch, var(--st-low) 35%, var(--line))"
              : "var(--line)",
      }}
    >
      <div style={{ padding: 16 }}>
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{goal.title}</div>
            <div className="hint mt-4 mono" style={{ fontSize: 11.5 }}>
              {summarisePredicate(goal.predicate)}
            </div>
          </div>
          {progress ? (
            <span className={"badge " + stateClass} style={{ whiteSpace: "nowrap" }}>
              {labelForState(progress.state)}
            </span>
          ) : null}
        </div>

        <div className="row mt-8" style={{ alignItems: "baseline", gap: 12 }}>
          <div className="num-xl mono" style={{ fontSize: 30, color: accent, lineHeight: 1 }}>
            {progress ? formatValue(progress.currentValue, progress.unit) : "—"}
          </div>
          <div className="hint mono">
            target {progress ? formatValue(progress.targetValue, progress.unit) : "—"}
          </div>
          {progress?.met ? (
            <span className="badge badge--in" style={{ marginLeft: "auto" }}>
              <Icons.Check size={11} /> meeting target
            </span>
          ) : null}
        </div>

        {progress && progress.dailySeries.length > 0 ? (
          <div style={{ marginTop: 12, marginLeft: -6, marginRight: -6 }}>
            <GoalChart
              progress={progress}
              targetDate={goal.targetDate || undefined}
              goodDirection={spec.goodDirection}
              height={130}
            />
          </div>
        ) : (
          <div className="hint mt-8">No data yet in the evaluation window.</div>
        )}

        {progress?.perUnit ? (
          <div className="mt-8" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <span className="hint">Per {progress.perUnit.kind}:</span>
            {progress.perUnit.buckets.slice(-8).map((b, i) => (
              <span
                key={i}
                title={`${b.label} · ${formatValue(b.value, progress.unit)}`}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: b.met ? "var(--st-in)" : "var(--st-vhigh)",
                  opacity: 0.85,
                }}
              />
            ))}
            <span className="hint mono" style={{ marginLeft: "auto" }}>
              {progress.perUnit.metCount}/{progress.perUnit.totalCount}
            </span>
          </div>
        ) : null}

        {progress?.narrative ? (
          <div className="hint mt-8" style={{ color: "var(--ink-2)" }}>
            {progress.narrative}
          </div>
        ) : null}
        {progress?.nudge ? (
          <div className="hint mt-4" style={{ color: "var(--accent-2)" }}>
            {progress.nudge}
          </div>
        ) : null}

        <div className="row mt-8 hint mono" style={{ fontSize: 11 }}>
          <span>Start {goal.startDate}</span>
          {goal.targetDate ? <span>&nbsp;· Target {goal.targetDate}</span> : <span>&nbsp;· Ongoing</span>}
          {daysAhead !== undefined && daysAhead !== null ? (
            <span style={{ marginLeft: "auto", color: daysAhead >= 0 ? "var(--st-in)" : "var(--ink-3)" }}>
              {daysAhead >= 0 ? `${daysAhead.toFixed(0)} d ahead` : `${Math.abs(daysAhead).toFixed(0)} d behind`}
            </span>
          ) : projected !== undefined && projected !== null ? (
            <span style={{ marginLeft: "auto" }}>proj {formatValue(projected, progress?.unit ?? "")}</span>
          ) : null}
        </div>

        <div className="row mt-16" style={{ gap: 6, flexWrap: "wrap" }}>
          <button className="pill-btn" onClick={onEdit} type="button">
            Edit
          </button>
          {onMarkAchieved ? (
            <button className="pill-btn" onClick={onMarkAchieved} type="button">
              <Icons.Check size={12} /> Mark achieved
            </button>
          ) : null}
          {onArchive ? (
            <button className="pill-btn" onClick={onArchive} type="button">
              Archive
            </button>
          ) : null}
          {onDelete ? (
            <button
              className="pill-btn"
              onClick={onDelete}
              type="button"
              style={{ marginLeft: "auto", color: "var(--st-low)" }}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

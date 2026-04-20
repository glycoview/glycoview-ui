import { useMemo, useState } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

import { PanelHead } from "@/components/dashboard/primitives"
import { GoalChart } from "@/components/goals/goal-chart"
import {
  GoalEditor,
  formatValue,
  labelForState,
  stateBadgeClass,
} from "@/components/goals/goal-editor"
import { findSpec, summarisePredicate } from "@/components/goals/rule-builder"
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
      if (s === "on_track" || s === "ongoing") onTrack++
      else if (s === "smashing") smashing++
      else if (s === "at_risk") atRisk++
      else if (s === "behind") behind++
    }
    return { total: list.length, onTrack, smashing, atRisk, behind }
  }, [active])

  if (loading) {
    return (
      <div className="panel" style={{ padding: 24 }}>
        <span className="hint">Loading goals…</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="panel" style={{ padding: 24, color: "var(--st-low)" }}>
        {error.message}
      </div>
    )
  }

  const mkDelete = async (g: GoalWithProgress) => {
    if (!confirm(`Delete "${g.title}"?`)) return
    try {
      await deleteGoal(g.id)
      refresh()
    } catch (e) {
      setActionError((e as { message?: string })?.message ?? "delete failed")
    }
  }

  return (
    <>
      <div className="gv-grid gv-grid-hero" style={{ marginBottom: 16 }}>
        <div className="panel">
          <div style={{ padding: 20 }}>
            <div className="row between" style={{ alignItems: "baseline" }}>
              <div className="kicker">Your goals</div>
              <button className="pill-btn is-primary" type="button" onClick={() => setEditing("new")}>
                <Icons.Plus size={13} /> New goal
              </button>
            </div>
            <div className="row mt-8" style={{ alignItems: "baseline", gap: 12 }}>
              <div
                className="num-xl mono"
                style={{ fontSize: "clamp(44px, 8vw, 62px)", lineHeight: 1, letterSpacing: "-0.02em" }}
              >
                {stats?.total ?? 0}
              </div>
              <span className="hint mono">active</span>
            </div>
            <div className="hint mt-8" style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {stats ? summariseStats(stats) : "No active goals yet — pick a preset to get started."}
            </div>
            <div
              className="row mt-16"
              style={{
                gap: 10,
                paddingTop: 14,
                borderTop: "1px solid var(--line-2)",
                alignItems: "center",
              }}
            >
              <label
                className="hint"
                style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                />
                Show archived
              </label>
              <span className="hint mono" style={{ marginLeft: "auto" }}>
                {active.length} active · {achieved.length} achieved · {paused.length} paused
              </span>
            </div>
          </div>
        </div>
        <div className="panel">
          <PanelHead title="Glyco insight" sub="Every goal is available to the assistant" />
          <div className="panel__body">
            <MoodRing stats={stats} />
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
        <GoalSection
          title="Active"
          sub="Evaluated live against your CGM data"
          goals={active}
          onEdit={(g) => setEditing(g)}
          onArchive={async (g) => {
            try {
              await setGoalStatus(g.id, "archived")
              refresh()
            } catch (e) {
              setActionError((e as { message?: string })?.message ?? "archive failed")
            }
          }}
          onMarkAchieved={async (g) => {
            try {
              await setGoalStatus(g.id, "achieved")
              refresh()
            } catch (e) {
              setActionError((e as { message?: string })?.message ?? "status update failed")
            }
          }}
          onDelete={mkDelete}
        />
      ) : null}

      {achieved.length > 0 ? (
        <GoalSection
          title="Achieved"
          sub="Celebrate the wins"
          goals={achieved}
          onEdit={(g) => setEditing(g)}
          onDelete={mkDelete}
        />
      ) : null}

      {paused.length > 0 ? (
        <GoalSection title="Paused" goals={paused} onEdit={(g) => setEditing(g)} onDelete={mkDelete} />
      ) : null}

      {includeArchived && archived.length > 0 ? (
        <GoalSection title="Archived" goals={archived} onEdit={(g) => setEditing(g)} onDelete={mkDelete} />
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

function summariseStats(stats: { total: number; smashing: number; onTrack: number; atRisk: number; behind: number }) {
  const parts: string[] = []
  if (stats.smashing) parts.push(`${stats.smashing} crushing`)
  if (stats.onTrack) parts.push(`${stats.onTrack} on track`)
  if (stats.atRisk) parts.push(`${stats.atRisk} at risk`)
  if (stats.behind) parts.push(`${stats.behind} behind`)
  return parts.join(" · ") || "Waiting for enough data."
}

function MoodRing({ stats }: { stats: { total: number; smashing: number; onTrack: number; atRisk: number; behind: number } | null }) {
  const total = stats?.total ?? 0
  const good = (stats?.smashing ?? 0) + (stats?.onTrack ?? 0)
  const pct = total === 0 ? 0 : Math.round((good / total) * 100)
  const data =
    total === 0
      ? [{ name: "empty", value: 1 }]
      : [
          { name: "good", value: good },
          { name: "risk", value: stats?.atRisk ?? 0 },
          { name: "behind", value: stats?.behind ?? 0 },
        ].filter((d) => d.value > 0)
  const colors: Record<string, string> = {
    good: "var(--st-in)",
    risk: "var(--st-vhigh)",
    behind: "var(--st-low)",
    empty: "var(--line-2)",
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: 116, height: 116, flex: "0 0 116px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={40}
              outerRadius={56}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              paddingAngle={data.length > 1 ? 2 : 0}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={colors[d.name]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          <div>
            <div className="mono num-xl" style={{ fontSize: 22, lineHeight: 1 }}>
              {pct}%
            </div>
            <div className="hint mono" style={{ fontSize: 10, marginTop: 2 }}>
              on&nbsp;track
            </div>
          </div>
        </div>
      </div>
      <div className="hint" style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
        Ask Glyco <i>"am I on track?"</i> — every goal is available to the assistant through the{" "}
        <span className="mono" style={{ fontSize: 11 }}>get_goals</span> tool.
      </div>
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

function GoalSection({
  title,
  sub,
  goals,
  onEdit,
  onArchive,
  onMarkAchieved,
  onDelete,
}: {
  title: string
  sub?: string
  goals: GoalWithProgress[]
  onEdit: (g: GoalWithProgress) => void
  onArchive?: (g: GoalWithProgress) => void
  onMarkAchieved?: (g: GoalWithProgress) => void
  onDelete?: (g: GoalWithProgress) => void
}) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <PanelHead title={title} sub={sub} right={<span className="hint mono">{goals.length}</span>} />
      <div
        style={{
          padding: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 14,
        }}
      >
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
  const state = progress?.state ?? "ongoing"
  const accent = progress?.met
    ? "var(--st-in)"
    : state === "behind"
      ? "var(--st-low)"
      : state === "at_risk"
        ? "var(--st-vhigh)"
        : "var(--ink)"

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="panel__head" style={{ padding: "14px 16px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gv-h3" style={{ fontSize: 14.5, lineHeight: 1.3 }}>
            {goal.title}
          </div>
          <div className="hint mono mt-4" style={{ fontSize: 11, lineHeight: 1.4 }}>
            {summarisePredicate(goal.predicate)}
          </div>
        </div>
        {progress ? (
          <span className={"badge " + stateBadgeClass(state)} style={{ whiteSpace: "nowrap" }}>
            {labelForState(state)}
          </span>
        ) : null}
      </div>

      <div style={{ padding: "10px 16px 4px" }}>
        <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
          <div
            className="num-xl mono"
            style={{
              fontSize: 28,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: accent,
            }}
          >
            {progress ? formatValue(progress.currentValue, progress.unit) : "—"}
          </div>
          <span className="hint mono">
            target {progress ? formatValue(progress.targetValue, progress.unit) : "—"}
          </span>
        </div>
      </div>

      {progress && progress.dailySeries.length > 0 ? (
        <div style={{ padding: "4px 6px 8px" }}>
          <GoalChart
            progress={progress}
            targetDate={goal.targetDate || undefined}
            goodDirection={spec.goodDirection}
            height={140}
            compact
          />
        </div>
      ) : (
        <div className="hint" style={{ padding: "12px 16px" }}>
          {goal.startDate === todayIso()
            ? "Just started — readings will populate this chart as they come in."
            : "No data yet in the evaluation window."}
        </div>
      )}

      {progress?.perUnit ? (
        <div className="row" style={{ padding: "0 16px 8px", alignItems: "center", gap: 8 }}>
          <span className="hint mono" style={{ fontSize: 10.5 }}>
            per {progress.perUnit.kind}
          </span>
          <div style={{ display: "flex", gap: 3, flex: 1, flexWrap: "wrap" }}>
            {progress.perUnit.buckets.slice(-12).map((b, i) => (
              <span
                key={i}
                title={`${b.label} · ${formatValue(b.value, progress.unit)}`}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: b.met ? "var(--st-in)" : "var(--st-vhigh)",
                  opacity: 0.9,
                }}
              />
            ))}
          </div>
          <span className="hint mono" style={{ fontSize: 10.5 }}>
            {progress.perUnit.metCount}/{progress.perUnit.totalCount}
          </span>
        </div>
      ) : null}

      {progress?.narrative ? (
        <div className="hint" style={{ padding: "0 16px 4px", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
          {progress.narrative}
        </div>
      ) : null}
      {progress?.nudge ? (
        <div
          className="hint"
          style={{
            padding: "0 16px 8px",
            fontSize: 11.5,
            color: "var(--accent-2)",
            fontStyle: "italic",
          }}
        >
          {progress.nudge}
        </div>
      ) : null}

      <div
        className="row"
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--line-2)",
          fontSize: 11,
          color: "var(--ink-4)",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span className="mono">since {goal.startDate}</span>
        <span className="mono">· {goal.targetDate ? `target ${goal.targetDate}` : "ongoing"}</span>
        {progress?.trajectory?.daysAheadOfSchedule !== undefined &&
        progress?.trajectory?.daysAheadOfSchedule !== null ? (
          <span
            className="mono"
            style={{
              marginLeft: "auto",
              color: progress.trajectory.daysAheadOfSchedule >= 0 ? "var(--st-in)" : "var(--ink-3)",
            }}
          >
            {progress.trajectory.daysAheadOfSchedule >= 0
              ? `${progress.trajectory.daysAheadOfSchedule.toFixed(0)} d ahead`
              : `${Math.abs(progress.trajectory.daysAheadOfSchedule).toFixed(0)} d behind`}
          </span>
        ) : null}
      </div>

      <div
        style={{
          padding: "10px 16px 14px",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <button className="pill-btn" onClick={onEdit} type="button" style={{ height: 28, fontSize: 11.5 }}>
          Edit
        </button>
        {onMarkAchieved ? (
          <button
            className="pill-btn"
            onClick={onMarkAchieved}
            type="button"
            style={{ height: 28, fontSize: 11.5 }}
          >
            <Icons.Check size={11} /> Achieved
          </button>
        ) : null}
        {onArchive ? (
          <button
            className="pill-btn"
            onClick={onArchive}
            type="button"
            style={{ height: 28, fontSize: 11.5 }}
          >
            Archive
          </button>
        ) : null}
        {onDelete ? (
          <button
            className="pill-btn"
            onClick={onDelete}
            type="button"
            style={{
              height: 28,
              fontSize: 11.5,
              marginLeft: "auto",
              color: "var(--st-low)",
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  )
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

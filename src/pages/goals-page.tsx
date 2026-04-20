import { useMemo, useState } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

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

  const mood = moodFromStats(stats)

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
      <div className="goals-hero">
        <div
          className="panel goals-hero__main"
          style={{
            background: mood.bgGradient,
            borderColor: mood.borderColor,
          }}
        >
          <div className="goals-hero__meta">
            <div className="kicker" style={{ color: mood.mutedInk }}>
              Your goals
            </div>
            <div className="goals-hero__count">
              <span className="num-xl mono">{stats?.total ?? 0}</span>
              <span className="hint mono">active</span>
            </div>
            <div className="goals-hero__headline" style={{ color: mood.ink }}>
              {mood.headline}
            </div>
            <div className="goals-hero__sub" style={{ color: mood.mutedInk }}>
              {stats
                ? summariseStats(stats)
                : "Start from a preset — TIR, hypo safety, GMI and more. Your progress evaluates live against your CGM data."}
            </div>
          </div>
          <div className="goals-hero__cta">
            <button className="pill-btn is-primary" type="button" onClick={() => setEditing("new")}>
              <Icons.Plus size={13} /> New goal
            </button>
            <label className="goals-archive-toggle">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              <span>Show archived</span>
            </label>
          </div>
        </div>
        <div className="panel goals-hero__ring">
          <MoodRing stats={stats} />
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
          subtitle="Celebrate the wins"
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

type Mood = {
  headline: string
  ink: string
  mutedInk: string
  bgGradient: string
  borderColor: string
}

function moodFromStats(stats: { total: number; smashing: number; onTrack: number; atRisk: number; behind: number } | null): Mood {
  if (!stats || stats.total === 0) {
    return {
      headline: "No goals yet — let's set one",
      ink: "var(--ink)",
      mutedInk: "var(--ink-3)",
      bgGradient: "var(--surface)",
      borderColor: "var(--line)",
    }
  }
  if (stats.behind > 0) {
    return {
      headline: "Some goals need attention",
      ink: "var(--ink)",
      mutedInk: "var(--ink-3)",
      bgGradient:
        "linear-gradient(135deg, color-mix(in oklch, var(--st-low) 9%, var(--surface)), var(--surface))",
      borderColor: "color-mix(in oklch, var(--st-low) 35%, var(--line))",
    }
  }
  if (stats.atRisk > 0) {
    return {
      headline: "A nudge away from on track",
      ink: "var(--ink)",
      mutedInk: "var(--ink-3)",
      bgGradient:
        "linear-gradient(135deg, color-mix(in oklch, var(--st-vhigh) 9%, var(--surface)), var(--surface))",
      borderColor: "color-mix(in oklch, var(--st-vhigh) 30%, var(--line))",
    }
  }
  if (stats.smashing > 0) {
    return {
      headline: "You're crushing it",
      ink: "var(--ink)",
      mutedInk: "var(--ink-3)",
      bgGradient:
        "linear-gradient(135deg, color-mix(in oklch, var(--st-in) 14%, var(--surface)), var(--surface))",
      borderColor: "color-mix(in oklch, var(--st-in) 40%, var(--line))",
    }
  }
  return {
    headline: "All goals on track",
    ink: "var(--ink)",
    mutedInk: "var(--ink-3)",
    bgGradient:
      "linear-gradient(135deg, color-mix(in oklch, var(--st-in) 10%, var(--surface)), var(--surface))",
    borderColor: "color-mix(in oklch, var(--st-in) 30%, var(--line))",
  }
}

function summariseStats(stats: { total: number; smashing: number; onTrack: number; atRisk: number; behind: number }) {
  const parts: string[] = []
  if (stats.smashing) parts.push(`${stats.smashing} crushing`)
  if (stats.onTrack) parts.push(`${stats.onTrack} on track`)
  if (stats.atRisk) parts.push(`${stats.atRisk} at risk`)
  if (stats.behind) parts.push(`${stats.behind} behind`)
  return parts.join(" · ") || "Waiting for enough data to score."
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
      <div style={{ position: "relative", width: 128, height: 128 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={42}
              outerRadius={60}
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
            <div className="mono" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>
              {pct}%
            </div>
            <div className="hint mono" style={{ fontSize: 10 }}>
              on&nbsp;track
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <div className="kicker">Glyco insight</div>
        <div className="hint" style={{ fontSize: 12.5, color: "var(--ink-2)", maxWidth: 220, lineHeight: 1.5 }}>
          Ask Glyco <i>"am I on track?"</i> — every goal is available to the assistant through the{" "}
          <span className="mono" style={{ fontSize: 11 }}>get_goals</span> tool.
        </div>
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
  subtitle,
  goals,
  onEdit,
  onArchive,
  onMarkAchieved,
  onDelete,
}: {
  title: string
  subtitle?: string
  goals: GoalWithProgress[]
  onEdit: (g: GoalWithProgress) => void
  onArchive?: (g: GoalWithProgress) => void
  onMarkAchieved?: (g: GoalWithProgress) => void
  onDelete?: (g: GoalWithProgress) => void
}) {
  return (
    <section className="goal-section">
      <header>
        <h2>{title}</h2>
        {subtitle ? <span className="hint">{subtitle}</span> : null}
        <span className="hint mono goal-section__count">{goals.length}</span>
      </header>
      <div className="goal-section__grid">
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
    </section>
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
  const stateClass = stateBadgeClass(state)
  const accent = progress?.met
    ? "var(--st-in)"
    : state === "behind"
      ? "var(--st-low)"
      : state === "at_risk"
        ? "var(--st-vhigh)"
        : "var(--ink)"
  const tintClass = `goal-card goal-card--${state}`

  const daysAhead = progress?.trajectory?.daysAheadOfSchedule ?? null
  const projected = progress?.trajectory?.projectedAtTarget ?? null
  const startedToday = isStartedToday(goal.startDate)
  const windowLabel = windowPhrase(goal, progress?.dailySeries.length ?? 0)

  return (
    <article className={tintClass}>
      <header className="goal-card__head">
        <div>
          <h3 className="goal-card__title">{goal.title}</h3>
          <p className="goal-card__rule">{summarisePredicate(goal.predicate)}</p>
        </div>
        {progress ? (
          <span className={"badge " + stateClass} style={{ whiteSpace: "nowrap" }}>
            {labelForState(state)}
          </span>
        ) : null}
      </header>

      <div className="goal-card__kpi">
        <div className="goal-card__value mono" style={{ color: accent }}>
          {progress ? formatValue(progress.currentValue, progress.unit) : "—"}
        </div>
        <div className="goal-card__vs hint mono">
          target {progress ? formatValue(progress.targetValue, progress.unit) : "—"}
        </div>
        {progress?.met ? (
          <span className="badge badge--in goal-card__metpill">
            <Icons.Check size={11} /> meeting target
          </span>
        ) : null}
      </div>

      {progress && progress.dailySeries.length > 0 ? (
        <div className="goal-card__chart">
          <GoalChart
            progress={progress}
            targetDate={goal.targetDate || undefined}
            goodDirection={spec.goodDirection}
            height={160}
            compact
          />
        </div>
      ) : (
        <div className="goal-card__empty hint">
          {startedToday
            ? "Just started — readings will populate this chart as they come in."
            : "No data yet in the evaluation window."}
        </div>
      )}

      {progress?.perUnit ? <PerUnitRow progress={progress} /> : null}

      {progress?.narrative ? (
        <p className="goal-card__narrative">{progress.narrative}</p>
      ) : null}
      {progress?.nudge ? <p className="goal-card__nudge">{progress.nudge}</p> : null}

      <footer className="goal-card__meta">
        <span className="mono">{windowLabel}</span>
        <span className="mono">
          {goal.targetDate ? `target ${goal.targetDate}` : "ongoing"}
        </span>
        {daysAhead !== null && daysAhead !== undefined ? (
          <span
            className="mono"
            style={{
              marginLeft: "auto",
              color: daysAhead >= 0 ? "var(--st-in)" : "var(--ink-3)",
            }}
          >
            {daysAhead >= 0
              ? `${daysAhead.toFixed(0)} d ahead`
              : `${Math.abs(daysAhead).toFixed(0)} d behind`}
          </span>
        ) : projected !== null && projected !== undefined ? (
          <span className="mono" style={{ marginLeft: "auto" }}>
            proj {formatValue(projected, progress?.unit ?? "")}
          </span>
        ) : null}
      </footer>

      <div className="goal-card__actions">
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
            className="pill-btn goal-card__danger"
            onClick={onDelete}
            type="button"
            title="Delete goal"
          >
            Delete
          </button>
        ) : null}
      </div>
    </article>
  )
}

function PerUnitRow({ progress }: { progress: NonNullable<GoalWithProgress["progress"]> }) {
  const per = progress.perUnit
  if (!per) return null
  return (
    <div className="goal-card__perunit">
      <div className="hint mono" style={{ fontSize: 10.5 }}>
        per {per.kind}
      </div>
      <div className="goal-card__perunit-row">
        {per.buckets.slice(-12).map((b, i) => (
          <span
            key={i}
            title={`${b.label} · ${formatValue(b.value, progress.unit)}`}
            className="goal-card__perunit-cell"
            style={{
              background: b.met ? "var(--st-in)" : "var(--st-vhigh)",
            }}
          />
        ))}
      </div>
      <div className="hint mono" style={{ fontSize: 10.5 }}>
        {per.metCount}/{per.totalCount}
      </div>
    </div>
  )
}

function isStartedToday(startDate: string): boolean {
  if (!startDate) return false
  const d = new Date()
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return iso === startDate
}

function windowPhrase(goal: GoalWithProgress, seriesLen: number): string {
  const declared = goal.predicate.window.days
  if (seriesLen > 0 && seriesLen < declared) {
    return `since ${goal.startDate} · ${seriesLen} d`
  }
  return `last ${declared} d`
}

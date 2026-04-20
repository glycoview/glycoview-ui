import { useEffect, useState } from "react"

import type { ApiError } from "@/lib/api"

export type Aggregate =
  | "tir"
  | "time_below"
  | "time_above"
  | "gmi"
  | "ea1c"
  | "avg"
  | "cv"
  | "sd"
  | "p10"
  | "p25"
  | "p50"
  | "p75"
  | "p90"
  | "count"
  | "time_duration"

export type Operator = ">=" | "<=" | ">" | "<" | "==" | "between"

export type Daypart = "" | "night" | "morning" | "afternoon" | "evening"

export type Filter = {
  glucoseLt?: number
  glucoseGt?: number
  daypart?: Daypart
}

export type Window = {
  kind: "trailing_days"
  days: number
}

export type PerUnit = {
  kind: "day" | "week"
  requireAll: boolean
}

export type PredicateKind = "threshold" | "trend"

export type Predicate = {
  kind: PredicateKind
  aggregate: Aggregate
  args?: Record<string, number | string | boolean>
  filter?: Filter | null
  op: Operator
  value: number
  value2?: number | null
  window: Window
  perUnit?: PerUnit | null
  trendOverDays?: number
}

export type Status = "active" | "achieved" | "paused" | "archived"

export type Goal = {
  id: string
  createdBy?: string
  title: string
  predicate: Predicate
  startDate: string
  targetDate?: string
  status: Status
  rationale?: string
  actionPlan?: string
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

export type ProgressState =
  | "smashing"
  | "on_track"
  | "at_risk"
  | "behind"
  | "achieved"
  | "ongoing"

export type DailyPoint = {
  date: string
  value: number
  met: boolean
}

export type Trajectory = {
  slopePerDay: number
  projectedAtTarget?: number
  daysAheadOfSchedule?: number
}

export type PerUnitBucket = {
  label: string
  value: number
  met: boolean
}

export type PerUnitResult = {
  kind: string
  buckets: PerUnitBucket[]
  metCount: number
  totalCount: number
}

export type Progress = {
  currentValue: number
  targetValue: number
  unit: string
  met: boolean
  state: ProgressState
  narrative: string
  nudge?: string
  dailySeries: DailyPoint[]
  trajectory?: Trajectory | null
  perUnit?: PerUnitResult | null
}

export type GoalWithProgress = Goal & { progress?: Progress | null }

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" })
  if (!response.ok) {
    let message = response.statusText
    try {
      const body = await response.json()
      if (body?.message) message = body.message
    } catch {
      // ignore
    }
    throw { status: response.status, message } satisfies ApiError
  }
  return response.json() as Promise<T>
}

async function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    let message = response.statusText
    try {
      const payload = await response.json()
      if (payload?.message) message = payload.message
    } catch {
      // ignore
    }
    throw { status: response.status, message } satisfies ApiError
  }
  return response.json() as Promise<T>
}

export function listGoals(tz: string, includeArchived = false) {
  const qs = new URLSearchParams({ tz })
  if (includeArchived) qs.set("includeArchived", "true")
  return fetchJson<{ goals: GoalWithProgress[] }>(`/app/api/goals?${qs.toString()}`)
}

export function getGoal(id: string, tz: string) {
  return fetchJson<GoalWithProgress>(
    `/app/api/goals/${encodeURIComponent(id)}?tz=${encodeURIComponent(tz)}`,
  )
}

export function createGoal(input: Omit<Goal, "id" | "createdAt" | "updatedAt" | "status"> & { status?: Status }) {
  return sendJson<GoalWithProgress>("/app/api/goals", "POST", input)
}

export function updateGoal(id: string, input: Partial<Goal> & { predicate: Predicate }) {
  return sendJson<GoalWithProgress>(`/app/api/goals/${encodeURIComponent(id)}`, "PUT", input)
}

export function deleteGoal(id: string) {
  return sendJson<{ status: string }>(`/app/api/goals/${encodeURIComponent(id)}`, "DELETE", undefined)
}

export function setGoalStatus(id: string, status: Status) {
  return sendJson<GoalWithProgress>(
    `/app/api/goals/${encodeURIComponent(id)}/status`,
    "POST",
    { status },
  )
}

export function previewPredicate(predicate: Predicate, targetDate: string | undefined, tz: string) {
  return sendJson<Progress>("/app/api/goals/preview", "POST", {
    predicate,
    targetDate,
    tz,
  })
}

export function useGoals(tz: string, includeArchived = false) {
  const [data, setData] = useState<GoalWithProgress[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listGoals(tz, includeArchived)
      .then((resp) => {
        if (!cancelled) {
          setData(resp.goals ?? [])
          setLoading(false)
        }
      })
      .catch((err: ApiError) => {
        if (!cancelled) {
          setError(err)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [tz, includeArchived, nonce])

  return { data, loading, error, refresh: () => setNonce((n) => n + 1) }
}

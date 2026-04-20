/**
 * Centralised time-of-day formatting so every timestamp on the dashboard
 * renders in the user's configured timezone (persisted in localStorage
 * alongside the other display preferences).
 *
 * The default is the browser's detected timezone, which is usually what a
 * clinician sitting at the dashboard actually wants. Users can override it
 * per device (Settings → Display preferences).
 */

const STORAGE_KEY = "gv_display_prefs"

type Prefs = {
  timeZone?: string
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** The user's preferred timezone for display. `auto` returns the browser tz. */
export function userTimeZone(): string {
  if (typeof window === "undefined") return "UTC"
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Prefs
      if (parsed.timeZone && parsed.timeZone !== "auto") return parsed.timeZone
    }
  } catch {
    /* ignore */
  }
  return browserTimeZone()
}

/** Format "HH:MM" in the configured tz. */
export function formatTimeOfDay(ms: number, tz: string = userTimeZone()): string {
  if (!ms || !Number.isFinite(ms)) return "--:--"
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms))
  } catch {
    const d = new Date(ms)
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
  }
}

/** Format "2026-04-20" in the configured tz. */
export function formatDateISO(ms: number, tz: string = userTimeZone()): string {
  if (!ms || !Number.isFinite(ms)) return ""
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(ms))
    const y = parts.find((p) => p.type === "year")?.value
    const m = parts.find((p) => p.type === "month")?.value
    const d = parts.find((p) => p.type === "day")?.value
    return y && m && d ? `${y}-${m}-${d}` : ""
  } catch {
    return new Date(ms).toISOString().slice(0, 10)
  }
}

/** Format a full date-time for activity rows: "Apr 20, 17:42". */
export function formatDateTime(ms: number, tz: string = userTimeZone()): string {
  if (!ms || !Number.isFinite(ms)) return ""
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms))
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace("T", " ")
  }
}

/** Today's ISO date in the user's tz — useful for the Daily page default. */
export function todayInTz(tz: string = userTimeZone()): string {
  return formatDateISO(Date.now(), tz)
}

/**
 * Convert an absolute unix-ms timestamp into "minutes past local midnight"
 * of the user's timezone. Used to position glucose dots and event markers
 * on a 0-1440 x-axis that reads like local time.
 */
export function minutesInLocalDay(ms: number, tz: string = userTimeZone()): number {
  if (!ms || !Number.isFinite(ms)) return 0
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(ms))
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
    const s = Number(parts.find((p) => p.type === "second")?.value ?? 0)
    return h * 60 + m + s / 60
  } catch {
    const d = new Date(ms)
    return d.getUTCHours() * 60 + d.getUTCMinutes()
  }
}

/** Format "HH:MM" for a minute-of-day value (0..1440). tz-independent. */
export function formatLocalHHMM(minutesOfDay: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutesOfDay)))
  const h = Math.floor(clamped / 60) % 24
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Rough relative time like "4m" / "2h" / "3d". tz-independent. */
export function formatRelative(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return "—"
  const diff = Date.now() - ms
  const mins = Math.max(0, Math.round(diff / 60000))
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/** Short list of common timezones for the settings dropdown. */
export const COMMON_TIMEZONES: string[] = [
  "auto",
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Zurich",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Stockholm",
  "Europe/Istanbul",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
]

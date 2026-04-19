export type ChartColors = {
  ink: string
  ink3: string
  ink4: string
  line: string
  line2: string
  low: string
  vlow: string
  inR: string
  high: string
  vhigh: string
  basal: string
  bolus: string
  smb: string
  carbs: string
  bg: string
  surface: string
}

export function chartColors(): ChartColors {
  if (typeof window === "undefined") {
    return {
      ink: "#111", ink3: "#555", ink4: "#888",
      line: "#eee", line2: "#f5f5f5",
      low: "#d55", vlow: "#a22", inR: "#4a8", high: "#d93", vhigh: "#c63",
      basal: "#88a", bolus: "#445", smb: "#668", carbs: "#c83",
      bg: "#fff", surface: "#fff",
    }
  }
  const s = getComputedStyle(document.documentElement)
  const get = (k: string) => s.getPropertyValue(k).trim()
  return {
    ink: get("--ink"),
    ink3: get("--ink-3"),
    ink4: get("--ink-4"),
    line: get("--line"),
    line2: get("--line-2"),
    low: get("--st-low"),
    vlow: get("--st-vlow"),
    inR: get("--st-in"),
    high: get("--st-high"),
    vhigh: get("--st-vhigh"),
    basal: get("--basal"),
    bolus: get("--bolus"),
    smb: get("--smb"),
    carbs: get("--carbs"),
    bg: get("--bg"),
    surface: get("--surface"),
  }
}

/* Mock clinical data. Times are minutes offset from start-of-day. */

export type GluPoint = { t: number; v: number }
export type Bolus = { t: number; u: number; kind: string; note: string }
export type SMB = { t: number; u: number }
export type Carb = { t: number; g: number; note: string }
export type SMBG = { t: number; v: number }
export type BasalProfileStep = { h: number; r: number }
export type TempBasal = { start: number; end: number; rate: number; kind: "reduced" | "increased" }

export type DayData = {
  pts: GluPoint[]
  boluses: Bolus[]
  smbs: SMB[]
  carbs: Carb[]
  smbgs: SMBG[]
  basalProfile: BasalProfileStep[]
  temp: TempBasal[]
}

export type AGPBucket = {
  hour: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export type TIRBreakdown = {
  vlow: number
  low: number
  inTight: number
  inRange: number
  inWide: number
  high: number
  vhigh: number
}

export type DailySummary = {
  date: string
  dow: string
  avg: number
  tir: number
  carbs: number
  insulin: number
  lows: number
}

export type DeviceRow = {
  name: string
  kind: "CGM" | "Pump" | "Mirror" | "Bridge"
  status: string
  lastSeen: number
  battery?: number
  reservoir?: string
  signal?: string
  badge?: string
}

export type ActivityEntry = {
  t: number
  title: string
  detail: string
  kind: string
}

export type MetricsSnapshot = {
  gmi: number
  cv: number
  avg: number
  sd: number
  tir: number
  lowsPerWeek: number
  tdd: number
  ratioBasalBolus: number
}

export type UserRow = {
  id: string
  name: string
  username: string
  role: "admin" | "doctor" | "nurse"
  active: boolean
  last: string
}

export type OnboardingStep = {
  id: string
  title: string
  hint: string
}

function makeDay(): DayData {
  const pts: GluPoint[] = []
  let g = 128
  const boluses: Bolus[] = []
  const smbs: SMB[] = []
  const carbs: Carb[] = []
  const smbgs: SMBG[] = []

  const basalProfile: BasalProfileStep[] = [
    { h: 0, r: 0.80 },
    { h: 4, r: 0.65 },
    { h: 7, r: 1.05 },
    { h: 11, r: 0.90 },
    { h: 15, r: 0.95 },
    { h: 19, r: 1.00 },
    { h: 22, r: 0.80 },
  ]

  const meals = [
    { h: 7.25, g: 52, note: "Oatmeal + banana" },
    { h: 12.5, g: 68, note: "Burrito bowl" },
    { h: 15.75, g: 18, note: "Apple" },
    { h: 19.25, g: 74, note: "Pasta + salad" },
    { h: 22.0, g: 12, note: "Late snack" },
  ]

  for (let i = 0; i < 288; i++) {
    const h = (i * 5) / 60
    let target = 120
    if (h > 4 && h < 7) target += 18 * Math.sin(((h - 4) / 3) * Math.PI)
    meals.forEach((m) => {
      const dt = h - m.h
      if (dt > 0 && dt < 3) {
        target += m.g * 0.9 * Math.exp(-((dt - 0.7) ** 2) / 0.45)
      }
    })
    if (h > 21 && h < 23.5) target -= 8 * Math.sin(((h - 21) / 2) * Math.PI)
    if (h > 16.5 && h < 18) target -= 16 * Math.sin(((h - 16.5) / 1.5) * Math.PI)

    const noise = (Math.sin(i * 1.13) + Math.cos(i * 0.47) + Math.sin(i * 0.31)) * 4
    g = g * 0.7 + (target + noise) * 0.3
    if (h > 2.5 && h < 3.7) g = Math.min(g, 72 - (h - 2.5) * 6)
    if (h > 13.5 && h < 14.5) g = Math.max(g, 220)

    pts.push({ t: i * 5, v: Math.round(g) })
  }

  meals.forEach((m) => {
    boluses.push({
      t: Math.round(m.h * 60) - 5,
      u: +(m.g / 11).toFixed(1),
      kind: "meal",
      note: `${m.note} · ${m.g}g`,
    })
    carbs.push({ t: Math.round(m.h * 60), g: m.g, note: m.note })
  })

  for (let i = 0; i < 288; i++) {
    if (i % 3 === 0) {
      const v = pts[i].v
      if (v > 145 && Math.random() < 0.55) {
        smbs.push({ t: i * 5, u: +(0.1 + Math.random() * 0.35).toFixed(2) })
      } else if (v > 180) {
        smbs.push({ t: i * 5, u: +(0.2 + Math.random() * 0.45).toFixed(2) })
      }
    }
  }

  ;[
    { h: 6.3, v: 132 },
    { h: 12.1, v: 148 },
    { h: 22.5, v: 105 },
  ].forEach((s) => smbgs.push({ t: Math.round(s.h * 60), v: s.v }))

  const temp: TempBasal[] = [
    { start: 16 * 60 + 30, end: 17 * 60 + 15, rate: 0.6 * 0.95, kind: "reduced" },
    { start: 19 * 60 + 10, end: 20 * 60 + 10, rate: 1.0 * 1.3, kind: "increased" },
  ]

  return { pts, boluses, smbs, carbs, smbgs, basalProfile, temp }
}

export const DAY = makeDay()

export function tirFrom(pts: GluPoint[]): TIRBreakdown {
  const bins = { vlow: 0, low: 0, inTight: 0, inWide: 0, high: 0, vhigh: 0 }
  pts.forEach((p) => {
    const v = p.v
    if (v < 54) bins.vlow++
    else if (v < 70) bins.low++
    else if (v <= 140) {
      bins.inTight++
      bins.inWide++
    } else if (v <= 180) bins.inWide++
    else if (v <= 250) bins.high++
    else bins.vhigh++
  })
  const n = pts.length
  const pct = (k: keyof typeof bins) => Math.round((bins[k] / n) * 1000) / 10
  return {
    vlow: pct("vlow"),
    low: pct("low"),
    inTight: pct("inTight"),
    inRange: Math.round(((bins.low + bins.inWide) / n) * 1000) / 10,
    inWide: pct("inWide"),
    high: pct("high"),
    vhigh: pct("vhigh"),
  }
}

export const TIR = tirFrom(DAY.pts)

export const AGP: AGPBucket[] = (() => {
  const buckets: AGPBucket[] = []
  for (let h = 0; h < 24; h++) {
    let c = 128
    if (h > 4 && h < 7) c += 14 * Math.sin(((h - 4) / 3) * Math.PI)
    if (h > 7 && h < 10) c += 40 * Math.exp(-((h - 8.2) ** 2) / 0.6)
    if (h > 12 && h < 15) c += 55 * Math.exp(-((h - 13.2) ** 2) / 0.8)
    if (h > 19 && h < 22) c += 48 * Math.exp(-((h - 20.0) ** 2) / 0.7)
    if (h > 2 && h < 4) c -= 18
    const spread = 18 + (h > 12 && h < 16 ? 24 : 12)
    buckets.push({
      hour: h,
      p10: c - spread * 1.6,
      p25: c - spread * 0.9,
      p50: c,
      p75: c + spread * 0.9,
      p90: c + spread * 1.6,
    })
  }
  return buckets
})()

export const DAYS: DailySummary[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (13 - i))
  const avg = 128 + Math.sin(i * 0.7) * 18 + (i === 8 ? 22 : 0)
  return {
    date: d.toISOString().slice(0, 10),
    dow: d.toLocaleDateString("en-US", { weekday: "short" }),
    avg: Math.round(avg),
    tir: Math.max(40, 85 - Math.abs(avg - 130) * 0.5),
    carbs: Math.round(160 + Math.sin(i) * 30),
    insulin: +(36 + Math.cos(i * 0.5) * 6).toFixed(1),
    lows: i === 3 || i === 8 ? 2 : i === 11 ? 1 : 0,
  }
})

export const DEVICES: DeviceRow[] = [
  { name: "Dexcom G7", kind: "CGM", status: "Streaming", lastSeen: -3, battery: 82, signal: "Strong", badge: "sensor day 6/10" },
  { name: "Omnipod 5", kind: "Pump", status: "Automated", lastSeen: -1, reservoir: "122 U", badge: "pod day 2/3" },
  { name: "Apple Watch", kind: "Mirror", status: "Paired", lastSeen: -12, battery: 64 },
  { name: "Glycoview Pi", kind: "Bridge", status: "Healthy", lastSeen: 0, badge: "uptime 14d" },
]

export const ACTIVITY: ActivityEntry[] = [
  { t: -18, title: "Auto-bolus", detail: "0.35U — correction for 182 mg/dL (Omnipod 5)", kind: "insulin" },
  { t: -42, title: "Meal bolus", detail: "5.8U for 68g carbs (logged by patient)", kind: "insulin" },
  { t: -74, title: "Low alert cleared", detail: "65 mg/dL → 78 mg/dL over 18m", kind: "low" },
  { t: -210, title: "Sensor warm-up complete", detail: "Dexcom G7 paired, calibration accepted", kind: "sensor" },
  { t: -305, title: "Temp basal ended", detail: "Reduced 60% · 45m · post-exercise", kind: "basal" },
  { t: -490, title: "Sleep mode started", detail: "Target 110 mg/dL · Automation on", kind: "system" },
]

export const METRICS: MetricsSnapshot = {
  gmi: 6.7,
  cv: 27.1,
  avg: 132,
  sd: 35,
  tir: 74,
  lowsPerWeek: 2.3,
  tdd: 36.8,
  ratioBasalBolus: 48,
}

export const USERS: UserRow[] = [
  { id: "u1", name: "Alex Reyes, MD", username: "areyes", role: "admin", active: true, last: "2h ago" },
  { id: "u2", name: "Priya Nair, RN CDCES", username: "pnair", role: "doctor", active: true, last: "Yesterday" },
  { id: "u3", name: "Marcus Chen, MD", username: "mchen", role: "doctor", active: true, last: "3d ago" },
  { id: "u4", name: "Jordan Okafor, PA", username: "jokafor", role: "doctor", active: false, last: "3 weeks ago" },
]

export const ONBOARDING: OnboardingStep[] = [
  { id: "welcome", title: "Welcome", hint: "What you'll need" },
  { id: "network", title: "Network", hint: "Make your Pi reachable" },
  { id: "domain", title: "Domain & DNS", hint: "Pick a public hostname" },
  { id: "tls", title: "TLS certificate", hint: "Let's Encrypt" },
  { id: "nightscout", title: "Nightscout link", hint: "Connect data sources" },
  { id: "admin", title: "First clinician", hint: "Your account" },
  { id: "verify", title: "Go live", hint: "Verify the install" },
]

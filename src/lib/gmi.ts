/**
 * Glucose Management Indicator (GMI) — the standard CGM-derived A1c estimate.
 *
 * Source: Bergenstal et al. 2018, "Glucose Management Indicator (GMI):
 * A New Term for Estimating A1C From Continuous Glucose Monitoring".
 * Diabetes Care, doi:10.2337/dc18-1581.
 *
 *   GMI (%) = 3.31 + 0.02392 × mean_glucose_mg_dL
 *   GMI (%) = 12.71 + 4.70587 × mean_glucose_mmol_L
 */
export function gmiFromMgDl(avgMgDl: number): number {
  if (!Number.isFinite(avgMgDl) || avgMgDl <= 0) return 0
  return 3.31 + 0.02392 * avgMgDl
}

export function gmiFromMmolL(avgMmolL: number): number {
  if (!Number.isFinite(avgMmolL) || avgMmolL <= 0) return 0
  return 12.71 + 4.70587 * avgMmolL
}

export const GMI_TARGET_ADULT_T1D = 7.0

/**
 * Classic estimated A1C from average glucose (ADAG study, Nathan 2008).
 *
 *   eA1C (%) = (avg_mg_dL + 46.7) / 28.7
 *
 * GMI is the recommended CGM-era estimate (see Bergenstal 2018 above); eA1C
 * is still commonly referenced and diverges from GMI at higher averages.
 */
export function ea1cFromMgDl(avgMgDl: number): number {
  if (!Number.isFinite(avgMgDl) || avgMgDl <= 0) return 0
  return (avgMgDl + 46.7) / 28.7
}

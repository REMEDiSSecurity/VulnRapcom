const STORAGE_KEY = "vulnrap_settings";

export type SensitivityPreset = "lenient" | "balanced" | "strict";

export interface VulnRapSettings {
  slopThresholdLow: number;
  slopThresholdHigh: number;
  similarityThreshold: number;
  sensitivityPreset: SensitivityPreset;
}

const DEFAULTS: VulnRapSettings = {
  slopThresholdLow: 20,
  slopThresholdHigh: 75,
  similarityThreshold: 80,
  sensitivityPreset: "balanced",
};

export const SENSITIVITY_PRESETS: Record<SensitivityPreset, { label: string; description: string; multiplier: number }> = {
  lenient: { label: "Lenient", description: "Higher tolerance — fewer false positives", multiplier: 0.75 },
  balanced: { label: "Balanced", description: "Default calibration", multiplier: 1.0 },
  strict: { label: "Strict", description: "Lower tolerance — catches more borderline cases", multiplier: 1.25 },
};

export function adjustScore(score: number, preset: SensitivityPreset): number {
  const m = SENSITIVITY_PRESETS[preset].multiplier;
  return Math.max(0, Math.min(100, Math.round(score * m)));
}

export function adjustTier(adjustedScore: number, low: number, high: number): string {
  if (adjustedScore <= low) return "Clean";
  if (adjustedScore <= 35) return "Likely Human";
  if (adjustedScore <= 55) return "Questionable";
  if (adjustedScore <= high) return "Likely Slop";
  return "Slop";
}

export function getSettings(): VulnRapSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULTS, ...stored };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Partial<VulnRapSettings>): void {
  try {
    const current = getSettings();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...current, ...settings })
    );
  } catch {}
}

export function resetSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function getSlopTierCustom(
  score: number,
  low: number,
  high: number
): string {
  if (score <= low) return "Clean";
  if (score <= 35) return "Likely Human";
  if (score <= 55) return "Questionable";
  if (score <= high) return "Likely Slop";
  return "Slop";
}

export function getSlopColorCustom(
  score: number,
  low: number,
  high: number
): string {
  if (score <= low) return "text-green-500";
  if (score <= high) return "text-yellow-500";
  return "text-destructive";
}

export function getSlopProgressColorCustom(
  score: number,
  low: number,
  high: number
): string {
  if (score <= low) return "bg-green-500";
  if (score <= high) return "bg-yellow-500";
  return "bg-destructive";
}

export interface ReciprocityConfig {
  enabled: boolean;
  maxMultiplier: number;
  minMultiplier: number;
  warmthDropThreshold: number;
}

export const DEFAULT_RECIPROCITY_CONFIG: ReciprocityConfig = {
  enabled: false,
  maxMultiplier: 1.2,
  minMultiplier: 0.8,
  warmthDropThreshold: 15,
};

export function computeReciprocityMultiplier(
  myWarmthDelta: number,
  otherWarmthDelta: number | null,
  config: ReciprocityConfig = DEFAULT_RECIPROCITY_CONFIG,
): number {
  if (!config.enabled || otherWarmthDelta === null) return 1.0;

  if (otherWarmthDelta > 0 && myWarmthDelta > 0) {
    const boost = 1 + Math.min(otherWarmthDelta / 100, 0.2);
    return Math.min(boost, config.maxMultiplier);
  }

  if (otherWarmthDelta < -config.warmthDropThreshold) {
    if (myWarmthDelta > 0) {
      return config.minMultiplier;
    }
    if (myWarmthDelta < 0) {
      return config.maxMultiplier;
    }
  }

  return 1.0;
}

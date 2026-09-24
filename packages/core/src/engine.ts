/**
 * Compatibility engine.
 *
 * Diameter rules updated 2026-09-24:
 *   - Comparison is performed in INCH units (not mm)
 *   - Single-device comparisons at both regions: inner_od_inch <= effective_outer_id_inch
 *   - Simultaneous dual comparisons remain strict (<)
 *   - Compare proximal to proximal and distal to distal; both must pass
 *   - Margin: MARGIN_INCH = 0.001 inch subtracted from each outer regional ID
 *   - Missing regional measurements are unknown; never fall back to legacy diameters
 *   - No additional tolerance beyond the margin
 *   - Category check is performed by the engine (not the caller)
 *   - Two-device pairs are valid inputs (e.g. guiding → micro with no intermediate)
 *
 * Design constraints:
 *   - No UI strings produced here. All output is code + numeric evidence.
 *   - 'unknown' is never silently promoted to 'warning' or 'incompatible'.
 *   - notes fields are never read or interpreted.
 *   - MARGIN_INCH is a sealed constant; callers cannot override it.
 */

import type { Device, CompatibilityPair } from './types';
import { inchToMm, FR_TO_INCH } from './units';

// ============================================================================
// Public constants
// ============================================================================

/**
 * The margin applied to the outer device's inner diameter before comparison.
 * Confirmed by clinical team (2026-03-21): 0.001 inch.
 * Changing this value requires a schema version bump.
 */
export const MARGIN_INCH = 0.001 as const;

// ============================================================================
// Public types
// ============================================================================

export type CheckStatus = 'ok' | 'warning' | 'incompatible' | 'unknown';
export type DiameterRegion = 'proximal' | 'distal';

/**
 * Stable string codes — safe to switch on in UI and tests.
 * Changing the meaning of a code requires bumping the engine's schema_version.
 */
export type ReasonCode =
  // --- Diameter (1-in-1) ---
  /** Regional inner OD ≤ regional outer ID − MARGIN_INCH. */
  | 'DIAMETER_OK'
  /** Regional inner OD > regional outer ID − MARGIN_INCH. */
  | 'DIAMETER_INCOMPATIBLE'
  /** A required regional diameter is absent / not a positive finite number. */
  | 'DIAMETER_UNKNOWN'
  // --- Diameter (2-in-1) ---
  /**
   * combined_od_inch > MARGIN_INCH below effective outer ID.
   * Both inners fit with adequate clearance.
   */
  | 'DIAMETER_DUAL_OK'
  /**
   * 0 < clearance_inch ≤ MARGIN_INCH.
   * Both inners fit, but clearance is very tight (within the warning margin).
   */
  | 'DIAMETER_DUAL_WARNING'
  /**
   * combined_od_inch ≥ effective outer ID — the two inners cannot both pass through outer.
   */
  | 'DIAMETER_DUAL_INCOMPATIBLE'
  /**
   * A required regional diameter is absent / not a positive finite number.
   */
  | 'DIAMETER_DUAL_UNKNOWN'
  // --- Category ---
  /** inner is exactly one level deeper in the hierarchy than outer */
  | 'CATEGORY_ADJACENT'
  /** inner is ≥2 levels deeper — non-adjacent skip (e.g. guiding → micro) */
  | 'CATEGORY_SKIP'
  /** inner is shallower than outer — nesting order is reversed */
  | 'CATEGORY_REVERSED'
  /** inner and outer share the same category level */
  | 'CATEGORY_SAME'
  /** category string not found in the known hierarchy (should not occur with validated data) */
  | 'CATEGORY_UNKNOWN'
  // --- Length ---
  /** inner.length_cm >= outer.length_cm — inner can reach at least as deep */
  | 'LENGTH_SUFFICIENT'
  /** inner.length_cm < outer.length_cm — inner cannot reach beyond outer tip (incompatible) */
  | 'LENGTH_INSUFFICIENT'
  /** outer.length_cm or inner.length_cm is absent / not a positive finite number */
  | 'LENGTH_UNKNOWN';

/**
 * Result of a single check (diameter, category, or length).
 */
export interface CheckOutcome {
  check: 'diameter' | 'diameter_dual' | 'category' | 'length';
  /** Present on diameter checks; identifies the measurements being compared. */
  region?: DiameterRegion;
  status: CheckStatus;
  code: ReasonCode;
  /**
   * Numeric values that produced this outcome, in the units described by each key.
   * null means the value was absent or unusable for this check.
   */
  evidence: Record<string, number | null>;
}

/**
 * Pre-computed values derived from the two devices.
 * null means a required source field was absent.
 */
export interface RegionalDiameterMetrics {
  outer_id_inch: number | null;
  // --- Inch-based: the values used for the actual comparison ---
  /** Inner device's OD at this region, in inches. */
  inner_od_inch: number | null;
  /** Regional outer ID − MARGIN_INCH (0.001). */
  effective_outer_id_inch: number | null;
  /**
   * effective_outer_id_inch − inner_od_inch (inch).
   * Positive = clearance; negative = obstruction.
   * null if either value is missing.
   */
  clearance_inch: number | null;
  // --- mm: reference values for display ---
  /** Regional outer ID × 25.4 (mm). */
  outer_id_mm: number | null;
  /** Regional inner OD × 25.4 (mm). */
  inner_od_mm: number | null;
  /**
   * Regional margin-adjusted clearance × 25.4 (mm).
   * Reflects the margin-adjusted clearance in mm.
   * null if either diameter is missing.
   */
  clearance_mm: number | null;
}

/**
 * Flat diameter metrics describe the region with the smaller clearance.
 * They are null if either region cannot be evaluated; per-region values remain available.
 */
export interface DerivedMetrics extends RegionalDiameterMetrics {
  proximal: RegionalDiameterMetrics;
  distal: RegionalDiameterMetrics;
  limiting_region: DiameterRegion | null;
  // --- Other ---
  /**
   * inner.length_cm − outer.length_cm (cm).
   * Positive = inner extends beyond outer tip.
   * null if either length is missing.
   */
  length_delta_cm: number | null;
  /**
   * inner_category_level − outer_category_level.
   * +1 = adjacent (standard), +2 = skip, 0 = same, negative = reversed.
   * null if either category is unrecognised.
   */
  category_delta: number | null;
}

/**
 * Records which source fields were present (positive finite number) at check time.
 * Only tracks fields that are actually consumed by one of the three checks.
 */
export interface EvidenceState {
  outer_proximal_id_inch: 'present' | 'missing';
  outer_distal_id_inch: 'present' | 'missing';
  inner_proximal_od_inch: 'present' | 'missing';
  inner_distal_od_inch: 'present' | 'missing';
  /** outer.length_cm — used for length check */
  outer_length_cm: 'present' | 'missing';
  /** inner.length_cm — used for length check */
  inner_length_cm: 'present' | 'missing';
}

/**
 * Full result of a compatibility check between one outer and one inner device.
 */
export interface CompatibilityResult {
  /**
   * true  — status is 'ok' or 'warning' (inner can physically pass through outer)
   * false — status is 'incompatible' (blocked by diameter, category or length)
   * null  — status is 'unknown' (missing data prevents determination)
   *
   * true does NOT mean "clinically recommended".
   */
  compatible: boolean | null;

  /**
   * Aggregate status across all checks.
   * Priority (highest wins): incompatible > unknown > warning > ok
   */
  status: CheckStatus;

  /** Four outcomes: category, proximal diameter, distal diameter, length. */
  reasons: CheckOutcome[];

  /**
   * Subset of reasons where status === 'warning'.
   * Provided for convenience — identical objects to the entries in reasons.
   */
  warnings: CheckOutcome[];

  derived_metrics: DerivedMetrics;
  evidence_state: EvidenceState;
}

// ============================================================================
// Internal helpers
// ============================================================================

/** Category nesting levels. Higher index = deeper nesting (more distal). */
const CATEGORY_LEVEL: Readonly<Record<string, number>> = {
  ガイディング: 0,
  中間: 1,
  マイクロ: 2,
};

const STATUS_PRIORITY: Readonly<Record<CheckStatus, number>> = {
  ok: 0,
  warning: 1,
  unknown: 2,
  incompatible: 3,
};

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && isFinite(n) && n > 0;
}

function aggregateStatus(outcomes: CheckOutcome[]): CheckStatus {
  return outcomes.reduce<CheckStatus>((worst, o) => {
    return STATUS_PRIORITY[o.status] > STATUS_PRIORITY[worst] ? o.status : worst;
  }, 'ok');
}

function statusToCompatible(status: CheckStatus): boolean | null {
  if (status === 'ok' || status === 'warning') return true;
  if (status === 'incompatible') return false;
  return null; // 'unknown'
}

// ============================================================================
// Individual checks
// ============================================================================

function diameterMetrics(outerId: unknown, innerOd: unknown): RegionalDiameterMetrics {
  const outer_id_inch = isPositiveFinite(outerId) ? outerId : null;
  const inner_od_inch = isPositiveFinite(innerOd) ? innerOd : null;
  const effective_outer_id_inch = outer_id_inch === null ? null : outer_id_inch - MARGIN_INCH;
  const clearance_inch = effective_outer_id_inch !== null && inner_od_inch !== null
    ? effective_outer_id_inch - inner_od_inch : null;
  return {
    outer_id_inch,
    inner_od_inch,
    effective_outer_id_inch,
    clearance_inch,
    outer_id_mm: outer_id_inch === null ? null : inchToMm(outer_id_inch),
    inner_od_mm: inner_od_inch === null ? null : inchToMm(inner_od_inch),
    clearance_mm: clearance_inch === null ? null : inchToMm(clearance_inch),
  };
}

/** Subtract the input decimal values exactly before converting back to a number.
 * This keeps e.g. 0.030 − 0.001 − 0.029 equal to zero without adding a tolerance.
 */
function decimalDifference(...values: number[]): number {
  const terms = values.map((value) => {
    const [coefficient = '0', exponent = '0'] = value.toString().split('e');
    const [integer = '0', fraction = ''] = coefficient.split('.');
    return { digits: integer + fraction, scale: fraction.length - Number(exponent) };
  });
  const scale = Math.max(...terms.map((term) => term.scale));
  const difference = terms.reduce((total, term, index) => {
    const scaled = BigInt(term.digits + '0'.repeat(scale - term.scale));
    return index === 0 ? scaled : total - scaled;
  }, BigInt(0));
  return Number(`${difference}e${-scale}`);
}

/** Exact decimal arithmetic for the inclusive single-device regional boundaries. */
function singleDiameterMetrics(outerId: unknown, innerOd: unknown): RegionalDiameterMetrics {
  const metrics = diameterMetrics(outerId, innerOd);
  if (metrics.outer_id_inch === null) return metrics;
  metrics.effective_outer_id_inch = decimalDifference(metrics.outer_id_inch, MARGIN_INCH);
  if (metrics.inner_od_inch !== null) {
    metrics.clearance_inch = decimalDifference(metrics.outer_id_inch, MARGIN_INCH, metrics.inner_od_inch);
    metrics.clearance_mm = inchToMm(metrics.clearance_inch);
  }
  return metrics;
}

function limitingRegion(
  proximal: { clearance_inch: number | null },
  distal: { clearance_inch: number | null },
): DiameterRegion | null {
  if (proximal.clearance_inch === null || distal.clearance_inch === null) return null;
  return proximal.clearance_inch <= distal.clearance_inch ? 'proximal' : 'distal';
}

function runDiameterCheck(region: DiameterRegion, metrics: RegionalDiameterMetrics): CheckOutcome {
  const clearance = metrics.clearance_inch;
  const status = clearance === null ? 'unknown' : clearance >= 0 ? 'ok' : 'incompatible';

  return {
    check: 'diameter',
    region,
    status,
    code: status === 'unknown' ? 'DIAMETER_UNKNOWN'
      : status === 'ok' ? 'DIAMETER_OK' : 'DIAMETER_INCOMPATIBLE',
    evidence: { ...metrics },
  };
}

function runCategoryCheck(outer: Device, inner: Device): CheckOutcome {
  const outerLevel = CATEGORY_LEVEL[outer.category];
  const innerLevel = CATEGORY_LEVEL[inner.category];

  if (outerLevel === undefined || innerLevel === undefined) {
    return {
      check: 'category',
      status: 'unknown',
      code: 'CATEGORY_UNKNOWN',
      evidence: {
        outer_level: outerLevel ?? null,
        inner_level: innerLevel ?? null,
        delta: null,
      },
    };
  }

  const delta = innerLevel - outerLevel;

  if (delta === 0) {
    return {
      check: 'category',
      status: 'incompatible',
      code: 'CATEGORY_SAME',
      evidence: { outer_level: outerLevel, inner_level: innerLevel, delta },
    };
  }

  if (delta < 0) {
    return {
      check: 'category',
      status: 'incompatible',
      code: 'CATEGORY_REVERSED',
      evidence: { outer_level: outerLevel, inner_level: innerLevel, delta },
    };
  }

  if (delta === 1) {
    return {
      check: 'category',
      status: 'ok',
      code: 'CATEGORY_ADJACENT',
      evidence: { outer_level: outerLevel, inner_level: innerLevel, delta },
    };
  }

  // delta > 1: non-adjacent skip (e.g. guiding → micro) — clinically normal, not a warning
  return {
    check: 'category',
    status: 'ok',
    code: 'CATEGORY_SKIP',
    evidence: { outer_level: outerLevel, inner_level: innerLevel, delta },
  };
}

function runLengthCheck(outer: Device, inner: Device): CheckOutcome {
  const outerPresent = isPositiveFinite(outer.length_cm);
  const innerPresent = isPositiveFinite(inner.length_cm);

  if (!outerPresent || !innerPresent) {
    return {
      check: 'length',
      status: 'unknown',
      code: 'LENGTH_UNKNOWN',
      evidence: {
        outer_length_cm: outerPresent ? outer.length_cm : null,
        inner_length_cm: innerPresent ? inner.length_cm : null,
        delta_cm: null,
      },
    };
  }

  const delta = inner.length_cm - outer.length_cm;

  return {
    check: 'length',
    status: delta >= 0 ? 'ok' : 'incompatible',
    code: delta >= 0 ? 'LENGTH_SUFFICIENT' : 'LENGTH_INSUFFICIENT',
    evidence: {
      outer_length_cm: outer.length_cm,
      inner_length_cm: inner.length_cm,
      delta_cm: delta,
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check whether `pair.inner` can physically pass through `pair.outer`.
 *
 * Performs three independent checks and aggregates:
 *   1. Category check (adjacency / ordering)
 *   2. Diameter checks — proximal/proximal and distal/distal, each with MARGIN_INCH
 *   3. Length check (inner length vs outer length)
 *
 * Status priority: incompatible > unknown > warning > ok
 */
export function checkCompatibility(pair: CompatibilityPair): CompatibilityResult {
  const { outer, inner } = pair;

  const proximal = singleDiameterMetrics(outer.proximal_id_inch, inner.proximal_od_inch);
  const distal = singleDiameterMetrics(outer.distal_id_inch, inner.distal_od_inch);
  const categoryOutcome = runCategoryCheck(outer, inner);
  const lengthOutcome = runLengthCheck(outer, inner);

  const reasons: CheckOutcome[] = [
    categoryOutcome,
    runDiameterCheck('proximal', proximal),
    runDiameterCheck('distal', distal),
    lengthOutcome,
  ];
  const status = aggregateStatus(reasons);
  const warnings = reasons.filter((r) => r.status === 'warning');

  const outerLevel = CATEGORY_LEVEL[outer.category] ?? null;
  const innerLevel = CATEGORY_LEVEL[inner.category] ?? null;
  const limiting_region = limitingRegion(proximal, distal);
  const summary = limiting_region === null
    ? diameterMetrics(null, null) : { proximal, distal }[limiting_region];

  const derived_metrics: DerivedMetrics = {
    ...summary,
    proximal,
    distal,
    limiting_region,
    // Other
    length_delta_cm:
      isPositiveFinite(outer.length_cm) && isPositiveFinite(inner.length_cm)
        ? inner.length_cm - outer.length_cm
        : null,
    category_delta:
      outerLevel !== null && innerLevel !== null ? innerLevel - outerLevel : null,
  };

  const evidence_state: EvidenceState = {
    outer_proximal_id_inch: isPositiveFinite(outer.proximal_id_inch) ? 'present' : 'missing',
    outer_distal_id_inch: isPositiveFinite(outer.distal_id_inch) ? 'present' : 'missing',
    inner_proximal_od_inch: isPositiveFinite(inner.proximal_od_inch) ? 'present' : 'missing',
    inner_distal_od_inch: isPositiveFinite(inner.distal_od_inch) ? 'present' : 'missing',
    outer_length_cm: isPositiveFinite(outer.length_cm) ? 'present' : 'missing',
    inner_length_cm: isPositiveFinite(inner.length_cm) ? 'present' : 'missing',
  };

  return {
    compatible: statusToCompatible(status),
    status,
    reasons,
    warnings,
    derived_metrics,
    evidence_state,
  };
}

/**
 * Check a three-device combination in the standard nesting order:
 *   guiding (outermost) → intermediate → micro (innermost)
 *
 * Returns two independent CompatibilityResults:
 *   [0] guiding → intermediate
 *   [1] intermediate → micro
 *
 * The caller is responsible for aggregating the two results if a single
 * three-way status is needed.
 */
export function checkThreeWay(devices: {
  guiding: Device;
  intermediate: Device;
  micro: Device;
}): [CompatibilityResult, CompatibilityResult] {
  return [
    checkCompatibility({ outer: devices.guiding, inner: devices.intermediate }),
    checkCompatibility({ outer: devices.intermediate, inner: devices.micro }),
  ];
}

// ============================================================================
// Dual (2-in-1) compatibility
// ============================================================================

/**
 * Pre-computed values for a 2-in-1 check.
 * All inch values are used for the actual comparison; mm values are for display.
 */
export interface RegionalDualDiameterMetrics {
  outer_id_inch: number | null;
  // --- Inch (comparison values) ---
  inner1_od_inch: number | null;
  inner2_od_inch: number | null;
  /** inner1_od_inch + inner2_od_inch */
  combined_od_inch: number | null;
  /** Regional outer ID − MARGIN_INCH */
  effective_outer_id_inch: number | null;
  /**
   * effective_outer_id_inch − combined_od_inch.
   * Positive = clearance; negative = obstruction.
   */
  clearance_inch: number | null;
  // --- mm (display reference) ---
  outer_id_mm: number | null;
  inner1_od_mm: number | null;
  inner2_od_mm: number | null;
  combined_od_mm: number | null;
  clearance_mm: number | null;
}

/** Flat diameter metrics use the smaller-clearance region, or null if either is unknown. */
export interface DualDerivedMetrics extends RegionalDualDiameterMetrics {
  proximal: RegionalDualDiameterMetrics;
  distal: RegionalDualDiameterMetrics;
  limiting_region: DiameterRegion | null;
}

/** Records which source fields were present at dual check time. */
export interface DualEvidenceState {
  outer_proximal_id_inch: 'present' | 'missing';
  outer_distal_id_inch: 'present' | 'missing';
  inner1_proximal_od_inch: 'present' | 'missing';
  inner1_distal_od_inch: 'present' | 'missing';
  inner2_proximal_od_inch: 'present' | 'missing';
  inner2_distal_od_inch: 'present' | 'missing';
}

/**
 * Full result of a 2-in-1 compatibility check (one outer, two inner devices).
 *
 * Two regional diameter checks are performed — no category or length checks.
 * Category constraints for 2-in-1 are enforced by the UI (caller), not this function.
 */
export interface DualCompatibilityResult {
  /**
   * true  — both inner devices fit simultaneously (ok or warning)
   * false — combined OD exceeds the effective outer ID (incompatible)
   * null  — status is 'unknown' (missing data)
   */
  compatible: boolean | null;
  /** Aggregate status. */
  status: CheckStatus;
  /** Two diameter_dual outcomes, one per region. */
  reasons: CheckOutcome[];
  /** Subset of reasons where status === 'warning'. */
  warnings: CheckOutcome[];
  derived_metrics: DualDerivedMetrics;
  evidence_state: DualEvidenceState;
}

/**
 * Check whether `inner1` and `inner2` can both pass through `outer` simultaneously.
 *
 * Geometric model: two circular cross-sections of diameter d₁ and d₂ packed
 * side-by-side inside a circle of diameter D. The minimum required inner diameter
 * is d₁ + d₂ (exact result for 2-circle packing in a circle).
 *
 * Rules (confirmed by clinical team 2026-03-22):
 *   - Compare proximal to proximal and distal to distal; both must pass
 *   - Margin: MARGIN_INCH (0.001) subtracted from each regional outer ID
 *   - Comparison: strict — clearance_inch must be > 0
 *   - Warning zone: 0 < clearance_inch ≤ MARGIN_INCH
 *   - Same device twice (inner1 === inner2 by reference or same values): allowed
 *   - No category or length checks — caller is responsible for those constraints
 */
export function checkDualCompatibility(pair: {
  outer: Device;
  inner1: Device;
  inner2: Device;
}): DualCompatibilityResult {
  const { outer, inner1, inner2 } = pair;

  const proximal = dualDiameterMetrics(outer.proximal_id_inch, inner1.proximal_od_inch, inner2.proximal_od_inch);
  const distal = dualDiameterMetrics(outer.distal_id_inch, inner1.distal_od_inch, inner2.distal_od_inch);
  const reasons = [runDualDiameterCheck('proximal', proximal), runDualDiameterCheck('distal', distal)];
  const status = aggregateStatus(reasons);
  const limiting_region = limitingRegion(proximal, distal);
  const summary = limiting_region === null
    ? dualDiameterMetrics(null, null, null) : { proximal, distal }[limiting_region];

  const evidence_state: DualEvidenceState = {
    outer_proximal_id_inch: isPositiveFinite(outer.proximal_id_inch) ? 'present' : 'missing',
    outer_distal_id_inch: isPositiveFinite(outer.distal_id_inch) ? 'present' : 'missing',
    inner1_proximal_od_inch: isPositiveFinite(inner1.proximal_od_inch) ? 'present' : 'missing',
    inner1_distal_od_inch: isPositiveFinite(inner1.distal_od_inch) ? 'present' : 'missing',
    inner2_proximal_od_inch: isPositiveFinite(inner2.proximal_od_inch) ? 'present' : 'missing',
    inner2_distal_od_inch: isPositiveFinite(inner2.distal_od_inch) ? 'present' : 'missing',
  };

  return {
    compatible: statusToCompatible(status),
    status,
    reasons,
    warnings: reasons.filter((reason) => reason.status === 'warning'),
    derived_metrics: { ...summary, proximal, distal, limiting_region },
    evidence_state,
  };
}

function dualDiameterMetrics(outerId: unknown, inner1Od: unknown, inner2Od: unknown): RegionalDualDiameterMetrics {
  const inner1_od_inch = isPositiveFinite(inner1Od) ? inner1Od : null;
  const inner2_od_inch = isPositiveFinite(inner2Od) ? inner2Od : null;
  const combined_od_inch = inner1_od_inch !== null && inner2_od_inch !== null
    ? inner1_od_inch + inner2_od_inch : null;
  const metrics = diameterMetrics(outerId, combined_od_inch);
  return {
    outer_id_inch: metrics.outer_id_inch,
    inner1_od_inch,
    inner2_od_inch,
    combined_od_inch,
    effective_outer_id_inch: metrics.effective_outer_id_inch,
    clearance_inch: metrics.clearance_inch,
    outer_id_mm: metrics.outer_id_mm,
    inner1_od_mm: inner1_od_inch === null ? null : inchToMm(inner1_od_inch),
    inner2_od_mm: inner2_od_inch === null ? null : inchToMm(inner2_od_inch),
    combined_od_mm: metrics.inner_od_mm,
    clearance_mm: metrics.clearance_mm,
  };
}

function runDualDiameterCheck(region: DiameterRegion, metrics: RegionalDualDiameterMetrics): CheckOutcome {
  const clearance_inch = metrics.clearance_inch;
  let status: CheckStatus;
  let code: ReasonCode;
  if (clearance_inch === null) {
    status = 'unknown';
    code = 'DIAMETER_DUAL_UNKNOWN';
  } else if (clearance_inch <= 0) {
    status = 'incompatible';
    code = 'DIAMETER_DUAL_INCOMPATIBLE';
  } else if (clearance_inch <= MARGIN_INCH) {
    status = 'warning';
    code = 'DIAMETER_DUAL_WARNING';
  } else {
    status = 'ok';
    code = 'DIAMETER_DUAL_OK';
  }

  return {
    check: 'diameter_dual',
    region,
    status,
    code,
    evidence: { ...metrics },
  };
}

// Re-export for convenience — callers that import from engine don't need a separate units import.
export { FR_TO_INCH };

/**
 * Compatibility engine.
 *
 * Confirmed decisions (Phase 1, updated 2026-03-21):
 *   - Comparison is performed in INCH units (not mm)
 *   - Inequality is strict: inner_od_inch < effective_outer_id_inch
 *   - Margin: MARGIN_INCH = 0.001 inch subtracted from outer.id_inch before comparison
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
import { inchToMm, frToMm, frToInch, FR_TO_INCH } from './units';

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

/**
 * Stable string codes — safe to switch on in UI and tests.
 * Changing the meaning of a code requires bumping the engine's schema_version.
 */
export type ReasonCode =
  // --- Diameter (1-in-1) ---
  /** inner_od_inch < outer.id_inch − MARGIN_INCH (strict) */
  | 'DIAMETER_OK'
  /** inner_od_inch ≥ outer.id_inch − MARGIN_INCH — inner cannot pass through outer */
  | 'DIAMETER_INCOMPATIBLE'
  /** outer.id_inch or inner.od_fr is absent / not a positive finite number */
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
   * outer.id_inch or one/both inner.od_fr values are absent / not a positive finite number.
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
export interface DerivedMetrics {
  // --- Inch-based: the values used for the actual comparison ---
  /** inner.od_fr × (1/76.2) — null if inner.od_fr is missing */
  inner_od_inch: number | null;
  /** outer.id_inch − MARGIN_INCH (0.001) — null if outer.id_inch is missing */
  effective_outer_id_inch: number | null;
  /**
   * effective_outer_id_inch − inner_od_inch (inch).
   * Positive = clearance; negative = obstruction.
   * null if either value is missing.
   */
  clearance_inch: number | null;
  // --- mm: reference values for display ---
  /** outer.id_inch × 25.4 (mm). null if outer.id_inch is missing. */
  outer_id_mm: number | null;
  /** inner.od_fr × (1/3) (mm). null if inner.od_fr is missing. */
  inner_od_mm: number | null;
  /**
   * (outer.id_inch − MARGIN_INCH) × 25.4 − inner_od_mm (mm).
   * Reflects the margin-adjusted clearance in mm.
   * null if either diameter is missing.
   */
  clearance_mm: number | null;
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
  /** outer.id_inch — used for diameter check */
  outer_id_inch: 'present' | 'missing';
  /** inner.od_fr — used for diameter check */
  inner_od_fr: 'present' | 'missing';
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
   * false — status is 'incompatible' (blocked by diameter or category)
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

  /** One CheckOutcome per check performed (category, diameter, length). */
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

function runDiameterCheck(outer: Device, inner: Device): CheckOutcome {
  const outerPresent = isPositiveFinite(outer.id_inch);
  const innerPresent = isPositiveFinite(inner.od_fr);

  if (!outerPresent || !innerPresent) {
    return {
      check: 'diameter',
      status: 'unknown',
      code: 'DIAMETER_UNKNOWN',
      evidence: {
        outer_id_inch: outerPresent ? outer.id_inch : null,
        inner_od_fr: innerPresent ? inner.od_fr : null,
        inner_od_inch: null,
        effective_outer_id_inch: null,
        clearance_inch: null,
      },
    };
  }

  // Comparison is performed in inch units (confirmed 2026-03-21).
  const inner_od_inch = frToInch(inner.od_fr); // inner.od_fr / 76.2
  const effective_outer_id_inch = outer.id_inch - MARGIN_INCH;

  // Strict less-than (confirmed). Equal values count as INCOMPATIBLE.
  const fits = inner_od_inch < effective_outer_id_inch;

  return {
    check: 'diameter',
    status: fits ? 'ok' : 'incompatible',
    code: fits ? 'DIAMETER_OK' : 'DIAMETER_INCOMPATIBLE',
    evidence: {
      outer_id_inch: outer.id_inch,
      inner_od_fr: inner.od_fr,
      inner_od_inch,
      effective_outer_id_inch,
      clearance_inch: effective_outer_id_inch - inner_od_inch,
    },
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
 *   2. Diameter check — inch-based, with MARGIN_INCH applied to outer's effective ID
 *   3. Length check (inner length vs outer length)
 *
 * Status priority: incompatible > unknown > warning > ok
 */
export function checkCompatibility(pair: CompatibilityPair): CompatibilityResult {
  const { outer, inner } = pair;

  const categoryOutcome = runCategoryCheck(outer, inner);
  const diameterOutcome = runDiameterCheck(outer, inner);
  const lengthOutcome = runLengthCheck(outer, inner);

  const reasons: CheckOutcome[] = [categoryOutcome, diameterOutcome, lengthOutcome];
  const status = aggregateStatus(reasons);
  const warnings = reasons.filter((r) => r.status === 'warning');

  // Pre-compute field availability
  const outerIdPresent = isPositiveFinite(outer.id_inch);
  const innerOdPresent = isPositiveFinite(inner.od_fr);
  const outerLevel = CATEGORY_LEVEL[outer.category] ?? null;
  const innerLevel = CATEGORY_LEVEL[inner.category] ?? null;

  // Inch-based values (used in the comparison)
  const inner_od_inch = innerOdPresent ? frToInch(inner.od_fr) : null;
  const effective_outer_id_inch = outerIdPresent ? outer.id_inch - MARGIN_INCH : null;

  // mm values (for display reference)
  const outer_id_mm = outerIdPresent ? inchToMm(outer.id_inch) : null;
  const inner_od_mm = innerOdPresent ? frToMm(inner.od_fr) : null;

  const derived_metrics: DerivedMetrics = {
    // Inch (comparison values)
    inner_od_inch,
    effective_outer_id_inch,
    clearance_inch:
      inner_od_inch !== null && effective_outer_id_inch !== null
        ? effective_outer_id_inch - inner_od_inch
        : null,
    // mm (display reference)
    outer_id_mm,
    inner_od_mm,
    clearance_mm:
      effective_outer_id_inch !== null && inner_od_mm !== null
        ? inchToMm(effective_outer_id_inch) - inner_od_mm
        : null,
    // Other
    length_delta_cm:
      isPositiveFinite(outer.length_cm) && isPositiveFinite(inner.length_cm)
        ? inner.length_cm - outer.length_cm
        : null,
    category_delta:
      outerLevel !== null && innerLevel !== null ? innerLevel - outerLevel : null,
  };

  const evidence_state: EvidenceState = {
    outer_id_inch: outerIdPresent ? 'present' : 'missing',
    inner_od_fr: innerOdPresent ? 'present' : 'missing',
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
export interface DualDerivedMetrics {
  // --- Inch (comparison values) ---
  inner1_od_inch: number | null;
  inner2_od_inch: number | null;
  /** inner1_od_inch + inner2_od_inch */
  combined_od_inch: number | null;
  /** outer.id_inch − MARGIN_INCH */
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

/** Records which source fields were present at dual check time. */
export interface DualEvidenceState {
  outer_id_inch: 'present' | 'missing';
  inner1_od_fr: 'present' | 'missing';
  inner2_od_fr: 'present' | 'missing';
}

/**
 * Full result of a 2-in-1 compatibility check (one outer, two inner devices).
 *
 * Only a single diameter check is performed — no category or length checks.
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
  /** Single-element array containing the diameter_dual CheckOutcome. */
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
 *   - Margin: MARGIN_INCH (0.001) subtracted from outer.id_inch (same as 1-in-1)
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

  const outerPresent = isPositiveFinite(outer.id_inch);
  const inner1Present = isPositiveFinite(inner1.od_fr);
  const inner2Present = isPositiveFinite(inner2.od_fr);

  const evidence_state: DualEvidenceState = {
    outer_id_inch: outerPresent ? 'present' : 'missing',
    inner1_od_fr: inner1Present ? 'present' : 'missing',
    inner2_od_fr: inner2Present ? 'present' : 'missing',
  };

  if (!outerPresent || !inner1Present || !inner2Present) {
    const outcome: CheckOutcome = {
      check: 'diameter_dual',
      status: 'unknown',
      code: 'DIAMETER_DUAL_UNKNOWN',
      evidence: {
        outer_id_inch: outerPresent ? outer.id_inch : null,
        inner1_od_fr: inner1Present ? inner1.od_fr : null,
        inner2_od_fr: inner2Present ? inner2.od_fr : null,
        combined_od_inch: null,
        effective_outer_id_inch: null,
        clearance_inch: null,
      },
    };
    return {
      compatible: null,
      status: 'unknown',
      reasons: [outcome],
      warnings: [],
      derived_metrics: {
        inner1_od_inch: null,
        inner2_od_inch: null,
        combined_od_inch: null,
        effective_outer_id_inch: null,
        clearance_inch: null,
        outer_id_mm: null,
        inner1_od_mm: null,
        inner2_od_mm: null,
        combined_od_mm: null,
        clearance_mm: null,
      },
      evidence_state,
    };
  }

  const inner1_od_inch = frToInch(inner1.od_fr);
  const inner2_od_inch = frToInch(inner2.od_fr);
  const combined_od_inch = inner1_od_inch + inner2_od_inch;
  const effective_outer_id_inch = outer.id_inch - MARGIN_INCH;
  const clearance_inch = effective_outer_id_inch - combined_od_inch;

  // Status determination:
  //   clearance_inch ≤ 0              → incompatible
  //   0 < clearance_inch ≤ MARGIN_INCH → warning (tight fit)
  //   clearance_inch > MARGIN_INCH     → ok
  let status: CheckStatus;
  let code: ReasonCode;
  if (clearance_inch <= 0) {
    status = 'incompatible';
    code = 'DIAMETER_DUAL_INCOMPATIBLE';
  } else if (clearance_inch <= MARGIN_INCH) {
    status = 'warning';
    code = 'DIAMETER_DUAL_WARNING';
  } else {
    status = 'ok';
    code = 'DIAMETER_DUAL_OK';
  }

  const outcome: CheckOutcome = {
    check: 'diameter_dual',
    status,
    code,
    evidence: {
      outer_id_inch: outer.id_inch,
      inner1_od_fr: inner1.od_fr,
      inner2_od_fr: inner2.od_fr,
      inner1_od_inch,
      inner2_od_inch,
      combined_od_inch,
      effective_outer_id_inch,
      clearance_inch,
    },
  };

  const inner1_od_mm = frToMm(inner1.od_fr);
  const inner2_od_mm = frToMm(inner2.od_fr);

  const derived_metrics: DualDerivedMetrics = {
    inner1_od_inch,
    inner2_od_inch,
    combined_od_inch,
    effective_outer_id_inch,
    clearance_inch,
    outer_id_mm: inchToMm(outer.id_inch),
    inner1_od_mm,
    inner2_od_mm,
    combined_od_mm: inner1_od_mm + inner2_od_mm,
    clearance_mm: inchToMm(effective_outer_id_inch) - (inner1_od_mm + inner2_od_mm),
  };

  return {
    compatible: statusToCompatible(status),
    status,
    reasons: [outcome],
    warnings: status === 'warning' ? [outcome] : [],
    derived_metrics,
    evidence_state,
  };
}

// Re-export for convenience — callers that import from engine don't need a separate units import.
export { FR_TO_INCH };

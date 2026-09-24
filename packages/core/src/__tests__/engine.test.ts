import { describe, it, expect } from 'vitest';
import { checkCompatibility, checkThreeWay } from '../engine';
import type { Device } from '../types';
import { inchToMm, frToMm, frToInch } from '../units';

// ============================================================================
// Device factories
// ============================================================================

function makeDevice(overrides: Partial<Device> & { category: Device['category'] }): Device {
  const base = {
    id: 'test-device',
    name: 'Test Device',
    maker: 'Test Maker',
    id_inch: 0.071,
    od_fr: 6,
    length_cm: 90,
    notes: '',
    ...overrides,
  };
  // Synthetic uniform-end fixtures preserve the original regression cases.
  // This is test setup only, not a fallback or a claim about real regional measurements.
  return {
    ...base,
    proximal_id_inch: base.id_inch,
    distal_id_inch: base.id_inch,
    proximal_od_inch: frToInch(base.od_fr),
    distal_od_inch: frToInch(base.od_fr),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Synthetic uniform-end fixtures based on historical CSV values
// ---------------------------------------------------------------------------

/** 6F Roadmaster — outer catheter in many test pairs */
const guiding6F = makeDevice({
  id: '6f-roadmaster-90cm',
  name: '6F Roadmaster (90 cm)',
  category: 'ガイディング',
  maker: 'Nipro',
  id_inch: 0.071, // ID = 1.8034 mm
  od_fr: 6,
  length_cm: 90,
});

/** Navien058 — intermediate, fits inside guiding6F */
const intermediate = makeDevice({
  id: 'navien058-115cm',
  name: 'Navien058 (115 cm)',
  category: '中間',
  maker: 'Medtronic',
  id_inch: 0.058, // ID = 1.4732 mm
  od_fr: 5.4,     // OD = 1.8000 mm  → 1.8000 < 1.8034 → OK (barely)
  length_cm: 115,
});

/**
 * 8F guiding catheter — outer in "diameter ok" tests.
 * inner_od_inch = 6.5/76.2 = 0.08530 < effective 0.09−0.001 = 0.089 → DIAMETER_OK
 */
const guiding8F = makeDevice({
  id: '8f-guiding-90cm',
  name: '8F Guiding (90 cm)',
  category: 'ガイディング',
  maker: 'Test',
  id_inch: 0.09,
  od_fr: 8,
  length_cm: 90,
});

/**
 * Navien072 — intermediate, fits inside guiding8F.
 * od_fr=6.5 → inner_od_inch=0.08530 < effective guiding8F ID 0.089 → DIAMETER_OK
 */
const navien072 = makeDevice({
  id: 'navien072-115cm',
  name: 'Navien072 (115 cm)',
  category: '中間',
  maker: 'Medtronic',
  id_inch: 0.072,
  od_fr: 6.5,
  length_cm: 115,
});

/** Excelsior SL-10 — micro, fits inside intermediate */
const micro = makeDevice({
  id: 'excelsior-sl-10',
  name: 'Excelsior SL-10',
  category: 'マイクロ',
  maker: 'Stryker',
  id_inch: 0.0165, // ID = 0.4191 mm
  od_fr: 2.4,      // OD = 0.8000 mm  → 0.8000 < 1.4732 → OK
  length_cm: 150,
});

// ============================================================================
// Diameter check
// ============================================================================

describe('diameter: DIAMETER_OK', () => {
  it('inner OD strictly less than effective outer ID → ok', () => {
    // navien072 od_fr=6.5 → inner_od_inch=6.5/76.2=0.08530 < effective=0.09−0.001=0.089 → OK
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.code).toBe('DIAMETER_OK');
    expect(dc.status).toBe('ok');
  });

  it('records inch-based values in evidence', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.evidence['outer_id_inch']).toBeCloseTo(0.09, 10);
    expect(dc.evidence['inner_od_inch']).toBeCloseTo(6.5 / 76.2, 10);
    expect(dc.evidence['effective_outer_id_inch']).toBeCloseTo(0.09 - 0.001, 10);
  });

  it('clearance_inch is positive when compatible', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.evidence['clearance_inch']).toBeGreaterThan(0);
  });
});

describe('diameter: DIAMETER_INCOMPATIBLE', () => {
  it('inner OD > outer ID → incompatible', () => {
    const tooWide = makeDevice({ category: '中間', od_fr: 6, id_inch: 0.058 }); // OD = 2.0 mm > 1.8034 mm
    const result = checkCompatibility({ outer: guiding6F, inner: tooWide });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.code).toBe('DIAMETER_INCOMPATIBLE');
    expect(dc.status).toBe('incompatible');
  });

  it('inner OD exactly equal to outer ID → INCOMPATIBLE (margin makes clearance −0.001 inch)', () => {
    // outer.id_inch = inner_od_inch = 2.0/25.4 → effective = 2.0/25.4 − 0.001
    // clearance_inch = effective − inner_od_inch = −0.001
    const outer = makeDevice({ category: 'ガイディング', id_inch: 2.0 / 25.4, od_fr: 8 });
    const inner = makeDevice({ category: '中間', od_fr: 6.0, id_inch: 0.04 });
    const result = checkCompatibility({ outer, inner });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.code).toBe('DIAMETER_INCOMPATIBLE');
    expect(dc.evidence['clearance_inch']).toBeCloseTo(-0.001, 10);
  });

  it('clearance_inch is negative when incompatible', () => {
    const tooWide = makeDevice({ category: '中間', od_fr: 7, id_inch: 0.058 }); // OD >> outer ID
    const result = checkCompatibility({ outer: guiding6F, inner: tooWide });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.evidence['clearance_inch']!).toBeLessThan(0);
  });
});

describe('diameter: DIAMETER_UNKNOWN', () => {
  it('outer.id_inch = 0 → DIAMETER_UNKNOWN', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0 });
    const result = checkCompatibility({ outer, inner: intermediate });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.code).toBe('DIAMETER_UNKNOWN');
    expect(dc.status).toBe('unknown');
  });

  it('inner.od_fr = 0 → DIAMETER_UNKNOWN', () => {
    const inner = makeDevice({ category: '中間', od_fr: 0 });
    const result = checkCompatibility({ outer: guiding6F, inner });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.code).toBe('DIAMETER_UNKNOWN');
    expect(dc.status).toBe('unknown');
  });

  it('retains measured OD while clearance is null when ID is unknown', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0 });
    const result = checkCompatibility({ outer, inner: intermediate });
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.evidence['clearance_inch']).toBeNull();
    expect(dc.evidence['inner_od_inch']).toBeCloseTo(5.4 / 76.2, 10);
    expect(dc.evidence['effective_outer_id_inch']).toBeNull();
  });
});

// ============================================================================
// Category check
// ============================================================================

describe('category: CATEGORY_ADJACENT', () => {
  it('ガイディング → 中間 is adjacent → ok', () => {
    const result = checkCompatibility({ outer: guiding6F, inner: intermediate });
    const cc = result.reasons.find((r) => r.check === 'category')!;
    expect(cc.code).toBe('CATEGORY_ADJACENT');
    expect(cc.status).toBe('ok');
    expect(cc.evidence['delta']).toBe(1);
  });

  it('中間 → マイクロ is adjacent → ok', () => {
    const result = checkCompatibility({ outer: intermediate, inner: micro });
    const cc = result.reasons.find((r) => r.check === 'category')!;
    expect(cc.code).toBe('CATEGORY_ADJACENT');
    expect(cc.status).toBe('ok');
  });
});

describe('category: CATEGORY_SKIP', () => {
  it('ガイディング → マイクロ is a skip → ok', () => {
    const result = checkCompatibility({ outer: guiding6F, inner: micro });
    const cc = result.reasons.find((r) => r.check === 'category')!;
    expect(cc.code).toBe('CATEGORY_SKIP');
    expect(cc.status).toBe('ok');
    expect(cc.evidence['delta']).toBe(2);
  });
});

describe('category: CATEGORY_REVERSED', () => {
  it('中間 → ガイディング is reversed → incompatible', () => {
    const result = checkCompatibility({ outer: intermediate, inner: guiding6F });
    const cc = result.reasons.find((r) => r.check === 'category')!;
    expect(cc.code).toBe('CATEGORY_REVERSED');
    expect(cc.status).toBe('incompatible');
    expect(cc.evidence['delta']).toBe(-1);
  });

  it('マイクロ → ガイディング is reversed → incompatible', () => {
    const result = checkCompatibility({ outer: micro, inner: guiding6F });
    const cc = result.reasons.find((r) => r.check === 'category')!;
    expect(cc.code).toBe('CATEGORY_REVERSED');
    expect(cc.evidence['delta']).toBe(-2);
  });

  it('マイクロ → 中間 is reversed → incompatible', () => {
    const result = checkCompatibility({ outer: micro, inner: intermediate });
    const cc = result.reasons.find((r) => r.check === 'category')!;
    expect(cc.code).toBe('CATEGORY_REVERSED');
    expect(cc.status).toBe('incompatible');
  });
});

describe('category: CATEGORY_SAME', () => {
  it('ガイディング → ガイディング is same → incompatible', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0.09 });
    const inner = makeDevice({ category: 'ガイディング', od_fr: 6 });
    const result = checkCompatibility({ outer, inner });
    const cc = result.reasons.find((r) => r.check === 'category')!;
    expect(cc.code).toBe('CATEGORY_SAME');
    expect(cc.status).toBe('incompatible');
    expect(cc.evidence['delta']).toBe(0);
  });

  it('中間 → 中間 is same → incompatible', () => {
    const outer = makeDevice({ category: '中間', id_inch: 0.072 });
    const inner = makeDevice({ category: '中間', od_fr: 5.4 });
    const result = checkCompatibility({ outer, inner });
    const cc = result.reasons.find((r) => r.check === 'category')!;
    expect(cc.code).toBe('CATEGORY_SAME');
    expect(cc.status).toBe('incompatible');
  });
});

// ============================================================================
// Length check
// ============================================================================

describe('length: LENGTH_SUFFICIENT', () => {
  it('inner longer than outer → LENGTH_SUFFICIENT, ok', () => {
    const result = checkCompatibility({ outer: guiding6F, inner: intermediate }); // 115 > 90
    const lc = result.reasons.find((r) => r.check === 'length')!;
    expect(lc.code).toBe('LENGTH_SUFFICIENT');
    expect(lc.status).toBe('ok');
    expect(lc.evidence['delta_cm']).toBe(25);
  });

  it('inner same length as outer → LENGTH_SUFFICIENT, ok', () => {
    const outer = makeDevice({ category: 'ガイディング', length_cm: 90 });
    const inner = makeDevice({ category: '中間', length_cm: 90 });
    const result = checkCompatibility({ outer, inner });
    const lc = result.reasons.find((r) => r.check === 'length')!;
    expect(lc.code).toBe('LENGTH_SUFFICIENT');
    expect(lc.evidence['delta_cm']).toBe(0);
  });
});

describe('length: LENGTH_INSUFFICIENT', () => {
  it('inner shorter than outer → LENGTH_INSUFFICIENT, incompatible', () => {
    const outer = makeDevice({ category: 'ガイディング', length_cm: 100 });
    const inner = makeDevice({ category: '中間', length_cm: 90 });
    const result = checkCompatibility({ outer, inner });
    const lc = result.reasons.find((r) => r.check === 'length')!;
    expect(lc.code).toBe('LENGTH_INSUFFICIENT');
    expect(lc.status).toBe('incompatible');
    expect(lc.evidence['delta_cm']).toBe(-10);
  });
});

describe('length: LENGTH_UNKNOWN', () => {
  it('outer.length_cm = 0 → LENGTH_UNKNOWN', () => {
    const outer = makeDevice({ category: 'ガイディング', length_cm: 0 });
    const result = checkCompatibility({ outer, inner: intermediate });
    const lc = result.reasons.find((r) => r.check === 'length')!;
    expect(lc.code).toBe('LENGTH_UNKNOWN');
    expect(lc.status).toBe('unknown');
    expect(lc.evidence['delta_cm']).toBeNull();
  });

  it('inner.length_cm = 0 → LENGTH_UNKNOWN', () => {
    const inner = makeDevice({ category: '中間', length_cm: 0 });
    const result = checkCompatibility({ outer: guiding6F, inner });
    const lc = result.reasons.find((r) => r.check === 'length')!;
    expect(lc.code).toBe('LENGTH_UNKNOWN');
  });
});

// ============================================================================
// Aggregate status
// ============================================================================

describe('aggregate status', () => {
  it('all ok → status ok, compatible true', () => {
    // guiding8F + navien072: diameter OK, category adjacent, length sufficient
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.status).toBe('ok');
    expect(result.compatible).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('length insufficient only → status incompatible, compatible false', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0.09, length_cm: 120 });
    const inner = makeDevice({ category: '中間', od_fr: 5.4, length_cm: 90 }); // shorter
    const result = checkCompatibility({ outer, inner });
    expect(result.status).toBe('incompatible');
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.code === 'LENGTH_INSUFFICIENT')).toBe(true);
  });

  it('category skip + diameter ok + length ok → status ok, compatible true', () => {
    // guiding6F (length 90cm) → micro (length 150cm): length sufficient
    // diameter: micro od_fr=2.4 → inner_od_inch=0.0315 < effective 0.070 → ok
    const result = checkCompatibility({ outer: guiding6F, inner: micro });
    expect(result.compatible).toBe(true);
    expect(result.status).toBe('ok');
    expect(result.warnings).toHaveLength(0);
  });

  it('diameter incompatible → status incompatible, compatible false', () => {
    const tooWide = makeDevice({ category: '中間', od_fr: 7, id_inch: 0.04, length_cm: 115 });
    const result = checkCompatibility({ outer: guiding6F, inner: tooWide });
    expect(result.status).toBe('incompatible');
    expect(result.compatible).toBe(false);
  });

  it('category reversed → status incompatible, compatible false', () => {
    const result = checkCompatibility({ outer: micro, inner: guiding6F });
    expect(result.status).toBe('incompatible');
    expect(result.compatible).toBe(false);
  });

  it('diameter unknown + category ok → status unknown, compatible null', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0 });
    const inner = makeDevice({ category: '中間', od_fr: 5.4 });
    const result = checkCompatibility({ outer, inner });
    expect(result.status).toBe('unknown');
    expect(result.compatible).toBeNull();
  });

  it('category incompatible wins over diameter unknown (incompatible > unknown)', () => {
    const outer = makeDevice({ category: '中間', id_inch: 0 }); // missing diameter
    const inner = makeDevice({ category: 'ガイディング', od_fr: 6 }); // reversed category
    const result = checkCompatibility({ outer, inner });
    expect(result.status).toBe('incompatible');
    expect(result.compatible).toBe(false);
  });

  it('diameter incompatible + length insufficient → both incompatible in reasons', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0.05, length_cm: 120 });
    const inner = makeDevice({ category: '中間', od_fr: 6, length_cm: 90 }); // OD=2mm > ID=1.27mm, shorter
    const result = checkCompatibility({ outer, inner });
    expect(result.status).toBe('incompatible');
    expect(result.reasons.some((r) => r.code === 'LENGTH_INSUFFICIENT')).toBe(true);
    expect(result.reasons.some((r) => r.code === 'DIAMETER_INCOMPATIBLE')).toBe(true);
  });

  it('all three unknown → status unknown', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0, length_cm: 0 });
    const inner = makeDevice({ category: '中間', od_fr: 0, length_cm: 0 });
    const result = checkCompatibility({ outer, inner });
    expect(result.status).toBe('unknown');
    expect(result.compatible).toBeNull();
  });
});

// ============================================================================
// warnings field
// ============================================================================

describe('warnings field', () => {
  it('is empty when status is ok', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.warnings).toHaveLength(0);
  });

  it('contains only warning-status reasons', () => {
    const result = checkCompatibility({ outer: guiding6F, inner: micro }); // CATEGORY_SKIP
    for (const w of result.warnings) {
      expect(w.status).toBe('warning');
    }
  });

  it('warnings are the same object references as in reasons', () => {
    const result = checkCompatibility({ outer: guiding6F, inner: micro });
    for (const w of result.warnings) {
      expect(result.reasons).toContain(w);
    }
  });

  it('incompatible result: LENGTH_INSUFFICIENT appears in reasons, not warnings', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0.05, length_cm: 120 });
    const inner = makeDevice({ category: '中間', od_fr: 7, length_cm: 90 });
    const result = checkCompatibility({ outer, inner });
    expect(result.status).toBe('incompatible');
    // LENGTH_INSUFFICIENT is now incompatible, not warning — so not in warnings[]
    expect(result.reasons.some((r) => r.code === 'LENGTH_INSUFFICIENT')).toBe(true);
    expect(result.warnings.some((w) => w.code === 'LENGTH_INSUFFICIENT')).toBe(false);
  });
});

// ============================================================================
// derived_metrics
// ============================================================================

describe('derived_metrics', () => {
  it('outer_id_mm = outer.id_inch × 25.4', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.derived_metrics.outer_id_mm).toBeCloseTo(0.09 * 25.4, 10);
  });

  it('inner_od_mm = inner.od_fr × (1/3)', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.derived_metrics.inner_od_mm).toBeCloseTo(6.5 / 3, 10);
  });

  it('inner_od_inch = inner.od_fr / 76.2', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.derived_metrics.inner_od_inch).toBeCloseTo(6.5 / 76.2, 10);
  });

  it('effective_outer_id_inch = outer.id_inch − MARGIN_INCH', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.derived_metrics.effective_outer_id_inch).toBeCloseTo(0.09 - 0.001, 10);
  });

  it('clearance_inch = effective_outer_id_inch − inner_od_inch', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    const { effective_outer_id_inch, inner_od_inch, clearance_inch } = result.derived_metrics;
    expect(clearance_inch).toBeCloseTo(effective_outer_id_inch! - inner_od_inch!, 10);
  });

  it('clearance_mm = (outer.id_inch − MARGIN_INCH) × 25.4 − inner_od_mm', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    const { effective_outer_id_inch, inner_od_mm, clearance_mm } = result.derived_metrics;
    expect(clearance_mm).toBeCloseTo(effective_outer_id_inch! * 25.4 - inner_od_mm!, 10);
  });

  it('length_delta_cm = inner.length_cm − outer.length_cm', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.derived_metrics.length_delta_cm).toBe(115 - 90); // 25
  });

  it('category_delta = inner_level − outer_level', () => {
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.derived_metrics.category_delta).toBe(1); // 中間 (1) − ガイディング (0)
  });

  it('all null when both diameter fields missing', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0 });
    const inner = makeDevice({ category: '中間', od_fr: 0 });
    const { derived_metrics: dm } = checkCompatibility({ outer, inner });
    expect(dm.outer_id_mm).toBeNull();
    expect(dm.inner_od_mm).toBeNull();
    expect(dm.clearance_mm).toBeNull();
  });

  it('clearance_mm is null if only one diameter field missing', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0 }); // missing
    const inner = makeDevice({ category: '中間', od_fr: 5.4 }); // present
    const { derived_metrics: dm } = checkCompatibility({ outer, inner });
    expect(dm.outer_id_mm).toBeNull();
    expect(dm.inner_od_mm).toBeNull();
    expect(dm.proximal.inner_od_mm).toBeCloseTo(5.4 / 3, 6);
    expect(dm.clearance_mm).toBeNull();
  });
});

// ============================================================================
// evidence_state
// ============================================================================

describe('evidence_state', () => {
  it('marks all fields present for complete devices', () => {
    const result = checkCompatibility({ outer: guiding6F, inner: intermediate });
    const { evidence_state: es } = result;
    expect(es.outer_proximal_id_inch).toBe('present');
    expect(es.outer_distal_id_inch).toBe('present');
    expect(es.inner_proximal_od_inch).toBe('present');
    expect(es.inner_distal_od_inch).toBe('present');
    expect(es.outer_length_cm).toBe('present');
    expect(es.inner_length_cm).toBe('present');
  });

  it('outer_id_inch = missing when outer.id_inch = 0', () => {
    const outer = makeDevice({ category: 'ガイディング', id_inch: 0 });
    const result = checkCompatibility({ outer, inner: intermediate });
    expect(result.evidence_state.outer_proximal_id_inch).toBe('missing');
    expect(result.evidence_state.outer_distal_id_inch).toBe('missing');
  });

  it('inner_od_fr = missing when inner.od_fr = 0', () => {
    const inner = makeDevice({ category: '中間', od_fr: 0 });
    const result = checkCompatibility({ outer: guiding6F, inner });
    expect(result.evidence_state.inner_proximal_od_inch).toBe('missing');
    expect(result.evidence_state.inner_distal_od_inch).toBe('missing');
  });

  it('outer_length_cm = missing when outer.length_cm = 0', () => {
    const outer = makeDevice({ category: 'ガイディング', length_cm: 0 });
    const result = checkCompatibility({ outer, inner: intermediate });
    expect(result.evidence_state.outer_length_cm).toBe('missing');
  });

  it('inner_length_cm = missing when inner.length_cm = 0', () => {
    const inner = makeDevice({ category: '中間', length_cm: 0 });
    const result = checkCompatibility({ outer: guiding6F, inner });
    expect(result.evidence_state.inner_length_cm).toBe('missing');
  });
});

// ============================================================================
// reasons structure
// ============================================================================

describe('reasons structure', () => {
  it('returns category, two regional diameters and length', () => {
    const result = checkCompatibility({ outer: guiding6F, inner: intermediate });
    expect(result.reasons).toHaveLength(4);
    expect(result.reasons.filter((r) => r.check === 'diameter').map((r) => r.region))
      .toEqual(['proximal', 'distal']);
    const checks = result.reasons.map((r) => r.check);
    expect(checks).toContain('category');
    expect(checks).toContain('diameter');
    expect(checks).toContain('length');
  });

  it('each reason has check, status, code, evidence fields', () => {
    const result = checkCompatibility({ outer: guiding6F, inner: intermediate });
    for (const reason of result.reasons) {
      expect(reason).toHaveProperty('check');
      expect(reason).toHaveProperty('status');
      expect(reason).toHaveProperty('code');
      expect(reason).toHaveProperty('evidence');
    }
  });
});

// ============================================================================
// checkThreeWay
// ============================================================================

describe('checkThreeWay', () => {
  it('returns a tuple of two results', () => {
    const [r1, r2] = checkThreeWay({ guiding: guiding8F, intermediate: navien072, micro });
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });

  it('first result is guiding → intermediate', () => {
    const [r1] = checkThreeWay({ guiding: guiding8F, intermediate: navien072, micro });
    expect(r1.derived_metrics.outer_id_mm).toBeCloseTo(inchToMm(guiding8F.id_inch), 6);
    expect(r1.derived_metrics.inner_od_mm).toBeCloseTo(frToMm(navien072.od_fr), 6);
  });

  it('second result is intermediate → micro', () => {
    const [, r2] = checkThreeWay({ guiding: guiding8F, intermediate: navien072, micro });
    expect(r2.derived_metrics.outer_id_mm).toBeCloseTo(inchToMm(navien072.id_inch), 6);
    expect(r2.derived_metrics.inner_od_mm).toBeCloseTo(frToMm(micro.od_fr), 6);
  });

  it('both adjacent pairs → both ok', () => {
    const [r1, r2] = checkThreeWay({ guiding: guiding8F, intermediate: navien072, micro });
    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');
  });

  it('compatible is independent per pair', () => {
    const [r1, r2] = checkThreeWay({ guiding: guiding8F, intermediate: navien072, micro });
    expect(r1.compatible).toBe(true);
    expect(r2.compatible).toBe(true);
  });
});

// ============================================================================
// Regression pairings with synthetic uniform-end measurements
// ============================================================================

describe('synthetic uniform-end regression pairings', () => {
  it('6F Roadmaster + Navien058: margin makes this pair INCOMPATIBLE', () => {
    // inner_od_inch = 5.4/76.2 = 0.07087, effective_outer_id = 0.071−0.001 = 0.070
    // 0.07087 > 0.070 → DIAMETER_INCOMPATIBLE (clinical finding: 0.001 inch margin blocks this pair)
    const result = checkCompatibility({ outer: guiding6F, inner: intermediate });
    expect(result.compatible).toBe(false);
    expect(result.status).toBe('incompatible');
    const dc = result.reasons.find((r) => r.check === 'diameter')!;
    expect(dc.code).toBe('DIAMETER_INCOMPATIBLE');
    expect(result.derived_metrics.clearance_inch!).toBeCloseTo(0.070 - 5.4 / 76.2, 6);
  });

  it('Navien058 (ID 1.4732mm) + Excelsior SL-10 (OD 0.8mm) → ok with wide clearance', () => {
    // clearance_mm = (0.058−0.001)×25.4 − 2.4/3 = 0.057×25.4 − 0.8 = 1.4478 − 0.8 = 0.6478
    const result = checkCompatibility({ outer: intermediate, inner: micro });
    expect(result.compatible).toBe(true);
    expect(result.derived_metrics.clearance_mm).toBeCloseTo(0.057 * 25.4 - 0.8, 4);
  });

  it('8F Fubuki (ID 2.286mm) + Navien072 (OD 2.167mm) → ok', () => {
    const guiding8F = makeDevice({
      category: 'ガイディング',
      id_inch: 0.09, // ID = 2.286 mm
      od_fr: 8,
      length_cm: 90,
    });
    const navien072 = makeDevice({
      category: '中間',
      id_inch: 0.072,
      od_fr: 6.5, // OD = 2.1667 mm < 2.286 mm → ok
      length_cm: 115,
    });
    const result = checkCompatibility({ outer: guiding8F, inner: navien072 });
    expect(result.compatible).toBe(true);
  });

  it('5F Launcher (ID 1.4732mm) + Cerulean DD6 (OD 2.0667mm) → incompatible', () => {
    const guiding5F = makeDevice({
      category: 'ガイディング',
      id_inch: 0.058, // ID = 1.4732 mm
      od_fr: 5,
      length_cm: 90,
    });
    const ceruleanDD6 = makeDevice({
      category: '中間',
      id_inch: 0.072,
      od_fr: 6.2, // OD = 2.0667 mm > 1.4732 mm → incompatible
      length_cm: 113,
    });
    const result = checkCompatibility({ outer: guiding5F, inner: ceruleanDD6 });
    expect(result.status).toBe('incompatible');
    expect(result.compatible).toBe(false);
  });
});

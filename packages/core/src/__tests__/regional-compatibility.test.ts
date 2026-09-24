import { describe, it, expect } from 'vitest';
import { checkCompatibility, checkDualCompatibility, checkThreeWay, MARGIN_INCH } from '../engine';
import type { Device } from '../types';

// Synthetic regional measurements deliberately conflict with the legacy diameters.
function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 'test', name: 'Test', maker: 'Test', notes: '', category: '中間', length_cm: 110,
    id_inch: 0.01, od_fr: 30,
    proximal_id_inch: 0.09, distal_id_inch: 0.08,
    proximal_od_inch: 0.06, distal_od_inch: 0.05,
    ...overrides,
  };
}
const outer = device({ category: 'ガイディング', length_cm: 90 });
const inner = device();
const regions = ['proximal', 'distal'] as const;
const invalidDiameters = [undefined, null, 0, -0.01, NaN, Infinity, -Infinity];

describe('matching regional diameters', () => {
  it('requires both ends to pass and ignores conflicting legacy ID/OD', () => {
    const result = checkCompatibility({ outer, inner });
    expect(result.status).toBe('ok');
    expect(result.compatible).toBe(true);
    expect(result.reasons.filter((r) => r.check === 'diameter')).toMatchObject([
      { region: 'proximal', status: 'ok' }, { region: 'distal', status: 'ok' },
    ]);
  });

  it('compares matching ends rather than the largest OD with the smallest ID', () => {
    const result = checkCompatibility({
      outer: { ...outer, proximal_id_inch: 0.09, distal_id_inch: 0.06 },
      inner: { ...inner, proximal_od_inch: 0.08, distal_od_inch: 0.05 },
    });
    expect(result.compatible).toBe(true);
  });

  it.each([
    [0.09, 0.05, 'incompatible', 'ok'],
    [0.06, 0.08, 'ok', 'incompatible'],
    [0.09, 0.08, 'incompatible', 'incompatible'],
  ])('ODs %s / %s: either end can reject the pair', (proximal, distal, pStatus, dStatus) => {
    const result = checkCompatibility({ outer, inner: device({ proximal_od_inch: proximal, distal_od_inch: distal }) });
    expect(result.compatible).toBe(false);
    expect(result.status).toBe('incompatible');
    expect(result.reasons.filter((r) => r.check === 'diameter').map((r) => r.status)).toEqual([pStatus, dStatus]);
  });

  describe.each(regions)('%s strict boundary', (region) => {
    it.each([
      [0.062499, 'ok'], [0.0625, 'incompatible'], [0.062501, 'incompatible'], [0.0635, 'incompatible'],
    ])('OD %s vs ID 0.0635 gives %s', (od, status) => {
      const result = checkCompatibility({
        outer: { ...outer, [`${region}_id_inch`]: 0.0635 },
        inner: { ...inner, [`${region}_od_inch`]: od },
      });
      expect(result.status).toBe(status);
      expect(result.reasons.find((r) => r.region === region)?.status).toBe(status);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe.each([
    ['outer', 'proximal'], ['outer', 'distal'], ['inner', 'proximal'], ['inner', 'distal'],
  ] as const)('invalid %s %s diameter', (role, region) => {
    it.each(invalidDiameters)('%s stays unknown without legacy fallback', (value) => {
      const pair = { outer: { ...outer }, inner: { ...inner } };
      const field = `${region}_${role === 'outer' ? 'id' : 'od'}_inch`;
      pair[role] = { ...pair[role], [field]: value };
      const result = checkCompatibility(pair);
      expect(result.status).toBe('unknown');
      expect(result.compatible).toBeNull();
      expect(result.reasons.find((r) => r.region === region)?.code).toBe('DIAMETER_UNKNOWN');
      expect(result.derived_metrics[region].clearance_inch).toBeNull();
      expect(result.derived_metrics.clearance_inch).toBeNull();
      expect(result.derived_metrics.limiting_region).toBeNull();
      expect(result.evidence_state[`${role}_${field}` as keyof typeof result.evidence_state]).toBe('missing');
    });
  });

  it.each(regions)('known %s failure outranks an unknown opposite end', (region) => {
    const opposite = region === 'proximal' ? 'distal' : 'proximal';
    const result = checkCompatibility({
      outer: { ...outer, [`${opposite}_id_inch`]: null },
      inner: { ...inner, [`${region}_od_inch`]: 0.1 },
    });
    expect(result.status).toBe('incompatible');
    expect(result.compatible).toBe(false);
    expect(result.reasons.find((r) => r.region === opposite)?.status).toBe('unknown');
  });

  it('does not require unused OD/ID fields or interpret notes', () => {
    const result = checkCompatibility({
      outer: { ...outer, proximal_od_inch: null, distal_od_inch: null, notes: '通過不可' },
      inner: { ...inner, proximal_id_inch: null, distal_id_inch: null },
    });
    expect(result.status).toBe('ok');
  });
});

describe('regional metrics', () => {
  it.each([
    [0.08, 0.05, 'proximal'], [0.06, 0.075, 'distal'],
  ] as const)('ODs %s / %s summarize the %s clearance', (proximalOd, distalOd, limiting) => {
    const result = checkCompatibility({ outer, inner: device({ proximal_od_inch: proximalOd, distal_od_inch: distalOd }) });
    const dm = result.derived_metrics;
    expect(dm.limiting_region).toBe(limiting);
    for (const region of regions) {
      const id = outer[`${region}_id_inch`]!;
      const od = region === 'proximal' ? proximalOd : distalOd;
      expect(dm[region].inner_od_inch).toBe(od);
      expect(dm[region].effective_outer_id_inch).toBeCloseTo(id - MARGIN_INCH, 12);
      expect(dm[region].clearance_inch).toBeCloseTo(id - MARGIN_INCH - od, 12);
      expect(dm[region].outer_id_mm).toBeCloseTo(id * 25.4, 12);
      expect(dm[region].inner_od_mm).toBeCloseTo(od * 25.4, 12);
      expect(dm[region].clearance_mm).toBeCloseTo((id - MARGIN_INCH - od) * 25.4, 12);
      expect(result.reasons.find((r) => r.region === region)?.evidence).toEqual(dm[region]);
    }
    expect(dm.clearance_inch).toBe(dm[limiting].clearance_inch);
    expect(dm.outer_id_mm).toBe(dm[limiting].outer_id_mm);
    expect(dm.inner_od_mm).toBe(dm[limiting].inner_od_mm);
    expect(dm.clearance_mm).toBe(dm[limiting].clearance_mm);
  });

  it('retains valid evidence when one measurement is missing', () => {
    const result = checkCompatibility({ outer: { ...outer, proximal_id_inch: null }, inner });
    expect(result.derived_metrics.proximal.outer_id_inch).toBeNull();
    expect(result.derived_metrics.proximal.inner_od_inch).toBe(0.06);
    expect(result.derived_metrics.distal.clearance_inch).toBeGreaterThan(0);
    expect(result.evidence_state).toEqual({
      outer_proximal_id_inch: 'missing', outer_distal_id_inch: 'present',
      inner_proximal_od_inch: 'present', inner_distal_od_inch: 'present',
      outer_length_cm: 'present', inner_length_cm: 'present',
    });
  });

  it('checks both ends of both pairs in a three-device combination', () => {
    const micro = device({ category: 'マイクロ', length_cm: 150, proximal_od_inch: 0.03, distal_od_inch: 0.08 });
    const results = checkThreeWay({ guiding: outer, intermediate: inner, micro });
    expect(results.map((r) => r.status)).toEqual(['ok', 'incompatible']);
    expect(results[1].reasons.filter((r) => r.check === 'diameter').map((r) => r.status)).toEqual(['ok', 'incompatible']);
  });
});

describe('two simultaneous catheters', () => {
  const inner1 = device({ proximal_od_inch: 0.04, distal_od_inch: 0.03 });
  const inner2 = device({ proximal_od_inch: 0.04, distal_od_inch: 0.03 });

  it('sums matching ODs independently at each end', () => {
    const result = checkDualCompatibility({ outer, inner1, inner2 });
    expect(result.status).toBe('ok');
    expect(result.compatible).toBe(true);
    expect(result.reasons).toMatchObject([
      { region: 'proximal', code: 'DIAMETER_DUAL_OK' }, { region: 'distal', code: 'DIAMETER_DUAL_OK' },
    ]);
    expect(result.derived_metrics.proximal.combined_od_inch).toBe(0.08);
    expect(result.derived_metrics.distal.combined_od_inch).toBe(0.06);
    expect(result.derived_metrics.limiting_region).toBe('proximal');
    expect(result.derived_metrics.clearance_inch).toBeCloseTo(0.009, 12);
    expect(result.derived_metrics.clearance_mm).toBeCloseTo(0.009 * 25.4, 12);
    expect(result.derived_metrics.combined_od_mm).toBeCloseTo(0.08 * 25.4, 12);
  });

  describe.each(regions)('%s combined boundary', (region) => {
    it.each([
      [0.063499, 'incompatible', false], [0.0635, 'incompatible', false],
      [0.064, 'warning', true], [0.064499, 'warning', true], [0.064501, 'ok', true],
    ] as const)('ID %s vs combined OD 0.0625 gives %s', (id, status, compatible) => {
      const result = checkDualCompatibility({
        outer: { ...outer, [`${region}_id_inch`]: id },
        inner1: { ...inner1, [`${region}_od_inch`]: 0.03125 },
        inner2: { ...inner2, [`${region}_od_inch`]: 0.03125 },
      });
      expect(result.status).toBe(status);
      expect(result.compatible).toBe(compatible);
      expect(result.derived_metrics.limiting_region).toBe(region);
      expect(result.warnings).toEqual(result.reasons.filter((r) => r.status === 'warning'));
      if (status === 'warning') expect(result.warnings[0]?.region).toBe(region);
    });
  });

  describe.each([
    ['outer', 'proximal'], ['outer', 'distal'],
    ['inner1', 'proximal'], ['inner1', 'distal'], ['inner2', 'proximal'], ['inner2', 'distal'],
  ] as const)('invalid %s %s diameter', (role, region) => {
    it.each(invalidDiameters)('%s stays unknown without legacy fallback', (value) => {
      const pair = { outer: { ...outer }, inner1: { ...inner1 }, inner2: { ...inner2 } };
      const field = `${region}_${role === 'outer' ? 'id' : 'od'}_inch`;
      pair[role] = { ...pair[role], [field]: value };
      const result = checkDualCompatibility(pair);
      expect(result.status).toBe('unknown');
      expect(result.compatible).toBeNull();
      expect(result.reasons.find((r) => r.region === region)?.code).toBe('DIAMETER_DUAL_UNKNOWN');
      expect(result.derived_metrics.clearance_inch).toBeNull();
      expect(result.evidence_state[`${role}_${field}` as keyof typeof result.evidence_state]).toBe('missing');
    });
  });

  it.each([
    [null, 0.03125, 'unknown'], [null, 0.1, 'incompatible'],
    [0.064, 0.1, 'incompatible'], [0.064, 0.03125, 'warning'],
  ] as const)('proximal ID %s and distal second OD %s aggregate to %s', (proximalId, distalOd, status) => {
    const result = checkDualCompatibility({
      outer: { ...outer, proximal_id_inch: proximalId, distal_id_inch: 0.064 },
      inner1: { ...inner1, proximal_od_inch: 0.03125, distal_od_inch: 0.03125 },
      inner2: { ...inner2, proximal_od_inch: 0.03125, distal_od_inch: distalOd },
    });
    expect(result.status).toBe(status);
  });

  it('allows the same device twice and keeps category/length in individual checks', () => {
    const short = { ...inner1, length_cm: 1, category: 'ガイディング' as const };
    expect(checkDualCompatibility({ outer, inner1: short, inner2: short }).compatible).toBe(true);
    expect(checkCompatibility({ outer, inner: short }).compatible).toBe(false);
  });

  it('retains available regional measurements when another is missing', () => {
    const result = checkDualCompatibility({ outer, inner1, inner2: { ...inner2, distal_od_inch: null } });
    expect(result.derived_metrics.distal.inner1_od_inch).toBe(0.03);
    expect(result.derived_metrics.distal.inner2_od_inch).toBeNull();
    expect(result.derived_metrics.distal.combined_od_inch).toBeNull();
    for (const region of regions) {
      expect(result.reasons.find((r) => r.region === region)?.evidence).toEqual(result.derived_metrics[region]);
    }
    expect(result.evidence_state.inner2_distal_od_inch).toBe('missing');
  });
});

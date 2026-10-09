import { describe, it, expect } from 'vitest';
import { checkCompatibility, checkDualCompatibility, checkThreeWay } from '../engine';
import type { Device } from '../types';

function device(overrides: Partial<Device> = {}): Device {
  return {
    id: 'test', name: 'Test', maker: 'Test', notes: '', category: 'マイクロ', length_cm: 150,
    id_inch: 0.001, od_fr: 30,
    proximal_id_inch: null, distal_id_inch: 0.0635,
    proximal_od_inch: 0.03125, distal_od_inch: 0.02,
    ...overrides,
  };
}

const inner = device({ proximal_od_inch: 0.0625 });
const inner1 = device();
const inner2 = device();

describe.each(['single', 'dual'] as const)('%s proximal-ID fallback', (mode) => {
  function check(outer: Device) {
    return mode === 'single'
      ? checkCompatibility({ outer, inner })
      : checkDualCompatibility({ outer, inner1, inner2 });
  }

  it.each([null, undefined])('uses the distal ID when proximal ID is %s without changing source data', (missing) => {
    const outer = Object.freeze(device({ category: 'ガイディング', length_cm: 95, proximal_id_inch: missing }));
    const result = check(outer);
    // Single equality is inclusive; two simultaneous catheters still require strict clearance.
    expect(result.status).toBe(mode === 'single' ? 'ok' : 'incompatible');
    expect(result.compatible).toBe(mode === 'single');
    expect(result.derived_metrics.proximal.outer_id_inch).toBe(0.0635);
    expect(result.derived_metrics.proximal.clearance_inch).toBe(0);
    expect(result.derived_metrics.limiting_region).toBe('proximal');
    expect(result.reasons.find((r) => r.region === 'proximal')?.evidence).toEqual(result.derived_metrics.proximal);
    expect(result.evidence_state).toMatchObject({
      outer_proximal_id_source: 'distal', outer_proximal_id_inch: 'missing', outer_distal_id_inch: 'present',
    });
    expect(outer.proximal_id_inch).toBe(missing);
  });

  it.each([
    [0.063499, 'incompatible'], [0.065, 'ok'],
  ] as const)('uses distal ID %s for proximal pass/fail: %s', (distalId, expected) => {
    const result = check(device({ category: 'ガイディング', distal_id_inch: distalId }));
    expect(result.status).toBe(expected);
    expect(result.reasons.find((r) => r.region === 'distal')?.status).toBe('ok');
  });

  it.each([
    [0.06, 'incompatible'], [0.07, 'ok'],
  ] as const)('preserves explicitly registered proximal ID %s', (proximalId, expected) => {
    const result = check(device({ category: 'ガイディング', proximal_id_inch: proximalId }));
    expect(result.status).toBe(expected);
    expect(result.derived_metrics.proximal.outer_id_inch).toBe(proximalId);
    expect(result.evidence_state.outer_proximal_id_source).toBe('proximal');
  });

  it.each([undefined, null, 0, -0.01, NaN, Infinity, -Infinity])('keeps unknown when distal ID %s cannot supply the missing proximal ID', (distalId) => {
    const result = check(device({ category: 'ガイディング', distal_id_inch: distalId, id_inch: 0.09 }));
    expect(result.status).toBe('unknown');
    expect(result.compatible).toBeNull();
    expect(result.derived_metrics.proximal.outer_id_inch).toBeNull();
    expect(result.evidence_state.outer_proximal_id_source).toBeNull();
  });
});

it('applies fallback to guiding and intermediate lumens in a three-device combination', () => {
  const results = checkThreeWay({
    guiding: device({ category: 'ガイディング', length_cm: 95, distal_id_inch: 0.071 }),
    intermediate: device({ category: '中間', length_cm: 120, proximal_od_inch: 0.06, distal_od_inch: 0.05 }),
    micro: device({ proximal_od_inch: 0.03 }),
  });
  expect(results.map((r) => r.status)).toEqual(['ok', 'ok']);
  expect(results.map((r) => r.evidence_state.outer_proximal_id_source)).toEqual(['distal', 'distal']);
});

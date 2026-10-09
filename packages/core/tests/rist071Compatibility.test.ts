import { describe, it, expect } from 'vitest';
import master from '../../device-master/master.json';
import { checkCompatibility, checkDualCompatibility } from '../src/engine';
import type { Device } from '../src/types';

const devices = master.devices as Device[];

function findDevice(name: string): Device {
  const device = devices.find((candidate) => candidate.name === name);
  if (!device) throw new Error(`Missing regression device: ${name}`);
  return device;
}

describe.each([95, 100, 105])('RIST071 (%s cm) with VIA21 and Scepter XC', (length) => {
  it.each([
    ['VIA21', 'Scepter XC'], ['Scepter XC', 'VIA21'],
  ])('rejects simultaneous insertion in either order: %s + %s', (first, second) => {
    const outer = findDevice(`RIST071 (${length} cm)`);
    const inner1 = findDevice(first);
    const inner2 = findDevice(second);
    const result = checkDualCompatibility({ outer, inner1, inner2 });

    expect(result.status).toBe('incompatible');
    expect(result.compatible).toBe(false);
    expect(result.reasons).toMatchObject([
      { region: 'proximal', code: 'DIAMETER_DUAL_INCOMPATIBLE' },
      { region: 'distal', code: 'DIAMETER_DUAL_OK' },
    ]);
    expect(result.derived_metrics.proximal.outer_id_inch).toBe(0.071);
    expect(result.derived_metrics.proximal.combined_od_inch).toBeCloseTo(0.07283464, 8);
    expect(result.derived_metrics.clearance_inch).toBeCloseTo(-0.00283464, 8);
    expect(result.derived_metrics.limiting_region).toBe('proximal');
    expect(result.evidence_state.outer_proximal_id_source).toBe('distal');
    expect(checkCompatibility({ outer, inner: inner1 }).status).toBe('ok');
    expect(checkCompatibility({ outer, inner: inner2 }).status).toBe('ok');
    expect(outer.proximal_id_inch).toBeNull();
  });
});

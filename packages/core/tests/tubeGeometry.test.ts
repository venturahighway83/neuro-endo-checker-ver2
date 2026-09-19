import { describe, expect, it } from 'vitest';
import type { Device } from '../src/types';
import { readFileSync } from 'node:fs';
const master = JSON.parse(readFileSync(new URL('../../device-master/master.json', import.meta.url), 'utf8')) as { devices: Device[] };
import { deviceTubeRadii, maxOuterRadius, tubeSurface } from '../../../apps/web/components/tubeGeometry';

const device: Device = { id: 'test', name: 'Test', category: 'マイクロ', maker: 'Test', length_cm: 100, id_inch: 0.02, od_fr: 3, notes: '' };

describe('3D catheter shape', () => {
  it('preserves legacy constant tubes with missing, single-ended, or invalid measurements', () => {
    const expected = deviceTubeRadii(device);
    expect(expected).toEqual({ proximalOuterR: 0.5, distalOuterR: 0.5, proximalInnerR: 0.254, distalInnerR: 0.254 });
    for (const d of [
      { ...device, proximal_od_inch: 0.05, distal_id_inch: 0.01 },
      { ...device, proximal_od_inch: 0.05, distal_od_inch: null },
      { ...device, proximal_od_inch: NaN, distal_od_inch: 0.04 },
      { ...device, proximal_id_inch: 0, distal_id_inch: 0.01 },
    ]) expect(deviceTubeRadii(d)).toEqual(expected);
  });

  it('resolves independent inner and outer profiles in the same units and scales both ends', () => {
    const outer = deviceTubeRadii({ ...device, proximal_od_inch: 0.05, distal_od_inch: 0.03 }, 2);
    expect(outer.proximalOuterR).toBeCloseTo(1.27);
    expect(outer.distalOuterR).toBeCloseTo(0.762);
    expect(outer.proximalInnerR).toBe(0.508);
    expect(outer.distalInnerR).toBe(0.508);
    const inner = deviceTubeRadii({ ...device, proximal_id_inch: 0.03, distal_id_inch: 0.01 });
    expect(inner.proximalInnerR).toBeCloseTo(0.381);
    expect(inner.distalInnerR).toBeCloseTo(0.127);
    expect(inner.proximalOuterR).toBe(0.5);
    expect(inner.distalOuterR).toBe(0.5);
    expect(maxOuterRadius({ ...outer, proximalOuterR: 0.5, distalOuterR: 2 })).toBe(2);
  });

  it('places the correct physical radius at proximal z=0 and distal z=length', () => {
    for (const [proximal, distal] of [[2, 1], [1, 2], [1, 1]]) {
      const geometry = tubeSurface(proximal, distal, 10);
      const position = geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        const z = position.getZ(i);
        expect(z).toBeGreaterThanOrEqual(-1e-6);
        expect(z).toBeLessThanOrEqual(10 + 1e-6);
        const expected = proximal + (distal - proximal) * z / 10;
        expect(Math.hypot(position.getX(i), position.getY(i))).toBeCloseTo(expected, 5);
      }
      geometry.dispose();
    }
  });

  it('keeps every current device lumen inside its wall at both endpoints', () => {
    for (const d of master.devices) {
      const r = deviceTubeRadii(d);
      expect(r.proximalInnerR, d.id).toBeLessThan(r.proximalOuterR);
      expect(r.distalInnerR, d.id).toBeLessThan(r.distalOuterR);
    }
  });
});

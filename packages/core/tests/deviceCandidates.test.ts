import { describe, expect, it } from 'vitest';
import type { Device } from '../src/types';
import { filterDeviceCandidates } from '../../../apps/web/components/deviceCandidates';

function device(id: string, overrides: Partial<Device> = {}): Device {
  return {
    id, name: id, maker: 'Test', notes: '', category: '中間', length_cm: 110,
    id_inch: 0.01, od_fr: 30,
    proximal_id_inch: 0.09, distal_id_inch: 0.08,
    proximal_od_inch: 0.04, distal_od_inch: 0.03,
    ...overrides,
  };
}
const guiding = device('guiding', { category: 'ガイディング', length_cm: 90 });

describe('device dropdown candidates', () => {
  it('preserves the original list until an outer device is selected', () => {
    const candidates = [device('a'), device('b', { length_cm: 1 })];
    expect(filterDeviceCandidates(candidates, null, device('other'))).toBe(candidates);
  });

  it('hides proximal, distal, length and category failures while retaining unknowns', () => {
    const fits = device('fits');
    const unknown = device('unknown', { proximal_od_inch: null });
    const candidates = [
      fits,
      device('proximal-failure', { proximal_od_inch: 0.1 }),
      device('distal-failure', { distal_od_inch: 0.1 }),
      device('short', { length_cm: 89 }),
      device('same-category', { category: 'ガイディング' }),
      unknown,
      device('unknown-with-known-failure', { proximal_od_inch: null, distal_od_inch: 0.1 }),
    ];
    expect(filterDeviceCandidates(candidates, guiding)).toEqual([fits, unknown]);
    expect(candidates).toHaveLength(7);
  });

  it('filters micros against their own intermediate parent', () => {
    const intermediate = device('intermediate', { proximal_id_inch: 0.04, distal_id_inch: 0.035 });
    const fits = device('small-micro', { category: 'マイクロ', length_cm: 150, proximal_od_inch: 0.03, distal_od_inch: 0.02 });
    const wide = device('wide-micro', { category: 'マイクロ', length_cm: 150, proximal_od_inch: 0.05, distal_od_inch: 0.02 });
    expect(filterDeviceCandidates([fits, wide], intermediate)).toEqual([fits]);
    expect(filterDeviceCandidates([fits, wide], guiding)).toEqual([fits, wide]);
  });

  it('includes proximal equality but excludes excess OD and distal equality', () => {
    const outer = { ...guiding, proximal_id_inch: 0.03, distal_id_inch: 0.0635 };
    const equality = device('proximal-equality', { proximal_od_inch: 0.029 });
    const proximalExcess = device('proximal-excess', { proximal_od_inch: 0.02900001 });
    const distalEquality = device('distal-equality', { proximal_od_inch: 0.029, distal_od_inch: 0.0625 });
    expect(filterDeviceCandidates([equality, proximalExcess, distalEquality], outer)).toEqual([equality]);
  });

  it.each(['proximal', 'distal'] as const)('excludes a candidate that only fails the %s simultaneous check', (region) => {
    const other = device('other');
    const tooWideTogether = device('wide-together', { [`${region}_od_inch`]: 0.06 });
    const fits = device('fits');
    expect(filterDeviceCandidates([tooWideTogether, fits], guiding)).toEqual([tooWideTogether, fits]);
    expect(filterDeviceCandidates([tooWideTogether, fits], guiding, other)).toEqual([fits]);
    expect(filterDeviceCandidates([other], guiding, tooWideTogether)).toEqual([]);
  });

  it('allows both tight-fit warnings and unknown simultaneous results', () => {
    const outer = { ...guiding, proximal_id_inch: 0.064, distal_id_inch: 0.064 };
    const other = device('other', { proximal_od_inch: 0.03125, distal_od_inch: 0.03125 });
    const warning = device('warning', { proximal_od_inch: 0.03125, distal_od_inch: 0.03125 });
    const unknown = device('unknown', { proximal_od_inch: null, distal_od_inch: 0.03125 });
    expect(filterDeviceCandidates([warning, unknown], outer, other)).toEqual([warning, unknown]);
  });

  it('updates candidates when the parent changes or is cleared', () => {
    const candidates = [device('candidate')];
    const narrow = { ...guiding, distal_id_inch: 0.03 };
    expect(filterDeviceCandidates(candidates, narrow)).toEqual([]);
    expect(filterDeviceCandidates(candidates, guiding)).toEqual(candidates);
    expect(filterDeviceCandidates(candidates, null)).toEqual(candidates);
  });

  it('allows the same device twice when both fit, and restores candidates when the other is removed', () => {
    const candidate = device('candidate');
    expect(filterDeviceCandidates([candidate], guiding, candidate)).toEqual([candidate]);
    const widerOther = device('wider', { proximal_od_inch: 0.06 });
    expect(filterDeviceCandidates([candidate], guiding, widerOther)).toEqual([]);
    expect(filterDeviceCandidates([candidate], guiding, null)).toEqual([candidate]);
  });
});

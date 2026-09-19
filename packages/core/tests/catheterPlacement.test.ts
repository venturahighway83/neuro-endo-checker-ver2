import { describe, expect, it } from 'vitest';
import { placeCatheters, type PositionedTube } from '../../../apps/web/components/catheterPlacement';

describe('proximal shaft exposure', () => {
  const tubes: PositionedTube[] = [
    { id: 'g', length: 100, connectorLength: 5 },
    { id: 'i1', parentId: 'g', length: 120, connectorLength: 5 },
    { id: 'm1', parentId: 'i1', length: 150 },
  ];
  it('reserves 5 cm before the connector and subtracts it from distal protrusion', () => {
    const [g, inner, micro] = placeCatheters(tubes, 5, true);
    expect(g.proximalZ).toBe(0);
    expect(inner.proximalZ).toBe(-10);
    expect(micro.proximalZ).toBe(-20);
    expect(inner.proximalZ! + inner.length - (g.proximalZ! + g.length)).toBe(10);
    expect(micro.proximalZ! + micro.length - (inner.proximalZ! + inner.length)).toBe(20);
    expect([g.length, inner.length, micro.length]).toEqual([100, 120, 150]);
  });
  it('can measure 5 cm directly from the outer catheter root', () => {
    expect(placeCatheters(tubes, 5, false).map((tube) => tube.proximalZ)).toEqual([0, -5, -10]);
  });
  it('places siblings at the same insertion depth independently of order', () => {
    const parallel = [...tubes, { id: 'i2', parentId: 'g', length: 130, connectorLength: 5 }];
    const placed = placeCatheters(parallel.reverse(), 5, true);
    expect(placed.find((tube) => tube.id === 'i2')?.proximalZ).toBe(-10);
    expect(placed.find((tube) => tube.id === 'm1')?.proximalZ).toBe(-20);
  });
  it('does not stretch a short catheter or invent an absent parent', () => {
    const placed = placeCatheters([{ id: 'g', length: 100 }, { id: 'i1', parentId: 'g', length: 102 }], 5, true);
    expect(placed[1].proximalZ! + placed[1].length).toBe(97);
    expect(placeCatheters([{ id: 'i1', parentId: 'g', length: 120 }], 5, true)[0].proximalZ).toBe(0);
  });
});

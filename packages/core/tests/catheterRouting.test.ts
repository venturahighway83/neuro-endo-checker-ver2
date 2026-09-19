import { describe, expect, it } from 'vitest';
import { routeCatheters, routedSurface, type RoutedSpec } from '../../../apps/web/components/catheterRouting';
import { connectorPort } from '../../../apps/web/components/yConnector';

const tubes: RoutedSpec[] = [
  { id: 'g', length: 16, y: 0, proximalOuterR: 0.5, connector: 'tri', connectorLength: 0.8 },
  { id: 'i1', parentId: 'g', length: 19.2, y: 0.18, proximalOuterR: 0.18, connector: 'y', connectorLength: 0.8 },
  { id: 'i2', parentId: 'g', length: 20.8, y: -0.18, proximalOuterR: 0.18, connector: 'tri', connectorLength: 0.8 },
  { id: 'm1', parentId: 'i2', length: 24, y: -0.1, proximalOuterR: 0.08, connector: 'y', connectorLength: 0.8 },
  { id: 'm2', parentId: 'i2', length: 24, y: -0.26, proximalOuterR: 0.08, connector: 'y', connectorLength: 0.8 },
];

describe('central and side port routing', () => {
  it('passes through the actual port centres with five cm of exposed shaft', () => {
    const routes = routeCatheters(tubes, 0.8);
    for (const [id, side] of [['i1', false], ['i2', true]] as const) {
      const route = routes.get(id)!;
      const port = connectorPort(0.5, 0.8, side);
      expect(route.port).toBe(side ? 'side' : 'central');
      expect(route.path.getPointAt(0.8 / route.path.getLength()).distanceTo(port.inlet)).toBeLessThan(1e-6);
      expect(route.path.getPointAt(0).distanceTo(port.inlet)).toBeCloseTo(0.8, 6);
      expect(route.path.getTangentAt(0).dot(port.inward)).toBeCloseTo(1, 6);
    }
  });
  it('preserves whole catheter lengths including bends and nested routes', () => {
    const routes = routeCatheters(tubes, 0.8);
    for (const tube of tubes) expect(routes.get(tube.id)!.path.getLength()).toBeCloseTo(tube.length, 6);
    expect(routes.get('m2')!.port).toBe('side');
    expect(routes.get('m1')!.port).toBe('central');
    const parent = routes.get('i2')!;
    const inlet = connectorPort(0.18, 0.8, true).inlet.applyQuaternion(parent.rootRotation).add(parent.path.getPointAt(0));
    expect(routes.get('m2')!.path.getPointAt(0.8 / 24).distanceTo(inlet)).toBeLessThan(1e-6);
  });
  it('keeps parallel shafts separated inside the parent and makes finite geometry', () => {
    const routes = routeCatheters(tubes, 0.8);
    for (const id of ['i1', 'i2']) {
      const path = routes.get(id)!.path;
      const end = path.getPointAt(1);
      expect(end.y).toBeCloseTo(id === 'i1' ? 0.18 : -0.18, 6);
      const geometry = routedSurface(path, 0.18, 0.15);
      expect(Array.from(geometry.attributes.position.array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
    }
  });
  it('returns a remaining single catheter to the central Y inlet', () => {
    const single = [{ ...tubes[0], connector: 'y' as const }, tubes[2]];
    const route = routeCatheters(single, 0.8).get('i2')!;
    expect(route.port).toBeUndefined();
    expect(route.inlet!.y).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
// Three.js is a web-renderer dependency; core has no runtime dependency on it.
import * as THREE from '../../../apps/web/node_modules/three';
import type { Device } from '../src/types';
import { createCatheterHub, deviceHubDisplay, hubDisplayLabel } from '../../../apps/web/components/catheterHub';
import { routeCatheters, tipExtensionLabel, tipExtensionNeedsCaution, type RoutedSpec } from '../../../apps/web/components/catheterRouting';
import { connectorPort } from '../../../apps/web/components/yConnector';
import { placeCatheters } from '../../../apps/web/components/catheterPlacement';

const device: Device = { id: 'test', name: 'Test', category: 'マイクロ', maker: 'Test', length_cm: 150, id_inch: 0.02, od_fr: 3, notes: '' };

describe('3D hub display', () => {
  it('uses documented hub length and defaults an unregistered hub to 5 cm without changing source data', () => {
    const documented = { ...device, hub_length_cm: 6.3, proximal_non_effective_length_cm: 8 };
    expect(deviceHubDisplay(documented)).toEqual({ lengthCm: 6.3, basis: 'documented' });
    const derived = { ...device, hub_length_cm: null, proximal_non_effective_length_cm: 8 };
    expect(deviceHubDisplay(derived)).toEqual({ lengthCm: 5, basis: 'fallback' });
    expect(derived.hub_length_cm).toBeNull();
    expect(derived.length_cm).toBe(150);
    expect(derived.proximal_non_effective_length_cm).toBe(8);
    expect(hubDisplayLabel(deviceHubDisplay(derived))).toContain('未登録の想定値');
  });

  it('uses a clearly identified 5 cm display fallback for missing or invalid measurements', () => {
    for (const value of [undefined, null, 0, -1, NaN, Infinity]) {
      const unknown = { ...device, hub_length_cm: value, proximal_non_effective_length_cm: value };
      expect(deviceHubDisplay(unknown)).toEqual({ lengthCm: 5, basis: 'fallback' });
      expect(hubDisplayLabel(deviceHubDisplay(unknown))).toBe('5 cm（未登録の想定値）');
      expect(unknown.hub_length_cm).toBe(value);
    }
  });

  it('scales hub length with the shaft and keeps both ends open at their attachment planes', () => {
    for (const cm of [2, 5, 6.3, 10]) for (const lengthScale of [16 / 90, 16 / 165]) {
      const length = cm * lengthScale;
      const radius = 0.25, lumen = 0.2;
      const hub = createCatheterHub(radius, lumen, length, '#22d3ee');
      const bounds = new THREE.Box3().setFromObject(hub);
      expect(bounds.min.z).toBeCloseTo(-length, 6);
      expect(bounds.max.z).toBeCloseTo(0, 6);
      expect(bounds.max.x).toBeGreaterThan(radius);
      hub.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const position = object.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
          expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true);
          expect(Math.hypot(p.x, p.y)).toBeGreaterThanOrEqual(lumen - 1e-6);
        }
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose());
      });
    }
  });
});

describe('routing through hubs', () => {
  const tubes: RoutedSpec[] = [
    { id: 'g', length: 100, y: 0, proximalOuterR: 0.5, hubLength: 2, connector: 'y', connectorLength: 5 },
    { id: 'i', parentId: 'g', length: 120, y: 0, proximalOuterR: 0.2, hubLength: 6.3, connector: 'y', connectorLength: 5 },
    { id: 'm', parentId: 'i', length: 150, y: 0, proximalOuterR: 0.1, hubLength: 5, connector: 'y', connectorLength: 5 },
  ];

  it('warns at 5 cm and below, including zero and a tip that cannot reach', () => {
    for (const cm of [-10, -0.1, 0, 4.9, 5, 5 + 1e-12]) expect(tipExtensionNeedsCaution(cm)).toBe(true);
    for (const cm of [5.00001, 5.1, 15, NaN, Infinity]) expect(tipExtensionNeedsCaution(cm)).toBe(false);
    for (const scale of [1, 16 / 150, 16 / 165]) {
      const parent = { ...tubes[0], length: 130 * scale, hubLength: 10 * scale, connectorLength: 5 * scale,
        proximalOuterR: 0.5 * scale };
      for (const [cm, expected] of [[150, true], [150.1, false], [145, true], [144, true]] as const) {
        const child = { ...tubes[1], length: cm * scale, proximalOuterR: 0.2 * scale };
        const maximum = routeCatheters([parent, child], 0).get('i')!.tipExtension! / scale;
        expect(maximum).toBeCloseTo(cm - 130 - 10 - 5, 6);
        expect(tipExtensionNeedsCaution(maximum)).toBe(expected);
      }
    }
  });

  it('shows maximum insertion without subtracting the model exposure for RIST 95 and Guidepost 120', () => {
    const ristHub = deviceHubDisplay({ ...device, length_cm: 95, hub_length_cm: null });
    for (const scale of [1, 16 / 150]) {
      const selected = [
        { ...tubes[0], length: 95, hubLength: ristHub.lengthCm },
        { ...tubes[1], length: 120, hubLength: 10 },
        { ...tubes[2], length: 150, hubLength: 6.3 },
      ].map(tube => ({ ...tube, length: tube.length * scale, y: tube.y * scale,
        proximalOuterR: tube.proximalOuterR * scale, hubLength: tube.hubLength * scale, connectorLength: tube.connectorLength! * scale }));
      const displayed = routeCatheters(selected, 5 * scale);
      const maximum = routeCatheters(selected, 0);
      expect(displayed.get('i')!.tipExtension! / scale).toBeCloseTo(10, 6);
      expect(maximum.get('i')!.tipExtension! / scale).toBeCloseTo(15, 6);
      expect(maximum.get('m')!.tipExtension! / scale).toBeCloseTo(15, 6);
      expect(maximum.get('i')!.path.getPointAt(0).distanceTo(maximum.get('i')!.inlet!)).toBeCloseTo(0, 6);
      expect(displayed.get('i')!.path.getPointAt(0).distanceTo(displayed.get('i')!.inlet!) / scale).toBeCloseTo(5, 6);
      expect(ristHub.basis).toBe('fallback');
    }
    const parent = { ...tubes[0], length: 95, hubLength: 5 };
    const aligned = routeCatheters([parent, { ...tubes[1], length: 105 }], 0).get('i')!;
    const short = routeCatheters([parent, { ...tubes[1], length: 104.9 }], 0).get('i')!;
    expect(tipExtensionLabel(aligned.tipExtension!)).toBe('先端と同じ位置');
    expect(tipExtensionLabel(short.tipExtension!)).toBe('0.1 cm 手前');
  });

  it('subtracts the outer hub, connector and exposed shaft, including the 5 cm hub fallback', () => {
    for (const hubCm of [2, 10, null]) {
      const parentDevice = { ...device, length_cm: 90, hub_length_cm: hubCm };
      const hub = deviceHubDisplay(parentDevice);
      const parent = { ...tubes[0], length: 90, hubLength: hub.lengthCm };
      const child = { ...tubes[1], length: 130, hubLength: 5 };
      const routes = routeCatheters([parent, child], 5);
      expect(routes.get('i')!.tipExtension).toBeCloseTo(130 - 90 - (hubCm ?? 5) - 5 - 5, 6);
      expect(hub.basis === 'fallback').toBe(hubCm === null);
      // The inner device's own hub does not consume its usable shaft length.
      const changedChild = { ...child, hubLength: 10 };
      expect(routeCatheters([parent, changedChild], 5).get('i')!.tipExtension).toBeCloseTo(routes.get('i')!.tipExtension!, 6);
      expect(parentDevice.hub_length_cm).toBe(hubCm);
    }
  });

  it('counts parent hubs in insertion depth while preserving shaft length and five cm exposure', () => {
    const routes = routeCatheters(tubes, 5);
    const placed = placeCatheters(tubes, 5, true);
    for (const tube of placed) {
      const route = routes.get(tube.id)!;
      expect(route.path.getLength()).toBeCloseTo(tube.length, 6);
      expect(route.path.getPointAt(0).z).toBeCloseTo(tube.proximalZ!, 6);
    }
    expect(routes.get('i')!.inlet!.z).toBeCloseTo(-7);
    expect(routes.get('i')!.path.getPointAt(0).z).toBeCloseTo(-12);
    expect(routes.get('i')!.path.getPointAt(1).z).toBeCloseTo(108);
    expect(routes.get('m')!.path.getPointAt(0).z).toBeCloseTo(-28.3);
    expect(routes.get('m')!.path.getPointAt(1).z).toBeCloseTo(121.7);
    expect(routes.get('g')!.tipExtension).toBeUndefined();
    expect(routes.get('i')!.tipExtension).toBeCloseTo(8);
    expect(routes.get('m')!.tipExtension).toBeCloseTo(13.7);
  });

  it('moves the central and side inlets with the parent hub, including rotated nested hubs', () => {
    const branches: RoutedSpec[] = [
      { ...tubes[0], connector: 'tri' },
      tubes[1],
      { ...tubes[1], id: 'i2', y: -0.2, connector: 'tri' },
      { ...tubes[2], id: 'm1', parentId: 'i2', y: -0.1 },
      { ...tubes[2], id: 'm2', parentId: 'i2', y: -0.3 },
    ];
    const routes = routeCatheters(branches, 5);
    const maximum = routeCatheters(branches, 0);
    for (const tube of branches.filter(t => t.parentId)) {
      const parent = branches.find(t => t.id === tube.parentId)!;
      const parentRoute = routes.get(parent.id)!;
      const siblings = branches.filter(t => t.parentId === parent.id);
      const side = siblings.indexOf(tube) === 1;
      const opening = connectorPort(parent.proximalOuterR, parent.connectorLength!, side);
      opening.inlet.z -= parent.hubLength!;
      const expected = opening.inlet.applyQuaternion(parentRoute.rootRotation).add(parentRoute.path.getPointAt(0));
      const route = routes.get(tube.id)!;
      expect(route.inlet!.distanceTo(expected)).toBeLessThan(1e-6);
      expect(route.path.getPointAt(5 / tube.length).distanceTo(expected)).toBeLessThan(1e-6);
      expect(route.path.getLength()).toBeCloseTo(tube.length, 6);
      const beyondParent = route.path.getPointAt(1).sub(parentRoute.path.getPointAt(1)).dot(parentRoute.path.getTangentAt(1));
      expect(route.tipExtension).toBeGreaterThan(0);
      expect(route.tipExtension).toBeCloseTo(beyondParent, 6);
      const hubInlet = new THREE.Vector3(0, 0, -parent.hubLength!).applyQuaternion(parentRoute.rootRotation).add(parentRoute.path.getPointAt(0));
      expect(Math.min(...route.path.points.map(p => p.distanceTo(hubInlet)))).toBeLessThan(1e-6);
      expect(Math.min(...route.path.points.map(p => p.distanceTo(parentRoute.path.getPointAt(0))))).toBeLessThan(1e-6);
      const maximumRoute = maximum.get(tube.id)!;
      const maximumParent = maximum.get(parent.id)!;
      expect(maximumRoute.path.getPointAt(0).distanceTo(maximumRoute.inlet!)).toBeCloseTo(0, 6);
      expect(maximumRoute.path.getLength()).toBeCloseTo(tube.length, 6);
      const maximumBeyondParent = maximumRoute.path.getPointAt(1).sub(maximumParent.path.getPointAt(1)).dot(maximumParent.path.getTangentAt(1));
      expect(maximumRoute.tipExtension).toBeGreaterThan(0);
      expect(maximumRoute.tipExtension).toBeCloseTo(maximumBeyondParent, 6);
    }
  });

  it('keeps a short shaft short even if it cannot reach beyond the parent hub', () => {
    const short = { ...tubes[1], length: 6 };
    const route = routeCatheters([tubes[0], short], 5).get('i')!;
    expect(route.path.getLength()).toBeCloseTo(6);
    expect(route.path.getPointAt(1).z).toBeCloseTo(-6);
    expect(route.tipExtension).toBeCloseTo(-106);
    expect(tipExtensionLabel(route.tipExtension!)).toBe('106.0 cm 手前');
  });

  it('reports aligned tips and rounds tiny floating-point differences to zero', () => {
    const aligned = { ...tubes[1], length: 112 };
    const extension = routeCatheters([tubes[0], aligned], 5).get('i')!.tipExtension!;
    expect(extension).toBeCloseTo(0, 6);
    expect(tipExtensionLabel(extension)).toBe('先端と同じ位置');
    expect(tipExtensionLabel(-1e-8)).toBe('先端と同じ位置');
    expect(tipExtensionLabel(13.7)).toBe('13.7 cm 出る');
    expect(tipExtensionLabel(-0.1)).toBe('0.1 cm 手前');
  });

  it('converts the displayed distance back to cm independently of scene scale', () => {
    for (const scale of [16 / 90, 16 / 165]) {
      const scaled = tubes.map(tube => ({ ...tube, length: tube.length * scale, y: tube.y * scale,
        proximalOuterR: tube.proximalOuterR * scale, hubLength: tube.hubLength! * scale, connectorLength: tube.connectorLength! * scale }));
      const routes = routeCatheters(scaled, 5 * scale);
      expect(routes.get('i')!.tipExtension! / scale).toBeCloseTo(8, 6);
      expect(routes.get('m')!.tipExtension! / scale).toBeCloseTo(13.7, 6);
    }
  });
});

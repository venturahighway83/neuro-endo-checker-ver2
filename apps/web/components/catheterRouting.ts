import * as THREE from 'three';
import { connectorPort } from './yConnector';
import type { ConnectorKind } from './connectorKind';

export interface RoutedSpec {
  id: string;
  parentId?: string;
  length: number;
  y: number;
  proximalOuterR: number;
  connector?: ConnectorKind;
  connectorLength?: number;
  hubLength?: number;
}

/** Arc-length parameterised polyline: total length includes bends and exposure. */
export class CatheterPath extends THREE.Curve<THREE.Vector3> {
  private distances = [0];
  constructor(readonly points: THREE.Vector3[]) {
    super();
    for (let i = 1; i < points.length; i++) this.distances.push(this.distances[i - 1] + points[i].distanceTo(points[i - 1]));
  }
  getLength() { return this.distances[this.distances.length - 1]; }
  getPoint(t: number, target = new THREE.Vector3()) {
    const distance = Math.max(0, Math.min(1, t)) * this.getLength();
    let i = 1;
    while (i < this.distances.length - 1 && this.distances[i] < distance) i++;
    const span = this.distances[i] - this.distances[i - 1];
    return target.copy(this.points[i - 1]).lerp(this.points[i], span > 0 ? (distance - this.distances[i - 1]) / span : 0);
  }
  getPointAt(u: number, target?: THREE.Vector3) { return this.getPoint(u, target); }
  getTangentAt(u: number, target?: THREE.Vector3) { return this.getTangent(u, target); }
}

export interface RoutedTube {
  path: CatheterPath;
  rootRotation: THREE.Quaternion;
  port?: 'central' | 'side';
  inlet?: THREE.Vector3;
  /** Signed shaft length beyond the parent's distal end, in scene units. */
  tipExtension?: number;
}

export function routeCatheters(tubes: readonly RoutedSpec[], exposure: number): Map<string, RoutedTube> {
  const specs = new Map(tubes.map((tube) => [tube.id, tube]));
  const routes = new Map<string, RoutedTube>();
  const zAxis = new THREE.Vector3(0, 0, 1);
  function route(tube: RoutedSpec): RoutedTube {
    const existing = routes.get(tube.id);
    if (existing) return existing;
    const parent = tube.parentId ? specs.get(tube.parentId) : undefined;
    let points: THREE.Vector3[];
    let port: RoutedTube['port'];
    let inlet: THREE.Vector3 | undefined;
    let tipExtension: number | undefined;
    if (!parent) {
      points = [new THREE.Vector3(0, tube.y, 0), new THREE.Vector3(0, tube.y, tube.length)];
    } else {
      const parentRoute = route(parent);
      const siblings = tubes.filter((item) => item.parentId === parent.id);
      const side = parent.connector === 'tri' && siblings.indexOf(tube) === 1;
      if (parent.connector === 'tri') port = side ? 'side' : 'central';
      const opening = connectorPort(parent.proximalOuterR, parent.connectorLength ?? 0, side);
      const hubLength = parent.hubLength ?? 0;
      opening.inlet.z -= hubLength;
      opening.junction.z -= hubLength;
      const origin = parentRoute.path.getPoint(0);
      const world = (point: THREE.Vector3) => point.clone().applyQuaternion(parentRoute.rootRotation).add(origin);
      inlet = world(opening.inlet);
      const inward = opening.inward.clone().applyQuaternion(parentRoute.rootRotation);
      points = [inlet.clone().addScaledVector(inward, -exposure), inlet.clone(), world(opening.junction)];
      let bendInward = inward;
      if (hubLength > 0) {
        const hubInlet = world(new THREE.Vector3(0, 0, -hubLength));
        const parentAxis = zAxis.clone().applyQuaternion(parentRoute.rootRotation);
        const start = points[points.length - 1];
        const transitionLength = start.distanceTo(hubInlet);
        if (transitionLength > 1e-10) {
          const transition = new THREE.CubicBezierCurve3(start,
            start.clone().addScaledVector(inward, transitionLength / 3),
            hubInlet.clone().addScaledVector(parentAxis, -transitionLength / 3), hubInlet);
          points.push(...transition.getPoints(24).slice(1));
        }
        // Traverse the hub before entering the parent's shaft. This distance
        // consumes the child's existing shaft length, including in nested routes.
        points.push(origin.clone());
        bendInward = parentAxis;
      }
      const joinDistance = Math.min(parent.length * 0.04, Math.max(parent.connectorLength ?? 0, exposure) * 0.4);
      const offset = tube.y - parent.y;
      const inside = (distance: number) => {
        const u = Math.min(1, distance / parent.length);
        const tangent = parentRoute.path.getTangentAt(u);
        const normal = new THREE.Vector3(0, tangent.z, -tangent.y).normalize();
        return parentRoute.path.getPointAt(u).addScaledVector(normal, offset);
      };
      const join = inside(joinDistance);
      const tangent = parentRoute.path.getTangentAt(joinDistance / parent.length);
      const start = points[points.length - 1];
      const bend = new THREE.CubicBezierCurve3(start, start.clone().addScaledVector(bendInward, joinDistance * 0.6), join.clone().addScaledVector(tangent, -joinDistance * 0.6), join);
      points.push(...bend.getPoints(24).slice(1));
      for (let i = 1; i <= 160; i++) points.push(inside(joinDistance + (parent.length - joinDistance) * i / 160));
      // Use the same curved route as the mesh, including the connector, hub
      // and exposed proximal shaft. A negative value is the remaining distance.
      tipExtension = tube.length - new CatheterPath(points).getLength();
      points.push(points[points.length - 1].clone().addScaledVector(parentRoute.path.getTangentAt(1), tube.length));
    }
    // Trim the whole centreline to the device length; never add bend length to it.
    const trimmed = [points[0]];
    let remaining = tube.length;
    for (let i = 1; i < points.length && remaining > 1e-10; i++) {
      const start = trimmed[trimmed.length - 1];
      const distance = start.distanceTo(points[i]);
      if (distance < 1e-10) continue;
      trimmed.push(distance > remaining ? start.clone().lerp(points[i], remaining / distance) : points[i]);
      remaining -= Math.min(distance, remaining);
    }
    const path = new CatheterPath(trimmed);
    const result = { path, rootRotation: new THREE.Quaternion().setFromUnitVectors(zAxis, path.getTangentAt(0)), port, inlet, tipExtension };
    routes.set(tube.id, result);
    return result;
  }
  tubes.forEach(route);
  return routes;
}

export function tipExtensionLabel(cm: number): string {
  const tenths = Math.round(Math.abs(cm) * 10);
  if (tenths === 0) return '先端と同じ位置';
  return `${(tenths / 10).toFixed(1)} cm ${cm > 0 ? '出る' : '手前'}`;
}

export function tipExtensionNeedsCaution(cm: number): boolean {
  // Remove only numerical noise from the scaled curve before the inclusive check.
  return Number.isFinite(cm) && Math.round(cm * 1e9) / 1e9 <= 5;
}

/** Sweep a tapered hollow-tube surface around its routed centreline. */
export function routedSurface(path: CatheterPath, proximal: number, distal: number) {
  const geometry = new THREE.TubeGeometry(path, 240, 1, 32, false);
  const positions = geometry.attributes.position;
  for (let segment = 0; segment <= 240; segment++) {
    const u = segment / 240;
    const centre = path.getPointAt(u);
    const radius = THREE.MathUtils.lerp(proximal, distal, u);
    for (let ring = 0; ring <= 32; ring++) {
      const i = segment * 33 + ring;
      positions.setXYZ(i, centre.x + (positions.getX(i) - centre.x) * radius, centre.y + (positions.getY(i) - centre.y) * radius, centre.z + (positions.getZ(i) - centre.z) * radius);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

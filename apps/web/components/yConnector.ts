import * as THREE from 'three';
import type { ConnectorKind } from './connectorKind';

// User-specified approximate axial length; width remains schematic.
export const Y_CONNECTOR_LENGTH_CM = 5;

/** Axial length uses the catheter length scale, independently of diameter. */
export function createYConnector(radius: number, lumenRadius: number, length: number, kind: ConnectorKind = 'y'): THREE.Group {
  const group = new THREE.Group();
  group.name = kind === 'tri' ? 'Tri connector (schematic)' : 'Y connector (schematic)';
  const shell = new THREE.MeshStandardMaterial({
    color: '#dbeafe', transparent: true, opacity: 0.36,
    roughness: 0.22, metalness: 0.12, depthWrite: false, side: THREE.DoubleSide,
  });
  const collar = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.3, metalness: 0.3 });
  const seal = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 });
  const r = radius;

  function sleeve(start: THREE.Vector3, end: THREE.Vector3, outer: number, inner: number, material: THREE.Material) {
    const axis = end.clone().sub(start);
    const part = new THREE.Group();
    part.position.copy(start);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
    const length = axis.length();
    const outside = new THREE.Mesh(new THREE.CylinderGeometry(outer, outer, length, 48, 1, true), material);
    outside.position.y = length / 2;
    part.add(outside);
    const inside = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, length, 48, 1, true), material);
    inside.position.y = length / 2;
    part.add(inside);
    for (const y of [0, length]) {
      const rim = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48), material);
      rim.rotation.x = y === 0 ? Math.PI / 2 : -Math.PI / 2;
      rim.position.y = y;
      part.add(rim);
    }
    group.add(part);
  }
  const point = (z: number) => new THREE.Vector3(0, 0, z * r);
  const lumen = Math.min(lumenRadius, r * 0.94);
  // Distal locking collar connects directly to the catheter at z=0.
  sleeve(point(-0.6), point(0), r * 1.08, lumen, collar);
  sleeve(point(-3.8), point(-0.6), r * 1.18, lumen, shell);
  sleeve(point(-4.5), point(-3.8), r * 1.42, lumen, collar);
  sleeve(point(-4.6), point(-4.5), r * 1.13, lumen, seal);
  // Angled side port and its open luer rim.
  const branchStart = new THREE.Vector3(0, r * 0.78, -r * 1.55);
  const branchEnd = new THREE.Vector3(0, r * 2.7, -r * 3.05);
  sleeve(branchStart, branchEnd, r * 0.42, r * 0.29, shell);
  const direction = branchEnd.clone().sub(branchStart).normalize();
  sleeve(branchEnd, branchEnd.clone().addScaledVector(direction, r * 0.32), r * 0.55, r * 0.29, collar);
  // Raised ribs around the rotating valve cap.
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI * 2 / 16;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(r * 0.11, r * 0.16, r * 0.62), collar);
    rib.position.set(Math.sin(angle) * r * 1.42, Math.cos(angle) * r * 1.42, -r * 4.15);
    rib.rotation.z = -angle;
    group.add(rib);
  }
  if (kind === 'tri') {
    // A second, valved catheter inlet opposite the narrow side port.
    const start = new THREE.Vector3(0, -r * 0.55, -r * 1.5);
    const end = new THREE.Vector3(0, -r * 2.1, -r * 3.05);
    const axis = end.clone().sub(start).normalize();
    sleeve(start, end, r * 0.67, r * 0.48, shell);
    const capEnd = end.clone().addScaledVector(axis, r * 0.65);
    sleeve(end, capEnd, r * 1.03, r * 0.48, collar);
    sleeve(capEnd, capEnd.clone().addScaledVector(axis, r * 0.08), r * 0.78, r * 0.48, seal);
    const valveRibs = new THREE.Group();
    valveRibs.position.copy(end.clone().addScaledVector(axis, r * 0.325));
    valveRibs.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI * 2 / 12;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(r * 0.1, r * 0.15, r * 0.54), collar);
      rib.position.set(Math.sin(angle) * r * 1.03, Math.cos(angle) * r * 1.03, 0);
      rib.rotation.z = -angle;
      valveRibs.add(rib);
    }
    group.add(valveRibs);
    const marker = new THREE.MeshStandardMaterial({ color: '#f472b6', roughness: 0.4 });
    sleeve(point(-0.42), point(-0.31), r * 1.1, lumen, marker);
  }
  group.scale.z = length / (4.6 * r);
  return group;
}

import * as THREE from 'three';

/** Illustration only: connector proportions are not measured device dimensions. */
export function createYConnector(radius: number, lumenRadius: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Y connector (schematic)';
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
  return group;
}

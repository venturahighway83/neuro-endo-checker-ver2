import type { Device } from '@neuro-endo/core';
import * as THREE from 'three';

export const DEFAULT_HUB_LENGTH_CM = 5;
export type HubLengthBasis = 'documented' | 'fallback';
export interface HubDisplay {
  lengthCm: number;
  basis: HubLengthBasis;
}

/** Shared outer radius at the hub-to-connector attachment. */
export function hubConnectorRadius(shaftRadius: number): number {
  return shaftRadius * 1.6;
}

/** Display policy only: never write a fallback or a derived assembly length into the master. */
export function deviceHubDisplay(device: Device): HubDisplay {
  const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (valid(device.hub_length_cm)) return { lengthCm: device.hub_length_cm, basis: 'documented' };
  return { lengthCm: DEFAULT_HUB_LENGTH_CM, basis: 'fallback' };
}

export function hubDisplayLabel(hub: HubDisplay): string {
  const basis = { documented: '資料記載', fallback: '未登録の想定値' };
  return `${hub.lengthCm} cm（${basis[hub.basis]}）`;
}

/** Generic hollow hub: shaft attachment at z=0, connector attachment at z=-length.
 * Only axial length is sourced. The taper, width and collar are schematic.
 */
export function createCatheterHub(radius: number, lumenRadius: number, length: number, color: string): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Catheter hub (schematic)';
  // Shift to a neighbouring hue within the device's colour family.
  const hubColor = new THREE.Color(color).multiplyScalar(0.48);
  const hue = hubColor.getHSL({ h: 0, s: 0, l: 0 }).h;
  hubColor.offsetHSL(hue < 0.18 ? -0.025 : 0.035, 0.12, 0);
  const edgeColor = hubColor.clone().lerp(new THREE.Color('#ffffff'), 0.22);
  const shell = new THREE.MeshPhysicalMaterial({
    color: hubColor, roughness: 0.38, metalness: 0.04, clearcoat: 0.35,
    transparent: true, opacity: 0.96, depthWrite: false,
  });
  const bore = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5, side: THREE.BackSide });
  const collar = new THREE.MeshStandardMaterial({ color: hubColor.clone().multiplyScalar(0.5), roughness: 0.4, metalness: 0.08 });
  const rim = new THREE.MeshStandardMaterial({ color: edgeColor, roughness: 0.4, side: THREE.DoubleSide });
  const lumen = Math.min(lumenRadius, radius * 0.94);
  const collarRadius = hubConnectorRadius(radius);
  function sleeve(from: number, to: number, proximalRadius: number, distalRadius: number, material: THREE.Material) {
    const surface = (proximal: number, distal: number) => {
      const geometry = new THREE.CylinderGeometry(distal, proximal, to - from, 48, 1, true);
      geometry.rotateX(Math.PI / 2);
      geometry.translate(0, 0, (from + to) / 2);
      return geometry;
    };
    group.add(new THREE.Mesh(surface(proximalRadius, distalRadius), material));
    group.add(new THREE.Mesh(surface(lumen, lumen), bore));
  }
  sleeve(-length * 0.42, 0, radius * 1.3, radius, shell);
  sleeve(-length * 0.88, -length * 0.42, collarRadius, radius * 1.3, shell);
  sleeve(-length, -length * 0.88, collarRadius, collarRadius, collar);
  for (const [z, outer] of [[0, radius], [-length, collarRadius]]) {
    const cap = new THREE.Mesh(new THREE.RingGeometry(lumen, outer, 48), rim);
    cap.position.z = z;
    group.add(cap);
  }
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI * 2 / 12;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.1, radius * 0.16, length * 0.08), rim);
    rib.position.set(Math.sin(angle) * collarRadius, Math.cos(angle) * collarRadius, -length * 0.94);
    rib.rotation.z = -angle;
    group.add(rib);
  }
  return group;
}

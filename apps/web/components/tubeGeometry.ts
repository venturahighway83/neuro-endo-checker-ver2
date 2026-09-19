import type { Device } from '@neuro-endo/core';
import { frToMm, inchToMm } from '@neuro-endo/core';
import * as THREE from 'three';

export interface TubeRadii {
  proximalOuterR: number;
  distalOuterR: number;
  proximalInnerR: number;
  distalInnerR: number;
}

function radiusPair(proximal: number | null | undefined, distal: number | null | undefined, fallbackMm: number): [number, number] {
  const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
  // A taper requires both endpoints. A lone measurement does not define a shape.
  return valid(proximal) && valid(distal)
    ? [inchToMm(proximal) / 2, inchToMm(distal) / 2]
    : [fallbackMm / 2, fallbackMm / 2];
}

export function deviceTubeRadii(device: Device, scale = 1): TubeRadii {
  const [po, dO] = radiusPair(device.proximal_od_inch, device.distal_od_inch, frToMm(device.od_fr));
  const [pi, di] = radiusPair(device.proximal_id_inch, device.distal_id_inch, inchToMm(device.id_inch));
  return { proximalOuterR: po * scale, distalOuterR: dO * scale, proximalInnerR: pi * scale, distalInnerR: di * scale };
}

export function maxOuterRadius(radii: TubeRadii): number {
  return Math.max(radii.proximalOuterR, radii.distalOuterR);
}

/** Straight axis, linear diameter interpolation: proximal z=0 → distal z=length. */
export function tubeSurface(proximalRadius: number, distalRadius: number, length: number): THREE.CylinderGeometry {
  const geometry = new THREE.CylinderGeometry(distalRadius, proximalRadius, length, 48, 1, true);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, length / 2);
  return geometry;
}

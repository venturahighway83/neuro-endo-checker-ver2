import type { Device } from '@neuro-endo/core';
import { checkCompatibility, checkDualCompatibility } from '@neuro-endo/core';

/** Hide only confirmed incompatibilities; missing measurements remain selectable. */
export function filterDeviceCandidates(
  devices: Device[],
  outer: Device | null,
  otherInner: Device | null = null,
): Device[] {
  if (!outer) return devices;

  return devices.filter((candidate) => {
    if (checkCompatibility({ outer, inner: candidate }).status === 'incompatible') return false;
    return !otherInner || checkDualCompatibility({ outer, inner1: candidate, inner2: otherInner }).status !== 'incompatible';
  });
}

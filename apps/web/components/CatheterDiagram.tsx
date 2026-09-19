'use client';

import { useState, useEffect } from 'react';
import type { Device, CompatibilityResult } from '@neuro-endo/core';
import { deviceTubeRadii, maxOuterRadius } from './tubeGeometry';
import { CatheterCanvas } from './CatheterCanvas';
import type { TubeSpec } from './CatheterCanvas';
import { Y_CONNECTOR_LENGTH_CM } from './yConnector';
import { connectorKind } from './connectorKind';
import { placeCatheters } from './catheterPlacement';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  overlayTop?: number;
  guiding:      Device | null;
  inner1:       Device | null;
  inner2:       Device | null;
  micro1a:      Device | null;
  micro1b:      Device | null;
  micro2a:      Device | null;
  micro2b:      Device | null;
  result_g_i1:  CompatibilityResult | null;
  result_g_i2:  CompatibilityResult | null;
  result_i1_m1: CompatibilityResult | null;
  result_i1_m2: CompatibilityResult | null;
  result_i2_m1: CompatibilityResult | null;
  result_i2_m2: CompatibilityResult | null;
}

// ── Colour palette ────────────────────────────────────────────────────────────

type C = { fill: string; dark: string; lumen: string };
type DeviceKind = 'guiding' | 'intermediate' | 'micro';

function col(kind: DeviceKind, variant: 1 | 2 = 1, status?: CompatibilityResult['status']): C {
  if (status === 'incompatible') return { fill: '#ef4444', dark: '#7f1d1d', lumen: '#3b0000' };
  if (status === 'warning')     return { fill: '#f97316', dark: '#7c2d12', lumen: '#431407' };
  switch (kind) {
    case 'guiding':      return { fill: '#f97316', dark: '#7c2d12', lumen: '#431407' };
    case 'intermediate':
      return variant === 1
        ? { fill: '#22c55e', dark: '#14532d', lumen: '#052e16' }
        : { fill: '#10b981', dark: '#065f46', lumen: '#022c22' };
    case 'micro':
      return variant === 1
        ? { fill: '#3b82f6', dark: '#1e3a8a', lumen: '#0f172a' }
        : { fill: '#2563eb', dark: '#1e40af', lumen: '#0c1633' };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CatheterDiagram({
  overlayTop = 0,
  guiding, inner1, inner2,
  micro1a, micro1b, micro2a, micro2b,
  result_g_i1, result_g_i2,
  result_i1_m1, result_i1_m2,
  result_i2_m1, result_i2_m2,
}: Props) {
  // Prevent server-side rendering of the WebGL canvas
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const hasAny = !!(guiding || inner1 || inner2 || micro1a || micro1b || micro2a || micro2b);

  if (!hasAny) {
    return (
      <div className="flex items-center justify-center w-full h-full text-sm text-gray-500">
        上のパネルからデバイスを選択するとここに図が表示されます
      </div>
    );
  }

  if (!mounted) {
    return <div style={{ position: 'absolute', inset: 0, background: '#111827' }} />;
  }

  // ── Scale factors ───────────────────────────────────────────────────────────
  const allDevices = ([guiding, inner1, inner2, micro1a, micro1b, micro2a, micro2b]
    .filter((d): d is Device => d != null));
  const maxOD  = Math.max(...allDevices.map((d) => maxOuterRadius(deviceTubeRadii(d)) * 2));
  const maxLen = Math.max(...allDevices.map((d) => d.length_cm));

  // Schematic display: shorten the axis and emphasise diameters for readability.
  // All catheter/connector lengths still share one scale; diameter ratios also
  // remain consistent across the selected devices.
  const LS = 16 / maxLen;
  const RS = (Y_CONNECTOR_LENGTH_CM * LS * 3) / (2.3 * maxOD);

  const radii = (device: Device) => deviceTubeRadii(device, RS);
  const r3 = (device: Device) => maxOuterRadius(radii(device));
  const l3  = (cm: number)   => cm * LS;

  // ── Y packing ─────────────────────────────────────────────────────────────
  const ro_i1 = inner1 ? r3(inner1) : 0;
  const ro_i2 = inner2 ? r3(inner2) : 0;
  const hasDualInner = !!(inner1 && inner2);
  const y_i1 = hasDualInner ?  ro_i2 : 0;
  const y_i2 = hasDualInner ? -ro_i1 : 0;

  const ro_m1b = micro1b ? r3(micro1b) : 0;
  const ro_m1a = micro1a ? r3(micro1a) : 0;
  const hasDualMicro1 = !!(micro1a && micro1b);
  const y_m1a = y_i1 + (hasDualMicro1 ?  ro_m1b : 0);
  const y_m1b = y_i1 + (hasDualMicro1 ? -ro_m1a : 0);

  const ro_m2b = micro2b ? r3(micro2b) : 0;
  const ro_m2a = micro2a ? r3(micro2a) : 0;
  const hasDualMicro2 = !!(micro2a && micro2b);
  const y_m2a = y_i2 + (hasDualMicro2 ?  ro_m2b : 0);
  const y_m2b = y_i2 + (hasDualMicro2 ? -ro_m2a : 0);

  // ── Tube specs ─────────────────────────────────────────────────────────────
  const tubes: TubeSpec[] = [];

  if (guiding) tubes.push({
    id: 'g', label: `G: ${guiding.name}`,
    ...radii(guiding),
    length: l3(guiding.length_cm), y: 0,
    c: col('guiding'),
  });
  if (inner1) tubes.push({
    id: 'i1', label: `内①: ${inner1.name}`,
    ...radii(inner1),
    length: l3(inner1.length_cm), y: y_i1,
    c: col(inner1.category === '中間' ? 'intermediate' : 'micro', 1, result_g_i1?.status),
  });
  if (inner2) tubes.push({
    id: 'i2', label: `内②: ${inner2.name}`,
    ...radii(inner2),
    length: l3(inner2.length_cm), y: y_i2,
    c: col(inner2.category === '中間' ? 'intermediate' : 'micro', 2, result_g_i2?.status),
  });
  if (micro1a) tubes.push({
    id: 'm1a', label: `M①a: ${micro1a.name}`,
    ...radii(micro1a),
    length: l3(micro1a.length_cm), y: y_m1a,
    c: col('micro', 1, result_i1_m1?.status),
  });
  if (micro1b) tubes.push({
    id: 'm1b', label: `M①b: ${micro1b.name}`,
    ...radii(micro1b),
    length: l3(micro1b.length_cm), y: y_m1b,
    c: col('micro', 2, result_i1_m2?.status),
  });
  if (micro2a) tubes.push({
    id: 'm2a', label: `M②a: ${micro2a.name}`,
    ...radii(micro2a),
    length: l3(micro2a.length_cm), y: y_m2a,
    c: col('micro', 1, result_i2_m1?.status),
  });
  if (micro2b) tubes.push({
    id: 'm2b', label: `M②b: ${micro2b.name}`,
    ...radii(micro2b),
    length: l3(micro2b.length_cm), y: y_m2b,
    c: col('micro', 2, result_i2_m2?.status),
  });

  // Reserve 5 cm of exposed shaft before each parent's connector inlet.
  const deviceByTube: Record<string, Device | null> = {
    g: guiding, i1: inner1, i2: inner2,
    m1a: micro1a, m1b: micro1b, m2a: micro2a, m2b: micro2b,
  };
  const childrenByTube: Record<string, (Device | null)[]> = {
    g: [inner1, inner2], i1: [micro1a, micro1b], i2: [micro2a, micro2b],
  };
  for (const tube of tubes) {
    const device = deviceByTube[tube.id];
    tube.connector = connectorKind(device?.category, childrenByTube[tube.id] ?? []);
    if (tube.connector) {
      tube.connectorLength = l3(Y_CONNECTOR_LENGTH_CM);
    }
    tube.parentId = tube.id === 'g' ? undefined
      : tube.id.startsWith('m1') ? 'i1' : tube.id.startsWith('m2') ? 'i2' : 'g';
  }
  const positionedTubes = placeCatheters(tubes, l3(5), true);

  const totalLen = maxLen * LS;
  const maxR3    = (maxOD / 2) * RS;
  const camPos: [number, number, number] = [totalLen * 0.9, totalLen * 0.6, totalLen * 0.8];

  return (
    <CatheterCanvas
      overlayTop={overlayTop}
      tubes={positionedTubes}
      totalLen={totalLen}
      maxR3={maxR3}
      camPos={camPos}
      proximalExposure={l3(5)}
    />
  );
}

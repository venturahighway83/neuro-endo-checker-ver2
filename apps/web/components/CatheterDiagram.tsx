'use client';

import { useState, useEffect } from 'react';
import type { Device, CompatibilityResult } from '@neuro-endo/core';
import { frToMm, inchToMm } from '@neuro-endo/core';
import { CatheterCanvas } from './CatheterCanvas';
import type { TubeSpec } from './CatheterCanvas';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
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
    case 'guiding':      return { fill: '#3b82f6', dark: '#1e3a8a', lumen: '#0f172a' };
    case 'intermediate':
      return variant === 1
        ? { fill: '#22c55e', dark: '#14532d', lumen: '#052e16' }
        : { fill: '#10b981', dark: '#065f46', lumen: '#022c22' };
    case 'micro':
      return variant === 1
        ? { fill: '#f97316', dark: '#7c2d12', lumen: '#431407' }
        : { fill: '#ea580c', dark: '#9a3412', lumen: '#3a1505' };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CatheterDiagram({
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
  const maxOD  = Math.max(...allDevices.map((d) => frToMm(d.od_fr)));
  const maxLen = Math.max(...allDevices.map((d) => d.length_cm));

  const RS = 12 / maxOD;
  const LS = 22 / maxLen;

  const r3  = (fr: number)   => frToMm(fr)    * RS / 2;
  const ri3 = (inch: number) => inchToMm(inch) * RS / 2;
  const l3  = (cm: number)   => cm * LS;

  // ── Y packing ─────────────────────────────────────────────────────────────
  const ro_i1 = inner1 ? r3(inner1.od_fr) : 0;
  const ro_i2 = inner2 ? r3(inner2.od_fr) : 0;
  const hasDualInner = !!(inner1 && inner2);
  const y_i1 = hasDualInner ?  ro_i2 : 0;
  const y_i2 = hasDualInner ? -ro_i1 : 0;

  const ro_m1b = micro1b ? r3(micro1b.od_fr) : 0;
  const ro_m1a = micro1a ? r3(micro1a.od_fr) : 0;
  const hasDualMicro1 = !!(micro1a && micro1b);
  const y_m1a = y_i1 + (hasDualMicro1 ?  ro_m1b : 0);
  const y_m1b = y_i1 + (hasDualMicro1 ? -ro_m1a : 0);

  const ro_m2b = micro2b ? r3(micro2b.od_fr) : 0;
  const ro_m2a = micro2a ? r3(micro2a.od_fr) : 0;
  const hasDualMicro2 = !!(micro2a && micro2b);
  const y_m2a = y_i2 + (hasDualMicro2 ?  ro_m2b : 0);
  const y_m2b = y_i2 + (hasDualMicro2 ? -ro_m2a : 0);

  // ── Tube specs ─────────────────────────────────────────────────────────────
  const tubes: TubeSpec[] = [];

  if (guiding) tubes.push({
    id: 'g', label: `G: ${guiding.name}`,
    outerR: r3(guiding.od_fr), innerR: ri3(guiding.id_inch),
    length: l3(guiding.length_cm), y: 0,
    c: col('guiding'),
  });
  if (inner1) tubes.push({
    id: 'i1', label: `内①: ${inner1.name}`,
    outerR: r3(inner1.od_fr), innerR: ri3(inner1.id_inch),
    length: l3(inner1.length_cm), y: y_i1,
    c: col(inner1.category === '中間' ? 'intermediate' : 'micro', 1, result_g_i1?.status),
  });
  if (inner2) tubes.push({
    id: 'i2', label: `内②: ${inner2.name}`,
    outerR: r3(inner2.od_fr), innerR: ri3(inner2.id_inch),
    length: l3(inner2.length_cm), y: y_i2,
    c: col(inner2.category === '中間' ? 'intermediate' : 'micro', 2, result_g_i2?.status),
  });
  if (micro1a) tubes.push({
    id: 'm1a', label: `M①a: ${micro1a.name}`,
    outerR: r3(micro1a.od_fr), innerR: ri3(micro1a.id_inch),
    length: l3(micro1a.length_cm), y: y_m1a,
    c: col('micro', 1, result_i1_m1?.status),
  });
  if (micro1b) tubes.push({
    id: 'm1b', label: `M①b: ${micro1b.name}`,
    outerR: r3(micro1b.od_fr), innerR: ri3(micro1b.id_inch),
    length: l3(micro1b.length_cm), y: y_m1b,
    c: col('micro', 2, result_i1_m2?.status),
  });
  if (micro2a) tubes.push({
    id: 'm2a', label: `M②a: ${micro2a.name}`,
    outerR: r3(micro2a.od_fr), innerR: ri3(micro2a.id_inch),
    length: l3(micro2a.length_cm), y: y_m2a,
    c: col('micro', 1, result_i2_m1?.status),
  });
  if (micro2b) tubes.push({
    id: 'm2b', label: `M②b: ${micro2b.name}`,
    outerR: r3(micro2b.od_fr), innerR: ri3(micro2b.id_inch),
    length: l3(micro2b.length_cm), y: y_m2b,
    c: col('micro', 2, result_i2_m2?.status),
  });

  const totalLen = maxLen * LS;
  const maxR3    = (maxOD / 2) * RS;
  const camPos: [number, number, number] = [maxR3 * 4, maxR3 * 6, totalLen * 1.5];

  return (
    <CatheterCanvas
      tubes={tubes}
      totalLen={totalLen}
      maxR3={maxR3}
      camPos={camPos}
    />
  );
}

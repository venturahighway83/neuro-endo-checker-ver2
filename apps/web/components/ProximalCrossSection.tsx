import type { Device } from '@neuro-endo/core';
import { frToMm, inchToMm } from '@neuro-endo/core';
import { deviceColor } from './deviceColors';

interface Props {
  guiding: Device | null;
  inner1: Device | null;
  inner2: Device | null;
  micro1a: Device | null;
  micro1b: Device | null;
  micro2a: Device | null;
  micro2b: Device | null;
}

const valid = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

export function ProximalCrossSection(props: Props) {
  function make(device: Device | null, label: string, variant: 1 | 2 = 1) {
    if (!device) return null;
    const outerKnown = valid(device.proximal_od_inch);
    const innerKnown = valid(device.proximal_id_inch);
    return {
      device, label, x: 0,
      outer: (outerKnown ? inchToMm(device.proximal_od_inch!) : frToMm(device.od_fr)) / 2,
      inner: (innerKnown ? inchToMm(device.proximal_id_inch!) : inchToMm(device.id_inch)) / 2,
      outerKnown, innerKnown,
      color: deviceColor(device.category === 'ガイディング' ? 'guiding'
        : device.category === '中間' ? 'intermediate' : 'micro', variant).fill,
    };
  }
  type Section = NonNullable<ReturnType<typeof make>>;
  const g = make(props.guiding, 'G');
  const i1 = make(props.inner1, '①');
  const i2 = make(props.inner2, '②', 2);
  const m1a = make(props.inner1?.category === '中間' ? props.micro1a : null, '①a');
  const m1b = make(props.inner1?.category === '中間' ? props.micro1b : null, '①b', 2);
  const m2a = make(props.inner2?.category === '中間' ? props.micro2a : null, '②a');
  const m2b = make(props.inner2?.category === '中間' ? props.micro2b : null, '②b', 2);
  function place(a: Section | null, b: Section | null, center: number) {
    if (a) a.x = center - (b?.outer ?? 0);
    if (b) b.x = center + (a?.outer ?? 0);
  }
  place(i1, i2, 0);
  place(m1a, m1b, i1?.x ?? 0);
  place(m2a, m2b, i2?.x ?? 0);
  const sections = [g, i1, i2, m1a, m1b, m2a, m2b].filter((s): s is Section => s !== null);
  const extent = Math.max(0.01, ...sections.map(s => Math.abs(s.x) + Math.max(s.outer, s.inner))) * 1.08;
  const fallback = sections.some(s => !s.outerKnown || !s.innerKnown);

  return (
    <section aria-label="近位端の断面図" className="w-64 shrink-0 rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2">
      <h2 className="text-sm font-semibold text-gray-300">近位端の断面図</h2>
      {sections.length ? <>
        <svg role="img" aria-label="選択デバイスの近位径の組み合わせ" viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`} className="mx-auto h-48 w-full">
          {sections.map(s => (
            <g key={s.label}>
              <title>{s.device.name}</title>
              <circle cx={s.x} cy={0} r={s.outer} fill={s.color} fillOpacity={0.35} stroke={s.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray={s.outerKnown ? undefined : '4 3'} />
              <circle cx={s.x} cy={0} r={s.inner} fill="#111827" stroke={s.color} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray={s.innerKnown ? undefined : '4 3'} />
            </g>
          ))}
        </svg>
        <p className="text-[10px] leading-4 text-gray-500">近位径の組み合わせを同一縮尺で表示</p>
        {fallback && <p className="text-[10px] leading-4 text-amber-400">破線：近位径未登録のため一般径で参考表示</p>}
      </> : <p className="flex h-36 items-center justify-center text-xs text-gray-500">デバイスを選択すると表示されます</p>}
    </section>
  );
}

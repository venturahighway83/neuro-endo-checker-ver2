import type { Device } from '@neuro-endo/core';
import { frToMm, inchToMm, mmToInch } from '@neuro-endo/core';
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

  function gap(outer: Section | null, inners: (Section | null)[], label: string) {
    if (!outer || inners.some(inner => inner === null)) return null;
    const selected = inners.filter((inner): inner is Section => inner !== null);
    const known = valid(outer.inner) && selected.every(inner => valid(inner.outer));
    return {
      label,
      devices: `${outer.device.name} ↔ ${selected.map(inner => inner.device.name).join(' ＋ ')}`,
      // Use the same radii as the drawing; report the diameter difference before margin.
      inch: known
        ? Number(mmToInch(2 * (outer.inner - selected.reduce((sum, inner) => sum + inner.outer, 0))).toFixed(12))
        : null,
      reference: known && (!outer.innerKnown || selected.some(inner => !inner.outerKnown)),
    };
  }
  const gaps = [
    gap(g, [i1], 'ガイディング ↔ 内腔①'),
    gap(g, [i2], 'ガイディング ↔ 内腔②'),
    gap(g, [i1, i2], 'ガイディング ↔ 内腔①＋②'),
    gap(i1, [m1a], '内腔① ↔ マイクロ①'),
    gap(i1, [m1b], '内腔① ↔ マイクロ②'),
    gap(i1, [m1a, m1b], '内腔① ↔ マイクロ①＋②'),
    gap(i2, [m2a], '内腔② ↔ マイクロ①'),
    gap(i2, [m2b], '内腔② ↔ マイクロ②'),
    gap(i2, [m2a, m2b], '内腔② ↔ マイクロ①＋②'),
  ].filter(row => row !== null);

  return (
    <section aria-label="近位端の断面図" className="w-80 max-w-full shrink-0 self-start rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <h2 className="shrink-0 text-sm font-semibold text-gray-300">近位端の断面図</h2>
        {fallback && <p className="text-right text-[10px] leading-3 text-amber-400">破線：近位径未登録のため<br />一般径で参考表示</p>}
      </div>
      {sections.length ? <>
        <svg role="img" aria-label="選択デバイスの近位径の組み合わせ" viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`} className="mx-auto h-40 w-full">
          {sections.map(s => (
            <g key={s.label}>
              <title>{s.device.name}</title>
              <circle cx={s.x} cy={0} r={s.outer} fill={s.color} fillOpacity={0.35} stroke={s.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeDasharray={s.outerKnown ? undefined : '4 3'} />
              <circle cx={s.x} cy={0} r={s.inner} fill="#111827" stroke={s.color} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray={s.innerKnown ? undefined : '4 3'} />
            </g>
          ))}
        </svg>
        {gaps.length > 0 && (
          <div className="mt-2 border-t border-gray-700 pt-2">
            <dl aria-label="カテーテル間の隙間" className="space-y-2">
              {gaps.map(row => (
                <div key={row.label} title={row.devices} className="flex items-center justify-between gap-2 text-xs leading-5">
                  <dt className="min-w-0 text-sm font-bold text-gray-400">
                    <span className="whitespace-nowrap">{row.label.split(' ↔ ')[0]}</span>
                    {' ↔ '}
                    <span className="whitespace-nowrap">{row.label.split(' ↔ ')[1]}</span>
                  </dt>
                  <dd className={`grid min-w-[8.25rem] shrink-0 grid-cols-[auto_4ch] items-baseline gap-x-1 border-2 px-2 py-1.5 text-right font-mono text-sm tabular-nums ${row.inch !== null && row.inch < 0 ? 'border-red-400/70 bg-red-950/40 text-red-300' : 'border-gray-500 bg-gray-800 text-gray-100'}`}>
                    <span className="text-xl font-bold leading-6">{row.inch === null ? '—' : row.inch.toFixed(3)}</span>
                    {row.inch !== null && <span>inch</span>}
                    {row.reference && <span className="col-start-2 text-center font-sans text-[9px] leading-[10px] text-amber-400">参考</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </> : <p className="flex h-36 items-center justify-center text-xs text-gray-500">デバイスを選択すると表示されます</p>}
    </section>
  );
}

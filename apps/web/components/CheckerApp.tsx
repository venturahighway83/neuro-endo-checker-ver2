'use client';

import { useState, useMemo } from 'react';
import type { Device, CompatibilityResult, DualCompatibilityResult } from '@neuro-endo/core';
import { checkCompatibility, checkDualCompatibility } from '@neuro-endo/core';
import { DevicePanel } from './DevicePanel';
import { filterDeviceCandidates } from './deviceCandidates';
import { DeviceConnections } from './DeviceConnections';
import { CatheterDiagram } from './CatheterDiagram';
import { ProximalCrossSection } from './ProximalCrossSection';
import { checkLabel, STATUS_LABEL, STATUS_BG, STATUS_TEXT, STATUS_BORDER } from './statusUtils';

interface Props {
  guidingDevices: Device[];
  intermediateDevices: Device[];
  microDevices: Device[];
}

// ── Compact result cards (right panel) ────────────────────────────────────────

function ResultCard({ label, result }: { label: string; result: CompatibilityResult }) {
  const { status, reasons, derived_metrics: dm } = result;
  const checks = reasons.map((r) => {
    const name = checkLabel(r);
    const icon = r.status === 'ok' ? '✓' : r.status === 'warning' ? '⚠' : r.status === 'incompatible' ? '✕' : '–';
    return `${name}${icon}`;
  }).join('　');
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded border px-2.5 py-1.5 ${STATUS_BORDER[status]}`}>
      <span className={`text-sm font-bold px-1.5 py-0.5 rounded-full text-white shrink-0 ${STATUS_BG[status]}`}>
        {STATUS_LABEL[status]}
      </span>
      <span className="text-sm text-gray-300 truncate flex-1 min-w-0">{label}</span>
      <span className={`text-xs font-mono shrink-0 ${STATUS_TEXT[status]}`}>{checks}</span>
      {dm.clearance_mm !== null && (
        <span title="近位・遠位のうち小さい方の余裕（マージン適用後）" className={`text-xs font-mono font-semibold shrink-0 ${STATUS_TEXT[status]}`}>
          {dm.clearance_mm >= 0 ? '+' : ''}{dm.clearance_mm.toFixed(2)}mm
        </span>
      )}
    </div>
  );
}

function DualResultCard({ label, result }: { label: string; result: DualCompatibilityResult }) {
  const { status, reasons, derived_metrics: dm } = result;
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded border px-2.5 py-1.5 ${STATUS_BORDER[status]}`}>
      <span className={`text-sm font-bold px-1.5 py-0.5 rounded-full text-white shrink-0 ${STATUS_BG[status]}`}>
        2本&nbsp;{STATUS_LABEL[status]}
      </span>
      <span className="text-sm text-gray-300 truncate flex-1 min-w-0">{label}</span>
      <span className={`text-xs font-mono shrink-0 ${STATUS_TEXT[status]}`}>
        {reasons.map((r) => `${checkLabel(r)}${r.status === 'ok' ? '✓' : r.status === 'warning' ? '⚠' : r.status === 'incompatible' ? '✕' : '–'}`).join('　')}
      </span>
      {dm.clearance_mm !== null && (
        <span title="近位・遠位のうち小さい方の余裕（マージン適用後）" className={`text-xs font-mono font-semibold shrink-0 ${STATUS_TEXT[status]}`}>
          {dm.clearance_mm >= 0 ? '+' : ''}{dm.clearance_mm.toFixed(2)}mm
        </span>
      )}
    </div>
  );
}

// ── Micro device dropdowns ─────────────────────────────────────

function MicroColumn({
  outer, outerLabel, parentId, microDevices,
  micro1, setMicro1,
  micro2, setMicro2,
  showMicro2, setShowMicro2,
}: {
  outer: Device | null;
  outerLabel: string;
  parentId: string;
  microDevices: Device[];
  micro1: Device | null; setMicro1: (d: Device | null) => void;
  micro2: Device | null; setMicro2: (d: Device | null) => void;
  showMicro2: boolean;   setShowMicro2: (v: boolean) => void;
}) {
  const micro1Candidates = useMemo(
    () => filterDeviceCandidates(microDevices, outer, showMicro2 ? micro2 : null),
    [microDevices, outer, showMicro2, micro2],
  );
  const micro2Candidates = useMemo(
    () => filterDeviceCandidates(microDevices, outer, micro1),
    [microDevices, outer, micro1],
  );
  function removeMicro2() { setShowMicro2(false); setMicro2(null); }

  return (
    <div className="flex flex-col gap-2">
      <DevicePanel
        nodeId={`${parentId}-m1`} parentId={parentId}
        title={`マイクロ（${outerLabel}内）①`}
        devices={micro1Candidates}
        filteringActive={!!outer}
        selected={micro1}
        onSelect={setMicro1}
      />
      {showMicro2 ? (
        <div className="flex items-start gap-1">
          <div className="flex-1">
            <DevicePanel
              nodeId={`${parentId}-m2`} parentId={parentId}
              title={`マイクロ（${outerLabel}内）②`}
              devices={micro2Candidates}
              filteringActive={!!outer}
              selected={micro2}
              onSelect={setMicro2}
            />
          </div>
          <button
            onClick={removeMicro2}
            className="mt-5 text-sm bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-400 hover:text-red-400 hover:border-red-600 shrink-0"
            title="2本目を削除"
          >✕</button>
        </div>
      ) : (
        <button
          onClick={() => setShowMicro2(true)}
          className="h-7 w-full text-sm border border-dashed border-gray-600 rounded text-gray-500 hover:text-blue-400 hover:border-blue-500 transition-colors"
        >
          ＋ マイクロ2本目追加
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CheckerApp({ guidingDevices, intermediateDevices, microDevices }: Props) {
  // ── Device selections ──────────────────────────────────────────────────────
  const [guiding, setGuiding] = useState<Device | null>(null);

  const [inner1, setInner1] = useState<Device | null>(null);
  const [inner2, setInner2] = useState<Device | null>(null);
  const [showInner2, setShowInner2] = useState(false);

  const [micro_i1_1, setMicro_i1_1] = useState<Device | null>(null);
  const [micro_i1_2, setMicro_i1_2] = useState<Device | null>(null);
  const [showMicro2_i1, setShowMicro2_i1] = useState(false);

  const [micro_i2_1, setMicro_i2_1] = useState<Device | null>(null);
  const [micro_i2_2, setMicro_i2_2] = useState<Device | null>(null);
  const [showMicro2_i2, setShowMicro2_i2] = useState(false);

  // ── Derived flags ──────────────────────────────────────────────────────────
  const innerDevices = useMemo(
    () => [...intermediateDevices, ...microDevices],
    [intermediateDevices, microDevices]
  );
  const inner1IsIntermediate = inner1?.category === '中間';
  const inner2IsIntermediate = showInner2 && inner2?.category === '中間';

  const inner1Candidates = useMemo(
    () => filterDeviceCandidates(innerDevices, guiding, showInner2 ? inner2 : null),
    [innerDevices, guiding, showInner2, inner2],
  );
  const inner2Candidates = useMemo(
    () => filterDeviceCandidates(innerDevices, guiding, inner1),
    [innerDevices, guiding, inner1],
  );

  // ── Compatibility results ──────────────────────────────────────────────────
  const result_g_i1 = useMemo(
    () => guiding && inner1 ? checkCompatibility({ outer: guiding, inner: inner1 }) : null,
    [guiding, inner1]
  );
  const result_g_i2 = useMemo(
    () => guiding && inner2 ? checkCompatibility({ outer: guiding, inner: inner2 }) : null,
    [guiding, inner2]
  );
  const result_dual_g = useMemo(
    () => guiding && inner1 && inner2
      ? checkDualCompatibility({ outer: guiding, inner1, inner2 })
      : null,
    [guiding, inner1, inner2]
  );

  const result_i1_m1 = useMemo(
    () => inner1IsIntermediate && inner1 && micro_i1_1
      ? checkCompatibility({ outer: inner1, inner: micro_i1_1 }) : null,
    [inner1, micro_i1_1, inner1IsIntermediate]
  );
  const result_i1_m2 = useMemo(
    () => inner1IsIntermediate && inner1 && micro_i1_2
      ? checkCompatibility({ outer: inner1, inner: micro_i1_2 }) : null,
    [inner1, micro_i1_2, inner1IsIntermediate]
  );
  const result_dual_i1 = useMemo(
    () => inner1IsIntermediate && inner1 && micro_i1_1 && micro_i1_2
      ? checkDualCompatibility({ outer: inner1, inner1: micro_i1_1, inner2: micro_i1_2 }) : null,
    [inner1, micro_i1_1, micro_i1_2, inner1IsIntermediate]
  );

  const result_i2_m1 = useMemo(
    () => inner2IsIntermediate && inner2 && micro_i2_1
      ? checkCompatibility({ outer: inner2, inner: micro_i2_1 }) : null,
    [inner2, micro_i2_1, inner2IsIntermediate]
  );
  const result_i2_m2 = useMemo(
    () => inner2IsIntermediate && inner2 && micro_i2_2
      ? checkCompatibility({ outer: inner2, inner: micro_i2_2 }) : null,
    [inner2, micro_i2_2, inner2IsIntermediate]
  );
  const result_dual_i2 = useMemo(
    () => inner2IsIntermediate && inner2 && micro_i2_1 && micro_i2_2
      ? checkDualCompatibility({ outer: inner2, inner1: micro_i2_1, inner2: micro_i2_2 }) : null,
    [inner2, micro_i2_1, micro_i2_2, inner2IsIntermediate]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleRemoveInner2() {
    setShowInner2(false);
    setInner2(null);
    setMicro_i2_1(null);
    setMicro_i2_2(null);
    setShowMicro2_i2(false);
  }

  const hasIncompatibleResult = [
    result_g_i1, result_g_i2, result_dual_g,
    result_i1_m1, result_i1_m2, result_dual_i1,
    result_i2_m1, result_i2_m2, result_dual_i2,
  ].some((result) => result?.status === 'incompatible');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative isolate flex flex-col h-full overflow-y-auto bg-gray-900">

      {/* ── Device selection + results ── */}
      <div className="relative z-10 shrink-0 flex flex-wrap gap-x-4 gap-y-3 px-4 py-3 border-b border-gray-700/60 bg-gray-800/60">

        {/* Left: device dropdowns */}
        <div className="flex-1 min-w-0 overflow-x-auto pb-2">

          <DeviceConnections>
          <div className="flex flex-col gap-3">
          {/* Row 1: guiding + inner① + micro① — all in the same row */}
          <div className="flex gap-12 items-start">
            <div className="w-64 shrink-0">
              <DevicePanel
                nodeId="guiding"
                title="ガイディング"
                devices={guidingDevices}
                selected={guiding}
                onSelect={setGuiding}
              />
            </div>
            <div className="w-64 shrink-0">
              <DevicePanel
                nodeId="inner1" parentId="guiding"
                title="内腔カテーテル①"
                devices={inner1Candidates}
                filteringActive={!!guiding}
                selected={inner1}
                onSelect={setInner1}
              />
            </div>
            {inner1IsIntermediate && (
              <div className="w-64 shrink-0">
                <MicroColumn
                  outer={inner1}
                  outerLabel="内腔①" parentId="inner1"
                  microDevices={microDevices}
                  micro1={micro_i1_1} setMicro1={setMicro_i1_1}
                  micro2={micro_i1_2} setMicro2={setMicro_i1_2}
                  showMicro2={showMicro2_i1} setShowMicro2={setShowMicro2_i1}
                />
              </div>
            )}
          </div>

          {/* Row 2: guiding spacer + inner② + micro②, or + add button */}
          {showInner2 ? (
            <div className="flex gap-12 items-start">
              {/* spacer to align inner② under inner① */}
              <div className="w-64 shrink-0" aria-hidden />
              <div className="relative w-64 shrink-0">
                <div className="w-64">
                  <DevicePanel
                    nodeId="inner2" parentId="guiding"
                    title="内腔カテーテル②"
                    devices={inner2Candidates}
                    filteringActive={!!guiding}
                    selected={inner2}
                    onSelect={setInner2}
                  />
                </div>
                <button
                  onClick={handleRemoveInner2}
                  className="absolute -right-6 top-5 text-sm bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-gray-400 hover:text-red-400 hover:border-red-600 shrink-0"
                  title="2本目を削除"
                >✕</button>
              </div>
              {inner2IsIntermediate && (
                <div className="w-64 shrink-0">
                  <MicroColumn
                    outer={inner2}
                    outerLabel="内腔②" parentId="inner2"
                    microDevices={microDevices}
                    micro1={micro_i2_1} setMicro1={setMicro_i2_1}
                    micro2={micro_i2_2} setMicro2={setMicro_i2_2}
                    showMicro2={showMicro2_i2} setShowMicro2={setShowMicro2_i2}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-12">
              {/* spacer to align add button under inner① */}
              <div className="w-64 shrink-0" aria-hidden />
              <button
                onClick={() => setShowInner2(true)}
                className="h-7 w-64 text-sm border border-dashed border-gray-600 rounded text-gray-500 hover:text-blue-400 hover:border-blue-500 transition-colors"
              >
                ＋ 内腔2本目追加
              </button>
            </div>
          )}
          </div>
          </DeviceConnections>
        </div>

        <ProximalCrossSection
          guiding={guiding} inner1={inner1} inner2={showInner2 ? inner2 : null}
          micro1a={micro_i1_1} micro1b={showMicro2_i1 ? micro_i1_2 : null}
          micro2a={showInner2 ? micro_i2_1 : null}
          micro2b={showInner2 && showMicro2_i2 ? micro_i2_2 : null}
        />
      </div>

        {/* Only incompatible results are shown, above the 3D view. */}
        {hasIncompatibleResult && (
        <div className="relative z-10 shrink-0 border-b border-gray-700/60 bg-gray-900 px-4 py-2">
          <div className="text-sm font-semibold text-gray-400 mb-0.5">適合性チェック</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5">
          {result_g_i1?.status === 'incompatible' && (
            <ResultCard label="ガイディング → 内腔①" result={result_g_i1} />
          )}
          {result_g_i2?.status === 'incompatible' && (
            <ResultCard label="ガイディング → 内腔②" result={result_g_i2} />
          )}
          {result_dual_g?.status === 'incompatible' && (
            <DualResultCard label="ガイディング → 内腔①②同時" result={result_dual_g} />
          )}
          {result_i1_m1?.status === 'incompatible' && (
            <ResultCard label="内腔① → マイクロ①" result={result_i1_m1} />
          )}
          {result_i1_m2?.status === 'incompatible' && (
            <ResultCard label="内腔① → マイクロ②" result={result_i1_m2} />
          )}
          {result_dual_i1?.status === 'incompatible' && (
            <DualResultCard label="内腔① → マイクロ①②同時" result={result_dual_i1} />
          )}
          {result_i2_m1?.status === 'incompatible' && (
            <ResultCard label="内腔② → マイクロ①" result={result_i2_m1} />
          )}
          {result_i2_m2?.status === 'incompatible' && (
            <ResultCard label="内腔② → マイクロ②" result={result_i2_m2} />
          )}
          {result_dual_i2?.status === 'incompatible' && (
            <DualResultCard label="内腔② → マイクロ①②同時" result={result_dual_i2} />
          )}
          </div>
        </div>
        )}

      {/* ── Catheter diagram ── */}
      <div className="relative z-0 min-h-[240px] flex-1">
        <CatheterDiagram
          overlayTop={0}
          guiding={guiding}
          inner1={inner1}
          inner2={showInner2 ? inner2 : null}
          micro1a={micro_i1_1}
          micro1b={showMicro2_i1 ? micro_i1_2 : null}
          micro2a={showInner2 ? micro_i2_1 : null}
          micro2b={showInner2 && showMicro2_i2 ? micro_i2_2 : null}
          result_g_i1={result_g_i1}
          result_g_i2={showInner2 ? result_g_i2 : null}
          result_i1_m1={result_i1_m1}
          result_i1_m2={showMicro2_i1 ? result_i1_m2 : null}
          result_i2_m1={showInner2 ? result_i2_m1 : null}
          result_i2_m2={showInner2 && showMicro2_i2 ? result_i2_m2 : null}
        />
      </div>
    </div>
  );
}

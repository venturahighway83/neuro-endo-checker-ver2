'use client';

import type { DualCompatibilityResult, CompatibilityResult } from '@neuro-endo/core';
import { STATUS_LABEL, STATUS_BG, STATUS_TEXT, STATUS_BORDER } from './statusUtils';

interface Props {
  dualResult: DualCompatibilityResult | null;
  result1: CompatibilityResult | null;
  result2: CompatibilityResult | null;
  outerLabel: string;
}

export function DualResultConnector({ dualResult, result1, result2, outerLabel }: Props) {
  if (!dualResult && !result1 && !result2) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 w-20 shrink-0 text-gray-300">
        <div className="text-xs text-center leading-tight">{outerLabel}</div>
        <div className="text-xl">→</div>
        <div className="text-xs font-bold">2本</div>
      </div>
    );
  }

  // Fall back to 'unknown' when dual result not yet computed (one inner not yet selected)
  const dualStatus = dualResult?.status ?? 'unknown';
  const dm = dualResult?.derived_metrics ?? null;

  return (
    <div className={`flex flex-col items-center gap-1 w-24 shrink-0 rounded-lg border p-2 ${STATUS_BORDER[dualStatus]}`}>

      {/* 2-in-1 overall badge */}
      <div className={`${STATUS_BG[dualStatus]} text-white text-xs font-bold px-1 py-0.5 rounded-full w-full text-center leading-tight`}>
        2本 {STATUS_LABEL[dualStatus]}
      </div>

      {/* Arrow */}
      <div className={`text-lg font-bold ${STATUS_TEXT[dualStatus]}`}>→</div>

      {/* Individual 1-in-1 mini-badges */}
      <div className="w-full flex gap-0.5">
        {(['①', '②'] as const).map((label, i) => {
          const r = i === 0 ? result1 : result2;
          if (!r) return null;
          const st = r.status;
          return (
            <div key={label}
              className={`flex-1 text-center text-xs font-semibold py-0.5 rounded ${STATUS_BG[st]} text-white`}>
              {label}単体<br />{STATUS_LABEL[st]}
            </div>
          );
        })}
      </div>

      {/* Combined clearance */}
      {dm?.clearance_mm != null && (
        <div className="w-full border-t border-current border-opacity-20 pt-1">
          <div className="text-xs text-gray-500 text-center">最小余裕</div>
          <div className={`text-xs font-mono text-center font-semibold ${STATUS_TEXT[dualStatus]}`}>
            {dm.clearance_mm >= 0 ? '+' : ''}{dm.clearance_mm.toFixed(3)}mm
          </div>
          {dm.combined_od_mm != null && (
            <div className="text-xs text-gray-400 text-center font-mono">
              合計OD {dm.combined_od_mm.toFixed(2)}mm
            </div>
          )}
        </div>
      )}
    </div>
  );
}

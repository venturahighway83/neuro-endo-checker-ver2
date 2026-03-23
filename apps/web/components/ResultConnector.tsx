'use client';

import type { CompatibilityResult } from '@neuro-endo/core';
import { STATUS_LABEL, STATUS_BG, STATUS_TEXT, STATUS_BORDER } from './statusUtils';

interface Props {
  result: CompatibilityResult | null;
  outerLabel: string;
  innerLabel: string;
}

const CHECK_LABEL: Record<string, string> = {
  diameter: '径',
  diameter_dual: '径(2本)',
  length: '長さ',
  category: 'カテゴリ',
};

const CHECK_STATUS_ICON: Record<string, string> = {
  ok: '✓',
  warning: '⚠',
  incompatible: '✕',
  unknown: '?',
};

export function ResultConnector({ result, outerLabel, innerLabel }: Props) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 w-16 shrink-0 text-gray-300">
        <div className="text-xs text-center leading-tight">{outerLabel}</div>
        <div className="text-xl">→</div>
        <div className="text-xs text-center leading-tight">{innerLabel}</div>
      </div>
    );
  }

  const { status, reasons, derived_metrics: dm } = result;

  return (
    <div className={`flex flex-col items-center gap-1 w-20 shrink-0 rounded-lg border p-2 ${STATUS_BORDER[status]}`}>
      {/* Status badge */}
      <div className={`${STATUS_BG[status]} text-white text-xs font-bold px-2 py-0.5 rounded-full w-full text-center`}>
        {STATUS_LABEL[status]}
      </div>

      {/* Arrow */}
      <div className={`text-lg font-bold ${STATUS_TEXT[status]}`}>→</div>

      {/* Individual checks */}
      <div className="w-full space-y-0.5">
        {reasons.map((r) => (
          <div key={r.check} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{CHECK_LABEL[r.check]}</span>
            <span className={STATUS_TEXT[r.status]}>
              {CHECK_STATUS_ICON[r.status]}
            </span>
          </div>
        ))}
      </div>

      {/* Clearance */}
      {dm.clearance_mm !== null && (
        <div className="w-full border-t border-current border-opacity-20 pt-1 mt-0.5">
          <div className="text-xs text-gray-500 text-center">隙間</div>
          <div className={`text-xs font-mono text-center font-semibold ${STATUS_TEXT[status]}`}>
            {dm.clearance_mm >= 0 ? '+' : ''}{(dm.clearance_mm).toFixed(3)}mm
          </div>
        </div>
      )}
    </div>
  );
}

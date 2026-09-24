'use client';

import type { CompatibilityResult, CheckOutcome } from '@neuro-endo/core';
import { checkLabel, STATUS_LABEL, STATUS_BG, STATUS_TEXT, STATUS_BORDER } from './statusUtils';

interface Props {
  result: CompatibilityResult;
  label: string;
}

const CODE_LABEL: Record<string, string> = {
  DIAMETER_OK: '通過可能',
  DIAMETER_INCOMPATIBLE: '通過不可（径が大きすぎる）',
  DIAMETER_UNKNOWN: 'データ不足',
  CATEGORY_ADJACENT: '隣接カテゴリ（標準）',
  CATEGORY_SKIP: '1段階スキップ',
  CATEGORY_REVERSED: 'カテゴリ逆転',
  CATEGORY_SAME: '同一カテゴリ',
  CATEGORY_UNKNOWN: '不明カテゴリ',
  LENGTH_SUFFICIENT: '長さ十分',
  LENGTH_INSUFFICIENT: '長さ不足（到達不可）',
  LENGTH_UNKNOWN: 'データ不足',
};

const STATUS_ICON: Record<string, string> = {
  ok: '✓',
  warning: '⚠',
  incompatible: '✕',
  unknown: '–',
};

function CheckRow({ outcome }: { outcome: CheckOutcome }) {
  return (
    <div className={`rounded border px-3 py-2 ${STATUS_BORDER[outcome.status]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">{checkLabel(outcome)}チェック</span>
        <span className={`text-xs font-bold flex items-center gap-1 ${STATUS_TEXT[outcome.status]}`}>
          <span>{STATUS_ICON[outcome.status]}</span>
          <span>{STATUS_LABEL[outcome.status]}</span>
        </span>
      </div>
      <div className="text-xs text-gray-700">{CODE_LABEL[outcome.code] ?? outcome.code}</div>
    </div>
  );
}

export function ResultDetail({ result, label }: Props) {
  const { status, reasons, derived_metrics: dm } = result;

  return (
    <div className="flex-1 min-w-64 max-w-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className={`${STATUS_BG[status]} text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* Check results */}
      <div className="space-y-2 mb-4">
        {reasons.map((r) => (
          <CheckRow key={`${r.check}-${r.region ?? ''}`} outcome={r} />
        ))}
      </div>

      {/* Derived metrics */}
      <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-xs font-semibold text-gray-500 mb-2">
          計測値{dm.limiting_region && `（余裕が小さい${dm.limiting_region === 'proximal' ? '近位' : '遠位'}）`}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {dm.outer_id_mm !== null && (
            <>
              <div className="text-xs text-gray-500">外側 ID</div>
              <div className="text-xs font-mono text-gray-700">{dm.outer_id_mm.toFixed(3)} mm</div>
            </>
          )}
          {dm.inner_od_mm !== null && (
            <>
              <div className="text-xs text-gray-500">内側 OD</div>
              <div className="text-xs font-mono text-gray-700">{dm.inner_od_mm.toFixed(3)} mm</div>
            </>
          )}
          {dm.clearance_mm !== null && (
            <>
              <div className="text-xs text-gray-500">隙間（margin後）</div>
              <div className={`text-xs font-mono font-semibold ${dm.clearance_mm >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {dm.clearance_mm >= 0 ? '+' : ''}{dm.clearance_mm.toFixed(3)} mm
              </div>
            </>
          )}
          {dm.length_delta_cm !== null && (
            <>
              <div className="text-xs text-gray-500">長さ差</div>
              <div className={`text-xs font-mono font-semibold ${dm.length_delta_cm >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {dm.length_delta_cm >= 0 ? '+' : ''}{dm.length_delta_cm} cm
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import type { CheckOutcome, CheckStatus } from '@neuro-endo/core';

export function checkLabel(outcome: CheckOutcome): string {
  if (outcome.region) return outcome.region === 'proximal' ? '近位径' : '遠位径';
  if (outcome.check === 'category') return 'カテゴリ';
  if (outcome.check === 'length') return '長さ';
  return '径';
}

export const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: '適合',
  warning: '注意',
  incompatible: '不適合',
  unknown: '不明',
};

export const STATUS_BG: Record<CheckStatus, string> = {
  ok: 'bg-green-500',
  warning: 'bg-amber-500',
  incompatible: 'bg-red-500',
  unknown: 'bg-gray-400',
};

export const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: 'text-green-400',
  warning: 'text-amber-400',
  incompatible: 'text-red-400',
  unknown: 'text-gray-400',
};

export const STATUS_BORDER: Record<CheckStatus, string> = {
  ok: 'border-green-700 bg-green-950',
  warning: 'border-amber-700 bg-amber-950',
  incompatible: 'border-red-700 bg-red-950',
  unknown: 'border-gray-600 bg-gray-800',
};

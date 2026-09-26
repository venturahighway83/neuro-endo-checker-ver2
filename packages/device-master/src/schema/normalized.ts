import { z } from 'zod';
import type { Device, DeviceMaster } from '@neuro-endo/core';

/**
 * Valid category values — must stay in sync with `Category` in @neuro-endo/core/types.
 * Listed in nesting order (outer → inner).
 */
export const VALID_CATEGORIES = ['ガイディング', '中間', 'マイクロ'] as const;
export type ValidCategory = (typeof VALID_CATEGORIES)[number];

export const SOURCE_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSgVsdmTcaWlepz42z8pHGNGn5VjT9FADDr-Tl4Nm7dEw7IxoeBXJJ-TEMm1qXzCbntsa2-94h43fbF/pubhtml';

/**
 * Zod schema for a single normalized device.
 * The inferred type must be structurally compatible with `Device` from @neuro-endo/core.
 *
 * Diameter fields:
 *   id_inch — inner diameter in inches  (upstream id_mm is always empty)
 *   od_fr   — outer diameter in French  (upstream od_mm is always empty)
 *
 * Numeric constraints:
 *   All three numeric fields must be strictly positive.
 *   Zero is rejected — a catheter with zero diameter is physically impossible
 *   and most likely a data entry error.
 */
export const NormalizedDeviceSchema = z.object({
  id: z.string().min(1, 'id は空にできません'),
  name: z.string().min(1, 'name は空にできません'),
  category: z.enum(VALID_CATEGORIES),
  maker: z.string().min(1, 'maker は空にできません'),
  id_inch: z.number().positive('id_inch は正の数値でなければなりません'),
  od_fr: z.number().positive('od_fr は正の数値でなければなりません'),
  length_cm: z.number().positive('length_cm は正の数値でなければなりません'),
  notes: z.string(),
  proximal_id_inch: z.number().finite().positive().nullable(),
  proximal_od_inch: z.number().finite().positive().nullable(),
  distal_id_inch: z.number().finite().positive().nullable(),
  distal_od_inch: z.number().finite().positive().nullable(),
  hub_length_cm: z.number().finite().positive().nullable(),
  hub_length_source: z.string().default(''),
  proximal_non_effective_length_cm: z.number().finite().positive().nullable().default(null),
  proximal_length_source: z.string().url().or(z.literal('')).default(''),
  proximal_length_note: z.string().default(''),
});

export type NormalizedDevice = z.infer<typeof NormalizedDeviceSchema>;

// Compile-time assertion: NormalizedDevice must be assignable to Device.
// If this line causes a type error, the schemas are out of sync.
type _AssertCompatibleWithDevice = NormalizedDevice extends Device ? true : never;
const _check: _AssertCompatibleWithDevice = true as const;
void _check;

export const DeviceMasterSchema = z.object({
  schema_version: z.string().min(1),
  generated_at: z.string().min(1),
  source_url: z.string().url(),
  devices: z.array(NormalizedDeviceSchema),
});

export type NormalizedDeviceMaster = z.infer<typeof DeviceMasterSchema>;

// Compile-time assertion: NormalizedDeviceMaster must be assignable to DeviceMaster.
type _AssertCompatibleWithDeviceMaster = NormalizedDeviceMaster extends DeviceMaster
  ? true
  : never;
const _check2: _AssertCompatibleWithDeviceMaster = true as const;
void _check2;

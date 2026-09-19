import { z } from 'zod';

/**
 * Zod schema for a single raw row as produced by Google Sheets CSV export
 * (parsed with papaparse header:true — all values are strings).
 *
 * Column inventory (as of the current upstream sheet):
 *
 *   name        string   required   device display name
 *   category    string   required   one of VALID_CATEGORIES (validated separately)
 *   maker       string   required   manufacturer name
 *   id_mm       string   UNRESOLVED always empty upstream; tolerated, warn if populated
 *   od_mm       string   UNRESOLVED always empty upstream; tolerated, warn if populated
 *   length_cm   string   required   parseable as positive number
 *   id_inch     string   required   parseable as positive number
 *   od_fr       string   required   parseable as positive number
 *   notes       string   optional   free text
 *
 * UNRESOLVED columns are kept in the schema so we can detect if the upstream
 * ever starts populating them (and issue a warning).
 */
export const RawDeviceRowSchema = z.object({
  name: z
    .string({ required_error: 'name 列が見つかりません' })
    .trim()
    .min(1, 'name は空にできません'),

  category: z
    .string({ required_error: 'category 列が見つかりません' })
    .trim()
    .min(1, 'category は空にできません'),

  maker: z
    .string({ required_error: 'maker 列が見つかりません' })
    .trim()
    .min(1, 'maker は空にできません'),

  // UNRESOLVED: id_mm は upstream で常に空。将来のデータ変更を検知するために保持。
  id_mm: z.string().default(''),

  // UNRESOLVED: od_mm は upstream で常に空。同上。
  od_mm: z.string().default(''),

  length_cm: z
    .string({ required_error: 'length_cm 列が見つかりません' })
    .trim()
    .min(1, 'length_cm は空にできません'),

  id_inch: z
    .string({ required_error: 'id_inch 列が見つかりません' })
    .trim()
    .min(1, 'id_inch は空にできません'),

  od_fr: z
    .string({ required_error: 'od_fr 列が見つかりません' })
    .trim()
    .min(1, 'od_fr は空にできません'),

  notes: z.string().default(''),
  proximal_id_inch: z.string().trim().default(''),
  proximal_od_inch: z.string().trim().default(''),
  distal_id_inch: z.string().trim().default(''),
  distal_od_inch: z.string().trim().default(''),
});

export type RawDeviceRow = z.infer<typeof RawDeviceRowSchema>;

export const REGIONAL_DIAMETER_COLUMNS = [
  'proximal_id_inch', 'proximal_od_inch', 'distal_id_inch', 'distal_od_inch',
] as const;

/** Columns that are part of the raw schema but not mapped to the normalized output. */
export const UNRESOLVED_COLUMNS = ['id_mm', 'od_mm'] as const;
export type UnresolvedColumn = (typeof UNRESOLVED_COLUMNS)[number];

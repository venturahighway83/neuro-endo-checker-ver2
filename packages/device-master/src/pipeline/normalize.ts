import type { ValidCategory } from '../schema/normalized';
import { NormalizedDeviceSchema, DeviceMasterSchema, SOURCE_URL } from '../schema/normalized';
import { RawDeviceRowSchema } from '../schema/raw';
import type { ValidationReport } from './validate';
import { generateSlug, makeUniqueSlug } from './slug';

/**
 * Maps English category names (as exported by Google Sheets) to the canonical
 * Japanese values used throughout the app.
 * If the value is already in Japanese, it passes through unchanged.
 */
const CATEGORY_EN_TO_JA: Readonly<Record<string, string>> = {
  Guiding: 'ガイディング',
  Intermediate: '中間',
  Microcatheter: 'マイクロ',
};

function normalizeCategory(raw: string): string {
  return CATEGORY_EN_TO_JA[raw.trim()] ?? raw.trim();
}

export const SCHEMA_VERSION = '0.1.0';

/**
 * Converts validated raw rows into a `DeviceMaster` object.
 *
 * Prerequisites:
 *   - `report.valid` must be true (no errors). Call `validateRawRows` first.
 *   - `rows` must be the same array passed to `validateRawRows`.
 *
 * Transformations applied per row:
 *   1. Trim whitespace (Zod already handles this for string fields)
 *   2. Parse length_cm, id_inch, od_fr as floats
 *   3. Generate a deterministic slug → Device.id
 *   4. Append numeric suffix if the slug collides (unlikely after dedup validation)
 *
 * The output is validated against `DeviceMasterSchema` before being returned.
 * If post-normalization validation fails, an error is thrown — this indicates
 * a bug in the normalization logic, not bad input data.
 *
 * UNRESOLVED columns (id_mm, od_mm) are intentionally dropped.
 */
export function normalizeValidRows(
  rows: unknown[],
  report: ValidationReport
): ReturnType<typeof DeviceMasterSchema.parse> {
  if (!report.valid) {
    throw new Error(
      `normalizeValidRows: report には ${report.errorCount} 件のエラーがあります。` +
        'validate を先に実行し、すべてのエラーを修正してください。'
    );
  }

  const usedSlugs = new Map<string, number>();
  const devices: ReturnType<typeof NormalizedDeviceSchema.parse>[] = [];

  for (let i = 0; i < rows.length; i++) {
    // Safe to parse without safeParse — validation already confirmed the shape.
    const raw = RawDeviceRowSchema.parse(rows[i]);

    const slug = makeUniqueSlug(generateSlug(raw.name), usedSlugs);

    const deviceInput = {
      id: slug,
      name: raw.name,
      category: normalizeCategory(raw.category) as ValidCategory,
      maker: raw.maker,
      id_inch: parseFloat(raw.id_inch),
      od_fr: parseFloat(raw.od_fr),
      length_cm: parseFloat(raw.length_cm),
      notes: raw.notes,
    };

    // Post-normalization validation — catches bugs in the transform above.
    const result = NormalizedDeviceSchema.safeParse(deviceInput);
    if (!result.success) {
      const rowNum = i + 2;
      throw new Error(
        `normalizeValidRows: row ${rowNum} ("${raw.name}") の正規化後バリデーションに失敗しました:\n` +
          result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n') +
          '\nこれはノーマライズロジックのバグです。'
      );
    }

    devices.push(result.data);
  }

  const master = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_url: SOURCE_URL,
    devices,
  };

  // Final schema validation of the whole master object.
  return DeviceMasterSchema.parse(master);
}

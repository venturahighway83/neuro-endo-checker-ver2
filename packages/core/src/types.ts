/**
 * Device categories, matching the Japanese labels used in the upstream Google Sheets.
 * Order reflects the nesting hierarchy: guiding (outermost) → intermediate → micro (innermost).
 */
export type Category = 'ガイディング' | '中間' | 'マイクロ';

/**
 * A single medical device entry as stored in master.json.
 *
 * Unit notes (from raw CSV):
 *   - id_inch: inner diameter in inches  (id_mm is always empty upstream)
 *   - od_fr:   outer diameter in French  (od_mm is always empty upstream)
 *   - All diameter conversions are done at query time via packages/core/units.ts
 */
export interface Device {
  /** Stable identifier: slugified name, e.g. "6f-roadmaster-90cm" */
  id: string;
  /** Display name including size and length variant, e.g. "6F Roadmaster (90 cm)" */
  name: string;
  category: Category;
  maker: string;
  /** Inner diameter in inches. Source: id_inch column in upstream CSV. */
  id_inch: number;
  /** Outer diameter in French (Fr). Source: od_fr column in upstream CSV. */
  od_fr: number;
  /** Proximal/distal measurements in inches. null or omitted means unavailable. Explicit and user-convention assignments are tracked in the evidence ledger. */
  proximal_id_inch?: number | null;
  proximal_od_inch?: number | null;
  distal_id_inch?: number | null;
  distal_od_inch?: number | null;
  /** Length in cm */
  length_cm: number;
  /** Hub length in cm, separate from length_cm. null or omitted means unavailable. */
  hub_length_cm?: number | null;
  /** Citation for the explicitly reported hub length; may include measured values. */
  hub_length_source?: string;
  /** Total minus effective length, including the hub-side assembly. NOT a hub-only measurement. */
  proximal_non_effective_length_cm?: number | null;
  /** Public document URL and explanation of the subtraction and measured endpoints. */
  proximal_length_source?: string;
  proximal_length_note?: string;
  /** Free-text notes from upstream CSV */
  notes: string;
}

/**
 * Shape of packages/device-master/master.json.
 */
export interface DeviceMaster {
  /** Semantic version of the master data schema, not the device data itself */
  schema_version: string;
  /** ISO 8601 timestamp of when master.json was generated */
  generated_at: string;
  /** Source URL (Google Sheets pubhtml) */
  source_url: string;
  devices: Device[];
}

/**
 * A pair of devices being checked for compatibility (outer contains inner).
 * The engine checks whether `inner` can physically pass through `outer`.
 */
export interface CompatibilityPair {
  outer: Device;
  inner: Device;
}

import type { DeviceMaster } from '@neuro-endo/core';
import masterJson from '../master.json';

/**
 * The validated and normalised device master data.
 * This is the single source of truth consumed by all apps.
 *
 * Upstream origin:
 *   Google Sheets → raw CSV export → validate → normalize → master.json (committed)
 *
 * To regenerate:
 *   pnpm --filter @neuro-endo/device-master validate -- --input raw/<file>.csv
 *   pnpm --filter @neuro-endo/device-master normalize -- --input raw/<file>.csv
 */
export const master: DeviceMaster = masterJson as DeviceMaster;

// Pipeline — re-exported for use in scripts and tests outside this package.
export { validateRawRows } from './pipeline/validate';
export type { ValidationReport, ValidationIssue, IssueCode } from './pipeline/validate';

export { normalizeValidRows, SCHEMA_VERSION } from './pipeline/normalize';

export { generateSlug, makeUniqueSlug } from './pipeline/slug';

export { RawDeviceRowSchema, UNRESOLVED_COLUMNS } from './schema/raw';
export type { RawDeviceRow, UnresolvedColumn } from './schema/raw';

export {
  NormalizedDeviceSchema,
  DeviceMasterSchema,
  VALID_CATEGORIES,
  SOURCE_URL,
} from './schema/normalized';
export type { ValidCategory, NormalizedDevice, NormalizedDeviceMaster } from './schema/normalized';

export type { DeviceMaster, Device, Category } from '@neuro-endo/core';

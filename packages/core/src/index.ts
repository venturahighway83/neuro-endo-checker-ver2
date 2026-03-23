// Domain types
export type { Category, Device, DeviceMaster, CompatibilityPair } from './types';

// Unit conversion
export {
  INCH_TO_MM,
  FR_TO_MM,
  FR_TO_INCH,
  inchToMm,
  mmToInch,
  frToMm,
  mmToFr,
  frToInch,
} from './units';

// Compatibility engine — types (1-in-1)
export type {
  CheckStatus,
  ReasonCode,
  CheckOutcome,
  DerivedMetrics,
  EvidenceState,
  CompatibilityResult,
} from './engine';

// Compatibility engine — types (2-in-1)
export type {
  DualDerivedMetrics,
  DualEvidenceState,
  DualCompatibilityResult,
} from './engine';

// Compatibility engine — constants and functions
export { MARGIN_INCH, checkCompatibility, checkThreeWay, checkDualCompatibility } from './engine';

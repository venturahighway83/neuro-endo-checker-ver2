/**
 * Unit conversion utilities.
 * All conversions are mathematically exact (no rounding applied here).
 * Round at the display layer, not at the computation layer.
 */

/** 1 inch = 25.4 mm (exact, per NIST definition since 1959) */
export const INCH_TO_MM = 25.4 as const;

/**
 * 1 French (Fr) = 1/3 mm in outer diameter.
 * Reference: ISO 10555 catheter sizing convention.
 */
export const FR_TO_MM: number = 1 / 3;

/**
 * 1 French (Fr) = FR_TO_MM / INCH_TO_MM inch = 1/76.2 inch.
 * Derivation: 1 Fr = (1/3) mm, 1 mm = 1/25.4 inch → 1 Fr = 1/(3×25.4) = 1/76.2 inch.
 * Used for conversion of legacy outer-diameter values; regional checks use inches directly.
 */
export const FR_TO_INCH: number = FR_TO_MM / INCH_TO_MM;

/** Convert inches to millimetres. */
export function inchToMm(inches: number): number {
  return inches * INCH_TO_MM;
}

/** Convert millimetres to inches. */
export function mmToInch(mm: number): number {
  return mm / INCH_TO_MM;
}

/** Convert French (Fr) to millimetres (outer diameter). */
export function frToMm(fr: number): number {
  return fr * FR_TO_MM;
}

/** Convert millimetres to French (Fr). */
export function mmToFr(mm: number): number {
  return mm / FR_TO_MM;
}

/**
 * Convert French (Fr) to inches.
 * Regional compatibility checks already receive diameters in inches.
 */
export function frToInch(fr: number): number {
  return fr * FR_TO_INCH;
}

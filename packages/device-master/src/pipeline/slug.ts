/**
 * Deterministic slug generation for device IDs.
 *
 * Rules:
 *   1. Lowercase
 *   2. " cm" (space + unit) is collapsed to "cm"  e.g. "90 cm" → "90cm"
 *   3. Any run of non-alphanumeric characters is replaced by a single "-"
 *   4. Leading and trailing hyphens are removed
 *
 * Examples:
 *   "6F Roadmaster (90 cm)"         → "6f-roadmaster-90cm"
 *   "TACTICS Plus (120 cm)"         → "tactics-plus-120cm"
 *   "Carnelian MARVEL Non Taper"    → "carnelian-marvel-non-taper"
 *   "Excelsior SL-10"               → "excelsior-sl-10"
 *   "4.2F Fubuki"                   → "4-2f-fubuki"
 *
 * Stability guarantee: the same name always produces the same slug.
 * Do NOT change these rules without regenerating master.json.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+cm\b/g, 'cm') // "90 cm" → "90cm" before stripping spaces
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric runs → "-"
    .replace(/^-+|-+$/g, ''); // strip leading/trailing hyphens
}

/**
 * Returns a slug that is unique within the `used` map.
 * If `baseSlug` is already taken, appends "-2", "-3", etc.
 * Mutates `used` as a side effect — pass the same map across all calls in one normalize run.
 *
 * Note: slug collisions indicate a data quality issue (two devices with identical names
 * after normalization). The validate step should catch true duplicates before this point.
 * Collisions here mean the slug algorithm cannot distinguish two legitimately different names,
 * which should be flagged for review.
 */
export function makeUniqueSlug(baseSlug: string, used: Map<string, number>): string {
  if (!used.has(baseSlug)) {
    used.set(baseSlug, 1);
    return baseSlug;
  }
  const next = (used.get(baseSlug) ?? 1) + 1;
  used.set(baseSlug, next);
  const candidate = `${baseSlug}-${next}`;
  // Recurse to handle the (unlikely) case where the suffixed slug is also taken.
  return makeUniqueSlug(candidate, used);
}

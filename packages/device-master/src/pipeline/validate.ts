import { RawDeviceRowSchema, UNRESOLVED_COLUMNS, REGIONAL_DIAMETER_COLUMNS } from '../schema/raw';
import { VALID_CATEGORIES } from '../schema/normalized';

/** English aliases accepted from Google Sheets CSV exports. */
const CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  Guiding: 'ガイディング',
  Intermediate: '中間',
  Microcatheter: 'マイクロ',
};

function isValidCategory(value: string): boolean {
  const trimmed = value.trim();
  return (
    (VALID_CATEGORIES as readonly string[]).includes(trimmed) ||
    trimmed in CATEGORY_ALIASES
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Codes are stable string literals — safe to use in tests and downstream tooling.
 *
 *  MISSING_REQUIRED  — required field is absent or empty string
 *  INVALID_NUMERIC   — field value cannot be parsed as a finite number
 *  NOT_POSITIVE      — numeric value is ≤ 0
 *  INVALID_CATEGORY  — category not in VALID_CATEGORIES
 *  DUPLICATE_NAME    — same device name appears more than once
 *  UNEXPECTED_VALUE  — column expected to be empty (UNRESOLVED) has a value (warning)
 */
export type IssueCode =
  | 'MISSING_REQUIRED'
  | 'INVALID_NUMERIC'
  | 'NOT_POSITIVE'
  | 'INVALID_CATEGORY'
  | 'DUPLICATE_NAME'
  | 'UNEXPECTED_VALUE';

export interface ValidationIssue {
  /** 1-indexed spreadsheet row number (row 1 = header, row 2 = first data row). */
  row: number;
  column?: string;
  severity: 'error' | 'warning';
  code: IssueCode;
  message: string;
}

export interface ValidationReport {
  rowCount: number;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
  /** true iff errorCount === 0. Normalize must not run unless valid === true. */
  valid: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function issue(
  row: number,
  severity: ValidationIssue['severity'],
  code: IssueCode,
  message: string,
  column?: string
): ValidationIssue {
  return { row, column, severity, code, message };
}

function parsePositiveNumber(raw: string): { value: number } | { error: IssueCode } {
  const n = Number(raw.trim());
  if (!isFinite(n) || isNaN(n)) return { error: 'INVALID_NUMERIC' };
  if (n <= 0) return { error: 'NOT_POSITIVE' };
  return { value: n };
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

/**
 * Validates an array of raw objects (as produced by papaparse with header:true).
 *
 * Checks performed in order:
 *   1. Schema shape — required columns present and non-empty (Zod)
 *   2. Category enum — value is one of VALID_CATEGORIES
 *   3. Numeric fields — parseable as finite positive numbers
 *   4. Duplicate names — same `name` appears more than once
 *   5. Unresolved columns — warn if id_mm or od_mm have unexpected values
 *
 * Rows that fail step 1 are skipped for steps 2-5 (fields may be undefined).
 */
export function validateRawRows(rows: unknown[]): ValidationReport {
  const issues: ValidationIssue[] = [];
  const seenNames = new Map<string, number>(); // name → first row number

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // spreadsheet row (header = row 1)

    // --- Step 1: Schema shape (Zod) ---
    const parseResult = RawDeviceRowSchema.safeParse(rows[i]);
    if (!parseResult.success) {
      for (const err of parseResult.error.errors) {
        const column = err.path[0]?.toString();
        const code: IssueCode =
          err.code === 'too_small' || err.code === 'invalid_type'
            ? 'MISSING_REQUIRED'
            : 'MISSING_REQUIRED';
        issues.push(issue(rowNum, 'error', code, err.message, column));
      }
      // Cannot run further checks without a valid schema shape.
      continue;
    }

    const raw = parseResult.data;

    // --- Step 2: Category enum ---
    if (!isValidCategory(raw.category)) {
      issues.push(
        issue(
          rowNum,
          'error',
          'INVALID_CATEGORY',
          `category "${raw.category}" は無効です。有効値: ${VALID_CATEGORIES.join(' | ')} (または英語表記: Guiding / Intermediate / Microcatheter)`,
          'category'
        )
      );
    }

    // --- Step 3: Numeric fields ---
    const numericFields = ['length_cm', 'id_inch', 'od_fr', 'hub_length_cm', 'proximal_non_effective_length_cm', ...REGIONAL_DIAMETER_COLUMNS] as const;
    for (const field of numericFields) {
      if (raw[field] === '') continue; // Optional measurements: blank means unknown.
      const result = parsePositiveNumber(raw[field]);
      if ('error' in result) {
        const code = result.error;
        const msg =
          code === 'INVALID_NUMERIC'
            ? `${field} "${raw[field]}" は数値として解釈できません`
            : `${field} "${raw[field]}" は正の数値でなければなりません`;
        issues.push(issue(rowNum, 'error', code, msg, field));
      }
    }

    // A calculated proximal length needs its source and measurement definition.
    if (raw.proximal_non_effective_length_cm !== '') {
      for (const field of ['proximal_length_source', 'proximal_length_note'] as const) {
        if (!raw[field]) {
          issues.push(issue(rowNum, 'error', 'MISSING_REQUIRED',
            `算出したハブ側の非有効長には ${field} が必要です`, field));
        }
      }
    }

    // --- Step 4: Duplicate name detection ---
    const nameKey = raw.name; // exact trimmed string (Zod already trims)
    if (seenNames.has(nameKey)) {
      issues.push(
        issue(
          rowNum,
          'error',
          'DUPLICATE_NAME',
          `デバイス名 "${nameKey}" は row ${seenNames.get(nameKey)} にも存在します`,
          'name'
        )
      );
    } else {
      seenNames.set(nameKey, rowNum);
    }

    // --- Step 5: Unresolved column warnings ---
    for (const col of UNRESOLVED_COLUMNS) {
      const val = raw[col];
      if (val && val.trim() !== '') {
        issues.push(
          issue(
            rowNum,
            'warning',
            'UNEXPECTED_VALUE',
            `${col} に値 "${val}" がありますが、このフィールドは未解決です (UNRESOLVED)。無視されます。`,
            col
          )
        );
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    rowCount: rows.length,
    errorCount,
    warningCount,
    issues,
    valid: errorCount === 0,
  };
}

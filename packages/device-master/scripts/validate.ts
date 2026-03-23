/**
 * scripts/validate.ts — CLI wrapper for the validation pipeline.
 *
 * Usage:
 *   pnpm --filter @neuro-endo/device-master validate -- --input raw/<file>.csv
 *
 * Exit codes:
 *   0  — no errors (warnings may be present)
 *   1  — one or more errors found
 *   2  — script usage / IO error
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import Papa from 'papaparse';
import { validateRawRows } from '../src/pipeline/validate';
import type { ValidationIssue } from '../src/pipeline/validate';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    input: { type: 'string', short: 'i' },
  },
});

if (!values.input) {
  console.error('使用方法: pnpm validate -- --input raw/<file>.csv');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Parse CSV
// ---------------------------------------------------------------------------

const inputPath = resolve(process.cwd(), values.input);
let csvContent: string;
try {
  csvContent = readFileSync(inputPath, 'utf-8');
} catch (err) {
  console.error(`ファイルを読み込めませんでした: ${inputPath}`);
  console.error(err);
  process.exit(2);
}

const parsed = Papa.parse<Record<string, string>>(csvContent, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h: string) => h.trim(),
});

if (parsed.errors.length > 0) {
  console.error('CSV パース中にエラーが発生しました:');
  for (const e of parsed.errors) {
    console.error(`  Row ${e.row}: ${e.message}`);
  }
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

const report = validateRawRows(parsed.data);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function formatIssue(issue: ValidationIssue): string {
  const prefix = issue.severity === 'error' ? '[ERROR]' : '[WARN] ';
  const col = issue.column ? `, ${issue.column}` : '';
  return `${prefix} Row ${issue.row}${col}: ${issue.message}`;
}

if (report.issues.length > 0) {
  for (const issue of report.issues) {
    console.log(formatIssue(issue));
  }
  console.log('');
}

const status = report.valid ? 'OK' : 'INVALID';
console.log(`--- Rows: ${report.rowCount}  Errors: ${report.errorCount}  Warnings: ${report.warningCount}  Status: ${status}`);

if (!report.valid) {
  console.log('\nすべての [ERROR] を修正してから normalize を実行してください。');
  process.exit(1);
}

if (report.warningCount > 0) {
  console.log('\n[WARN] が存在しますが、normalize は実行可能です。');
}

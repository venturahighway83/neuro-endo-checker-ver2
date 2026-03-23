/**
 * scripts/normalize.ts — CLI wrapper for the normalization pipeline.
 *
 * Usage:
 *   pnpm --filter @neuro-endo/device-master normalize -- --input raw/<file>.csv
 *
 * Writes output to: packages/device-master/master.json
 *
 * IMPORTANT: Run validate first. This script re-runs validation and aborts if any errors are found.
 *
 * Exit codes:
 *   0  — master.json written successfully
 *   1  — validation errors (normalize aborted)
 *   2  — script usage / IO error
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import Papa from 'papaparse';
import { validateRawRows } from '../src/pipeline/validate';
import { normalizeValidRows } from '../src/pipeline/normalize';

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    input: { type: 'string', short: 'i' },
  },
});

if (!values.input) {
  console.error('使用方法: pnpm normalize -- --input raw/<file>.csv');
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
// Validate (always re-run before normalizing)
// ---------------------------------------------------------------------------

console.log(`[normalize] 入力: ${inputPath}`);
console.log(`[normalize] ${parsed.data.length} 行を検証中...`);

const report = validateRawRows(parsed.data);

if (report.warningCount > 0) {
  for (const w of report.issues.filter((i) => i.severity === 'warning')) {
    const col = w.column ? `, ${w.column}` : '';
    console.warn(`[WARN]  Row ${w.row}${col}: ${w.message}`);
  }
}

if (!report.valid) {
  for (const e of report.issues.filter((i) => i.severity === 'error')) {
    const col = e.column ? `, ${e.column}` : '';
    console.error(`[ERROR] Row ${e.row}${col}: ${e.message}`);
  }
  console.error(
    `\nnormalize を中止しました。${report.errorCount} 件のエラーを修正してください。`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

console.log('[normalize] 正規化中...');
const master = normalizeValidRows(parsed.data, report);

// ---------------------------------------------------------------------------
// Write master.json
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../master.json');
const json = JSON.stringify(master, null, 2) + '\n';

try {
  writeFileSync(outputPath, json, 'utf-8');
} catch (err) {
  console.error(`master.json の書き込みに失敗しました: ${outputPath}`);
  console.error(err);
  process.exit(2);
}

console.log(`[normalize] 完了: ${master.devices.length} デバイスを ${outputPath} に書き込みました`);
console.log(`[normalize] generated_at: ${master.generated_at}`);

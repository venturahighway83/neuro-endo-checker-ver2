import { describe, it, expect } from 'vitest';
import { validateRawRows } from '../pipeline/validate';
import type { ValidationReport } from '../pipeline/validate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validRow = {
  name: '6F Roadmaster (90 cm)',
  category: 'ガイディング',
  maker: 'Nipro',
  id_mm: '',
  od_mm: '',
  length_cm: '90',
  id_inch: '0.071',
  od_fr: '6',
  notes: '',
};

const validIntermediateRow = {
  name: 'Navien058 (115 cm)',
  category: '中間',
  maker: 'Medtronic',
  id_mm: '',
  od_mm: '',
  length_cm: '115',
  id_inch: '0.058',
  od_fr: '5.4',
  notes: '',
};

const validMicroRow = {
  name: 'Excelsior SL-10',
  category: 'マイクロ',
  maker: 'Stryker',
  id_mm: '',
  od_mm: '',
  length_cm: '150',
  id_inch: '0.0165',
  od_fr: '2.4',
  notes: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorsFor(report: ValidationReport, code: string) {
  return report.issues.filter((i) => i.code === code && i.severity === 'error');
}
function warningsFor(report: ValidationReport, code: string) {
  return report.issues.filter((i) => i.code === code && i.severity === 'warning');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateRawRows — empty input', () => {
  it('returns valid with zero issues for an empty array', () => {
    const report = validateRawRows([]);
    expect(report.valid).toBe(true);
    expect(report.rowCount).toBe(0);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.issues).toHaveLength(0);
  });
});

describe('validateRawRows — valid rows', () => {
  it('accepts a single valid row', () => {
    const report = validateRawRows([validRow]);
    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it('accepts all three categories', () => {
    const report = validateRawRows([validRow, validIntermediateRow, validMicroRow]);
    expect(report.valid).toBe(true);
  });

  it('reports correct rowCount', () => {
    const report = validateRawRows([validRow, validIntermediateRow]);
    expect(report.rowCount).toBe(2);
  });
});

describe('validateRawRows — MISSING_REQUIRED', () => {
  it('errors on empty name', () => {
    const report = validateRawRows([{ ...validRow, name: '' }]);
    expect(report.valid).toBe(false);
    const errs = errorsFor(report, 'MISSING_REQUIRED');
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]?.column).toBe('name');
  });

  it('errors on empty category', () => {
    const report = validateRawRows([{ ...validRow, category: '' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'MISSING_REQUIRED').some((e) => e.column === 'category')).toBe(true);
  });

  it('errors on empty maker', () => {
    const report = validateRawRows([{ ...validRow, maker: '' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'MISSING_REQUIRED').some((e) => e.column === 'maker')).toBe(true);
  });

  it('errors on empty length_cm', () => {
    const report = validateRawRows([{ ...validRow, length_cm: '' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'MISSING_REQUIRED').some((e) => e.column === 'length_cm')).toBe(true);
  });

  it('errors on empty id_inch', () => {
    const report = validateRawRows([{ ...validRow, id_inch: '' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'MISSING_REQUIRED').some((e) => e.column === 'id_inch')).toBe(true);
  });

  it('errors on empty od_fr', () => {
    const report = validateRawRows([{ ...validRow, od_fr: '' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'MISSING_REQUIRED').some((e) => e.column === 'od_fr')).toBe(true);
  });
});

describe('validateRawRows — INVALID_CATEGORY', () => {
  it('errors on an unknown category string', () => {
    const report = validateRawRows([{ ...validRow, category: 'Unknown' }]);
    expect(report.valid).toBe(false);
    const errs = errorsFor(report, 'INVALID_CATEGORY');
    expect(errs).toHaveLength(1);
    expect(errs[0]?.column).toBe('category');
    expect(errs[0]?.message).toContain('Unknown');
  });

  it('errors on English category name', () => {
    const report = validateRawRows([{ ...validRow, category: 'guiding' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'INVALID_CATEGORY')).toHaveLength(1);
  });
});

describe('validateRawRows — INVALID_NUMERIC', () => {
  it('errors when length_cm is not a number', () => {
    const report = validateRawRows([{ ...validRow, length_cm: 'abc' }]);
    expect(report.valid).toBe(false);
    const errs = errorsFor(report, 'INVALID_NUMERIC');
    expect(errs.some((e) => e.column === 'length_cm')).toBe(true);
  });

  it('errors when id_inch is not a number', () => {
    const report = validateRawRows([{ ...validRow, id_inch: 'N/A' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'INVALID_NUMERIC').some((e) => e.column === 'id_inch')).toBe(true);
  });

  it('errors when od_fr is not a number', () => {
    const report = validateRawRows([{ ...validRow, od_fr: '-' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'INVALID_NUMERIC').some((e) => e.column === 'od_fr')).toBe(true);
  });
});

describe('validateRawRows — NOT_POSITIVE', () => {
  it('errors when length_cm is zero', () => {
    const report = validateRawRows([{ ...validRow, length_cm: '0' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'NOT_POSITIVE').some((e) => e.column === 'length_cm')).toBe(true);
  });

  it('errors when id_inch is negative', () => {
    const report = validateRawRows([{ ...validRow, id_inch: '-0.071' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'NOT_POSITIVE').some((e) => e.column === 'id_inch')).toBe(true);
  });

  it('errors when od_fr is zero', () => {
    const report = validateRawRows([{ ...validRow, od_fr: '0' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'NOT_POSITIVE').some((e) => e.column === 'od_fr')).toBe(true);
  });
});

describe('validateRawRows — DUPLICATE_NAME', () => {
  it('errors when the same name appears twice', () => {
    const report = validateRawRows([validRow, validRow]);
    expect(report.valid).toBe(false);
    const errs = errorsFor(report, 'DUPLICATE_NAME');
    expect(errs).toHaveLength(1);
    expect(errs[0]?.row).toBe(3); // header=1, first=2, duplicate=3
    expect(errs[0]?.message).toContain(validRow.name);
  });

  it('does not error for two different names', () => {
    const report = validateRawRows([validRow, validIntermediateRow]);
    expect(errorsFor(report, 'DUPLICATE_NAME')).toHaveLength(0);
  });

  it('references the first occurrence row in the error message', () => {
    const rows = [validRow, validIntermediateRow, validRow];
    const report = validateRawRows(rows);
    const errs = errorsFor(report, 'DUPLICATE_NAME');
    expect(errs[0]?.message).toContain('row 2'); // first occurrence is row 2
  });
});

describe('validateRawRows — UNEXPECTED_VALUE (UNRESOLVED columns)', () => {
  it('warns when id_mm has a value', () => {
    const report = validateRawRows([{ ...validRow, id_mm: '1.8034' }]);
    expect(report.valid).toBe(true); // warning only, not an error
    const warns = warningsFor(report, 'UNEXPECTED_VALUE');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.column).toBe('id_mm');
  });

  it('warns when od_mm has a value', () => {
    const report = validateRawRows([{ ...validRow, od_mm: '2.0' }]);
    expect(report.valid).toBe(true);
    const warns = warningsFor(report, 'UNEXPECTED_VALUE');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.column).toBe('od_mm');
  });

  it('warns separately for both unresolved columns if both have values', () => {
    const report = validateRawRows([{ ...validRow, id_mm: '1.8', od_mm: '2.0' }]);
    expect(report.valid).toBe(true);
    expect(warningsFor(report, 'UNEXPECTED_VALUE')).toHaveLength(2);
  });

  it('does not warn when both unresolved columns are empty', () => {
    const report = validateRawRows([validRow]);
    expect(warningsFor(report, 'UNEXPECTED_VALUE')).toHaveLength(0);
  });
});

describe('validateRawRows — row number reporting', () => {
  it('reports row 2 for the first data row (header = row 1)', () => {
    const report = validateRawRows([{ ...validRow, name: '' }]);
    expect(report.issues[0]?.row).toBe(2);
  });

  it('reports row 4 for the third data row', () => {
    const rows = [validRow, validIntermediateRow, { ...validMicroRow, od_fr: 'bad' }];
    const report = validateRawRows(rows);
    const errs = errorsFor(report, 'INVALID_NUMERIC');
    expect(errs[0]?.row).toBe(4);
  });
});

describe('validateRawRows — whitespace trimming', () => {
  it('trims whitespace from name before checking for empty', () => {
    const report = validateRawRows([{ ...validRow, name: '   ' }]);
    expect(report.valid).toBe(false);
    expect(errorsFor(report, 'MISSING_REQUIRED').some((e) => e.column === 'name')).toBe(true);
  });

  it('accepts numeric fields with surrounding whitespace', () => {
    const report = validateRawRows([{ ...validRow, id_inch: ' 0.071 ' }]);
    expect(report.valid).toBe(true);
  });
});

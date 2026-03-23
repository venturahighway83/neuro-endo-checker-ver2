import { describe, it, expect } from 'vitest';
import { normalizeValidRows, SCHEMA_VERSION } from '../pipeline/normalize';
import { validateRawRows } from '../pipeline/validate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const row1 = {
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

const row2 = {
  name: 'Navien058 (115 cm)',
  category: '中間',
  maker: 'Medtronic',
  id_mm: '',
  od_mm: '',
  length_cm: '115',
  id_inch: '0.058',
  od_fr: '5.4',
  notes: 'some note',
};

const row3 = {
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

function makeReport(rows: unknown[]) {
  return validateRawRows(rows);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('normalizeValidRows — guard rail', () => {
  it('throws when report has errors', () => {
    const badRow = { ...row1, name: '' };
    const report = makeReport([badRow]);
    expect(report.valid).toBe(false);
    expect(() => normalizeValidRows([badRow], report)).toThrow(/エラー/);
  });

  it('throws even if row count is zero but report.valid is false', () => {
    // Construct a report with errors manually
    const invalidReport = {
      rowCount: 0,
      errorCount: 1,
      warningCount: 0,
      issues: [],
      valid: false,
    };
    expect(() => normalizeValidRows([], invalidReport)).toThrow();
  });
});

describe('normalizeValidRows — output structure', () => {
  it('returns a DeviceMaster with the correct schema_version', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const master = normalizeValidRows(rows, report);
    expect(master.schema_version).toBe(SCHEMA_VERSION);
  });

  it('sets generated_at to an ISO 8601 timestamp', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const master = normalizeValidRows(rows, report);
    expect(() => new Date(master.generated_at)).not.toThrow();
    expect(master.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes the correct source_url', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const master = normalizeValidRows(rows, report);
    expect(master.source_url).toContain('docs.google.com');
  });

  it('produces one device per input row', () => {
    const rows = [row1, row2, row3];
    const report = makeReport(rows);
    const master = normalizeValidRows(rows, report);
    expect(master.devices).toHaveLength(3);
  });
});

describe('normalizeValidRows — field mapping', () => {
  it('maps name correctly', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.name).toBe('6F Roadmaster (90 cm)');
  });

  it('maps category correctly', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.category).toBe('ガイディング');
  });

  it('maps maker correctly', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.maker).toBe('Nipro');
  });

  it('converts id_inch to number', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.id_inch).toBe(0.071);
    expect(typeof device?.id_inch).toBe('number');
  });

  it('converts od_fr to number', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.od_fr).toBe(6);
    expect(typeof device?.od_fr).toBe('number');
  });

  it('converts length_cm to number', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.length_cm).toBe(90);
    expect(typeof device?.length_cm).toBe('number');
  });

  it('preserves notes', () => {
    const rows = [row2];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.notes).toBe('some note');
  });

  it('maps empty notes to empty string', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.notes).toBe('');
  });
});

describe('normalizeValidRows — slug generation', () => {
  it('generates id from name', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.id).toBe('6f-roadmaster-90cm');
  });

  it('generates unique ids when two names produce the same base slug', () => {
    // Construct two rows whose names would produce the same slug.
    // This is an artificial test — real duplicates are caught by validation.
    // Here we disable dedup by using two different names that collapse identically.
    // In practice this is very unlikely; we test the mechanism regardless.
    const rowA = { ...row1, name: 'Device A' };
    const rowB = { ...row2, name: 'Device.A' }; // same slug "device-a"
    const rows = [rowA, rowB];
    const report = makeReport(rows);
    const master = normalizeValidRows(rows, report);
    const ids = master.devices.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it('id is non-empty for all devices', () => {
    const rows = [row1, row2, row3];
    const report = makeReport(rows);
    const master = normalizeValidRows(rows, report);
    for (const device of master.devices) {
      expect(device.id.length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeValidRows — whitespace handling', () => {
  it('trims whitespace from string fields', () => {
    const paddedRow = {
      ...row1,
      name: '  6F Roadmaster (90 cm)  ',
      maker: '  Nipro  ',
      notes: '  note  ',
    };
    // Rebuild report with the padded row
    const rows = [paddedRow];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device?.name).toBe('6F Roadmaster (90 cm)');
    expect(device?.maker).toBe('Nipro');
    expect(device?.notes).toBe('note');
  });
});

describe('normalizeValidRows — UNRESOLVED columns', () => {
  it('does not include id_mm or od_mm in the output devices', () => {
    const rows = [row1];
    const report = makeReport(rows);
    const [device] = normalizeValidRows(rows, report).devices;
    expect(device).not.toHaveProperty('id_mm');
    expect(device).not.toHaveProperty('od_mm');
  });
});

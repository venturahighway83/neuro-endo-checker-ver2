import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { REGIONAL_DIAMETER_COLUMNS } from '../schema/raw';
import { DeviceMasterSchema } from '../schema/normalized';
import { validateRawRows } from '../pipeline/validate';
import { normalizeValidRows } from '../pipeline/normalize';

const legacyRow = {
  name: 'Example', category: '中間', maker: 'Example',
  id_inch: '0.058', od_fr: '6', length_cm: '100', notes: '',
};

describe('regional diameter import', () => {
  it('keeps legacy measurements without assuming proximal or distal values', () => {
    const device = normalizeValidRows([legacyRow], validateRawRows([legacyRow])).devices[0]!;
    expect(device.id_inch).toBe(0.058);
    expect(device.od_fr).toBe(6);
    for (const field of REGIONAL_DIAMETER_COLUMNS) expect(device[field]).toBeNull();
  });

  it('preserves distinct measurements and accepts partial data', () => {
    const row = { ...legacyRow, proximal_id_inch: ' 0.060 ', proximal_od_inch: '0.079',
      distal_id_inch: '0.058', distal_od_inch: '0.072' };
    const device = normalizeValidRows([row], validateRawRows([row])).devices[0]!;
    expect(device).toMatchObject({ proximal_id_inch: 0.060, proximal_od_inch: 0.079,
      distal_id_inch: 0.058, distal_od_inch: 0.072 });
    const partial = { ...legacyRow, proximal_id_inch: '0.060', distal_od_inch: '  ' };
    expect(normalizeValidRows([partial], validateRawRows([partial])).devices[0])
      .toMatchObject({ proximal_id_inch: 0.060, distal_od_inch: null });
  });

  for (const field of REGIONAL_DIAMETER_COLUMNS) {
    it.each(['0', '-1', 'NaN', 'Infinity', '0.058inch'])('rejects invalid ' + field + ': %s', (value) => {
      const rows = [{ ...legacyRow, [field]: value }];
      const report = validateRawRows(rows);
      expect(report.valid).toBe(false);
      expect(report.issues.some((issue) => issue.column === field && issue.severity === 'error')).toBe(true);
      expect(() => normalizeValidRows(rows, report)).toThrow();
    });
  }

  it('reproduces the committed master from the editable CSV', () => {
    const master = DeviceMasterSchema.parse(JSON.parse(readFileSync('master.json', 'utf8')));
    const parsed = Papa.parse(readFileSync('raw/devices.csv', 'utf8'), { header: true, skipEmptyLines: true });
    expect(parsed.errors).toEqual([]);
    const report = validateRawRows(parsed.data);
    expect(report.valid).toBe(true);
    const regenerated = normalizeValidRows(parsed.data, report);
    expect(regenerated.devices).toEqual(master.devices);
    expect(regenerated.schema_version).toBe(master.schema_version);
  });
});

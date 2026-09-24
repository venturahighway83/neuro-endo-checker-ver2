import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DeviceMasterSchema } from '../schema/normalized';
import { REGIONAL_DIAMETER_COLUMNS } from '../schema/raw';

type Field = (typeof REGIONAL_DIAMETER_COLUMNS)[number];
interface Measurement {
  original_value: number;
  original_unit: 'inch' | 'mm' | 'Fr';
  value_inch: number;
  source_ids: string[];
  assignment?: string;
  reference_device_ids?: string[];
}
interface Evidence {
  sources: Record<string, { url?: string; type: string; local_path?: string; sha256?: string }>;
  records: { device_ids: string[]; match_note: string; values: Partial<Record<Field, Measurement>> }[];
  coverage: { device_id: string; populated_fields: number }[];
}
const evidence = JSON.parse(readFileSync('evidence/regional-diameters.json', 'utf8')) as Evidence;
const master = DeviceMasterSchema.parse(JSON.parse(readFileSync('master.json', 'utf8')));
const byId = new Map(master.devices.map((device) => [device.id, device]));

describe('researched regional dimensions', () => {
  it('has one traceable source record for every populated endpoint, with correct unit conversion', () => {
    const registered = new Set<string>();
    for (const record of evidence.records) {
      expect(record.match_note.length).toBeGreaterThan(0);
      for (const [field, measurement] of Object.entries(record.values)) {
        expect(REGIONAL_DIAMETER_COLUMNS).toContain(field);
        expect(measurement.source_ids.length).toBeGreaterThan(0);
        for (const sourceId of measurement.source_ids) {
          const source = evidence.sources[sourceId];
          expect(source).toBeDefined();
          if (source?.type === 'local_book') {
            expect(source.local_path).toMatch(/\.pdf$/);
            expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
          } else {
            expect(source?.url).toMatch(/^https:\/\//);
          }
        }
        const divisor = { inch: 1, mm: 25.4, Fr: 76.2 }[measurement.original_unit];
        expect(measurement.value_inch).toBe(Number((measurement.original_value / divisor).toFixed(8)));
        for (const id of record.device_ids) {
          const key = `${id}/${field}`;
          expect(registered.has(key), key).toBe(false);
          registered.add(key);
          expect(byId.get(id)?.[field as Field], key).toBe(measurement.value_inch);
        }
      }
    }
    for (const device of master.devices) {
      for (const field of REGIONAL_DIAMETER_COLUMNS) {
        expect(registered.has(`${device.id}/${field}`)).toBe(device[field] !== null);
      }
      for (const end of ['proximal', 'distal'] as const) {
        const inner = device[`${end}_id_inch`];
        const outer = device[`${end}_od_inch`];
        if (inner !== null && outer !== null) expect(inner).toBeLessThan(outer);
      }
    }
  });

  it('accounts for every device including unresolved models', () => {
    expect(evidence.coverage.map((row) => row.device_id).sort()).toEqual([...byId.keys()].sort());
    for (const row of evidence.coverage) {
      const device = byId.get(row.device_id)!;
      expect(row.populated_fields).toBe(REGIONAL_DIAMETER_COLUMNS.filter((field) => device[field] !== null).length);
    }
  });

  it('retains model holds and distinguishes endpoints instead of copying generic diameters', () => {
    expect(byId.get('guidepost-120cm')).toMatchObject({ proximal_id_inch: 0.039, distal_id_inch: 0.035 });
    expect(byId.get('marathon')).toMatchObject({ proximal_id_inch: 0.015, distal_id_inch: 0.013 });
    expect(byId.get('5f-sofia-select-115cm')).toMatchObject({
      proximal_id_inch: null, distal_id_inch: 0.055, proximal_od_inch: 0.068, distal_od_inch: 0.067,
    });
    for (const id of ['via33', 'acs-vecta71-115cm', 'acs-vecta71-125cm']) {
      for (const field of REGIONAL_DIAMETER_COLUMNS) expect(byId.get(id)?.[field]).toBeNull();
    }
  });

  it('matches historical book models by length and assigns their generic ID only to distal', () => {
    for (const [id, length, proximal, distal] of [
      ['echelon-10', 147, 2.1, 1.7],
      ['carnelian-marvel-non-taper', 160, 1.9, 1.9],
      ['carnelian-hf-s-125cm', 125, 2.8, 2.6],
      ['carnelian-hf-s-135cm', 135, 2.8, 2.6],
    ] as const) {
      expect(byId.get(id)).toMatchObject({
        length_cm: length,
        proximal_od_inch: Number((proximal / 76.2).toFixed(8)),
        distal_od_inch: Number((distal / 76.2).toFixed(8)),
        proximal_id_inch: null, distal_id_inch: id.startsWith('carnelian-hf-s') ? 0.027 : 0.017,
      });
    }
  });

  it('aligns HF-S 105 cm with 125/135 cm by user request while retaining its length and assignment provenance', () => {
    const device = byId.get('carnelian-hf-s-105cm')!;
    expect(device.length_cm).toBe(105);
    expect(device.proximal_id_inch).toBeNull();
    for (const referenceId of ['carnelian-hf-s-125cm', 'carnelian-hf-s-135cm']) {
      const reference = byId.get(referenceId)!;
      for (const field of REGIONAL_DIAMETER_COLUMNS) expect(device[field]).toBe(reference[field]);
    }
    const records = evidence.records.filter((record) => record.device_ids.includes(device.id));
    expect(records).toHaveLength(1);
    for (const field of ['proximal_od_inch', 'distal_id_inch', 'distal_od_inch'] as const) {
      expect(records[0]?.values[field]).toMatchObject({
        assignment: 'user_requested_variant_alignment',
        reference_device_ids: ['carnelian-hf-s-125cm', 'carnelian-hf-s-135cm'],
      });
    }
  });

  it('uses the user convention without copying wire diameters or overwriting explicit measurements', () => {
    expect(byId.get('saya-86-80cm')).toMatchObject({ proximal_od_inch: 0.097, distal_id_inch: 0.086, proximal_id_inch: null, distal_od_inch: null });
    expect(byId.get('via17')).toMatchObject({ distal_id_inch: 0.0175, proximal_id_inch: null, proximal_od_inch: 0.03188976, distal_od_inch: 0.02913386 });
    expect(byId.get('phenom-27-160cm')).toMatchObject({ id_inch: 0.021, distal_id_inch: 0.027 });
    expect(byId.get('marathon')).toMatchObject({ id_inch: 0.012, proximal_id_inch: 0.015, distal_id_inch: 0.013 });
    for (const id of ['shouryu', 'transform-c', 'transform-sc']) expect(byId.get(id)?.distal_id_inch).toBeNull();
  });
});

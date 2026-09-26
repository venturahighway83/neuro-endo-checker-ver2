import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkCompatibility, checkDualCompatibility } from '@neuro-endo/core';
import { DeviceMasterSchema } from '../schema/normalized';
import { validateRawRows } from '../pipeline/validate';
import { normalizeValidRows } from '../pipeline/normalize';

const legacy = { name: 'Example', category: '中間', maker: 'Example',
  id_inch: '0.058', od_fr: '6', length_cm: '100', notes: '' };
const master = DeviceMasterSchema.parse(JSON.parse(readFileSync('master.json', 'utf8')));
const evidence = JSON.parse(readFileSync('evidence/hub-lengths.json', 'utf8')) as {
  source: { unit: string; sha256: string; sheet: string };
  records: { device_ids: string[]; source_cell: string; source_effective_lengths_cm: number[];
    hub_length_cm: number; match_note: string }[];
  holds: { device_ids: string[]; reason: string }[];
  coverage: { total: number; populated: number; unavailable: number };
  public_sources: Record<string, { url: string; page: number; sha256: string }>;
  derived_records: { device_id: string; source_id: string; basis: string;
    total_length_cm: number; effective_length_cm: number; proximal_non_effective_length_cm: number;
    diagram_checked: boolean; measurement_scope: string; match_note: string }[];
};

describe('hub length import', () => {
  it.each([undefined, '', '   '])('keeps a missing hub length unknown: %s', (hub_length_cm) => {
    const row = { ...legacy, hub_length_cm };
    expect(normalizeValidRows([row], validateRawRows([row])).devices[0])
      .toMatchObject({ hub_length_cm: null, length_cm: 100 });
  });

  it('preserves a decimal cm value without adding it to the catheter length', () => {
    const row = { ...legacy, hub_length_cm: ' 6.3 ' };
    expect(normalizeValidRows([row], validateRawRows([row])).devices[0])
      .toMatchObject({ hub_length_cm: 6.3, length_cm: 100 });
  });

  it.each(['0', '-1', 'NaN', 'Infinity', '6.3 cm', '6.3mm'])('rejects invalid lengths: %s', (value) => {
    const rows = [{ ...legacy, hub_length_cm: value }];
    const report = validateRawRows(rows);
    expect(report.valid).toBe(false);
    expect(report.issues.some(i => i.column === 'hub_length_cm' && i.severity === 'error')).toBe(true);
    expect(() => normalizeValidRows(rows, report)).toThrow();
  });

  it('traces every imported value to a source cell and an explicitly listed catheter length', () => {
    const byId = new Map(master.devices.map(d => [d.id, d]));
    const registered = new Set<string>();
    expect(evidence.source.unit).toBe('cm');
    expect(evidence.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.source.sheet).toBe('スペック表');
    for (const record of evidence.records) {
      expect(record.source_cell).toMatch(/^N\d+$/);
      expect(record.match_note.length).toBeGreaterThan(0);
      for (const id of record.device_ids) {
        expect(registered.has(id), id).toBe(false);
        registered.add(id);
        const device = byId.get(id)!;
        expect(device.hub_length_cm, id).toBe(record.hub_length_cm);
        expect(record.source_effective_lengths_cm, id).toContain(device.length_cm);
      }
    }
    for (const device of master.devices) {
      expect(registered.has(device.id), device.id).toBe(device.hub_length_cm !== null);
    }
    expect(registered.size).toBe(25);
    expect(evidence.coverage).toMatchObject({ total: 145, populated: 25, unavailable: 120 });
    for (const hold of evidence.holds) {
      expect(hold.reason.length).toBeGreaterThan(0);
      for (const id of hold.device_ids) expect(byId.get(id)?.hub_length_cm, id).toBeNull();
    }
    expect(byId.get('5f-guider-softip-100cm')?.hub_length_cm).toBe(2);
    expect(byId.get('excelsior-sl-10')?.hub_length_cm).toBe(6.3);
    expect(byId.get('guidepost-120cm')?.hub_length_cm).toBe(10);
  });

  it('keeps the calculated proximal assembly separate from explicitly reported hub lengths', () => {
    const traced = new Set<string>();
    for (const record of evidence.derived_records) {
      const device = master.devices.find(d => d.id === record.device_id)!;
      const source = evidence.public_sources[record.source_id]!;
      expect(traced.has(device.id)).toBe(false);
      traced.add(device.id);
      expect(record.basis).toBe('total_minus_effective');
      expect(record.diagram_checked).toBe(true);
      expect(record.measurement_scope.length).toBeGreaterThan(0);
      expect(record.match_note.length).toBeGreaterThan(0);
      expect(record.effective_length_cm).toBe(device.length_cm);
      expect(record.proximal_non_effective_length_cm).toBe(record.total_length_cm - record.effective_length_cm);
      expect(device.proximal_non_effective_length_cm).toBe(record.proximal_non_effective_length_cm);
      expect(device.proximal_length_source).toBe(source.url);
      expect(device.proximal_length_note).toContain(record.measurement_scope);
      expect(device.proximal_length_note).toContain('算出');
      expect(source.page).toBeGreaterThan(0);
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const device of master.devices) {
      expect(traced.has(device.id), device.id).toBe(device.proximal_non_effective_length_cm !== null);
      if (device.hub_length_cm != null) expect(device.hub_length_source).toContain('実測値を含む');
    }
    expect(traced.size).toBe(10);
    expect(master.devices.find(d => d.id === 'marathon')).toMatchObject({
      hub_length_cm: null, length_cm: 165, proximal_non_effective_length_cm: 5,
    });
    expect(master.devices.find(d => d.id === 'cerulean-dd6-113cm')).toMatchObject({
      hub_length_cm: null, length_cm: 113, proximal_non_effective_length_cm: 5,
    });
    for (const id of ['tactics-125cm', 'tactics-140cm', 'cerulean-dd6-103cm', 'acs-vecta74-115cm']) {
      expect(master.devices.find(d => d.id === id)).toMatchObject({
        hub_length_cm: null, proximal_non_effective_length_cm: null,
      });
    }
  });

  it('requires a source and measurement definition for a calculated length', () => {
    const row = { ...legacy, proximal_non_effective_length_cm: '5' };
    expect(validateRawRows([row]).issues.map(i => i.column))
      .toEqual(['proximal_length_source', 'proximal_length_note']);
    const complete = { ...row, proximal_length_source: 'https://example.com/spec.pdf',
      proximal_length_note: '全長105 cm − 有効長100 cm。ハブとストレインリリーフを含む。' };
    expect(normalizeValidRows([complete], validateRawRows([complete])).devices[0])
      .toMatchObject({ hub_length_cm: null, length_cm: 100, proximal_non_effective_length_cm: 5 });
    for (const value of ['0', '-5', 'NaN', 'Infinity', '5 cm']) {
      expect(validateRawRows([{ ...complete, proximal_non_effective_length_cm: value }]).valid).toBe(false);
    }
  });

  it('keeps existing single and simultaneous compatibility results independent of hub metadata', () => {
    const outer = master.devices.find(d => d.id === '6f-guider-softip-90cm')!;
    const inner = master.devices.find(d => d.id === 'excelsior-sl-10')!;
    const noHub = { hub_length_cm: null, hub_length_source: '', proximal_non_effective_length_cm: null,
      proximal_length_source: '', proximal_length_note: '' };
    const bareOuter = { ...outer, ...noHub };
    const bareInner = { ...inner, ...noHub };
    expect(checkCompatibility({ outer, inner }))
      .toEqual(checkCompatibility({ outer: bareOuter, inner: bareInner }));
    expect(checkDualCompatibility({ outer, inner1: inner, inner2: inner }))
      .toEqual(checkDualCompatibility({ outer: bareOuter, inner1: bareInner, inner2: bareInner }));
    const calculated = master.devices.find(d => d.id === 'marathon')!;
    expect(checkCompatibility({ outer, inner: calculated }))
      .toEqual(checkCompatibility({ outer, inner: { ...calculated, ...noHub } }));
  });
});

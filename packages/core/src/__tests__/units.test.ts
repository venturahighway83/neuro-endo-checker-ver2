import { describe, it, expect } from 'vitest';
import { inchToMm, mmToInch, frToMm, mmToFr, INCH_TO_MM, FR_TO_MM } from '../units';

describe('inchToMm', () => {
  it('uses the NIST constant 25.4', () => {
    expect(inchToMm(1)).toBe(25.4);
  });

  it('converts a representative id_inch value from the CSV', () => {
    // 6F Roadmaster: id_inch = 0.071
    expect(inchToMm(0.071)).toBeCloseTo(0.071 * 25.4, 10);
  });

  it('is the inverse of mmToInch', () => {
    const mm = 1.8034;
    expect(inchToMm(mmToInch(mm))).toBeCloseTo(mm, 10);
  });
});

describe('frToMm', () => {
  it('uses the 1/3 mm per French convention', () => {
    expect(frToMm(3)).toBeCloseTo(1.0, 10);
    expect(frToMm(6)).toBeCloseTo(2.0, 10);
  });

  it('converts representative od_fr values from the CSV', () => {
    // 6F guiding catheter: od_fr = 6
    expect(frToMm(6)).toBeCloseTo(2.0, 10);
    // SL-10 microcatheter: od_fr = 2.4
    expect(frToMm(2.4)).toBeCloseTo(2.4 / 3, 10);
  });

  it('is the inverse of mmToFr', () => {
    const fr = 4.7;
    expect(frToMm(mmToFr(fr))).toBeCloseTo(fr, 10);
  });
});

describe('constants', () => {
  it('INCH_TO_MM is 25.4', () => {
    expect(INCH_TO_MM).toBe(25.4);
  });

  it('FR_TO_MM is 1/3', () => {
    expect(FR_TO_MM).toBeCloseTo(1 / 3, 15);
  });
});

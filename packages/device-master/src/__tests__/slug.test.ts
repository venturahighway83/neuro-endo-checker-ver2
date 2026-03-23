import { describe, it, expect, beforeEach } from 'vitest';
import { generateSlug, makeUniqueSlug } from '../pipeline/slug';

describe('generateSlug', () => {
  it('lowercases the name', () => {
    expect(generateSlug('6F Roadmaster')).toBe('6f-roadmaster');
  });

  it('collapses " cm" unit suffix', () => {
    expect(generateSlug('6F Roadmaster (90 cm)')).toBe('6f-roadmaster-90cm');
    expect(generateSlug('TACTICS Plus (120 cm)')).toBe('tactics-plus-120cm');
    expect(generateSlug('Navien058 (115 cm)')).toBe('navien058-115cm');
  });

  it('replaces parentheses and spaces with hyphens', () => {
    expect(generateSlug('Excelsior SL-10')).toBe('excelsior-sl-10');
  });

  it('collapses consecutive separators into a single hyphen', () => {
    // "(90 cm)" → after " cm"→"cm": "(90cm)" → non-alnum run "(", ")" → "-"
    expect(generateSlug('6F Roadmaster (90 cm)')).not.toContain('--');
  });

  it('removes leading and trailing hyphens', () => {
    const result = generateSlug('6F Roadmaster (90 cm)');
    expect(result).not.toMatch(/^-/);
    expect(result).not.toMatch(/-$/);
  });

  it('handles devices without length suffix', () => {
    expect(generateSlug('Carnelian MARVEL Non Taper')).toBe('carnelian-marvel-non-taper');
    expect(generateSlug('Marathon')).toBe('marathon');
    expect(generateSlug('Neuro EBU')).toBe('neuro-ebu');
  });

  it('handles dots in model numbers', () => {
    // "4.2F Fubuki" — dot becomes hyphen
    expect(generateSlug('4.2F Fubuki')).toBe('4-2f-fubuki');
  });

  it('handles numeric-only fraction in name', () => {
    expect(generateSlug('Phenom 27 (150 cm)')).toBe('phenom-27-150cm');
  });

  it('is deterministic — same input always gives same output', () => {
    const name = '6F Roadmaster (90 cm)';
    expect(generateSlug(name)).toBe(generateSlug(name));
  });
});

describe('makeUniqueSlug', () => {
  let used: Map<string, number>;

  beforeEach(() => {
    used = new Map();
  });

  it('returns the base slug for the first occurrence', () => {
    expect(makeUniqueSlug('6f-roadmaster-90cm', used)).toBe('6f-roadmaster-90cm');
  });

  it('appends -2 for the second occurrence of the same base slug', () => {
    makeUniqueSlug('6f-roadmaster-90cm', used);
    expect(makeUniqueSlug('6f-roadmaster-90cm', used)).toBe('6f-roadmaster-90cm-2');
  });

  it('appends -3 for the third occurrence', () => {
    makeUniqueSlug('foo', used);
    makeUniqueSlug('foo', used);
    expect(makeUniqueSlug('foo', used)).toBe('foo-3');
  });

  it('tracks different slugs independently', () => {
    expect(makeUniqueSlug('alpha', used)).toBe('alpha');
    expect(makeUniqueSlug('beta', used)).toBe('beta');
    expect(makeUniqueSlug('alpha', used)).toBe('alpha-2');
    expect(makeUniqueSlug('beta', used)).toBe('beta-2');
  });
});

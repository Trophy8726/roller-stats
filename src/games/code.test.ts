import { CODE_ALPHABET, generateCode, isValidCode, normalizeCode } from './code';

describe('match codes', () => {
  it('has no ambiguous characters', () => {
    for (const c of '01OIL') expect(CODE_ALPHABET).not.toContain(c);
    expect(CODE_ALPHABET).toHaveLength(31);
  });
  it('generates 4 characters from the alphabet', () => {
    for (let i = 0; i < 50; i++) expect(isValidCode(generateCode())).toBe(true);
  });
  it('is deterministic with an injected random source', () => {
    expect(generateCode(() => 0)).toBe('AAAA');
    expect(generateCode(() => 0.5)).toBe('SSSS');
  });
  it('normalizes typed input', () => {
    expect(normalizeCode(' k7 qx ')).toBe('K7QX');
  });
  it('validates', () => {
    expect(isValidCode('K7QX')).toBe(true);
    expect(isValidCode('K7Q')).toBe(false);
    expect(isValidCode('K0QX')).toBe(false);
  });
});

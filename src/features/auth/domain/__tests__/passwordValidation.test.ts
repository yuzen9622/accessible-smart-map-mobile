import { isPlausibleEmail, validatePassword } from '../passwordValidation';

// 移植自 Web `src/lib/__tests__/passwordValidation.test.ts`；期望值從中文訊息改為錯誤碼。
describe('validatePassword', () => {
  it('accepts a password meeting every rule', () => {
    expect(validatePassword('abc12345')).toBeNull();
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('ab12')).toBe('tooShort');
  });

  it('rejects passwords over 72 bytes (measured in UTF-8 bytes, not characters)', () => {
    const password = '中'.repeat(25);
    expect(new TextEncoder().encode(password).length).toBe(75);
    expect(validatePassword(password)).toBe('tooLong');
  });

  it('accepts exactly 72 bytes — the byte-length check itself must be <=, not <', () => {
    const password = `${'中'.repeat(23)}a1x`;
    expect(new TextEncoder().encode(password).length).toBe(72);
    expect(validatePassword(password)).toBeNull();
  });

  it('rejects 73 bytes — one over the boundary', () => {
    const password = `${'中'.repeat(23)}a1xy`;
    expect(new TextEncoder().encode(password).length).toBe(73);
    expect(validatePassword(password)).toBe('tooLong');
  });

  it('rejects a password with letters but no digit', () => {
    expect(validatePassword('abcdefgh')).toBe('needsLetterAndDigit');
  });

  it('rejects a password with digits but no letter', () => {
    expect(validatePassword('12345678')).toBe('needsLetterAndDigit');
  });
});

describe('isPlausibleEmail', () => {
  it('accepts a normal address and trims whitespace', () => {
    expect(isPlausibleEmail(' a@b.co ')).toBe(true);
  });

  it('rejects missing @ or domain dot', () => {
    expect(isPlausibleEmail('ab.co')).toBe(false);
    expect(isPlausibleEmail('a@bco')).toBe(false);
  });
});

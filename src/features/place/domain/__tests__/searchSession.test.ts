import { createSearchSessionToken } from '../searchSession';

describe('createSearchSessionToken', () => {
  it('returns a non-empty string and a fresh value on each call', () => {
    const a = createSearchSessionToken();
    const b = createSearchSessionToken();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

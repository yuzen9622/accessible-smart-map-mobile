import { firstParam, parseFiniteParam, parseRouteListParam } from '../screenParams';

describe('screenParams', () => {
  it('firstParam handles string, array and missing', () => {
    expect(firstParam('a')).toBe('a');
    expect(firstParam(['b', 'c'])).toBe('b');
    expect(firstParam(undefined)).toBe('');
  });
  it('parseFiniteParam rejects empty and NaN', () => {
    expect(parseFiniteParam('25.03')).toBe(25.03);
    expect(parseFiniteParam('')).toBeNull();
    expect(parseFiniteParam('abc')).toBeNull();
    expect(parseFiniteParam(undefined)).toBeNull();
  });
  it('parseRouteListParam keeps only strings and survives bad JSON', () => {
    expect(parseRouteListParam('["307",1,"262"]')).toEqual(['307', '262']);
    expect(parseRouteListParam('{oops')).toEqual([]);
    expect(parseRouteListParam('{"a":1}')).toEqual([]);
    expect(parseRouteListParam(undefined)).toEqual([]);
  });
});

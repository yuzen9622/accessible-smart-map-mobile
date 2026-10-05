import { firstParam, parseDirectionParam, parseFiniteParam, parseRouteListParam } from '../screenParams';

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
  it('parseDirectionParam accepts only the five direction strings', () => {
    expect(['0', '1', '2', '10', '255'].map(parseDirectionParam)).toEqual([0, 1, 2, 10, 255]);
    expect(parseDirectionParam(['10', '1'])).toBe(10);
    for (const bad of ['', ' ', 'abc', '3', '-1', '01', '10.0', '256', undefined]) expect(parseDirectionParam(bad)).toBeNull();
  });
});

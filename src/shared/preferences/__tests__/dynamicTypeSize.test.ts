import { preferredDynamicTypeSize } from '../dynamicTypeSize';

it('maps app choices to distinct native sizes at the default device size', () => {
  expect(preferredDynamicTypeSize('small', 1)).toBe('small');
  expect(preferredDynamicTypeSize('medium', 1)).toBeUndefined();
  expect(preferredDynamicTypeSize('large', 1)).toBe('xxLarge');
  expect(preferredDynamicTypeSize('mega', 1)).toBe('xxxLarge');
});

it('combines with system accessibility sizes instead of resetting them', () => {
  expect(preferredDynamicTypeSize('medium', 2.143)).toBeUndefined();
  expect(preferredDynamicTypeSize('mega', 2.143)).toBe('accessibility4');
  expect(preferredDynamicTypeSize('large', 3.571)).toBe('accessibility5');
  expect(preferredDynamicTypeSize('small', 2.143)).toBe('accessibility1');
});

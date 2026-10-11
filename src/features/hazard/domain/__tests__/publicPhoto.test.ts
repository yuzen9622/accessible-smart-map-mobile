import { resolvePublicPhotoUrl } from '../publicPhoto';

const path = '/api/v1/a11y/reports/r1/photo/public';

it.each(['https://backend.test', 'https://backend.test/api/v1', 'https://backend.test/api/v1/'])('resolves relative public URLs at the backend origin (%s)', (base) => {
  expect(resolvePublicPhotoUrl(path, base)).toBe(`https://backend.test${path}`);
  expect(resolvePublicPhotoUrl(path.slice(1), base)).toBe(`https://backend.test${path}`);
  expect(resolvePublicPhotoUrl(`https://backend.test${path}`, base)).toBe(`https://backend.test${path}`);
});

it.each([null, undefined, '', ' ', '/api/v1/a11y/reports/r1/photo', 'https://storage.test/photo.jpg', `https://elsewhere.test${path}`, `//elsewhere.test${path}`, 'file:///photo.jpg', `https://user:password@backend.test${path}`, `${path}?token=secret`, `${path}#photo`])('does not load missing, private or non-backend URLs (%s)', (url) => {
  expect(resolvePublicPhotoUrl(url, 'https://backend.test')).toBeNull();
});

it('fails closed for invalid backend configuration', () => {
  expect(resolvePublicPhotoUrl(path, 'not a URL')).toBeNull();
});

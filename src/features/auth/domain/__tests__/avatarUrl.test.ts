import { resolveAvatarUrl } from '../avatarUrl';

const API = 'https://map-dev.yuzen.dev';

describe('resolveAvatarUrl', () => {
  it('resolves a backend avatar path against the API origin', () => {
    expect(resolveAvatarUrl('/api/v1/avatars/65f1c0ffee0000000000abcd/0123456789abcdef.jpg', `${API}/`)).toBe(
      `${API}/api/v1/avatars/65f1c0ffee0000000000abcd/0123456789abcdef.jpg`,
    );
  });

  it('keeps absolute provider URLs and local previews', () => {
    expect(resolveAvatarUrl('https://lh3.googleusercontent.com/a/abc', API)).toBe('https://lh3.googleusercontent.com/a/abc');
    expect(resolveAvatarUrl('file:///tmp/avatar.jpg', API)).toBe('file:///tmp/avatar.jpg');
  });

  it('drops empty values, other backend paths and unknown schemes', () => {
    expect(resolveAvatarUrl(undefined, API)).toBeNull();
    expect(resolveAvatarUrl('  ', API)).toBeNull();
    expect(resolveAvatarUrl('/api/v1/user/info', API)).toBeNull();
    expect(resolveAvatarUrl('javascript:alert(1)', API)).toBeNull();
  });
});

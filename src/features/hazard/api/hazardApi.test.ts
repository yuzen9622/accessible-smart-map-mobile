import { createHazardReport } from './hazardApi';

// Keep Expo's real serializer: a fetch mock alone misses unsupported URI parts.
const { convertFormDataAsync } = jest.requireActual('expo/src/winter/fetch/convertFormData');
const { installFormDataPatch } = jest.requireActual('expo/src/winter/FormData');
const RNFormData = jest.requireActual('react-native/Libraries/Network/FormData').default;
const mockBytes = jest.fn();
const mockRequest = jest.fn();

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    get name() { return this.uri.split('/').pop(); }
    get type() { return this.uri.endsWith('.heic') ? 'image/heic' : 'image/jpeg'; }
    bytes() { return mockBytes(); }
  },
}));
jest.mock('@/features/content-safety', () => ({ captureContentContext: () => () => true }));
jest.mock('@/shared/api', () => ({
  ApiError: class extends Error {},
  getAccessToken: () => 'test-token',
  fetchRequest: (...args: unknown[]) => mockRequest(...args),
}));

const NativeFormData = globalThis.FormData;
beforeAll(() => { globalThis.FormData = installFormDataPatch(class extends RNFormData {}); });
afterAll(() => { globalThis.FormData = NativeFormData; });
beforeEach(() => {
  mockBytes.mockReset();
  mockRequest.mockReset();
});

it.each(['jpg', 'heic'])('serializes the original %s photo bytes with Expo fetch', async (extension) => {
  const original = new Uint8Array([0xff, 0xd8, 0, 69, 120, 105, 102, 0, 0xfe]);
  mockBytes.mockResolvedValue(original);
  mockRequest.mockImplementation(async (_url, options) => {
    const { body } = await convertFormDataAsync(options.body, 'test-boundary');
    const text = String.fromCharCode(...body);
    expect(text).toContain(String.fromCharCode(...original));
    expect(text).toContain(`filename="photo.${extension}"`);
    expect(text).toContain(`content-type: image/${extension === 'jpg' ? 'jpeg' : 'heic'}`);
    expect(text).toContain('24.13039');
    expect(text).toContain('120.63734');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(options.headers['Content-Type']).toBeUndefined();
    return { ok: true, data: { merged: true } };
  });
  await expect(createHazardReport({
    hazardType: 'obstacle', severity: 'difficult', latitude: 24.13039, longitude: 120.63734,
    photo: { uri: `file:///cache/photo.${extension}`, name: `photo.${extension}`, type: extension === 'jpg' ? 'image/jpeg' : 'image/heic' },
  })).resolves.toEqual({ merged: true, report: null });
  expect(mockBytes).toHaveBeenCalledTimes(1);
});

it('propagates a file read error instead of submitting an empty photo', async () => {
  mockBytes.mockRejectedValue(new Error('File is no longer readable'));
  mockRequest.mockImplementation(async (_url, options) => convertFormDataAsync(options.body));
  await expect(createHazardReport({
    hazardType: 'obstacle', severity: 'difficult', latitude: 24.13039, longitude: 120.63734,
    photo: { uri: 'file:///cache/missing.jpg', name: 'missing.jpg', type: 'image/jpeg' },
  })).rejects.toThrow('File is no longer readable');
});

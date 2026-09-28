import { createClientRequestId } from '../requestId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createClientRequestId', () => {
  it('produces an RFC 4122 v4 UUID', () => {
    for (let i = 0; i < 50; i++) expect(createClientRequestId()).toMatch(UUID_V4);
  });

  it('sets the version and variant bits whatever the random source returns', () => {
    const allOnes = createClientRequestId((bytes) => bytes.fill(0xff));
    const allZeros = createClientRequestId((bytes) => bytes.fill(0x00));
    expect(allOnes).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(allZeros).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('is unique across calls with the default source', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createClientRequestId()));
    expect(ids.size).toBe(200);
  });
});

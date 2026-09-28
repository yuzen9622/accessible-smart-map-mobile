import { createMemoryStorage, type KeyValueStorage } from '../keyValue';
import { commitVersionedWrite, readJson } from '../migration';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

describe('commitVersionedWrite', () => {
  it('全部資料寫完才寫版本號', () => {
    const order: string[] = [];
    const base = createMemoryStorage();
    const storage: KeyValueStorage = {
      ...base,
      set: (key, value) => {
        order.push(key);
        base.set(key, value);
      },
    };
    commitVersionedWrite(storage, {
      entries: { searchHistory: '[]', savedPlaces: '[]' },
      versionKey: 'placeSchemaVersion',
      version: '2',
    });
    expect(order).toEqual(['searchHistory', 'savedPlaces', 'placeSchemaVersion']);
    expect(base.getString('placeSchemaVersion')).toBe('2');
  });

  it('中途失敗時還原所有 key（含原本不存在的）並拋出原始錯誤', () => {
    const base = createMemoryStorage({ searchHistory: '["old"]', placeSchemaVersion: '1' });
    const quota = new Error('quota exceeded');
    const storage: KeyValueStorage = {
      ...base,
      set: (key, value) => {
        if (key === 'savedPlaceCategories') throw quota;
        base.set(key, value);
      },
    };
    expect(() =>
      commitVersionedWrite(storage, {
        entries: { searchHistory: '["new"]', savedPlaces: '["a"]', savedPlaceCategories: '{}' },
        versionKey: 'placeSchemaVersion',
        version: '2',
      }),
    ).toThrow(quota);
    expect(base.getString('searchHistory')).toBe('["old"]');
    expect(base.contains('savedPlaces')).toBe(false);
    expect(base.getString('placeSchemaVersion')).toBe('1');
  });
});

describe('readJson', () => {
  it('不存在、損毀或型別不符時回傳 fallback，且不改動儲存', () => {
    const storage = createMemoryStorage({ broken: '{', wrong: '{"a":1}', ok: '["x"]' });
    expect(readJson(storage, 'missing', isStringArray, [])).toEqual([]);
    expect(readJson(storage, 'broken', isStringArray, [])).toEqual([]);
    expect(readJson(storage, 'wrong', isStringArray, [])).toEqual([]);
    expect(readJson(storage, 'ok', isStringArray, [])).toEqual(['x']);
    expect(storage.getString('broken')).toBe('{');
  });
});

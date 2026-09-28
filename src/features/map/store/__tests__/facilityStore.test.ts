import { applyDefaultFacilityCategories, useFacilityStore } from '../facilityStore';

describe('applyDefaultFacilityCategories', () => {
  beforeEach(() => useFacilityStore.setState({ selected: [] }));

  it('篩選仍為空時套用預設類別', () => {
    expect(applyDefaultFacilityCategories(['elevator', 'toilet'])).toBe(true);
    expect(useFacilityStore.getState().selected).toEqual(['elevator', 'toilet']);
  });

  it('使用者已選過就不覆蓋', () => {
    useFacilityStore.setState({ selected: ['ramp'] });
    expect(applyDefaultFacilityCategories(['elevator'])).toBe(false);
    expect(useFacilityStore.getState().selected).toEqual(['ramp']);
  });

  it('沒有預設類別時不動作', () => {
    expect(applyDefaultFacilityCategories([])).toBe(false);
    expect(useFacilityStore.getState().selected).toEqual([]);
  });
});

// 新寫：工具標籤（Web 的 toolLabels 沒有測試，只在 thinkingTrace 測試間接涵蓋）。
import { KNOWN_TOOL_NAMES, toolDoneLabel, toolLoadingLabel } from '../toolLabels';
import { t } from '../testing/translate';

describe('toolLabels', () => {
  it('已知工具用專屬文字', () => {
    expect(toolLoadingLabel('findA11yPlaces', t)).toBe('正在查詢周邊無障礙設施…');
    expect(toolDoneLabel('findA11yPlaces', t)).toBe('查詢無障礙設施');
  });

  it('未知工具：loading 退回「正在{名稱}…」，done 退回原名', () => {
    expect(toolLoadingLabel('someNewTool', t)).toBe('正在someNewTool…');
    expect(toolDoneLabel('someNewTool', t)).toBe('someNewTool');
  });

  it('每個已知工具在字串表都有 done 與 loading（t 缺 key 會丟錯）', () => {
    for (const name of KNOWN_TOOL_NAMES) {
      expect(toolDoneLabel(name, t)).not.toBe('');
      expect(toolLoadingLabel(name, t)).toMatch(/…$/);
    }
    expect(KNOWN_TOOL_NAMES).toHaveLength(26);
  });
});

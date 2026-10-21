import { fireEvent, render, screen } from '@testing-library/react-native';
import ToolResultsBox from '../ToolResultsBox';
import { getAggregatedToolResults, getToolResultGroup } from '../../domain/toolResultCards';
import { t } from '../../domain/testing/translate';
import { changeAppLanguage } from '@/shared/i18n';

jest.mock('@/shared/ui', () => ({ Icon: () => null }));

it('renders full guide text and a clickable HTTP source through the existing card', async () => {
  const content = '完整指南'.repeat(100);
  const group = getToolResultGroup('searchAccessibilityGuide', { ok: true, results: [{ title: '指南', content, source: 'https://example.org/guide' }] }, t)!;
  const open = jest.fn();
  await render(<ToolResultsBox groups={[group]} isDark={false} onOpenItem={open} />);
  expect(screen.getByText(content).props.numberOfLines).toBeUndefined();
  const link = screen.getByRole('link');
  fireEvent.press(link);
  expect(open).toHaveBeenCalledWith(group.items[0]);
});

it('makes every direction and stop reachable through show more', async () => {
  await changeAppLanguage('zh-TW');
  const directions = [0, 1].map(direction => ({ direction, subRouteUid: `r${direction}`, to: `方向${direction}`, stops: Array.from({ length: 50 }, (_, seq) => ({ stopUid: `${direction}-${seq}`, seq, name: `方向${direction}站${seq}` })) }));
  const groups = getAggregatedToolResults([{ name: 'getBusRouteDetail', result: { ok: true, directions } }], t);
  expect(groups[0].items).toHaveLength(100);
  await render(<ToolResultsBox groups={groups} isDark={false} onOpenItem={jest.fn()} />);
  expect(screen.queryByText('方向1站49')).toBeNull();
  for (let i = 0; i < 8; i++) await fireEvent.press(screen.getByRole('button', { name: /顯示更多結果/ }));
  expect(screen.getByText('方向1站49')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /顯示更多結果/ })).toBeNull();
});

it('renders the full web answer without activating unsafe links', async () => {
  const answer = '完整答案'.repeat(100);
  const group = getToolResultGroup('webSearch', { ok: true, answer, sources: [{ title: '不安全', url: 'javascript:alert(1)' }] }, t)!;
  await render(<ToolResultsBox groups={[group]} isDark={false} onOpenItem={jest.fn()} />);
  expect(screen.getByText(answer).props.numberOfLines).toBeUndefined();
  expect(screen.queryByRole('link')).toBeNull();
});

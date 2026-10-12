import type { RouteMessageDetail } from '../../types/route';
import { orderRouteHighlights, pairRouteMessages } from '../routeMessages';

const caution = 'The walk to your destination could not be connected.';
const positive = 'An accessible toilet is available nearby.';
const detail = (index: number, code: string, message: string): RouteMessageDetail => ({ index, code, message });

describe('route message presentation', () => {
  it.each([
    ['en', caution], ['zh-TW', '無法連接終點，請留意'],
  ])('classifies %s caution by code, not wording', (_language, text) => {
    expect(pairRouteMessages([text], [detail(0, 'ROUTE_WALK_CONNECTOR_UNAVAILABLE', text)]))
      .toEqual([{ index: 0, text, tone: 'caution' }]);
  });

  it('pairs original indices before sorting/truncating and does not mutate input', () => {
    const messages = [positive, 'source announcement', 'Walk 100 m', caution];
    const details = [detail(3, 'ROUTE_WALK_CONNECTOR_UNAVAILABLE', caution), detail(0, 'ROUTE_TOILET_AVAILABLE', positive)];
    expect(orderRouteHighlights(messages, details).slice(0, 3)).toEqual([
      { index: 3, text: caution, tone: 'caution' },
      { index: 0, text: positive, tone: 'positive' },
      { index: 1, text: 'source announcement', tone: 'neutral' },
    ]);
    expect(messages[0]).toBe(positive);
    expect(details[0].index).toBe(3);
  });

  it.each([
    undefined,
    [],
    [detail(0, 'FUTURE_CODE', caution)],
    [detail(1, 'ROUTE_TOILET_AVAILABLE', caution)],
    [detail(-1, 'ROUTE_TOILET_AVAILABLE', caution)],
    [detail(0.5, 'ROUTE_TOILET_AVAILABLE', caution)],
    [detail(0, 'ROUTE_TOILET_AVAILABLE', 'different message')],
    [detail(0, 'ROUTE_TOILET_AVAILABLE', caution), detail(0, 'ROUTE_WALK_CONNECTOR_UNAVAILABLE', caution)],
  ])('keeps raw text neutral when detail is absent, unknown or invalid (%j)', (details) => {
    expect(pairRouteMessages([caution], details)).toEqual([{ index: 0, text: caution, tone: 'neutral' }]);
  });

  it('preserves duplicate source strings and classifies only their own unique detail', () => {
    const raw = ['請留意', '請留意', positive];
    expect(pairRouteMessages(raw, [detail(1, 'ROUTE_HIGH_FLOOR_NO_ALTERNATIVE', raw[1])])).toEqual([
      { index: 0, text: raw[0], tone: 'neutral' },
      { index: 1, text: raw[1], tone: 'caution' },
      { index: 2, text: positive, tone: 'neutral' },
    ]);
  });

  it('retains warnings with sparse metadata without rendering detail-only entries', () => {
    const raw = ['Source alert', 'Sparse route data', 'Source alert'];
    expect(pairRouteMessages(raw, [detail(1, 'ROUTE_DATA_SPARSE', raw[1]), detail(9, 'ROUTE_DATA_SPARSE', 'extra')])
      .map(({ text }) => text)).toEqual(raw);
  });
});

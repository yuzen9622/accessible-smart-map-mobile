import { parsePushTarget } from '../pushPayload';

describe('parsePushTarget', () => {
  it('recognises SOS status pushes', () => {
    expect(parsePushTarget({ type: 'sos_update', event: 'claimed', sessionId: 's1' })).toEqual({ kind: 'sos', sessionId: 's1' });
    expect(parsePushTarget({ type: 'sos' })).toEqual({ kind: 'sos', sessionId: null });
  });

  it('recognises hazard review pushes', () => {
    expect(parsePushTarget({ type: 'hazard_review', reportId: '507f1f77bcf86cd799439011', notificationId: '507f1f77bcf86cd799439011:2' })).toEqual({ kind: 'hazard', reportId: '507f1f77bcf86cd799439011', notificationId: '507f1f77bcf86cd799439011:2' });
  });

  it('ignores unknown payloads', () => {
    expect(parsePushTarget(null)).toEqual({ kind: 'none' });
    expect(parsePushTarget({ type: 'promo' })).toEqual({ kind: 'none' });
  });
});

it.each([null, 123, '../report', 'not-an-id'])('malformed hazard identifier %p safely falls back to list', (reportId) => {
  expect(parsePushTarget({ type: 'hazard_review', reportId, notificationId: 'bad' })).toEqual({ kind: 'hazard', reportId: null, notificationId: null });
});
it('retains legacy hazard compatibility without accepting arbitrary routes or sensitive payload fields', () => {
  expect(parsePushTarget({ type: 'hazard', reportId: '507f1f77bcf86cd799439011', photoUrl: 'secret', latitude: 25, note: 'internal' }))
    .toEqual({ kind: 'hazard', reportId: '507f1f77bcf86cd799439011', notificationId: null });
});

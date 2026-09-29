import { parsePushTarget } from '../pushPayload';

describe('parsePushTarget', () => {
  it('recognises SOS status pushes', () => {
    expect(parsePushTarget({ type: 'sos_status', sessionId: 's1' })).toEqual({ kind: 'sos', sessionId: 's1' });
    expect(parsePushTarget({ type: 'sos' })).toEqual({ kind: 'sos', sessionId: null });
  });

  it('recognises hazard review pushes', () => {
    expect(parsePushTarget({ type: 'hazard_review', reportId: 'r1' })).toEqual({ kind: 'hazard', reportId: 'r1' });
  });

  it('ignores unknown payloads', () => {
    expect(parsePushTarget(null)).toEqual({ kind: 'none' });
    expect(parsePushTarget({ type: 'promo' })).toEqual({ kind: 'none' });
  });
});

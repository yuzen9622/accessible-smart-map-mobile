import { toNavInstruction } from '../voiceNavInstruction';
import type { VoiceNavStep } from '../voiceSession';

const base: VoiceNavStep = { index: 2, instruction: '前方右轉', legType: 'WALK', distanceM: 30, isTransit: false };

describe('toNavInstruction', () => {
  it('帶入後端提供的 type／方向／街名／方位角', () => {
    expect(
      toNavInstruction({ ...base, type: 'facility', relativeDirection: '右前方', streetName: '忠孝東路', bearing: 90 }),
    ).toEqual({
      text: '前方右轉',
      type: 'facility',
      bearing: 90,
      relativeDirection: '右前方',
      distanceM: 30,
      streetName: '忠孝東路',
      legType: 'WALK',
      polylineIndex: null,
    });
  });

  it('沒有 type 時依 isTransit／index 推導', () => {
    expect(toNavInstruction({ ...base, isTransit: true, legType: 'BUS' }).type).toBe('transit_board');
    expect(toNavInstruction({ ...base, index: 0 }).type).toBe('depart');
    expect(toNavInstruction(base).type).toBe('turn');
  });

  it('未知的 type 與方向退回推導值與 null（Web 直接 as 轉型）', () => {
    const out = toNavInstruction({ ...base, type: 'teleport', relativeDirection: 'north' });
    expect(out.type).toBe('turn');
    expect(out.relativeDirection).toBeNull();
    expect(out.bearing).toBeNull();
    expect(out.streetName).toBeNull();
  });
});

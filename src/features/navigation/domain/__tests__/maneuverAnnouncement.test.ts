import {
  isStraightManeuver,
  selectManeuverStage,
  selectProgressReminder,
  spokenDistance,
  type ManeuverStage,
} from '../maneuverAnnouncement';

const none = new Set<ManeuverStage>();

describe('selectManeuverStage', () => {
  it('announces ahead first, reminds when close, then calls the turn once', () => {
    expect(selectManeuverStage(200, 'WALK', none, null)).toBe('advance');
    expect(selectManeuverStage(80, 'WALK', new Set(['advance']), 200)).toBeNull();
    expect(selectManeuverStage(45, 'WALK', new Set(['advance']), 200)).toBe('prepare');
    expect(selectManeuverStage(30, 'WALK', new Set(['advance', 'prepare']), 200)).toBeNull();
    expect(selectManeuverStage(10, 'WALK', new Set(['advance', 'prepare']), 200)).toBe('now');
    expect(selectManeuverStage(0, 'WALK', new Set(['advance', 'prepare', 'now']), 200)).toBeNull();
  });

  it('skips the reminder when the first call-out was already close', () => {
    expect(selectManeuverStage(45, 'WALK', new Set(['advance']), 60)).toBeNull();
  });

  it('calls the turn straight away when the step starts at the corner', () => {
    expect(selectManeuverStage(5, 'WALK', none, null)).toBe('now');
  });

  it('uses longer distances for driving', () => {
    expect(selectManeuverStage(280, 'DRIVE', new Set(['advance']), 800)).toBe('prepare');
    expect(selectManeuverStage(45, 'DRIVE', new Set(['advance', 'prepare']), 800)).toBe('now');
  });
});

describe('selectManeuverStage — straight steps', () => {
  it('never announces ahead, only once on arrival at the point', () => {
    expect(selectManeuverStage(210, 'WALK', none, null, true)).toBeNull();
    expect(selectManeuverStage(40, 'WALK', none, null, true)).toBeNull();
    expect(selectManeuverStage(10, 'WALK', none, null, true)).toBe('now');
    expect(selectManeuverStage(5, 'WALK', new Set(['now']), null, true)).toBeNull();
  });
});

describe('selectProgressReminder', () => {
  const none = new Set<number>();

  it('reminds once at each 500 m mark of the remaining stretch', () => {
    expect(selectProgressReminder(1150, 'WALK', none, 1200)).toBeNull();
    expect(selectProgressReminder(998, 'WALK', none, 1200)).toBe(1000);
    expect(selectProgressReminder(900, 'WALK', new Set([1000]), 1200)).toBeNull();
    expect(selectProgressReminder(497, 'WALK', new Set([1000]), 1200)).toBe(500);
  });

  it('skips a mark right after the step started, and leaves the last 50 m to the turn call-out', () => {
    expect(selectProgressReminder(990, 'WALK', none, 1080)).toBeNull();
    expect(selectProgressReminder(40, 'WALK', none, 600)).toBeNull();
  });

  it('only reminds on walking legs', () => {
    expect(selectProgressReminder(998, 'DRIVE', none, 3000)).toBeNull();
    expect(selectProgressReminder(998, 'BUS', none, 3000)).toBeNull();
  });
});

describe('isStraightManeuver', () => {
  it('is true only for CONTINUE and STRAIGHT; a missing or null maneuver keeps the old behaviour', () => {
    expect(isStraightManeuver({ maneuver: 'CONTINUE' })).toBe(true);
    expect(isStraightManeuver({ maneuver: 'STRAIGHT' })).toBe(true);
    expect(isStraightManeuver({ maneuver: 'SLIGHTLY_RIGHT' })).toBe(false);
    expect(isStraightManeuver({ maneuver: null })).toBe(false);
    expect(isStraightManeuver({})).toBe(false);
  });
});

describe('spokenDistance', () => {
  it('rounds to 10 m, never says less than 10 m, and switches to km', () => {
    expect(spokenDistance(183)).toEqual({ unit: 'm', value: 180 });
    expect(spokenDistance(3)).toEqual({ unit: 'm', value: 10 });
    expect(spokenDistance(1260)).toEqual({ unit: 'km', value: 1.3 });
  });
});

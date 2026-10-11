import { parseStationTimetable, parseTrainTimetable } from '../train';

describe('parseTrainTimetable', () => {
  it('parses a full OD timetable response', () => {
    const result = parseTrainTimetable({
      railSystem: 'TRA',
      date: '2026-10-15',
      origin: { name: '臺北', stationID: '1000' },
      destination: { name: '臺中', stationID: '3300' },
      totalCount: 2,
      matchedCount: 1,
      firstTrain: '06:00',
      lastTrain: '23:00',
      trains: [
        { trainNo: '123', trainType: '自強', departureTime: '09:00', arrivalTime: '11:00', durationMinutes: 120 },
        { trainNo: 'bad' },
      ],
    });
    expect(result).not.toBeNull();
    expect(result?.trains).toHaveLength(1);
    expect(result?.trains[0]).toEqual({
      trainNo: '123',
      trainType: '自強',
      departureTime: '09:00',
      arrivalTime: '11:00',
      arrivesNextDay: false,
      durationMinutes: 120,
    });
  });

  it('returns null for malformed input', () => {
    expect(parseTrainTimetable(null)).toBeNull();
    expect(parseTrainTimetable({ railSystem: 'BAD' })).toBeNull();
  });
});

describe('parseStationTimetable', () => {
  it('parses a station board response', () => {
    const result = parseStationTimetable({
      railSystem: 'THSR',
      date: '2026-10-15',
      station: { name: '臺北', stationID: '0990' },
      departAfter: '09:00',
      totalCount: 1,
      matchedCount: 1,
      firstTrain: '09:05',
      lastTrain: '09:05',
      trains: [{ trainNo: '601', departureTime: '09:05', destination: '左營' }],
    });
    expect(result?.trains).toEqual([
      { trainNo: '601', trainType: null, direction: null, destination: '左營', departureTime: '09:05', arrivalTime: null },
    ]);
  });

  it('returns null for malformed input', () => {
    expect(parseStationTimetable({})).toBeNull();
  });
});

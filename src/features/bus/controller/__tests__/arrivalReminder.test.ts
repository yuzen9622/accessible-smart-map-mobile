import { act } from '@testing-library/react-native';

import {
  arrivalReminderKey,
  refreshArrivalReminder,
  startArrivalReminder,
  stopArrivalReminder,
} from '../arrivalReminder';

const mockPermission = jest.fn();
jest.mock('@/features/notifications', () => ({
  requestPushPermission: () => mockPermission(),
}));

const mockSchedule = jest.fn();
const mockCancel = jest.fn();
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

const content = { title: 't', body: 'b' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let nextId = 0;
beforeEach(() => {
  nextId = 0;
  mockPermission.mockReset().mockResolvedValue('granted');
  mockSchedule.mockReset().mockImplementation(async () => `n${(nextId += 1)}`);
  mockCancel.mockReset().mockResolvedValue(undefined);
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('arrivalReminderKey', () => {
  it('separates sub-routes and directions including 2 and 10', () => {
    const keys = [
      arrivalReminderKey('Taipei', '307', 'U1', 0, '站'),
      arrivalReminderKey('Taipei', '307', 'U2', 0, '站'),
      arrivalReminderKey('Taipei', '307', 'U1', 2, '站'),
      arrivalReminderKey('Taipei', '307', 'U1', 10, '站'),
      arrivalReminderKey('Taipei', '307', undefined, 10, '站'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('arrival reminder', () => {
  it('schedules a reminder for legitimate ETAs 0, 2 and 8 with the 3-minute lead', async () => {
    const key = arrivalReminderKey('Taipei', '1', 'U', 0, 'a');
    await expect(startArrivalReminder(key, 8, content)).resolves.toBe('scheduled');
    expect(mockSchedule.mock.calls[0][0].trigger.seconds).toBe(300);
    await startArrivalReminder(key, 2, content);
    expect(mockSchedule.mock.calls[1][0].trigger.seconds).toBe(5);
    await startArrivalReminder(key, 0, content);
    expect(mockSchedule.mock.calls[2][0].trigger.seconds).toBe(5);
    await stopArrivalReminder(key);
  });

  it.each([null, Number.NaN, -1])('start with ETA %p schedules nothing and cancels the existing reminder', async (eta) => {
    const key = arrivalReminderKey('Taipei', '2', 'U', 0, 'a');
    await startArrivalReminder(key, 20, content);
    mockSchedule.mockClear();
    await expect(startArrivalReminder(key, eta, content)).resolves.toBe('superseded');
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('n1');
  });

  it.each([null, Number.NaN, -1])('refresh with ETA %p cancels the scheduled notification', async (eta) => {
    const key = arrivalReminderKey('Taipei', '3', 'U', 0, 'a');
    await startArrivalReminder(key, 20, content);
    mockSchedule.mockClear();
    await refreshArrivalReminder(key, eta, content);
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('n1');
    // 之後有 ETA 也不會復活：提醒已被取消。
    await refreshArrivalReminder(key, 20, content);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('refresh reschedules only when the fire time moves beyond the threshold', async () => {
    const key = arrivalReminderKey('Taipei', '4', 'U', 0, 'a');
    await startArrivalReminder(key, 10, content);
    await refreshArrivalReminder(key, 10.5, content);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    await refreshArrivalReminder(key, 20, content);
    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(mockCancel).toHaveBeenCalledWith('n1');
    await stopArrivalReminder(key);
  });

  it('a stop that arrives while the start is waiting for permission wins', async () => {
    const key = arrivalReminderKey('Taipei', '5', 'U', 0, 'a');
    const permission = deferred<string>();
    mockPermission.mockReturnValue(permission.promise);
    const started = startArrivalReminder(key, 10, content);
    await stopArrivalReminder(key);
    await act(async () => {
      permission.resolve('granted');
    });
    await expect(started).resolves.toBe('superseded');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('switching targets while the old start awaits permission leaves only the new reminder', async () => {
    const oldKey = arrivalReminderKey('Taipei', '6', 'U1', 0, 'a');
    const newKey = arrivalReminderKey('Taipei', '6', 'U2', 10, 'a');
    const permission = deferred<string>();
    mockPermission.mockReturnValueOnce(permission.promise);
    const oldStart = startArrivalReminder(oldKey, 10, content);
    await stopArrivalReminder(oldKey);
    await expect(startArrivalReminder(newKey, 10, content)).resolves.toBe('scheduled');
    await act(async () => {
      permission.resolve('granted');
    });
    await expect(oldStart).resolves.toBe('superseded');
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    await stopArrivalReminder(newKey);
  });

  it('a stop during scheduling cancels the notification that finishes late', async () => {
    const key = arrivalReminderKey('Taipei', '7', 'U', 0, 'a');
    const scheduling = deferred<string>();
    mockSchedule.mockReturnValueOnce(scheduling.promise);
    const started = startArrivalReminder(key, 10, content);
    await act(async () => {
      await Promise.resolve();
    });
    await stopArrivalReminder(key);
    await act(async () => {
      scheduling.resolve('late');
    });
    await expect(started).resolves.toBe('superseded');
    expect(mockCancel).toHaveBeenCalledWith('late');
  });

  it('a refresh finishing after a stop does not resurrect the reminder', async () => {
    const key = arrivalReminderKey('Taipei', '8', 'U', 0, 'a');
    await startArrivalReminder(key, 10, content);
    const scheduling = deferred<string>();
    mockSchedule.mockReturnValueOnce(scheduling.promise);
    const refreshed = refreshArrivalReminder(key, 30, content);
    await act(async () => {
      await Promise.resolve();
    });
    await stopArrivalReminder(key);
    await act(async () => {
      scheduling.resolve('late');
    });
    await refreshed;
    expect(mockCancel).toHaveBeenCalledWith('late');
    mockSchedule.mockClear();
    await refreshArrivalReminder(key, 40, content);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('a null ETA invalidates a start still awaiting permission', async () => {
    const key = arrivalReminderKey('Taipei', 'null-permission', 'U', 10, 'a');
    const permission = deferred<string>();
    mockPermission.mockReturnValue(permission.promise);
    const started = startArrivalReminder(key, 10, content);
    await refreshArrivalReminder(key, null, content);
    permission.resolve('granted');
    try {
      await expect(started).resolves.toBe('superseded');
      expect(mockSchedule).not.toHaveBeenCalled();
    } finally {
      await stopArrivalReminder(key);
    }
  });

  it('a null ETA invalidates the first notification still being scheduled', async () => {
    const key = arrivalReminderKey('Taipei', 'null-schedule', 'U', 10, 'a');
    const scheduling = deferred<string>();
    mockSchedule.mockReturnValueOnce(scheduling.promise);
    const started = startArrivalReminder(key, 10, content);
    await act(async () => { await Promise.resolve(); });
    await refreshArrivalReminder(key, null, content);
    scheduling.resolve('late-null');
    try {
      await expect(started).resolves.toBe('superseded');
      expect(mockCancel).toHaveBeenCalledWith('late-null');
    } finally {
      await stopArrivalReminder(key);
    }
  });

  it('reports denied without scheduling when permission is refused', async () => {
    mockPermission.mockResolvedValue('denied');
    const key = arrivalReminderKey('Taipei', '9', 'U', 0, 'a');
    await expect(startArrivalReminder(key, 10, content)).resolves.toBe('denied');
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

import {
  getNavigationSpeechOwner,
  isNavigationSpeechSuppressed,
  subscribeNavigationSpeechSuppression,
  subscribeSpeechOwner,
  suppressNavigationSpeechForCue,
} from '../speechOwnerPort';

it('holds local speech until the last cue releases without changing the speaker owner', () => {
  const owner = getNavigationSpeechOwner();
  const ownerChanged = jest.fn();
  const suppressed = jest.fn();
  const unsubscribeOwner = subscribeSpeechOwner(ownerChanged);
  const unsubscribeSuppression = subscribeNavigationSpeechSuppression(suppressed);
  const releaseFirst = suppressNavigationSpeechForCue();
  const releaseSecond = suppressNavigationSpeechForCue();
  try {
    expect(isNavigationSpeechSuppressed()).toBe(true);
    expect(getNavigationSpeechOwner()).toBe(owner);
    expect(suppressed.mock.calls).toEqual([[false], [true]]);

    releaseFirst();
    releaseFirst();
    expect(isNavigationSpeechSuppressed()).toBe(true);
    expect(suppressed.mock.calls).toEqual([[false], [true]]);

    releaseSecond();
    releaseSecond();
    expect(isNavigationSpeechSuppressed()).toBe(false);
    expect(suppressed.mock.calls).toEqual([[false], [true], [false]]);
    expect(ownerChanged).not.toHaveBeenCalled();
  } finally {
    releaseFirst();
    releaseSecond();
    unsubscribeOwner();
    unsubscribeSuppression();
  }
});

it('reports an existing cue to a new subscriber and stops notifying after unsubscribe', () => {
  const release = suppressNavigationSpeechForCue();
  const listener = jest.fn();
  const unsubscribe = subscribeNavigationSpeechSuppression(listener);
  try {
    expect(listener).toHaveBeenCalledWith(true);
    unsubscribe();
    release();
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    unsubscribe();
    release();
  }
});

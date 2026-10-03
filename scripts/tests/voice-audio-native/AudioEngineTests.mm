#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <objc/runtime.h>
#import <audioapi/ios/AudioAPIModule.h>
#import <audioapi/ios/system/AudioEngine.h>
#import <audioapi/ios/system/AudioSessionManager.h>
#import <audioapi/ios/system/SystemNotificationManager.h>

static NSMutableArray<NSString *> *events;
static BOOL voiceMode = YES;
static BOOL failVoiceProcessing = NO;
static NSInteger configurationNotificationsRemaining = 0;
static NSInteger failures = 0;
static NSInteger assertions = 0;
static NSInteger engineGeneration = 0;
static double inputSampleRate = 48000;

static void check(BOOL condition, const char *name) {
  assertions++;
  printf("%s %s\n", condition ? "PASS" : "FAIL", name);
  if (!condition) {
    failures++;
    printf("  trace: %s\n", [[events componentsJoinedByString:@" -> "] UTF8String]);
  }
}

static NSUInteger count(NSString *event) {
  return [[events filteredArrayUsingPredicate:[NSPredicate predicateWithFormat:@"SELF == %@", event]] count];
}

static void drainNotifications() {
  [[NSRunLoop currentRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.03]];
}

@interface FakeSession : NSObject
@end
@implementation FakeSession
- (NSString *)mode { return voiceMode ? AVAudioSessionModeVoiceChat : AVAudioSessionModeDefault; }
+ (id)sharedInstance { static id session; if (!session) session = [FakeSession new]; return session; }
@end

@implementation AudioAPIModule
- (void)invokeHandlerWithEventName:(audioapi::AudioEvent)eventName
                           payload:(audioapi::AudioEventPayload)payload {}
@end

@implementation AudioSessionManager
+ (instancetype)sharedInstance {
  static id manager;
  if (!manager) manager = [AudioSessionManager new];
  return manager;
}
- (bool)ensureActive:(bool)force error:(NSError **)error {
  [events addObject:@"session-active"];
  return true;
}
- (void)markInactive { [events addObject:@"session-inactive"]; }
- (bool)setActive:(bool)active error:(NSError **)error { return true; }
@end

@class FakeEngine;
@interface FakeInput : NSObject
@property (nonatomic, assign) BOOL voiceProcessingEnabled;
@property (nonatomic, weak) FakeEngine *owner;
@end

@interface FakeEngine : NSObject
@property (nonatomic, strong) FakeInput *inputNode;
@property (nonatomic, strong) id mainMixerNode;
@property (nonatomic, assign) BOOL running;
@property (nonatomic, assign) NSInteger generation;
@property (nonatomic, assign) BOOL hasOutputConnection;
@property (nonatomic, assign) BOOL outputFormatInvalidated;
@property (nonatomic, assign) double connectedInputSampleRate;
@end

@implementation FakeInput
- (BOOL)isVoiceProcessingEnabled { return self.voiceProcessingEnabled; }
- (BOOL)setVoiceProcessingEnabled:(BOOL)enabled error:(NSError **)error {
  [events addObject:@"voice-processing-attempt"];
  if (failVoiceProcessing) {
    if (error) *error = [NSError errorWithDomain:@"VoiceTest" code:1 userInfo:nil];
    return NO;
  }
  self.voiceProcessingEnabled = enabled;
  if (self.owner.hasOutputConnection) self.owner.outputFormatInvalidated = YES;
  [events addObject:@"voice-processing-on"];
  if (configurationNotificationsRemaining > 0) {
    configurationNotificationsRemaining--;
    [[NSNotificationCenter defaultCenter]
        postNotificationName:AVAudioEngineConfigurationChangeNotification object:self.owner];
  }
  return YES;
}
- (AVAudioFormat *)outputFormatForBus:(AVAudioNodeBus)bus {
  [events addObject:self.voiceProcessingEnabled ? @"input-format-after-vp" : @"input-format-before-vp"];
  return [[AVAudioFormat alloc] initStandardFormatWithSampleRate:inputSampleRate channels:1];
}
@end

@implementation FakeEngine
- (instancetype)init {
  if (self = [super init]) {
    self.generation = ++engineGeneration;
    self.inputNode = [FakeInput new];
    self.inputNode.owner = self;
    self.mainMixerNode = [NSObject new];
    [events addObject:@"new-engine"];
  }
  return self;
}
- (void)dealloc { [events addObject:[NSString stringWithFormat:@"destroy:%ld", (long)self.generation]]; }
- (BOOL)isRunning { return self.running; }
- (void)stop { self.running = NO; [events addObject:@"stop"]; }
- (void)pause { self.running = NO; [events addObject:@"pause"]; }
- (void)reset {}
- (void)attachNode:(id)node {}
- (void)detachNode:(id)node {}
- (void)connect:(id)from to:(id)to format:(AVAudioFormat *)format {
  if (to == self.mainMixerNode) {
    self.hasOutputConnection = YES;
    [events addObject:self.inputNode.voiceProcessingEnabled ? @"connect-output-after-vp" : @"connect-output-before-vp"];
  } else {
    self.connectedInputSampleRate = format.sampleRate;
    [events addObject:self.inputNode.voiceProcessingEnabled ? @"connect-input-after-vp" : @"connect-input-before-vp"];
  }
}
- (void)prepare { [events addObject:@"prepare"]; }
- (BOOL)startAndReturnError:(NSError **)error {
  self.running = YES;
  [events addObject:@"start"];
  return YES;
}
@end

@interface TestEngine : AudioEngine
@end
@implementation TestEngine
- (void)createAudioEngineIfNeeded {
  if (!self.audioEngine) self.audioEngine = (AVAudioEngine *)[FakeEngine new];
}
@end

static TestEngine *makeEngine() {
  voiceMode = YES;
  failVoiceProcessing = NO;
  configurationNotificationsRemaining = 0;
  inputSampleRate = 48000;
  [events removeAllObjects];
  TestEngine *engine = [TestEngine new];
  engine.sessionManager = [AudioSessionManager sharedInstance];
  return engine;
}

static void attachInput(AudioEngine *engine) {
  [engine attachInputNodeWithReceiverBlock:^OSStatus(
      const AudioTimeStamp *stamp, AVAudioFrameCount frames, const AudioBufferList *data) {
    return noErr;
  } onInputConfigurationChange:nil];
}

static void attachOutput(AudioEngine *engine) {
  [engine attachSourceNodeWithRenderBlock:^OSStatus(
      BOOL *silent, const AudioTimeStamp *stamp, AVAudioFrameCount frames, AudioBufferList *data) {
    return noErr;
  } sampleRate:24000 channelCount:2];
}

static TestEngine *makeDuplexEngine() {
  TestEngine *engine = makeEngine();
  attachInput(engine);
  [engine startIfNecessary];
  [engine stopIfNecessary];
  attachOutput(engine);
  [engine startIfNecessary];
  return engine;
}

static void testGraphOrdering() {
  TestEngine *engine = makeDuplexEngine();
  check([(FakeEngine *)engine.audioEngine isRunning] &&
        ![(FakeEngine *)engine.audioEngine outputFormatInvalidated], "capture then playback preserves configured I/O");
  [events removeAllObjects];
  [engine restartAudioEngine];
  NSUInteger vp = [events indexOfObject:@"voice-processing-on"];
  check(vp != NSNotFound && vp < [events indexOfObject:@"connect-output-after-vp"] &&
        vp < [events indexOfObject:@"input-format-after-vp"] &&
        ![(FakeEngine *)engine.audioEngine outputFormatInvalidated], "replacement configures voice processing before graph connections");
  check(count(@"start") == 1 && count(@"prepare") == 1, "replacement starts once after materializing graph");
  [engine cleanup];

  engine = makeEngine();
  attachOutput(engine);
  [engine startIfNecessary];
  [engine stopIfNecessary];
  attachInput(engine);
  [engine startIfNecessary];
  check([(FakeEngine *)engine.audioEngine isRunning] &&
        ![(FakeEngine *)engine.audioEngine outputFormatInvalidated], "playback then capture rebuilds pre-voice-processing output connections");
  [engine cleanup];

  engine = makeEngine();
  attachOutput(engine);
  [engine startIfNecessary];
  check(count(@"voice-processing-attempt") == 0 && engine.inputNode == nil &&
        [(FakeEngine *)engine.audioEngine isRunning], "playback-only session does not activate voice-processing input");
  [engine cleanup];

  engine = makeEngine();
  voiceMode = NO;
  attachInput(engine);
  attachOutput(engine);
  [engine startIfNecessary];
  check(count(@"voice-processing-attempt") == 0 && [(FakeEngine *)engine.audioEngine isRunning], "non-voice session keeps original recording behavior");
  [engine cleanup];
}

static void testFailures() {
  TestEngine *engine = makeEngine();
  failVoiceProcessing = YES;
  attachInput(engine);
  BOOL started = [engine startIfNecessary];
  check(!started && count(@"prepare") == 0 && engine.inputNode == nil, "voice processing failure aborts initial graph startup");
  attachOutput(engine);
  failVoiceProcessing = NO;
  [events removeAllObjects];
  started = [engine startIfNecessary];
  check(started && ![(FakeEngine *)engine.audioEngine outputFormatInvalidated],
        "retry after voice-processing failure defers output until I/O setup succeeds");
  [engine cleanup];

  engine = makeDuplexEngine();
  failVoiceProcessing = YES;
  [events removeAllObjects];
  [engine restartAudioEngine];
  check([engine getState] == AudioEngineStatePaused && count(@"prepare") == 0,
        "voice processing failure during rebuild leaves engine paused");
  [engine cleanup];
}

static void postConfiguration(id changedEngine) {
  [[NSNotificationCenter defaultCenter]
      postNotificationName:AVAudioEngineConfigurationChangeNotification object:changedEngine];
  drainNotifications();
}

static void testNotifications() {
  TestEngine *engine = makeDuplexEngine();
  AudioAPIModule *module = [AudioAPIModule new];
  module.audioEngine = engine;
  module.audioSessionManager = engine.sessionManager;
  SystemNotificationManager *notifications = [[SystemNotificationManager alloc] initWithAudioAPIModule:module];

  [events removeAllObjects];
  postConfiguration(engine.audioEngine);
  check(count(@"new-engine") == 0 && count(@"session-inactive") == 0, "delayed own configuration notification preserves running graph");

  FakeEngine *foreign = [FakeEngine new];
  [events removeAllObjects];
  postConfiguration(foreign);
  check(count(@"new-engine") == 0, "foreign engine notification is ignored");

  id stale = engine.audioEngine;
  [engine restartAudioEngine];
  [events removeAllObjects];
  postConfiguration(stale);
  check(count(@"new-engine") == 0, "replaced engine notification is ignored");

  // Exercise identity independently of the running-engine guard. In-place recovery
  // creates no replacement engine, so checking only new-engine would miss a restart.
  [(FakeEngine *)engine.audioEngine setRunning:NO];
  [events removeAllObjects];
  postConfiguration(foreign);
  check(events.count == 0 && ![(FakeEngine *)engine.audioEngine isRunning],
        "foreign notification leaves stopped current engine and session untouched");

  [(FakeEngine *)engine.audioEngine setRunning:NO];
  [events removeAllObjects];
  postConfiguration(stale);
  check(events.count == 0 && ![(FakeEngine *)engine.audioEngine isRunning],
        "stale notification leaves stopped current engine and session untouched");

  [(FakeEngine *)engine.audioEngine setRunning:NO];
  inputSampleRate = 44100;
  __weak id configurationEngine = engine.audioEngine;
  [events removeAllObjects];
  postConfiguration(engine.audioEngine);
  check(count(@"new-engine") == 0 && count(@"start") == 1 && configurationEngine == engine.audioEngine,
        "real configuration change reconnects and resumes existing engine once");
  check([(FakeEngine *)engine.audioEngine connectedInputSampleRate] == 44100 &&
        count(@"voice-processing-attempt") == 0,
        "configuration recovery reads fresh input format while preserving voice-processing unit");

  NSInteger oldGeneration = [(FakeEngine *)engine.audioEngine generation];
  __weak id oldEngine = engine.audioEngine;
  [(FakeEngine *)engine.audioEngine setRunning:NO];
  [events removeAllObjects];
  @autoreleasepool {
    [[NSNotificationCenter defaultCenter]
        postNotificationName:AVAudioSessionMediaServicesWereResetNotification object:nil];
    [[NSNotificationCenter defaultCenter]
        postNotificationName:AVAudioEngineConfigurationChangeNotification object:engine.audioEngine];
  }
  drainNotifications();
  NSUInteger destruction = [events indexOfObject:[NSString stringWithFormat:@"destroy:%ld", (long)oldGeneration]];
  check(oldEngine == nil && destruction != NSNotFound && destruction < [events indexOfObject:@"start"],
        "queued stale notification releases old engine before media-reset replacement starts");

  // Session setup can deliver route events after the graph has already started.
  // Each eligible reason must preserve a healthy VoiceProcessingIO unit.
  const AVAudioSessionRouteChangeReason routeReasons[] = {
    AVAudioSessionRouteChangeReasonNewDeviceAvailable,
    AVAudioSessionRouteChangeReasonOldDeviceUnavailable,
    AVAudioSessionRouteChangeReasonRouteConfigurationChange,
  };
  const char *routeAssertions[] = {
    "new-device route notification preserves healthy running graph",
    "old-device route notification preserves healthy running graph",
    "route-configuration notification preserves healthy running graph",
  };
  for (NSUInteger index = 0; index < 3; index++) {
    [events removeAllObjects];
    [[NSNotificationCenter defaultCenter] postNotificationName:AVAudioSessionRouteChangeNotification
        object:nil userInfo:@{ AVAudioSessionRouteChangeReasonKey: @(routeReasons[index]) }];
    drainNotifications();
    check(events.count == 0 && [(FakeEngine *)engine.audioEngine isRunning], routeAssertions[index]);
  }

  __weak id routeEngine = engine.audioEngine;
  [(FakeEngine *)engine.audioEngine setRunning:NO];
  inputSampleRate = 32000;
  [events removeAllObjects];
  [[NSNotificationCenter defaultCenter] postNotificationName:AVAudioSessionRouteChangeNotification
      object:nil userInfo:@{ AVAudioSessionRouteChangeReasonKey: @(AVAudioSessionRouteChangeReasonRouteConfigurationChange) }];
  drainNotifications();
  check(routeEngine == engine.audioEngine && count(@"new-engine") == 0 &&
        count(@"start") == 1 && count(@"session-inactive") == 1 &&
        count(@"voice-processing-attempt") == 0 &&
        [(FakeEngine *)engine.audioEngine connectedInputSampleRate] == 32000 &&
        [(FakeEngine *)engine.audioEngine isRunning],
        "stopped route reconnects fresh format in place before any engine notification");
  // The matching engine notification may arrive after route recovery; it must not
  // cause a second restart once the graph is healthy again.
  [events removeAllObjects];
  postConfiguration(engine.audioEngine);
  check(events.count == 0 && [(FakeEngine *)engine.audioEngine isRunning],
        "duplicate configuration notification after route recovery leaves graph untouched");

  [events removeAllObjects];
  [[NSNotificationCenter defaultCenter] postNotificationName:AVAudioSessionMediaServicesWereResetNotification object:nil];
  drainNotifications();
  check(count(@"new-engine") == 1 && count(@"start") == 1, "media services reset retains recovery");

  [engine cleanup];
  engine = makeEngine();
  module.audioEngine = engine;
  [events removeAllObjects];
  postConfiguration(engine.audioEngine);
  check(count(@"new-engine") == 0, "configuration notification without tracked graph is ignored");

  configurationNotificationsRemaining = 8; // Bound a broken implementation's feedback loop.
  attachInput(engine);
  attachOutput(engine);
  [engine startIfNecessary];
  [events removeAllObjects];
  drainNotifications();
  check(count(@"new-engine") == 0 && configurationNotificationsRemaining == 7,
        "voice-processing configuration notifications do not create a rebuild loop");

  [[NSNotificationCenter defaultCenter] removeObserver:notifications];
  [engine cleanup];
}

int main() {
  @autoreleasepool {
    events = [NSMutableArray new];
    Method original = class_getClassMethod([AVAudioSession class], @selector(sharedInstance));
    Method replacement = class_getClassMethod([FakeSession class], @selector(sharedInstance));
    method_setImplementation(original, method_getImplementation(replacement));
    testGraphOrdering();
    testFailures();
    testNotifications();
    printf("Native voice regression: %ld/%ld assertions passed\n", (long)(assertions - failures), (long)assertions);
    return failures ? 1 : 0;
  }
}

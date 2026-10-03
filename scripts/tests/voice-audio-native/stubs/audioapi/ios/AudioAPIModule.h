#pragma once

#import <Foundation/Foundation.h>
#include <audioapi/events/AudioEvent.h>
#include <string>
#include <variant>

// Notification tests need the payload values, but not React Native's JSI runtime.
namespace audioapi {
struct DoubleValuePayload { double value; };
struct InterruptionPayload { std::string type; bool shouldResume; };
struct StringPayload { std::string name; std::string reason; };
using AudioEventPayload = std::variant<DoubleValuePayload, InterruptionPayload, StringPayload>;
}

@class AudioEngine;
@class AudioSessionManager;

@interface AudioAPIModule : NSObject
@property (nonatomic, strong) AudioEngine *audioEngine;
@property (nonatomic, strong) AudioSessionManager *audioSessionManager;
- (void)invokeHandlerWithEventName:(audioapi::AudioEvent)eventName
                           payload:(audioapi::AudioEventPayload)payload;
@end

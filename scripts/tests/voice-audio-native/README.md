# iOS voice engine regression

Run from the repository root with Xcode and one booted iOS Simulator:

```sh
python3 scripts/tests/voice-audio-native/run.py
```

Use `--device <UDID>` when multiple simulators are booted. `--native-root <package-directory>`
can compare an isolated previous `react-native-audio-api` package with the installed patch.
The runner compiles the actual package's `AudioEngine.mm` and `SystemNotificationManager.mm`.
It runs a standalone executable; it does not install an app, access the microphone, change
the foreground app, or require React Native's JavaScript runtime.

The fake hardware records the order of session activation, voice-processing configuration,
format reads, graph connections, and startup. The real notification manager receives actual
`NSNotificationCenter` notifications. Tests cover initial capture/playback in both orders,
engine replacement, failed voice-processing setup, notification feedback, stale/foreign
notifications, and genuine configuration/route/media-services recovery. Configuration and
stopped-engine route recovery must reconnect a changed input sample rate on the same engine
without replacing its voice-processing unit. New-device, removed-device, and configuration
route notifications must leave a healthy running graph and session untouched. A queued stale
notification must release the old engine before a media-services reset starts the replacement
engine.

These tests establish native control-flow behavior. They do **not** validate real AVAudioEngine
hardware formats, audio quality, Bluetooth, or the complete app's responsiveness.

## Accepted fix and validation

The patch configures voice processing before graph connections. Delayed, foreign, and stale
engine notifications do not rebuild a healthy graph. A stopped engine recovers in place with
fresh hardware formats; media-services reset still replaces the engine.

On 2026-10-03, the 25 native assertions and 198 voice Jest cases passed, along with lint and
typecheck. The rebuilt iPhone 13 app was verified by the user for conversation, end/reopen,
spoken interruption, and quiet listening without self-interruption. Physical Bluetooth routing,
long-duration calls, and Android barge-in remain unverified. Native patch changes require a new
installed build; OTA alone cannot update the audio engine.

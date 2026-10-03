#!/usr/bin/env python3
"""Compile the installed native engine/notification code and test it in iOS Simulator."""

import argparse
import json
from pathlib import Path
import platform
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device", default="booted", help="Booted iOS Simulator UDID or 'booted'")
    parser.add_argument("--native-root", type=Path, help="Alternate react-native-audio-api package root")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    tests = Path(__file__).resolve().parent
    native = (args.native_root or root / "node_modules/react-native-audio-api").resolve()
    if platform.system() != "Darwin":
        parser.error("This native regression requires macOS, Xcode, and a booted iOS Simulator.")
    devices = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "booted", "-j"]))
    booted = [d for group in devices["devices"].values() for d in group if d["state"] == "Booted"]
    if not booted:
        parser.error("Boot an iOS Simulator first; this runner does not create or boot one.")
    device = args.device
    if device == "booted":
        if len(booted) != 1:
            parser.error("Multiple simulators are booted; select one with --device <UDID>.")
        device = booted[0]["udid"]
    sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
    arch = "arm64" if platform.machine() == "arm64" else "x86_64"
    with tempfile.TemporaryDirectory(prefix="voice-audio-native-") as output:
        binary = str(Path(output) / "voice-audio-native")
        command = [
            "xcrun", "--sdk", "iphonesimulator", "clang++", "-std=c++20", "-fobjc-arc",
            "-Wno-incomplete-implementation", "-target", f"{arch}-apple-ios16.0-simulator",
            "-isysroot", sdk, f"-I{tests / 'stubs'}", f"-I{native / 'ios'}",
            f"-I{native / 'common/cpp'}", "-framework", "Foundation", "-framework", "AVFoundation",
            str(tests / "AudioEngineTests.mm"),
            str(native / "ios/audioapi/ios/system/AudioEngine.mm"),
            str(native / "ios/audioapi/ios/system/SystemNotificationManager.mm"), "-o", binary,
        ]
        subprocess.run(command, check=True)
        result = subprocess.run(["xcrun", "simctl", "spawn", device, binary], timeout=30)
        raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()

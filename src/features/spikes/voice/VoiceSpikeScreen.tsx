// Spike B（R1）：react-native-audio-api 的 16 kHz 擷取格式與 24 kHz 佇列播放。
// 結論寫在 docs/spikes/voice.md；Phase 4 以 features/voice 的 AudioCapturePort／AudioPlaybackPort 取代。
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AudioBufferQueueSourceNode,
  AudioContext,
  AudioManager,
  AudioRecorder,
} from 'react-native-audio-api';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '@/shared/theme';

import { createFrameChunker, float32ToPcm16, pcm16ToFloat32, rms } from './pcm';

const CAPTURE_RATE = 16000;
const FRAME_LENGTH = 1600;
const PLAYBACK_RATE = 24000;

/** 產生一段 PCM16 正弦波，模擬後端下行 chunk（長度不固定）。 */
function sinePcm16(frequency: number, samples: number, phaseStart: number): ArrayBuffer {
  const data = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    data[i] = 0.3 * Math.sin((2 * Math.PI * frequency * (phaseStart + i)) / PLAYBACK_RATE);
  }
  return float32ToPcm16(data);
}

export default function VoiceSpikeScreen() {
  const colors = useThemeColors();
  const recorderRef = useRef<AudioRecorder | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const queueRef = useRef<AudioBufferQueueSourceNode | null>(null);
  const statsRef = useRef({ buffers: 0, frames: 0, startedAt: 0 });
  const [recording, setRecording] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const append = (line: string) => setLog((prev) => [line, ...prev].slice(0, 30));

  const startCapture = async () => {
    try {
      const permission = await AudioManager.requestRecordingPermissions();
      append(`麥克風權限：${permission}`);
      if (permission !== 'Granted') return;
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'voiceChat',
        iosOptions: ['allowBluetoothHFP', 'defaultToSpeaker'],
      });
      await AudioManager.setAudioSessionActivity(true);

      const recorder = new AudioRecorder();
      const chunker = createFrameChunker(FRAME_LENGTH);
      statsRef.current = { buffers: 0, frames: 0, startedAt: Date.now() };
      recorder.onAudioReady(
        { sampleRate: CAPTURE_RATE, bufferLength: FRAME_LENGTH, channelCount: 1 },
        (event) => {
          const channel = event.buffer.getChannelData(0);
          const frames = chunker.push(channel);
          const stats = statsRef.current;
          stats.buffers += 1;
          stats.frames += frames.length;
          if (stats.buffers <= 3 || stats.buffers % 10 === 0) {
            const seconds = (Date.now() - stats.startedAt) / 1000;
            const bytes = frames[0] ? float32ToPcm16(frames[0]).byteLength : 0;
            append(
              `#${stats.buffers} sampleRate=${event.buffer.sampleRate} numFrames=${event.numFrames} ` +
                `channels=${event.buffer.numberOfChannels} ${channel.constructor.name} ` +
                `frame→${bytes}B rms=${rms(channel).toFixed(4)} ${(stats.frames / Math.max(seconds, 0.001)).toFixed(1)} frames/s`,
            );
          }
        },
      );
      const result = await recorder.start();
      append(`recorder.start：${JSON.stringify(result)}`);
      recorderRef.current = recorder;
      setRecording(true);
    } catch (error) {
      append(`擷取失敗：${String(error)}`);
    }
  };

  const stopCapture = async () => {
    try {
      const recorder = recorderRef.current;
      recorder?.clearOnAudioReady();
      await recorder?.stop();
      recorderRef.current = null;
      setRecording(false);
      const { buffers, frames, startedAt } = statsRef.current;
      append(`停止：${buffers} buffers、${frames} frames、${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
    } catch (error) {
      append(`停止失敗：${String(error)}`);
    }
  };

  const playQueue = async () => {
    try {
      const context = contextRef.current ?? new AudioContext({ sampleRate: PLAYBACK_RATE });
      contextRef.current = context;
      await context.resume();
      append(`AudioContext sampleRate=${context.sampleRate}`);
      const queue = context.createBufferQueueSource();
      queue.connect(context.destination);
      let ended = 0;
      const startedAt = Date.now();
      queue.onBufferEnded = () => {
        ended += 1;
        if (ended % 5 === 0) append(`onBufferEnded ×${ended}（${Date.now() - startedAt} ms）`);
      };
      // 20 個不等長 chunk（60–240 ms），總長約 3 秒，模擬後端下行
      let phase = 0;
      let totalSamples = 0;
      for (let i = 0; i < 20; i += 1) {
        const samples = Math.round(PLAYBACK_RATE * (0.06 + (i % 4) * 0.06));
        const floats = pcm16ToFloat32(sinePcm16(440, samples, phase));
        const buffer = context.createBuffer(1, floats.length, PLAYBACK_RATE);
        buffer.copyToChannel(floats, 0);
        queue.enqueueBuffer(buffer);
        phase += samples;
        totalSamples += samples;
      }
      // react-native-audio-api 0.13.6：start() 預設 offset=-1 又自己拒絕（AudioBufferQueueSourceNode.ts:40-49），需明確傳 0
      queue.start(0, 0);
      queueRef.current = queue;
      append(`佇列 20 chunks、${(totalSamples / PLAYBACK_RATE).toFixed(2)} s 開始播放`);
    } catch (error) {
      append(`播放失敗：${String(error)}`);
    }
  };

  const interrupt = () => {
    try {
      queueRef.current?.clearBuffers();
      queueRef.current?.stop();
      queueRef.current = null;
      append('interrupted：clearBuffers + stop');
    } catch (error) {
      append(`打斷失敗：${String(error)}`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.row}>
        <SpikeButton
          label={recording ? '停止擷取' : '開始擷取 16 kHz'}
          onPress={() => void (recording ? stopCapture() : startCapture())}
        />
        <SpikeButton label="播放 24 kHz 佇列" onPress={() => void playQueue()} />
        <SpikeButton label="打斷（清空佇列）" onPress={() => interrupt()} />
      </View>
      <ScrollView contentContainerStyle={styles.log}>
        {log.map((line, index) => (
          <Text key={`${index}-${line}`} style={{ color: colors.text, fontSize: 12 }}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function SpikeButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, { backgroundColor: colors.backgroundElement }]}>
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  button: { minHeight: 48, paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center' },
  log: { padding: 16, gap: 4 },
});

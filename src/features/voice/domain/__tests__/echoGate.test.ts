import { createEchoGate } from '../echoGate';

/** 100 ms、16 kHz 的 PCM16 frame，振幅固定（level ≈ amplitude/32768 × GAIN 4）。 */
function frame(amplitude: number): ArrayBuffer {
  const samples = new Int16Array(1600).fill(amplitude);
  return samples.buffer;
}

const QUIET = frame(1200); // level ≈ 0.15：喇叭回授到麥克風的回音
const LOUD = frame(4000); // level ≈ 0.49：使用者直接對麥克風說話

function setup() {
  let now = 0;
  const forwarded: ArrayBuffer[] = [];
  const gate = createEchoGate({ now: () => now, forward: (f) => forwarded.push(f) });
  return { gate, forwarded, advance: (ms: number) => (now += ms) };
}

describe('echoGate（播放助理語音時不把回音送回後端）', () => {
  it('沒有播放時全部放行', () => {
    const { gate, forwarded } = setup();
    gate.push(QUIET);
    gate.push(LOUD);
    expect(forwarded).toHaveLength(2);
  });

  it('播放中（含尾音）擋掉回音，播完後恢復', () => {
    const { gate, forwarded, advance } = setup();
    gate.notePlayback(1000);
    for (let i = 0; i < 10; i += 1) {
      gate.push(QUIET);
      advance(100);
    }
    expect(forwarded).toHaveLength(0);
    advance(300); // 仍在尾音內
    gate.push(QUIET);
    expect(forwarded).toHaveLength(0);
    advance(200); // 尾音結束
    gate.push(QUIET);
    expect(forwarded).toHaveLength(1);
  });

  it('連續播放的 chunk 串成一段時間軸，不會提早放行', () => {
    const { gate, forwarded, advance } = setup();
    gate.notePlayback(300);
    gate.notePlayback(300);
    advance(700);
    gate.push(QUIET);
    expect(forwarded).toHaveLength(0);
  });

  it('回歸（2026-10-01 實測數據）：播放中回音音量達 0.36–0.44，跟人聲一樣大，也不可以送出', () => {
    const { gate, forwarded, advance } = setup();
    gate.notePlayback(2500);
    // 模擬器 MacBook 喇叭→麥克風實測的 frame 音量序列（debug log 58905–59888）
    for (const amplitude of [60, 1400, 3600, 3000, 3200, 2100, 250, 80, 80]) {
      gate.push(frame(amplitude));
      advance(100);
    }
    expect(forwarded).toHaveLength(0);
  });

  it('被打斷（clear）後仍保留尾音：喇叭與殘響還在，過了尾音才放行', () => {
    const { gate, forwarded, advance } = setup();
    gate.notePlayback(5000);
    advance(1000);
    gate.clear();
    gate.push(LOUD);
    expect(forwarded).toHaveLength(0);
    advance(450);
    gate.push(QUIET);
    expect(forwarded).toHaveLength(1);
  });
});

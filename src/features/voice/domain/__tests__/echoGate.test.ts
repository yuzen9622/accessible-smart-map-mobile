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

  it('播放中使用者大聲插話：連續三個大聲 frame 後放行，並補送這三個開頭 frame', () => {
    const { gate, forwarded, advance } = setup();
    gate.notePlayback(5000);
    gate.push(LOUD);
    gate.push(LOUD);
    expect(forwarded).toHaveLength(0);
    gate.push(LOUD);
    expect(forwarded).toHaveLength(3);
    advance(100);
    gate.push(QUIET); // 插話中的小聲部分照送
    expect(forwarded).toHaveLength(4);
  });

  it('大聲 frame 中斷就重新計算，不會被零星雜音觸發', () => {
    const { gate, forwarded } = setup();
    gate.notePlayback(5000);
    gate.push(LOUD);
    gate.push(LOUD);
    gate.push(QUIET);
    gate.push(LOUD);
    expect(forwarded).toHaveLength(0);
  });

  it('被打斷（clear）後立刻放行', () => {
    const { gate, forwarded } = setup();
    gate.notePlayback(5000);
    gate.push(QUIET);
    gate.clear();
    gate.push(QUIET);
    expect(forwarded).toHaveLength(1);
  });
});

// 효과음과 음악을 Web Audio로 합성한다. 음원 파일이 없어 라이선스 문제가 없다.
import { save } from './store';

let ctx: AudioContext | null = null;
let sfxBus: GainNode;
let musicBus: GainNode;
let noiseBuf: AudioBuffer;
let musicTimer = 0;
let nextBar = 0;
let bar = 0;

export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -14;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    applyAudioSettings();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  if (!musicTimer) startMusic();
}

export function applyAudioSettings(): void {
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(save.sfx ? 0.9 : 0, ctx.currentTime, 0.02);
  musicBus.gain.setTargetAtTime(save.music ? 0.5 : 0, ctx.currentTime, 0.3);
}

export function vibrate(pattern: number | number[]): void {
  if (save.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  to?: number;
  dur: number;
  vol?: number;
  at?: number;
  attack?: number;
  bus?: GainNode;
}

// 같은 소리가 매번 똑같이 나면 기계적으로 들린다("소리가 너무 일정하다"는 피드백). 플레이 중의 효과음은 낼 때마다
// 높이(pitchVar), 크기(volVar), 박자를 조금씩 달리한다. varied()로 감싼 동안에만 적용되고 음악과 징글은 그대로다.
let pitchVar = 1;
let volVar = 1;
let varying = 0;
function varied(fn: () => void, pitch = 0.13): void {
  if (varying++ === 0) {
    pitchVar = 1 + (Math.random() * 2 - 1) * pitch;
    volVar = 0.72 + Math.random() * 0.33;
  }
  try {
    fn();
  } finally {
    if (--varying === 0) {
      pitchVar = 1;
      volVar = 1;
    }
  }
}
// 한 소리 안의 음 하나하나에도 아주 작은 흔들림을 준다
const wobble = () => (varying ? 1 + (Math.random() - 0.5) * 0.04 : 1);
const late = () => (varying ? Math.random() * 0.012 : 0);

function tone(o: ToneOpts): void {
  if (!ctx) return;
  const k = pitchVar * wobble();
  o = { ...o, freq: o.freq * k, to: o.to ? o.to * k : undefined, vol: (o.vol ?? 0.3) * volVar, at: (o.at ?? 0) + late() };
  const t = ctx.currentTime + (o.at ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(o.bus ?? sfxBus);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, to: number, q = 1, at = 0, type: BiquadFilterType = 'bandpass'): void {
  if (!ctx) return;
  const k = pitchVar * wobble();
  freq *= k;
  to *= k;
  vol *= volVar;
  at += late();
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

// 짧은 소음 알갱이를 불규칙하게 여러 번 낸다: 눈을 밟는 뽀드득, 자갈, 종이가 스치는 소리의 재료
function grains(count: number, span: number, vol: number, freq: number, q = 2, at = 0, type: BiquadFilterType = 'bandpass'): void {
  for (let i = 0; i < count; i++) {
    const f = freq * (0.75 + Math.random() * 0.5);
    noise(0.018 + Math.random() * 0.03, vol * (0.6 + Math.random() * 0.4), f, f * 0.7, q, at + (i / count) * span + Math.random() * 0.012, type);
  }
}

// 던전마다의 재질 소리. 번호는 던전 번호이고, 벽·바닥·판의 그림(tools/gen-sprites.mjs의 DIORAMA)과 맞춘 것이다.
// 벽에 부딪혔을 때
const WALL_SOUNDS: (() => void)[] = [
  // 1 유적, 이끼 낀 돌: 낮은 툭, 이어서 자갈이 구른다
  () => {
    tone({ type: 'sine', freq: 130, to: 70, dur: 0.14, vol: 0.45 });
    noise(0.06, 0.3, 900, 300, 1.2);
    grains(3, 0.1, 0.09, 2400, 2, 0.06);
  },
  // 2 광산, 나무로 버틴 바위: 나무가 삐걱이며 울리고 광석이 짤랑거린다
  () => {
    tone({ type: 'triangle', freq: 210, to: 140, dur: 0.1, vol: 0.34 });
    tone({ type: 'sawtooth', freq: 95, to: 120, dur: 0.14, vol: 0.07, at: 0.03 });
    noise(0.06, 0.2, 700, 300, 1.2);
    tone({ type: 'sine', freq: 2350, dur: 0.16, vol: 0.05, at: 0.07 });
    tone({ type: 'sine', freq: 3100, dur: 0.12, vol: 0.04, at: 0.11 });
  },
  // 3 얼음 동굴, 눈 쌓인 바위: 눈이 뽀드득 눌리고, 속의 돌은 둔하게 울린다
  () => {
    grains(7, 0.16, 0.2, 1500, 1.6);
    grains(4, 0.12, 0.1, 3600, 3, 0.03);
    tone({ type: 'sine', freq: 95, to: 60, dur: 0.14, vol: 0.22 });
    noise(0.16, 0.1, 500, 250, 0.7, 0, 'lowpass');
  },
  // 4 서고, 쌓인 책: 두꺼운 책 표지를 손마디로 두드리는 톡톡(사용자 지시). 속이 찬 종이라 울림이 짧고 먹먹하다
  () => {
    [0, 0.085].forEach((at, i) => {
      tone({ type: 'triangle', freq: 250 + i * 35, to: 170 + i * 20, dur: 0.045, vol: 0.34 - i * 0.1, at });
      tone({ type: 'sine', freq: 120, to: 85, dur: 0.06, vol: 0.2 - i * 0.07, at });
      noise(0.022, 0.16 - i * 0.05, 1300, 600, 1.2, at, 'lowpass');
    });
  },
  // 5 톱니 성채, 황동 블록: 쇠가 쩡 하고 울리고 안의 톱니가 달각거린다
  () => {
    tone({ type: 'square', freq: 330, dur: 0.04, vol: 0.12 });
    tone({ type: 'sine', freq: 520, dur: 0.4, vol: 0.14 });
    tone({ type: 'sine', freq: 783, dur: 0.3, vol: 0.08 });
    tone({ type: 'sine', freq: 1310, dur: 0.2, vol: 0.04 });
    for (let i = 0; i < 3; i++) tone({ type: 'square', freq: 1500, dur: 0.015, vol: 0.06, at: 0.08 + i * 0.045 });
  },
  // 6 용암 동굴, 흑요석: 단단하고 메마른 딱, 이어서 불티가 치익
  () => {
    tone({ type: 'triangle', freq: 420, to: 260, dur: 0.05, vol: 0.3 });
    tone({ type: 'sine', freq: 110, to: 65, dur: 0.12, vol: 0.3 });
    noise(0.03, 0.25, 3200, 1600, 2);
    noise(0.22, 0.07, 6500, 3000, 1, 0.05, 'highpass');
  },
  // 7 쌍둥이 신전, 대리석: 맑은 딱, 넓은 방처럼 한 번 더 울린다
  () => {
    tone({ type: 'triangle', freq: 900, to: 620, dur: 0.05, vol: 0.2 });
    tone({ type: 'sine', freq: 160, to: 100, dur: 0.1, vol: 0.3 });
    noise(0.03, 0.14, 4200, 2600, 3);
    tone({ type: 'triangle', freq: 900, to: 620, dur: 0.06, vol: 0.07, at: 0.13 });
    tone({ type: 'sine', freq: 1350, dur: 0.3, vol: 0.03, at: 0.02 });
  },
  // 8 미궁의 심장, 자수정: 유리 종 같은 음 셋이 겹쳐 울린다
  () => {
    [1568, 2093, 2637].forEach((f, i) => tone({ type: 'sine', freq: f * (1 + (Math.random() - 0.5) * 0.01), dur: 0.55 - i * 0.1, vol: 0.1 - i * 0.02, at: i * 0.025 }));
    tone({ type: 'sine', freq: 140, to: 90, dur: 0.1, vol: 0.2 });
    noise(0.03, 0.08, 6000, 4000, 4);
  },
];

// 한 칸 걸을 때의 발소리(바닥 재질)
const STEP_SOUNDS: (() => void)[] = [
  // 1 모래 깔린 돌: 사박
  () => {
    noise(0.07, 0.07, 2600, 1200, 0.7);
    tone({ type: 'triangle', freq: 440 + Math.random() * 40, to: 330, dur: 0.05, vol: 0.06 });
  },
  // 2 다져진 흙: 툭, 잔돌이 구른다
  () => {
    tone({ type: 'sine', freq: 170 + Math.random() * 20, to: 110, dur: 0.07, vol: 0.2 });
    grains(2, 0.05, 0.05, 2200, 2);
  },
  // 3 눈 덮인 돌: 뽀드득
  () => {
    grains(4, 0.07, 0.11, 1700, 1.6);
    noise(0.07, 0.05, 600, 300, 0.7, 0, 'lowpass');
  },
  // 4 서고의 카펫: 딱딱한 소리 없이 푹 꺼지는 둔한 소리와 천이 쓸리는 소리(사용자 지시)
  () => {
    tone({ type: 'sine', freq: 115 + Math.random() * 15, to: 75, dur: 0.09, vol: 0.2, attack: 0.012 });
    noise(0.1, 0.16, 700, 260, 0.6, 0, 'lowpass');
    noise(0.07, 0.035, 1500, 800, 0.7, 0.03);
  },
  // 5 쇠판: 팅
  () => {
    tone({ type: 'sine', freq: 1150 + Math.random() * 80, dur: 0.12, vol: 0.07 });
    tone({ type: 'square', freq: 400, dur: 0.02, vol: 0.06 });
    noise(0.025, 0.06, 3500, 2000, 3);
  },
  // 6 화산암: 메마른 탁
  () => {
    tone({ type: 'triangle', freq: 360 + Math.random() * 40, to: 240, dur: 0.04, vol: 0.14 });
    noise(0.04, 0.07, 2800, 1500, 1.5);
  },
  // 7 대리석: 또각
  () => {
    tone({ type: 'triangle', freq: 1250 + Math.random() * 100, to: 880, dur: 0.035, vol: 0.12 });
    noise(0.02, 0.05, 5000, 3000, 3);
    tone({ type: 'triangle', freq: 1150, to: 850, dur: 0.03, vol: 0.03, at: 0.09 });
  },
  // 8 수정이 박힌 돌: 맑은 톡
  () => {
    tone({ type: 'sine', freq: 1760 + Math.random() * 120, dur: 0.14, vol: 0.07 });
    tone({ type: 'triangle', freq: 500, to: 380, dur: 0.05, vol: 0.06 });
  },
];

// 블록이 바닥에 끌릴 때 덧붙는 소리(바닥 재질)
const SCRAPE_SOUNDS: (() => void)[] = [
  () => noise(0.14, 0.08, 2400, 1400, 0.8), // 1 모래
  () => grains(4, 0.13, 0.07, 1900, 2), // 2 흙과 잔돌
  () => grains(6, 0.14, 0.12, 1600, 1.6), // 3 눈
  () => noise(0.16, 0.14, 800, 350, 0.6, 0, 'lowpass'), // 4 카펫 위를 쓸린다
  () => noise(0.14, 0.07, 4200, 3000, 6), // 5 쇠판을 긁는다
  () => noise(0.14, 0.09, 1500, 800, 1.2), // 6 화산암
  () => noise(0.13, 0.05, 5200, 3600, 2), // 7 대리석
  () => tone({ type: 'sine', freq: 1900, to: 2300, dur: 0.14, vol: 0.03 }), // 8 수정
];

// 판의 가장자리(둘레 턱)에 부딪혔을 때
const EDGE_SOUNDS: (() => void)[] = [
  () => noise(0.06, 0.12, 700, 300, 1), // 1 사암
  () => tone({ type: 'triangle', freq: 260, to: 180, dur: 0.07, vol: 0.2 }), // 2 나무 판자
  () => grains(5, 0.1, 0.14, 1400, 1.5), // 3 눈 더미
  () => tone({ type: 'triangle', freq: 220, to: 150, dur: 0.08, vol: 0.2 }), // 4 호두나무 틀
  () => tone({ type: 'sine', freq: 440, dur: 0.25, vol: 0.1 }), // 5 황동 테
  () => noise(0.05, 0.14, 1800, 900, 1.5), // 6 현무암
  () => tone({ type: 'triangle', freq: 800, to: 560, dur: 0.05, vol: 0.12 }), // 7 대리석
  () => tone({ type: 'sine', freq: 1568, dur: 0.3, vol: 0.06 }), // 8 수정
];

const themed = (table: (() => void)[], world: number) => (table[world - 1] ?? table[0])();
let foot = false;

export const sfx = {
  // 한 칸 걸을 때: 던전의 바닥 재질에 맞는 발소리
  step(world: number) {
    foot = !foot;
    pitchVar *= foot ? 1.06 : 0.94;
    volVar *= foot ? 1 : 0.86;
    themed(STEP_SOUNDS, world);
    // 가끔 발끝이 끌리는 잔소리가 섞인다
    if (Math.random() < 0.3) noise(0.03, 0.03, 2600, 1300, 1, 0.045 + Math.random() * 0.03);
  },
  move() {
    tone({ type: 'triangle', freq: 520 + Math.random() * 40, to: 380, dur: 0.07, vol: 0.12 });
    noise(0.05, 0.05, 1800, 900, 0.8);
  },
  push() {
    tone({ type: 'sine', freq: 150, to: 70, dur: 0.16, vol: 0.5 });
    noise(0.13, 0.22, 700, 220, 0.9);
  },
  bump() {
    tone({ type: 'square', freq: 96, to: 62, dur: 0.12, vol: 0.2 });
    noise(0.08, 0.16, 260, 120, 1.2);
  },
  // 부딪힌 것에 따라 다른 소리(boardView의 BumpKind)
  bumpOf(kind: string, world = 1) {
    switch (kind) {
      case 'wall': // 벽: 던전마다 재질이 다르다
        themed(WALL_SOUNDS, world);
        break;
      case 'fixed': // 고정 블록: 더 낮고 묵직하게
        tone({ type: 'sine', freq: 85, to: 45, dur: 0.22, vol: 0.55 });
        noise(0.1, 0.3, 400, 120, 1);
        break;
      case 'edge': // 판의 가장자리: 무딘 툭에 둘레 턱의 재질 소리가 얹힌다
        tone({ type: 'sine', freq: 110, to: 80, dur: 0.1, vol: 0.22 });
        themed(EDGE_SOUNDS, world);
        break;
      case 'normal': // 나무 상자: 속이 빈 똑똑
        tone({ type: 'triangle', freq: 320, to: 210, dur: 0.07, vol: 0.3 });
        tone({ type: 'triangle', freq: 250, to: 170, dur: 0.09, vol: 0.22, at: 0.07 });
        noise(0.04, 0.14, 1500, 700, 1.5);
        break;
      case 'rail': // 쇠 블록: 땡 하고 울린다
        tone({ type: 'square', freq: 620, dur: 0.05, vol: 0.12 });
        tone({ type: 'sine', freq: 1240, dur: 0.5, vol: 0.14 });
        tone({ type: 'sine', freq: 1853, dur: 0.35, vol: 0.07 });
        noise(0.04, 0.18, 3000, 1500, 2);
        break;
      case 'ice': // 얼음: 유리처럼 맑은 팅
        tone({ type: 'sine', freq: 2100, to: 1700, dur: 0.18, vol: 0.14 });
        tone({ type: 'triangle', freq: 3150, dur: 0.12, vol: 0.06, at: 0.01 });
        noise(0.05, 0.1, 5000, 3000, 3);
        break;
      case 'link': // 쌍둥이 블록: 두 음이 함께 울린다
        tone({ type: 'sine', freq: 784, dur: 0.5, vol: 0.13 });
        tone({ type: 'sine', freq: 1174.7, dur: 0.5, vol: 0.13, at: 0.03 });
        tone({ type: 'triangle', freq: 1568, dur: 0.3, vol: 0.05, at: 0.05 });
        break;
      case 'locked': // 굳은 횟수 블록: 흙덩이처럼 둔하게
        tone({ type: 'sine', freq: 110, to: 60, dur: 0.18, vol: 0.45 });
        tone({ type: 'square', freq: 200, dur: 0.06, vol: 0.08, at: 0.02 });
        noise(0.08, 0.2, 600, 200, 1);
        break;
      case 'door': // 닫힌 문: 쇠창살이 덜컹거린다
        for (let i = 0; i < 4; i++) noise(0.05, 0.2 - i * 0.03, 1800 + Math.random() * 800, 700, 3, i * 0.05);
        tone({ type: 'square', freq: 140, to: 90, dur: 0.2, vol: 0.14 });
        tone({ type: 'sine', freq: 880, dur: 0.25, vol: 0.05, at: 0.02 });
        break;
      case 'oneway': // 일방통행: 바람이 밀어낸다
        noise(0.18, 0.14, 2500, 600, 1.5);
        tone({ type: 'triangle', freq: 520, to: 300, dur: 0.14, vol: 0.12 });
        break;
      case 'pit': // 구덩이: 돌멩이가 굴러떨어진다
        [0, 0.09, 0.2].forEach((at, i) => tone({ type: 'triangle', freq: 700 - i * 170, to: 420 - i * 110, dur: 0.06, vol: 0.14 - i * 0.035, at }));
        noise(0.05, 0.08, 1800, 900, 2);
        break;
      default:
        this.bump();
    }
  },
  // 블록을 밀 때: 블록의 재질에 따라 소리를 덧붙인다
  pushOf(kind: string, world = 1) {
    this.push();
    themed(SCRAPE_SOUNDS, world);
    if (kind === 'railH' || kind === 'railV') {
      noise(0.14, 0.09, 3600, 2200, 4);
      tone({ type: 'sine', freq: 930, dur: 0.14, vol: 0.05 });
    } else if (kind === 'count') tone({ type: 'square', freq: 1200, dur: 0.03, vol: 0.08, at: 0.1 });
    else if (kind === 'link') {
      tone({ type: 'sine', freq: 784, dur: 0.3, vol: 0.07, at: 0.04 });
      tone({ type: 'sine', freq: 1174.7, dur: 0.3, vol: 0.07, at: 0.07 });
    }
  },
  // 스위치가 눌릴 때와 풀릴 때
  switchOn() {
    tone({ type: 'square', freq: 300, to: 200, dur: 0.05, vol: 0.16 });
    tone({ type: 'sine', freq: 660, dur: 0.16, vol: 0.14, at: 0.04 });
    tone({ type: 'sine', freq: 990, dur: 0.28, vol: 0.12, at: 0.12 });
  },
  switchOff() {
    tone({ type: 'square', freq: 250, to: 150, dur: 0.05, vol: 0.16 });
    tone({ type: 'sine', freq: 660, to: 440, dur: 0.22, vol: 0.12, at: 0.04 });
  },
  // 여우가 스위치를 밟았을 때: 가벼워서 눌리지 않고 딸깍하기만 한다
  tick() {
    tone({ type: 'triangle', freq: 900, dur: 0.04, vol: 0.1 });
  },
  // 장면 전환(별 조리개): 닫히며 낮아지고 열리며 높아지는 부드러운 바람 소리
  iris() {
    noise(0.34, 0.06, 2600, 500, 1.2);
    tone({ type: 'sine', freq: 520, to: 260, dur: 0.32, vol: 0.05 });
    noise(0.4, 0.05, 600, 3200, 1.2, 0.4);
    tone({ type: 'sine', freq: 330, to: 700, dur: 0.36, vol: 0.05, at: 0.42 });
  },
  // 클리어: 빛기둥을 타고 떠오르는 소리, 이어서 별이 터지는 소리
  enter() {
    tone({ type: 'sine', freq: 660, dur: 0.2, vol: 0.14 });
    tone({ type: 'sine', freq: 380, to: 1700, dur: 0.6, vol: 0.12, at: 0.42, attack: 0.1 });
    noise(0.6, 0.06, 1800, 9000, 2, 0.42);
  },
  starBurst() {
    [1318.5, 1760, 2637].forEach((f, i) => tone({ type: 'sine', freq: f, dur: 0.6, vol: 0.12, at: i * 0.02 }));
    noise(0.35, 0.2, 7000, 1800, 0.8);
    tone({ type: 'sine', freq: 180, to: 70, dur: 0.25, vol: 0.35 });
  },
  slide(cells: number) {
    const dur = 0.12 + cells * 0.06;
    noise(dur, 0.2, 2600, 5200, 3, 0, 'bandpass');
    tone({ type: 'sine', freq: 900, to: 1500, dur, vol: 0.06 });
    tone({ type: 'sine', freq: 180, to: 80, dur: 0.14, vol: 0.4, at: dur });
  },
  lock() {
    tone({ type: 'square', freq: 220, to: 110, dur: 0.22, vol: 0.18 });
    noise(0.2, 0.2, 500, 150, 1);
  },
  sink() {
    tone({ type: 'sine', freq: 220, to: 55, dur: 0.3, vol: 0.5 });
    noise(0.28, 0.25, 500, 90, 0.8);
  },
  warp() {
    tone({ type: 'sine', freq: 300, to: 1400, dur: 0.22, vol: 0.18 });
    tone({ type: 'triangle', freq: 1400, to: 500, dur: 0.3, vol: 0.14, at: 0.16 });
    noise(0.35, 0.08, 3000, 8000, 2);
  },
  // 별 하나를 놓쳤을 때: 짧게 떨어지는 음
  starLost() {
    tone({ type: 'triangle', freq: 740, to: 370, dur: 0.22, vol: 0.2 });
  },
  // 던전 하나를 모두 깼을 때
  fanfare() {
    [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((f, i) => {
      tone({ type: 'triangle', freq: f, dur: 0.6, vol: 0.2, at: i * 0.1 });
      tone({ type: 'sine', freq: f / 2, dur: 0.5, vol: 0.12, at: i * 0.1 });
    });
    [1046.5, 1318.5, 1568, 2093].forEach((f) => tone({ type: 'sine', freq: f, dur: 1.4, vol: 0.1, at: 0.7 }));
  },
  // 문이 열리거나 닫힐 때: 쇠가 끌리는 소리
  door() {
    noise(0.28, 0.2, 400, 1400, 4);
    tone({ type: 'square', freq: 90, to: 140, dur: 0.25, vol: 0.14 });
  },
  // 바닥이 무너질 때
  crack() {
    noise(0.22, 0.26, 1800, 200, 0.8);
    tone({ type: 'sine', freq: 160, to: 50, dur: 0.3, vol: 0.4, at: 0.05 });
  },
  button() {
    tone({ type: 'triangle', freq: 680, to: 880, dur: 0.07, vol: 0.16 });
  },
  undo() {
    tone({ type: 'triangle', freq: 500, to: 330, dur: 0.09, vol: 0.14 });
  },
  deny() {
    tone({ type: 'square', freq: 180, dur: 0.08, vol: 0.12 });
    tone({ type: 'square', freq: 140, dur: 0.12, vol: 0.12, at: 0.09 });
  },
  clear() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone({ type: 'triangle', freq: f, dur: 0.5, vol: 0.22, at: i * 0.09 });
      tone({ type: 'sine', freq: f * 2, dur: 0.4, vol: 0.07, at: i * 0.09 });
    });
  },
  star(n: number) {
    const f = [880, 1108.7, 1318.5][n] ?? 880;
    tone({ type: 'sine', freq: f, dur: 0.45, vol: 0.26 });
    tone({ type: 'triangle', freq: f * 1.5, dur: 0.3, vol: 0.08, at: 0.02 });
  },
  coin() {
    tone({ type: 'square', freq: 988, dur: 0.07, vol: 0.1 });
    tone({ type: 'square', freq: 1319, dur: 0.22, vol: 0.1, at: 0.07 });
  },
  hint() {
    tone({ type: 'sine', freq: 660, dur: 0.18, vol: 0.18 });
    tone({ type: 'sine', freq: 990, dur: 0.3, vol: 0.16, at: 0.12 });
  },
  chestShake() {
    for (let i = 0; i < 7; i++) noise(0.07, 0.16, 500 + Math.random() * 500, 240, 2, i * 0.14);
    tone({ type: 'sine', freq: 90, to: 180, dur: 1, vol: 0.2 });
  },
  reveal(tier: number) {
    const chords = [
      [392, 493.9, 587.3],
      [440, 554.4, 659.3, 880],
      [466.2, 587.3, 698.5, 932.3, 1174.7],
      [523.3, 659.3, 784, 1046.5, 1318.5, 1568],
    ][tier];
    noise(0.5 + tier * 0.15, 0.14 + tier * 0.03, 1200, 7000, 0.7);
    chords.forEach((f, i) => {
      tone({ type: 'triangle', freq: f, dur: 0.7 + tier * 0.25, vol: 0.16, at: i * 0.06 });
      tone({ type: 'sine', freq: f * 2, dur: 0.5 + tier * 0.2, vol: 0.05, at: i * 0.06 });
    });
  },
  dud() {
    tone({ type: 'triangle', freq: 330, to: 220, dur: 0.3, vol: 0.16 });
  },
};

// 플레이 중에 되풀이되는 효과음은 낼 때마다 조금씩 다르게 낸다
for (const key of ['step', 'move', 'push', 'pushOf', 'bump', 'bumpOf', 'slide', 'lock', 'sink', 'door', 'crack', 'switchOn', 'switchOff', 'tick', 'undo'] as const) {
  const plain = sfx[key] as (...args: never[]) => void;
  (sfx as Record<string, unknown>)[key] = (...args: never[]) => varied(() => plain.apply(sfx, args));
}

// 잔잔한 반복 곡. 느린 화음 위에 5음 음계 가락을 무작위로 얹는다.
const CHORDS = [
  [110, 164.8, 220, 261.6],
  [87.3, 130.8, 174.6, 220],
  [130.8, 196, 261.6, 329.6],
  [98, 146.8, 196, 246.9],
];
const SCALE = [440, 523.3, 587.3, 659.3, 784, 880, 1046.5];
const BAR = 4.8;

function scheduleBar(at: number): void {
  if (!ctx) return;
  const chord = CHORDS[bar % CHORDS.length];
  for (const f of chord) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.detune.value = (Math.random() - 0.5) * 10;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.07, at + 1.6);
    g.gain.linearRampToValueAtTime(0.0001, at + BAR + 1.2);
    osc.connect(g).connect(musicBus);
    osc.start(at);
    osc.stop(at + BAR + 1.3);
  }
  let prev = 2 + ((Math.random() * 3) | 0);
  for (let beat = 0; beat < 8; beat++) {
    if (Math.random() < 0.42) continue;
    prev = Math.max(0, Math.min(SCALE.length - 1, prev + ((Math.random() * 5) | 0) - 2));
    tone({
      type: 'triangle',
      freq: SCALE[prev],
      dur: 1.4,
      vol: 0.05,
      at: at - ctx.currentTime + beat * (BAR / 8),
      attack: 0.02,
      bus: musicBus,
    });
  }
  bar++;
}

function startMusic(): void {
  if (!ctx) return;
  nextBar = ctx.currentTime + 0.2;
  const tick = () => {
    if (!ctx) return;
    while (nextBar < ctx.currentTime + 1.5) {
      scheduleBar(nextBar);
      nextBar += BAR;
    }
  };
  tick();
  musicTimer = window.setInterval(tick, 500);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}

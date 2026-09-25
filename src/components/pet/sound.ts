import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SoundSettings {
  enabled: boolean;
  volume: number;
  setEnabled: (v: boolean) => void;
}

export const useSoundSettings = create<SoundSettings>()(
  persist((set) => ({ enabled: true, volume: 0.6, setEnabled: (enabled) => set({ enabled }) }), { name: 'petagent-sound' }),
);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!useSoundSettings.getState().enabled) return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  master!.gain.value = useSoundSettings.getState().volume * 0.5;
  return ctx;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

const lastPlayed: Record<string, number> = {};
function throttle(key: string, ms: number) {
  const now = performance.now();
  if (now - (lastPlayed[key] ?? 0) < ms) return false;
  lastPlayed[key] = now;
  return true;
}

function tone(
  c: AudioContext,
  { freq, to, start = 0, dur, type = 'sine', vol = 0.3, attack = 0.01 }: { freq: number; to?: number; start?: number; dur: number; type?: OscillatorType; vol?: number; attack?: number },
) {
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(c: AudioContext, { start = 0, dur, vol = 0.2, freq = 1200, q = 1, type = 'bandpass' as BiquadFilterType }: { start?: number; dur: number; vol?: number; freq?: number; q?: number; type?: BiquadFilterType }) {
  const t = c.currentTime + start;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function purr(c: AudioContext, dur = 1.2) {
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 280;
  const amp = c.createGain();
  amp.gain.value = 0;
  const lfo = c.createOscillator();
  lfo.frequency.value = 24;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain).connect(amp.gain);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.9, t + 0.15);
  env.gain.setValueAtTime(0.9, t + dur - 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(lp).connect(amp).connect(env).connect(master!);
  lfo.start(t);
  src.start(t);
  lfo.stop(t + dur);
  src.stop(t + dur);
}

export const sfx = {
  click() {
    const c = ac();
    if (!c || !throttle('click', 40)) return;
    tone(c, { freq: 900, to: 600, dur: 0.06, type: 'triangle', vol: 0.15 });
  },
  pop() {
    const c = ac();
    if (!c || !throttle('pop', 60)) return;
    tone(c, { freq: 500, to: 1100, dur: 0.1, type: 'sine', vol: 0.25 });
  },
  purr() {
    const c = ac();
    if (!c || !throttle('purr', 1100)) return;
    purr(c, 1.2);
  },
  heart() {
    const c = ac();
    if (!c || !throttle('heart', 250)) return;
    const f = 1100 + Math.random() * 500;
    tone(c, { freq: f, to: f * 1.5, dur: 0.12, type: 'sine', vol: 0.08 });
  },
  greet() {
    const c = ac();
    if (!c || !throttle('greet', 500)) return;
    tone(c, { freq: 620, to: 880, dur: 0.12, type: 'triangle', vol: 0.22 });
    tone(c, { freq: 880, to: 1250, start: 0.12, dur: 0.16, type: 'triangle', vol: 0.22 });
  },
  beg() {
    const c = ac();
    if (!c || !throttle('beg', 1500)) return;
    tone(c, { freq: 900, to: 700, dur: 0.22, type: 'sine', vol: 0.2 });
    tone(c, { freq: 760, to: 1150, start: 0.26, dur: 0.3, type: 'sine', vol: 0.2 });
  },
  sad() {
    const c = ac();
    if (!c || !throttle('sad', 800)) return;
    tone(c, { freq: 600, to: 380, dur: 0.45, type: 'triangle', vol: 0.18 });
  },
  eat() {
    const c = ac();
    if (!c || !throttle('eat', 300)) return;
    for (let i = 0; i < 4; i++) noise(c, { start: i * 0.14, dur: 0.07, vol: 0.25, freq: 1800 + Math.random() * 1200, q: 2 });
  },
  play() {
    const c = ac();
    if (!c || !throttle('play', 300)) return;
    tone(c, { freq: 220, to: 660, dur: 0.18, type: 'sine', vol: 0.25 });
    tone(c, { freq: 330, to: 990, start: 0.2, dur: 0.18, type: 'sine', vol: 0.2 });
  },
  jump() {
    const c = ac();
    if (!c || !throttle('jump', 200)) return;
    tone(c, { freq: 300, to: 900, dur: 0.16, type: 'square', vol: 0.08 });
  },
  study() {
    const c = ac();
    if (!c || !throttle('study', 400)) return;
    noise(c, { dur: 0.25, vol: 0.12, freq: 3000, q: 0.7, type: 'highpass' });
    tone(c, { freq: 1320, start: 0.25, dur: 0.35, type: 'sine', vol: 0.12 });
    tone(c, { freq: 1760, start: 0.32, dur: 0.4, type: 'sine', vol: 0.1 });
  },
  snore() {
    const c = ac();
    if (!c || !throttle('snore', 2500)) return;
    noise(c, { dur: 0.9, vol: 0.18, freq: 350, q: 3 });
    tone(c, { freq: 110, to: 90, dur: 0.9, type: 'sawtooth', vol: 0.04, attack: 0.3 });
    tone(c, { freq: 1500, to: 2200, start: 1.1, dur: 0.35, type: 'sine', vol: 0.05, attack: 0.1 });
  },
  heal() {
    const c = ac();
    if (!c || !throttle('heal', 400)) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { freq: f, start: i * 0.07, dur: 0.35, type: 'sine', vol: 0.14 }));
  },
  good() {
    const c = ac();
    if (!c || !throttle('good', 60)) return;
    tone(c, { freq: 880, dur: 0.08, type: 'triangle', vol: 0.18 });
    tone(c, { freq: 1320, start: 0.07, dur: 0.12, type: 'triangle', vol: 0.18 });
  },
  bad() {
    const c = ac();
    if (!c || !throttle('bad', 60)) return;
    tone(c, { freq: 200, to: 110, dur: 0.22, type: 'sawtooth', vol: 0.1 });
  },
  win() {
    const c = ac();
    if (!c || !throttle('win', 500)) return;
    [523, 659, 784].forEach((f, i) => tone(c, { freq: f, start: i * 0.1, dur: 0.25, type: 'triangle', vol: 0.2 }));
    tone(c, { freq: 1047, start: 0.3, dur: 0.5, type: 'triangle', vol: 0.22 });
  },
  lose() {
    const c = ac();
    if (!c || !throttle('lose', 500)) return;
    [392, 370, 349, 294].forEach((f, i) => tone(c, { freq: f, start: i * 0.16, dur: 0.3, type: 'triangle', vol: 0.16 }));
  },
  levelUp() {
    const c = ac();
    if (!c || !throttle('levelUp', 1500)) return;
    const notes = [
      [523, 0, 0.14],
      [659, 0.14, 0.14],
      [784, 0.28, 0.14],
      [1047, 0.42, 0.5],
      [784, 0.62, 0.12],
      [1047, 0.74, 0.7],
    ];
    notes.forEach(([f, s, d]) => {
      tone(c, { freq: f, start: s, dur: d, type: 'square', vol: 0.07 });
      tone(c, { freq: f / 2, start: s, dur: d, type: 'triangle', vol: 0.14 });
    });
    for (let i = 0; i < 14; i++) {
      tone(c, { freq: 1800 + Math.random() * 1600, start: 0.45 + i * 0.06, dur: 0.12, type: 'sine', vol: 0.05 });
    }
    noise(c, { dur: 0.35, vol: 0.2, freq: 4000, q: 0.5, type: 'highpass' });
  },
  notify() {
    const c = ac();
    if (!c || !throttle('notify', 2000)) return;
    tone(c, { freq: 988, dur: 0.15, type: 'sine', vol: 0.2 });
    tone(c, { freq: 1319, start: 0.15, dur: 0.3, type: 'sine', vol: 0.2 });
  },
};

export function signatureSfx(type: string) {
  const c = ac();
  if (!c || !throttle('sig', 800)) return;
  switch (type) {
    case 'dog':
      tone(c, { freq: 500, to: 800, dur: 0.1, type: 'square', vol: 0.08 });
      tone(c, { freq: 700, to: 1000, start: 0.12, dur: 0.1, type: 'square', vol: 0.08 });
      [0.3, 0.55, 0.75].forEach((st) => tone(c, { freq: 180, to: 90, start: st, dur: 0.08, type: 'sine', vol: 0.25 }));
      tone(c, { freq: 700, to: 1200, start: 1.9, dur: 0.18, type: 'triangle', vol: 0.18 });
      break;
    case 'fox':
      [0, 0.24].forEach((st) => noise(c, { start: st, dur: 0.14, vol: 0.28, freq: 1400, q: 1.5 }));
      tone(c, { freq: 400, to: 1400, start: 0.8, dur: 0.9, type: 'triangle', vol: 0.08 });
      break;
    case 'dragon':
      [0, 0.28, 0.56].forEach((st) => noise(c, { start: st, dur: 0.16, vol: 0.18, freq: 500, q: 0.8, type: 'lowpass' }));
      tone(c, { freq: 140, to: 70, start: 1.2, dur: 0.7, type: 'sawtooth', vol: 0.08 });
      noise(c, { start: 1.25, dur: 0.8, vol: 0.35, freq: 900, q: 0.5 });
      break;
    case 'bunny':
      tone(c, { freq: 300, to: 1400, dur: 0.35, type: 'sine', vol: 0.2 });
      tone(c, { freq: 1400, to: 500, start: 0.45, dur: 0.3, type: 'sine', vol: 0.15 });
      tone(c, { freq: 600, to: 900, start: 1.4, dur: 0.1, type: 'triangle', vol: 0.12 });
      break;
    case 'panda':
      for (let i = 0; i < 6; i++) noise(c, { start: i * 0.35, dur: 0.08, vol: 0.28, freq: 2400, q: 3 });
      break;
    case 'owl':
      tone(c, { freq: 420, to: 380, dur: 0.28, type: 'sine', vol: 0.3, attack: 0.05 });
      tone(c, { freq: 420, to: 360, start: 0.4, dur: 0.45, type: 'sine', vol: 0.3, attack: 0.05 });
      break;
    case 'bird': {
      const notes = [1568, 1760, 2093, 1760, 2349, 2093, 2637, 2349];
      notes.forEach((f, i) => tone(c, { freq: f, to: f * 1.08, start: i * 0.13, dur: 0.11, type: 'sine', vol: 0.12 }));
      break;
    }
    default:
      [880, 1100, 1320].forEach((f, i) => tone(c, { freq: f, start: i * 0.12, dur: 0.06, type: 'square', vol: 0.05 }));
  }
}

export const ACTION_SFX: Record<string, () => void> = {
  eat: sfx.eat,
  play: sfx.play,
  study: sfx.study,
  sleep: sfx.snore,
  wave: sfx.greet,
  jump: sfx.jump,
  pet: sfx.purr,
  heal: sfx.heal,
};

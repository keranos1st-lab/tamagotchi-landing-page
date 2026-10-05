import func2url from '../../backend/func2url.json';
import { clientId } from './petAi';

const URL = (func2url as Record<string, string>)['pet-chat'];
const TARGET_RATE = 16000;
export const MAX_SECONDS = 30;
export const MAX_BYTES = 1024 * 1024;
const NO_SPEECH_MS = 8000;

export type VoiceFail = { ok: false; code: string; message: string; retryable: boolean };

const NETWORK: VoiceFail = { ok: false, code: 'network', message: 'Нет связи с сервером', retryable: true };

export interface Recording {
  stop: () => Int16Array | null;
  cancel: () => void;
}

export interface RecordingHooks {
  onLevel?: (level: number) => void;
  onAutoStop?: () => void;
}

function downsample(input: Float32Array, from: number): Float32Array {
  if (from === TARGET_RATE) return input;
  const ratio = from / TARGET_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export async function startRecording(hooks: RecordingHooks = {}): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  await ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;

  const chunks: Float32Array[] = [];
  const startedAt = performance.now();
  let heardSpeech = false;
  let noise = 0.004;
  let closed = false;
  let autoFired = false;

  const fireAuto = () => {
    if (autoFired || closed) return;
    autoFired = true;
    hooks.onAutoStop?.();
  };

  proc.onaudioprocess = (e) => {
    if (closed) return;
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const now = performance.now();
    if (!heardSpeech) noise = noise * 0.9 + rms * 0.1;
    const threshold = Math.max(0.012, noise * 3);
    if (rms > threshold) {
      heardSpeech = true;
    }
    hooks.onLevel?.(Math.min(1, rms * 12));
    const elapsed = now - startedAt;
    if (!heardSpeech && elapsed > NO_SPEECH_MS) fireAuto();
    else if (elapsed >= MAX_SECONDS * 1000) fireAuto();
  };

  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);

  const close = () => {
    if (closed) return;
    closed = true;
    proc.onaudioprocess = null;
    try {
      source.disconnect();
      proc.disconnect();
      mute.disconnect();
    } catch {
      /* уже отключено */
    }
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
    hooks.onLevel?.(0);
  };

  return {
    stop: () => {
      const rate = ctx.sampleRate;
      close();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      if (!total || !heardSpeech) return null;
      const all = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        all.set(c, off);
        off += c.length;
      }
      const mono = downsample(all, rate);
      const pcm = new Int16Array(mono.length);
      for (let i = 0; i < mono.length; i++) {
        const v = Math.max(-1, Math.min(1, mono[i]));
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      return pcm;
    },
    cancel: close,
  };
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

export async function transcribe(pcm: Int16Array): Promise<{ ok: true; text: string } | VoiceFail> {
  if (pcm.byteLength > MAX_BYTES) return { ok: false, code: 'stt_too_big', message: 'Запись слишком большая — говорите не дольше 30 секунд', retryable: false };
  if (!URL) return { ok: false, code: 'no_function', message: 'Серверная функция pet-chat не опубликована', retryable: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${URL}?stt=1`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId() },
      body: JSON.stringify({ audio: toBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)), rate: TARGET_RATE }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.text) return { ok: true, text: String(data.text) };
    if (data?.error) return { ok: false, code: data.error, message: data.message || 'Не удалось распознать речь', retryable: !!data.retryable };
    return { ok: false, code: `http_${res.status}`, message: `Ошибка сервера (${res.status})`, retryable: true };
  } catch (e) {
    if ((e as Error).name === 'AbortError') return { ok: false, code: 'timeout', message: 'Распознавание не успело ответить', retryable: true };
    return NETWORK;
  } finally {
    clearTimeout(timer);
  }
}

let current: HTMLAudioElement | null = null;
let utterance: SpeechSynthesisUtterance | null = null;
let stopCurrent: (() => void) | null = null;

export function stopSpeaking() {
  stopCurrent?.();
  stopCurrent = null;
  if (current) {
    current.pause();
    current = null;
  }
  if (utterance) {
    window.speechSynthesis?.cancel();
    utterance = null;
  }
}

function playMp3(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    current = audio;
    stopCurrent = resolve;
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('playback'));
    audio.play().catch(reject);
  });
}

function pickRussianVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const ru = voices.filter((v) => v.lang.toLowerCase().startsWith('ru'));
  return ru.find((v) => /male|pavel|илья|павел/i.test(v.name)) ?? ru[0] ?? null;
}

function speakLocal(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve(false);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 2000));
    u.lang = 'ru-RU';
    const v = pickRussianVoice();
    if (v) u.voice = v;
    u.rate = 1;
    utterance = u;
    stopCurrent = () => resolve(true);
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    synth.speak(u);
  });
}

export type SpeakResult = { ok: true; via: 'yandex' | 'local'; reason?: string } | { ok: false; reason: string };

export async function speak(text: string): Promise<SpeakResult> {
  stopSpeaking();
  let reason = 'Озвучка недоступна';
  if (URL) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(`${URL}?voice=1`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId() },
        body: JSON.stringify({ text }),
      }).finally(() => clearTimeout(timer));
      const data = await res.json().catch(() => null);
      if (res.ok && data?.audio) {
        try {
          await playMp3(data.audio);
          return { ok: true, via: 'yandex' };
        } catch {
          reason = 'Браузер не смог воспроизвести звук';
        }
      } else {
        reason = data?.message || `Ошибка сервера (${res.status})`;
      }
    } catch (e) {
      reason = (e as Error).name === 'AbortError' ? 'Озвучка не успела ответить' : 'Нет связи с сервером озвучки';
    }
  } else {
    reason = 'Серверная функция pet-chat не опубликована';
  }
  const ok = await speakLocal(text);
  return ok ? { ok: true, via: 'local', reason } : { ok: false, reason };
}

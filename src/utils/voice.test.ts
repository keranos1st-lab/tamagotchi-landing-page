// @ts-expect-error bun:test доступен только при запуске через bun
import { beforeEach, describe, expect, test } from 'bun:test';

const mem = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

class FakeAudio {
  static all: FakeAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  played = false;
  paused = false;
  constructor(public src: string) {
    FakeAudio.all.push(this);
  }
  play() {
    this.played = true;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  finish() {
    this.onended?.();
  }
}
g.Audio = FakeAudio;

class FakeUtterance {
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  lang = '';
  voice: unknown = null;
  rate = 1;
  constructor(public text: string) {}
}
g.SpeechSynthesisUtterance = FakeUtterance;
const spoken: FakeUtterance[] = [];
let synthCancels = 0;
g.window = {
  speechSynthesis: {
    getVoices: () => [],
    cancel: () => void synthCancels++,
    speak: (u: FakeUtterance) => void spoken.push(u),
  },
  addEventListener() {},
};

type Pending = { signal?: AbortSignal; resolve: (v: unknown) => void; reject: (e: unknown) => void; text: string };
let pendings: Pending[] = [];
let fetchCalls = 0;
g.fetch = (_url: string, init: { signal?: AbortSignal; body?: string }) => {
  fetchCalls++;
  return new Promise((resolve, reject) => {
    const p: Pending = { signal: init.signal, resolve, reject, text: JSON.parse(init.body ?? '{}').text };
    pendings.push(p);
    init.signal?.addEventListener('abort', () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      reject(e);
    });
  });
};

const { speak, stopSpeaking } = await import('./voice');

const answer = (p: Pending, audio: string, delayJson?: Promise<void>) =>
  p.resolve({
    ok: true,
    status: 200,
    json: async () => {
      if (delayJson) await delayJson;
      return { audio };
    },
  });
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  stopSpeaking();
  FakeAudio.all = [];
  spoken.length = 0;
  pendings = [];
  fetchCalls = 0;
  synthCancels = 0;
});

describe('speak / stopSpeaking', () => {
  test('отмена до ответа сервера: поздний ответ не воспроизводится, Promise завершается', async () => {
    const p = speak('привет');
    await settle();
    expect(pendings.length).toBe(1);
    stopSpeaking();
    answer(pendings[0], 'AAAA');
    const r = await p;
    expect(r).toEqual({ ok: false, reason: 'Озвучка остановлена', cancelled: true });
    expect(FakeAudio.all.length).toBe(0);
    expect(spoken.length).toBe(0);
  });

  test('отмена до ответа реально прерывает сетевой запрос и не выдаётся как сетевая ошибка', async () => {
    const p = speak('привет');
    await settle();
    stopSpeaking();
    expect(pendings[0].signal?.aborted).toBe(true);
    const r = await p;
    expect(r.ok).toBe(false);
    expect((r as { cancelled?: boolean }).cancelled).toBe(true);
    expect(r.ok === false && /связи|успела/.test(r.reason)).toBe(false);
    expect(FakeAudio.all.length).toBe(0);
    expect(spoken.length).toBe(0);
  });

  test('отмена во время чтения ответа: звук не начинается', async () => {
    let open!: () => void;
    const gate = new Promise<void>((r) => (open = r));
    const p = speak('привет');
    await settle();
    answer(pendings[0], 'AAAA', gate);
    await settle();
    stopSpeaking();
    open();
    const r = await p;
    expect((r as { cancelled?: boolean }).cancelled).toBe(true);
    expect(FakeAudio.all.length).toBe(0);
    expect(spoken.length).toBe(0);
  });

  test('отмена во время воспроизведения: звук прекращается, Promise завершается', async () => {
    const p = speak('привет');
    await settle();
    answer(pendings[0], 'AAAA');
    await settle();
    expect(FakeAudio.all.length).toBe(1);
    expect(FakeAudio.all[0].played).toBe(true);
    stopSpeaking();
    expect(FakeAudio.all[0].paused).toBe(true);
    const r = await p;
    expect((r as { cancelled?: boolean }).cancelled).toBe(true);
    expect(spoken.length).toBe(0);
  });

  test('после отмены локальная резервная озвучка не запускается (ошибка сервера)', async () => {
    const p = speak('привет');
    await settle();
    stopSpeaking();
    pendings[0].resolve({ ok: false, status: 500, json: async () => ({ message: 'x' }) });
    const r = await p;
    expect((r as { cancelled?: boolean }).cancelled).toBe(true);
    expect(spoken.length).toBe(0);
  });

  test('после отмены локальная озвучка не запускается и при сетевой ошибке', async () => {
    const p = speak('привет');
    await settle();
    stopSpeaking();
    pendings[0].reject(new TypeError('network'));
    const r = await p;
    expect((r as { cancelled?: boolean }).cancelled).toBe(true);
    expect(spoken.length).toBe(0);
  });

  test('отмена во время локальной озвучки: речь прекращается, Promise завершается', async () => {
    const p = speak('привет');
    await settle();
    pendings[0].resolve({ ok: false, status: 500, json: async () => ({ message: 'сбой' }) });
    await settle();
    expect(spoken.length).toBe(1);
    stopSpeaking();
    expect(synthCancels).toBeGreaterThan(0);
    const r = await p;
    expect((r as { cancelled?: boolean }).cancelled).toBe(true);
  });

  test('без отмены: серверный звук проигрывается и завершается успешно', async () => {
    const p = speak('привет');
    await settle();
    answer(pendings[0], 'AAAA');
    await settle();
    FakeAudio.all[0].finish();
    expect(await p).toEqual({ ok: true, via: 'yandex' });
  });

  test('без отмены: при ошибке сервера включается резервная озвучка', async () => {
    const p = speak('привет');
    await settle();
    pendings[0].resolve({ ok: false, status: 500, json: async () => ({ message: 'сбой' }) });
    await settle();
    expect(spoken.length).toBe(1);
    spoken[0].onend?.();
    const r = await p;
    expect(r).toEqual({ ok: true, via: 'local', reason: 'сбой' });
  });

  test('второй speak() отменяет первый: играет только второй ответ', async () => {
    const p1 = speak('первый');
    await settle();
    const p2 = speak('второй');
    await settle();
    expect(pendings.length).toBe(2);
    expect(pendings[0].signal?.aborted).toBe(true);
    answer(pendings[0], 'OLD1');
    answer(pendings[1], 'NEW2');
    await settle();
    expect(FakeAudio.all.length).toBe(1);
    expect(FakeAudio.all[0].src).toContain('NEW2');
    const r1 = await p1;
    expect((r1 as { cancelled?: boolean }).cancelled).toBe(true);
    expect(FakeAudio.all[0].paused).toBe(false);
    FakeAudio.all[0].finish();
    expect(await p2).toEqual({ ok: true, via: 'yandex' });
    expect(spoken.length).toBe(0);
  });

  test('завершение старого вызова не останавливает новый звук и не стирает его обработчики', async () => {
    const p1 = speak('первый');
    await settle();
    answer(pendings[0], 'OLD1');
    await settle();
    const first = FakeAudio.all[0];
    const p2 = speak('второй');
    expect(first.paused).toBe(true);
    await settle();
    answer(pendings[1], 'NEW2');
    await settle();
    const second = FakeAudio.all[1];
    expect((await p1 as { cancelled?: boolean }).cancelled).toBe(true);
    first.finish();
    expect(second.paused).toBe(false);
    expect(second.onended).not.toBeNull();
    second.finish();
    expect(await p2).toEqual({ ok: true, via: 'yandex' });
  });

  test('stopSpeaking без активных вызовов безопасен', () => {
    stopSpeaking();
    stopSpeaking();
    expect(fetchCalls).toBe(0);
  });
});

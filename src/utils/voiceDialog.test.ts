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
g.document = { visibilityState: 'visible', hidden: false, addEventListener() {}, removeEventListener() {} };

const procs: Array<{ onaudioprocess: ((e: unknown) => void) | null }> = [];
class FakeCtx {
  sampleRate = 16000;
  destination = {};
  resume = () => Promise.resolve();
  close = () => Promise.resolve();
  createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
  createGain = () => ({ gain: { value: 0 }, connect() {}, disconnect() {} });
  createScriptProcessor = () => {
    const p = { onaudioprocess: null as ((e: unknown) => void) | null, connect() {}, disconnect() {} };
    procs.push(p);
    return p;
  };
}
const setupWindow = () => {
  g.window = {
    AudioContext: FakeCtx,
    addEventListener() {},
    removeEventListener() {},
    localStorage: g.localStorage,
    speechSynthesis: { getVoices: () => [], cancel() {}, speak() {} },
  };
};
setupWindow();
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } },
});

type Req = { kind: 'stt' | 'ai' | 'voice'; signal?: AbortSignal; resolve: (v: unknown) => void; reject: (e: unknown) => void };
let reqs: Req[] = [];
let honorAbort = true;
g.fetch = (url: string, init: { signal?: AbortSignal }) => {
  const kind: Req['kind'] = String(url).includes('stt=1') ? 'stt' : String(url).includes('voice=1') ? 'voice' : 'ai';
  return new Promise((resolve, reject) => {
    reqs.push({ kind, signal: init.signal, resolve, reject });
    if (honorAbort)
      init.signal?.addEventListener('abort', () => {
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
  });
};

const { toggleVoice, cancelVoice } = await import('./voiceDialog');
const { transcribe, sttConfig } = await import('./voice');
const { useVoiceStore } = await import('@/store/voiceStore');
const { usePetStore } = await import('@/store/petStore');

const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const vs = () => useVoiceStore.getState();
const pcm = () => new Int16Array(8000);
const sttOk = (text: string, delay?: Promise<void>) => ({
  ok: true,
  status: 200,
  json: async () => {
    if (delay) await delay;
    return { text };
  },
});
const of = (kind: Req['kind']) => reqs.filter((r) => r.kind === kind);

const startTranscribing = async () => {
  await toggleVoice();
  await settle();
  const proc = procs[procs.length - 1];
  const data = new Float32Array(8192).fill(0.5);
  proc.onaudioprocess?.({ inputBuffer: { getChannelData: () => data } });
  void toggleVoice();
  await settle();
};

beforeEach(() => {
  setupWindow();
  cancelVoice();
  reqs = [];
  procs.length = 0;
  honorAbort = true;
  sttConfig.timeoutMs = 20000;
  useVoiceStore.setState({ status: 'idle', level: 0, heard: '', reply: '', note: null });
  usePetStore.setState({ chatHistory: [] });
});

describe('transcribe: отмена, таймаут, обычная работа', () => {
  test('обычное распознавание возвращает текст', async () => {
    const p = transcribe(pcm());
    await settle();
    reqs[0].resolve(sttOk('привет'));
    expect(await p).toEqual({ ok: true, text: 'привет' });
  });

  test('отмена прерывает запрос и возвращает отдельный результат отмены', async () => {
    const c = new AbortController();
    const p = transcribe(pcm(), c.signal);
    await settle();
    c.abort();
    expect(reqs[0].signal?.aborted).toBe(true);
    const r = await p;
    expect(r).toMatchObject({ ok: false, cancelled: true, code: 'cancelled' });
  });

  test('уже отменённый сигнал: запрос не отправляется', async () => {
    const c = new AbortController();
    c.abort();
    const r = await transcribe(pcm(), c.signal);
    expect((r as { cancelled?: boolean }).cancelled).toBe(true);
    expect(reqs.length).toBe(0);
  });

  test('отмена во время чтения ответа отбрасывает результат', async () => {
    const c = new AbortController();
    let open!: () => void;
    const gate = new Promise<void>((r) => (open = r));
    const p = transcribe(pcm(), c.signal);
    await settle();
    reqs[0].resolve(sttOk('поздно', gate));
    await settle();
    c.abort();
    open();
    expect((await p as { cancelled?: boolean }).cancelled).toBe(true);
  });

  test('таймаут остаётся таймаутом, а не отменой', async () => {
    sttConfig.timeoutMs = 30;
    const c = new AbortController();
    const r = await transcribe(pcm(), c.signal);
    expect(r).toMatchObject({ ok: false, code: 'timeout', retryable: true });
    expect((r as { cancelled?: boolean }).cancelled).toBeUndefined();
  });

  test('таймаут без сигнала отмены работает как прежде', async () => {
    sttConfig.timeoutMs = 30;
    expect(await transcribe(pcm())).toMatchObject({ ok: false, code: 'timeout' });
  });

  test('сетевая ошибка остаётся сетевой ошибкой', async () => {
    const p = transcribe(pcm());
    await settle();
    reqs[0].reject(new TypeError('network'));
    expect(await p).toMatchObject({ ok: false, code: 'network' });
  });

  test('отмена не показывается как сетевая ошибка даже при сетевом сбое после отмены', async () => {
    const c = new AbortController();
    honorAbort = false;
    const p = transcribe(pcm(), c.signal);
    await settle();
    c.abort();
    reqs[0].reject(new TypeError('network'));
    expect(await p).toMatchObject({ cancelled: true });
  });

  test('после завершения обработчик отмены удалён', async () => {
    const c = new AbortController();
    let removed = 0;
    const orig = c.signal.removeEventListener.bind(c.signal);
    c.signal.removeEventListener = ((...a: Parameters<typeof orig>) => {
      removed++;
      return orig(...a);
    }) as typeof orig;
    const p = transcribe(pcm(), c.signal);
    await settle();
    reqs[0].resolve(sttOk('ок'));
    await p;
    expect(removed).toBe(1);
  });
});

describe('голосовой диалог: отмена распознавания', () => {
  test('отмена во время запроса прерывает его, интерфейс в ожидании, без ошибки', async () => {
    await startTranscribing();
    expect(vs().status).toBe('transcribing');
    expect(of('stt').length).toBe(1);
    cancelVoice();
    expect(of('stt')[0].signal?.aborted).toBe(true);
    await settle();
    expect(vs().status).toBe('idle');
    expect(vs().note).toBeNull();
    expect(of('ai').length).toBe(0);
    expect(usePetStore.getState().chatHistory.length).toBe(0);
  });

  test('поздний ответ после отмены не запускает AI и не попадает в чат', async () => {
    honorAbort = false;
    await startTranscribing();
    cancelVoice();
    of('stt')[0].resolve(sttOk('поздний текст'));
    await settle();
    expect(of('ai').length).toBe(0);
    expect(usePetStore.getState().chatHistory.length).toBe(0);
    expect(vs().status).toBe('idle');
    expect(vs().heard).toBe('');
  });

  test('отмена во время чтения ответа тоже отбрасывает результат', async () => {
    honorAbort = false;
    let open!: () => void;
    const gate = new Promise<void>((r) => (open = r));
    await startTranscribing();
    of('stt')[0].resolve(sttOk('читаю', gate));
    await settle();
    cancelVoice();
    open();
    await settle();
    expect(of('ai').length).toBe(0);
    expect(usePetStore.getState().chatHistory.length).toBe(0);
    expect(vs().status).toBe('idle');
    expect(vs().note).toBeNull();
  });

  test('старый запрос не мешает новому диалогу', async () => {
    honorAbort = false;
    await startTranscribing();
    const old = of('stt')[0];
    cancelVoice();
    await startTranscribing();
    expect(of('stt').length).toBe(2);
    expect(vs().status).toBe('transcribing');
    old.resolve(sttOk('старый'));
    await settle();
    expect(vs().status).toBe('transcribing');
    expect(of('ai').length).toBe(0);
    expect(of('stt')[1].signal?.aborted).toBe(false);
    cancelVoice();
    expect(vs().status).toBe('idle');
  });

  test('завершение старого запроса не очищает контроллер нового: новая отмена его прерывает', async () => {
    honorAbort = false;
    await startTranscribing();
    const old = of('stt')[0];
    cancelVoice();
    await startTranscribing();
    old.resolve(sttOk('старый'));
    await settle();
    cancelVoice();
    expect(of('stt')[1].signal?.aborted).toBe(true);
  });

  test('обычное распознавание запускает AI', async () => {
    await startTranscribing();
    of('stt')[0].resolve(sttOk('как дела'));
    await settle();
    expect(vs().heard).toBe('как дела');
    expect(vs().status).toBe('thinking');
    expect(of('ai').length).toBe(1);
    cancelVoice();
    expect(vs().status).toBe('idle');
  });

  test('таймаут распознавания показывает сообщение, как прежде', async () => {
    sttConfig.timeoutMs = 40;
    await startTranscribing();
    await settle(120);
    expect(vs().status).toBe('idle');
    expect(vs().note).toContain('не успело');
    expect(of('ai').length).toBe(0);
  });

  test('сетевая ошибка распознавания показывает сообщение о связи', async () => {
    await startTranscribing();
    of('stt')[0].reject(new TypeError('network'));
    await settle();
    expect(vs().note).toContain('Нет связи');
  });
});

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
g.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
const listeners = new Map<string, Set<() => void>>();
const emit = (name: string) => listeners.get(name)?.forEach((f) => f());
g.window = {
  addEventListener: (n: string, f: () => void) => void (listeners.get(n) ?? listeners.set(n, new Set()).get(n)!).add(f),
  removeEventListener: (n: string, f: () => void) => void listeners.get(n)?.delete(f),
  localStorage: g.localStorage, innerWidth: 1280, innerHeight: 800 };

let cloud: { rev: number; [k: string]: unknown };
let saveMode: 'ok' | 'network' | 'conflict' | 'badRev' | 'hold' | 'http500' | 'http401' = 'ok';
let readMode: 'ok' | 'network' = 'ok';
let saves = 0;
let reads = 0;
let failFirst = 0;
let release: (() => void) | null = null;
g.fetch = async (url: string, init?: { body?: string }) => {
  const body = init?.body ? JSON.parse(init.body) : null;
  const json = (d: unknown, status = 200) => ({ ok: status < 400, status, json: async () => d });
  if (body?.action === 'sync_save') {
    saves++;
    if (failFirst > 0) {
      failFirst--;
      throw new TypeError('network');
    }
    if (saveMode === 'http500') return json({ error: 'server', message: 'Ошибка сервера' }, 500);
    if (saveMode === 'http401') return json({ error: 'auth', message: 'Нужен вход' }, 401);
    if (saveMode === 'network') throw new TypeError('network');
    if (saveMode === 'conflict') return json({ error: 'conflict', server: cloud }, 409);
    if (saveMode === 'badRev') return json({});
    if (saveMode === 'hold') await new Promise<void>((r) => (release = r));
    return json({ rev: cloud.rev + 1 });
  }
  if (String(url).includes('sync=1')) {
    reads++;
    if (readMode === 'network') throw new TypeError('network');
    return json(cloud);
  }
  return json({ user: { id: 7, email: 'a@b.c', createdAt: '' } });
};

const { useSyncStore, resumeSession, localSignature, syncSignatures, push, retryConfig, cancelRetry } = await import('./cloudSync');
const { usePetStore } = await import('@/store/petStore');
const { useMemoryStore } = await import('@/store/memoryStore');
const { resolveConflict } = await import('./cloudSync');
const { useAuthStore } = await import('@/store/authStore');

const petSave = (exp: number) => ({ state: { hasSelectedPet: true, type: 'cat', name: 'Т', level: 2, exp, bornAt: 1, chatHistory: [] }, version: 2 });
const cloudWith = (exp: number, rev: number) => ({ pet: petSave(exp), achievements: null, memory: null, rev, clientUpdatedAt: 0 });
const setLocal = async (exp: number) => {
  localStorage.setItem('petagent-save', JSON.stringify(petSave(exp)));
  await usePetStore.persist.rehydrate();
};

const sigAt = async (exp: number) => {
  await setLocal(exp);
  return localSignature();
};

beforeEach(() => {
  mem.clear();
  useAuthStore.setState({ token: 't', user: { id: 7, email: 'a@b.c', createdAt: '' } });
  useSyncStore.setState({ status: 'off', error: null, conflict: null, owner: null });
  cancelRetry();
  listeners.clear();
  saveMode = 'ok';
  readMode = 'ok';
  saves = 0;
  reads = 0;
  failFirst = 0;
  release = null;
  retryConfig.delays = [0, 15, 30];
});

describe('resumeSession', () => {
  test('локальные 55 и облако 10 с новой ревизией: конфликт, 55 сохраняются', async () => {
    const sig = await sigAt(40);
    await setLocal(55);
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig } });
    cloud = cloudWith(10, 2);
    await resumeSession();
    expect(useSyncStore.getState().conflict?.server.rev).toBe(2);
    expect(usePetStore.getState().exp).toBe(55);
    expect((JSON.parse(localStorage.getItem('petagent-save')!).state as { exp: number }).exp).toBe(55);
  });

  test('локальных изменений нет, облако обновилось: облачная версия загружается', async () => {
    const sig = await sigAt(40);
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig } });
    cloud = cloudWith(10, 2);
    await resumeSession();
    expect(useSyncStore.getState().conflict).toBeNull();
    expect(usePetStore.getState().exp).toBe(10);
    expect(useSyncStore.getState().owner?.rev).toBe(2);
  });

  test('старое сохранение без подписи, версии различаются: выбор', async () => {
    await setLocal(55);
    useSyncStore.setState({ owner: { userId: 7, rev: 1 } });
    cloud = cloudWith(10, 2);
    await resumeSession();
    expect(useSyncStore.getState().conflict).not.toBeNull();
    expect(usePetStore.getState().exp).toBe(55);
  });

  test('старое сохранение без подписи, версии совпадают: облако применяется без вопросов', async () => {
    await setLocal(10);
    useSyncStore.setState({ owner: { userId: 7, rev: 1 } });
    cloud = cloudWith(10, 2);
    await resumeSession();
    expect(useSyncStore.getState().conflict).toBeNull();
    expect(useSyncStore.getState().owner?.rev).toBe(2);
  });
});

describe('push({ keepalive: true })', () => {
  const prepare = async () => {
    const sig = await sigAt(40);
    await resumeSessionWith(sig);
    await setLocal(55);
    return sig;
  };
  const resumeSessionWith = async (sig: string) => {
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig } });
    cloud = cloudWith(40, 1);
    await resumeSession();
  };

  for (const mode of ['network', 'conflict', 'badRev'] as const) {
    test(`${mode}: подтверждённое состояние не меняется`, async () => {
      const sig = await prepare();
      const before = syncSignatures();
      saveMode = mode;
      await push({ keepalive: true });
      const owner = useSyncStore.getState().owner;
      expect(owner?.rev).toBe(1);
      expect(owner?.sig).toBe(sig);
      expect(syncSignatures()).toEqual(before);
      expect(localSignature()).not.toBe(syncSignatures().lastSig);
    });
  }

  test('успех: подписи и ревизия отправленного снимка', async () => {
    await prepare();
    const sent = localSignature();
    await push({ keepalive: true });
    const owner = useSyncStore.getState().owner;
    expect(owner?.rev).toBe(2);
    expect(owner?.sig).toBe(sent);
    expect(syncSignatures().lastSig).toBe(sent);
    expect(localSignature()).toBe(syncSignatures().lastSig);
  });

  test('изменение во время запроса остаётся несинхронизированным', async () => {
    await prepare();
    const sent = localSignature();
    saveMode = 'hold';
    const p = push({ keepalive: true });
    await setLocal(60);
    release?.();
    await p;
    const owner = useSyncStore.getState().owner;
    expect(owner?.rev).toBe(2);
    expect(owner?.sig).toBe(sent);
    expect(syncSignatures().lastSig).toBe(sent);
    expect(localSignature()).not.toBe(syncSignatures().lastSig);
  });
});

describe('online: повторная синхронизация', () => {
  const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));
  const offlineEdit = async () => {
    const sig = await sigAt(40);
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig } });
    cloud = cloudWith(40, 1);
    await resumeSession();
    await setLocal(55);
    saves = 0;
    reads = 0;
  };

  test('изменения без интернета отправляются после восстановления связи', async () => {
    await offlineEdit();
    readMode = 'network';
    saveMode = 'network';
    emit('offline');
    readMode = 'ok';
    saveMode = 'ok';
    emit('online');
    await settle();
    const owner = useSyncStore.getState().owner;
    expect(saves).toBe(1);
    expect(owner?.rev).toBe(2);
    expect(localSignature()).toBe(owner?.sig);
    expect(useSyncStore.getState().status).toBe('idle');
  });

  test('если облако изменилось за это время: конфликт, ничего не отправлено', async () => {
    await offlineEdit();
    cloud = cloudWith(10, 3);
    emit('online');
    await settle();
    expect(useSyncStore.getState().conflict?.server.rev).toBe(3);
    expect(saves).toBe(0);
    expect(usePetStore.getState().exp).toBe(55);
  });

  test('временная ошибка: ровно три попытки и остановка, данные несинхронизированы', async () => {
    await offlineEdit();
    saveMode = 'http500';
    emit('online');
    await settle(400);
    expect(saves).toBe(3);
    expect(useSyncStore.getState().status).toBe('error');
    expect(useSyncStore.getState().owner?.rev).toBe(1);
    expect(localSignature()).not.toBe(syncSignatures().lastSig);
    await settle(200);
    expect(saves).toBe(3);
  });

  test('сеть пропала на двух попытках, третья успешна', async () => {
    await offlineEdit();
    failFirst = 2;
    emit('online');
    await settle(400);
    expect(saves).toBe(3);
    expect(useSyncStore.getState().owner?.rev).toBe(2);
    expect(useSyncStore.getState().status).toBe('idle');
  });

  test('ошибка авторизации не повторяется', async () => {
    await offlineEdit();
    saveMode = 'http401';
    emit('online');
    await settle(300);
    expect(saves).toBe(1);
    expect(useAuthStore.getState().token).toBeNull();
  });

  test('повторные online не создают параллельные циклы и отправки', async () => {
    await offlineEdit();
    saveMode = 'hold';
    emit('online');
    emit('online');
    emit('online');
    await settle(60);
    expect(saves).toBe(1);
    release?.();
    await settle(100);
    emit('online');
    await settle(100);
    expect(saves).toBe(1);
    expect(useSyncStore.getState().owner?.rev).toBe(2);
  });

  test('потеря связи останавливает повторы', async () => {
    await offlineEdit();
    saveMode = 'http500';
    emit('online');
    await settle(20);
    emit('offline');
    await settle(300);
    expect(saves).toBeLessThan(3);
  });

  test('успешное чтение облака не скрывает ошибку несохранённых изменений', async () => {
    await offlineEdit();
    saveMode = 'http500';
    emit('online');
    await settle(400);
    expect(useSyncStore.getState().status).toBe('error');
    saveMode = 'ok';
    const { pull } = await import('./cloudSync');
    await pull();
    expect(useSyncStore.getState().status).toBe('error');
    expect(localSignature()).not.toBe(syncSignatures().lastSig);
  });
});

describe('пустая облачная память', () => {
  const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));
  const memSave = (text: string) => ({
    state: { consent: true, items: [{ id: 'a', text, category: 'other', createdAt: 1, updatedAt: 1 }], pending: null },
    version: 1,
  });
  const setLocalMemory = async (text: string, pending = false) => {
    const m = memSave(text);
    if (pending) m.state.pending = { id: 'p', text: 'ожидающий факт' } as never;
    localStorage.setItem('petagent-memory', JSON.stringify(m));
    await useMemoryStore.persist.rehydrate();
  };

  test('облако memory: null очищает факты, согласие и ожидающий факт в store и localStorage', async () => {
    await setLocalMemory('любит чай', true);
    const sig = await sigAt(40);
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig } });
    expect(useMemoryStore.getState().items.length).toBe(1);
    cloud = { ...cloudWith(40, 2), memory: null };
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig: localSignature() } });
    await resumeSession();
    const m = useMemoryStore.getState();
    expect(m.items).toEqual([]);
    expect(m.consent).toBeNull();
    expect(m.pending).toBeNull();
    const raw = localStorage.getItem('petagent-memory');
    expect(raw === null || (JSON.parse(raw).state.items as unknown[]).length === 0).toBe(true);
    expect(useSyncStore.getState().conflict).toBeNull();
  });

  test('после повторной гидратации память остаётся пустой', async () => {
    await setLocalMemory('любит чай', true);
    await sigAt(40);
    cloud = { ...cloudWith(40, 2), memory: null };
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig: localSignature() } });
    await resumeSession();
    await useMemoryStore.persist.rehydrate();
    expect(useMemoryStore.getState().items).toEqual([]);
    expect(useMemoryStore.getState().pending).toBeNull();
    expect(useMemoryStore.getState().consent).toBeNull();
    await settle();
    const raw = localStorage.getItem('petagent-memory');
    expect(raw === null || (JSON.parse(raw).state.items as unknown[]).length === 0).toBe(true);
  });

  test('сброс не запускает обратную отправку старых фактов', async () => {
    await setLocalMemory('любит чай');
    await sigAt(40);
    cloud = { ...cloudWith(40, 2), memory: null };
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig: localSignature() } });
    saves = 0;
    await resumeSession();
    await settle(4300);
    expect(saves).toBe(0);
  });

  test('конфликт: локальный факт сохраняется до выбора, выбор облака очищает его', async () => {
    await setLocalMemory('любит чай');
    const base = localSignature();
    await setLocal(55);
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig: base } });
    cloud = { ...cloudWith(10, 2), memory: null };
    await resumeSession();
    expect(useSyncStore.getState().conflict).not.toBeNull();
    expect(useMemoryStore.getState().items.length).toBe(1);
    expect(localStorage.getItem('petagent-memory')).not.toBeNull();
    await resolveConflict('cloud');
    expect(useMemoryStore.getState().items).toEqual([]);
    expect(useMemoryStore.getState().consent).toBeNull();
    const raw = localStorage.getItem('petagent-memory');
    expect(raw === null || (JSON.parse(raw).state.items as unknown[]).length === 0).toBe(true);
    expect(usePetStore.getState().exp).toBe(10);
  });

  test('непустая облачная память загружается правильно', async () => {
    await setLocalMemory('старый факт');
    await sigAt(40);
    cloud = { ...cloudWith(40, 2), memory: memSave('новый факт') };
    useSyncStore.setState({ owner: { userId: 7, rev: 1, sig: localSignature() } });
    await resumeSession();
    expect(useMemoryStore.getState().items.map((i) => i.text)).toEqual(['новый факт']);
    expect(useMemoryStore.getState().consent).toBe(true);
    expect(JSON.parse(localStorage.getItem('petagent-memory')!).state.items[0].text).toBe('новый факт');
  });
});

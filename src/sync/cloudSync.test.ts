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
g.window = { addEventListener() {}, removeEventListener() {}, localStorage: g.localStorage, innerWidth: 1280, innerHeight: 800 };

let cloud: unknown & { rev: number };
g.fetch = async (url: string, init?: { body?: string }) => {
  const body = init?.body ? JSON.parse(init.body) : null;
  const json = (d: unknown, status = 200) => ({ ok: status < 400, status, json: async () => d });
  if (body?.action === 'sync_save') return json({ rev: cloud.rev + 1 });
  if (String(url).includes('sync=1')) return json(cloud);
  return json({ user: { id: 7, email: 'a@b.c', createdAt: '' } });
};

const { useSyncStore, resumeSession, localSignature } = await import('./cloudSync');
const { usePetStore } = await import('@/store/petStore');
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

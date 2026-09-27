import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePetStore } from '@/store/petStore';
import { useAchievementStore } from '@/store/achievementStore';
import { useMemoryStore } from '@/store/memoryStore';
import { AUTH_URL, authCall, useAuthStore } from '@/store/authStore';

const KEYS = { pet: 'petagent-save', achievements: 'petagent-achievements', memory: 'petagent-memory' } as const;
type Part = keyof typeof KEYS;
type Persisted = { state: Record<string, unknown>; version?: number } | null;
export type Snapshot = Record<Part, Persisted>;

export interface CloudState {
  pet: Persisted;
  achievements: Persisted;
  memory: Persisted;
  rev: number;
  clientUpdatedAt: number;
}

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  owner: { userId: number; rev: number } | null;
  conflict: { server: CloudState; reason: 'login' | 'remote' } | null;
  set: (p: Partial<SyncState>) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: 'off',
      lastSyncedAt: null,
      error: null,
      owner: null,
      conflict: null,
      set: (p) => set(p),
    }),
    {
      name: 'petagent-sync',
      version: 1,
      partialize: (s) => ({ owner: s.owner, lastSyncedAt: s.lastSyncedAt }),
    },
  ),
);

const VOLATILE = new Set(['hunger', 'happiness', 'energy', 'health', 'age', 'lastTick', 'lastInteraction', 'lastPetted', 'chatHistory', 'levelUp']);

function readLocal(): Snapshot {
  const out = {} as Snapshot;
  (Object.keys(KEYS) as Part[]).forEach((p) => {
    try {
      const raw = localStorage.getItem(KEYS[p]);
      out[p] = raw ? JSON.parse(raw) : null;
    } catch {
      out[p] = null;
    }
  });
  if (out.pet?.state) {
    const { chatHistory: _c, ...rest } = out.pet.state;
    void _c;
    out.pet = { ...out.pet, state: rest };
  }
  return out;
}

function signature(s: Snapshot, full: boolean): string {
  const pet = s.pet?.state
    ? Object.fromEntries(Object.entries(s.pet.state).filter(([k]) => full || !VOLATILE.has(k)))
    : null;
  return JSON.stringify([pet, s.achievements?.state ?? null, s.memory?.state ?? null]);
}

export const hasLocalPet = () => !!usePetStore.getState().hasSelectedPet;
export const cloudHasPet = (c: CloudState) => !!(c.pet?.state as { hasSelectedPet?: boolean } | undefined)?.hasSelectedPet;

let applying = false;
let lastSig = '';
let lastFull = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let unsubs: Array<() => void> = [];
let pushing: Promise<void> | null = null;

const st = () => useSyncStore.getState();
const currentUserId = () => useAuthStore.getState().user?.id ?? null;
const baseRev = () => {
  const o = st().owner;
  return o && o.userId === currentUserId() ? o.rev : 0;
};

function markSynced(rev: number) {
  const uid = currentUserId();
  if (uid) st().set({ owner: { userId: uid, rev }, status: 'idle', error: null, lastSyncedAt: Date.now() });
}

async function applyCloud(c: CloudState) {
  applying = true;
  try {
    const localChat = usePetStore.getState().chatHistory;
    (Object.keys(KEYS) as Part[]).forEach((p) => {
      const v = c[p];
      if (!v) {
        if (p !== 'pet') localStorage.removeItem(KEYS[p]);
        return;
      }
      const payload = p === 'pet' ? { ...v, state: { ...v.state, chatHistory: cloudHasPet(c) ? localChat : [] } } : v;
      localStorage.setItem(KEYS[p], JSON.stringify(payload));
    });
    if (!c.pet) usePetStore.setState({ hasSelectedPet: false });
    await Promise.all([usePetStore.persist.rehydrate(), useAchievementStore.persist.rehydrate(), useMemoryStore.persist.rehydrate()]);
    usePetStore.getState().advance();
  } finally {
    const snap = readLocal();
    lastSig = signature(snap, false);
    lastFull = signature(snap, true);
    applying = false;
  }
  markSynced(c.rev);
}

export async function push(opts: { force?: boolean; keepalive?: boolean } = {}): Promise<void> {
  if (!useAuthStore.getState().token || st().conflict) return;
  if (pushing && !opts.keepalive) return pushing;
  const snap = readLocal();
  const body = {
    action: 'sync_save',
    baseRev: baseRev(),
    force: !!opts.force,
    clientUpdatedAt: Date.now(),
    pet: snap.pet,
    achievements: snap.achievements,
    memory: snap.memory,
  };
  if (opts.keepalive && AUTH_URL) {
    fetch(AUTH_URL, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': useAuthStore.getState().token! },
      body: JSON.stringify(body),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.rev && markSynced(d.rev))
      .catch(() => {});
    lastSig = signature(snap, false);
    lastFull = signature(snap, true);
    return;
  }
  st().set({ status: 'syncing' });
  pushing = (async () => {
    const r = await authCall<{ rev: number }>(body);
    if (r.ok) {
      lastSig = signature(snap, false);
      lastFull = signature(snap, true);
      markSynced(r.rev);
    } else if (r.code === 'conflict') {
      const server = (r as unknown as { server: CloudState }).server;
      st().set({ status: 'idle', conflict: { server, reason: 'remote' } });
    } else if (r.status === 401) {
      handleExpired();
    } else {
      st().set({ status: 'error', error: r.message });
    }
  })().finally(() => {
    pushing = null;
  });
  return pushing;
}

export async function pull(): Promise<void> {
  if (!useAuthStore.getState().token || st().conflict || pushing) return;
  const r = await authCall<CloudState>(null, { query: '?sync=1' });
  if (!r.ok) {
    if (r.status === 401) handleExpired();
    else st().set({ status: 'error', error: r.message });
    return;
  }
  if (r.rev <= baseRev()) {
    st().set({ status: 'idle', error: null });
    return;
  }
  const dirty = signature(readLocal(), false) !== lastSig;
  if (dirty) st().set({ conflict: { server: r, reason: 'remote' } });
  else await applyCloud(r);
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => push(), 4000);
}

function onStoreChange() {
  if (applying || !useAuthStore.getState().token) return;
  setTimeout(() => {
    if (applying) return;
    if (signature(readLocal(), false) !== lastSig) schedule();
  }, 0);
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    clearTimeout(timer);
    if (signature(readLocal(), true) !== lastFull) push({ keepalive: true });
  } else {
    pull();
  }
}

function start() {
  stop();
  unsubs = [usePetStore.subscribe(onStoreChange), useAchievementStore.subscribe(onStoreChange), useMemoryStore.subscribe(onStoreChange)];
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onVisibility);
  pollTimer = setInterval(() => document.visibilityState === 'visible' && pull(), 60000);
}

function stop() {
  unsubs.forEach((u) => u());
  unsubs = [];
  clearTimeout(timer);
  clearInterval(pollTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onVisibility);
}

function handleExpired() {
  stop();
  useAuthStore.getState().clearSession();
  st().set({ status: 'off', error: 'Сессия истекла — войдите снова', conflict: null });
}

export async function connectAfterLogin(created: boolean): Promise<void> {
  st().set({ status: 'syncing', error: null, conflict: null });
  const r = await authCall<CloudState>(null, { query: '?sync=1' });
  if (!r.ok) {
    st().set({ status: 'error', error: r.message });
    return;
  }
  start();
  const sameOwner = st().owner?.userId === currentUserId();
  if (!cloudHasPet(r) && !r.memory && !r.achievements) {
    st().set({ owner: { userId: currentUserId()!, rev: r.rev } });
    lastSig = '';
    await push({ force: true });
    return;
  }
  if (!hasLocalPet() || (sameOwner && signature(readLocal(), false) === lastSig)) {
    await applyCloud(r);
    return;
  }
  if (sameOwner && r.rev === st().owner?.rev) {
    lastSig = '';
    await push();
    return;
  }
  void created;
  st().set({ status: 'idle', conflict: { server: r, reason: 'login' } });
}

export async function resolveConflict(choice: 'cloud' | 'local') {
  const c = st().conflict;
  if (!c) return;
  st().set({ conflict: null });
  if (choice === 'cloud') {
    await applyCloud(c.server);
  } else {
    st().set({ owner: { userId: currentUserId()!, rev: c.server.rev } });
    await push({ force: true });
  }
}

export async function resumeSession(): Promise<void> {
  const { token } = useAuthStore.getState();
  if (!token) return;
  const me = await authCall<{ user: { id: number; email: string; createdAt: string } }>(null);
  if (!me.ok) {
    if (me.status === 401) handleExpired();
    else st().set({ status: 'error', error: me.message });
    return;
  }
  useAuthStore.getState().setSession(token, me.user);
  lastSig = signature(readLocal(), false);
  lastFull = signature(readLocal(), true);
  start();
  if (st().owner?.userId !== me.user.id) {
    await connectAfterLogin(false);
    return;
  }
  await pull();
  if (!st().conflict && signature(readLocal(), false) !== lastSig) schedule();
}

export async function logout(clearDevice: boolean): Promise<{ ok: boolean; message?: string }> {
  clearTimeout(timer);
  if (!st().conflict) await push();
  const failed = st().status === 'error';
  await authCall({ action: 'logout' });
  stop();
  useAuthStore.getState().clearSession();
  st().set({ status: 'off', conflict: null, owner: null, error: null });
  if (clearDevice) wipeDevice();
  return failed ? { ok: false, message: 'Последние изменения могли не сохраниться в облаке' } : { ok: true };
}

export function wipeDevice() {
  applying = true;
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  usePetStore.setState({ hasSelectedPet: false, chatHistory: [], levelUp: null });
  useMemoryStore.setState({ consent: null, items: [], pending: null });
  useAchievementStore.setState({ counters: {}, gamesPlayed: [], petsOwned: [], days: [], unlocked: {}, queue: [] });
  applying = false;
  lastSig = '';
  lastFull = '';
}

export function summarize(pet: Persisted, ach: Persisted, mem: Persisted) {
  const p = (pet?.state ?? {}) as { hasSelectedPet?: boolean; name?: string; type?: string; level?: number; bornAt?: number };
  const unlocked = Object.keys(((ach?.state ?? {}) as { unlocked?: Record<string, number> }).unlocked ?? {}).length;
  const memory = (((mem?.state ?? {}) as { items?: unknown[] }).items ?? []).length;
  return { hasPet: !!p.hasSelectedPet, name: p.name ?? '', type: p.type ?? 'cat', level: p.level ?? 1, bornAt: p.bornAt ?? 0, unlocked, memory };
}

export const localSummary = () => {
  const s = readLocal();
  return summarize(s.pet, s.achievements, s.memory);
};

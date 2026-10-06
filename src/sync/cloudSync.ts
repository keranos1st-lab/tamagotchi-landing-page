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
  owner: { userId: number; rev: number; sig?: string } | null;
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

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, canonical(x)]),
    );
  }
  return v;
}

function signature(s: Snapshot, full: boolean): string {
  const pet = s.pet?.state
    ? Object.fromEntries(Object.entries(s.pet.state).filter(([k]) => full || !VOLATILE.has(k)))
    : null;
  return JSON.stringify(canonical([pet, s.achievements?.state ?? null, s.memory?.state ?? null]));
}

const cloudSignature = (c: CloudState) => signature({ pet: c.pet, achievements: c.achievements, memory: c.memory }, false);

export const localSignature = () => signature(readLocal(), false);
export const syncSignatures = () => ({ lastSig, lastFull });

export const hasLocalPet = () => !!usePetStore.getState().hasSelectedPet;
export const cloudHasPet = (c: CloudState) => !!(c.pet?.state as { hasSelectedPet?: boolean } | undefined)?.hasSelectedPet;

let applying = false;
let lastSig = '';
let lastFull = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let unsubs: Array<() => void> = [];
let pushing: Promise<void> | null = null;
let lastErrStatus: number | null = null;
let cycle: Promise<void> | null = null;
let cycleGen = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryWake: (() => void) | null = null;

export const retryConfig = { delays: [0, 3000, 10000] };

const st = () => useSyncStore.getState();
const currentUserId = () => useAuthStore.getState().user?.id ?? null;
const baseRev = () => {
  const o = st().owner;
  return o && o.userId === currentUserId() ? o.rev : 0;
};

function markSynced(rev: number, sig?: string) {
  const uid = currentUserId();
  if (uid) st().set({ owner: { userId: uid, rev, sig }, status: 'idle', error: null, lastSyncedAt: Date.now() });
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
  markSynced(c.rev, lastSig);
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
    const uid = currentUserId();
    const token = useAuthStore.getState().token!;
    const sentSig = signature(snap, false);
    const sentFull = signature(snap, true);
    try {
      const r = await fetch(AUTH_URL, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token },
        body: JSON.stringify(body),
      });
      if (!r.ok) return;
      const d = (await r.json().catch(() => null)) as { rev?: unknown } | null;
      const rev = d?.rev;
      if (typeof rev !== 'number' || !Number.isInteger(rev) || rev <= body.baseRev) return;
      if (uid === null || currentUserId() !== uid || useAuthStore.getState().token !== token) return;
      const owner = st().owner;
      if (owner && owner.userId === uid && owner.rev > rev) return;
      lastSig = sentSig;
      lastFull = sentFull;
      markSynced(rev, sentSig);
    } catch {
      return;
    }
    return;
  }
  st().set({ status: 'syncing' });
  pushing = (async () => {
    const r = await authCall<{ rev: number }>(body);
    if (r.ok) {
      lastSig = signature(snap, false);
      lastFull = signature(snap, true);
      markSynced(r.rev, lastSig);
    } else if (r.code === 'conflict') {
      const server = (r as unknown as { server: CloudState }).server;
      st().set({ status: 'idle', conflict: { server, reason: 'remote' } });
    } else if (r.status === 401) {
      handleExpired();
    } else {
      lastErrStatus = r.status;
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
    else {
      lastErrStatus = r.status;
      st().set({ status: 'error', error: r.message });
    }
    return;
  }
  if (r.rev <= baseRev()) {
    if (signature(readLocal(), false) === lastSig) st().set({ status: 'idle', error: null });
    else if (st().status !== 'error') st().set({ status: 'idle' });
    return;
  }
  const known = st().owner?.userId === currentUserId() && st().owner?.sig !== undefined;
  const local = signature(readLocal(), false);
  const dirty = known ? local !== lastSig : local !== cloudSignature(r);
  if (dirty) st().set({ conflict: { server: r, reason: 'remote' } });
  else await applyCloud(r);
}

const isDirty = () => signature(readLocal(), false) !== lastSig;
const isTransient = () => lastErrStatus === 0 || lastErrStatus === 408 || lastErrStatus === 429 || (lastErrStatus !== null && lastErrStatus >= 500);

function wait(ms: number): Promise<void> {
  return new Promise((res) => {
    retryWake = res;
    retryTimer = setTimeout(() => {
      retryWake = null;
      res();
    }, ms);
  });
}

export function cancelRetry() {
  cycleGen++;
  cycle = null;
  clearTimeout(retryTimer);
  retryWake?.();
  retryWake = null;
}

export function retrySync(): Promise<void> {
  if (cycle) return cycle;
  if (!useAuthStore.getState().token || st().conflict) return Promise.resolve();
  const gen = ++cycleGen;
  const uid = currentUserId();
  const alive = () => gen === cycleGen && !!useAuthStore.getState().token && currentUserId() === uid && !st().conflict;
  const run = (async () => {
    for (let i = 0; i < retryConfig.delays.length; i++) {
      if (retryConfig.delays[i] > 0) await wait(retryConfig.delays[i]);
      if (!alive()) return;
      if (pushing) await pushing;
      if (!alive()) return;
      lastErrStatus = null;
      await pull();
      if (!alive()) return;
      if (lastErrStatus !== null) {
        if (!isTransient()) return;
        continue;
      }
      if (!isDirty()) return;
      await push();
      if (!alive()) return;
      if (st().status !== 'error' || lastErrStatus === null || !isTransient()) return;
    }
  })().finally(() => {
    if (gen === cycleGen) cycle = null;
  });
  cycle = run;
  return run;
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

function onOnline() {
  void retrySync();
}

function start() {
  stop();
  unsubs = [usePetStore.subscribe(onStoreChange), useAchievementStore.subscribe(onStoreChange), useMemoryStore.subscribe(onStoreChange)];
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onVisibility);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', cancelRetry);
  pollTimer = setInterval(() => document.visibilityState === 'visible' && pull(), 60000);
}

function stop() {
  unsubs.forEach((u) => u());
  unsubs = [];
  clearTimeout(timer);
  clearInterval(pollTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', onVisibility);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', cancelRetry);
  cancelRetry();
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
  const owner = st().owner;
  lastSig = owner && owner.userId === me.user.id && owner.sig !== undefined ? owner.sig : '';
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

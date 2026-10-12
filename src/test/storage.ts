type Shared = Storage & { __mem: Map<string, string> };

const KEY = '__petagentSharedTestStorage';
const holder = globalThis as unknown as Record<string, unknown>;

function create(): Shared {
  const mem = new Map<string, string>();
  return {
    __mem: mem,
    get length() {
      return mem.size;
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  } as Shared;
}

export const sharedStorage: Shared = (holder[KEY] ??= create()) as Shared;
export const mem: Map<string, string> = sharedStorage.__mem;

export function installSharedStorage() {
  if (holder.localStorage !== sharedStorage) {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: sharedStorage });
  }
}

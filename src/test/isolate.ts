const g = globalThis as unknown as Record<string, unknown>;

export const MOCKABLE_GLOBALS = ['window', 'document', 'navigator', 'fetch', 'localStorage', 'Audio', 'SpeechSynthesisUtterance', 'ResizeObserver', 'AudioContext', 'MediaRecorder'];

export function snapshotGlobals(keys: string[] = MOCKABLE_GLOBALS) {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const k of keys) saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
  return () => {
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete g[k];
    }
  };
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiProvider = 'polza' | 'openai' | 'openrouter' | 'deepseek';

export const PROVIDERS: Record<AiProvider, { label: string; model: string; hint: string; url: string }> = {
  polza: { label: 'Польза', model: 'openai/gpt-4o-mini', hint: 'Оплата картой РФ, доступ к GPT, Claude, DeepSeek', url: 'https://polza.ai' },
  openai: { label: 'OpenAI', model: 'gpt-4o-mini', hint: 'Ключ вида sk-…', url: 'https://platform.openai.com/api-keys' },
  openrouter: { label: 'OpenRouter', model: 'openai/gpt-4o-mini', hint: 'Сотни моделей по одному ключу', url: 'https://openrouter.ai/keys' },
  deepseek: { label: 'DeepSeek', model: 'deepseek-chat', hint: 'Недорогая модель с хорошим русским', url: 'https://platform.deepseek.com/api_keys' },
};

interface AiKeyState {
  enabled: boolean;
  provider: AiProvider;
  key: string;
  model: string;
  verifiedAt: number | null;
  save: (p: { provider: AiProvider; key: string; model: string }, verified: boolean) => void;
  setEnabled: (v: boolean) => void;
  clear: () => void;
}

export const useAiKeyStore = create<AiKeyState>()(
  persist(
    (set) => ({
      enabled: false,
      provider: 'polza',
      key: '',
      model: '',
      verifiedAt: null,
      save: ({ provider, key, model }, verified) =>
        set({ provider, key: key.trim(), model: model.trim(), enabled: !!key.trim(), verifiedAt: verified ? Date.now() : null }),
      setEnabled: (enabled) => set({ enabled }),
      clear: () => set({ enabled: false, key: '', model: '', verifiedAt: null }),
    }),
    { name: 'petagent-ai-key', version: 1 },
  ),
);

export function ownKeyHeaders(): Record<string, string> {
  const s = useAiKeyStore.getState();
  if (!s.enabled || !s.key) return {};
  const h: Record<string, string> = { 'X-User-Ai-Key': s.key, 'X-User-Ai-Provider': s.provider };
  if (s.model) h['X-User-Ai-Model'] = s.model;
  return h;
}

export const maskKey = (k: string) => (k.length <= 10 ? '••••' : `${k.slice(0, 4)}••••${k.slice(-4)}`);

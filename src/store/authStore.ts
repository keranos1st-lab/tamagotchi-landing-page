import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import func2url from '../../backend/func2url.json';

export const AUTH_URL = (func2url as Record<string, string>)['auth'];

export interface AuthUser {
  id: number;
  email: string;
  createdAt: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clearSession: () => set({ token: null, user: null }),
    }),
    { name: 'petagent-auth', version: 1 },
  ),
);

type Res<T> = ({ ok: true } & T) | { ok: false; code: string; message: string; status: number };

export async function authCall<T = Record<string, unknown>>(
  body: Record<string, unknown> | null,
  opts: { query?: string } = {},
): Promise<Res<T>> {
  if (!AUTH_URL) return { ok: false, code: 'no_function', message: 'Функция входа не опубликована', status: 0 };
  const token = useAuthStore.getState().token;
  try {
    const r = await fetch(`${AUTH_URL}${opts.query ?? ''}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Auth-Token': token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, ...(d as T) };
    return { ok: false, code: d.error ?? `http_${r.status}`, message: d.message ?? `Ошибка сервера (${r.status})`, status: r.status, ...d };
  } catch {
    return { ok: false, code: 'network', message: 'Нет связи с сервером', status: 0 };
  }
}

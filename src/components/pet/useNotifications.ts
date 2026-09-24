import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePetStore } from '@/store/petStore';
import { PET_ICONS } from './sprites';

interface NotifySettings {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export const useNotifySettings = create<NotifySettings>()(
  persist((set) => ({ enabled: false, setEnabled: (enabled) => set({ enabled }) }), { name: 'petagent-notify' }),
);

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;

const COOLDOWN = 10 * 60 * 1000;

type Need = 'hungry' | 'tired' | 'bored' | 'sick';

function currentNeed(s: ReturnType<typeof usePetStore.getState>): Need | null {
  if (s.health < 30) return 'sick';
  if (s.hunger < 30) return 'hungry';
  if (s.energy < 25) return 'tired';
  if (s.happiness < 35) return 'bored';
  return null;
}

const MESSAGES: Record<Need, (n: string) => string> = {
  hungry: (n) => `${n} проголодался и ждёт угощение 🍖`,
  tired: (n) => `${n} совсем устал, уложи его спать 😴`,
  bored: (n) => `${n} скучает! Поиграй с ним 🎾`,
  sick: (n) => `${n} плохо себя чувствует, нужна забота 🤒`,
};

function flashTitle(text: string) {
  const original = document.title;
  let on = false;
  const id = setInterval(() => {
    document.title = on ? original : text;
    on = !on;
  }, 1000);
  const stop = () => {
    if (document.visibilityState !== 'visible') return;
    clearInterval(id);
    document.title = original;
    document.removeEventListener('visibilitychange', stop);
  };
  document.addEventListener('visibilitychange', stop);
}

export function usePetNotifications() {
  const lastSent = useRef<Record<string, number>>({});
  const prevNeed = useRef<Need | null>(null);

  useEffect(() => {
    const check = () => {
      const s = usePetStore.getState();
      if (!s.hasSelectedPet || !useNotifySettings.getState().enabled) return;
      const need = currentNeed(s);
      const changed = need !== prevNeed.current;
      prevNeed.current = need;
      if (!need) return;
      const now = Date.now();
      if (now - (lastSent.current[need] ?? 0) < (changed ? 2 * 60 * 1000 : COOLDOWN)) return;
      if (document.visibilityState === 'visible' && document.hasFocus()) return;

      lastSent.current[need] = now;
      const body = MESSAGES[need](s.name);
      if (notifySupported() && Notification.permission === 'granted') {
        const n = new Notification('PetAgent', { body, icon: PET_ICONS[s.type], tag: 'petagent-' + need });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
      flashTitle(`🔔 ${s.name} зовёт!`);
    };
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);
}
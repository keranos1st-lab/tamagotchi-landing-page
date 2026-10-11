import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePetStore } from '@/store/petStore';
import { useReminderStore } from '@/store/reminderStore';
import { NOTES_CHANGED } from '@/utils/notesApi';
import { PET_ICONS } from '../sprites';
import { sfx } from '../sound';
import { notifySupported } from '../useNotifications';

const POLL_MS = 30_000;
const MAX_WAIT_MS = 60_000;

/**
 * Работает только пока страница открыта (в том числе свёрнутой вкладкой, если браузер не усыпил таймеры).
 * Закрытая вкладка, спящий телефон и выключенный браузер напоминаний не доставят: для этого нужна
 * доставка на стороне ОС (десктоп/Android), она подключается при переносе.
 */
export function useReminders() {
  const token = useAuthStore((s) => s.token);
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!token) {
      useReminderStore.getState().clear();
      announced.current.clear();
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const announce = () => {
      const { queue } = useReminderStore.getState();
      const fresh = queue.filter((q) => !announced.current.has(q.key));
      if (!fresh.length) return;
      fresh.forEach((q) => announced.current.add(q.key));
      sfx.notify();
      const hidden = document.visibilityState !== 'visible' || !document.hasFocus();
      if (hidden && notifySupported() && Notification.permission === 'granted') {
        const pet = usePetStore.getState();
        const n = new Notification(`${pet.name} напоминает`, { body: fresh[0].note.text.slice(0, 140), icon: PET_ICONS[pet.type], tag: `petagent-reminder-${fresh[0].key}` });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    };

    const tick = async () => {
      if (stopped) return;
      const res = await useReminderStore.getState().poll();
      if (stopped) return;
      announce();
      let wait = POLL_MS;
      if (res?.next) {
        const until = new Date(res.next).getTime() - Date.now();
        if (until > 0) wait = Math.min(POLL_MS, Math.max(1500, until + 500));
      }
      timer = setTimeout(tick, Math.min(wait, MAX_WAIT_MS));
    };

    const kick = () => {
      if (timer) clearTimeout(timer);
      tick();
    };
    const onVisible = () => document.visibilityState === 'visible' && kick();

    kick();
    window.addEventListener(NOTES_CHANGED, kick);
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener(NOTES_CHANGED, kick);
      window.removeEventListener('online', kick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);
}

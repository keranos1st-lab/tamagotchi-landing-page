import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { useAuthStore } from '@/store/authStore';
import { useAiKeyStore } from '@/store/aiKeyStore';
import { resumeSession, useSyncStore } from '@/sync/cloudSync';
import { AuthDialog } from './AuthDialog';
import { SettingsDialog } from './SettingsDialog';
import { ConflictDialog } from './ConflictDialog';

let resumed = false;

export function useAccountBoot() {
  useEffect(() => {
    if (resumed) return;
    resumed = true;
    resumeSession();
  }, []);
}

export function AccountButton({ variant = 'icon' }: { variant?: 'icon' | 'pill' }) {
  useAccountBoot();
  const user = useAuthStore((s) => s.user);
  const status = useSyncStore((s) => s.status);
  const ownKey = useAiKeyStore((s) => s.enabled && !!s.key);
  const [authOpen, setAuthOpen] = useState(false);
  const [settings, setSettings] = useState<{ open: boolean; tab: 'account' | 'ai' }>({ open: false, tab: 'account' });

  useEffect(() => {
    const open = (e: Event) => setSettings({ open: true, tab: ((e as CustomEvent).detail as 'account' | 'ai') ?? 'account' });
    window.addEventListener('petagent:settings', open);
    return () => window.removeEventListener('petagent:settings', open);
  }, []);

  const dot = !user ? null : status === 'error' ? 'bg-rose-400' : status === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400';

  return (
    <>
      {variant === 'pill' ? (
        <button
          onClick={() => (user ? setSettings({ open: true, tab: 'account' }) : setAuthOpen(true))}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
        >
          <Icon name={user ? 'Cloud' : 'LogIn'} size={16} />
          {user ? user.email : 'Уже есть аккаунт? Войти'}
        </button>
      ) : (
        <button
          onClick={() => setSettings({ open: true, tab: 'account' })}
          title={user ? `${user.email} · настройки` : 'Войти и настройки'}
          className="icon-btn relative"
        >
          <Icon name={user ? 'CircleUserRound' : 'Settings'} size={17} />
          {dot && <span className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-[#0b0a22] ${dot}`} />}
          {!dot && ownKey && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-[#0b0a22]" />}
        </button>
      )}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <SettingsDialog
        key={settings.tab + String(settings.open)}
        open={settings.open}
        tab={settings.tab}
        onOpenChange={(o) => setSettings((s) => ({ ...s, open: o }))}
        onLogin={() => {
          setSettings((s) => ({ ...s, open: false }));
          setAuthOpen(true);
        }}
      />
      <ConflictDialog />
    </>
  );
}

export const openSettings = (tab: 'account' | 'ai' = 'account') => window.dispatchEvent(new CustomEvent('petagent:settings', { detail: tab }));

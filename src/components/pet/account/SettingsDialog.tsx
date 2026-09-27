import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { authCall, useAuthStore } from '@/store/authStore';
import { logout, push, useSyncStore, wipeDevice } from '@/sync/cloudSync';
import { AiKeySection } from './AiKeySection';

function timeAgo(ts: number | null) {
  if (!ts) return 'ещё не было';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function SettingsDialog({
  open,
  onOpenChange,
  onLogin,
  tab: initialTab = 'account',
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLogin: () => void;
  tab?: 'account' | 'ai';
}) {
  const [tab, setTab] = useState<'account' | 'ai'>(initialTab);
  const user = useAuthStore((s) => s.user);
  const sync = useSyncStore();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState<{ mode: 'change' | 'delete' | null; cur: string; next: string }>({ mode: null, cur: '', next: '' });

  const doLogout = async (clear: boolean) => {
    setBusy(true);
    const r = await logout(clear);
    setBusy(false);
    setNote(r.ok ? { ok: true, text: clear ? 'Вы вышли, данные с этого устройства удалены' : 'Вы вышли. Прогресс остался на этом устройстве' } : { ok: false, text: r.message! });
  };

  const doPassword = async () => {
    setBusy(true);
    setNote(null);
    if (pw.mode === 'change') {
      const r = await authCall({ action: 'change_password', password: pw.cur, newPassword: pw.next });
      setNote(r.ok ? { ok: true, text: 'Пароль изменён, другие устройства разлогинены' } : { ok: false, text: r.message });
      if (r.ok) setPw({ mode: null, cur: '', next: '' });
    } else if (pw.mode === 'delete') {
      const r = await authCall({ action: 'delete_account', password: pw.cur });
      if (r.ok) {
        useAuthStore.getState().clearSession();
        useSyncStore.getState().set({ status: 'off', owner: null, conflict: null });
        wipeDevice();
        setPw({ mode: null, cur: '', next: '' });
        setNote({ ok: true, text: 'Аккаунт и облачные данные удалены' });
      } else setNote({ ok: false, text: r.message });
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ach-dialog max-h-[90vh] max-w-lg gap-0 overflow-y-auto border-white/10 p-0 text-white">
        <div className="border-b border-white/10 p-5 pb-4">
          <DialogTitle className="font-display text-xl font-bold">Настройки</DialogTitle>
          <DialogDescription className="sr-only">Аккаунт, синхронизация и ключ AI</DialogDescription>
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.05] p-1">
            {(
              [
                ['account', 'Аккаунт', 'CloudUpload'],
                ['ai', 'Ключ AI', 'KeyRound'],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition ${tab === id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
              >
                <Icon name={icon} size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {tab === 'ai' && <AiKeySection />}

          {tab === 'account' &&
            (!user ? (
              <div className="text-center">
                <p className="text-sm text-white/65">Войдите по почте, чтобы питомец, достижения и память сохранялись в облаке и были доступны на телефоне и компьютере.</p>
                <button onClick={onLogin} className="btn-neon mt-4">
                  <Icon name="LogIn" size={16} /> Войти или создать аккаунт
                </button>
                {note && <div className={`mt-3 text-xs ${note.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{note.text}</div>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500/50 to-pink-500/40 font-bold uppercase">
                    {user.email[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{user.email}</div>
                    <div className="flex items-center gap-1.5 text-xs text-white/50">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${sync.status === 'error' ? 'bg-rose-400' : sync.status === 'syncing' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}
                      />
                      {sync.status === 'syncing' ? 'Синхронизация…' : sync.status === 'error' ? sync.error : `Сохранено ${timeAgo(sync.lastSyncedAt)}`}
                    </div>
                  </div>
                  <button onClick={() => push()} disabled={busy || sync.status === 'syncing'} className="icon-btn !h-9 !w-9" title="Синхронизировать сейчас">
                    <Icon name="RefreshCw" size={15} className={sync.status === 'syncing' ? 'animate-spin' : ''} />
                  </button>
                </div>
                <p className="text-xs text-white/50">
                  Синхронизируются питомец и его прогресс, достижения и память. Переписка в чате и ключ AI остаются только на этом устройстве.
                </p>

                {pw.mode ? (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-sm font-bold">{pw.mode === 'change' ? 'Смена пароля' : 'Удаление аккаунта'}</div>
                    {pw.mode === 'delete' && <div className="text-xs text-rose-200/80">Облачные данные будут удалены безвозвратно, а на этом устройстве — стёрты.</div>}
                    <input
                      type="password"
                      value={pw.cur}
                      onChange={(e) => setPw({ ...pw, cur: e.target.value })}
                      placeholder="Текущий пароль"
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm focus:outline-none"
                    />
                    {pw.mode === 'change' && (
                      <input
                        type="password"
                        value={pw.next}
                        onChange={(e) => setPw({ ...pw, next: e.target.value })}
                        placeholder="Новый пароль, от 8 символов"
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm focus:outline-none"
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={doPassword}
                        disabled={busy || !pw.cur || (pw.mode === 'change' && pw.next.length < 8)}
                        className={`flex-1 rounded-xl py-2 text-sm font-bold disabled:opacity-40 ${pw.mode === 'delete' ? 'bg-rose-500 text-white' : 'bg-pink-500 text-white'}`}
                      >
                        {pw.mode === 'change' ? 'Сменить' : 'Удалить навсегда'}
                      </button>
                      <button onClick={() => setPw({ mode: null, cur: '', next: '' })} className="btn-ghost !py-2 text-sm">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => doLogout(false)} disabled={busy} className="btn-ghost !py-2 text-xs">
                      <Icon name="LogOut" size={14} /> Выйти
                    </button>
                    <button
                      onClick={() => confirm('Выйти и стереть питомца, достижения и память с этого устройства? В облаке всё сохранится.') && doLogout(true)}
                      disabled={busy}
                      className="btn-ghost !py-2 text-xs"
                    >
                      <Icon name="MonitorX" size={14} /> Выйти и очистить
                    </button>
                    <button onClick={() => setPw({ mode: 'change', cur: '', next: '' })} className="btn-ghost !py-2 text-xs">
                      <Icon name="Lock" size={14} /> Сменить пароль
                    </button>
                    <button onClick={() => setPw({ mode: 'delete', cur: '', next: '' })} className="btn-ghost !py-2 text-xs !text-rose-200">
                      <Icon name="UserX" size={14} /> Удалить аккаунт
                    </button>
                  </div>
                )}
                {note && <div className={`text-xs ${note.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{note.text}</div>}
              </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

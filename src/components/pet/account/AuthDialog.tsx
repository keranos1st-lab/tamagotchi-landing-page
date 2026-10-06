import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { authCall, useAuthStore, type AuthUser } from '@/store/authStore';
import { connectAfterLogin } from '@/sync/cloudSync';

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState<'email' | 'code' | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const closeReset = (message: string | null = null) => {
    setReset(null);
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setPassword('');
    setError(null);
    setNotice(message);
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !reset) return;
    setError(null);
    if (reset === 'email') {
      setBusy(true);
      const r = await authCall({ action: 'request_password_reset', email: email.trim() });
      setBusy(false);
      if (!r.ok) return setError(r.message);
      setNotice((r as { message?: string }).message ?? 'Если аккаунт зарегистрирован, письмо с кодом придёт на почту');
      return setReset('code');
    }
    if (!/^\d{6}$/.test(code)) return setError('Введите 6 цифр из письма');
    if (newPassword.length < 8) return setError('Пароль должен быть не короче 8 символов');
    if (newPassword !== confirmPassword) return setError('Пароли не совпадают');
    setBusy(true);
    const r = await authCall({ action: 'confirm_password_reset', email: email.trim(), code, newPassword });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setMode('login');
    closeReset('Пароль изменён. Войдите с новым паролем.');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (mode === 'register' && password.length < 8) return setError('Пароль должен быть не короче 8 символов');
    setBusy(true);
    const r = await authCall<{ token: string; user: AuthUser; created?: boolean }>({ action: mode, email: email.trim(), password });
    if (!r.ok) {
      setBusy(false);
      if (r.code === 'exists') setMode('login');
      if (r.code === 'invalid' && mode === 'login') return setError('Неверная почта или пароль. Нет аккаунта? Зарегистрируйтесь.');
      return setError(r.message);
    }
    useAuthStore.getState().setSession(r.token, r.user);
    await connectAfterLogin(!!r.created);
    setBusy(false);
    setPassword('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ach-dialog max-w-md border-white/10 p-0 text-white">
        {reset ? (
        <form onSubmit={submitReset} className="p-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/40 to-pink-500/30">
            <Icon name="KeyRound" size={22} className="text-pink-100" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold">Восстановление пароля</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/55">
            {reset === 'email' ? 'Укажите почту аккаунта — мы отправим на неё код из 6 цифр.' : 'Введите код из письма и придумайте новый пароль.'}
          </DialogDescription>

          <label className="mt-4 block text-xs font-bold text-white/60">Почта</label>
          <input
            type="email"
            autoComplete="email"
            required
            disabled={reset === 'code'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.ru"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none disabled:opacity-60"
          />

          {reset === 'code' && (
            <>
              <label className="mt-3 block text-xs font-bold text-white/60">Код из письма</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-center text-lg font-bold tracking-[0.4em] text-white placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none"
              />
              <label className="mt-3 block text-xs font-bold text-white/60">Новый пароль</label>
              <input
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Не короче 8 символов"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none"
              />
              <label className="mt-3 block text-xs font-bold text-white/60">Повторите пароль</label>
              <input
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none"
              />
              <button type="button" onClick={() => setShow(!show)} className="mt-2 flex items-center gap-1 text-[11px] text-white/50 hover:text-white">
                <Icon name={show ? 'EyeOff' : 'Eye'} size={14} />
                {show ? 'Скрыть пароль' : 'Показать пароль'}
              </button>
            </>
          )}

          {notice && reset === 'code' && <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">{notice}</div>}
          {error && <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</div>}

          <button type="submit" disabled={busy} className="btn-neon mt-5 w-full disabled:opacity-50">
            {busy ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name={reset === 'email' ? 'Mail' : 'Check'} size={16} />}
            {reset === 'email' ? 'Отправить код' : 'Сменить пароль'}
          </button>
          {reset === 'code' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setReset('email');
                setCode('');
                setNotice(null);
                setError(null);
              }}
              className="mt-3 w-full text-center text-xs text-white/50 hover:text-white disabled:opacity-50"
            >
              Отправить код ещё раз
            </button>
          )}
          <button type="button" onClick={() => closeReset()} className="mt-3 w-full text-center text-xs text-white/50 hover:text-white">
            Вернуться ко входу
          </button>
        </form>
        ) : (
        <form onSubmit={submit} className="p-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/40 to-pink-500/30">
            <Icon name="CloudUpload" size={22} className="text-pink-100" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold">{mode === 'login' ? 'Вход' : 'Создать аккаунт'}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/55">
            Питомец, достижения и память будут сохраняться в облаке и откроются на любом устройстве.
          </DialogDescription>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.05] p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-xl py-2 text-sm font-bold transition ${mode === m ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
              >
                {m === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-xs font-bold text-white/60">Почта</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.ru"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none"
          />
          <label className="mt-3 block text-xs font-bold text-white/60">Пароль</label>
          <div className="relative mt-1">
            <input
              type={show ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Не короче 8 символов' : ''}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white">
              <Icon name={show ? 'EyeOff' : 'Eye'} size={16} />
            </button>
          </div>

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => {
                setReset('email');
                setError(null);
                setNotice(null);
              }}
              className="mt-2 text-xs font-bold text-pink-200/80 hover:text-pink-100"
            >
              Забыли пароль?
            </button>
          )}

          {notice && <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">{notice}</div>}
          {error && <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</div>}

          <button type="submit" disabled={busy} className="btn-neon mt-5 w-full disabled:opacity-50">
            {busy ? <Icon name="Loader2" size={16} className="animate-spin" /> : <Icon name={mode === 'login' ? 'LogIn' : 'UserPlus'} size={16} />}
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-white/40">
            Пароль хранится только в зашифрованном виде. Забыли пароль — его можно восстановить по коду на почту.
          </p>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

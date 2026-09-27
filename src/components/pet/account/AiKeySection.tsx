import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { maskKey, PROVIDERS, useAiKeyStore, type AiProvider } from '@/store/aiKeyStore';
import { useAiStatusStore } from '@/store/aiStatusStore';
import { checkOwnKey } from '@/utils/petAi';

export function AiKeySection() {
  const saved = useAiKeyStore();
  const [editing, setEditing] = useState(!saved.key);
  const [provider, setProvider] = useState<AiProvider>(saved.provider);
  const [key, setKey] = useState('');
  const [model, setModel] = useState(saved.model);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const verify = async () => {
    if (!key.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await checkOwnKey(provider, key, model);
    setBusy(false);
    if (r.ok) {
      saved.save({ provider, key, model }, true);
      setKey('');
      setEditing(false);
      setMsg({ ok: true, text: `Ключ работает · модель ${r.model}` });
      useAiStatusStore.getState().refresh();
    } else {
      const text: Record<string, string> = {
        own_bad_key: 'Сервис не принял ключ. Проверьте, что выбран правильный сервис и ключ скопирован целиком.',
        own_no_balance: 'Ключ верный, но на балансе сервиса нет средств.',
        own_bad_model: 'Ключ верный, но такой модели у сервиса нет — очистите поле модели или исправьте название.',
      };
      setMsg({ ok: false, text: text[r.code] ?? r.message });
    }
  };

  if (!editing && saved.key) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15">
            <Icon name="KeyRound" size={16} className="text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold">
              {PROVIDERS[saved.provider].label} · <span className="font-mono text-white/70">{maskKey(saved.key)}</span>
            </div>
            <div className="truncate text-xs text-white/50">Модель: {saved.model || PROVIDERS[saved.provider].model}</div>
          </div>
          <button
            role="switch"
            aria-checked={saved.enabled}
            onClick={() => {
              saved.setEnabled(!saved.enabled);
              useAiStatusStore.getState().refresh();
            }}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${saved.enabled ? 'bg-gradient-to-r from-violet-500 to-pink-500' : 'bg-white/15'}`}
            title={saved.enabled ? 'Выключить свой ключ' : 'Включить свой ключ'}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${saved.enabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        <div className="text-xs text-white/50">
          {saved.enabled
            ? 'Чат работает через ваш ключ: без общего дневного лимита, оплата — на вашем аккаунте сервиса.'
            : 'Ключ сохранён, но выключен — чат использует общий AI приложения с дневным лимитом.'}
        </div>
        {msg && <div className={`text-xs ${msg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{msg.text}</div>}
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="btn-ghost !py-1.5 text-xs">
            <Icon name="Pencil" size={13} /> Заменить
          </button>
          <button
            onClick={() => {
              saved.clear();
              setEditing(true);
              setMsg(null);
              useAiStatusStore.getState().refresh();
            }}
            className="btn-ghost !py-1.5 text-xs !text-rose-200"
          >
            <Icon name="Trash2" size={13} /> Удалить ключ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {(Object.keys(PROVIDERS) as AiProvider[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              setProvider(p);
              setMsg(null);
            }}
            className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${
              provider === p ? 'border-pink-300/60 bg-pink-500/15 text-white' : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
            }`}
          >
            {PROVIDERS[p].label}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-white/45">
        {PROVIDERS[provider].hint} ·{' '}
        <a href={PROVIDERS[provider].url} target="_blank" rel="noreferrer" className="font-bold text-cyan-200 hover:underline">
          где взять ключ
        </a>
      </div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={key}
          onChange={(e) => setKey(e.target.value.trim())}
          placeholder="Вставьте API-ключ"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 pr-10 font-mono text-sm text-white placeholder:font-sans placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white">
          <Icon name={show ? 'EyeOff' : 'Eye'} size={16} />
        </button>
      </div>
      <input
        value={model}
        onChange={(e) => setModel(e.target.value.trim())}
        placeholder={`Модель (по умолчанию ${PROVIDERS[provider].model})`}
        spellCheck={false}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:font-sans placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none"
      />
      {msg && (
        <div className={`rounded-xl border px-3 py-2 text-xs ${msg.ok ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : 'border-rose-300/25 bg-rose-500/10 text-rose-100'}`}>
          {msg.text}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={verify} disabled={!key || busy} className="btn-neon flex-1 !py-2 text-sm disabled:opacity-40">
          {busy ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="ShieldCheck" size={15} />}
          Проверить и сохранить
        </button>
        {saved.key && (
          <button onClick={() => setEditing(false)} className="btn-ghost !py-2 text-sm">
            Отмена
          </button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-white/40">
        Ключ хранится только в этом браузере и не синхронизируется. Он передаётся нашему серверу вместе с каждым сообщением и сразу
        уходит в выбранный сервис — мы его не записываем. Не используйте ключ на чужих устройствах.
      </p>
    </div>
  );
}

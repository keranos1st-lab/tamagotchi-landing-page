import { useEffect } from 'react';
import { useAiStatus, useAiStatusStore } from '@/store/aiStatusStore';
import { PROVIDERS, useAiKeyStore } from '@/store/aiKeyStore';
import { openSettings } from './account/AccountButton';
import { usePetStore } from '@/store/petStore';
import Icon from '@/components/ui/icon';
import { IQ_LEVELS, iqLevel, iqNext } from './iq';
import { Panel, PanelTitle } from './ui';

function Ring({ value }: { value: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="url(#iqGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * Math.min(100, value)) / 100}
        className="transition-all duration-700"
      />
      <defs>
        <linearGradient id="iqGrad" x1="0" x2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function PetStats() {
  const { hunger, happiness, energy, health, intelligence, age } = usePetStore();

  const stats = [
    { label: 'Сытость', value: hunger, icon: 'Drumstick', bar: 'from-orange-400 to-amber-300', glow: 'rgba(251,146,60,0.6)', tone: 'text-orange-300' },
    { label: 'Счастье', value: happiness, icon: 'Smile', bar: 'from-pink-500 to-rose-300', glow: 'rgba(236,72,153,0.6)', tone: 'text-pink-300' },
    { label: 'Энергия', value: energy, icon: 'Zap', bar: 'from-yellow-300 to-lime-300', glow: 'rgba(250,204,21,0.6)', tone: 'text-yellow-300' },
    { label: 'Здоровье', value: health, icon: 'HeartPulse', bar: 'from-emerald-400 to-teal-300', glow: 'rgba(52,211,153,0.6)', tone: 'text-emerald-300' },
  ];

  const lvl = iqLevel(intelligence);
  const iqRank = IQ_LEVELS[lvl].name;
  const next = iqNext(intelligence);

  return (
    <Panel>
      <PanelTitle icon="Activity" title="Состояние" />

      <div className="space-y-3.5">
        {stats.map((s) => {
          const low = s.value < 30;
          return (
            <div key={s.label}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Icon name={s.icon} size={15} className={s.tone} />
                  {s.label}
                </span>
                <span className={`text-sm font-extrabold tabular-nums ${low ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                  {Math.round(s.value)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${low ? 'from-rose-500 to-red-400' : s.bar} transition-all duration-700`}
                  style={{ width: `${s.value}%`, boxShadow: `0 0 10px ${low ? 'rgba(244,63,94,0.7)' : s.glow}` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="glass-soft flex items-center gap-2.5 p-2.5">
          <div className="relative grid place-items-center">
            <Ring value={intelligence} />
            <Icon name="Brain" size={14} className="absolute text-cyan-300" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">IQ</div>
            <div className="text-sm font-extrabold text-white">
              {iqRank} · {Math.round(intelligence)}
            </div>
          </div>
        </div>
        <div className="glass-soft flex items-center gap-2.5 p-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]">
            <Icon name="Clock" size={16} className="text-violet-300" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Возраст</div>
            <div className="text-sm font-extrabold text-white tabular-nums">
              {formatAge(age)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-cyan-300/15 bg-cyan-400/[0.05] p-2.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-cyan-100">
          <span>Что умеет: {iqRank}</span>
          {next ? (
            <span className="text-white/50">
              до «{IQ_LEVELS[next.level].name}»: {next.need} IQ
            </span>
          ) : (
            <span className="text-emerald-300">максимум</span>
          )}
        </div>
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-white/60">
          {IQ_LEVELS[lvl].can.map((c) => (
            <li key={c} className="flex gap-1.5">
              <Icon name="Check" size={11} className="mt-0.5 shrink-0 text-cyan-300" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <AiStatusBadge />
    </Panel>
  );
}

function formatAge(min: number) {
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return d > 0 ? `${d}д ${h}ч` : `${h}ч ${m}м`;
}

function AiStatusBadge() {
  const st = useAiStatus();
  const own = useAiKeyStore((s) => (s.enabled && s.key ? s : null));
  useEffect(() => {
    const { status, refresh } = useAiStatusStore.getState();
    if (status === undefined) refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  if (own) {
    return (
      <button onClick={() => openSettings('ai')} className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.07] p-3 text-left text-cyan-100">
        <Icon name="KeyRound" size={14} className="text-cyan-300" />
        <div className="text-xs leading-snug">
          <div className="font-bold">AI через ваш ключ</div>
          <div className="text-white/50">
            {PROVIDERS[own.provider].label} · {own.model || PROVIDERS[own.provider].model}
          </div>
        </div>
      </button>
    );
  }
  const ok = st?.configured && st.budgetOk !== false;
  const tone = st === undefined ? 'white' : ok ? 'emerald' : st === null ? 'amber' : 'rose';
  const title = st === undefined ? 'Проверяю AI…' : ok ? 'AI-помощник подключён' : st === null ? 'AI: нет связи с сервером' : !st.configured ? 'AI не настроен' : 'Дневной бюджет AI исчерпан';
  const sub =
    ok && st?.remainingToday !== undefined
      ? `Осталось сегодня: ${st.remainingToday} из ${st.limits?.perDay} сообщений`
      : st?.configured === false
        ? 'Нужен секрет POLZA_AI_API_KEY'
        : st === null
          ? 'Проверь подключение к интернету'
          : '';
  const cls: Record<string, string> = {
    white: 'border-white/10 bg-white/[0.04] text-white/60',
    emerald: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200',
    amber: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-200',
    rose: 'border-rose-400/25 bg-rose-500/[0.08] text-rose-200',
  };
  const dot: Record<string, string> = { white: 'bg-white/40', emerald: 'bg-emerald-400', amber: 'bg-amber-400', rose: 'bg-rose-400' };
  return (
    <div className={`mt-3 flex items-center gap-2.5 rounded-2xl border p-3 ${cls[tone]}`}>
      <span className="relative flex h-2.5 w-2.5">
        {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot[tone]}`} />
      </span>
      <div className="flex-1 text-xs leading-snug">
        <div className="font-bold">{title}</div>
        {sub && <div className="text-white/50">{sub}</div>}
      </div>
      <button onClick={() => openSettings('ai')} className="shrink-0 rounded-lg px-1.5 py-1 text-white/50 hover:bg-white/10 hover:text-white" title="Подключить свой ключ AI">
        <Icon name="KeyRound" size={13} />
      </button>
    </div>
  );
}

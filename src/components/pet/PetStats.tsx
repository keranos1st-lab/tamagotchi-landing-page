import { usePetStore } from '@/store/petStore';
import Icon from '@/components/ui/icon';
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

  const iqRank =
    intelligence < 20 ? 'Новичок' : intelligence < 40 ? 'Ученик' : intelligence < 60 ? 'Знаток' : intelligence < 80 ? 'Эксперт' : 'Мастер';

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
            <div className="text-sm font-extrabold text-white">{iqRank}</div>
          </div>
        </div>
        <div className="glass-soft flex items-center gap-2.5 p-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]">
            <Icon name="Clock" size={16} className="text-violet-300" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">Возраст</div>
            <div className="text-sm font-extrabold text-white tabular-nums">
              {Math.floor(age / 60)}ч {age % 60}м
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <div className="text-xs leading-snug">
          <div className="font-bold text-emerald-200">AI-агент активен</div>
          <div className="text-white/50">
            {intelligence < 25 ? 'Малыш: короткие ответы — обучай питомца' : intelligence < 50 ? 'Ученик: понятные советы' : intelligence < 75 ? 'Знаток: подробные ответы' : 'Эксперт: глубокие ответы с примерами'}
          </div>
        </div>
      </div>
    </Panel>
  );
}
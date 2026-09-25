import { usePetStore } from '@/store/petStore';
import Icon from '@/components/ui/icon';
import { ACTION_SFX } from './sound';
import { SIGNATURES } from './signature';

type ActionType = 'feed' | 'play' | 'train' | 'sleep' | 'heal' | null;

interface PetActionsProps {
  onAction: (action: ActionType) => void;
  onSignature?: () => void;
}

export function PetActions({ onAction, onSignature }: PetActionsProps) {
  const { feed, play, train, sleep, heal, energy, hunger, type } = usePetStore();
  const sig = SIGNATURES[type];

  const actions = [
    { id: 'feed' as const, label: 'Покормить', icon: 'Drumstick', gain: '+25 сытость', cost: '−5 энергии', disabled: energy < 5, grad: 'from-orange-400 to-amber-500', glow: 'rgba(251,146,60,0.55)', fn: feed },
    { id: 'play' as const, label: 'Играть', icon: 'Gamepad2', gain: '+30 счастье', cost: '−20 энергии', disabled: energy < 15, grad: 'from-pink-500 to-rose-500', glow: 'rgba(236,72,153,0.55)', fn: play },
    { id: 'train' as const, label: 'Обучать', icon: 'GraduationCap', gain: '+5 IQ', cost: '−25 энергии', disabled: energy < 20, grad: 'from-violet-500 to-indigo-500', glow: 'rgba(139,92,246,0.55)', fn: train },
    { id: 'sleep' as const, label: 'Спать', icon: 'Moon', gain: '+50 энергии', cost: '−10 сытости', disabled: false, grad: 'from-sky-500 to-blue-600', glow: 'rgba(56,189,248,0.55)', fn: sleep },
    { id: 'heal' as const, label: 'Лечить', icon: 'Pill', gain: '+30 здоровье', cost: 'Бесплатно', disabled: false, grad: 'from-emerald-400 to-teal-500', glow: 'rgba(52,211,153,0.55)', fn: heal },
  ];

  return (
    <div className="space-y-3">
      {onSignature && (
        <button onClick={onSignature} className="pa-tile group flex w-full items-center gap-4 p-4 text-left">
          <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 via-violet-500/10 to-transparent opacity-70 transition-opacity group-hover:opacity-100" />
          <div className="pa-icon-chip relative h-12 w-12 shrink-0 bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white" style={{ ['--chip-glow' as string]: 'rgba(217,70,239,0.6)' }}>
            <Icon name={sig.icon} size={22} />
          </div>
          <div className="relative flex-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white">{sig.label}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200">Фирменный трюк</span>
            </div>
            <div className="text-xs text-white/55">{sig.hint}</div>
          </div>
          <Icon name="Sparkles" size={18} className="relative text-fuchsia-300 transition-transform group-hover:rotate-12" />
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((a) => (
          <button
            key={a.id}
            disabled={a.disabled}
            onClick={() => {
              a.fn();
              onAction(a.id);
              ACTION_SFX[a.id === 'feed' ? 'eat' : a.id === 'train' ? 'study' : a.id]?.();
            }}
            className="pa-tile group p-4 text-left"
          >
            <div
              className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${a.grad} opacity-20 blur-2xl transition-opacity group-hover:opacity-40`}
            />
            <div
              className={`pa-icon-chip relative h-11 w-11 bg-gradient-to-br ${a.grad} text-white`}
              style={{ ['--chip-glow' as string]: a.glow }}
            >
              <Icon name={a.icon} size={20} />
            </div>
            <div className="relative mt-3 font-extrabold text-white">{a.label}</div>
            <div className="relative mt-1 text-xs font-bold text-emerald-300">{a.gain}</div>
            <div className="relative text-xs text-white/40">{a.cost}</div>
          </button>
        ))}
      </div>

      {energy < 20 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <Icon name="BatteryLow" size={18} />
          Мало энергии — уложи питомца спать
        </div>
      )}
      {hunger < 20 && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <Icon name="TriangleAlert" size={18} />
          Питомец голодает! Покорми его скорее
        </div>
      )}
    </div>
  );
}

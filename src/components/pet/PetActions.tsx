import { usePetStore } from '@/store/petStore';

type ActionType = 'feed' | 'play' | 'train' | 'sleep' | 'heal' | null;

interface PetActionsProps {
  onAction: (action: ActionType) => void;
}

export function PetActions({ onAction }: PetActionsProps) {
  const { feed, play, train, sleep, heal, energy, hunger } = usePetStore();

  const actions = [
    {
      id: 'feed' as const,
      label: 'Покормить',
      icon: '🍖',
      desc: 'Сытость +25, Счастье +5',
      cost: 'Энергия -5',
      disabled: energy < 5,
      color: 'from-orange-500 to-amber-500',
      onClick: () => {
        feed();
        onAction('feed');
      },
    },
    {
      id: 'play' as const,
      label: 'Играть',
      icon: '🎾',
      desc: 'Счастье +30',
      cost: 'Энергия -20, Голод -10',
      disabled: energy < 15,
      color: 'from-pink-500 to-rose-500',
      onClick: () => {
        play();
        onAction('play');
      },
    },
    {
      id: 'train' as const,
      label: 'Обучать',
      icon: '📚',
      desc: 'Интеллект +5',
      cost: 'Энергия -25, Голод -15',
      disabled: energy < 20,
      color: 'from-purple-500 to-violet-500',
      onClick: () => {
        train();
        onAction('train');
      },
    },
    {
      id: 'sleep' as const,
      label: 'Спать',
      icon: '💤',
      desc: 'Энергия +50, Здоровье +10',
      cost: 'Голод -10',
      disabled: false,
      color: 'from-blue-500 to-indigo-500',
      onClick: () => {
        sleep();
        onAction('sleep');
      },
    },
    {
      id: 'heal' as const,
      label: 'Лечить',
      icon: '💊',
      desc: 'Здоровье +30',
      cost: 'Бесплатно',
      disabled: false,
      color: 'from-green-500 to-emerald-500',
      onClick: () => {
        heal();
        onAction('heal');
      },
    },
  ];

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/20">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`relative group p-3 rounded-xl border transition-all duration-200 ${
              action.disabled
                ? 'bg-slate-700/50 border-slate-600 opacity-50 cursor-not-allowed'
                : 'bg-slate-700/50 border-purple-500/30 hover:border-purple-400 hover:bg-slate-700 hover:scale-105 active:scale-95'
            }`}
          >
            <div className="text-2xl mb-1">{action.icon}</div>
            <div className="text-white text-sm font-medium">{action.label}</div>
            <div className="text-purple-300 text-xs mt-0.5">{action.desc}</div>
            <div className="text-slate-400 text-xs mt-0.5">{action.cost}</div>

            {/* Hover gradient */}
            {!action.disabled && (
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${action.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
            )}
          </button>
        ))}
      </div>

      {/* Low energy warning */}
      {energy < 20 && (
        <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-300 text-xs">
            ⚠️ Мало энергии! Уложи питомца спать для восстановления.
          </p>
        </div>
      )}

      {/* Low hunger warning */}
      {hunger < 20 && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-500/30 rounded-lg">
          <p className="text-red-300 text-xs">
            🚨 Питомец голодает! Покорми его скорее!
          </p>
        </div>
      )}
    </div>
  );
}

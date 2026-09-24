import { usePetStore } from '@/store/petStore';

export function PetStats() {
  const { hunger, happiness, energy, health, intelligence, age } = usePetStore();

  const stats = [
    { label: 'Голод', value: hunger, icon: '🍖', color: 'from-orange-500 to-amber-500', warning: hunger < 30 },
    { label: 'Счастье', value: happiness, icon: '😊', color: 'from-pink-500 to-rose-400', warning: happiness < 30 },
    { label: 'Энергия', value: energy, icon: '⚡', color: 'from-yellow-400 to-amber-400', warning: energy < 30 },
    { label: 'Здоровье', value: health, icon: '❤️', color: 'from-red-500 to-pink-500', warning: health < 30 },
    { label: 'Интеллект', value: intelligence, icon: '🧠', color: 'from-purple-500 to-violet-400', warning: false },
  ];

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/20">
      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
        <span>📊</span> Статус
      </h3>

      <div className="space-y-3">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-purple-200 flex items-center gap-1">
                <span>{stat.icon}</span>
                {stat.label}
              </span>
              <span className={`text-sm font-bold ${stat.warning ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {Math.round(stat.value)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${stat.color} rounded-full transition-all duration-500 ${
                  stat.warning ? 'animate-pulse' : ''
                }`}
                style={{ width: `${stat.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-purple-500/20">
        <div className="text-xs text-purple-300">
          <span className="flex items-center gap-1">
            🕐 Возраст: <span className="text-white font-medium">{Math.floor(age / 60)}ч {age % 60}м</span>
          </span>
        </div>
        <div className="text-xs text-purple-300 mt-1">
          <span className="flex items-center gap-1">
            🎓 IQ-уровень: <span className="text-white font-medium">
              {intelligence < 20 ? 'Новичок' : intelligence < 40 ? 'Ученик' : intelligence < 60 ? 'Знаток' : intelligence < 80 ? 'Эксперт' : 'Мастер'}
            </span>
          </span>
        </div>
      </div>

      {/* Agent mode indicator */}
      <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl border border-purple-500/30">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-purple-200">AI-Агент активен</span>
        </div>
        <p className="text-xs text-purple-300 mt-1">
          {intelligence < 30
            ? 'Базовые ответы. Обучай питомца!'
            : intelligence < 60
            ? 'Хорошие советы. Продолжай обучение!'
            : 'Экспертные ответы! Максимальная польза!'}
        </p>
      </div>

      {/* Overlay mode hint */}
      <div className="mt-3 p-2 bg-indigo-900/30 rounded-lg border border-indigo-500/20">
        <p className="text-xs text-indigo-300 flex items-center gap-1">
          📌 <span>В десктоп-версии питомец будет поверх всех окон</span>
        </p>
      </div>
    </div>
  );
}

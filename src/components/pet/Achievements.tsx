import { usePetStore } from '@/store/petStore';
import { useState } from 'react';

interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  check: (state: any) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_feed', title: 'Первый обед', desc: 'Покорми питомца впервые', icon: '🍖', check: (s) => s.hunger > 80 },
  { id: 'level5', title: 'Растём!', desc: 'Достигни 5 уровня', icon: '⭐', check: (s) => s.level >= 5 },
  { id: 'level10', title: 'Опытный!', desc: 'Достигни 10 уровня', icon: '🌟', check: (s) => s.level >= 10 },
  { id: 'smart', title: 'Умник', desc: 'Интеллект выше 50', icon: '🧠', check: (s) => s.intelligence >= 50 },
  { id: 'genius', title: 'Гений', desc: 'Интеллект выше 80', icon: '💡', check: (s) => s.intelligence >= 80 },
  { id: 'happy', title: 'Счастливчик', desc: 'Счастье на максимуме', icon: '😊', check: (s) => s.happiness >= 95 },
  { id: 'survivor', title: 'Выживший', desc: 'Возраст больше 30 минут', icon: '🏆', check: (s) => s.age >= 30 },
  { id: 'best_friend', title: 'Лучший друг', desc: 'Все показатели выше 70', icon: '💕', check: (s) => s.hunger > 70 && s.happiness > 70 && s.energy > 70 && s.health > 70 },
];

export function Achievements() {
  const state = usePetStore();
  const [showAll, setShowAll] = useState(false);

  const unlocked = ACHIEVEMENTS.filter(a => a.check(state));
  const locked = ACHIEVEMENTS.filter(a => !a.check(state));
  const displayed = showAll ? [...unlocked, ...locked] : unlocked.slice(0, 4);

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-purple-500/20">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-bold flex items-center gap-2">
          <span>🏆</span> Достижения
        </h3>
        <span className="text-xs text-purple-300 bg-purple-900/50 px-2 py-1 rounded-full">
          {unlocked.length}/{ACHIEVEMENTS.length}
        </span>
      </div>

      <div className="space-y-2">
        {displayed.map((achievement) => {
          const isUnlocked = unlocked.includes(achievement);
          return (
            <div
              key={achievement.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition ${
                isUnlocked
                  ? 'bg-purple-900/30 border border-purple-500/30'
                  : 'bg-slate-700/30 border border-slate-600/30 opacity-60'
              }`}
            >
              <span className="text-xl">{isUnlocked ? achievement.icon : '🔒'}</span>
              <div className="flex-1">
                <div className={`text-sm font-medium ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>
                  {achievement.title}
                </div>
                <div className="text-xs text-purple-300">{achievement.desc}</div>
              </div>
              {isUnlocked && <span className="text-green-400 text-xs">✓</span>}
            </div>
          );
        })}
      </div>

      {ACHIEVEMENTS.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full text-center text-xs text-purple-400 hover:text-purple-200 transition"
        >
          {showAll ? 'Свернуть' : `Показать все (${ACHIEVEMENTS.length})`}
        </button>
      )}
    </div>
  );
}

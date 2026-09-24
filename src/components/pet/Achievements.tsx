import { usePetStore, type PetState } from '@/store/petStore';
import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Chip, Panel, PanelTitle } from './ui';

interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  check: (state: PetState) => boolean;
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

  const pct = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);

  return (
    <Panel>
      <PanelTitle
        icon="Trophy"
        title="Достижения"
        right={<Chip className="!text-amber-200">{unlocked.length}/{ACHIEVEMENTS.length}</Chip>}
      />
      <div className="mb-4 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 shadow-[0_0_10px_rgba(251,191,36,0.6)] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-2">
        {displayed.length === 0 && (
          <div className="glass-soft p-3 text-center text-xs text-white/50">Пока пусто — заботься о питомце, и награды появятся</div>
        )}
        {displayed.map((a) => {
          const ok = unlocked.includes(a);
          return (
            <div
              key={a.id}
              className={`flex items-center gap-3 rounded-2xl p-2.5 transition ${
                ok ? 'bg-gradient-to-r from-amber-400/[0.12] to-transparent border border-amber-300/20' : 'glass-soft opacity-55'
              }`}
            >
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${
                  ok ? 'bg-gradient-to-br from-amber-300/30 to-orange-500/20 shadow-[0_0_16px_-4px_rgba(251,191,36,0.6)]' : 'bg-white/5 grayscale'
                }`}
              >
                {ok ? a.icon : <Icon name="Lock" size={15} className="text-white/40" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-bold ${ok ? 'text-white' : 'text-white/60'}`}>{a.title}</div>
                <div className="truncate text-xs text-white/45">{a.desc}</div>
              </div>
              {ok && <Icon name="BadgeCheck" size={18} className="text-amber-300 shrink-0" />}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setShowAll(!showAll)}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold text-white/50 hover:bg-white/5 hover:text-white transition"
      >
        {showAll ? 'Свернуть' : `Все награды (${ACHIEVEMENTS.length})`}
        <Icon name={showAll ? 'ChevronUp' : 'ChevronDown'} size={14} />
      </button>
    </Panel>
  );
}

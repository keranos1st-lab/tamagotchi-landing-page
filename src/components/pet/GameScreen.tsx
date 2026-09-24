import { useEffect, useState } from 'react';
import { PetSprite } from './PetSprite';
import { ACTION_ANIM, type PetAnim } from './sprites';
import { FloatingPet } from './FloatingPet';
import { needAnim, PetEmotion, usePetNeed } from './PetEmotion';
import { usePetNotifications } from './useNotifications';
import { usePetStore } from '@/store/petStore';
import { PetSelection } from './PetSelection';
import { PetActions } from './PetActions';
import { PetStats } from './PetStats';
import { PetChat } from './PetChat';
import { PetHeader } from './PetHeader';
import { MiniGames } from './MiniGames';
import { Achievements } from './Achievements';
import Icon from '@/components/ui/icon';

import type { ActionType } from './sprites';

type Tab = 'actions' | 'games' | 'chat';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'actions', label: 'Уход', icon: 'Heart' },
  { id: 'games', label: 'Игры', icon: 'Gamepad2' },
  { id: 'chat', label: 'AI-чат', icon: 'MessageCircle' },
];

const STARS = Array.from({ length: 18 }).map((_, i) => ({
  left: (i * 47) % 100,
  top: (i * 29) % 90,
  delay: (i % 6) * 0.5,
}));

export function GameScreen() {
  const { hasSelectedPet, hunger, happiness, energy, health, tick, type, level, stage, intelligence } = usePetStore();
  const [activeTab, setActiveTab] = useState<Tab>('actions');
  const [currentAction, setCurrentAction] = useState<ActionType>(null);
  const [poked, setPoked] = useState(false);
  const need = usePetNeed();
  usePetNotifications();

  useEffect(() => {
    const catchUp = usePetStore.getState().catchUp;
    catchUp();
    const onVisible = () => document.visibilityState === 'visible' && catchUp();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 5000);
    return () => clearInterval(interval);
  }, [tick]);

  useEffect(() => {
    if (currentAction) {
      const timer = setTimeout(() => {
        setCurrentAction(null);
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [currentAction]);

  if (!hasSelectedPet) {
    return <PetSelection />;
  }

  const mood = getMood(hunger, happiness, energy, health);
  const anim: PetAnim = currentAction ? ACTION_ANIM[currentAction] : poked ? 'wave' : needAnim(need) ?? 'idle';
  const spriteSize = stage === 'adult' ? 300 : stage === 'teen' ? 270 : 240;
  const stageLabel = stage === 'adult' ? 'Взрослый' : stage === 'teen' ? 'Подросток' : 'Малыш';

  const poke = () => {
    if (poked) return;
    setPoked(true);
    setTimeout(() => setPoked(false), 1600);
  };

  return (
    <div className="pa-app flex flex-col">
      <FloatingPet />
      <PetHeader />

      <main className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[280px_1fr]">
        <aside className="order-2 space-y-4 lg:order-1">
          <PetStats />
          <Achievements />
        </aside>

        <section className="order-1 flex flex-col gap-4 lg:order-2 min-w-0">
          <div className="pa-stage min-h-[380px] sm:min-h-[440px]">
            <div className="pa-orbit h-[340px] w-[340px]" />
            <div className="pa-orbit h-[520px] w-[520px] opacity-60" style={{ animationDirection: 'reverse' }} />
            {STARS.map((s, i) => (
              <span
                key={i}
                className="pa-star"
                style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }}
              />
            ))}
            <div className="pa-floor" />

            <div className="absolute left-4 top-4 right-4 z-20 flex flex-wrap items-start justify-between gap-2">
              <div className="glass !rounded-2xl px-3.5 py-2.5">
                <div className="pa-label !text-[10px]">Настроение</div>
                <div className="mt-0.5 flex items-center gap-2 text-sm font-extrabold text-white">
                  <span className={`h-2 w-2 rounded-full ${mood.dot}`} />
                  {mood.label}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="glass !rounded-2xl px-3.5 py-2.5 text-right">
                  <div className="pa-label !text-[10px]">Стадия</div>
                  <div className="mt-0.5 text-sm font-extrabold text-white">{stageLabel}</div>
                </div>
                <div className="glass !rounded-2xl px-3.5 py-2.5 text-right">
                  <div className="pa-label !text-[10px]">IQ</div>
                  <div className="mt-0.5 text-sm font-extrabold text-cyan-300 tabular-nums">{Math.round(intelligence)}</div>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-[9%] z-10 flex justify-center">
              <div className="relative">
                {!currentAction && !poked && <PetEmotion need={need} />}
                <button onClick={poke} className="cursor-pointer focus:outline-none transition-transform active:scale-95" title="Погладить">
                  <PetSprite type={type} anim={anim} size={spriteSize} />
                </button>
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/30 border border-white/10 px-3 py-1 text-[11px] font-semibold text-white/60 backdrop-blur">
              <Icon name="Hand" size={12} />
              Нажми, чтобы погладить · Ур. {level}
            </div>
          </div>

          <div className="glass !rounded-2xl p-1.5 flex gap-1">
            {TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-extrabold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-[0_8px_24px_-8px_rgba(236,72,153,0.7)]'
                      : 'text-white/55 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon name={t.icon} size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div key={activeTab} className="pa-rise">
            {activeTab === 'actions' && <PetActions onAction={setCurrentAction} />}
            {activeTab === 'games' && <MiniGames />}
            {activeTab === 'chat' && <PetChat />}
          </div>
        </section>
      </main>
    </div>
  );
}

function getMood(hunger: number, happiness: number, energy: number, health: number) {
  const avg = (hunger + happiness + energy + health) / 4;
  if (avg > 80) return { label: 'Счастлив', dot: 'bg-emerald-400 shadow-[0_0_10px_#34d399]' };
  if (avg > 60) return { label: 'Доволен', dot: 'bg-lime-300 shadow-[0_0_10px_#bef264]' };
  if (avg > 40) return { label: 'Нормально', dot: 'bg-amber-300 shadow-[0_0_10px_#fcd34d]' };
  if (avg > 20) return { label: 'Грустит', dot: 'bg-orange-400 shadow-[0_0_10px_#fb923c]' };
  return { label: 'Плохо', dot: 'bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse' };
}

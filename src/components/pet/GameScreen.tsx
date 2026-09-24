import { useEffect, useState } from 'react';
import { Pet3D } from './Pet3D';
import { usePetStore } from '@/store/petStore';
import { PetSelection } from './PetSelection';
import { PetActions } from './PetActions';
import { PetStats } from './PetStats';
import { PetChat } from './PetChat';
import { PetHeader } from './PetHeader';
import { MiniGames } from './MiniGames';
import { Achievements } from './Achievements';

type ActionType = 'feed' | 'play' | 'train' | 'sleep' | 'heal' | null;

export function GameScreen() {
  const { hasSelectedPet, hunger, happiness, energy, health, tick, type, level, stage } = usePetStore();
  const [activeTab, setActiveTab] = useState<'actions' | 'chat' | 'games'>('actions');
  const [showOverlayInfo, setShowOverlayInfo] = useState(true);
  const [currentAction, setCurrentAction] = useState<ActionType>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 5000);
    return () => clearInterval(interval);
  }, [tick]);

  // Auto-reset action after animation completes
  useEffect(() => {
    if (currentAction) {
      const timer = setTimeout(() => {
        setCurrentAction(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentAction]);

  if (!hasSelectedPet) {
    return <PetSelection />;
  }

  const mood = getMood(hunger, happiness, energy, health);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">
      {/* Overlay mode info banner */}
      {showOverlayInfo && (
        <div className="bg-gradient-to-r from-indigo-900/90 to-purple-900/90 border-b border-indigo-500/30 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">🖥️</span>
            <span className="text-indigo-200">
              <strong>Режим поверх окон:</strong> В десктоп-версии (Electron/Tauri) питомец будет отображаться поверх других приложений и может анализировать выделенный текст в любом окне.
            </span>
          </div>
          <button
            onClick={() => setShowOverlayInfo(false)}
            className="text-indigo-300 hover:text-white transition p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <PetHeader />

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-7xl mx-auto w-full">
        {/* Left panel - Stats & Achievements */}
        <div className="lg:w-64 flex-shrink-0 space-y-4">
          <PetStats />
          <Achievements />
        </div>

        {/* Center - Pet Display */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative rounded-2xl overflow-hidden border border-purple-500/20 bg-gradient-to-b from-slate-900/50 to-indigo-950/50 min-h-[350px] flex items-center justify-center">
            {/* Pet with action animation */}
            <Pet3D type={type} mood={mood} level={level} stage={stage} action={currentAction} />

            {/* Mood indicator */}
            <div className="absolute top-4 left-4 bg-slate-800/80 backdrop-blur-sm rounded-xl px-3 py-2 border border-purple-500/20">
              <span className="text-sm text-purple-200">
                Настроение: <span className="font-bold text-white">{mood}</span>
              </span>
            </div>

            {/* Floating particles effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-purple-400/30 rounded-full animate-float-particle"
                  style={{
                    left: `${10 + i * 12}%`,
                    animationDelay: `${i * 0.7}s`,
                    animationDuration: `${4 + i * 0.5}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex mt-4 bg-slate-800/50 rounded-xl p-1 border border-purple-500/20">
            <button
              onClick={() => setActiveTab('actions')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                activeTab === 'actions'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              🎮 Действия
            </button>
            <button
              onClick={() => setActiveTab('games')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                activeTab === 'games'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              🧩 Игры
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                activeTab === 'chat'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              💬 AI-Чат
            </button>
          </div>

          {/* Bottom panel */}
          <div className="mt-4">
            {activeTab === 'actions' && <PetActions onAction={setCurrentAction} />}
            {activeTab === 'games' && <MiniGames />}
            {activeTab === 'chat' && <PetChat />}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMood(hunger: number, happiness: number, energy: number, health: number): string {
  const avg = (hunger + happiness + energy + health) / 4;
  if (avg > 80) return '✨ Счастлив';
  if (avg > 60) return '😊 Доволен';
  if (avg > 40) return '😐 Нормально';
  if (avg > 20) return '😢 Грустит';
  return '😰 Плохо';
}

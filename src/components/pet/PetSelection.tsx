import { useState } from 'react';
import { PetType, PET_NAMES, usePetStore } from '@/store/petStore';

const PET_INFO: Record<PetType, { emoji: string; color: string; desc: string }> = {
  cat: { emoji: '🐱', color: 'from-orange-500 to-amber-500', desc: 'Независимый и умный. Любит учиться!' },
  dog: { emoji: '🐕', color: 'from-amber-700 to-yellow-600', desc: 'Верный друг. Всегда поддержит!' },
  bird: { emoji: '🐦', color: 'from-blue-500 to-cyan-400', desc: 'Свободный дух. Знает много интересного!' },
  fox: { emoji: '🦊', color: 'from-orange-600 to-red-500', desc: 'Хитрый и мудрый. Даст лучший совет!' },
  dragon: { emoji: '🐉', color: 'from-purple-600 to-violet-500', desc: 'Могучий и мудрый. Эксперт во всём!' },
  bunny: { emoji: '🐰', color: 'from-pink-400 to-rose-300', desc: 'Милый и заботливый. Поднимет настроение!' },
  panda: { emoji: '🐼', color: 'from-gray-700 to-gray-500', desc: 'Спокойный и философский. Знает о жизни!' },
  owl: { emoji: '🦉', color: 'from-stone-600 to-amber-700', desc: 'Самый мудрый! Лучший учитель!' },
};

export function PetSelection() {
  const [selectedType, setSelectedType] = useState<PetType | null>(null);
  const [name, setName] = useState('');
  const selectPet = usePetStore((s) => s.selectPet);

  const handleConfirm = () => {
    if (selectedType && name.trim()) {
      selectPet(selectedType, name.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3">
            🎮 PetAgent
          </h1>
          <p className="text-xl text-purple-200">
            Выбери своего 3D питомца-помощника!
          </p>
          <p className="text-sm text-purple-300 mt-2">
            Корми, играй, обучай — и он станет твоим умным AI-помощником
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {(Object.keys(PET_INFO) as PetType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setSelectedType(type);
                if (!name) setName(PET_NAMES[type]);
              }}
              className={`relative p-4 rounded-2xl border-2 transition-all duration-300 transform hover:scale-105 ${
                selectedType === type
                  ? 'border-purple-400 bg-purple-900/50 shadow-lg shadow-purple-500/30 scale-105'
                  : 'border-slate-700 bg-slate-800/50 hover:border-purple-500/50'
              }`}
            >
              <div className={`text-5xl mb-2 bg-gradient-to-r ${PET_INFO[type].color} rounded-full w-20 h-20 flex items-center justify-center mx-auto`}>
                <span className="text-4xl">{PET_INFO[type].emoji}</span>
              </div>
              <h3 className="text-white font-bold text-lg">{PET_NAMES[type]}</h3>
              <p className="text-purple-300 text-xs mt-1">{PET_INFO[type].desc}</p>
              {selectedType === type && (
                <div className="absolute -top-2 -right-2 bg-purple-500 rounded-full w-6 h-6 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {selectedType && (
          <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30 animate-fadeIn">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex-1">
                <label className="text-purple-200 text-sm font-medium mb-2 block">
                  Имя питомца:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Введите имя..."
                  className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition"
                  maxLength={20}
                />
              </div>
              <button
                onClick={handleConfirm}
                disabled={!name.trim()}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg shadow-purple-500/30"
              >
                Начать! 🚀
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

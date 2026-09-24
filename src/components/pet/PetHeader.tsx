import { usePetStore } from '@/store/petStore';
import { PET_ICONS } from './sprites';
import { PET_NAMES } from '@/store/petStore';

export function PetHeader() {
  const { name, type, level, exp, expToNext } = usePetStore();

  const expPercent = (exp / expToNext) * 100;

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-purple-500/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={PET_ICONS[type]} alt="" className="w-11 h-11 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-white">{name}</h1>
            <p className="text-xs text-purple-300">Уровень {level} • {PET_NAMES[type as keyof typeof PET_NAMES]}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* EXP bar */}
          <div className="hidden sm:block">
            <div className="text-xs text-purple-300 mb-1">Опыт: {exp}/{expToNext}</div>
            <div className="w-40 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${expPercent}%` }}
              />
            </div>
          </div>

          {/* Level badge */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-full px-4 py-1">
            <span className="text-white font-bold text-sm">Lv.{level}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

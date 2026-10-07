import { useState } from 'react';
import { PetType, PET_NAMES, usePetStore } from '@/store/petStore';
import { PetSprite } from './PetSprite';
import { AccountButton } from './account/AccountButton';
import Icon from '@/components/ui/icon';

const PET_INFO: Record<PetType, { emoji: string; color: string; desc: string }> = {
  cat: { emoji: '🐱', color: 'from-orange-500 to-amber-500', desc: 'Кодик — робо-кот. Независимый и умный!' },
  dog: { emoji: '🦙', color: 'from-teal-600 to-cyan-500', desc: 'Мягкая и пушистая. Всегда поддержит!' },
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

  const trait: Record<PetType, string> = {
    cat: 'Код',
    dog: 'Поддержка',
    bird: 'Факты',
    fox: 'Советы',
    dragon: 'Эксперт',
    bunny: 'Настроение',
    panda: 'Философия',
    owl: 'Учёба',
  };

  return (
    <div className="pa-app flex items-center justify-center px-4 py-10">
      <div className="relative z-10 w-full max-w-5xl">
        <div className="mb-10 text-center pa-rise">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            AI-питомец, который растёт вместе с тобой
          </div>
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] text-white sm:text-7xl">
            Pet<span className="text-gradient">Agent</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/60 sm:text-lg">
            Выбери компаньона. Корми, играй и обучай — и он станет твоим умным помощником.
          </p>
          <div className="mt-5 flex justify-center">
            <AccountButton variant="pill" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {(Object.keys(PET_INFO) as PetType[]).map((type, i) => {
            const active = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  if (!name || Object.values(PET_NAMES).includes(name)) setName(PET_NAMES[type]);
                }}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`pa-tile pa-rise group p-3 text-left ${
                  active ? '!border-pink-300/60 shadow-[0_0_0_1px_rgba(244,114,182,0.4),0_20px_50px_-15px_rgba(236,72,153,0.6)] -translate-y-1' : ''
                }`}
              >
                <div className={`relative h-36 overflow-hidden rounded-2xl bg-gradient-to-br ${PET_INFO[type].color}`}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.35),transparent_60%)]" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-center transition-transform duration-300 group-hover:scale-105">
                    <PetSprite type={type} anim={active ? 'wave' : 'idle'} size={136} />
                  </div>
                  <span className="absolute left-2 top-2 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur">
                    {trait[type]}
                  </span>
                  {active && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-pink-600 pa-pop">
                      <Icon name="Check" size={14} />
                    </span>
                  )}
                </div>
                <div className="px-1 pb-1 pt-3">
                  <div className="font-display text-base font-bold text-white">{PET_NAMES[type]}</div>
                  <p className="mt-1 text-xs leading-snug text-white/50">{PET_INFO[type].desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className={`glass mt-6 p-4 transition-all duration-500 sm:p-5 ${
            selectedType ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-4'
          }`}
        >
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="pa-label mb-2 block">Имя питомца</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                placeholder="Как назовёшь?"
                maxLength={20}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 text-lg font-bold text-white placeholder:text-white/30 focus:border-pink-300/50 focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition"
              />
            </label>
            <button onClick={handleConfirm} disabled={!name.trim()} className="btn-neon pa-shine !px-8 !py-4 text-base">
              Начать приключение
              <Icon name="ArrowRight" size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

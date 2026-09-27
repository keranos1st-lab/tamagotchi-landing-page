import { usePetStore, PET_NAMES } from '@/store/petStore';
import { PET_ICONS } from './sprites';
import Icon from '@/components/ui/icon';
import { NotifyToggle } from './NotifyToggle';
import { SoundToggle } from './SoundToggle';
import { AccountButton } from './account/AccountButton';

export function PetHeader() {
  const { name, type, level, exp, expToNext, resetPet } = usePetStore();

  const onReset = () => {
    if (confirm(`Завести нового питомца? ${name} и весь прогресс будут потеряны.`)) resetPet();
  };

  const expPercent = Math.min(100, (exp / expToNext) * 100);

  return (
    <header className="sticky top-0 z-40 px-4 pt-4">
      <div className="glass mx-auto flex max-w-7xl items-center justify-between gap-4 !rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="font-display text-lg font-extrabold hidden md:block">
            Pet<span className="text-gradient">Agent</span>
          </div>
          <div className="hidden md:block h-8 w-px bg-white/10" />
          <div className="relative shrink-0">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/40 to-pink-500/30 border border-white/15">
              <img src={PET_ICONS[type]} alt="" className="h-9 w-9 object-contain" />
            </div>
            <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-[#0b0a22]">
              {level}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-display text-base font-bold leading-tight text-white truncate">{name}</div>
            <div className="text-xs text-white/50">{PET_NAMES[type]}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block w-48 mr-2">
            <div className="mb-1.5 flex justify-between text-[11px] font-bold">
              <span className="text-white/50 uppercase tracking-wider">Опыт</span>
              <span className="tabular-nums text-white/80">
                {exp}/{expToNext}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500 transition-all duration-700 shadow-[0_0_12px_rgba(236,72,153,0.7)]"
                style={{ width: `${expPercent}%` }}
              />
            </div>
          </div>
          <SoundToggle />
          <NotifyToggle />
          <AccountButton />
          <button onClick={onReset} title="Сменить питомца" className="icon-btn">
            <Icon name="RefreshCw" size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

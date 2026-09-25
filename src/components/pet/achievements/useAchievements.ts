import { useEffect, useMemo } from 'react';
import { usePetStore } from '@/store/petStore';
import { useAchievementStore } from '@/store/achievementStore';
import { ACHIEVEMENTS, progressOf, type Ctx } from './catalog';

export function useAchievementCtx(): Ctx {
  const pet = usePetStore();
  const { counters, gamesPlayed, petsOwned, days } = useAchievementStore();
  return useMemo(() => ({ pet, c: counters, gamesPlayed, petsOwned, days }), [pet, counters, gamesPlayed, petsOwned, days]);
}

export function useAchievementWatcher() {
  const ctx = useAchievementCtx();
  const unlocked = useAchievementStore((s) => s.unlocked);
  const unlock = useAchievementStore((s) => s.unlock);
  const markVisit = useAchievementStore((s) => s.markVisit);
  const markPet = useAchievementStore((s) => s.markPet);
  const petType = usePetStore((s) => s.type);
  const hasPet = usePetStore((s) => s.hasSelectedPet);

  useEffect(() => {
    markVisit();
  }, [markVisit]);

  useEffect(() => {
    if (hasPet) markPet(petType);
  }, [hasPet, petType, markPet]);

  useEffect(() => {
    if (!hasPet) return;
    for (const a of ACHIEVEMENTS) {
      if (!unlocked[a.id] && progressOf(a, ctx) >= 1) {
        unlock(a.id);
        usePetStore.getState().gainExp(a.xp);
      }
    }
  }, [ctx, unlocked, unlock, hasPet]);
}

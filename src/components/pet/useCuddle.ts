import { useEffect, useState } from 'react';
import { usePetStore } from '@/store/petStore';

export const CUDDLE_AFTER_MS = 3 * 60 * 1000;

export function wantsCuddleNow() {
  const s = usePetStore.getState();
  const tired = s.energy < 25 || s.health < 30;
  return !tired && Date.now() - s.lastPetted > CUDDLE_AFTER_MS;
}

export function useWantsCuddle() {
  const [wants, setWants] = useState(wantsCuddleNow);
  const lastPetted = usePetStore((s) => s.lastPetted);
  useEffect(() => {
    setWants(wantsCuddleNow());
    const id = setInterval(() => setWants(wantsCuddleNow()), 5000);
    return () => clearInterval(id);
  }, [lastPetted]);
  return wants;
}

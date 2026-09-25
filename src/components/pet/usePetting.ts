import { useCallback, useEffect, useRef, useState } from 'react';
import { usePetStore } from '@/store/petStore';
import { sfx } from './sound';

const PHRASES = ['Мррр…', 'Ещё-ещё!', 'Как приятно!', 'Обожаю тебя!', 'Хи-хи, щекотно!', 'Ты лучший!', 'Не останавливайся!'];
const ASK_MORE = ['Погладь ещё?', 'А ещё?', 'Уже всё?..'];

export function usePetting() {
  const petStat = usePetStore((s) => s.pet);
  const [petting, setPetting] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [love, setLove] = useState(0);

  const endTimer = useRef<ReturnType<typeof setTimeout>>();
  const askTimer = useRef<ReturnType<typeof setTimeout>>();
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastGain = useRef(0);
  const lastHeart = useRef(0);
  const strokes = useRef(0);
  const down = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const travel = useRef(0);
  const heartId = useRef(0);

  const say = useCallback((text: string, ms = 1400) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  const stroke = useCallback(
    (x?: number, y?: number) => {
      const now = performance.now();
      setPetting(true);
      strokes.current += 1;
      sfx.purr();
      setLove((l) => Math.min(100, l + 6));
      clearTimeout(askTimer.current);
      clearTimeout(endTimer.current);

      if (now - lastGain.current > 1500) {
        lastGain.current = now;
        petStat();
      }
      if (x !== undefined && y !== undefined && now - lastHeart.current > 180) {
        lastHeart.current = now;
        const id = heartId.current++;
        setHearts((h) => [...h.slice(-10), { id, x, y }]);
        sfx.heart();
        setTimeout(() => setHearts((h) => h.filter((p) => p.id !== id)), 1100);
      }
      if (strokes.current === 1 || strokes.current % 6 === 0) {
        say(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
      }

      endTimer.current = setTimeout(() => {
        setPetting(false);
        const total = strokes.current;
        strokes.current = 0;
        if (total >= 3) {
          askTimer.current = setTimeout(() => {
            say(ASK_MORE[Math.floor(Math.random() * ASK_MORE.length)], 2200);
            sfx.beg();
          }, 700);
        }
      }, 900);
    },
    [petStat, say],
  );

  useEffect(() => {
    const id = setInterval(() => setLove((l) => Math.max(0, l - 4)), 600);
    return () => {
      clearInterval(id);
      clearTimeout(endTimer.current);
      clearTimeout(askTimer.current);
      clearTimeout(bubbleTimer.current);
    };
  }, []);

  const local = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      down.current = true;
      travel.current = 0;
      lastPt.current = { x: e.clientX, y: e.clientY };
      const p = local(e);
      stroke(p.x, p.y);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const prev = lastPt.current;
      lastPt.current = { x: e.clientX, y: e.clientY };
      if (!prev) return;
      const isStroking = down.current || e.pointerType === 'mouse';
      if (!isStroking) return;
      travel.current += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      const need = down.current ? 30 : 60;
      if (travel.current > need) {
        travel.current = 0;
        const p = local(e);
        stroke(p.x, p.y);
      }
    },
    onPointerUp: () => {
      down.current = false;
    },
    onPointerLeave: () => {
      down.current = false;
      lastPt.current = null;
    },
  };

  return { petting, bubble, hearts, love, handlers };
}

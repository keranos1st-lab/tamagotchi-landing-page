import type { ReactNode } from 'react';
import Icon from '@/components/ui/icon';
import { usePetStore } from '@/store/petStore';
import type { PetAnim } from './sprites';
import { ACTION_SFX } from './sound';

export function PillButton({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 active:scale-90 transition"
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

export function PetActionPill({ onAction, extra }: { onAction: (a: PetAnim) => void; extra?: ReactNode }) {
  const { feed, play, sleep, train } = usePetStore();

  const actions: { icon: string; title: string; anim: PetAnim; fn: () => void }[] = [
    { icon: 'Utensils', title: 'Покормить', anim: 'eat', fn: feed },
    { icon: 'Gamepad2', title: 'Играть', anim: 'play', fn: play },
    { icon: 'Moon', title: 'Спать', anim: 'sleep', fn: sleep },
    { icon: 'BookOpen', title: 'Учиться', anim: 'study', fn: train },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-white px-1.5 py-1 shadow-xl">
      {actions.map((a) => (
        <PillButton
          key={a.title}
          icon={a.icon}
          title={a.title}
          onClick={() => {
            a.fn();
            onAction(a.anim);
            ACTION_SFX[a.anim]?.();
          }}
        />
      ))}
      {extra && (
        <>
          <span className="mx-0.5 h-5 w-px bg-slate-200" />
          {extra}
        </>
      )}
    </div>
  );
}

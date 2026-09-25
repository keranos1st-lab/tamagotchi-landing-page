import Icon from '@/components/ui/icon';
import { RARITY, type Achievement } from './catalog';

export function Medal({ a, unlocked, size = 48, progress = 0 }: { a: Achievement; unlocked: boolean; size?: number; progress?: number }) {
  const r = RARITY[a.rarity];
  const secret = a.hidden && !unlocked;
  const R = size / 2 - 2;
  const C = 2 * Math.PI * R;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {!unlocked && progress > 0 && (
        <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke={r.glow}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
          />
        </svg>
      )}
      <div
        className={`ach-medal absolute grid place-items-center rounded-full ${unlocked ? `bg-gradient-to-br ${r.grad} ach-medal-on ach-${a.rarity}` : 'bg-white/[0.05] border border-white/10'}`}
        style={{
          inset: unlocked ? 0 : 5,
          boxShadow: unlocked ? `0 0 18px -2px ${r.glow}, inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 6px rgba(0,0,0,0.25)` : undefined,
        }}
      >
        {unlocked && <span className="absolute inset-[3px] rounded-full border border-white/35" />}
        <Icon
          name={secret ? 'HelpCircle' : unlocked ? a.icon : a.icon}
          fallback="Award"
          size={Math.round(size * (unlocked ? 0.44 : 0.38))}
          className={unlocked ? 'relative text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]' : 'text-white/30'}
        />
      </div>
      {!unlocked && (
        <div className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border border-white/10 bg-[#1a1333]">
          <Icon name="Lock" size={9} className="text-white/45" />
        </div>
      )}
    </div>
  );
}

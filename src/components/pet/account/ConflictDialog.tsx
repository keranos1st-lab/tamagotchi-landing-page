import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import type { PetType } from '@/store/petStore';
import { localSummary, resolveConflict, summarize, useSyncStore } from '@/sync/cloudSync';
import { PET_ICONS } from '../sprites';

function Card({ title, icon, s, onPick, accent }: { title: string; icon: string; s: ReturnType<typeof summarize>; onPick: () => void; accent: string }) {
  return (
    <button onClick={onPick} className={`group rounded-2xl border bg-white/[0.04] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08] ${accent}`}>
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white/60">
        <Icon name={icon} size={13} />
        {title}
      </div>
      {s.hasPet ? (
        <div className="flex items-center gap-3">
          <img src={PET_ICONS[s.type as PetType] ?? PET_ICONS.cat} alt="" className="h-12 w-12 object-contain" />
          <div>
            <div className="font-bold">{s.name}</div>
            <div className="text-xs text-white/55">Уровень {s.level}</div>
          </div>
        </div>
      ) : (
        <div className="py-3 text-sm text-white/45">Питомца нет</div>
      )}
      <div className="mt-3 flex gap-3 text-[11px] text-white/50">
        <span className="flex items-center gap-1">
          <Icon name="Trophy" size={11} /> {s.unlocked} наград
        </span>
        <span className="flex items-center gap-1">
          <Icon name="BookHeart" size={11} /> {s.memory} в памяти
        </span>
      </div>
      <div className="mt-3 rounded-xl bg-white/10 py-1.5 text-center text-xs font-bold text-white group-hover:bg-white/20">Оставить это</div>
    </button>
  );
}

export function ConflictDialog() {
  const conflict = useSyncStore((s) => s.conflict);
  if (!conflict) return null;
  const cloud = summarize(conflict.server.pet, conflict.server.achievements, conflict.server.memory);
  const local = localSummary();

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="ach-dialog max-w-lg border-white/10 text-white [&>button]:hidden">
        <DialogTitle className="font-display text-xl font-bold">Какое сохранение оставить?</DialogTitle>
        <DialogDescription className="text-sm text-white/55">
          {conflict.reason === 'login'
            ? 'В аккаунте уже есть сохранение, а на этом устройстве — другой прогресс. Второе будет заменено.'
            : 'Пока это устройство было неактивно, прогресс изменился на другом устройстве. Выберите, какой вариант оставить.'}
        </DialogDescription>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Card title="В облаке" icon="Cloud" s={cloud} onPick={() => resolveConflict('cloud')} accent="border-cyan-300/30" />
          <Card title="На этом устройстве" icon="Smartphone" s={local} onPick={() => resolveConflict('local')} accent="border-pink-300/30" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

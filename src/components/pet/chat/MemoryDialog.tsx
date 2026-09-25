import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { MEMORY_LIMIT, useMemoryStore, type MemoryCategory } from '@/store/memoryStore';

const CATS: Record<MemoryCategory, { label: string; icon: string; tone: string }> = {
  name: { label: 'Имя', icon: 'User', tone: 'text-pink-200 bg-pink-400/15 border-pink-300/25' },
  goal: { label: 'Цель', icon: 'Target', tone: 'text-amber-200 bg-amber-400/15 border-amber-300/25' },
  preference: { label: 'Предпочтение', icon: 'Heart', tone: 'text-cyan-200 bg-cyan-400/15 border-cyan-300/25' },
  other: { label: 'Другое', icon: 'Bookmark', tone: 'text-violet-200 bg-violet-400/15 border-violet-300/25' },
};

export function MemoryDialog({ open, onOpenChange, petName }: { open: boolean; onOpenChange: (v: boolean) => void; petName: string }) {
  const { consent, items, setConsent, add, update, remove, clear } = useMemoryStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState<MemoryCategory>('other');
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState<MemoryCategory>('goal');

  const startEdit = (id: string, text: string, cat: MemoryCategory) => {
    setEditing(id);
    setDraft(text);
    setDraftCat(cat);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="ach-dialog max-h-[88vh] max-w-lg gap-0 overflow-hidden border-white/10 p-0 text-white">
        <div className="border-b border-white/10 p-5">
          <DialogTitle className="font-display flex items-center gap-2 text-xl font-bold">
            <Icon name="BookHeart" size={20} className="text-pink-300" />
            Что {petName} помнит о тебе
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/55">
            Эти пункты передаются AI вместе с сообщениями, чтобы ответы были личнее. Хранятся только в этом браузере.
          </DialogDescription>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-sm">
              <div className="font-bold">Разрешить запоминать</div>
              <div className="text-xs text-white/50">
                {consent ? 'Питомец будет предлагать запомнить факты — каждый сохраняется только после вашего «Да»' : 'Питомец ничего не запоминает и не передаёт AI'}
              </div>
            </div>
            <button
              onClick={() => setConsent(!consent)}
              role="switch"
              aria-checked={!!consent}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${consent ? 'bg-gradient-to-r from-violet-500 to-pink-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${consent ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="max-h-[46vh] space-y-2 overflow-y-auto p-5">
          {items.length === 0 && <div className="py-6 text-center text-sm text-white/45">Пока пусто</div>}
          {items.map((it) => {
            const c = CATS[it.category];
            const isEdit = editing === it.id;
            return (
              <div key={it.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
                {isEdit ? (
                  <div className="space-y-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value.slice(0, 200))}
                      autoFocus
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm focus:border-pink-300/50 focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(Object.keys(CATS) as MemoryCategory[]).map((k) => (
                        <button
                          key={k}
                          onClick={() => setDraftCat(k)}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${draftCat === k ? CATS[k].tone : 'border-white/10 text-white/50'}`}
                        >
                          {CATS[k].label}
                        </button>
                      ))}
                      <div className="ml-auto flex gap-1.5">
                        <button onClick={() => setEditing(null)} className="rounded-lg px-2.5 py-1 text-xs font-bold text-white/60 hover:text-white">
                          Отмена
                        </button>
                        <button
                          onClick={() => {
                            update(it.id, draft, draftCat);
                            setEditing(null);
                          }}
                          className="rounded-lg bg-pink-500 px-2.5 py-1 text-xs font-bold text-white"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${c.tone}`}>
                      <Icon name={c.icon} size={10} />
                      {c.label}
                    </span>
                    <div className="min-w-0 flex-1 text-sm text-white/90">{it.text}</div>
                    <button onClick={() => startEdit(it.id, it.text, it.category)} className="text-white/40 hover:text-white" title="Исправить">
                      <Icon name="Pencil" size={14} />
                    </button>
                    <button onClick={() => remove(it.id)} className="text-white/40 hover:text-rose-300" title="Удалить">
                      <Icon name="Trash2" size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-white/10 p-5">
          {consent ? (
            <>
              <div className="flex gap-2">
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as MemoryCategory)}
                  className="rounded-xl border border-white/10 bg-black/30 px-2 text-xs text-white focus:outline-none"
                >
                  {(Object.keys(CATS) as MemoryCategory[]).map((k) => (
                    <option key={k} value={k} className="bg-[#1a1333]">
                      {CATS[k].label}
                    </option>
                  ))}
                </select>
                <input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value.slice(0, 200))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newText.trim()) {
                      add(newText, newCat);
                      setNewText('');
                    }
                  }}
                  placeholder="Например: Меня зовут Аня"
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-pink-300/40 focus:outline-none"
                />
                <button
                  disabled={!newText.trim() || items.length >= MEMORY_LIMIT}
                  onClick={() => {
                    add(newText, newCat);
                    setNewText('');
                  }}
                  className="btn-neon !h-10 !w-10 !p-0 !rounded-xl disabled:opacity-40"
                  title="Добавить"
                >
                  <Icon name="Plus" size={18} />
                </button>
              </div>
              <div className="flex justify-between text-[11px] text-white/40">
                <span>
                  {items.length} / {MEMORY_LIMIT} пунктов
                </span>
                {items.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm('Удалить всё, что питомец помнит?')) clear();
                    }}
                    className="font-bold text-rose-300/80 hover:text-rose-200"
                  >
                    Забыть всё
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-xs text-white/45">
              {items.length > 0 ? 'Запоминание выключено: сохранённые пункты не передаются AI, пока вы его не включите.' : 'Включите запоминание, чтобы добавлять факты.'}
              {items.length > 0 && (
                <button onClick={() => clear()} className="ml-1 font-bold text-rose-300/80 hover:text-rose-200">
                  Удалить сохранённое
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useAuthStore } from '@/store/authStore';
import { useNoteDraft } from '@/store/noteDraftStore';
import { defaultDueLocal, formatDue, listNotes, newRequestId, NOTES_CHANGED, NOTES_OPEN, notifyNotesChanged, setReminder, type Note, type NotesErr } from '@/utils/notesApi';
import { openSettings } from '../account/AccountButton';
import { NoteEditor } from './NoteEditor';

type View = 'list' | 'read' | 'edit';
type Status = 'loading' | 'ready' | 'error';

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export function NotesDialog() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const token = useAuthStore((s) => s.token);
  const draft = useNoteDraft();
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<NotesErr | null>(null);
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [current, setCurrent] = useState<Note | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [remBusy, setRemBusy] = useState(false);
  const [remError, setRemError] = useState<string | null>(null);
  const seq = useRef(0);
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async (q: string, offset = 0) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    const my = ++seq.current;
    if (offset === 0) setStatus((s) => (s === 'ready' ? s : 'loading'));
    else setMoreBusy(true);
    try {
      const res = await listNotes({ query: q, offset, signal: c.signal });
      if (my !== seq.current) return;
      setMoreBusy(false);
      if (!res.ok) {
        setError(res);
        setStatus('error');
        return;
      }
      setError(null);
      setNotes((prev) => (offset === 0 ? res.notes : [...prev, ...res.notes.filter((n) => !prev.some((p) => p.id === n.id))]));
      setTotal(res.total);
      setHasMore(res.hasMore);
      setStatus('ready');
      setCurrent((cur) => (cur ? res.notes.find((n) => n.id === cur.id) ?? cur : cur));
    } catch {
      /* отменено новым запросом */
    }
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setView(useNoteDraft.getState().active ? 'edit' : 'list');
    };
    window.addEventListener(NOTES_OPEN, onOpen);
    return () => window.removeEventListener(NOTES_OPEN, onOpen);
  }, []);

  useEffect(() => {
    if (!open || !token) return;
    load(applied);
    const onChanged = () => load(applied);
    window.addEventListener(NOTES_CHANGED, onChanged);
    const onVisible = () => document.visibilityState === 'visible' && load(applied);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(NOTES_CHANGED, onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, token, applied, load]);

  useEffect(() => {
    if (!open) ctrl.current?.abort();
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setApplied(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const startEdit = (note: Note | null, withReminder = false) => {
    setRemError(null);
    draft.begin(note, withReminder ? { dueLocal: '', tz: '', lead: 15 } : null);
    if (withReminder) useNoteDraft.getState().setDue(defaultDueLocal());
    setView('edit');
  };

  const leaveEditor = () => {
    const back = useNoteDraft.getState().id !== null && current ? 'read' : 'list';
    useNoteDraft.getState().discard();
    setView(back);
  };

  const onSaved = (note: Note) => {
    setCurrent(note);
    setView('read');
    load(applied);
  };

  const disableReminder = async (note: Note) => {
    if (remBusy) return;
    setRemBusy(true);
    setRemError(null);
    const res = await setReminder({ id: note.id, reminder: null, requestId: newRequestId() });
    setRemBusy(false);
    if (!res.ok) {
      setRemError(res.message);
      return;
    }
    setCurrent(res.note);
    notifyNotesChanged();
  };

  const loggedOut = !token;
  const searching = applied.length > 0;
  const title = view === 'edit' ? (draft.id ? 'Редактирование' : 'Новая заметка') : view === 'read' ? `Заметка №${current?.id ?? ''}` : 'Заметки';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="ach-dialog flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-white/10 p-0 text-white sm:h-auto sm:max-h-[88vh] sm:min-h-[420px] sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3.5 pr-12 sm:px-5">
          {view !== 'list' && (
            <button onClick={() => (view === 'edit' ? leaveEditor() : setView('list'))} aria-label="Назад" className="icon-btn -ml-1 shrink-0">
              <Icon name="ArrowLeft" size={17} />
            </button>
          )}
          <DialogTitle className="font-display flex items-center gap-2 text-lg font-bold">
            <Icon name="NotebookPen" size={18} className="text-pink-300" />
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">Личные заметки аккаунта PetAgent</DialogDescription>
        </div>

        {loggedOut ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Icon name="LogIn" size={30} className="text-white/50" />
            <div className="font-bold">Войди в аккаунт, чтобы видеть заметки</div>
            <div className="text-sm text-white/50">Заметки хранятся в аккаунте и общие для сайта, десктопа и Android.</div>
            <button
              onClick={() => {
                setOpen(false);
                openSettings('account');
              }}
              className="mt-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-extrabold"
            >
              Войти
            </button>
          </div>
        ) : view === 'edit' ? (
          <NoteEditor onSaved={onSaved} onCancel={leaveEditor} />
        ) : view === 'read' && current ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{current.text}</div>
              {current.reminder && (
                <div className={`rounded-2xl border px-3 py-2.5 text-sm ${current.reminder.state === 'done' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/25 bg-amber-400/10 text-amber-100'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    <Icon name={current.reminder.state === 'done' ? 'CircleCheck' : 'BellRing'} size={15} />
                    {current.reminder.state === 'done' ? 'Напоминание выполнено' : 'Напоминание'}
                  </div>
                  <div className="mt-1 text-xs opacity-85">
                    {formatDue(current.reminder)}
                    {current.reminder.state === 'active' && `, напомню ${current.reminder.leadText}`}
                  </div>
                  {current.reminder.state === 'active' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => startEdit(current)} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20">
                        Изменить время
                      </button>
                      <button onClick={() => disableReminder(current)} disabled={remBusy} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20 disabled:opacity-50">
                        {remBusy ? 'Отключаю…' : 'Отключить'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!current.reminder && (
                <button onClick={() => startEdit(current, true)} className="flex items-center gap-2 rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs font-bold text-white/60 hover:text-white">
                  <Icon name="BellPlus" size={14} />
                  Добавить напоминание
                </button>
              )}
              {remError && (
                <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  {remError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
              <span className="text-xs text-white/40">
                {fmt(current.updatedAt)} · версия {current.version}
              </span>
              <button onClick={() => startEdit(current)} className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-sm font-bold hover:bg-white/10">
                <Icon name="Pencil" size={15} />
                Изменить
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-4 pt-4 sm:px-5">
              <div className="relative flex-1">
                <Icon name="Search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value.slice(0, 200))}
                  placeholder="Поиск по заметкам"
                  className="w-full rounded-xl border border-white/15 bg-black/30 py-2 pl-9 pr-8 text-sm placeholder:text-white/35 focus:border-pink-300/50 focus:outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="Очистить поиск" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/45 hover:text-white">
                    <Icon name="X" size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => startEdit(null)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 px-3.5 py-2 text-sm font-extrabold shadow-[0_8px_24px_-8px_rgba(236,72,153,0.7)]"
              >
                <Icon name="Plus" size={15} />
                Новая
              </button>
            </div>

            {draft.active && draft.text && (
              <button onClick={() => setView('edit')} className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-left text-xs text-amber-200 sm:mx-5">
                <Icon name="PenLine" size={14} />
                Есть несохранённый текст — открыть
              </button>
            )}

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 sm:p-5">
              {status === 'loading' && (
                <div className="space-y-2" aria-label="Загрузка">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.06]" />
                  ))}
                </div>
              )}
              {status === 'error' && error && (
                <div role="alert" className="space-y-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">
                  <div className="flex items-start gap-2">
                    <Icon name="TriangleAlert" size={16} className="mt-0.5 shrink-0" />
                    {error.message}
                  </div>
                  {error.code === 'notes_login' ? (
                    <button onClick={() => openSettings('account')} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold">
                      Войти
                    </button>
                  ) : (
                    <button onClick={() => load(applied)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold">
                      Повторить
                    </button>
                  )}
                </div>
              )}
              {status === 'ready' && notes.length === 0 && (
                <div className="py-10 text-center text-sm text-white/50">
                  <Icon name={searching ? 'SearchX' : 'NotebookPen'} size={28} className="mx-auto mb-2 text-white/30" />
                  {searching ? 'Ничего не найдено' : 'Заметок пока нет. Нажми «Новая» или скажи: «запиши в блокнот …»'}
                </div>
              )}
              {status === 'ready' &&
                notes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setCurrent(n);
                      setView('read');
                    }}
                    className="block w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
                  >
                    <div className="line-clamp-2 break-words text-sm">{n.text}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/40">
                      <span>
                        №{n.id} · {fmt(n.updatedAt)}
                      </span>
                      {n.reminder && n.reminder.state === 'active' && (
                        <span className="flex items-center gap-1 text-amber-200/90">
                          <Icon name="BellRing" size={11} />
                          {n.reminder.when.split(', ').slice(1).join(', ')}
                        </span>
                      )}
                      {n.reminder && n.reminder.state === 'done' && (
                        <span className="flex items-center gap-1 text-emerald-300/80">
                          <Icon name="CircleCheck" size={11} />
                          выполнено
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              {status === 'ready' && hasMore && (
                <button onClick={() => load(applied, notes.length)} disabled={moreBusy} className="w-full rounded-xl border border-white/10 py-2 text-sm font-bold text-white/70 hover:text-white disabled:opacity-50">
                  {moreBusy ? 'Загружаю…' : `Показать ещё (${total - notes.length})`}
                </button>
              )}
            </div>
            {status === 'ready' && total > 0 && (
              <div className="border-t border-white/10 px-4 py-2 text-center text-[11px] text-white/40 sm:px-5">
                {searching ? `Найдено: ${total}` : `Всего заметок: ${total}`}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

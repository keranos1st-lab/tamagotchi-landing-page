import { useState, useRef, useEffect } from 'react';
import { usePetStore, type ChatMessage, type TextAction } from '@/store/petStore';
import { useMemoryStore } from '@/store/memoryStore';
import { askPet, MAX_MESSAGE } from '@/utils/petAi';
import { useAiStatus, useAiStatusStore } from '@/store/aiStatusStore';
import Icon from '@/components/ui/icon';
import { PET_ICONS } from './sprites';
import { PetSprite } from './PetSprite';
import { Chip } from './ui';
import { useThinkingStore } from '@/store/thinkingStore';
import { track } from '@/store/achievementStore';
import { THINK_POSES, thinkingAnim, toneClass } from './thinking';
import { MessageBubble } from './chat/MessageBubble';
import { TextHelper } from './chat/TextHelper';
import { MemoryDialog } from './chat/MemoryDialog';

const QUICK = ['Привет! Что ты умеешь?', 'Помоги составить план на день', 'Объясни простыми словами, что такое API', 'Мотивируй меня'];

export function PetChat() {
  const chatHistory = usePetStore((s) => s.chatHistory);
  const name = usePetStore((s) => s.name);
  const type = usePetStore((s) => s.type);
  const stage = usePetStore((s) => s.stage);
  const { addChatMessage, removeChatMessage, clearChat, earn } = usePetStore.getState();
  const memory = useMemoryStore();

  const [input, setInput] = useState('');
  const [busy, setBusyLocal] = useState(false);
  const status = useAiStatus();
  const { patch: patchStatus, refresh: refreshStatus } = useAiStatusStore.getState();
  const [helperOpen, setHelperOpen] = useState(false);
  const [picked, setPicked] = useState('');
  const [memOpen, setMemOpen] = useState(false);
  const setThinking = useThinkingStore((s) => s.setThinking);
  const setBusy = (v: boolean) => {
    setBusyLocal(v);
    setThinking(v);
  };

  useEffect(() => () => setThinking(false), [setThinking]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chatHistory.length, busy]);

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      const node = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement;
      if (node?.closest('[data-pet-chat-input]')) return;
      if (text.length >= 8) setPicked(text.slice(0, 6500));
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const run = async (message: string, task?: { action: TextAction; source: string }) => {
    const state = usePetStore.getState();
    const history = state.chatHistory;
    const mem = useMemoryStore.getState();
    setBusy(true);
    const res = await askPet({
      pet: state,
      history: history.slice(0, -1),
      memory: mem.consent ? mem.items.map((i) => i.text) : [],
      message,
      task,
    });
    if (res.ok) {
      addChatMessage('pet', res.truncated ? `${res.reply}\n\n_(ответ обрезан по длине — попроси продолжить)_` : res.reply, { kind: 'ai', task });
      earn(task ? 'help' : 'chat', task ? 6 : 3);
      useThinkingStore.getState().cheer();
      if (res.remember) mem.propose(res.remember);
      if (res.remainingToday !== undefined) {
        const cur = useAiStatusStore.getState().status;
        patchStatus({ remainingToday: res.remainingToday, usedToday: cur?.limits ? cur.limits.perDay - res.remainingToday : cur?.usedToday });
      }
    } else {
      addChatMessage('pet', '', {
        kind: 'error',
        error: { code: res.code, message: res.message, retryable: res.retryable },
        retry: { message, task },
      });
      if (res.code === 'no_key' || res.code === 'no_function') patchStatus({ configured: false });
      else if (res.code === 'daily_user') patchStatus({ remainingToday: 0 });
      else if (res.code === 'budget') patchStatus({ budgetOk: false });
      else refreshStatus();
    }
    setBusy(false);
  };

  const send = (text: string) => {
    const msg = text.trim();
    if (!msg || busy || msg.length > MAX_MESSAGE) return;
    setInput('');
    addChatMessage('user', msg);
    track.bump('chat');
    run(msg);
  };

  const runTask = (action: TextAction, source: string, note: string) => {
    if (busy) return;
    setHelperOpen(false);
    setPicked('');
    window.getSelection()?.removeAllRanges();
    addChatMessage('user', note, { kind: 'task', task: { action, source } });
    track.bump('chat');
    run(note, { action, source });
  };

  const retry = (m: ChatMessage) => {
    if (!m.retry || busy) return;
    removeChatMessage(m.id);
    run(m.retry.message, m.retry.task);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const notConfigured = status?.configured === false;
  const outOfQuota = status?.remainingToday === 0;
  const tooLong = input.length > MAX_MESSAGE;
  const locked = busy || notConfigured;

  return (
    <div className="glass flex h-[560px] flex-col overflow-hidden sm:h-[600px]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/40 to-pink-500/30">
              <img src={PET_ICONS[type]} alt="" className="h-8 w-8 object-contain" />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[#12102b] ${notConfigured ? 'bg-rose-400' : status === null ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-white">{name}</div>
            <div className={`truncate text-xs ${notConfigured ? 'text-rose-300' : 'text-emerald-300/80'}`}>
              {busy ? THINK_POSES[type].label.replace(/^Кодик /, '') : notConfigured ? 'AI не подключён' : status === null ? 'статус AI неизвестен' : 'AI-помощник'}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {status?.remainingToday !== undefined && (
            <Chip className={outOfQuota ? '!text-rose-200' : '!text-cyan-200'}>
              <Icon name="MessageSquare" size={12} />
              {status.remainingToday}/{status.limits?.perDay}
            </Chip>
          )}
          <button onClick={() => setMemOpen(true)} className="icon-btn !h-9 !w-9 relative" title="Память питомца">
            <Icon name="BookHeart" size={16} />
            {memory.consent && memory.items.length > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-pink-500 px-1 text-[9px] font-extrabold">{memory.items.length}</span>
            )}
          </button>
          {chatHistory.length > 0 && (
            <button
              onClick={() => confirm('Очистить переписку? Память питомца сохранится.') && clearChat()}
              className="icon-btn !h-9 !w-9"
              title="Очистить чат"
            >
              <Icon name="Eraser" size={16} />
            </button>
          )}
        </div>
      </div>

      {notConfigured && (
        <div className="mx-3 mt-3 rounded-xl border border-rose-300/25 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-100">
          <b>AI-чат не настроен.</b> Для работы нужна серверная функция <code>pet-chat</code> и секрет <code>POLZA_AI_API_KEY</code>. Шаблонные ответы не подставляются.
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatHistory.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <PetSprite type={type} anim="wave" size={110} shadow={false} />
            <p className="mt-2 font-bold text-white">Спроси {name} о чём угодно</p>
            <p className="mt-1 max-w-sm text-xs text-white/45">
              Настоящий AI-помощник в характере питомца. Кнопка <b>«Текст»</b> — объяснить, сократить, исправить письмо или помочь с ответом.
            </p>
          </div>
        )}

        {chatHistory.map((m) => (
          <MessageBubble key={m.id} msg={m} icon={PET_ICONS[type]} onRetry={retry} busy={busy} />
        ))}

        {busy && (
          <div className="flex items-end gap-2">
            <div className="-mb-1 -ml-2 shrink-0">
              <PetSprite type={type} anim={thinkingAnim(type)} size={stage === 'baby' ? 80 : 88} shadow={false} fx={false} still />
            </div>
            <div className={`mb-2 flex items-center gap-2 rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-xs font-semibold ${toneClass(type)}`}>
              <span className="flex gap-0.5">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-70" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              <span>{type === 'cat' ? THINK_POSES[type].label : `${name} ${THINK_POSES[type].label}`}</span>
            </div>
          </div>
        )}
      </div>

      {memory.pending && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-pink-300/25 bg-pink-500/[0.08] px-3 py-2 text-xs pa-rise">
          <Icon name="BookHeart" size={14} className="text-pink-200" />
          <span className="flex-1 text-white/85">
            Запомнить: <b>«{memory.pending.text}»</b>?
          </span>
          <button onClick={memory.acceptPending} className="rounded-full bg-pink-500 px-3 py-1 font-bold text-white">
            Да
          </button>
          <button onClick={memory.dismissPending} className="rounded-full border border-white/15 px-3 py-1 font-bold text-white/70 hover:text-white">
            Нет
          </button>
        </div>
      )}

      {memory.consent === null && chatHistory.length >= 2 && !memory.pending && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-2xl border border-violet-300/25 bg-violet-500/[0.08] px-3 py-2 text-xs">
          <Icon name="BookHeart" size={14} className="text-violet-200" />
          <span className="min-w-0 flex-1 text-white/80">
            Разрешить {name} запоминать имя, цели и предпочтения?<span className="hidden sm:inline"> Каждый пункт — только с твоего согласия.</span>
          </span>
          <button onClick={() => memory.setConsent(true)} className="shrink-0 rounded-full bg-violet-500 px-3 py-1 font-bold text-white">
            Да
          </button>
          <button onClick={() => memory.setConsent(false)} className="shrink-0 rounded-full border border-white/15 px-3 py-1 font-bold text-white/70 hover:text-white">
            Нет
          </button>
        </div>
      )}

      {picked && !helperOpen && !busy && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] px-3 py-2 pa-rise">
          <Icon name="TextSelect" size={14} className="shrink-0 text-cyan-200" />
          <div className="line-clamp-1 flex-1 text-xs text-white/70">Выделено: «{picked}»</div>
          <button onClick={() => setHelperOpen(true)} className="rounded-full bg-cyan-500/80 px-3 py-1 text-xs font-bold text-white hover:bg-cyan-500">
            Помочь с текстом
          </button>
          <button onClick={() => setPicked('')} className="text-white/40 hover:text-white" title="Убрать">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}

      <TextHelper open={helperOpen} initial={picked} disabled={locked || outOfQuota} onClose={() => setHelperOpen(false)} onRun={runTask} />

      {!helperOpen && chatHistory.length === 0 && (
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 pt-1">
          {QUICK.map((q) => (
            <button
              key={q}
              disabled={locked || outOfQuota}
              onClick={() => send(q)}
              className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-pink-300/40 hover:text-white disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 pt-1" data-pet-chat-input>
        {outOfQuota && <div className="mb-1.5 text-center text-[11px] text-rose-300">Дневной лимит сообщений исчерпан — возвращайся завтра</div>}
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5 transition focus-within:border-pink-300/40">
          <button
            onClick={() => setHelperOpen((v) => !v)}
            className={`flex h-10 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-bold transition ${helperOpen ? 'bg-cyan-500/30 text-white' : 'bg-white/[0.06] text-cyan-200 hover:bg-white/10'}`}
            title="Помощь с текстом"
          >
            <Icon name="FileText" size={15} />
            <span className="hidden sm:inline">Текст</span>
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={notConfigured}
            placeholder={notConfigured ? 'AI-чат не настроен' : 'Спроси у питомца…'}
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
          <button onClick={() => send(input)} disabled={!input.trim() || locked || tooLong || outOfQuota} className="btn-neon !h-10 !w-10 !rounded-xl !p-0" title="Отправить">
            <Icon name="ArrowUp" size={18} />
          </button>
        </div>
        {input.length > MAX_MESSAGE * 0.8 && (
          <div className={`mt-1 text-right text-[11px] ${tooLong ? 'font-bold text-rose-300' : 'text-white/40'}`}>
            {input.length} / {MAX_MESSAGE}
            {tooLong && ' — для длинных текстов используй кнопку «Текст»'}
          </div>
        )}
      </div>

      <MemoryDialog open={memOpen} onOpenChange={setMemOpen} petName={name} />
    </div>
  );
}

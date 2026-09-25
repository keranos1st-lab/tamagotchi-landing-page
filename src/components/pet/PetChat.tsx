import { useState, useRef, useEffect } from 'react';
import { usePetStore } from '@/store/petStore';
import { generatePetResponse } from '@/utils/aiAgent';
import { askPet, type SelectionAction } from '@/utils/petAi';
import { RichText } from './RichText';
import Icon from '@/components/ui/icon';
import { PET_ICONS } from './sprites';
import { PetSprite } from './PetSprite';
import { Chip } from './ui';
import { useThinkingStore } from '@/store/thinkingStore';
import { track } from '@/store/achievementStore';
import { THINK_POSES, thinkingAnim, toneClass } from './thinking';

export function PetChat() {
  const { chatHistory, addChatMessage, name, type, intelligence, level } = usePetStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTypingLocal] = useState(false);
  const setThinking = useThinkingStore((s) => s.setThinking);
  const setIsTyping = (v: boolean) => {
    setIsTypingLocal(v);
    setThinking(v);
  };

  useEffect(() => () => setThinking(false), [setThinking]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const [offline, setOffline] = useState<string | null>(null);
  const [picked, setPicked] = useState('');

  const send = async (text: string, shown: string, opts: { selection?: string; action?: SelectionAction } = {}) => {
    if (isTyping) return;
    addChatMessage('user', shown);
    track.bump('chat');
    setIsTyping(true);
    const started = Date.now();
    const res = await askPet(usePetStore.getState(), text, opts);
    const wait = Math.max(0, 1400 - (Date.now() - started));
    setTimeout(() => {
      if (res.ok) {
        setOffline(null);
        addChatMessage('pet', res.reply);
      } else {
        setOffline(res.error);
        addChatMessage('pet', generatePetResponse(opts.selection ? `совет ${opts.selection}` : text, name, type, intelligence, level));
      }
      setIsTyping(false);
    }, wait);
  };

  const handleSend = () => {
    const userMessage = input.trim();
    if (!userMessage || isTyping) return;
    setInput('');
    send(userMessage, userMessage);
  };

  const runSelection = (action: SelectionAction) => {
    const sel = picked.trim();
    if (!sel) return;
    const labels: Record<SelectionAction, string> = { explain: 'Объясни', fix: 'Исправь', shorten: 'Сократи', advice: 'Дай совет по' };
    const preview = sel.length > 160 ? `${sel.slice(0, 160)}…` : sel;
    setPicked('');
    window.getSelection()?.removeAllRanges();
    send(sel, `${labels[action]} текст:\n«${preview}»`, { selection: sel, action });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    'Привет!',
    'Дай совет',
    'Помоги с кодом',
    'Как учиться?',
    'Мотивация',
  ];

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      const node = sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement;
      if (node?.closest('[data-pet-chat-input]')) return;
      if (text.length >= 8) setPicked(text.slice(0, 6000));
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  return (
    <div className="glass flex h-[460px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500/40 to-pink-500/30 border border-white/10">
              <img src={PET_ICONS[type]} alt="" className="h-8 w-8 object-contain" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#12102b]" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-white">{name}</div>
            <div className="text-xs text-emerald-300/80">{isTyping ? THINK_POSES[type].label.replace(/^Кодик /, '') : 'в сети · AI-агент'}</div>
          </div>
        </div>
        <Chip className="!text-cyan-200">
          <Icon name="Brain" size={12} />
          IQ {Math.round(intelligence)}
        </Chip>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatHistory.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/20 border border-white/10">
              <Icon name="Sparkles" size={24} className="text-pink-200" />
            </div>
            <p className="mt-3 font-bold text-white">Напиши {name} что-нибудь</p>
            <p className="mt-1 max-w-xs text-xs text-white/45">Чем выше IQ — тем подробнее ответы. Выдели текст на странице — и питомец его объяснит или исправит</p>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} pa-rise`}>
            {msg.role === 'pet' && (
              <img src={PET_ICONS[type]} alt="" className="mb-1 h-7 w-7 shrink-0 rounded-lg bg-white/5 object-contain p-0.5" />
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'rounded-br-md bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-[0_8px_20px_-8px_rgba(236,72,153,0.6)]'
                  : 'rounded-bl-md border border-white/[0.08] bg-white/[0.06] text-white/90'
              }`}
            >
              {msg.role === 'pet' ? <RichText text={msg.text} /> : msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-end gap-2">
            <div className="-mb-1 -ml-2 shrink-0">
              <PetSprite type={type} anim={thinkingAnim(type)} size={88} shadow={false} fx={false} still />
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
        <div ref={chatEndRef} />
      </div>

      {picked && !isTyping && (
        <div className="mx-3 mb-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] p-2.5 pa-rise">
          <div className="mb-2 flex items-start gap-2">
            <Icon name="TextSelect" size={14} className="mt-0.5 shrink-0 text-cyan-200" />
            <div className="line-clamp-2 flex-1 text-xs text-white/70">«{picked}»</div>
            <button onClick={() => setPicked('')} className="text-white/40 hover:text-white" title="Убрать">
              <Icon name="X" size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              ['explain', 'Объяснить', 'Lightbulb'],
              ['fix', 'Исправить', 'SpellCheck'],
              ['shorten', 'Сократить', 'Scissors'],
              ['advice', 'Совет', 'Sparkles'],
            ] as [SelectionAction, string, string][]).map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => runSelection(id)}
                className="flex items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/25"
              >
                <Icon name={icon} size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {offline && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/[0.08] px-3 py-1.5 text-[11px] text-amber-100/90">
          <Icon name="WifiOff" size={12} />
          {offline === 'no_key' ? 'Умный режим ещё не подключён — отвечаю заготовками' : offline === 'no_balance' ? 'На сервисе ИИ закончился баланс — отвечаю заготовками' : 'ИИ временно недоступен — отвечаю заготовками'}
        </div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2 pt-1">
        {quickQuestions.map((q) => (
          <button
            key={q}
            onClick={() => {
              setInput(q);
              inputRef.current?.focus();
            }}
            className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-pink-300/40 hover:text-white"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="p-3 pt-1">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5 focus-within:border-pink-300/40 transition">
          <input
            data-pet-chat-input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Спроси у питомца…"
            className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="btn-neon !h-10 !w-10 !p-0 !rounded-xl"
            title="Отправить"
          >
            <Icon name="ArrowUp" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

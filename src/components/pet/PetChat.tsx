import { useState, useRef, useEffect } from 'react';
import { usePetStore } from '@/store/petStore';
import { generatePetResponse } from '@/utils/aiAgent';
import Icon from '@/components/ui/icon';
import { PET_ICONS } from './sprites';
import { PetSprite } from './PetSprite';
import { Chip } from './ui';
import { useThinkingStore } from '@/store/thinkingStore';

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

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    addChatMessage('user', userMessage);
    setIsTyping(true);

    // Simulate thinking time based on intelligence
    const thinkTime = Math.max(type === 'cat' ? 1800 : 500, 2000 - intelligence * 15);
    
    setTimeout(() => {
      const response = generatePetResponse(userMessage, name, type, intelligence, level);
      addChatMessage('pet', response);
      setIsTyping(false);
    }, thinkTime);
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

  // Get selected text from page
  const handleSendSelection = () => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim()) {
      setInput(`Проанализируй этот текст и дай совет: "${selection.trim()}"`);
      inputRef.current?.focus();
    }
  };

  // Listen for selection
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()?.toString();
      if (selection && selection.trim().length > 5) {
        // Could show a floating button here
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
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
            <div className="text-xs text-emerald-300/80">{isTyping ? (type === 'cat' ? 'пишет код…' : 'печатает…') : 'в сети · AI-агент'}</div>
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
            <p className="mt-1 text-xs text-white/45">Чем выше интеллект — тем умнее ответы</p>
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
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && type === 'cat' && (
          <div className="flex items-end gap-2">
            <div className="-mb-1 -ml-2 shrink-0">
              <PetSprite type="cat" anim="trick" size={88} shadow={false} fx={false} still />
            </div>
            <div className="mb-2 flex items-center gap-2 rounded-2xl rounded-bl-md border border-cyan-300/20 bg-cyan-400/[0.07] px-3.5 py-2.5 font-mono text-xs text-cyan-200">
              <span className="animate-pulse">{'</>'}</span>
              <span>Кодик пишет код…</span>
            </div>
          </div>
        )}
        {isTyping && type !== 'cat' && (
          <div className="flex items-end gap-2">
            <img src={PET_ICONS[type]} alt="" className="mb-1 h-7 w-7 shrink-0 rounded-lg bg-white/5 object-contain p-0.5" />
            <div className="flex gap-1 rounded-2xl rounded-bl-md border border-white/[0.08] bg-white/[0.06] px-4 py-3.5">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-pink-300" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

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
        <button
          onClick={handleSendSelection}
          title="Выделите текст на странице и нажмите, чтобы отправить питомцу"
          className="flex items-center gap-1 whitespace-nowrap rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
        >
          <Icon name="TextSelect" size={12} />
          Выделенное
        </button>
      </div>

      <div className="p-3 pt-1">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5 focus-within:border-pink-300/40 transition">
          <input
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

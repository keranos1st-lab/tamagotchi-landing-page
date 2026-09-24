import { useState, useRef, useEffect } from 'react';
import { usePetStore } from '@/store/petStore';
import { generatePetResponse } from '@/utils/aiAgent';

export function PetChat() {
  const { chatHistory, addChatMessage, name, type, intelligence, level } = usePetStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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
    const thinkTime = Math.max(500, 2000 - intelligence * 15);
    
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
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-purple-500/20 flex flex-col h-[400px]">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-purple-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white font-medium text-sm">AI-Агент {name}</span>
        </div>
        <span className="text-xs text-purple-300 bg-purple-900/50 px-2 py-1 rounded-full">
          IQ: {intelligence}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-purple-200 text-sm">
              Напиши {name} что-нибудь!
            </p>
            <p className="text-purple-400 text-xs mt-1">
              Чем выше интеллект — тем лучше советы
            </p>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : 'bg-slate-700 text-purple-100 rounded-bl-sm border border-purple-500/20'
              }`}
            >
              {msg.role === 'pet' && (
                <div className="text-xs text-purple-400 mb-1 font-medium">{name}</div>
              )}
              <div className="text-sm whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 border border-purple-500/20">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick questions & selection button */}
      <div className="px-4 py-2 border-t border-purple-500/10 flex gap-2 overflow-x-auto items-center">
        {quickQuestions.map((q) => (
          <button
            key={q}
            onClick={() => {
              setInput(q);
              inputRef.current?.focus();
            }}
            className="text-xs bg-purple-900/50 text-purple-300 px-3 py-1 rounded-full border border-purple-500/20 hover:bg-purple-800/50 hover:text-white transition whitespace-nowrap"
          >
            {q}
          </button>
        ))}
        <button
          onClick={handleSendSelection}
          className="text-xs bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/20 hover:bg-indigo-800/50 hover:text-white transition whitespace-nowrap flex items-center gap-1"
          title="Выделите текст на странице и нажмите, чтобы отправить питомцу"
        >
          📋 Выделенное
        </button>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-purple-500/20">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Спроси у питомца..."
            className="flex-1 bg-slate-700 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

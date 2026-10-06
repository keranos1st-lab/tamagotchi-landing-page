import { usePetStore } from '@/store/petStore';
import { useMemoryStore } from '@/store/memoryStore';
import { useThinkingStore } from '@/store/thinkingStore';
import { useVoiceStore } from '@/store/voiceStore';
import { useAiKeyStore } from '@/store/aiKeyStore';
import { track } from '@/store/achievementStore';
import { askPet } from './petAi';
import { speak, startRecording, stopSpeaking, transcribe, type Recording } from './voice';

let rec: Recording | null = null;
let turn = 0;

const vs = () => useVoiceStore.getState();

function fail(note: string) {
  vs().set({ status: 'idle', level: 0, note });
  useThinkingStore.getState().setThinking(false);
  setTimeout(() => {
    if (vs().note === note && vs().status === 'idle') vs().set({ note: null });
  }, 6000);
}

function sttMessage(code: string, message: string): string {
  switch (code) {
    case 'stt_no_speech':
      return 'Речь не распознана — попробуй ещё раз';
    case 'network':
      return 'Нет связи с сервером — проверь интернет и попробуй ещё раз';
    case 'yandex_bad_key':
      return 'Ключ Yandex SpeechKit недействителен — проверь секрет YANDEX_SPEECHKIT_API_KEY';
    case 'stt_no_permission':
      return 'У ключа Yandex нет права на распознавание речи (нужна роль ai.speechkit-stt.user)';
    case 'yandex_quota':
    case 'stt_rate':
    case 'stt_daily':
      return message;
    default:
      return message || 'Не удалось распознать речь';
  }
}

export function voiceBusy() {
  return vs().status !== 'idle';
}

export function cancelVoice() {
  turn++;
  rec?.cancel();
  rec = null;
  stopSpeaking();
  useThinkingStore.getState().setThinking(false);
  vs().set({ status: 'idle', level: 0 });
}

export async function toggleVoice() {
  const st = vs().status;
  if (st === 'listening') return finishListening();
  if (st !== 'idle') return cancelVoice();
  return startListening();
}

async function startListening() {
  const my = ++turn;
  vs().set({ status: 'listening', heard: '', reply: '', note: null, level: 0 });
  return startRecorder(my);
}

async function startRecorder(my: number) {
  try {
    rec = await startRecording({
      onLevel: (level) => vs().set({ level }),
      onAutoStop: () => {
        if (turn === my) finishListening();
      },
    });
  } catch (e) {
    rec = null;
    const name = (e as Error)?.name;
    fail(
      name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Нет доступа к микрофону — разрешите его в настройках браузера'
        : name === 'NotFoundError'
          ? 'Микрофон не найден'
          : 'Не удалось включить микрофон',
    );
    return;
  }
  if (turn !== my) rec?.cancel();
}

async function finishListening() {
  const my = turn;
  const r = rec;
  rec = null;
  if (!r) return;
  const pcm = r.stop();
  if (!pcm || pcm.length < 16000 * 0.4) return fail('Я ничего не услышал — нажми на микрофон и скажи ещё раз');

  vs().set({ status: 'transcribing', level: 0 });
  const heard = await transcribe(pcm);
  if (turn !== my) return;
  if (!heard.ok) return fail(sttMessage(heard.code, heard.message));
  if (!heard.text.trim()) return fail('Речь не распознана — попробуй ещё раз');

  return askAndSpeak(my, heard.text.trim());
}

async function askAndSpeak(my: number, text: string) {
  vs().set({ status: 'thinking', heard: text });
  const pet = usePetStore.getState();
  pet.addChatMessage('user', text);
  track.bump('chat');
  useThinkingStore.getState().setThinking(true);

  const mem = useMemoryStore.getState();
  const res = await askPet({
    pet: usePetStore.getState(),
    history: usePetStore.getState().chatHistory.slice(0, -1),
    memory: mem.consent ? mem.items.map((i) => i.text) : [],
    message: text,
    voice: true,
  });
  useThinkingStore.getState().setThinking(false);
  if (turn !== my) return;

  if (!res.ok) {
    usePetStore.getState().addChatMessage('pet', '', {
      kind: 'error',
      error: { code: res.code, message: res.message, retryable: res.retryable },
      retry: { message: text },
    });
    const own = useAiKeyStore.getState().enabled;
    return fail(own || !res.code.startsWith('daily') ? res.message : 'Дневной лимит AI исчерпан');
  }

  usePetStore.getState().addChatMessage('pet', res.reply, { kind: 'ai', declined: res.declined });
  usePetStore.getState().earn('chat', res.declined ? 1 : 3);
  useThinkingStore.getState().cheer();
  if (res.remember) mem.propose(res.remember);

  vs().set({ status: 'speaking', reply: res.reply });
  const said = await speak(res.reply);
  if (turn !== my) return;
  if (!said.ok && said.cancelled) return vs().set({ status: 'idle' });
  vs().set({
    status: 'idle',
    note: said.ok ? (said.via === 'local' ? `Голос Yandex недоступен (${said.reason}) — говорю голосом системы` : null) : `Не удалось озвучить: ${said.reason}`,
  });
  if (vs().note) setTimeout(() => vs().set({ note: null }), 7000);
}

export async function speakText(text: string) {
  const st = vs().status;
  if (st === 'speaking') {
    cancelVoice();
    return;
  }
  if (st !== 'idle') return;
  const my = ++turn;
  vs().set({ status: 'speaking', reply: text, note: null });
  const said = await speak(text);
  if (turn !== my) return;
  if (!said.ok && said.cancelled) return vs().set({ status: 'idle' });
  vs().set({
    status: 'idle',
    note: said.ok ? (said.via === 'local' ? `Голос Yandex недоступен (${said.reason}) — говорю голосом системы` : null) : `Не удалось озвучить: ${said.reason}`,
  });
  if (vs().note) setTimeout(() => vs().set({ note: null }), 7000);
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && vs().status !== 'idle') cancelVoice();
  });
  window.addEventListener('pagehide', () => {
    if (vs().status === 'listening') cancelVoice();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && vs().status === 'listening') cancelVoice();
  });
}

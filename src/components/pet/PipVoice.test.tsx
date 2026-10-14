// @ts-expect-error bun:test is supplied by the test runner
import { afterAll, beforeEach, describe, expect, jest, test } from 'bun:test';
import { Window } from 'happy-dom';

const g = globalThis as unknown as Record<string, unknown>;
const KEYS = ['window', 'document', 'navigator', 'localStorage', 'HTMLElement', 'Node', 'Element', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'Event', 'CustomEvent', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
const saved: Record<string, PropertyDescriptor | undefined> = {};
const win = new Window({ url: 'http://localhost/' });
const w = win as unknown as Record<string, unknown>;
for (const k of KEYS) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
for (const k of KEYS) {
  if (k === 'window') g.window = win;
  else if (k === 'IS_REACT_ACT_ENVIRONMENT') g[k] = true;
  else if (k === 'fetch') continue;
  else if (k === 'requestAnimationFrame') g[k] = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16);
  else if (k === 'cancelAnimationFrame') g[k] = (id: number) => clearTimeout(id);
  else Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === 'getComputedStyle' ? (w[k] as () => unknown).bind(win) : w[k] });
}

const rtl = await import('@testing-library/react');
const { PipMicButton, PipVoiceStatus } = await import('./PipVoice');
const { PetActionPill } = await import('./PetActionPill');
const { useVoiceStore } = await import('@/store/voiceStore');
const { stopListeningIfHidden } = await import('@/utils/voiceDialog');

afterAll(() => {
  rtl.cleanup();
  for (const k of KEYS) {
    if (saved[k]) Object.defineProperty(globalThis, k, saved[k]!);
    else delete g[k];
  }
});

const q = () => rtl.within(win.document.body as unknown as HTMLElement);
const wait = (ms = 40) => rtl.act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const setVoice = (p: Record<string, unknown>) => rtl.act(() => { useVoiceStore.getState().set(p as never); });
const hide = (hidden: boolean) => {
  Object.defineProperty(win.document, 'hidden', { configurable: true, value: hidden });
  stopListeningIfHidden();
};

beforeEach(() => {
  rtl.cleanup();
  useVoiceStore.setState({ status: 'idle', level: 0, heard: '', reply: '', note: null });
  delete (win as unknown as Record<string, unknown>).documentPictureInPicture;
  hide(false);
});

describe('голос в окне поверх окон', () => {
  test('в меню питомца есть кнопка «Сказать голосом»', () => {
    rtl.render(<PetActionPill onAction={() => {}} extra={<PipMicButton />} />);
    expect(q().getByTitle('Сказать голосом')).toBeTruthy();
    expect(q().getByTitle('Покормить')).toBeTruthy();
  });

  test('в покое статус ничего не показывает', () => {
    rtl.render(<PipVoiceStatus />);
    expect(q().queryByTestId('pip-voice')).toBeNull();
  });

  test('нажатие запускает диалог: при недоступном микрофоне видно понятное сообщение', async () => {
    rtl.render(<><PipMicButton /><PipVoiceStatus /></>);
    await rtl.act(async () => { rtl.fireEvent.click(q().getByTitle('Сказать голосом')); });
    await wait();
    expect(useVoiceStore.getState().status).toBe('idle');
    expect(q().getByTestId('pip-voice').textContent).toContain('Не удалось включить микрофон');
  });

  test('во время записи видно «Слушаю…», «Готово» и «Отмена»', async () => {
    rtl.render(<><PipMicButton /><PipVoiceStatus /></>);
    await setVoice({ status: 'listening', level: 0.4 });
    expect(q().getByText('Слушаю…')).toBeTruthy();
    expect(q().getByText('Готово')).toBeTruthy();
    expect(q().getByText('Отмена')).toBeTruthy();
    expect(q().getByTitle('Остановить голосовой диалог') ).toBeTruthy();
  });

  test('«Отмена» останавливает запись и убирает статус', async () => {
    rtl.render(<PipVoiceStatus />);
    await setVoice({ status: 'listening' });
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Отмена')); });
    expect(useVoiceStore.getState().status).toBe('idle');
    expect(q().queryByTestId('pip-voice')).toBeNull();
  });

  test('при распознавании показывается услышанная фраза', async () => {
    rtl.render(<PipVoiceStatus />);
    await setVoice({ status: 'transcribing', heard: 'запиши заметку' });
    expect(q().getByText('Распознаю…')).toBeTruthy();
    expect(q().getByText('«запиши заметку»')).toBeTruthy();
  });

  test('при ответе показывается текст и кнопка «Остановить»', async () => {
    rtl.render(<PipVoiceStatus />);
    await setVoice({ status: 'speaking', reply: 'Записал заметку' });
    expect(q().getByText('Записал заметку')).toBeTruthy();
    await rtl.act(async () => { rtl.fireEvent.click(q().getByText('Остановить')); });
    expect(useVoiceStore.getState().status).toBe('idle');
  });

  test('ошибка в покое показывается как сообщение без кнопок', async () => {
    rtl.render(<PipVoiceStatus />);
    await setVoice({ status: 'idle', note: 'Речь не распознана — попробуй ещё раз' });
    expect(q().getByText('Речь не распознана — попробуй ещё раз')).toBeTruthy();
    expect(q().queryByText('Отмена')).toBeNull();
  });

  test('сайт ушёл в фон без окна поверх окон: запись прекращается, как раньше', async () => {
    await setVoice({ status: 'listening' });
    hide(true);
    expect(useVoiceStore.getState().status).toBe('idle');
  });

  test('сайт ушёл в фон, но окно поверх окон открыто: запись не обрывается', async () => {
    (win as unknown as Record<string, unknown>).documentPictureInPicture = { window: {} };
    await setVoice({ status: 'listening' });
    hide(true);
    expect(useVoiceStore.getState().status).toBe('listening');
  });

  test('после закрытия окна поверх окон уход в фон снова прекращает запись', async () => {
    (win as unknown as Record<string, unknown>).documentPictureInPicture = { window: null };
    await setVoice({ status: 'listening' });
    hide(true);
    expect(useVoiceStore.getState().status).toBe('idle');
  });
});

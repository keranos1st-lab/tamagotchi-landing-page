// @ts-expect-error bun:test is supplied by the test runner
import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { snapshotGlobals } from '@/test/isolate';

const restoreGlobals = snapshotGlobals();
afterAll(restoreGlobals);
const { askPet } = await import('./petAi');
const { isNoteCommand } = await import('./noteCommands');
const { useAuthStore } = await import('@/store/authStore');

const BODY = 'Сделать сегодня бейджи для конференции';
const NAMES = ['Кодик', 'Барсик', 'Тёма', 'Мурка-2', 'Dragon', 'Лис (Рыжий)', 'А.Б.'];

describe('новые формулировки записи', () => {
  const create = [
    `Запиши: ${BODY}`, `запиши: ${BODY}`, `Запиши ${BODY}`, `Просто запиши: "${BODY}"`, `запиши "${BODY}"`, `запиши «${BODY}»`,
    `Запиши мне: ${BODY}`, `Запиши, пожалуйста: ${BODY}`, `Записать: ${BODY}`, `Сохранить: ${BODY}`, `Сохрани ${BODY}`,
    `Запиши заметку: ${BODY}`, `Запиши в блокнот: ${BODY}`, `Запиши, что ${BODY.toLowerCase()}`, `сделай заметку: идея`, `добавь в заметки яблоки`,
    'Запиши — купить молоко', 'Запиши номер телефона 555',
  ];
  test.each(create)('распознаётся: %s', (m: string) => expect(isNoteCommand(m)).toBe(true));

  test.each(NAMES)('работает с именем питомца: %s', (name: string) => {
    for (const m of create) {
      expect(isNoteCommand(`${name}, ${m}`, name)).toBe(true);
      const noComma = isNoteCommand(`${name} ${m.charAt(0).toLowerCase()}${m.slice(1)}`, name);
      expect(noComma).toBe(!/^(?:Просто|Записать|Сохранить)/.test(m));
      expect(isNoteCommand(`Эй ${name}: ${m}`, name)).toBe(true);
    }
  });

  test('поиск, правка и создание по существительному не сломались', () => {
    for (const m of ['Найди заметку про бейджи', 'Покажи последнюю заметку', 'Исправь заметку номер 3: новый текст', 'Запиши заметку Дракон', 'создай идею: игра'])
      expect(isNoteCommand(m)).toBe(true);
  });
});

describe('напоминания', () => {
  test.each([
    'поставь напоминание для заметки 12 завтра в 15:00 за 30 минут',
    'Поставь напоминание к заметке №12 завтра в 15:00',
    'установи напоминание на заметку номер 7 в 9:00',
    'добавь напоминание для заметки 5 через час',
    'сделай напоминание для заметки #3 завтра в 10:00',
    'напомни про заметку 7 завтра в 9:00',
    'напомни о заметке 7 в 18:00',
    'отключи напоминание для заметки 12',
    'выключи напоминание у заметки номер 12',
    'убери напоминание для заметки 3.',
    'отмени напоминание на заметку №8',
  ])('распознаётся: %s', (m: string) => expect(isNoteCommand(m)).toBe(true));

  test.each(NAMES)('с именем питомца: %s', (name: string) => {
    expect(isNoteCommand(`${name}, поставь напоминание для заметки 12 завтра в 15:00`, name)).toBe(true);
    expect(isNoteCommand(`${name} отключи напоминание для заметки 12`, name)).toBe(true);
    expect(isNoteCommand(`${name}, напомни про заметку 7 завтра в 9:00`, name)).toBe(true);
  });

  test.each([
    'отключи напоминание', 'поставь напоминание на завтра', 'напомни мне позвонить маме', 'напомни про встречу',
    'поставь будильник на 7', 'отключи звук', 'убери напоминание для заметки', 'не ставь напоминание для заметки 12',
  ])('не команда: %s', (m: string) => expect(isNoteCommand(m)).toBe(false));
});

describe('исключения: вопросы, отрицания, обычный чат', () => {
  test.each([
    'запиши как дела', 'Запиши, как дела?', 'запиши почему небо голубое', 'запиши зачем это нужно', 'запиши где мой телефон',
    'запиши кто пришёл', 'запиши сколько времени', 'запиши ли ты это', 'запиши в', 'запиши это', 'запиши мне',
    'не записывай в блокнот', 'Не записывай заметку: секрет', 'не запиши', 'не сохраняй это', 'не сохрани',
    'что значит запиши в блокнот', 'Что значит запиши заметку', 'как записать заметку', 'можно ли записать',
    'я записал', 'записал вчера', 'записываю', 'расскажи как записать',
    'Привет', 'Добавить Кодику новую анимацию', 'Сделать сегодня бейджи для конференции', 'Просто запишись на приём',
    'сохранитель экрана', 'записной книжки нет', '',
  ])('не команда: %p', (m: string) => expect(isNoteCommand(m)).toBe(false));

  test('имя питомца не превращает вопрос в команду', () => {
    for (const name of NAMES) {
      expect(isNoteCommand(`${name}, как дела?`, name)).toBe(false);
      expect(isNoteCommand(`${name}, запиши как дела`, name)).toBe(false);
      expect(isNoteCommand(`${name}, не записывай в блокнот`, name)).toBe(false);
    }
  });

  test('имя другого питомца не считается своим, но «кодик» и «питомец» работают всегда', () => {
    expect(isNoteCommand('Барсик, запиши: молоко', 'Мурка')).toBe(false);
    expect(isNoteCommand('Кодик, запиши: молоко', 'Мурка')).toBe(true);
    expect(isNoteCommand('Питомец, запиши: молоко', 'Мурка')).toBe(true);
  });

  test('имя со спецсимволами не ломает разбор', () => {
    for (const bad of ['(', '[a-', '.*', '\\', '$^', 'a|b', '?']) expect(() => isNoteCommand('запиши: молоко', bad)).not.toThrow();
    expect(isNoteCommand('a|b, запиши: молоко', 'a|b')).toBe(true);
    expect(isNoteCommand('a, запиши: молоко', 'a|b')).toBe(false);
  });
});

describe('полный путь askPet: распознавание, токен, ответ сервера', () => {
  const calls: Array<{ headers: Record<string, string>; body: Record<string, unknown> }> = [];
  let result: Record<string, unknown> = {};
  let status = 200;
  const pet = (name: string) => ({ name, type: 'cat' as const, level: 4, stage: 'baby' as const, hunger: 70, happiness: 70, energy: 80, health: 100, intelligence: 100 });
  const ask = (message: string, name = 'Кодик') => askPet({ pet: pet(name), history: [], memory: [], message, requestId: 'stable-request-id-1' });

  beforeEach(() => {
    calls.length = 0;
    status = 200;
    result = { reply: 'Готово', noteAction: 'create', notes: [] };
    useAuthStore.getState().setSession('tok-xyz', { id: 1, email: 'a@example.invalid', createdAt: '' });
    globalThis.fetch = (async (_u: string, init: RequestInit) => {
      calls.push({ headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
      return { ok: status === 200, status, json: async () => result } as Response;
    }) as typeof fetch;
  });

  test.each([
    [`Запиши: ${BODY}`, 'create'],
    [`Запиши ${BODY}`, 'create'],
    [`Просто запиши: "${BODY}"`, 'create'],
    ['Запиши, пожалуйста: сделать бейджи', 'create'],
    ['Записать: сделать бейджи', 'create'],
    ['поставь напоминание для заметки 12 завтра в 15:00 за 30 минут', 'remind'],
    ['отключи напоминание для заметки 12', 'unremind'],
    ['напомни про заметку 7 завтра в 9:00', 'remind'],
  ])('%s: токен уходит, ответ %s принимается', async (message: string, action: string) => {
    result = { reply: 'Подтверждено сервером', noteAction: action, notes: [{ id: 12, text: 'x', version: 2, updatedAt: '2026-10-12T10:00:00+00:00', reminder: null }] };
    const res = await ask(message);
    expect(calls.length).toBe(1);
    expect(calls[0].headers['X-Auth-Token']).toBe('tok-xyz');
    expect(calls[0].body.message).toBe(message);
    expect(typeof calls[0].body.timezone).toBe('string');
    expect(typeof calls[0].body.tzOffset).toBe('number');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.reply).toBe('Подтверждено сервером');
      expect(res.noteAction).toBe(action);
      expect(res.notes?.length).toBe(1);
    }
  });

  test.each(NAMES)('питомец %s: токен уходит и для записи, и для напоминаний', async (name: string) => {
    for (const [m, action] of [[`${name}, запиши: ${BODY}`, 'create'], [`${name} поставь напоминание для заметки 3 завтра в 9:00`, 'remind'], [`${name}, отключи напоминание для заметки 3`, 'unremind']] as const) {
      calls.length = 0;
      result = { reply: 'ок', noteAction: action, notes: [] };
      const res = await ask(m, name);
      expect(calls[0].headers['X-Auth-Token']).toBe('tok-xyz');
      expect(res.ok && res.noteAction).toBe(action);
    }
  });

  test('обычный чат и вопросы уходят без токена', async () => {
    result = { reply: 'Привет!' };
    for (const m of ['Привет', 'запиши как дела', 'Не записывай заметку: секрет', 'Добавить Кодику новую анимацию', 'отключи звук']) {
      calls.length = 0;
      const res = await ask(m);
      expect(calls[0].headers['X-Auth-Token']).toBeUndefined();
      expect(res.ok).toBe(true);
    }
  });

  test('команды блокнота без входа не уходят на сервер', async () => {
    useAuthStore.getState().clearSession();
    for (const m of [`Запиши ${BODY}`, 'поставь напоминание для заметки 12 завтра в 15:00', 'отключи напоминание для заметки 12']) {
      const res = await ask(m);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('notes_login');
    }
    expect(calls.length).toBe(0);
  });

  test('ответ модели вместо подтверждения блокнота не считается успехом', async () => {
    result = { reply: 'Конечно, записал!' };
    for (const m of [`Запиши ${BODY}`, 'поставь напоминание для заметки 12 завтра в 15:00', 'отключи напоминание для заметки 12']) {
      const res = await ask(m);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('notes_not_ready');
    }
  });

  test('неизвестное действие сервера не принимается', async () => {
    result = { reply: 'ок', noteAction: 'delete' };
    const res = await ask(`Запиши ${BODY}`);
    expect(res.ok).toBe(false);
  });

  test('ошибка сервера при напоминании показывается, а не прячется', async () => {
    status = 503;
    result = { error: 'notes_unavailable', message: 'Не удалось подтвердить сохранение', retryable: true };
    const res = await ask('поставь напоминание для заметки 12 завтра в 15:00');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('notes_unavailable');
      expect(res.retryable).toBe(true);
    }
  });

  test('карточка предложения напоминания доходит до клиента вместе с create', async () => {
    result = { reply: 'Записал', noteAction: 'create', notes: [], reminderProposal: { noteId: 5, dueLocal: '2026-10-13T12:00', tz: 'Asia/Vladivostok', lead: 15, when: 'вторник', tzLabel: 'Asia/Vladivostok, UTC+10:00', leadText: 'за 15 минут' } };
    const res = await ask('запиши: завтра в 12:00 позвонить Сергею');
    expect(res.ok && res.reminderProposal?.tz).toBe('Asia/Vladivostok');
  });

  test('при задаче над текстом (task) токен не уходит, даже если текст похож на команду', async () => {
    result = { reply: 'Результат' };
    await askPet({ pet: pet('Кодик'), history: [], memory: [], message: `Запиши ${BODY}`, task: { action: 'shorten', source: 'x' } as never, requestId: 'task-request-id-1' });
    expect(calls[0].headers['X-Auth-Token']).toBeUndefined();
  });
});

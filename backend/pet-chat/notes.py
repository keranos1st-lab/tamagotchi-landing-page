"""Account-owned note commands. Explicit routing; no model can invent a write result."""
import hashlib
import json
import re

import reminders

MAX_TEXT = 1800
MAX_NOTES = 500
DAILY_COMMANDS = 1000
LIST_LIMIT = 30
DUE_LIMIT = 20
COLS = 'id, text, version, updated_at, due_at, remind_lead, remind_tz, remind_at, remind_state, remind_seq'
API_UNAVAILABLE = 'Не удалось выполнить действие. Блокнот временно недоступен, повтори попытку.'
ID = re.compile(r'^[A-Za-z0-9_-]{8,96}$')

QUICK_CREATE = re.compile(r'^(?:(?:(?:запиши|сохрани|добавь|занеси|внеси)\s+(?:мне\s+)?(?:это\s+)?(?:в|во)\s+(?:мой\s+|моё\s+|мои\s+)?(?:блокнот|заметки|заметку)|запиши(?:\s+мне)?(?=\s*,?\s+что(?:\s|$))|сделай\s+(?:мне\s+)?(?:новую\s+)?заметку)\b|(?:запиши|сохрани)\s*:)(.*)$', re.I | re.S)
NOTE_REF = r'заметк\w*\s+(?:номер\s+|№\s*|#\s*)?(\d{1,18})'
REMIND_SET = re.compile(rf'^(?:(?:поставь|установи|добавь|сделай)\s+напоминание\s+(?:для|к|на)\s+|напомни\s+(?:про|о|об)\s+){NOTE_REF}\s*[:,]?\s*(.*)$', re.I | re.S)
REMIND_OFF = re.compile(rf'^(?:отключи|выключи|убери|отмени)\s+напоминание\s+(?:для|к|у|на)\s+{NOTE_REF}\s*[.!]?$', re.I)


def parse(message, name=''):
    text = str(message or '').strip()
    names = ['кодик', 'питомец'] + ([name] if isinstance(name, str) and 0 < len(name) <= 80 else [])
    prefix = '|'.join(re.escape(n) for n in names)
    text = re.sub(rf'^(?:эй\s+)?(?:{prefix})(?:\s*[,!:]\s*|\s+(?=(?:пожалуйста|запиши|сохрани|создай|сделай|занеси|внеси|добавь|найди|покажи|прочитай|исправь|измени|обнови|перепиши|поставь|установи|напомни|отключи|выключи|убери|отмени)\b))', '', text, flags=re.I)
    text = re.sub(r'^пожалуйста[,\s]+', '', text, flags=re.I)
    text = re.sub(r'^(найди|покажи|прочитай|исправь|измени|обнови|перепиши)\s+последнюю\s+заметку\b', r'\1 заметку последнюю', text, flags=re.I)
    quick = QUICK_CREATE.match(text)
    if quick:
        body = re.sub(r'^(?:что\b[\s,:]*)', '', quick[1].strip().lstrip(':,—–').strip(), flags=re.I).strip()
        return {'action': 'create', 'text': body, 'query': ''}
    remind = REMIND_SET.match(text)
    if remind:
        return {'action': 'remind', 'id': int(remind[1]), 'when': remind[2].strip(), 'text': '', 'query': ''}
    unremind = REMIND_OFF.match(text)
    if unremind:
        return {'action': 'unremind', 'id': int(unremind[1]), 'when': '', 'text': '', 'query': ''}
    verb = re.match(r'^(запиши|сохрани|создай|добавь|найди|покажи|прочитай|исправь|измени|обнови|перепиши)\s+(?:мне\s+)?(?:новую\s+)?(заметку|заметки|идею|запись)\b(.*)$', text, re.I | re.S)
    if not verb:
        return None
    action = 'create' if verb[1].lower() in ('запиши', 'сохрани', 'создай', 'добавь') else 'find' if verb[1].lower() in ('найди', 'покажи', 'прочитай') else 'update'
    rest = verb[3].strip().lstrip(':—–').strip()
    if action == 'create':
        return {'action': action, 'text': rest, 'query': ''}
    if action == 'find':
        return {'action': action, 'query': rest, 'text': ''}
    # Editing always requires an explicit selector and the full replacement text.
    selector, sep, replacement = rest.partition(':')
    if not sep:
        match = re.search(r'\s+(?:на текст|новый текст)\s+', rest, re.I)
        selector, sep, replacement = (rest[:match.start()], ':', rest[match.end():]) if match else (rest, '', '')
    return {'action': action, 'query': selector.strip(), 'text': replacement.strip() if sep else ''}


def response(reply, action, notes=None, **extra):
    return {'reply': reply, 'spoken': reply, 'remember': None, 'truncated': False,
            'model': None, 'noteAction': action, 'notes': notes or [], **extra}


def error(code, message, status=503, retryable=False):
    return status, {'error': code, 'message': message, 'retryable': retryable}


def public(row):
    note = {'id': row[0], 'text': row[1], 'version': row[2], 'updatedAt': row[3].isoformat(), 'reminder': None}
    if len(row) > 9:
        note['reminder'] = reminders.public_reminder(row[4], row[5], row[6], row[7], row[8], row[9])
    return note


def _current(row):
    if len(row) > 9:
        return {'due_at': row[4], 'lead': row[5], 'tz': row[6], 'state': row[8]}
    return {'due_at': None, 'lead': None, 'tz': None, 'state': None}


ENDINGS = sorted((
    'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ией', 'ией', 'ией', 'ах', 'ях', 'ов', 'ев', 'ей', 'ом', 'ем',
    'ой', 'ую', 'юю', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ых', 'их', 'ым', 'им', 'ам', 'ям', 'ою', 'ею', 'ию', 'ья', 'ье',
    'ть', 'ти', 'а', 'я', 'у', 'ю', 'е', 'ы', 'и', 'о', 'ь', 'й',
), key=len, reverse=True)


def stem(word):
    word = word.lower().replace('ё', 'е')
    if not word.isalpha():
        return word
    for ending in ENDINGS:
        if word.endswith(ending) and len(word) - len(ending) >= 3:
            word = word[:-len(ending)]
            break
    if len(word) >= 5 and word[-1] in 'еиюя':
        word = word[:-1]
    return word


def matches_text(text, stems):
    low = str(text).lower().replace('ё', 'е')
    return all(st in low for st in stems)


def selector(cur, schema, uid, query):
    query = query.strip().strip('«»"')
    numeric = re.fullmatch(r'(?:номер\s+|№\s*|#\s*)?(\d+)', query, re.I)
    if numeric:
        number = int(numeric[1])
        if number > 9223372036854775807:
            return []
        cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s AND id=%s', (uid, number))
    elif re.fullmatch(r'последн(?:юю|яя|ие|ей)(?:\s+заметк[ауи])?', query, re.I):
        cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s ORDER BY created_at DESC, id DESC LIMIT 1', (uid,))
    else:
        query = re.sub(r'^(?:про|о|об|по теме)\s+', '', query, flags=re.I)
        words = re.findall(r'[0-9A-Za-zА-Яа-яЁё]+', query)[:12]
        stems = [stem(w) for w in words]
        cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s ORDER BY updated_at DESC, id DESC LIMIT {MAX_NOTES}', (uid,))
        rows = cur.fetchall()
        return [row for row in rows if stems and matches_text(row[1], stems)][:6]
    return cur.fetchall()


KEEP = object()


def _update_note(cur, schema, uid, nid, text=None, spec=KEEP):
    sets, args = [], []
    if text is not None:
        sets.append('text=%s')
        args.append(text)
    if spec is not KEEP:
        if spec is None:
            sets.append('due_at=NULL, remind_lead=NULL, remind_tz=NULL, remind_at=NULL, remind_state=NULL, remind_done_at=NULL')
        else:
            sets.append("due_at=%s, remind_lead=%s, remind_tz=%s, remind_at=%s, remind_state='active', remind_done_at=NULL")
            args += [spec['due_at'], spec['lead'], spec['tz'], spec['remind_at']]
        sets.append('remind_seq=remind_seq+1')
    sets.append('version=version+1, updated_at=NOW()')
    cur.execute(f"UPDATE {schema}.pet_notes SET {', '.join(sets)} WHERE user_id=%s AND id=%s RETURNING {COLS}", (*args, uid, nid))
    return cur.fetchone()


def _zone(command):
    off = command.get('tzoff')
    return reminders.request_tz(command.get('tzname'), off if isinstance(off, int) and not isinstance(off, bool) else None)


def _spec_for(text, command, now_utc):
    """('none',) | ('ok', spec) | ('ambiguous', reason) | ('no_tz',)"""
    tzname, zone = _zone(command)
    if zone is None:
        return ('no_tz', None)
    found = reminders.parse_when(text, now_utc.astimezone(zone))
    if found['status'] == 'none':
        return ('none', None)
    if found['status'] == 'ambiguous':
        return ('ambiguous', found['reason'])
    try:
        spec = reminders.build(found['local'].strftime('%Y-%m-%dT%H:%M'), tzname, reminders.lead_from_text(text), now_utc)
    except reminders.ReminderError as exc:
        return ('ambiguous', exc.message)
    return ('ok', spec)


def _proposal(spec, note_id):
    when, label = reminders.describe(spec['due_at'], spec['tz'])
    local = spec['due_at'].astimezone(reminders.get_tz(spec['tz']))
    return {'noteId': note_id, 'dueLocal': local.strftime('%Y-%m-%dT%H:%M'), 'tz': spec['tz'], 'lead': spec['lead'],
            'when': when, 'tzLabel': label, 'leadText': reminders.lead_text(spec['lead'])}


def perform(cur, schema, uid, command):
    action, text, query = command['action'], command['text'], command['query']
    if action in ('remind', 'unremind'):
        return _perform_remind(cur, schema, uid, command)
    if action in ('create', 'update') and not text:
        return response('Скажи полный текст заметки. Для исправления: «исправь заметку номер 12: новый текст». Ничего не изменено.', action)
    if len(text) > MAX_TEXT or len(query) > 200:
        return response('Текст заметки слишком длинный. Допустимо 1800 символов, запрос поиска — до 200. Ничего не изменено.', action)
    if action == 'create':
        cur.execute(f'SELECT COUNT(*) FROM {schema}.pet_notes WHERE user_id=%s', (uid,))
        if cur.fetchone()[0] >= MAX_NOTES:
            return response('В блокноте уже 500 заметок. Новая заметка не сохранена.', action)
        cur.execute(f'INSERT INTO {schema}.pet_notes(user_id,text) VALUES(%s,%s) RETURNING {COLS}', (uid, text))
        note = public(cur.fetchone())
        reply = f'Записал заметку номер {note["id"]}: {text}'
        status, value = _spec_for(text, command, reminders.utcnow())
        if status == 'ok':
            proposal = _proposal(value, note['id'])
            ask = f'Поставить напоминание на {proposal["when"]} ({proposal["tzLabel"]}), напомню {proposal["leadText"]}? Подтверди кнопкой под сообщением.'
            return response(f'{reply}\n\n{ask}', action, [note], changed=True, reminderProposal=proposal,
                            spoken=f'Записал заметку номер {note["id"]}. Могу поставить напоминание на {proposal["when"]}. Подтверди кнопкой на экране.')
        if status == 'ambiguous':
            hint = f'Напоминание не поставил: {value} Скажи, например: «поставь напоминание для заметки {note["id"]} завтра в 12:00».'
            return response(f'{reply}\n\n{hint}', action, [note], changed=True,
                            spoken=f'Записал заметку номер {note["id"]}. Напоминание не поставил: {value}')
        return response(reply, action, [note], changed=True)
    if action == 'update' and not query:
        return response('Укажи номер или тему заметки, которую нужно исправить. Ничего не изменено.', action)
    found = selector(cur, schema, uid, query)
    if not found:
        return response('В твоём блокноте такой заметки не нашёл. Ничего не изменено.' if action == 'update' else 'В твоём блокноте таких заметок не нашёл.', action)
    if action == 'update':
        if len(found) != 1:
            choices = ', '.join(str(row[0]) for row in found[:5])
            return response(f'Нашёл несколько заметок: номера {choices}. Уточни номер и повтори новый текст. Ничего не изменено.', action, [public(row) for row in found[:5]])
        note = public(_update_note(cur, schema, uid, found[0][0], text=text))
        return response(f'Исправил заметку номер {note["id"]}: {text}', action, [note], changed=True)
    notes = [public(row) for row in found[:5]]
    reply = '\n\n'.join(f'Заметка №{n["id"]}: {n["text"]}' + (f'\nНапоминание: {n["reminder"]["text"]}' if n['reminder'] and n['reminder']['state'] == 'active' else '') for n in notes)
    if len(found) > 5:
        reply += '\n\nЕсть ещё совпадения. Уточни тему поиска.'
    spoken = reply if len(notes) == 1 else f'Нашёл {"как минимум " if len(found)>5 else ""}{len(notes)} заметок. ' + ' '.join(f'Номер {n["id"]}: {n["text"][:100]}.' for n in notes)
    return response(reply, action, notes, spoken=spoken[:1600])


def _perform_remind(cur, schema, uid, command):
    action, nid = command['action'], command['id']
    cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s AND id=%s FOR UPDATE', (uid, nid))
    row = cur.fetchone()
    if not row:
        return response(f'В твоём блокноте нет заметки номер {nid}. Ничего не изменено.', action)
    if action == 'unremind':
        if row[4] is None:
            return response(f'У заметки номер {nid} нет напоминания.', action, [public(row)])
        note = public(_update_note(cur, schema, uid, nid, spec=None))
        return response(f'Отключил напоминание у заметки номер {nid}. Текст сохранён.', action, [note], changed=True)
    when = command.get('when', '')
    if not when:
        return response(f'Скажи, когда напомнить: «поставь напоминание для заметки {nid} завтра в 12:00». Ничего не изменено.', action)
    status, value = _spec_for(when, command, reminders.utcnow())
    if status == 'no_tz':
        return response('Не удалось определить твой часовой пояс, поэтому напоминание не поставлено. Обнови приложение и повтори.', action)
    if status == 'none':
        return response('Не понял дату и время. Скажи, например: «завтра в 12:00». Ничего не изменено.', action)
    if status == 'ambiguous':
        return response(f'{value} Уточни и повтори команду. Ничего не изменено.', action)
    note = public(_update_note(cur, schema, uid, nid, spec=value))
    when_text, label = reminders.describe(value['due_at'], value['tz'])
    return response(f'Поставил напоминание для заметки номер {nid}: {when_text} ({label}), напомню {reminders.lead_text(value["lead"])}.', action, [note], changed=True)


def handle(data, headers, connect, schema):
    if data.get('task'):
        return None
    pet = data.get('pet')
    command = parse(data.get('message'), pet.get('name', '') if isinstance(pet, dict) else '')
    if command is None:
        return None
    tzname = data.get('timezone')
    command['tzname'] = tzname.strip()[:64] if isinstance(tzname, str) else ''
    tzoff = data.get('tzOffset')
    command['tzoff'] = tzoff if isinstance(tzoff, int) and not isinstance(tzoff, bool) else None
    token = headers.get('x-auth-token', '')
    if not isinstance(token, str) or not token or len(token) > 200:
        return error('notes_login', 'Войди в аккаунт PetAgent, чтобы сохранять, искать и исправлять личные заметки.', 401)
    request = data.get('requestId', '')
    if not isinstance(request, str) or not ID.fullmatch(request):
        return error('notes_client_update', 'Для заметок требуется обновлённое приложение PetAgent.', 400)
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', schema):
        return error('notes_unavailable', 'Блокнот временно недоступен.', retryable=True)
    schema = '"' + schema + '"'
    digest = hashlib.sha256(json.dumps(command, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    conn = None
    try:
        conn = connect()
        conn.autocommit = False
        cur = conn.cursor()
        cur.execute(f'SELECT user_id FROM {schema}.sessions WHERE token_hash=%s AND expires_at>NOW()', (hashlib.sha256(token.encode()).hexdigest(),))
        row = cur.fetchone()
        if not row:
            return error('notes_login', 'Сессия истекла. Войди в аккаунт ещё раз.', 401)
        uid = row[0]
        # Serialize this user's commands; deduplication and writes commit atomically.
        cur.execute(f'SELECT id FROM {schema}.users WHERE id=%s FOR UPDATE', (uid,))
        if not cur.fetchone():
            return error('notes_login', 'Войди в аккаунт ещё раз.', 401)
        # A logout/account deletion may have committed while we waited for the owner lock.
        cur.execute(f'SELECT user_id FROM {schema}.sessions WHERE token_hash=%s AND expires_at>NOW()', (hashlib.sha256(token.encode()).hexdigest(),))
        if not cur.fetchone():
            return error('notes_login', 'Сессия истекла. Войди в аккаунт ещё раз.', 401)
        cur.execute(f'SELECT request_hash,response FROM {schema}.pet_note_requests WHERE user_id=%s AND request_id=%s', (uid, request))
        previous = cur.fetchone()
        if previous:
            if previous[0] != digest:
                return error('notes_request_conflict', 'Этот запрос уже использован для другой команды. Отправь новую команду.', 409)
            conn.commit()
            return 200, previous[1]
        cur.execute(f'SELECT COUNT(*) FROM {schema}.pet_note_requests WHERE user_id=%s AND created_at>NOW()-INTERVAL \'1 day\'', (uid,))
        if cur.fetchone()[0] >= DAILY_COMMANDS:
            return error('notes_limit', 'Сегодня слишком много команд блокнота. Попробуй позже.', 429)
        result = perform(cur, schema, uid, command)
        cur.execute(f'INSERT INTO {schema}.pet_note_requests(user_id,request_id,request_hash,response) VALUES(%s,%s,%s,%s::jsonb)', (uid, request, digest, json.dumps(result, ensure_ascii=False)))
        conn.commit()  # Only after durable commit may the pet say "saved".
        return 200, result
    except Exception as exc:
        print(f'notes error: {type(exc).__name__}: {str(exc)[:300]}')
        return error('notes_unavailable', 'Не удалось подтвердить сохранение. Блокнот временно недоступен; повтори запрос, чтобы проверить результат.', retryable=True)
    finally:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass


def _session(cur, schema, token):
    cur.execute(f'SELECT user_id FROM {schema}.sessions WHERE token_hash=%s AND expires_at>NOW()', (hashlib.sha256(token.encode()).hexdigest(),))
    row = cur.fetchone()
    return row[0] if row else None


def _owner_call(headers, connect, schema, work, lock):
    token = headers.get('x-auth-token', '')
    if not isinstance(token, str) or not token or len(token) > 200:
        return error('notes_login', 'Войди в аккаунт PetAgent, чтобы пользоваться заметками.', 401)
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', schema):
        return error('notes_unavailable', API_UNAVAILABLE, retryable=True)
    schema = '"' + schema + '"'
    conn = None
    try:
        conn = connect()
        conn.autocommit = False
        cur = conn.cursor()
        uid = _session(cur, schema, token)
        if not uid:
            return error('notes_login', 'Сессия истекла. Войди в аккаунт ещё раз.', 401)
        if lock:
            cur.execute(f'SELECT id FROM {schema}.users WHERE id=%s FOR UPDATE', (uid,))
            if not cur.fetchone() or not _session(cur, schema, token):
                return error('notes_login', 'Сессия истекла. Войди в аккаунт ещё раз.', 401)
        result = work(cur, schema, uid)
        if result[0] == 200:
            conn.commit()
        return result
    except Exception as exc:
        print(f'notes api error: {type(exc).__name__}: {str(exc)[:300]}')
        return error('notes_unavailable', API_UNAVAILABLE, retryable=True)
    finally:
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass


def _int_or_none(value, low, high):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ValueError
    return value


def _list_work(query, offset):
    def work(cur, schema, uid):
        if not query:
            cur.execute(f'SELECT COUNT(*) FROM {schema}.pet_notes WHERE user_id=%s', (uid,))
            total = cur.fetchone()[0]
            cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s ORDER BY updated_at DESC, id DESC LIMIT {LIST_LIMIT} OFFSET {int(offset)}', (uid,))
            rows = cur.fetchall()
        else:
            stems = [stem(w) for w in re.findall(r'[0-9A-Za-zА-Яа-яЁё]+', query)[:12]]
            cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s ORDER BY updated_at DESC, id DESC LIMIT {MAX_NOTES}', (uid,))
            matched = [row for row in cur.fetchall() if stems and matches_text(row[1], stems)]
            total = len(matched)
            rows = matched[offset:offset + LIST_LIMIT]
        items = [public(row) for row in rows]
        return 200, {'ok': True, 'notes': items, 'total': total, 'offset': offset, 'limit': LIST_LIMIT, 'hasMore': offset + len(items) < total}
    return work


def _reminder_arg(raw):
    """Возвращает KEEP (поле не передано), None (отключить) или проверенный словарь."""
    if raw is KEEP:
        return KEEP
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise reminders.ReminderError('reminder_bad', 'Некорректное напоминание.')
    return {'dueLocal': raw.get('dueLocal'), 'tz': raw.get('tz'), 'lead': raw.get('lead', reminders.DEFAULT_LEAD)}


def _save_work(note_id, text, expected, request, digest, reminder):
    def work(cur, schema, uid):
        cur.execute(f'SELECT request_hash,response FROM {schema}.pet_note_requests WHERE user_id=%s AND request_id=%s', (uid, request))
        previous = cur.fetchone()
        if previous:
            if previous[0] != digest:
                return error('notes_request_conflict', 'Этот запрос уже использован для другого текста. Нажми «Сохранить» ещё раз.', 409)
            return 200, previous[1]
        cur.execute(f'SELECT COUNT(*) FROM {schema}.pet_note_requests WHERE user_id=%s AND created_at>NOW()-INTERVAL \'1 day\'', (uid,))
        if cur.fetchone()[0] >= DAILY_COMMANDS:
            return error('notes_limit', 'Сегодня слишком много действий с блокнотом. Попробуй позже.', 429)
        spec = KEEP
        if reminder is not KEEP:
            if reminder is None:
                spec = None
            else:
                try:
                    spec = reminders.build(reminder['dueLocal'], reminder['tz'], reminder['lead'], reminders.utcnow())
                except reminders.ReminderError as exc:
                    return error(exc.code, exc.message, 400)
        if note_id is None:
            cur.execute(f'SELECT COUNT(*) FROM {schema}.pet_notes WHERE user_id=%s', (uid,))
            if cur.fetchone()[0] >= MAX_NOTES:
                return error('notes_full', 'В блокноте уже 500 заметок. Новая заметка не сохранена.', 409)
            cur.execute(f'INSERT INTO {schema}.pet_notes(user_id,text) VALUES(%s,%s) RETURNING {COLS}', (uid, text))
            row = cur.fetchone()
            if spec not in (KEEP, None):
                row = _update_note(cur, schema, uid, row[0], spec=spec)
            result = {'ok': True, 'action': 'create', 'note': public(row), 'changed': True}
        else:
            cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s AND id=%s FOR UPDATE', (uid, note_id))
            row = cur.fetchone()
            if not row:
                return error('notes_not_found', 'Заметка не найдена. Возможно, она относится к другому аккаунту.', 404)
            if expected is not None and row[2] != expected:
                return 409, {'error': 'notes_version_conflict', 'message': 'Заметка уже изменена в другом месте. Твой текст сохранён в окне.', 'retryable': False, 'current': public(row)}
            new_text = text if row[1] != text else None
            if new_text is None and spec is KEEP:
                result = {'ok': True, 'action': 'update', 'note': public(row), 'changed': False}
            else:
                result = {'ok': True, 'action': 'update', 'note': public(_update_note(cur, schema, uid, note_id, text=new_text, spec=spec)), 'changed': True}
        cur.execute(f'INSERT INTO {schema}.pet_note_requests(user_id,request_id,request_hash,response) VALUES(%s,%s,%s,%s::jsonb)', (uid, request, digest, json.dumps(result, ensure_ascii=False)))
        return 200, result
    return work


def _due_work():
    def work(cur, schema, uid):
        cur.execute(f"SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s AND remind_state='active' AND remind_at<=NOW() ORDER BY remind_at ASC, id ASC LIMIT {DUE_LIMIT}", (uid,))
        due = [public(row) for row in cur.fetchall()]
        cur.execute(f"SELECT MIN(remind_at), NOW() FROM {schema}.pet_notes WHERE user_id=%s AND remind_state='active' AND remind_at>NOW()", (uid,))
        nxt, now = cur.fetchone()
        return 200, {'ok': True, 'notes': due, 'next': nxt.isoformat() if nxt else None, 'serverNow': now.isoformat()}
    return work


def _ack_work(note_id, seq, mode, request, digest):
    def work(cur, schema, uid):
        cur.execute(f'SELECT request_hash,response FROM {schema}.pet_note_requests WHERE user_id=%s AND request_id=%s', (uid, request))
        previous = cur.fetchone()
        if previous:
            if previous[0] != digest:
                return error('notes_request_conflict', 'Этот запрос уже использован для другого действия.', 409)
            return 200, previous[1]
        cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s AND id=%s FOR UPDATE', (uid, note_id))
        row = cur.fetchone()
        if not row:
            return error('notes_not_found', 'Заметка не найдена. Возможно, она относится к другому аккаунту.', 404)
        if row[8] != 'active' or row[9] != seq:
            result = {'ok': True, 'action': mode, 'note': public(row), 'changed': False, 'stale': True}
        elif mode == 'done':
            cur.execute(f"UPDATE {schema}.pet_notes SET remind_state='done', remind_done_at=NOW(), remind_seq=remind_seq+1 WHERE user_id=%s AND id=%s RETURNING {COLS}", (uid, note_id))
            result = {'ok': True, 'action': 'done', 'note': public(cur.fetchone()), 'changed': True, 'stale': False}
        else:
            cur.execute(f"UPDATE {schema}.pet_notes SET remind_at=NOW()+INTERVAL '{reminders.SNOOZE_MINUTES} minutes', remind_seq=remind_seq+1 WHERE user_id=%s AND id=%s RETURNING {COLS}", (uid, note_id))
            result = {'ok': True, 'action': 'snooze', 'note': public(cur.fetchone()), 'changed': True, 'stale': False}
        cur.execute(f'INSERT INTO {schema}.pet_note_requests(user_id,request_id,request_hash,response) VALUES(%s,%s,%s,%s::jsonb)', (uid, request, digest, json.dumps(result, ensure_ascii=False)))
        return 200, result
    return work


def _remind_work(note_id, reminder, request, digest):
    def work(cur, schema, uid):
        cur.execute(f'SELECT request_hash,response FROM {schema}.pet_note_requests WHERE user_id=%s AND request_id=%s', (uid, request))
        previous = cur.fetchone()
        if previous:
            if previous[0] != digest:
                return error('notes_request_conflict', 'Этот запрос уже использован для другого действия.', 409)
            return 200, previous[1]
        spec = None
        if reminder is not None:
            try:
                spec = reminders.build(reminder['dueLocal'], reminder['tz'], reminder['lead'], reminders.utcnow())
            except reminders.ReminderError as exc:
                return error(exc.code, exc.message, 400)
        cur.execute(f'SELECT {COLS} FROM {schema}.pet_notes WHERE user_id=%s AND id=%s FOR UPDATE', (uid, note_id))
        row = cur.fetchone()
        if not row:
            return error('notes_not_found', 'Заметка не найдена. Возможно, она относится к другому аккаунту.', 404)
        if spec is None and row[4] is None:
            result = {'ok': True, 'action': 'remind', 'note': public(row), 'changed': False}
        else:
            result = {'ok': True, 'action': 'remind', 'note': public(_update_note(cur, schema, uid, note_id, spec=spec)), 'changed': True}
        cur.execute(f'INSERT INTO {schema}.pet_note_requests(user_id,request_id,request_hash,response) VALUES(%s,%s,%s,%s::jsonb)', (uid, request, digest, json.dumps(result, ensure_ascii=False)))
        return 200, result
    return work


def handle_api(data, headers, connect, schema):
    kind = data.get('notesApi')
    if kind is None:
        return None
    if kind == 'list':
        query = str(data.get('query') or '').strip()
        if len(query) > 200:
            return error('bad_request', 'Запрос поиска слишком длинный.', 400)
        try:
            offset = _int_or_none(data.get('offset'), 0, MAX_NOTES) or 0
        except ValueError:
            return error('bad_request', 'Некорректный запрос списка.', 400)
        return _owner_call(headers, connect, schema, _list_work(query, offset), False)
    if kind == 'due':
        return _owner_call(headers, connect, schema, _due_work(), False)
    if kind == 'ack':
        request = data.get('requestId', '')
        mode = data.get('mode')
        try:
            note_id = _int_or_none(data.get('id'), 1, 9223372036854775807)
            seq = _int_or_none(data.get('seq'), 0, 2147483647)
        except ValueError:
            return error('bad_request', 'Некорректный запрос.', 400)
        if note_id is None or seq is None or mode not in ('done', 'snooze'):
            return error('bad_request', 'Некорректный запрос.', 400)
        if not isinstance(request, str) or not ID.fullmatch(request):
            return error('notes_client_update', 'Для заметок требуется обновлённое приложение PetAgent.', 400)
        digest = hashlib.sha256(json.dumps({'api': 'ack', 'id': note_id, 'seq': seq, 'mode': mode}, sort_keys=True).encode()).hexdigest()
        return _owner_call(headers, connect, schema, _ack_work(note_id, seq, mode, request, digest), True)
    if kind == 'remind':
        request = data.get('requestId', '')
        try:
            note_id = _int_or_none(data.get('id'), 1, 9223372036854775807)
            reminder = _reminder_arg(data['reminder'] if 'reminder' in data else KEEP)
        except ValueError:
            return error('bad_request', 'Некорректный запрос.', 400)
        except reminders.ReminderError as exc:
            return error(exc.code, exc.message, 400)
        if note_id is None or reminder is KEEP:
            return error('bad_request', 'Некорректный запрос.', 400)
        if not isinstance(request, str) or not ID.fullmatch(request):
            return error('notes_client_update', 'Для заметок требуется обновлённое приложение PetAgent.', 400)
        digest = hashlib.sha256(json.dumps({'api': 'remind', 'id': note_id, 'r': reminder}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        return _owner_call(headers, connect, schema, _remind_work(note_id, reminder, request, digest), True)
    if kind == 'save':
        text = str(data.get('text') or '').strip()
        request = data.get('requestId', '')
        try:
            note_id = _int_or_none(data.get('id'), 1, 9223372036854775807)
            expected = _int_or_none(data.get('expectedVersion'), 1, 2147483647)
            reminder = _reminder_arg(data['reminder'] if 'reminder' in data else KEEP)
        except ValueError:
            return error('bad_request', 'Некорректный запрос сохранения.', 400)
        except reminders.ReminderError as exc:
            return error(exc.code, exc.message, 400)
        if not isinstance(request, str) or not ID.fullmatch(request):
            return error('notes_client_update', 'Для заметок требуется обновлённое приложение PetAgent.', 400)
        if not text:
            return error('notes_empty', 'Напиши текст заметки. Ничего не сохранено.', 400)
        if len(text) > MAX_TEXT:
            return error('notes_too_long', 'Текст заметки слишком длинный. Допустимо 1800 символов. Ничего не сохранено.', 400)
        marker = 'keep' if reminder is KEEP else reminder
        digest = hashlib.sha256(json.dumps({'api': 'save', 'id': note_id, 'text': text, 'v': expected, 'r': marker}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        return _owner_call(headers, connect, schema, _save_work(note_id, text, expected, request, digest, reminder), True)
    return error('bad_request', 'Неизвестная команда блокнота.', 400)

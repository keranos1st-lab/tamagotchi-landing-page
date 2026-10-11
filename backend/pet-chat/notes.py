"""Account-owned note commands. Explicit routing; no model can invent a write result."""
import hashlib
import json
import re

MAX_TEXT = 1800
MAX_NOTES = 500
DAILY_COMMANDS = 1000
LIST_LIMIT = 30
API_UNAVAILABLE = 'Не удалось выполнить действие. Блокнот временно недоступен, повтори попытку.'
ID = re.compile(r'^[A-Za-z0-9_-]{8,96}$')

QUICK_CREATE = re.compile(r'^(?:(?:запиши|сохрани|добавь|занеси|внеси)\s+(?:мне\s+)?(?:это\s+)?(?:в|во)\s+(?:мой\s+|моё\s+|мои\s+)?(?:блокнот|заметки|заметку)|запиши(?:\s+мне)?(?=\s*,?\s+что(?:\s|$))|сделай\s+(?:мне\s+)?(?:новую\s+)?заметку)\b(.*)$', re.I | re.S)


def parse(message, name=''):
    text = str(message or '').strip()
    names = ['кодик', 'питомец'] + ([name] if isinstance(name, str) and 0 < len(name) <= 80 else [])
    prefix = '|'.join(re.escape(n) for n in names)
    text = re.sub(rf'^(?:эй\s+)?(?:{prefix})(?:\s*[,!:]\s*|\s+(?=(?:пожалуйста|запиши|сохрани|создай|сделай|занеси|внеси|добавь|найди|покажи|прочитай|исправь|измени|обнови|перепиши)\b))', '', text, flags=re.I)
    text = re.sub(r'^пожалуйста[,\s]+', '', text, flags=re.I)
    text = re.sub(r'^(найди|покажи|прочитай|исправь|измени|обнови|перепиши)\s+последнюю\s+заметку\b', r'\1 заметку последнюю', text, flags=re.I)
    quick = QUICK_CREATE.match(text)
    if quick:
        body = re.sub(r'^(?:что\b[\s,:]*)', '', quick[1].strip().lstrip(':,—–').strip(), flags=re.I).strip()
        return {'action': 'create', 'text': body, 'query': ''}
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
    return {'id': row[0], 'text': row[1], 'version': row[2], 'updatedAt': row[3].isoformat()}


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
        cur.execute(f'SELECT id, text, version, updated_at FROM {schema}.pet_notes WHERE user_id=%s AND id=%s', (uid, number))
    elif re.fullmatch(r'последн(?:юю|яя|ие|ей)(?:\s+заметк[ауи])?', query, re.I):
        cur.execute(f'SELECT id, text, version, updated_at FROM {schema}.pet_notes WHERE user_id=%s ORDER BY created_at DESC, id DESC LIMIT 1', (uid,))
    else:
        query = re.sub(r'^(?:про|о|об|по теме)\s+', '', query, flags=re.I)
        words = re.findall(r'[0-9A-Za-zА-Яа-яЁё]+', query)[:12]
        stems = [stem(w) for w in words]
        cur.execute(f'SELECT id, text, version, updated_at FROM {schema}.pet_notes WHERE user_id=%s ORDER BY updated_at DESC, id DESC LIMIT {MAX_NOTES}', (uid,))
        rows = cur.fetchall()
        return [row for row in rows if stems and matches_text(row[1], stems)][:6]
    return cur.fetchall()


def perform(cur, schema, uid, command):
    action, text, query = command['action'], command['text'], command['query']
    if action in ('create', 'update') and not text:
        return response('Скажи полный текст заметки. Для исправления: «исправь заметку номер 12: новый текст». Ничего не изменено.', action)
    if len(text) > MAX_TEXT or len(query) > 200:
        return response('Текст заметки слишком длинный. Допустимо 1800 символов, запрос поиска — до 200. Ничего не изменено.', action)
    if action == 'create':
        cur.execute(f'SELECT COUNT(*) FROM {schema}.pet_notes WHERE user_id=%s', (uid,))
        if cur.fetchone()[0] >= MAX_NOTES:
            return response('В блокноте уже 500 заметок. Новая заметка не сохранена.', action)
        cur.execute(f'INSERT INTO {schema}.pet_notes(user_id,text) VALUES(%s,%s) RETURNING id,text,version,updated_at', (uid, text))
        note = public(cur.fetchone())
        return response(f'Записал заметку номер {note["id"]}: {text}', action, [note], changed=True)
    if action == 'update' and not query:
        return response('Укажи номер или тему заметки, которую нужно исправить. Ничего не изменено.', action)
    found = selector(cur, schema, uid, query)
    if not found:
        return response('В твоём блокноте такой заметки не нашёл. Ничего не изменено.' if action == 'update' else 'В твоём блокноте таких заметок не нашёл.', action)
    if action == 'update':
        if len(found) != 1:
            choices = ', '.join(str(row[0]) for row in found[:5])
            return response(f'Нашёл несколько заметок: номера {choices}. Уточни номер и повтори новый текст. Ничего не изменено.', action, [public(row) for row in found[:5]])
        cur.execute(f'UPDATE {schema}.pet_notes SET text=%s,version=version+1,updated_at=NOW() WHERE user_id=%s AND id=%s RETURNING id,text,version,updated_at', (text, uid, found[0][0]))
        note = public(cur.fetchone())
        return response(f'Исправил заметку номер {note["id"]}: {text}', action, [note], changed=True)
    notes = [public(row) for row in found[:5]]
    reply = '\n\n'.join(f'Заметка №{n["id"]}: {n["text"]}' for n in notes)
    if len(found) > 5:
        reply += '\n\nЕсть ещё совпадения. Уточни тему поиска.'
    spoken = reply if len(notes) == 1 else f'Нашёл {"как минимум " if len(found)>5 else ""}{len(notes)} заметок. ' + ' '.join(f'Номер {n["id"]}: {n["text"][:100]}.' for n in notes)
    return response(reply, action, notes, spoken=spoken[:1600])


def handle(data, headers, connect, schema):
    if data.get('task'):
        return None
    pet = data.get('pet')
    command = parse(data.get('message'), pet.get('name', '') if isinstance(pet, dict) else '')
    if command is None:
        return None
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
            cur.execute(f'SELECT id, text, version, updated_at FROM {schema}.pet_notes WHERE user_id=%s ORDER BY updated_at DESC, id DESC LIMIT {LIST_LIMIT} OFFSET {int(offset)}', (uid,))
            rows = cur.fetchall()
        else:
            stems = [stem(w) for w in re.findall(r'[0-9A-Za-zА-Яа-яЁё]+', query)[:12]]
            cur.execute(f'SELECT id, text, version, updated_at FROM {schema}.pet_notes WHERE user_id=%s ORDER BY updated_at DESC, id DESC LIMIT {MAX_NOTES}', (uid,))
            matched = [row for row in cur.fetchall() if stems and matches_text(row[1], stems)]
            total = len(matched)
            rows = matched[offset:offset + LIST_LIMIT]
        items = [public(row) for row in rows]
        return 200, {'ok': True, 'notes': items, 'total': total, 'offset': offset, 'limit': LIST_LIMIT, 'hasMore': offset + len(items) < total}
    return work


def _save_work(note_id, text, expected, request, digest):
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
        if note_id is None:
            cur.execute(f'SELECT COUNT(*) FROM {schema}.pet_notes WHERE user_id=%s', (uid,))
            if cur.fetchone()[0] >= MAX_NOTES:
                return error('notes_full', 'В блокноте уже 500 заметок. Новая заметка не сохранена.', 409)
            cur.execute(f'INSERT INTO {schema}.pet_notes(user_id,text) VALUES(%s,%s) RETURNING id,text,version,updated_at', (uid, text))
            result = {'ok': True, 'action': 'create', 'note': public(cur.fetchone()), 'changed': True}
        else:
            cur.execute(f'SELECT id, text, version, updated_at FROM {schema}.pet_notes WHERE user_id=%s AND id=%s FOR UPDATE', (uid, note_id))
            row = cur.fetchone()
            if not row:
                return error('notes_not_found', 'Заметка не найдена. Возможно, она относится к другому аккаунту.', 404)
            if expected is not None and row[2] != expected:
                return 409, {'error': 'notes_version_conflict', 'message': 'Заметка уже изменена в другом месте. Твой текст сохранён в окне.', 'retryable': False, 'current': public(row)}
            if row[1] == text:
                result = {'ok': True, 'action': 'update', 'note': public(row), 'changed': False}
            else:
                cur.execute(f'UPDATE {schema}.pet_notes SET text=%s,version=version+1,updated_at=NOW() WHERE user_id=%s AND id=%s RETURNING id,text,version,updated_at', (text, uid, note_id))
                result = {'ok': True, 'action': 'update', 'note': public(cur.fetchone()), 'changed': True}
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
    if kind == 'save':
        text = str(data.get('text') or '').strip()
        request = data.get('requestId', '')
        try:
            note_id = _int_or_none(data.get('id'), 1, 9223372036854775807)
            expected = _int_or_none(data.get('expectedVersion'), 1, 2147483647)
        except ValueError:
            return error('bad_request', 'Некорректный запрос сохранения.', 400)
        if not isinstance(request, str) or not ID.fullmatch(request):
            return error('notes_client_update', 'Для заметок требуется обновлённое приложение PetAgent.', 400)
        if not text:
            return error('notes_empty', 'Напиши текст заметки. Ничего не сохранено.', 400)
        if len(text) > MAX_TEXT:
            return error('notes_too_long', 'Текст заметки слишком длинный. Допустимо 1800 символов. Ничего не сохранено.', 400)
        digest = hashlib.sha256(json.dumps({'api': 'save', 'id': note_id, 'text': text, 'v': expected}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        return _owner_call(headers, connect, schema, _save_work(note_id, text, expected, request, digest), True)
    return error('bad_request', 'Неизвестная команда блокнота.', 400)

"""
AI-чат питомца PetAgent через сервис Польза (polza.ai).
Отвечает в характере питомца, учитывает его состояние, историю беседы и
память, на которую пользователь дал согласие. Помогает с текстом:
объяснить, сократить, исправить, помочь ответить. Ограничивает длину,
частоту запросов и суточный бюджет, ведёт учёт расхода в БД.
"""
import json
import os
import re
import time
import urllib.error
import urllib.request

import psycopg2

API_URL = 'https://polza.ai/api/v1/chat/completions'
DEFAULT_MODEL = 'openai/gpt-4o-mini'
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')

MAX_MESSAGE = 2000
MAX_SOURCE = 6000
MAX_HISTORY = 10
MAX_HISTORY_CHARS = 6000
MAX_MEMORY = 20
PER_MINUTE = 6
PER_DAY_CLIENT = int(os.environ.get('PET_AI_DAILY_PER_USER') or 60)
PER_DAY_IP = int(os.environ.get('PET_AI_DAILY_PER_IP') or 150)
DAILY_BUDGET_RUB = float(os.environ.get('PET_AI_DAILY_BUDGET_RUB') or 150)
EST_COST = 0.3

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
    'Access-Control-Max-Age': '86400',
}

PERSONAS = {
    'cat': ('Кодик — котик-робот и программист', 'любит код и айтишные шутки, иногда говорит «мур»'),
    'dog': ('собачка-робот', 'преданный и жизнерадостный, иногда говорит «гав!»'),
    'bird': ('птичка-робот', 'лёгкая и музыкальная, иногда говорит «чирик!»'),
    'fox': ('лисичка-робот', 'хитрая и находчивая, любит лайфхаки, иногда говорит «фыр»'),
    'dragon': ('дракончик-робот', 'смелый и немного пафосный, любит огненные метафоры, иногда говорит «рррр!»'),
    'bunny': ('зайчик-робот', 'быстрый и заботливый, предлагает двигаться маленькими шагами, иногда говорит «прыг!»'),
    'panda': ('панда-робот', 'спокойная и неторопливая, советует без суеты, иногда говорит «урр»'),
    'owl': ('сова-робот', 'мудрая наставница, объясняет по шагам как учитель, иногда говорит «угу»'),
}

STAGE_VOICE = {
    'baby': 'Ты ещё малыш: говоришь тепло и чуть по-детски, но сами объяснения — взрослые и точные.',
    'teen': 'Ты подросток: говоришь бодро и уверенно.',
    'adult': 'Ты взрослый питомец: говоришь спокойно и уверенно, как опытный напарник.',
}

TEXT_ACTIONS = {
    'explain': 'Объясни простыми словами, о чём этот текст и в чём его главная мысль. Если есть термины — поясни их.',
    'shorten': 'Сократи этот текст примерно в 2–3 раза, сохранив смысл и важные факты. Выведи только готовый сокращённый вариант, без вступлений.',
    'fix': 'Исправь ошибки в этом тексте: орфографию, пунктуацию, грамматику, явные логические ошибки (или ошибки в коде). Сначала выведи исправленный текст целиком, затем коротким списком — что изменено. Смысл и стиль не меняй.',
    'reply': 'Это сообщение, на которое пользователю нужно ответить. Предложи 2 варианта ответа: вежливый нейтральный и более тёплый/неформальный. Каждый — готовый к отправке текст.',
}

ERRORS = {
    'no_key': 'Не настроен ключ AI (секрет POLZA_AI_API_KEY)',
    'bad_key': 'Ключ AI недействителен',
    'no_balance': 'На балансе сервиса AI закончились средства',
    'rate_minute': 'Слишком часто — подожди минуту',
    'daily_user': 'Дневной лимит сообщений исчерпан',
    'daily_ip': 'Дневной лимит сообщений с этой сети исчерпан',
    'budget': 'Дневной бюджет AI исчерпан',
    'too_long': 'Сообщение слишком длинное',
    'empty': 'Пустое сообщение',
    'timeout': 'AI не успел ответить',
    'provider_error': 'Сервис AI временно недоступен',
    'provider_busy': 'Сервис AI перегружен',
    'bad_request': 'Некорректный запрос',
    'db_error': 'Не удалось проверить лимиты',
}


def respond(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': {**CORS, 'Content-Type': 'application/json'},
        'body': json.dumps(body, ensure_ascii=False),
    }


def fail(status: int, code: str, retryable: bool, extra: dict | None = None) -> dict:
    return respond(status, {'error': code, 'message': ERRORS.get(code, code), 'retryable': retryable, **(extra or {})})


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def esc(v: str) -> str:
    return v.replace("'", "''")


def usage(client_id: str, ip: str) -> dict:
    conn = db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND created_at > NOW() - INTERVAL '1 minute'), "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND created_at > date_trunc('day', NOW()) AND status = 'ok'), "
            f"COUNT(*) FILTER (WHERE ip = '{esc(ip)}' AND created_at > date_trunc('day', NOW()) AND status = 'ok'), "
            f"COALESCE(SUM(cost) FILTER (WHERE created_at > date_trunc('day', NOW())), 0) "
            f"FROM {SCHEMA}.ai_requests WHERE created_at > date_trunc('day', NOW()) - INTERVAL '1 minute'"
        )
        m, d, dip, spent = cur.fetchone()
        return {'minute': m, 'day': d, 'day_ip': dip, 'spent': float(spent)}
    finally:
        conn.close()


def log(client_id: str, ip: str, kind: str, status: str, pt: int = 0, ct: int = 0, cost: float = 0.0) -> None:
    conn = db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.ai_requests (client_id, ip, kind, status, prompt_tokens, completion_tokens, cost) "
            f"VALUES ('{esc(client_id)}', '{esc(ip)}', '{esc(kind)}', '{esc(status)}', {int(pt)}, {int(ct)}, {float(cost)})"
        )
        conn.commit()
    finally:
        conn.close()


def mood_line(stats: dict) -> str:
    h = stats.get('hunger', 100)
    hp = stats.get('happiness', 100)
    en = stats.get('energy', 100)
    he = stats.get('health', 100)
    notes = []
    if h < 30:
        notes.append('голоден — в самом конце можно одной фразой мило попросить покормить')
    if hp < 30:
        notes.append('грустит — в конце можно попросить поиграть')
    if en < 25:
        notes.append('устал — тон чуть сонный, в конце можно намекнуть на сон')
    if he < 40:
        notes.append('нездоровится — в конце можно попросить полечить')
    if not notes:
        return 'Самочувствие отличное — тон бодрый.' if min(h, hp, en, he) > 80 else 'Самочувствие нормальное.'
    return 'Сейчас ты ' + '; '.join(notes) + '. Упоминай состояние максимум одной короткой фразой в конце и только если это уместно.'


def build_system(pet: dict, memory: list, task: bool) -> str:
    ptype = pet.get('type') if pet.get('type') in PERSONAS else 'cat'
    who, traits = PERSONAS[ptype]
    name = str(pet.get('name') or 'Питомец')[:40]
    stage = pet.get('stage') if pet.get('stage') in STAGE_VOICE else 'baby'
    level = int(pet.get('level') or 1)
    lines = [
        f'Ты — {name}, {who} в приложении PetAgent: виртуальный питомец и AI-помощник пользователя. Характер: {traits}.',
        f'Уровень {level}. {STAGE_VOICE[stage]}',
        mood_line(pet.get('stats') or {}),
        'Главное правило: характер влияет только на тон и 1–2 короткие реплики в начале или конце. '
        'Суть ответа должна быть максимально точной, полной и полезной — как у лучшего ассистента. '
        'Не упрощай и не искажай факты ради образа.',
        'Отвечай на русском, если пользователь не пишет на другом языке. Используй markdown: списки, **жирный**, блоки ``` для кода. '
        'Не выдумывай факты; если не уверен — прямо скажи. По медицине, праву и финансам давай общую информацию и советуй специалиста. '
        'Не больше 1–2 эмодзи. Не называй себя языковой моделью.',
    ]
    if task:
        lines.append('Сейчас пользователь просит помочь с текстом: выполни задачу точно, реплики персонажа — не более одной короткой фразы.')
    if memory:
        facts = '\n'.join(f'- {m}' for m in memory)
        lines.append('Пользователь разрешил тебе помнить о нём следующее (используй только если уместно, не пересказывай список):\n' + facts)
    lines.append(
        'Если пользователь в последнем сообщении сообщает о себе устойчивый факт (как его зовут, цель, предпочтение), '
        'добавь в самом конце ответа отдельную строку ровно в формате <<remember: краткий факт в 3-я лице>>. '
        'Не больше одной такой строки, не добавляй её для временных или чувствительных данных (здоровье, деньги, адреса, пароли).'
    )
    return '\n'.join(lines)


def clean_history(history: list) -> list:
    out, total = [], 0
    for m in reversed(history[-MAX_HISTORY:]):
        text = str(m.get('text') or '').strip()
        if not text:
            continue
        text = text[:1500]
        if total + len(text) > MAX_HISTORY_CHARS:
            break
        total += len(text)
        out.append({'role': 'assistant' if m.get('role') == 'pet' else 'user', 'content': text})
    out.reverse()
    while out and out[0]['role'] == 'assistant':
        out.pop(0)
    return out


def call_model(messages: list, max_tokens: int, timeout: float) -> tuple:
    payload = json.dumps({
        'model': os.environ.get('POLZA_AI_MODEL') or DEFAULT_MODEL,
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': 0.6,
    }).encode('utf-8')
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={'Authorization': f"Bearer {os.environ['POLZA_AI_API_KEY']}", 'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8')), resp.status


def status_info(client_id: str, ip: str) -> dict:
    info = {
        'configured': bool(os.environ.get('POLZA_AI_API_KEY')),
        'model': os.environ.get('POLZA_AI_MODEL') or DEFAULT_MODEL,
        'limits': {'perMinute': PER_MINUTE, 'perDay': PER_DAY_CLIENT, 'maxMessage': MAX_MESSAGE, 'maxSource': MAX_SOURCE},
    }
    try:
        u = usage(client_id, ip)
        info['usedToday'] = u['day']
        info['remainingToday'] = max(0, PER_DAY_CLIENT - u['day'])
        info['budgetOk'] = u['spent'] < DAILY_BUDGET_RUB
    except Exception as e:
        print(f'status db error: {e}')
        info['dbOk'] = False
    return info


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    client_id = re.sub(r'[^a-zA-Z0-9_-]', '', headers.get('x-client-id') or '')[:64] or 'anon'
    ip = ((event.get('requestContext') or {}).get('identity') or {}).get('sourceIp') or ''

    if method == 'GET':
        return respond(200, status_info(client_id, ip))
    if method != 'POST':
        return fail(405, 'bad_request', False)

    if not os.environ.get('POLZA_AI_API_KEY'):
        return fail(503, 'no_key', False)

    try:
        data = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return fail(400, 'bad_request', False)

    pet = data.get('pet') or {}
    message = str(data.get('message') or '').strip()
    task = data.get('task') or None
    memory = [str(x)[:200] for x in (data.get('memory') or [])[:MAX_MEMORY] if str(x).strip()]

    if task:
        action = task.get('action')
        source = str(task.get('source') or '').strip()
        if action not in TEXT_ACTIONS or not source:
            return fail(400, 'empty', False)
        if len(source) > MAX_SOURCE:
            return fail(413, 'too_long', False, {'limit': MAX_SOURCE})
        note = f'\n\nДополнительно от пользователя: {message[:500]}' if message else ''
        user_content = f'{TEXT_ACTIONS[action]}{note}\n\nТекст:\n"""\n{source}\n"""'
    else:
        if not message:
            return fail(400, 'empty', False)
        if len(message) > MAX_MESSAGE:
            return fail(413, 'too_long', False, {'limit': MAX_MESSAGE})
        user_content = message

    try:
        u = usage(client_id, ip)
    except Exception as e:
        print(f'usage db error: {e}')
        return fail(503, 'db_error', True)
    if u['minute'] >= PER_MINUTE:
        return fail(429, 'rate_minute', True, {'retryAfter': 60})
    if u['day'] >= PER_DAY_CLIENT:
        return fail(429, 'daily_user', False, {'limit': PER_DAY_CLIENT})
    if u['day_ip'] >= PER_DAY_IP:
        return fail(429, 'daily_ip', False)
    if u['spent'] >= DAILY_BUDGET_RUB:
        return fail(429, 'budget', False)

    messages = [{'role': 'system', 'content': build_system(pet, memory, bool(task))}]
    messages += clean_history(data.get('history') or [])
    messages.append({'role': 'user', 'content': user_content})

    kind = f"text:{task['action']}" if task else 'chat'
    max_tokens = 1400 if task else 1100
    started = time.time()
    try:
        result, _ = call_model(messages, max_tokens, 25)
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:300]
        print(f'Polza HTTP {e.code}: {detail}')
        code = 'no_balance' if e.code == 402 else 'bad_key' if e.code in (401, 403) else 'provider_busy' if e.code == 429 else 'provider_error'
        log(client_id, ip, kind, code)
        return fail(502, code, code in ('provider_busy', 'provider_error'))
    except Exception as e:
        print(f'Polza error after {time.time() - started:.1f}s: {e}')
        log(client_id, ip, kind, 'timeout')
        return fail(504, 'timeout', True)

    choice = (result.get('choices') or [{}])[0]
    reply = (choice.get('message') or {}).get('content') or ''
    usage_info = result.get('usage') or {}
    pt = int(usage_info.get('prompt_tokens') or 0)
    ct = int(usage_info.get('completion_tokens') or 0)
    cost = usage_info.get('cost')
    cost = float(cost) if isinstance(cost, (int, float)) else EST_COST
    if not reply.strip():
        log(client_id, ip, kind, 'empty_reply', pt, ct, cost)
        return fail(502, 'provider_error', True)

    remember = None
    m = re.search(r'<<\s*remember:\s*(.+?)>>', reply, re.IGNORECASE)
    if m:
        remember = m.group(1).strip()[:200]
        reply = re.sub(r'\s*<<\s*remember:.*?>>\s*', '', reply, flags=re.IGNORECASE | re.DOTALL)

    log(client_id, ip, kind, 'ok', pt, ct, cost)
    return respond(200, {
        'reply': reply.strip(),
        'remember': remember,
        'truncated': choice.get('finish_reason') == 'length',
        'model': result.get('model'),
        'remainingToday': max(0, PER_DAY_CLIENT - u['day'] - 1),
        'ms': int((time.time() - started) * 1000),
    })

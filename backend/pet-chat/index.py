"""
AI-чат питомца PetAgent через сервис Польза (polza.ai).
Отвечает в характере питомца, учитывает его состояние, историю беседы и
память, на которую пользователь дал согласие. Помогает с текстом:
объяснить, сократить, исправить, помочь ответить. Ограничивает длину,
частоту запросов и суточный бюджет, ведёт учёт расхода в БД.
Маршрут ?voice=1 озвучивает ответ питомца через ElevenLabs (ключ и голос — только
в серверных секретах ELEVENLABS_API_KEY и ELEVENLABS_VOICE_ID).
Пользователь может передать свой ключ (X-User-Ai-Key) к Польза, OpenAI,
OpenRouter или DeepSeek — тогда запрос идёт за его счёт, ключ не сохраняется.
"""
import base64
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
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id, X-User-Ai-Key, X-User-Ai-Provider, X-User-Ai-Model',
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

PROVIDERS = {
    'polza': ('https://polza.ai/api/v1/chat/completions', 'openai/gpt-4o-mini'),
    'openai': ('https://api.openai.com/v1/chat/completions', 'gpt-4o-mini'),
    'openrouter': ('https://openrouter.ai/api/v1/chat/completions', 'openai/gpt-4o-mini'),
    'deepseek': ('https://api.deepseek.com/chat/completions', 'deepseek-chat'),
}
VOICE_MAX_CHARS = 450
VOICE_PER_MINUTE = 6
VOICE_PER_DAY = int(os.environ.get('PET_VOICE_DAILY_PER_USER') or 40)
VOICE_CHARS_PER_DAY = int(os.environ.get('PET_VOICE_DAILY_CHARS') or 8000)
VOICE_MODEL = os.environ.get('ELEVENLABS_MODEL') or 'eleven_multilingual_v2'
VOICE_ID_RE = re.compile(r'^[A-Za-z0-9]{10,40}$')
OWN_PER_MINUTE = 20
OWN_PER_DAY = 500

ERRORS = {
    'voice_no_key': 'Озвучивание не настроено: на сервере нет секрета ELEVENLABS_API_KEY',
    'voice_no_voice': 'Озвучивание не настроено: на сервере нет секрета ELEVENLABS_VOICE_ID',
    'voice_bad_voice': 'Идентификатор голоса в ELEVENLABS_VOICE_ID некорректен',
    'voice_bad_key': 'ElevenLabs не принял ключ API — проверьте ELEVENLABS_API_KEY',
    'voice_not_found': 'Выбранный голос недоступен для этого ключа ElevenLabs',
    'voice_quota': 'Лимит символов или баланс ElevenLabs исчерпан',
    'voice_busy': 'ElevenLabs временно перегружен',
    'voice_error': 'ElevenLabs временно недоступен',
    'voice_empty_text': 'Нечего озвучивать',
    'voice_too_long': 'Текст для озвучивания слишком длинный',
    'voice_rate': 'Слишком много голосовых запросов — подождите минуту',
    'voice_daily': 'Дневной лимит озвучивания исчерпан',
    'no_key': 'Не настроен ключ AI (секрет POLZA_AI_API_KEY)',
    'bad_key': 'Ключ AI недействителен',
    'own_bad_key': 'Ваш ключ отклонён сервисом — проверьте его в настройках AI',
    'own_no_balance': 'На вашем аккаунте сервиса AI закончились средства',
    'own_bad_model': 'Сервис не принял модель — проверьте название в настройках AI',
    'own_bad_provider': 'Неизвестный сервис AI',
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


def usage(client_id: str, ip: str, own: bool = False) -> dict:
    conn = db()
    try:
        cur = conn.cursor()
        k = 'TRUE' if own else 'FALSE'
        cur.execute(
            f"SELECT "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND own_key = {k} AND kind <> 'voice' AND created_at > NOW() - INTERVAL '1 minute'), "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND own_key = {k} AND kind <> 'voice' AND created_at > date_trunc('day', NOW()) AND status = 'ok'), "
            f"COUNT(*) FILTER (WHERE ip = '{esc(ip)}' AND own_key = {k} AND kind <> 'voice' AND created_at > date_trunc('day', NOW()) AND status = 'ok'), "
            f"COALESCE(SUM(cost) FILTER (WHERE own_key = FALSE AND kind <> 'voice' AND created_at > date_trunc('day', NOW())), 0) "
            f"FROM {SCHEMA}.ai_requests WHERE created_at > date_trunc('day', NOW()) - INTERVAL '1 minute'"
        )
        m, d, dip, spent = cur.fetchone()
        return {'minute': m, 'day': d, 'day_ip': dip, 'spent': float(spent)}
    finally:
        conn.close()


def log(client_id: str, ip: str, kind: str, status: str, pt: int = 0, ct: int = 0, cost: float = 0.0, own: bool = False) -> None:
    conn = db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.ai_requests (client_id, ip, kind, status, prompt_tokens, completion_tokens, cost, own_key) "
            f"VALUES ('{esc(client_id)}', '{esc(ip)}', '{esc(kind)}', '{esc(status)}', {int(pt)}, {int(ct)}, {float(cost)}, {'TRUE' if own else 'FALSE'})"
        )
        conn.commit()
    finally:
        conn.close()


def voice_usage(client_id: str, ip: str) -> dict:
    conn = db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND created_at > NOW() - INTERVAL '1 minute'), "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND status = 'ok'), "
            f"COALESCE(SUM(prompt_tokens) FILTER (WHERE client_id = '{esc(client_id)}' AND status = 'ok'), 0), "
            f"COALESCE(SUM(prompt_tokens) FILTER (WHERE ip = '{esc(ip)}' AND status = 'ok'), 0) "
            f"FROM {SCHEMA}.ai_requests WHERE kind = 'voice' AND created_at > date_trunc('day', NOW()) - INTERVAL '1 minute'"
        )
        m, d, chars, chars_ip = cur.fetchone()
        return {'minute': int(m), 'day': int(d), 'chars': int(chars), 'chars_ip': int(chars_ip)}
    finally:
        conn.close()


def clean_for_speech(text: str) -> str:
    t = re.sub(r'```.*?```', ' ', text, flags=re.S)
    t = re.sub(r'`([^`]*)`', r'\1', t)
    t = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'https?://\S+', ' ', t)
    t = re.sub(r'[*_#>~|]+', ' ', t)
    t = re.sub(r'^\s*[-•]\s+', '', t, flags=re.M)
    t = re.sub(r'[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) > VOICE_MAX_CHARS:
        cut = t[:VOICE_MAX_CHARS]
        end = max(cut.rfind('. '), cut.rfind('! '), cut.rfind('? '))
        t = cut[: end + 1] if end > VOICE_MAX_CHARS * 0.5 else cut
    return t.strip()


def voice_config() -> tuple:
    key = (os.environ.get('ELEVENLABS_API_KEY') or '').strip()
    voice = (os.environ.get('ELEVENLABS_VOICE_ID') or '').strip()
    return key, voice


def voice_status() -> dict:
    key, voice = voice_config()
    return {
        'voice': {
            'configured': bool(key and voice and VOICE_ID_RE.match(voice)),
            'hasKey': bool(key),
            'hasVoiceId': bool(voice),
            'model': VOICE_MODEL,
            'maxChars': VOICE_MAX_CHARS,
            'perMinute': VOICE_PER_MINUTE,
            'perDay': VOICE_PER_DAY,
        }
    }


def handle_voice(event: dict, client_id: str, ip: str) -> dict:
    if event.get('httpMethod') == 'GET':
        return respond(200, voice_status())
    if event.get('httpMethod') != 'POST':
        return fail(405, 'bad_request', False)
    key, voice = voice_config()
    if not key:
        return fail(503, 'voice_no_key', False, {'fallback': 'local'})
    if not voice:
        return fail(503, 'voice_no_voice', False, {'fallback': 'local'})
    if not VOICE_ID_RE.match(voice):
        return fail(503, 'voice_bad_voice', False, {'fallback': 'local'})
    try:
        data = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return fail(400, 'bad_request', False)
    raw = str(data.get('text') or '')
    if len(raw) > 4000:
        return fail(413, 'voice_too_long', False)
    text = clean_for_speech(raw)
    if not text:
        return fail(400, 'voice_empty_text', False)

    try:
        u = voice_usage(client_id, ip)
    except Exception as e:
        print(f'voice usage db error: {type(e).__name__}')
        return fail(503, 'db_error', True, {'fallback': 'local'})
    if u['minute'] >= VOICE_PER_MINUTE:
        return fail(429, 'voice_rate', True, {'retryAfter': 60, 'fallback': 'local'})
    if u['day'] >= VOICE_PER_DAY or u['chars'] + len(text) > VOICE_CHARS_PER_DAY or u['chars_ip'] + len(text) > VOICE_CHARS_PER_DAY * 3:
        return fail(429, 'voice_daily', False, {'fallback': 'local'})

    payload = json.dumps({
        'text': text,
        'model_id': VOICE_MODEL,
        'language_code': 'ru',
        'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0.2, 'use_speaker_boost': True},
    }).encode('utf-8')
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_64',
        data=payload,
        headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
        method='POST',
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            audio = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:400].lower()
        print(f'ElevenLabs HTTP {e.code}')
        if e.code in (401, 403) and 'quota' not in detail:
            code = 'voice_bad_key'
        elif e.code == 404 or 'voice_not_found' in detail or 'not found' in detail:
            code = 'voice_not_found'
        elif e.code == 402 or 'quota' in detail or 'character' in detail:
            code = 'voice_quota'
        elif e.code == 429:
            code = 'voice_busy'
        elif e.code == 400 and 'paid_plan' in detail:
            code = 'voice_not_found'
        else:
            code = 'voice_error'
        log(client_id, ip, 'voice', code)
        return fail(502, code, code in ('voice_busy', 'voice_error'), {'fallback': 'local'})
    except Exception as e:
        print(f'ElevenLabs error: {type(e).__name__}')
        log(client_id, ip, 'voice', 'timeout')
        return fail(504, 'voice_error', True, {'fallback': 'local'})

    if len(audio) < 500:
        log(client_id, ip, 'voice', 'empty_audio')
        return fail(502, 'voice_error', True, {'fallback': 'local'})
    log(client_id, ip, 'voice', 'ok', pt=len(text), ct=len(audio) // 1000)
    return respond(200, {
        'audio': base64.b64encode(audio).decode('ascii'),
        'mime': 'audio/mpeg',
        'chars': len(text),
        'voiceId': voice,
        'model': VOICE_MODEL,
        'ms': int((time.time() - started) * 1000),
    })


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


def call_model(messages: list, max_tokens: int, timeout: float, own: dict | None = None) -> tuple:
    if own:
        url, model, key = own['url'], own['model'], own['key']
    else:
        url, model, key = API_URL, os.environ.get('POLZA_AI_MODEL') or DEFAULT_MODEL, os.environ['POLZA_AI_API_KEY']
    payload = json.dumps({
        'model': model,
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': 0.6,
    }).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=payload,
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'HTTP-Referer': 'https://petagent.app', 'X-Title': 'PetAgent'},
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

    if (event.get('queryStringParameters') or {}).get('voice'):
        return handle_voice(event, client_id, ip)

    own = None
    user_key = (headers.get('x-user-ai-key') or '').strip()
    if user_key:
        provider = (headers.get('x-user-ai-provider') or 'polza').strip().lower()
        if provider not in PROVIDERS or len(user_key) > 300 or not re.fullmatch(r'[A-Za-z0-9_\-.:]+', user_key):
            return fail(400, 'own_bad_provider' if provider not in PROVIDERS else 'own_bad_key', False)
        url, default_model = PROVIDERS[provider]
        model = re.sub(r'[^A-Za-z0-9_\-./:]', '', headers.get('x-user-ai-model') or '')[:100] or default_model
        own = {'url': url, 'model': model, 'key': user_key, 'provider': provider}

    if method == 'GET':
        if own and (event.get('queryStringParameters') or {}).get('check'):
            return check_own(own)
        return respond(200, status_info(client_id, ip))
    if method != 'POST':
        return fail(405, 'bad_request', False)

    if not own and not os.environ.get('POLZA_AI_API_KEY'):
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

    is_own = own is not None
    try:
        u = usage(client_id, ip, is_own)
    except Exception as e:
        print(f'usage db error: {e}')
        return fail(503, 'db_error', True)
    if u['minute'] >= (OWN_PER_MINUTE if is_own else PER_MINUTE):
        return fail(429, 'rate_minute', True, {'retryAfter': 60})
    if is_own:
        if u['day'] >= OWN_PER_DAY:
            return fail(429, 'daily_user', False, {'limit': OWN_PER_DAY})
    else:
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
        result, _ = call_model(messages, max_tokens, 25, own)
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:300]
        print(f"{own['provider'] if own else 'polza'} HTTP {e.code}" + ('' if own else f': {detail}'))
        code = map_http_error(e.code, detail, is_own)
        log(client_id, ip, kind, code, own=is_own)
        return fail(502, code, code in ('provider_busy', 'provider_error'))
    except Exception as e:
        print(f'AI error after {time.time() - started:.1f}s: {type(e).__name__}')
        log(client_id, ip, kind, 'timeout', own=is_own)
        return fail(504, 'timeout', True)

    choice = (result.get('choices') or [{}])[0]
    reply = (choice.get('message') or {}).get('content') or ''
    usage_info = result.get('usage') or {}
    pt = int(usage_info.get('prompt_tokens') or 0)
    ct = int(usage_info.get('completion_tokens') or 0)
    cost = usage_info.get('cost')
    cost = 0.0 if is_own else float(cost) if isinstance(cost, (int, float)) else EST_COST
    if not reply.strip():
        log(client_id, ip, kind, 'empty_reply', pt, ct, cost, is_own)
        return fail(502, 'provider_error', True)

    remember = None
    m = re.search(r'<<\s*remember:\s*(.+?)>>', reply, re.IGNORECASE)
    if m:
        remember = m.group(1).strip()[:200]
        reply = re.sub(r'\s*<<\s*remember:.*?>>\s*', '', reply, flags=re.IGNORECASE | re.DOTALL)

    log(client_id, ip, kind, 'ok', pt, ct, cost, is_own)
    body = {
        'reply': reply.strip(),
        'remember': remember,
        'truncated': choice.get('finish_reason') == 'length',
        'model': result.get('model'),
        'ownKey': is_own,
        'ms': int((time.time() - started) * 1000),
    }
    if not is_own:
        body['remainingToday'] = max(0, PER_DAY_CLIENT - u['day'] - 1)
    return respond(200, body)


def map_http_error(status: int, detail: str, own: bool) -> str:
    low = detail.lower()
    if status == 402 or 'insufficient' in low or 'balance' in low or 'quota' in low:
        return 'own_no_balance' if own else 'no_balance'
    if status in (401, 403):
        return 'own_bad_key' if own else 'bad_key'
    if own and status in (400, 404) and 'model' in low:
        return 'own_bad_model'
    if status == 429:
        return 'provider_busy'
    return 'provider_error'


def check_own(own: dict) -> dict:
    try:
        call_model([{'role': 'user', 'content': 'Ответь одним словом: ок'}], 5, 15, own)
    except urllib.error.HTTPError as e:
        code = map_http_error(e.code, e.read().decode('utf-8', 'ignore')[:300], True)
        return fail(400, code, False)
    except Exception:
        return fail(504, 'timeout', True)
    return respond(200, {'ok': True, 'provider': own['provider'], 'model': own['model']})


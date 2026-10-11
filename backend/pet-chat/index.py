"""
AI-чат питомца PetAgent через сервис Польза (polza.ai).
Отвечает в характере питомца, учитывает его состояние, историю беседы и
память, на которую пользователь дал согласие. Помогает с текстом:
объяснить, сократить, исправить, помочь ответить. Ограничивает длину,
частоту запросов и суточный бюджет, ведёт учёт расхода в БД.
Маршрут ?voice=1 озвучивает ответ питомца через Yandex SpeechKit (ключ — только
в серверном секрете YANDEX_SPEECHKIT_API_KEY).
Пользователь может передать свой ключ (X-User-Ai-Key) к Польза, OpenAI,
OpenRouter или DeepSeek — тогда запрос идёт за его счёт, ключ не сохраняется.
"""
import base64
import concurrent.futures
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

import psycopg2

import websearch

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
SEARCH_MAX_TOKENS = 700
SEARCH_TIMEOUT = 30
SEARCH_PROMPT_RUB_PER_M = 118.986
SEARCH_COMPLETION_RUB_PER_M = 118.986
SEARCH_FEE_RUB = 0.595

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id, X-User-Ai-Key, X-User-Ai-Provider, X-User-Ai-Model',
    'Access-Control-Max-Age': '86400',
}

PERSONAS = {
    'cat': ('Кодик — котик-робот и программист', 'любит код и айтишные шутки, иногда говорит «мур»'),
    'dog': ('пушистая альпака-робот', 'мягкая, спокойная и тёплая, чуть любопытная и упрямая, иногда мягко мычит «мм-мм»'),
    'bird': ('птичка-робот', 'лёгкая и музыкальная, иногда говорит «чирик!»'),
    'fox': ('лисичка-робот', 'хитрая и находчивая, любит лайфхаки, иногда говорит «фыр»'),
    'dragon': ('дракончик-робот', 'смелый и немного пафосный, любит огненные метафоры, иногда говорит «рррр!»'),
    'bunny': ('зайчик-робот', 'быстрый и заботливый, предлагает двигаться маленькими шагами, иногда говорит «прыг!»'),
    'panda': ('панда-робот', 'спокойная и неторопливая, советует без суеты, иногда говорит «урр»'),
    'owl': ('сова-робот', 'мудрая наставница, объясняет по шагам как учитель, иногда говорит «угу»'),
}

IQ_SMART = 35
IQ_GENIUS = 70
IQ_TEXT_LIMIT = {'baby': 300, 'smart': 2000, 'genius': MAX_SOURCE}
IQ_NAMES = {'baby': 'Малыш', 'smart': 'Умный', 'genius': 'Гений'}
IQ_SOUND = {'cat': 'Мур!', 'dog': 'Мм-мм!', 'bird': 'Чирик!', 'fox': 'Фыр!', 'dragon': 'Рррр!', 'bunny': 'Прыг!', 'panda': 'Урр…', 'owl': 'Угу…'}
HARD_MARK = re.compile(r'\s*<<\s*hard\s*>>\s*', re.IGNORECASE)

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
VOICE_MAX_CHARS = 2000
VOICE_PER_MINUTE = 6
VOICE_PER_DAY = int(os.environ.get('PET_VOICE_DAILY_PER_USER') or 40)
VOICE_CHARS_PER_DAY = int(os.environ.get('PET_VOICE_DAILY_CHARS') or 30000)
STT_RATE = 16000
STT_MAX_BYTES = 1024 * 1024
STT_MAX_SECONDS = 30
STT_MIN_SECONDS = 0.4
STT_PER_MINUTE = 8
STT_PER_DAY = int(os.environ.get('PET_STT_DAILY_PER_USER') or 120)
STT_PER_DAY_IP = int(os.environ.get('PET_STT_DAILY_PER_IP') or 400)
YANDEX_DEFAULT_VOICE = 'denis'
YANDEX_V1_VOICES = {'alena', 'filipp', 'ermil', 'jane', 'omazh', 'zahar', 'madirus', 'oksana', 'alyss', 'nick', 'john', 'marina', 'dasha', 'julia', 'lera', 'masha', 'alexander', 'kirill', 'anton'}
YANDEX_V3_CHUNK = 240
YANDEX_DEFAULT_MODEL = 'livetts'
YANDEX_DEFAULT_ROLE = 'casual'
YANDEX_FALLBACK_VOICE = 'ermil'
YANDEX_DENIED_TTL = 600
_voice_denied: dict = {}
YANDEX_VOICE_RE = re.compile(r'^[a-z_]{3,30}$')
YANDEX_TOKEN_RE = re.compile(r'^[a-z0-9_.\-]{1,40}$')
YANDEX_EMOTION_VOICES = {'alena', 'filipp', 'ermil', 'jane', 'omazh', 'zahar', 'madirus'}
OWN_PER_MINUTE = 20
OWN_PER_DAY = 500

ERRORS = {
    'yandex_bad_key': 'Yandex SpeechKit не принял ключ — проверьте YANDEX_SPEECHKIT_API_KEY',
    'yandex_no_permission': 'У ключа Yandex нет доступа к синтезу речи — сервисному аккаунту нужна роль ai.speechkit-tts.user',
    'yandex_quota': 'Лимит Yandex SpeechKit исчерпан или превышена частота запросов',
    'yandex_bad_request': 'Yandex SpeechKit отклонил запрос — проверьте голос в YANDEX_SPEECHKIT_VOICE',
    'stt_bad_audio': 'Не удалось прочитать запись голоса',
    'stt_too_short': 'Слишком короткая запись — скажите фразу подлиннее',
    'stt_too_long': 'Слишком длинная запись — говорите не дольше 30 секунд',
    'stt_too_big': 'Запись слишком большая (больше 1 МБ)',
    'stt_no_speech': 'Речь не распознана — попробуйте сказать ещё раз',
    'stt_no_permission': 'У ключа Yandex нет права на распознавание речи — сервисному аккаунту нужна роль ai.speechkit-stt.user',
    'stt_rate': 'Слишком много голосовых запросов — подождите минуту',
    'stt_daily': 'Дневной лимит распознавания речи исчерпан',
    'voice_no_key': 'Озвучивание не настроено: на сервере нет секрета YANDEX_SPEECHKIT_API_KEY',
    'voice_error': 'Yandex SpeechKit временно недоступен',
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
    'search_failed': 'Свежие данные получить не удалось — попробуй ещё раз чуть позже. Отвечать наугад я не буду.',
    'search_unavailable': 'Поиск свежих данных работает через сервер PetAgent или ключ Polza — с твоим ключом этого сервиса получить свежие данные не получится.',
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
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND own_key = {k} AND kind NOT IN ('voice', 'stt') AND created_at > NOW() - INTERVAL '1 minute'), "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND own_key = {k} AND kind NOT IN ('voice', 'stt') AND created_at > date_trunc('day', NOW()) AND status = 'ok'), "
            f"COUNT(*) FILTER (WHERE ip = '{esc(ip)}' AND own_key = {k} AND kind NOT IN ('voice', 'stt') AND created_at > date_trunc('day', NOW()) AND status = 'ok'), "
            f"COALESCE(SUM(cost) FILTER (WHERE own_key = FALSE AND kind NOT IN ('voice', 'stt') AND created_at > date_trunc('day', NOW())), 0) "
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


def stt_usage(client_id: str, ip: str) -> dict:
    conn = db()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}' AND created_at > NOW() - INTERVAL '1 minute'), "
            f"COUNT(*) FILTER (WHERE client_id = '{esc(client_id)}'), "
            f"COUNT(*) FILTER (WHERE ip = '{esc(ip)}') "
            f"FROM {SCHEMA}.ai_requests WHERE kind = 'stt' AND created_at > date_trunc('day', NOW()) - INTERVAL '1 minute'"
        )
        m, d, d_ip = cur.fetchone()
        return {'minute': int(m), 'day': int(d), 'day_ip': int(d_ip)}
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


class VoiceError(Exception):
    def __init__(self, code: str, retryable: bool = False):
        self.code = code
        self.retryable = retryable


def yandex_config() -> tuple:
    key = (os.environ.get('YANDEX_SPEECHKIT_API_KEY') or '').strip()
    voice = (os.environ.get('YANDEX_SPEECHKIT_VOICE') or '').strip() or YANDEX_DEFAULT_VOICE
    folder = (os.environ.get('YANDEX_FOLDER_ID') or '').strip()
    return key, voice, folder


def yandex_tts_settings() -> dict:
    def pick(name: str, default: str) -> str:
        v = (os.environ.get(name) or '').strip().lower()
        return v if v and YANDEX_TOKEN_RE.match(v) else default
    _, voice, _ = yandex_config()
    fb = os.environ.get('YANDEX_TTS_FALLBACK_VOICE')
    fallback = YANDEX_FALLBACK_VOICE if fb is None else (fb.strip().lower() if YANDEX_TOKEN_RE.match(fb.strip().lower() or '-') else '')
    return {
        'model': pick('YANDEX_TTS_MODEL', YANDEX_DEFAULT_MODEL),
        'voice': voice,
        'role': pick('YANDEX_TTS_ROLE', YANDEX_DEFAULT_ROLE) if (os.environ.get('YANDEX_TTS_ROLE') or '').strip().lower() != 'none' else '',
        'fallback': fallback,
    }


def providers() -> list:
    key, voice, _ = yandex_config()
    return ['yandex'] if key and YANDEX_VOICE_RE.match(voice) else []


def voice_status() -> dict:
    key, voice, _ = yandex_config()
    return {
        'voice': {
            'configured': bool(providers()),
            'provider': 'yandex',
            'hasKey': bool(key),
            'voice': voice,
            'tts': yandex_tts_settings(),
            'maxChars': VOICE_MAX_CHARS,
            'perMinute': VOICE_PER_MINUTE,
            'perDay': VOICE_PER_DAY,
        }
    }


def looks_like_mp3(audio: bytes) -> bool:
    return audio[:3] == b'ID3' or (len(audio) > 2 and audio[0] == 0xFF and audio[1] & 0xE0 == 0xE0)


def split_for_v3(text: str) -> list:
    parts, cur = [], ''
    for sent in re.split(r'(?<=[.!?…])\s+', text):
        while len(sent) > YANDEX_V3_CHUNK:
            cut = sent.rfind(', ', 0, YANDEX_V3_CHUNK)
            cut = cut + 1 if cut > 60 else sent.rfind(' ', 0, YANDEX_V3_CHUNK)
            cut = cut if cut > 0 else YANDEX_V3_CHUNK
            if cur:
                parts.append(cur)
                cur = ''
            parts.append(sent[:cut].strip())
            sent = sent[cut:].strip()
        if not sent:
            continue
        if cur and len(cur) + 1 + len(sent) > YANDEX_V3_CHUNK:
            parts.append(cur)
            cur = sent
        else:
            cur = f'{cur} {sent}'.strip()
    if cur:
        parts.append(cur)
    return [p for p in parts if p]


def yandex_error(status: int, detail: str, what: str) -> VoiceError:
    low = detail.lower()
    print(f'Yandex {what} HTTP {status}: {detail[:200]}')
    if status == 403 or 'permission' in low:
        return VoiceError('yandex_no_permission')
    if status == 401:
        return VoiceError('yandex_bad_key')
    if status == 429 or 'quota' in low or 'limit' in low:
        return VoiceError('yandex_quota', True)
    if status == 400:
        return VoiceError('yandex_bad_request')
    return VoiceError('voice_error', True)


def synth_v3_chunk(text: str, voice: str, key: str, folder: str, model: str, role: str) -> bytes:
    auth = f'Bearer {key}' if key.startswith('t1.') else f'Api-Key {key}'
    headers = {'Authorization': auth, 'Content-Type': 'application/json'}
    if folder:
        headers['x-folder-id'] = folder
    hints = [{'voice': voice}]
    if role:
        hints.append({'role': role})
    body = json.dumps({
        'model': model,
        'text': text,
        'hints': hints,
        'outputAudioSpec': {'containerAudio': {'containerAudioType': 'MP3'}},
        'loudnessNormalizationType': 'LUFS',
    }).encode('utf-8')
    req = urllib.request.Request('https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis', data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        raise yandex_error(e.code, e.read().decode('utf-8', 'ignore')[:400], 'TTS v3')
    except Exception as e:
        print(f'Yandex TTS v3 error: {type(e).__name__}')
        raise VoiceError('voice_error', True)
    audio = b''
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        chunk = ((obj.get('result') or obj).get('audioChunk') or {}).get('data')
        if chunk:
            audio += base64.b64decode(chunk)
    if len(audio) < 300:
        print(f'Yandex TTS v3: пустой ответ size={len(audio)} head={raw[:160]!r}')
        raise VoiceError('voice_error', True)
    return audio


def synth_yandex_v3(text: str, voice: str, key: str, folder: str, model: str, role: str) -> dict:
    parts = split_for_v3(text)
    if len(parts) == 1:
        audio = synth_v3_chunk(parts[0], voice, key, folder, model, role)
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(parts))) as pool:
            audio = b''.join(pool.map(lambda t: synth_v3_chunk(t, voice, key, folder, model, role), parts))
    if not looks_like_mp3(audio):
        print(f'Yandex TTS v3: не mp3, head={audio[:8]!r}')
        raise VoiceError('voice_error', True)
    return {'audio': audio, 'voice': voice, 'model': model, 'role': role or None, 'api': 'v3'}


def synth_yandex(text: str) -> dict:
    key, _, folder = yandex_config()
    cfg = yandex_tts_settings()
    voice = cfg['voice']
    wanted = voice
    reason = None
    if voice not in YANDEX_V1_VOICES:
        denied_key = f"{cfg['model']}:{voice}:{cfg['role']}"
        if time.time() - _voice_denied.get(denied_key, 0) > YANDEX_DENIED_TTL:
            try:
                return synth_yandex_v3(text, voice, key, folder, cfg['model'], cfg['role'])
            except VoiceError as e:
                if e.code not in ('yandex_no_permission', 'yandex_bad_request') or not cfg['fallback']:
                    raise
                _voice_denied[denied_key] = time.time()
                reason = e.code
                print(f"Голос {voice} (модель {cfg['model']}) недоступен: {e.code}, использую {cfg['fallback']}")
        elif not cfg['fallback']:
            raise VoiceError('yandex_no_permission')
        if not cfg['fallback']:
            raise VoiceError('yandex_no_permission')
        voice = cfg['fallback']
        if voice not in YANDEX_V1_VOICES:
            return {**synth_yandex_v3(text, voice, key, folder, 'general', ''), 'wanted': wanted, 'reason': reason or 'cached'}
    fields = {'text': text, 'lang': 'ru-RU', 'voice': voice, 'format': 'mp3', 'speed': '1.0'}
    if voice in YANDEX_EMOTION_VOICES:
        fields['emotion'] = 'good'
    if folder:
        fields['folderId'] = folder
    auth = f'Bearer {key}' if key.startswith('t1.') else f'Api-Key {key}'
    req = urllib.request.Request(
        'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize',
        data=urllib.parse.urlencode(fields).encode('utf-8'),
        headers={'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            audio = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:400]
        print(f'Yandex SpeechKit HTTP {e.code}')
        low = detail.lower()
        if e.code == 401:
            raise VoiceError('yandex_bad_key')
        if e.code == 403 or 'permission' in low:
            raise VoiceError('yandex_no_permission')
        if e.code == 429 or 'quota' in low or 'limit' in low:
            raise VoiceError('yandex_quota', True)
        if e.code == 400:
            raise VoiceError('yandex_bad_request')
        raise VoiceError('voice_error', True)
    except Exception as e:
        print(f'Yandex SpeechKit error: {type(e).__name__}')
        raise VoiceError('voice_error', True)
    if not looks_like_mp3(audio) or len(audio) < 500:
        print(f'Yandex SpeechKit: неожиданный ответ size={len(audio)}')
        raise VoiceError('voice_error', True)
    return {'audio': audio, 'voice': voice, 'model': 'speechkit-v1', 'api': 'v1', 'wanted': wanted if wanted != voice else None, 'reason': reason or ('cached' if wanted != voice else None)}


def handle_stt(event: dict, client_id: str, ip: str) -> dict:
    if event.get('httpMethod') == 'GET':
        key, _, _ = yandex_config()
        return respond(200, {'stt': {'configured': bool(key), 'maxSeconds': STT_MAX_SECONDS, 'rate': STT_RATE, 'maxBytes': STT_MAX_BYTES, 'perMinute': STT_PER_MINUTE, 'perDay': STT_PER_DAY}})
    if event.get('httpMethod') != 'POST':
        return fail(405, 'bad_request', False)
    key, _, _ = yandex_config()
    if not key:
        return fail(503, 'voice_no_key', False)
    raw_body = event.get('body') or ''
    if len(raw_body) > STT_MAX_BYTES * 4 // 3 + 4096:
        return fail(413, 'stt_too_big', False)
    try:
        data = json.loads(raw_body or '{}')
        rate = int(data.get('rate') or STT_RATE)
        b64 = str(data.get('audio') or '')
        if len(b64) > STT_MAX_BYTES * 4 // 3 + 8:
            return fail(413, 'stt_too_big', False)
        pcm = base64.b64decode(b64, validate=True)
    except Exception:
        return fail(400, 'stt_bad_audio', False)
    if rate != STT_RATE or len(pcm) % 2 or pcm[:4] in (b'RIFF', b'OggS') or pcm[:4] == b'\x1aE\xdf\xa3':
        return fail(400, 'stt_bad_audio', False)
    if len(pcm) > STT_MAX_BYTES:
        return fail(413, 'stt_too_big', False)
    seconds = len(pcm) / (STT_RATE * 2)
    if seconds < STT_MIN_SECONDS:
        return fail(400, 'stt_too_short', False)
    if seconds > STT_MAX_SECONDS + 0.5:
        return fail(413, 'stt_too_long', False)

    try:
        u = stt_usage(client_id, ip)
    except Exception as e:
        print(f'stt usage db error: {type(e).__name__}')
        return fail(503, 'db_error', True)
    if u['minute'] >= STT_PER_MINUTE:
        return fail(429, 'stt_rate', True, {'retryAfter': 60})
    if u['day'] >= STT_PER_DAY or u['day_ip'] >= STT_PER_DAY_IP:
        return fail(429, 'stt_daily', False)

    query = {'lang': 'ru-RU', 'topic': 'general', 'format': 'lpcm', 'sampleRateHertz': str(STT_RATE)}
    req = urllib.request.Request(
        'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize?' + urllib.parse.urlencode(query),
        data=pcm,
        headers={'Authorization': f'Api-Key {key}', 'Content-Type': 'application/octet-stream'},
        method='POST',
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode('utf-8', 'ignore') or '{}')
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:400].lower()
        print(f'Yandex STT HTTP {e.code}: {detail[:160]}')
        if e.code == 403 or 'permission' in detail:
            code = 'stt_no_permission'
        elif e.code == 401:
            code = 'yandex_bad_key'
        elif e.code == 429 or 'quota' in detail or 'limit' in detail:
            code = 'yandex_quota'
        elif e.code == 400:
            code = 'stt_bad_audio'
        else:
            code = 'voice_error'
        log(client_id, ip, 'stt', code)
        return fail(502, code, code in ('voice_error', 'yandex_quota'))
    except Exception as e:
        print(f'Yandex STT error: {type(e).__name__}')
        log(client_id, ip, 'stt', 'timeout')
        return fail(504, 'voice_error', True)

    text = str(result.get('result') or '').strip()
    if not text:
        log(client_id, ip, 'stt', 'no_speech', pt=int(seconds * 1000))
        return fail(200, 'stt_no_speech', False, {'text': ''})
    log(client_id, ip, 'stt', 'ok', pt=int(seconds * 1000))
    return respond(200, {'text': text[:MAX_MESSAGE], 'seconds': round(seconds, 1), 'ms': int((time.time() - started) * 1000)})


def handle_voice(event: dict, client_id: str, ip: str) -> dict:
    if event.get('httpMethod') == 'GET':
        return respond(200, voice_status())
    if event.get('httpMethod') != 'POST':
        return fail(405, 'bad_request', False)
    order = providers()
    if not order:
        key, _, _ = yandex_config()
        return fail(503, 'voice_no_key' if not key else 'yandex_bad_request', False, {'fallback': 'local'})
    try:
        data = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return fail(400, 'bad_request', False)
    raw = str(data.get('text') or '')
    if len(raw) > 8000:
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

    started = time.time()
    errors = []
    for name in order:
        try:
            res = synth_yandex(text)
        except VoiceError as e:
            errors.append({'provider': name, 'error': e.code})
            log(client_id, ip, 'voice', e.code)
            continue
        audio = res['audio']
        log(client_id, ip, 'voice', 'ok', pt=len(text), ct=len(audio) // 1000)
        return respond(200, {
            'audio': base64.b64encode(audio).decode('ascii'),
            'mime': 'audio/mpeg',
            'chars': len(text),
            'provider': name,
            'voiceId': res['voice'],
            'wantedVoice': res.get('wanted'),
            'role': res.get('role'),
            'api': res.get('api'),
            'fallbackReason': res.get('reason'),
            'audioFormat': 'mp3',
            'model': res['model'],
            'ms': int((time.time() - started) * 1000),
            'skipped': errors,
        })
    last = errors[-1]['error']
    return fail(502, last, last in ('voice_error', 'yandex_quota'), {'fallback': 'local', 'providers': errors})


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


def parse_iq(pet: dict):
    try:
        return max(0.0, min(100.0, float(pet.get('iq'))))
    except (TypeError, ValueError):
        return None


def iq_level(iq: float) -> str:
    return 'genius' if iq >= IQ_GENIUS else 'smart' if iq >= IQ_SMART else 'baby'


def iq_rules(iq: float, level: str, task: bool) -> str:
    head = f'Твой интеллект: IQ {int(iq)} из 100, уровень «{IQ_NAMES[level]}». '
    if level == 'genius':
        return head + 'Ты можешь отвечать на любые вопросы максимально полно и глубоко.'
    if level == 'baby':
        return head + 'Ты ещё малыш: говори просто, коротко и по-детски, короткими фразами, без терминов и без длинных объяснений. Максимум 3–4 предложения.'
    return head + 'Объясняй понятно и средней глубины, без излишней академичности. Не больше 8–10 предложений.'


def classify_complexity(message: str, source: str, own: dict | None) -> int:
    text = (message + ('\n' + source[:600] if source else ''))[:1200]
    sys_prompt = (
        'Ты оцениваешь сложность запроса пользователя к ИИ-помощнику по шкале 0–3. Ответь ОДНОЙ цифрой, без слов.\n'
        '0 — приветствие, болтовня, благодарность, вопросы о самочувствии, шутки, игры, просьбы пошутить или спеть.\n'
        '1 — простой бытовой вопрос, один факт, простой совет, короткий перевод, идея подарка, рецепт попроще.\n'
        '2 — требует объяснения или нескольких шагов: план, сравнение, обзор темы, школьная программа, обычный текст на правку, простой фрагмент кода.\n'
        '3 — профессиональная глубина: написание или разбор программного кода и алгоритмов, математика, физика, право, налоги, медицина, финансы, '
        'научные темы, анализ данных, стратегии, архитектура, сложные многошаговые рассуждения, юридические и технические документы.'
    )
    try:
        result, _ = call_model([
            {'role': 'system', 'content': sys_prompt},
            {'role': 'user', 'content': text},
        ], 4, 8, own)
        out = ((result.get('choices') or [{}])[0].get('message') or {}).get('content') or ''
        m = re.search(r'[0-3]', out)
        return int(m.group(0)) if m else 2
    except Exception as e:
        print(f'classify error: {type(e).__name__}')
        return 2


IQ_MAX_COMPLEXITY = {'baby': 1, 'smart': 2, 'genius': 3}


def iq_decline_hard(pet: dict, level: str, seed: int) -> str:
    sound = IQ_SOUND.get(pet.get('type'), '')
    if level == 'baby':
        variants = [
            f'{sound} Ой, это для меня слишком сложно — я ещё малыш и такого пока не знаю! Обучай меня кнопкой «Обучать», подрасту и обязательно расскажу. А пока спроси что-нибудь попроще!',
            f'{sound} Хм-м, про такое я пока ничего не знаю — мне ещё рано, я маленький. Потренируй меня, и я стану умнее! Давай лучше поболтаем или поиграем?',
            f'{sound} Такое мне пока не по зубам, я только учусь! Подрасту — расскажу. А сейчас могу помочь с чем-нибудь простым.',
        ]
    else:
        variants = [
            f'{sound} Это уже глубокая тема — тут нужен уровень «Гений», а я пока Умный. Обучай меня, и я разберу такое полностью! Могу объяснить попроще — только скажи.',
            f'{sound} Для такого разбора мне пока не хватает ума: нужен уровень «Гений». Потренируй меня — и вернёмся к этому вопросу!',
        ]
    return variants[seed % len(variants)].strip()


def iq_refusal(pet: dict, level: str, limit: int, seed: int) -> str:
    sound = IQ_SOUND.get(pet.get('type'), '')
    if level == 'baby':
        variants = [
            f'{sound} Ой, такой длинный текст мне пока не осилить — я ещё малыш! Потренируй меня кнопкой «Обучать», подрасту и помогу. А пока дай кусочек покороче (до {limit} символов).',
            f'{sound} Это слишком сложно для малыша вроде меня! Давай я подрасту — обучай меня, — а пока принеси текст покороче, до {limit} символов.',
            f'{sound} Я пока совсем маленький и столько читать не умею… Обучи меня, и я стану умнее! Сейчас потяну только до {limit} символов.',
        ]
    else:
        variants = [
            f'{sound} Такой большой текст мне пока тяжеловат. Стану Гением — разберу целиком! А сейчас могу взять кусок до {limit} символов.',
            f'{sound} Тут нужен уровень «Гений», а я пока Умный. Обучай меня — а сейчас дай текст покороче, до {limit} символов.',
        ]
    return variants[seed % len(variants)].strip()


def build_system(pet: dict, memory: list, task: bool, voice: bool = False, iq=None) -> str:
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
    if iq is not None:
        lines.append(iq_rules(iq, iq_level(iq), task))
    if voice:
        lines.append(
            'Это голосовой диалог: твой ответ будет озвучен вслух. Отвечай по-человечески, коротко — 1–3 предложения, не больше 350 символов. '
            'Без markdown, списков, кода, ссылок и эмодзи. Числа и сокращения пиши так, как их удобно произнести.'
        )
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
        'searchModel': search_model(),
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


def search_model() -> str:
    return (os.environ.get('POLZA_AI_SEARCH_MODEL') or '').strip() or websearch.SEARCH_MODEL_DEFAULT


def call_search(messages: list, own: dict | None) -> tuple:
    if own:
        url, key = own['url'], own['key']
    else:
        url, key = API_URL, os.environ['POLZA_AI_API_KEY']
    payload = json.dumps({
        'model': search_model(),
        'messages': messages,
        'max_tokens': SEARCH_MAX_TOKENS,
        'temperature': 0.2,
    }).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=payload,
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json', 'HTTP-Referer': 'https://petagent.app', 'X-Title': 'PetAgent'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=SEARCH_TIMEOUT) as resp:
        return json.loads(resp.read().decode('utf-8')), resp.status


def search_cost(usage_info: dict) -> tuple:
    pt = int(usage_info.get('prompt_tokens') or 0)
    ct = int(usage_info.get('completion_tokens') or 0)
    est = pt * SEARCH_PROMPT_RUB_PER_M / 1e6 + ct * SEARCH_COMPLETION_RUB_PER_M / 1e6 + SEARCH_FEE_RUB
    reported = usage_info.get('cost')
    reported = float(reported) if isinstance(reported, (int, float)) and not isinstance(reported, bool) else None
    return (max(reported, est) if reported is not None else est), reported, est


def handle_search(sr: dict, message: str, pet: dict, iq, voice: bool, data: dict, client_id: str, ip: str, own: dict | None, u: dict, started_all: float) -> dict:
    is_own = own is not None
    ptype = pet.get('type') if pet.get('type') in PERSONAS else 'cat'
    persona, traits = PERSONAS[ptype]
    name = str(pet.get('name') or 'Питомец')[:40]
    sound = IQ_SOUND.get(ptype, '')
    base = {'ownKey': is_own, 'model': None, 'declined': False, 'truncated': False, 'remember': None, 'iq': int(iq) if iq is not None else None,
            'iqLevel': iq_level(iq) if iq is not None else None, 'searched': False}

    ask = websearch.clarification(sr['intent'], message, data.get('history') or [], sr['context'])
    if ask:
        log(client_id, ip, 'search', 'clarify', 0, 0, 0.0, is_own)
        return respond(200, {
            **base,
            'reply': f'{sound} {ask}'.strip(),
            'clarify': True,
            'complexity': None,
            'remainingToday': None if is_own else max(0, PER_DAY_CLIENT - u['day']),
            'ms': int((time.time() - started_all) * 1000),
        })

    if is_own and own.get('provider') != 'polza':
        log(client_id, ip, 'search', 'no_search', 0, 0, 0.0, True)
        return fail(400, 'search_unavailable', False)

    now = websearch.now_info(data.get('timezone'), data.get('tzOffset'))
    iq_line = iq_rules(iq, iq_level(iq), False) if iq is not None else ''
    system = websearch.build_system(persona, traits, name, now, iq_line, voice)
    messages = websearch.build_messages(system, sr['context'], message)

    started = time.time()
    try:
        result, _ = call_search(messages, own)
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:300]
        print(f'search HTTP {e.code}' + ('' if is_own else f': {detail}'))
        code = map_http_error(e.code, detail, is_own)
        code = code if code in ('no_balance', 'bad_key', 'own_no_balance', 'own_bad_key') else 'search_failed'
        log(client_id, ip, 'search', 'search_error', own=is_own)
        return fail(502, code, code == 'search_failed')
    except Exception as e:
        print(f'search error after {time.time() - started:.1f}s: {type(e).__name__}')
        log(client_id, ip, 'search', 'search_error', own=is_own)
        return fail(504, 'search_failed', True)

    choice = (result.get('choices') or [{}])[0]
    raw_reply = (choice.get('message') or {}).get('content') or ''
    usage_info = result.get('usage') or {}
    pt = int(usage_info.get('prompt_tokens') or 0)
    ct = int(usage_info.get('completion_tokens') or 0)
    cost, reported, est = search_cost(usage_info)
    cost = 0.0 if is_own else cost
    sources, kinds = websearch.extract_sources(result)
    print(f'search ok model={result.get("model")} top_keys={sorted(result.keys())} usage={json.dumps(usage_info, ensure_ascii=False)[:400]} sources={len(sources)} via={kinds} cost_reported={reported} cost_est={est:.4f}')
    reply = websearch.clean_reply(raw_reply)
    if not reply:
        log(client_id, ip, 'search', 'empty_reply', pt, ct, cost, is_own)
        return fail(502, 'search_failed', True)

    verified = bool(sources)
    if not verified:
        reply += websearch.UNVERIFIED_NOTE
    log(client_id, ip, 'search', 'ok', pt, ct, cost, is_own)
    body = {
        **base,
        'reply': reply,
        'model': result.get('model') or search_model(),
        'searched': True,
        'sources': sources,
        'verified': verified,
        'asOf': now['iso'],
        'spoken': websearch.spoken_summary(raw_reply if voice else reply) or None,
        'truncated': choice.get('finish_reason') == 'length',
        'complexity': None,
        'ms': int((time.time() - started) * 1000),
    }
    if not is_own:
        body['remainingToday'] = max(0, PER_DAY_CLIENT - u['day'] - 1)
    return respond(200, body)


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    client_id = re.sub(r'[^a-zA-Z0-9_-]', '', headers.get('x-client-id') or '')[:64] or 'anon'
    ip = ((event.get('requestContext') or {}).get('identity') or {}).get('sourceIp') or ''

    qs = event.get('queryStringParameters') or {}
    if qs.get('voice'):
        return handle_voice(event, client_id, ip)
    if qs.get('stt'):
        return handle_stt(event, client_id, ip)

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
    iq = parse_iq(pet)
    message = str(data.get('message') or '').strip()
    task = data.get('task') or None
    voice = bool(data.get('voice'))
    memory = [str(x)[:200] for x in (data.get('memory') or [])[:MAX_MEMORY] if str(x).strip()]

    if task:
        action = task.get('action')
        source = str(task.get('source') or '').strip()
        if action not in TEXT_ACTIONS or not source:
            return fail(400, 'empty', False)
        if len(source) > MAX_SOURCE:
            return fail(413, 'too_long', False, {'limit': MAX_SOURCE})
        if iq is not None:
            lvl = iq_level(iq)
            if len(source) > IQ_TEXT_LIMIT[lvl]:
                return respond(200, {
                    'reply': iq_refusal(pet, lvl, IQ_TEXT_LIMIT[lvl], len(source)),
                    'remember': None,
                    'truncated': False,
                    'model': None,
                    'ownKey': own is not None,
                    'declined': True,
                    'iq': int(iq),
                    'iqLevel': lvl,
                    'refusedBy': 'length',
                    'ms': 0,
                })
        note = f'\n\nДополнительно от пользователя: {message[:500]}' if message else ''
        user_content = f'{TEXT_ACTIONS[action]}{note}\n\nТекст:\n"""\n{source}\n"""'
    else:
        if not message:
            return fail(400, 'empty', False)
        if len(message) > MAX_MESSAGE:
            return fail(413, 'too_long', False, {'limit': MAX_MESSAGE})
        user_content = message

    started_all = time.time()
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

    if not task:
        sr = websearch.route(message, data.get('history') or [])
        if sr['search']:
            return handle_search(sr, message, pet, iq, voice, data, client_id, ip, own, u, started_all)

    complexity = None
    if iq is not None and iq_level(iq) != 'genius':
        complexity = classify_complexity(message, str(task.get('source') or '') if task else '', own)
        lvl = iq_level(iq)
        if complexity > IQ_MAX_COMPLEXITY[lvl]:
            log(client_id, ip, 'iq_decline', 'ok', 0, 0, 0.0, is_own)
            return respond(200, {
                'reply': iq_decline_hard(pet, lvl, int(time.time())),
                'remember': None,
                'truncated': False,
                'model': None,
                'ownKey': is_own,
                'declined': True,
                'iq': int(iq),
                'iqLevel': lvl,
                'complexity': complexity,
                'refusedBy': 'complexity',
                'remainingToday': None if is_own else max(0, PER_DAY_CLIENT - u['day']),
                'ms': int((time.time() - started_all) * 1000),
            })

    messages = [{'role': 'system', 'content': build_system(pet, memory, bool(task), voice, iq)}]
    messages += clean_history(data.get('history') or [])
    messages.append({'role': 'user', 'content': user_content})

    kind = f"text:{task['action']}" if task else 'chat'
    max_tokens = 1400 if task else 300 if voice else 1100
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

    declined = False
    reply = HARD_MARK.sub(' ', reply)
    log(client_id, ip, kind, 'ok', pt, ct, cost, is_own)
    body = {
        'reply': reply.strip(),
        'remember': remember,
        'truncated': choice.get('finish_reason') == 'length',
        'model': result.get('model'),
        'ownKey': is_own,
        'declined': declined,
        'complexity': complexity,
        'iq': int(iq) if iq is not None else None,
        'iqLevel': iq_level(iq) if iq is not None else None,
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


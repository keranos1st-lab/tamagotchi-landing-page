import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None

SEARCH_MODEL_DEFAULT = 'perplexity/sonar'
MAX_SOURCES = 8
TZ_RE = re.compile(r'^[A-Za-z][A-Za-z0-9_+\-]*(/[A-Za-z0-9_+\-]+){0,2}$')

WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

DEFINITION = re.compile(
    r'^\W*(что\s+такое|что\s+значит|что\s+означает|объясни|расскажи,?\s+что\s+такое|как\s+(работает|считается|устроен\w*|рассчитывается|формируется)|'
    r'почему|зачем|в\s+чём\s+разница|в\s+чем\s+разница|дай\s+определение|определение|как\s+понять)',
    re.IGNORECASE,
)
TIME_MARK = re.compile(r'сегодня|сейчас|завтра|послезавтра|текущ|актуальн|свеж|последн|на\s+данный\s+момент|прямо\s+сейчас|на\s+этой\s+неделе', re.IGNORECASE)

EXPLICIT = re.compile(
    r'(найд\w+|поищ\w+|проверь\w*|посмотри\w*|узна\w+|гугл\w*)\s+(это\s+|мне\s+|его\s+|её\s+)?(в\s+)?(интернет\w*|сети|инет\w*|гугл\w*|яндекс\w*|поиск\w*|онлайн)|'
    r'\b(погугли|загугли|погуглить)\b|найд\w+\s+(мне\s+)?(информацию|данные|сведения)\s+(о|об|про|по)\b',
    re.IGNORECASE,
)
WEATHER = re.compile(
    r'погод(?!и)\w*|сколько\s+градусов|какая\s+температура|температур\w*\s+(на\s+улице|воздуха|сегодня|завтра)|'
    r'(будет|идёт|идет)\s+ли\s+(дождь|снег)|нужен\s+ли\s+зонт|прогноз\w*\s+(на|по)\b',
    re.IGNORECASE,
)
CURRENCY = re.compile(
    r'курс\w*\s+(доллар|евро|юан|рубл|валют|бакс|фунт|тенге|лир|йен|гривн|биткоин|bitcoin|btc|usd|eur|cny|цб)|'
    r'(доллар|евро|юан)\w*\s+(сегодня|сейчас|к\s+рубл|по\s+цб)|'
    r'сколько\s+(сейчас\s+)?(стоит|стоят)\s+(доллар|евро|юан|биткоин)|почём\s+(доллар|евро|юан)|курс\s+цб|официальный\s+курс',
    re.IGNORECASE,
)
NEWS = re.compile(
    r'(какие|свеж\w+|последн\w+|главн\w+|сегодняшн\w+|актуальн\w+)\s+новост\w*|'
    r'новост\w*\s+(сегодня|дня|недели|за\s+(сегодня|день|неделю|сутки)|о|об|про|по|из)\b|'
    r'(расскажи|покажи|дай|есть|что\s+там\s+с|что\s+там\s+по)\s+(\w+\s+){0,2}новост\w*|'
    r'(что|какие)\s+(случилось|произошло|происходит)\s+(сегодня|вчера|за\s+последн\w*|в\s+мире|в\s+стране|на\s+этой\s+неделе)',
    re.IGNORECASE,
)
CLIMATE = re.compile(r'обычно|как\s+правило|в\s+среднем|климат|бывает|как\s+образуется|почему\s+идёт|почему\s+идет', re.IGNORECASE)
FLIGHT = re.compile(
    r'\bрейс\w*|авиарейс\w*|авиабилет\w*|билет\w*\s+на\s+самол[её]т|\bвылет\w*|\bприл[её]т\w*|\bтабло\b|'
    r'расписани\w*\s+(рейс|самол[её]т|аэропорт)|самол[её]т\w*\s+(из|в|до)\b',
    re.IGNORECASE,
)
SCHEDULE = re.compile(
    r'расписани\w*\s+(электричек|электрички|поездов|поезда|автобусов|автобуса|метро|паромов)|'
    r'(ближайш\w+|следующ\w+)\s+(электричк\w*|поезд\w*|автобус\w*)|когда\s+(отправляется|прибывает|ходит)',
    re.IGNORECASE,
)
FOLLOWUP_TOKENS = re.compile(
    r'\b(сегодня|завтра|послезавтра|вчера|выходн\w*|недел\w*|утром|вечером|днём|днем|ночью|сейчас|через)\b|'
    r'\b(евро|доллар\w*|юан\w*|фунт\w*|биткоин\w*|тенге)\b|'
    r'\b(в|во|на|из|до|для)\s+[A-Za-zА-Яа-яЁё][\w-]{2,}',
    re.IGNORECASE,
)
FOLLOWUP_NOT = re.compile(r'тебя|тебе|ты\b|твой|твоё|твое|твои|в\s+чём|в\s+чем|в\s+каком\s+смысле|в\s+том\s+числе', re.IGNORECASE)
ASK_PREV = re.compile(r'из\s+какого\s+города|в\s+каком\s+городе|какой\s+город|на\s+какую\s+дату|уточни', re.IGNORECASE)

PREP_STOP = {
    'сегодня', 'завтра', 'послезавтра', 'вчера', 'субботу', 'воскресенье', 'понедельник', 'вторник', 'среду', 'пятницу', 'четверг',
    'выходные', 'выходных', 'будни', 'ближайшие', 'ближайшую', 'ближайший', 'ближайшее', 'течение', 'целом', 'общем', 'этом', 'этот', 'эту', 'эти',
    'этой', 'моём', 'моем', 'нашем', 'нашей', 'мире', 'стране', 'неделю', 'неделе', 'месяце', 'утром', 'вечером', 'ночью', 'днём', 'днем',
    'конце', 'начале', 'середине', 'данный', 'настоящее', 'такую', 'такой', 'час', 'часа', 'часов', 'интернете', 'сети', 'инете', 'принципе',
    'любое', 'любой', 'какой', 'каком', 'какую', 'какое', 'какие', 'эту', 'том', 'той', 'следующую', 'следующий', 'следующие', 'прошлую',
    'июле', 'июне', 'мае', 'апреле', 'марте', 'феврале', 'январе', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре', 'пятницу',
}
LOC_AFTER_PREP = re.compile(r'\b(?:в|во|для|по|около|под|над|из|от|до)\s+([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё-]{2,})', re.IGNORECASE)
CAP_WORD = re.compile(r'(?<!^)(?<![.!?]\s)\b([A-ZА-ЯЁ][a-zа-яё]{2,}(?:-[A-Za-zА-Яа-яЁё]+)?)')
FLIGHT_NO = re.compile(r'\b[a-zа-я]{2}\s?\d{3,4}\b|\b[a-zа-я]\d\s?\d{3,4}\b', re.IGNORECASE)
ORIGIN = re.compile(r'\b(?:вылет\w*|вылетает\w*|лечу|летит\w*|летим|рейс\w*)?\s*(?:из|от)\s+(?!-)[A-Za-zА-Яа-яЁё]{3,}', re.IGNORECASE)
DATE_WORD = re.compile(
    r'сегодня|завтра|послезавтра|вчера|понедельник|вторник|сред[уа]|четверг|пятниц[уа]|суббот[уа]|воскресенье|\d{1,2}[./]\d{1,2}|'
    r'\b\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)',
    re.IGNORECASE,
)


def now_info(tz, offset_min, now=None) -> dict:
    now = now or datetime.now(timezone.utc)
    local, label = None, None
    tz = tz.strip() if isinstance(tz, str) else ''
    if tz and len(tz) <= 64 and TZ_RE.match(tz) and ZoneInfo is not None:
        try:
            local = now.astimezone(ZoneInfo(tz))
            label = tz
        except Exception:
            local = None
    if local is None and isinstance(offset_min, (int, float)) and not isinstance(offset_min, bool) and -840 <= offset_min <= 840:
        off = int(offset_min)
        local = now.astimezone(timezone(timedelta(minutes=off)))
        sign = '+' if off >= 0 else '-'
        utc = f'UTC{sign}{abs(off) // 60:02d}:{abs(off) % 60:02d}'
        label = f'{tz}, {utc}' if tz and TZ_RE.match(tz) else utc
    if local is not None:
        text = f'Сегодня {local.day} {MONTHS[local.month - 1]} {local.year} года, {WEEKDAYS[local.weekday()]}, {local:%H:%M} (часовой пояс пользователя: {label}).'
        return {'known': True, 'text': text, 'iso': now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'label': label}
    u = now.astimezone(timezone.utc)
    text = (
        f'Сейчас по UTC: {u.day} {MONTHS[u.month - 1]} {u.year} года, {WEEKDAYS[u.weekday()]}, {u:%H:%M} UTC. '
        'Часовой пояс пользователя неизвестен — не выдавай UTC за местное время; если ответ зависит от местного времени или от того, '
        'что значит «сегодня» и «завтра», скажи об этом или уточни город.'
    )
    return {'known': False, 'text': text, 'iso': now.strftime('%Y-%m-%dT%H:%M:%SZ'), 'label': 'UTC'}


def intent_of(text: str):
    if FLIGHT.search(text):
        return 'flight'
    if WEATHER.search(text):
        return 'weather'
    if CURRENCY.search(text):
        return 'currency'
    if NEWS.search(text):
        return 'news'
    if SCHEDULE.search(text):
        return 'schedule'
    if EXPLICIT.search(text):
        return 'web'
    return None


def direct_intent(text: str):
    t = text.strip()
    if not t:
        return None
    if EXPLICIT.search(t):
        return intent_of(t) or 'web'
    if (DEFINITION.match(t) or CLIMATE.search(t)) and not TIME_MARK.search(t):
        return None
    return intent_of(t)


def _user_texts(history: list) -> list:
    return [str(m.get('text') or '') for m in history if isinstance(m, dict) and m.get('role') != 'pet' and str(m.get('text') or '').strip()]


def route(message: str, history: list) -> dict:
    history = history or []
    intent = direct_intent(message)
    if intent:
        return {'search': True, 'intent': intent, 'followup': False, 'context': []}

    words = re.findall(r'\w+', message)
    if not message.strip() or len(words) > 8 or FOLLOWUP_NOT.search(message):
        return {'search': False, 'intent': None, 'followup': False, 'context': []}

    users = _user_texts(history)
    prev_user = next((t for t in reversed(users[-2:]) if direct_intent(t)), None)
    if not prev_user:
        return {'search': False, 'intent': None, 'followup': False, 'context': []}
    last_pet = next((str(m.get('text') or '') for m in reversed(history) if isinstance(m, dict) and m.get('role') == 'pet' and str(m.get('text') or '').strip()), '')
    starts_a = re.match(r'^\W*(а|и|ну\s+а|а\s+ещё|а\s+еще)\b', message, re.IGNORECASE) is not None
    if FOLLOWUP_TOKENS.search(message) and (starts_a or len(words) <= 4 or ASK_PREV.search(last_pet)):
        ctx = [{'role': 'user', 'content': prev_user[:400]}]
        if last_pet:
            ctx.append({'role': 'assistant', 'content': last_pet[:400]})
        return {'search': True, 'intent': direct_intent(prev_user), 'followup': True, 'context': ctx}
    if ASK_PREV.search(last_pet) and len(words) <= 6:
        ctx = [{'role': 'user', 'content': prev_user[:400]}, {'role': 'assistant', 'content': last_pet[:400]}]
        return {'search': True, 'intent': direct_intent(prev_user), 'followup': True, 'context': ctx}
    return {'search': False, 'intent': None, 'followup': False, 'context': []}


SINGLE_PLACE = re.compile(r'^\W*[A-ZА-ЯЁ][A-Za-zА-Яа-яЁё-]{2,}(\s+[A-ZА-ЯЁ][A-Za-zА-Яа-яЁё-]{2,}){0,2}\W*$')


def has_location(text: str) -> bool:
    for m in LOC_AFTER_PREP.finditer(text):
        if m.group(1).lower() not in PREP_STOP:
            return True
    for m in CAP_WORD.finditer(text):
        if m.group(1).lower() not in PREP_STOP:
            return True
    return False


def parts_have_location(parts: list) -> bool:
    for p in parts:
        p = p.strip()
        if has_location(p):
            return True
        if SINGLE_PLACE.match(p) and not intent_of(p) and p.lower().strip('.!? ') not in PREP_STOP:
            return True
    return False


def clarification(intent, message: str, history: list, route_ctx: list):
    parts = [c['content'] for c in route_ctx if c['role'] == 'user'] + [message]
    joined = ' '.join(parts)
    if intent == 'weather':
        if not parts_have_location(parts):
            return 'Уточни, пожалуйста, для какого города нужна погода — я не буду гадать, где ты находишься.'
        return None
    if intent == 'flight':
        if FLIGHT_NO.search(joined) or ORIGIN.search(joined):
            return None
        asked_city = any(c['role'] == 'assistant' and ASK_PREV.search(c['content']) for c in route_ctx)
        if asked_city and (SINGLE_PLACE.match(message.strip()) or has_location(message)) and not intent_of(message):
            return None
        need_date = '' if DATE_WORD.search(joined) else ' и на какую дату'
        return f'Уточни, пожалуйста, из какого города вылет{need_date}. Без этого я не смогу найти нужный рейс — а гадать про расписание не хочу.'
    return None


FACT_RULES = (
    'Правила ответа:\n'
    '- Опирайся только на найденные в интернете данные. Ничего не выдумывай. Если надёжных данных нет или они противоречат друг другу — скажи это прямо. '
    'Никогда не пиши, что информация проверена, если подтверждения не нашлось.\n'
    '- Не вставляй в текст ссылки и номера сносок вида [1] — источники покажет приложение отдельно.\n'
    '- Не угадывай город или дату пользователя. Если для точного ответа не хватает города или даты, задай один короткий уточняющий вопрос вместо ответа.\n'
    '- Всегда называй дату (и время, если важно), на которую актуальны данные.\n'
    '- Погода: укажи город, дату и время данных, температуру, осадки, ветер. Для «завтра» и других дат считай от даты, указанной выше.\n'
    '- Валюты: различай официальный курс ЦБ РФ (на какую дату установлен) и курсы покупки/продажи в банках и обменниках. Не смешивай их и не называй '
    'один вид другим; укажи, какой именно вид курса ты приводишь. Если нашёл только один вид — так и скажи.\n'
    '- Рейсы: различай расписание, фактический статус (вылетел, задержан, отменён) и наличие билетов. Предпочитай сайты аэропортов и авиакомпаний. '
    'Если фактического статуса нет — прямо скажи, что это только расписание. Не утверждай, что билеты есть, если не нашёл подтверждения.\n'
    '- Новости: 3–5 главных событий, у каждого дата; нейтрально, без оценок.'
)


def build_system(persona: str, traits: str, name: str, now: dict, iq_line: str, voice: bool) -> str:
    lines = [
        f'Ты — {name}, {persona}, питомец-помощник в приложении PetAgent. Характер: {traits}. Характер влияет только на тон: не больше одной короткой реплики в начале или в конце.',
        'Ты отвечаешь на вопрос, которому нужны свежие данные из интернета. Отвечай на русском, если пользователь не пишет на другом языке.',
        now['text'],
        FACT_RULES,
    ]
    if iq_line:
        lines.append(iq_line)
    if voice:
        lines.append(
            'Это голосовой диалог: ответ прозвучит вслух. Ответь 1–3 короткими предложениями, не больше 350 символов, без markdown, списков, ссылок и эмодзи; '
            'обязательно назови главное число или факт и дату.'
        )
    else:
        lines.append('Пиши кратко и по делу, можно короткий список. Не больше 1–2 эмодзи.')
    return '\n'.join(lines)


def build_messages(system: str, route_ctx: list, message: str) -> list:
    msgs = [{'role': 'system', 'content': system}]
    msgs += route_ctx
    msgs.append({'role': 'user', 'content': message})
    return msgs


def _add_source(out: list, seen: set, url, title=None, date=None) -> None:
    if not isinstance(url, str):
        return
    url = url.strip()
    try:
        p = urlparse(url)
    except ValueError:
        return
    if p.scheme not in ('http', 'https') or not p.netloc or len(url) > 600:
        return
    key = url.split('#')[0].rstrip('/')
    if key in seen:
        return
    seen.add(key)
    domain = p.netloc.lower().removeprefix('www.')[:80]
    item = {'title': (str(title).strip()[:140] if isinstance(title, str) and title.strip() else domain), 'url': url, 'domain': domain}
    if date:
        item['date'] = str(date)[:32]
    out.append(item)


def extract_sources(result: dict) -> tuple:
    out, seen, kinds = [], set(), []
    sr = result.get('search_results')
    if isinstance(sr, list):
        n = len(out)
        for r in sr:
            if isinstance(r, dict):
                _add_source(out, seen, r.get('url'), r.get('title'), r.get('date') or r.get('last_updated'))
        if len(out) > n:
            kinds.append('search_results')
    cit = result.get('citations')
    if isinstance(cit, list):
        n = len(out)
        for c in cit:
            if isinstance(c, str):
                _add_source(out, seen, c)
            elif isinstance(c, dict):
                _add_source(out, seen, c.get('url'), c.get('title'))
        if len(out) > n:
            kinds.append('citations')
    choice = (result.get('choices') or [{}])[0] if isinstance(result.get('choices'), list) and result.get('choices') else {}
    msg = choice.get('message') if isinstance(choice, dict) else None
    ann = msg.get('annotations') if isinstance(msg, dict) else None
    if isinstance(ann, list):
        n = len(out)
        for a in ann:
            if isinstance(a, dict):
                uc = a.get('url_citation') if isinstance(a.get('url_citation'), dict) else a
                _add_source(out, seen, uc.get('url'), uc.get('title'))
        if len(out) > n:
            kinds.append('annotations')
    return out[:MAX_SOURCES], kinds


def clean_reply(text: str) -> str:
    t = re.sub(r'<think>.*?</think>', '', text, flags=re.S | re.I)
    t = re.sub(r'(?:\s*\[\d{1,2}\])+', '', t)
    t = re.sub(r'\[([^\]]+)\]\(https?://[^)]*\)', r'\1', t)
    t = re.sub(r'https?://\S+', '', t)
    t = re.sub(r'[ \t]+([,.;:!?])', r'\1', t)
    t = re.sub(r'[ \t]{2,}', ' ', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()


def spoken_summary(text: str, limit: int = 350) -> str:
    t = re.sub(r'```.*?```', ' ', text, flags=re.S)
    t = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', t)
    t = re.sub(r'https?://\S+', ' ', t)
    t = re.sub(r'^\s*[-•*]\s+', '', t, flags=re.M)
    t = re.sub(r'^\s*#+\s*', '', t, flags=re.M)
    t = re.sub(r'[*_#>~|`]+', ' ', t)
    t = re.sub(r'[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    if len(t) <= limit:
        return t
    cut = t[:limit]
    end = max(cut.rfind('. '), cut.rfind('! '), cut.rfind('? '))
    return cut[: end + 1] if end > limit * 0.4 else cut.rsplit(' ', 1)[0]


UNVERIFIED_NOTE = '\n\n_Источники в ответе не вернулись — данные не подтверждены, перепроверь их перед использованием._'

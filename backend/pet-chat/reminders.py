"""Напоминания к заметкам: разбор даты и времени без угадывания, расчёт срока по часовому поясу."""
import re
from datetime import date, datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None

UTC = timezone.utc


def utcnow():
    return datetime.now(UTC)
LEADS = (0, 15, 30)
DEFAULT_LEAD = 15
SNOOZE_MINUTES = 15

TZ_NAME = re.compile(r'^[A-Za-z][A-Za-z0-9_+\-]*(/[A-Za-z0-9_+\-]+){0,2}$')
FIXED_TZ = re.compile(r'^UTC([+-])(\d{2}):(\d{2})$')
LOCAL_FORMAT = re.compile(r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$')

WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
WEEKDAYS_ACC = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье']
MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
MONTH_NUM = {name: i + 1 for i, name in enumerate(MONTHS)}
WEEKDAY_NUM = {name: i for i, name in enumerate(WEEKDAYS_ACC)}
DAY_WORDS = {'сегодня': 0, 'завтра': 1, 'послезавтра': 2}
PART = r'(утра|дня|вечера|ночи)'
MONTHS_RE = '|'.join(MONTHS)

RE_DAY_WORD = re.compile(r'\b(послезавтра|завтра|сегодня)\b')
RE_WEEKDAY = re.compile(r'\b(?:в|во)\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)\b')
RE_DATE_TEXT = re.compile(rf'\b(\d{{1,2}})\s+({MONTHS_RE})\b(?:\s+(\d{{4}})(?!\d)(?:\s*(?:года|г\.?))?)?')
RE_DATE_ISO = re.compile(r'(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])')
RE_DATE_DOT = re.compile(r'(?<![\d:.])(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?![\d:])')
RE_DOT_PREFIX = re.compile(r'\b(?:на|до|к|числа)\s+$')
RE_REL = re.compile(r'\bчерез\s+(?:(\d{1,3})\s*)?(полчаса|минуту|минуты|минут|мин|часов|часа|час|ч|дней|дня|день|дн|недели|недель|неделю)\b')
RE_TIME_COLON = re.compile(rf'(?<![\d:.])(\d{{1,2}}):(\d{{2}})(?![\d:])(?:\s*{PART}\b)?')
RE_TIME_WORD = re.compile(rf'\b(?:в|к)\s+(\d{{1,2}})(?![\d:.])(?!\s*(?:{MONTHS_RE})\b)(?:\s*час(?:а|ов)?\b)?(?:\s*{PART}\b)?')
RE_NOON = re.compile(r'\bв\s+полдень\b')
RE_MIDNIGHT = re.compile(r'\bв\s+полночь\b')
RE_UNSUPPORTED = re.compile(r'\b(следующ\w*|на\s+выходных|каждый|каждую|каждое|ежедневно|еженедельно|утром|вечером|днем|ночью|на\s+неделе)\b')
RE_LEAD_30 = re.compile(r'\bза\s+(?:30\s+минут|полчаса)\b')
RE_LEAD_15 = re.compile(r'\bза\s+15\s+минут\b')
RE_LEAD_0 = re.compile(r'\b(?:в\s+указанное\s+время|ровно\s+в\s+срок|без\s+предупреждения)\b')


class ReminderError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def get_tz(name):
    if not isinstance(name, str):
        return None
    name = name.strip()
    match = FIXED_TZ.match(name)
    if match:
        hours, minutes = int(match[2]), int(match[3])
        if minutes > 59 or hours * 60 + minutes > 14 * 60:
            return None
        sign = 1 if match[1] == '+' else -1
        return timezone(timedelta(minutes=sign * (hours * 60 + minutes)), name)
    if ZoneInfo is not None and len(name) <= 64 and TZ_NAME.match(name):
        try:
            return ZoneInfo(name)
        except Exception:
            return None
    return None


def request_tz(name, offset_minutes):
    zone = get_tz(name)
    if zone is not None:
        return str(name).strip(), zone
    if isinstance(offset_minutes, int) and not isinstance(offset_minutes, bool) and -840 <= offset_minutes <= 840:
        sign = '+' if offset_minutes >= 0 else '-'
        label = f'UTC{sign}{abs(offset_minutes) // 60:02d}:{abs(offset_minutes) % 60:02d}'
        return label, get_tz(label)
    return None, None


def offset_label(aware):
    minutes = int(aware.utcoffset().total_seconds() // 60)
    sign = '+' if minutes >= 0 else '-'
    return f'UTC{sign}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}'


def tz_label(name, aware):
    off = offset_label(aware)
    return off if name.startswith('UTC') else f'{name}, {off}'


def localize(local, zone):
    first = local.replace(tzinfo=zone, fold=0)
    second = local.replace(tzinfo=zone, fold=1)
    if first.utcoffset() != second.utcoffset():
        raise ReminderError('reminder_ambiguous_time', 'В этот день при переводе часов это время повторяется или не существует. Выбери другое время.')
    return first


def due_from_local(local_text, tz_name):
    match = LOCAL_FORMAT.match(local_text) if isinstance(local_text, str) else None
    if not match:
        raise ReminderError('reminder_bad', 'Укажи дату и время напоминания.')
    zone = get_tz(tz_name)
    if zone is None:
        raise ReminderError('reminder_bad_tz', 'Не удалось определить часовой пояс. Напоминание не сохранено.')
    year, month, day, hour, minute = (int(g) for g in match.groups())
    if not 2000 <= year <= 2100:
        raise ReminderError('reminder_bad', 'Укажи дату от 2000 до 2100 года.')
    try:
        local = datetime(year, month, day, hour, minute)
    except ValueError:
        raise ReminderError('reminder_bad', 'Такой даты или времени не существует.')
    return localize(local, zone).astimezone(UTC)


def build(local_text, tz_name, lead, now_utc):
    if isinstance(lead, bool) or lead not in LEADS:
        raise ReminderError('reminder_bad', 'Напомнить можно за 15 минут, за 30 минут или в указанное время.')
    due = due_from_local(local_text, tz_name)
    if due <= now_utc:
        raise ReminderError('reminder_past', 'Это время уже прошло. Выбери время в будущем.')
    remind_at = due - timedelta(minutes=lead)
    if lead and remind_at <= now_utc:
        remind_at, lead = due, 0
    return {'due_at': due, 'lead': lead, 'tz': tz_name, 'remind_at': remind_at}


def lead_text(lead):
    return 'в указанное время' if lead == 0 else f'за {lead} минут'


def describe(due_at, tz_name):
    zone = get_tz(tz_name) or UTC
    local = due_at.astimezone(zone)
    when = f'{WEEKDAYS[local.weekday()]}, {local.day} {MONTHS[local.month - 1]} {local.year}, {local:%H:%M}'
    return when, tz_label(tz_name if get_tz(tz_name) else 'UTC+00:00', local)


def public_reminder(due_at, lead, tz_name, remind_at, state, seq):
    if due_at is None:
        return None
    zone = get_tz(tz_name) or UTC
    local = due_at.astimezone(zone)
    when, label = describe(due_at, tz_name or 'UTC+00:00')
    summary = f'{when} ({label}), напомню {lead_text(lead)}'
    return {
        'dueAt': due_at.isoformat(),
        'dueLocal': local.strftime('%Y-%m-%dT%H:%M'),
        'tz': tz_name,
        'tzLabel': label,
        'lead': lead,
        'leadText': lead_text(lead),
        'remindAt': remind_at.isoformat() if remind_at else None,
        'state': state,
        'seq': seq or 0,
        'when': when,
        'text': summary,
    }


def lead_from_text(text, default=DEFAULT_LEAD):
    low = str(text).lower().replace('ё', 'е')
    if RE_LEAD_0.search(low):
        return 0
    if RE_LEAD_30.search(low):
        return 30
    if RE_LEAD_15.search(low):
        return 15
    return default


def _hour(hour, part, colon):
    if part is None:
        if colon:
            return hour, None
        if 13 <= hour <= 23:
            return hour, None
        return None, f'«в {hour}» — это утра или вечера?'
    if hour > 12 or hour == 0:
        return None, f'«{hour} {part}» не сочетается: укажи время одним способом.'
    if part == 'утра':
        return (hour, None) if 1 <= hour <= 11 else (None, '«12 утра» непонятно: это полдень или полночь?')
    if part == 'дня':
        if hour == 12:
            return 12, None
        return (hour + 12, None) if 1 <= hour <= 6 else (None, f'«{hour} дня» непонятно: уточни время.')
    if part == 'вечера':
        return (hour + 12, None) if 5 <= hour <= 11 else (None, f'«{hour} вечера» непонятно: уточни время.')
    if hour == 12:
        return None, '«12 ночи» непонятно: это полночь этого или следующего дня?'
    if 1 <= hour <= 4:
        return hour, None
    return (hour + 12, None) if hour == 11 else (None, f'«{hour} ночи» непонятно: уточни время.')


def parse_when(text, now):
    """Возвращает {'status': 'none'|'ok'|'ambiguous', ...}. now — aware-время в часовом поясе пользователя."""
    low = str(text).lower().replace('ё', 'е')
    today = now.date()
    dates, times, problems = set(), set(), []
    unclear_dotted = False
    absolute = None

    for m in RE_DAY_WORD.finditer(low):
        dates.add(today + timedelta(days=DAY_WORDS[m[1]]))
    for m in RE_WEEKDAY.finditer(low):
        delta = (WEEKDAY_NUM[m[1]] - today.weekday()) % 7
        if delta == 0:
            problems.append(f'«в {m[1]}» — это сегодня или через неделю?')
        else:
            dates.add(today + timedelta(days=delta))
    for m in RE_DATE_TEXT.finditer(low):
        day, month, year = int(m[1]), MONTH_NUM[m[2]], int(m[3]) if m[3] else None
        try:
            found = date(year or today.year, month, day)
        except ValueError:
            problems.append(f'Даты «{m[1]} {m[2]}» не существует.')
            continue
        if year is None and found < today:
            problems.append(f'Дата «{day} {m[2]}» в этом году уже прошла. Какой год имеешь в виду?')
        else:
            dates.add(found)
    for m in RE_DATE_ISO.finditer(low):
        try:
            dates.add(date(int(m[1]), int(m[2]), int(m[3])))
        except ValueError:
            problems.append(f'Даты «{m[0]}» не существует.')
    for m in RE_DATE_DOT.finditer(low):
        day, month, year = int(m[1]), int(m[2]), int(m[3]) if m[3] else None
        if year is None and month > 12 and day > 31:
            continue
        if year is not None or RE_DOT_PREFIX.search(low[:m.start()]):
            try:
                found = date(year or today.year, month, day)
            except ValueError:
                problems.append(f'Даты «{m[0]}» не существует.')
                continue
            if year is None and found < today:
                problems.append(f'Дата «{m[0]}» в этом году уже прошла. Какой год имеешь в виду?')
            else:
                dates.add(found)
        elif 1 <= month <= 12 and 1 <= day <= 31:
            unclear_dotted = True
    for m in RE_REL.finditer(low):
        count, unit = int(m[1]) if m[1] else 1, m[2]
        if unit == 'полчаса':
            absolute = now + timedelta(minutes=30)
        elif unit.startswith('мин'):
            absolute = now + timedelta(minutes=count)
        elif unit in ('час', 'часа', 'часов', 'ч'):
            absolute = now + timedelta(hours=count)
        elif unit.startswith('нед'):
            dates.add(today + timedelta(days=7 * count))
        else:
            dates.add(today + timedelta(days=count))

    for m in RE_TIME_COLON.finditer(low):
        hour, minute = int(m[1]), int(m[2])
        if hour > 23 or minute > 59:
            continue
        value, why = _hour(hour, m[3], True)
        if why:
            problems.append(why)
        else:
            times.add((value, minute))
    if RE_NOON.search(low):
        times.add((12, 0))
    if RE_MIDNIGHT.search(low):
        problems.append('«в полночь» непонятно: это начало этого или следующего дня?')
    for m in RE_TIME_WORD.finditer(low):
        explicit = bool(m[2]) or 'час' in m[0]
        if not dates and not explicit:
            continue
        hour = int(m[1])
        if hour > 23:
            continue
        value, why = _hour(hour, m[2], False)
        if why:
            problems.append(why)
        else:
            times.add((value, 0))

    recognized = bool(dates or times or problems or absolute)
    if not recognized:
        return {'status': 'none'}
    if problems:
        return {'status': 'ambiguous', 'reason': problems[0]}
    if unclear_dotted or RE_UNSUPPORTED.search(low):
        return {'status': 'ambiguous', 'reason': 'Не понял, когда именно напомнить.'}
    if len(dates) > 1:
        return {'status': 'ambiguous', 'reason': 'Нашёл несколько дат.'}
    if len(times) > 1:
        return {'status': 'ambiguous', 'reason': 'Нашёл несколько разных времён.'}
    if absolute is not None:
        if dates or times:
            return {'status': 'ambiguous', 'reason': 'Указано и «через …», и точное время.'}
        local = absolute.replace(second=0, microsecond=0, tzinfo=None)
        return {'status': 'ok', 'local': local + timedelta(minutes=1 if absolute.second or absolute.microsecond else 0)}
    if dates and not times:
        return {'status': 'ambiguous', 'reason': 'Не указано время.'}
    hour, minute = next(iter(times))
    day = next(iter(dates)) if dates else today
    local = datetime(day.year, day.month, day.day, hour, minute)
    if not dates and local <= now.replace(tzinfo=None):
        return {'status': 'ambiguous', 'reason': 'Сегодня это время уже прошло. На какой день поставить?'}
    if local <= now.replace(tzinfo=None):
        return {'status': 'ambiguous', 'reason': 'Это время уже прошло.'}
    return {'status': 'ok', 'local': local}

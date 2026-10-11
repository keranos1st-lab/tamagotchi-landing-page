import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'pet-chat'))
import notes
import reminders as r

try:
    from zoneinfo import ZoneInfo
    ZoneInfo('Europe/Moscow')
    HAS_TZ = True
except Exception:
    HAS_TZ = False

MSK = timezone(timedelta(hours=3))
NOW = datetime(2026, 10, 11, 14, 0, tzinfo=MSK)
UTC = timezone.utc


def parse(text):
    return r.parse_when(text, NOW)


class WhenParsing(unittest.TestCase):
    def ok(self, text, expected):
        res = parse(text)
        self.assertEqual(res['status'], 'ok', (text, res))
        self.assertEqual(res['local'], expected, text)

    def ambiguous(self, text, fragment=''):
        res = parse(text)
        self.assertEqual(res['status'], 'ambiguous', (text, res))
        self.assertIn(fragment, res['reason'], text)

    def test_example_from_the_brief(self):
        self.ok('завтра в 12:00 позвонить Сергею', datetime(2026, 10, 12, 12, 0))

    def test_plain_notes_have_no_reminder(self):
        for text in ('Добавить Кодику новую анимацию', 'купить 2 яблока', 'версия 1.2 вышла', 'проверить сайт в 3 тикетах', 'идея для игры'):
            self.assertEqual(parse(text)['status'], 'none', text)

    def test_dayparts(self):
        self.ok('завтра в 7 утра встать', datetime(2026, 10, 12, 7, 0))
        self.ok('завтра в 7 вечера кино', datetime(2026, 10, 12, 19, 0))
        self.ok('завтра в 3 дня обед', datetime(2026, 10, 12, 15, 0))
        self.ok('послезавтра в полдень', datetime(2026, 10, 13, 12, 0))

    def test_ambiguous_hours_are_not_guessed(self):
        self.ambiguous('завтра в 7 позвонить', 'утра или вечера')
        self.ambiguous('завтра в 12 позвонить', 'утра или вечера')
        self.ambiguous('завтра в 12 ночи', 'ночи')
        self.ambiguous('в полночь пить воду', 'полночь')
        self.ambiguous('в 5 ночи', 'уточни')

    def test_missing_time_or_date(self):
        self.ambiguous('завтра позвонить маме', 'время')
        self.ambiguous('в 10:00 позвонить', 'прошло')

    def test_weekday_today_is_ambiguous(self):
        self.ambiguous('в воскресенье в 10:00 встреча', 'сегодня или через неделю')
        self.ok('в среду в 15:30 встреча', datetime(2026, 10, 14, 15, 30))

    def test_dates(self):
        self.ok('13 октября в 9:00 врач', datetime(2026, 10, 13, 9, 0))
        self.ok('2026-10-12 09:00 встреча', datetime(2026, 10, 12, 9, 0))
        self.ok('на 12.10 в 9:00 встреча', datetime(2026, 10, 12, 9, 0))
        self.ambiguous('5 октября в 9:00 врач', 'прошла')
        self.ambiguous('31 февраля в 9:00', 'не существует')
        self.ambiguous('12.10 в 9:00 встреча')

    def test_relative(self):
        self.ok('через 2 часа выпить воду', datetime(2026, 10, 11, 16, 0))
        self.ok('через 30 минут чай', datetime(2026, 10, 11, 14, 30))
        self.ok('через неделю в 10:00 отчёт', datetime(2026, 10, 18, 10, 0))

    def test_conflicting_or_unsupported(self):
        self.ambiguous('завтра в 12:00 или в 13:00', 'несколько')
        self.ambiguous('в следующую пятницу в 10:00')
        self.ambiguous('каждый день в 10:00 зарядка')

    def test_lead_words(self):
        self.assertEqual(r.lead_from_text('встреча завтра в 15:00'), 15)
        self.assertEqual(r.lead_from_text('встреча завтра в 15:00 за 30 минут'), 30)
        self.assertEqual(r.lead_from_text('встреча в указанное время'), 0)


@unittest.skipUnless(HAS_TZ, 'нужна база часовых поясов (tzdata)')
class Timezones(unittest.TestCase):
    NOW = datetime(2026, 10, 11, 11, 0, tzinfo=UTC)

    def test_saves_time_and_zone(self):
        spec = r.build('2026-10-12T12:00', 'Europe/Moscow', 15, self.NOW)
        self.assertEqual(spec['due_at'], datetime(2026, 10, 12, 9, 0, tzinfo=UTC))
        self.assertEqual(spec['remind_at'], datetime(2026, 10, 12, 8, 45, tzinfo=UTC))
        self.assertEqual(spec['tz'], 'Europe/Moscow')

    def test_other_zones_and_dst(self):
        self.assertEqual(r.build('2099-01-15T12:00', 'Asia/Kolkata', 30, self.NOW)['due_at'], datetime(2099, 1, 15, 6, 30, tzinfo=UTC))
        self.assertEqual(r.build('2099-07-15T12:00', 'Europe/Berlin', 0, self.NOW)['due_at'], datetime(2099, 7, 15, 10, 0, tzinfo=UTC))
        self.assertEqual(r.build('2099-01-15T12:00', 'Europe/Berlin', 0, self.NOW)['due_at'], datetime(2099, 1, 15, 11, 0, tzinfo=UTC))

    def test_fixed_offset_fallback(self):
        self.assertEqual(r.build('2026-10-12T12:00', 'UTC+05:30', 15, self.NOW)['due_at'], datetime(2026, 10, 12, 6, 30, tzinfo=UTC))

    def test_dst_gap_is_rejected(self):
        with self.assertRaises(r.ReminderError) as ctx:
            r.build('2099-03-29T02:30', 'Europe/Berlin', 15, self.NOW)
        self.assertEqual(ctx.exception.code, 'reminder_ambiguous_time')

    def test_rejects_bad_input(self):
        for args, code in (
            (('2020-01-01T12:00', 'Europe/Moscow', 15), 'reminder_past'),
            (('2099-01-15T12:00', 'Mars/Base', 15), 'reminder_bad_tz'),
            (('2099-01-15T12:00', 'Europe/Moscow', 10), 'reminder_bad'),
            (('2099-13-45T12:00', 'Europe/Moscow', 15), 'reminder_bad'),
            (('завтра', 'Europe/Moscow', 15), 'reminder_bad'),
        ):
            with self.assertRaises(r.ReminderError) as ctx:
                r.build(*args, self.NOW)
            self.assertEqual(ctx.exception.code, code, args)

    def test_short_lead_falls_back_to_exact_time(self):
        spec = r.build('2026-10-11T14:10', 'Europe/Moscow', 15, self.NOW)
        self.assertEqual(spec['lead'], 0)
        self.assertEqual(spec['remind_at'], spec['due_at'])

    def test_request_zone_prefers_name_then_offset(self):
        self.assertEqual(r.request_tz('Europe/Moscow', 0)[0], 'Europe/Moscow')
        self.assertEqual(r.request_tz('', 330)[0], 'UTC+05:30')
        self.assertEqual(r.request_tz('Mars/Base', -300)[0], 'UTC-05:00')
        self.assertEqual(r.request_tz('', None), (None, None))

    def test_public_reminder_shows_date_time_zone(self):
        due = datetime(2026, 10, 12, 9, 0, tzinfo=UTC)
        pub = r.public_reminder(due, 15, 'Europe/Moscow', due - timedelta(minutes=15), 'active', 3)
        self.assertEqual(pub['dueLocal'], '2026-10-12T12:00')
        self.assertIn('12:00', pub['text'])
        self.assertIn('UTC+03:00', pub['text'])
        self.assertEqual(pub['seq'], 3)
        self.assertIsNone(r.public_reminder(None, None, None, None, None, 0))


@unittest.skipUnless(HAS_TZ, 'нужна база часовых поясов (tzdata)')
class Vladivostok(unittest.TestCase):
    CMD = {'tzname': 'Asia/Vladivostok', 'tzoff': 600}
    PHRASE = 'завтра в 12:00 позвонить Сергею'

    def spec(self, utc_now, phrase=None, cmd=None):
        status, value = notes._spec_for(phrase or self.PHRASE, cmd or self.CMD, utc_now)
        self.assertEqual(status, 'ok', (utc_now, value))
        return value

    def check(self, utc_now, local_date, hour=12, minute=0):
        value = self.spec(utc_now)
        proposal = notes._proposal(value, 1)
        self.assertEqual(proposal['dueLocal'], f'{local_date}T{hour:02d}:{minute:02d}')
        self.assertEqual(proposal['tz'], 'Asia/Vladivostok')
        self.assertEqual(proposal['tzLabel'], 'Asia/Vladivostok, UTC+10:00')
        self.assertEqual(value['due_at'], datetime(*map(int, local_date.split('-')), hour, minute, tzinfo=ZoneInfo('Asia/Vladivostok')).astimezone(UTC))

    def test_offset_is_plus_ten_all_year(self):
        zone = ZoneInfo('Asia/Vladivostok')
        for month in (1, 7):
            self.assertEqual(datetime(2026, month, 1, 12, tzinfo=zone).utcoffset(), timedelta(hours=10))

    def test_tomorrow_noon_is_local_noon(self):
        self.check(datetime(2026, 10, 11, 5, 0, tzinfo=UTC), '2026-10-12')
        self.assertEqual(self.spec(datetime(2026, 10, 11, 5, 0, tzinfo=UTC))['due_at'], datetime(2026, 10, 12, 2, 0, tzinfo=UTC))

    def test_before_local_midnight_tomorrow_is_next_local_day(self):
        self.check(datetime(2026, 10, 11, 13, 30, tzinfo=UTC), '2026-10-12')
        self.check(datetime(2026, 10, 11, 13, 59, tzinfo=UTC), '2026-10-12')

    def test_after_local_midnight_tomorrow_moves_one_day_forward(self):
        self.check(datetime(2026, 10, 11, 14, 1, tzinfo=UTC), '2026-10-13')
        self.check(datetime(2026, 10, 11, 14, 30, tzinfo=UTC), '2026-10-13')

    def test_year_and_month_boundaries(self):
        self.check(datetime(2026, 12, 31, 13, 45, tzinfo=UTC), '2027-01-01')
        self.check(datetime(2026, 12, 31, 14, 10, tzinfo=UTC), '2027-01-02')
        self.check(datetime(2027, 2, 28, 13, 50, tzinfo=UTC), '2027-03-01')

    def test_today_uses_local_date(self):
        value = self.spec(datetime(2026, 10, 11, 13, 50, tzinfo=UTC), 'сегодня в 23:55 выключить')
        self.assertEqual(notes._proposal(value, 1)['dueLocal'], '2026-10-11T23:55')
        value = self.spec(datetime(2026, 10, 11, 14, 30, tzinfo=UTC), 'сегодня в 12:00 встреча')
        self.assertEqual(notes._proposal(value, 1)['dueLocal'], '2026-10-12T12:00')

    def test_offset_only_when_zone_name_is_missing(self):
        value = self.spec(datetime(2026, 10, 11, 14, 30, tzinfo=UTC), cmd={'tzname': '', 'tzoff': 600})
        proposal = notes._proposal(value, 1)
        self.assertEqual(proposal['tzLabel'], 'UTC+10:00')
        self.assertEqual(proposal['dueLocal'], '2026-10-13T12:00')
        self.assertEqual(value['due_at'], datetime(2026, 10, 13, 2, 0, tzinfo=UTC))

    def test_same_phrase_differs_by_zone(self):
        now = datetime(2026, 10, 11, 14, 30, tzinfo=UTC)
        due = {name: self.spec(now, cmd={'tzname': name, 'tzoff': 0})['due_at'] for name in ('UTC', 'Europe/Moscow', 'Asia/Vladivostok')}
        self.assertEqual(due['UTC'], datetime(2026, 10, 12, 12, 0, tzinfo=UTC))
        self.assertEqual(due['Europe/Moscow'], datetime(2026, 10, 12, 9, 0, tzinfo=UTC))
        self.assertEqual(due['Asia/Vladivostok'], datetime(2026, 10, 13, 2, 0, tzinfo=UTC))

    def test_saved_reminder_reads_back_in_local_time(self):
        spec = r.build('2026-10-13T12:00', 'Asia/Vladivostok', 15, datetime(2026, 10, 11, 22, 0, tzinfo=UTC))
        pub = r.public_reminder(spec['due_at'], spec['lead'], spec['tz'], spec['remind_at'], 'active', 1)
        self.assertEqual(pub['dueLocal'], '2026-10-13T12:00')
        self.assertEqual(pub['tzLabel'], 'Asia/Vladivostok, UTC+10:00')
        self.assertEqual(pub['dueAt'], '2026-10-13T02:00:00+00:00')
        self.assertEqual(pub['remindAt'], '2026-10-13T01:45:00+00:00')


class Commands(unittest.TestCase):
    def test_remind_commands_are_parsed(self):
        cmd = notes.parse('поставь напоминание для заметки 12 завтра в 15:00 за 30 минут', 'Кодик')
        self.assertEqual((cmd['action'], cmd['id']), ('remind', 12))
        self.assertIn('завтра в 15:00', cmd['when'])
        self.assertEqual(notes.parse('отключи напоминание для заметки 12', 'Кодик')['action'], 'unremind')
        self.assertEqual(notes.parse('Кодик, напомни про заметку 7 завтра в 9:00', 'Кодик')['id'], 7)

    def test_quick_create_with_colon(self):
        self.assertEqual(notes.parse('запиши: завтра в 12:00 позвонить Сергею', 'Кодик'), {'action': 'create', 'text': 'завтра в 12:00 позвонить Сергею', 'query': ''})

    def test_old_commands_still_work(self):
        self.assertEqual(notes.parse('Запиши заметку: добавить дракону новую анимацию', 'Кодик')['action'], 'create')
        self.assertEqual(notes.parse('Найди заметку про Сергея', 'Кодик')['action'], 'find')
        self.assertEqual(notes.parse('Исправь заметку номер 12: новый текст', 'Кодик')['action'], 'update')
        self.assertIsNone(notes.parse('запиши как дела', 'Кодик'))
        self.assertIsNone(notes.parse('Добавить Кодику новую анимацию', 'Кодик'))


if __name__ == '__main__':
    unittest.main()

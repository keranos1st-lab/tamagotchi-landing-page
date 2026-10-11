import datetime
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'pet-chat'))
import notes

NOW = datetime.datetime(2026, 10, 11)


class Conn:
    def __init__(self, cur):
        self.cur = cur
        self.autocommit = True
        self.commits = 0

    def cursor(self):
        return self.cur

    def commit(self):
        self.commits += 1

    def rollback(self):
        pass

    def close(self):
        pass


class Cur:
    def __init__(self, rows=None, session=7):
        self.rows = rows or []
        self.session = session
        self.sql = []
        self.args = []
        self._next = []

    def execute(self, sql, args=None):
        self.sql.append(sql)
        self.args.append(args)
        if 'FROM "s".sessions' in sql:
            self._next = [(self.session,)] if self.session else []
        elif 'FROM "s".users' in sql:
            self._next = [(self.session,)]
        elif 'COUNT(*)' in sql:
            self._next = [(len(self.rows),)]
        elif 'pet_note_requests WHERE user_id' in sql and 'request_id' in sql:
            self._next = []
        elif 'pet_notes' in sql and 'SELECT id, text' in sql:
            self._next = list(self.rows)
        else:
            self._next = []

    def fetchone(self):
        return self._next[0] if self._next else None

    def fetchall(self):
        return list(self._next)


def row(i, text, v=1):
    return (i, text, v, NOW)


def call(data, cur, token='tok'):
    conn = Conn(cur)
    res = notes.handle_api(data, {'x-auth-token': token} if token else {}, lambda: conn, 's')
    return res, conn


class ListApi(unittest.TestCase):
    def test_ordinary_chat_is_not_an_api_call(self):
        self.assertIsNone(notes.handle_api({'message': 'привет'}, {}, None, 's'))

    def test_requires_login(self):
        res, _ = call({'notesApi': 'list'}, Cur(), token='')
        self.assertEqual(res[0], 401)
        res, _ = call({'notesApi': 'list'}, Cur(session=None))
        self.assertEqual(res[0], 401)

    def test_lists_more_than_five_and_pages(self):
        rows = [row(i, f'заметка {i}') for i in range(12, 0, -1)]
        res, _ = call({'notesApi': 'list'}, Cur(rows))
        self.assertEqual(res[0], 200)
        self.assertEqual(len(res[1]['notes']), 12)
        self.assertFalse(res[1]['hasMore'])

    def test_search_uses_word_forms(self):
        rows = [row(2, 'Купить молоко'), row(1, 'Завтра позвонить Сергею в 12 дня')]
        res, _ = call({'notesApi': 'list', 'query': 'Сергея'}, Cur(rows))
        self.assertEqual([n['id'] for n in res[1]['notes']], [1])
        self.assertEqual(res[1]['total'], 1)

    def test_bad_offset_rejected(self):
        res, _ = call({'notesApi': 'list', 'offset': -1}, Cur())
        self.assertEqual(res[0], 400)
        res, _ = call({'notesApi': 'list', 'offset': 'x'}, Cur())
        self.assertEqual(res[0], 400)

    def test_owner_comes_from_the_session_only(self):
        cur = Cur([row(1, 'a')], session=42)
        call({'notesApi': 'list', 'userId': 1}, cur)
        listing = [a for s, a in zip(cur.sql, cur.args) if 'SELECT id, text' in s][0]
        self.assertEqual(listing[0], 42)


class SaveApi(unittest.TestCase):
    def test_empty_and_long_text_rejected_before_database(self):
        res, conn = call({'notesApi': 'save', 'text': '  ', 'requestId': 'abcdefgh1234'}, Cur())
        self.assertEqual(res[0], 400)
        res, _ = call({'notesApi': 'save', 'text': 'x' * 1801, 'requestId': 'abcdefgh1234'}, Cur())
        self.assertEqual(res[0], 400)

    def test_request_id_required(self):
        res, _ = call({'notesApi': 'save', 'text': 'a'}, Cur())
        self.assertEqual(res[0], 400)

    def test_bad_id_rejected(self):
        res, _ = call({'notesApi': 'save', 'text': 'a', 'id': '1 OR 1=1', 'requestId': 'abcdefgh1234'}, Cur())
        self.assertEqual(res[0], 400)
        res, _ = call({'notesApi': 'save', 'text': 'a', 'id': True, 'requestId': 'abcdefgh1234'}, Cur())
        self.assertEqual(res[0], 400)

    def test_update_of_foreign_or_missing_note_is_404_and_commits_nothing(self):
        res, conn = call({'notesApi': 'save', 'text': 'a', 'id': 5, 'requestId': 'abcdefgh1234'}, Cur([]))
        self.assertEqual(res[0], 404)
        self.assertEqual(conn.commits, 0)

    def test_update_filters_by_session_owner(self):
        cur = Cur([row(5, 'old', 1)], session=9)
        cur.fetchone = lambda: row(5, 'old', 1) if cur.sql[-1].startswith('SELECT id, text') else ((9,) if cur._next else None)
        call({'notesApi': 'save', 'text': 'new', 'id': 5, 'requestId': 'abcdefgh1234'}, cur)
        lookup = [(s, a) for s, a in zip(cur.sql, cur.args) if 'FOR UPDATE' in s and 'pet_notes' in s]
        self.assertTrue(lookup)
        self.assertEqual(lookup[0][1], (9, 5))

    def test_unknown_command(self):
        res, _ = call({'notesApi': 'drop'}, Cur())
        self.assertEqual(res[0], 400)


if __name__ == '__main__':
    unittest.main()

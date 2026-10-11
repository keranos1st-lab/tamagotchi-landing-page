import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'pet-chat'))
import notes


import datetime


class FakeCursor:
    def __init__(self, texts):
        now = datetime.datetime(2026, 10, 11)
        self.rows = [(i + 1, t, 1, now) for i, t in enumerate(texts)]

    def execute(self, sql, args=None):
        pass

    def fetchall(self):
        return self.rows


def matches(note, query):
    return bool(notes.selector(FakeCursor([note]), 's', 1, query))


class CaseSearch(unittest.TestCase):
    def test_sergey_all_cases(self):
        note = 'Завтра позвонить Сергею в 12 дня'
        for q in ('про Сергея', 'про Сергей', 'про Сергее', 'про Сергеем', 'о Сергее', 'сергея', 'Сергею'):
            self.assertTrue(matches(note, q), q)

    def test_dragon_cases(self):
        note = 'Дракон машет крыльями'
        for q in ('про дракона', 'про дракону', 'про драконе', 'про драконом', 'про крылья', 'про крыльями'):
            self.assertTrue(matches(note, q), q)

    def test_other_words(self):
        self.assertTrue(matches('Купить молоко и яблоки', 'про молоком'))
        self.assertTrue(matches('Купить молоко и яблоки', 'про яблок'))
        self.assertTrue(matches('Ёлка на новый год', 'про елку'))

    def test_stems_are_shared_between_cases(self):
        self.assertEqual({notes.stem(w) for w in ('Сергей', 'Сергея', 'Сергею', 'Сергеем', 'Сергее', 'Сергеи')}, {'серг'})
        self.assertEqual({notes.stem(w) for w in ('дракон', 'дракона', 'дракону', 'драконом', 'драконе')}, {'дракон'})
        self.assertEqual({notes.stem(w) for w in ('Анна', 'Анну', 'Анны', 'Анне', 'Анной')}, {'анн'})

    def test_no_false_match(self):
        self.assertFalse(matches('Завтра позвонить Сергею в 12 дня', 'про Анну'))
        self.assertFalse(matches('Дракон машет крыльями', 'про Сергея'))

    def test_several_matches_return_all(self):
        cur = FakeCursor(['Позвонить Сергею', 'Купить подарок Сергею', 'Купить молоко'])
        self.assertEqual([r[0] for r in notes.selector(cur, 's', 1, 'про Сергея')], [1, 2])

    def test_parser_routes_search(self):
        self.assertEqual(notes.parse('Найди заметку про Сергея', 'Кодик'), {'action': 'find', 'query': 'про Сергея', 'text': ''})
        self.assertEqual(notes.parse('Исправь заметку про Сергея: звонок в 15', 'Кодик')['action'], 'update')


if __name__ == '__main__':
    unittest.main()

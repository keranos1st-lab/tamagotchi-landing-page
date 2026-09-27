"""
Аккаунты PetAgent: регистрация и вход по почте и паролю, выход,
проверка сессии, смена пароля и удаление аккаунта.
Пароли хранятся только в виде хеша PBKDF2, токены сессий — в виде SHA-256.
Токен передаётся в заголовке X-Auth-Token.
Также синхронизирует прогресс питомца, достижения и память между
устройствами (GET ?sync=1, POST action=sync_save) — только для владельца.
"""
import hashlib
import hmac
import json
import os
import re
import secrets

import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
SESSION_DAYS = 90
MAX_SYNC_BYTES = 400_000
ITERATIONS = 200_000
EMAIL_RE = re.compile(r'^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
}

MESSAGES = {
    'bad_email': 'Проверьте адрес почты',
    'weak_password': 'Пароль должен быть не короче 8 символов',
    'exists': 'Аккаунт с этой почтой уже есть — войдите',
    'invalid': 'Неверная почта или пароль',
    'too_many': 'Слишком много попыток входа — подождите 15 минут',
    'unauthorized': 'Сессия истекла — войдите снова',
    'bad_request': 'Некорректный запрос',
}


def respond(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps(body, ensure_ascii=False)}


def fail(status: int, code: str) -> dict:
    return respond(status, {'error': code, 'message': MESSAGES.get(code, code)})


def esc(v: str) -> str:
    return v.replace("'", "''")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ITERATIONS).hex()
    return f'pbkdf2_sha256${ITERATIONS}${salt}${digest}'


def check_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt, digest = stored.split('$')
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(iters)).hex()
    return hmac.compare_digest(calc, digest)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session(cur, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    cur.execute(
        f"INSERT INTO {SCHEMA}.sessions (token_hash, user_id, expires_at) "
        f"VALUES ('{token_hash(token)}', {int(user_id)}, NOW() + INTERVAL '{SESSION_DAYS} days')"
    )
    return token


def session_user(cur, token: str):
    if not token or len(token) > 200:
        return None
    cur.execute(
        f"SELECT u.id, u.email, u.created_at FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token_hash = '{token_hash(token)}' AND s.expires_at > NOW()"
    )
    row = cur.fetchone()
    if not row:
        return None
    cur.execute(f"UPDATE {SCHEMA}.sessions SET last_seen_at = NOW() WHERE token_hash = '{token_hash(token)}'")
    return {'id': row[0], 'email': row[1], 'createdAt': row[2].isoformat()}


def too_many_attempts(cur, email: str, ip: str) -> bool:
    cur.execute(
        f"SELECT "
        f"COUNT(*) FILTER (WHERE email = '{esc(email)}'), "
        f"COUNT(*) FILTER (WHERE ip = '{esc(ip)}') "
        f"FROM {SCHEMA}.auth_attempts WHERE ok = FALSE AND created_at > NOW() - INTERVAL '15 minutes'"
    )
    by_email, by_ip = cur.fetchone()
    return by_email >= 8 or by_ip >= 30


def attempt(cur, email: str, ip: str, ok: bool) -> None:
    cur.execute(
        f"INSERT INTO {SCHEMA}.auth_attempts (email, ip, ok) VALUES ('{esc(email)}', '{esc(ip)}', {'TRUE' if ok else 'FALSE'})"
    )


def jsonb(v) -> str:
    if v is None:
        return 'NULL'
    return f"'{esc(json.dumps(v, ensure_ascii=False))}'::jsonb"


def read_state(cur, uid: int) -> dict:
    cur.execute(f"SELECT pet, achievements, memory, rev, client_updated_at FROM {SCHEMA}.user_state WHERE user_id = {int(uid)}")
    row = cur.fetchone()
    if not row:
        return {'pet': None, 'achievements': None, 'memory': None, 'rev': 0, 'clientUpdatedAt': 0}
    return {'pet': row[0], 'achievements': row[1], 'memory': row[2], 'rev': row[3], 'clientUpdatedAt': int(row[4])}


def save_state(cur, uid: int, data: dict) -> dict:
    base = int(data.get('baseRev') or 0)
    force = bool(data.get('force'))
    stamp = int(data.get('clientUpdatedAt') or 0)
    pet, ach, mem = data.get('pet'), data.get('achievements'), data.get('memory')
    for part in (pet, ach, mem):
        if part is not None and not isinstance(part, dict):
            return fail(400, 'bad_request')
    cur.execute(f"INSERT INTO {SCHEMA}.user_state (user_id) VALUES ({int(uid)}) ON CONFLICT (user_id) DO NOTHING")
    cond = '' if force else f' AND rev = {base}'
    cur.execute(
        f"UPDATE {SCHEMA}.user_state SET pet = {jsonb(pet)}, achievements = {jsonb(ach)}, memory = {jsonb(mem)}, "
        f"rev = rev + 1, client_updated_at = {stamp}, updated_at = NOW() "
        f"WHERE user_id = {int(uid)}{cond} RETURNING rev"
    )
    row = cur.fetchone()
    if not row:
        return respond(409, {'error': 'conflict', 'message': 'На другом устройстве есть более новое сохранение', 'server': read_state(cur, uid)})
    return respond(200, {'rev': row[0]})


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}
    token = headers.get('x-auth-token') or ''
    ip = ((event.get('requestContext') or {}).get('identity') or {}).get('sourceIp') or ''

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    try:
        cur = conn.cursor()

        if method == 'GET':
            user = session_user(cur, token)
            if not user:
                return fail(401, 'unauthorized')
            if (event.get('queryStringParameters') or {}).get('sync'):
                return respond(200, read_state(cur, user['id']))
            return respond(200, {'user': user})

        if method != 'POST':
            return fail(405, 'bad_request')
        raw = event.get('body') or '{}'
        if len(raw.encode()) > MAX_SYNC_BYTES:
            return respond(413, {'error': 'too_large', 'message': 'Сохранение слишком большое'})
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return fail(400, 'bad_request')

        action = data.get('action')
        email = str(data.get('email') or '').strip().lower()[:254]
        password = str(data.get('password') or '')

        if action in ('register', 'login'):
            if not EMAIL_RE.match(email):
                return fail(400, 'bad_email')
            if too_many_attempts(cur, email, ip):
                return fail(429, 'too_many')

        if action == 'register':
            if len(password) < 8 or len(password) > 200:
                return fail(400, 'weak_password')
            cur.execute(f"SELECT 1 FROM {SCHEMA}.users WHERE email = '{esc(email)}'")
            if cur.fetchone():
                attempt(cur, email, ip, False)
                return fail(409, 'exists')
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (email, password_hash, last_login_at) "
                f"VALUES ('{esc(email)}', '{esc(hash_password(password))}', NOW()) RETURNING id, created_at"
            )
            uid, created = cur.fetchone()
            attempt(cur, email, ip, True)
            tok = new_session(cur, uid)
            return respond(200, {'token': tok, 'user': {'id': uid, 'email': email, 'createdAt': created.isoformat()}, 'created': True})

        if action == 'login':
            cur.execute(f"SELECT id, password_hash, created_at FROM {SCHEMA}.users WHERE email = '{esc(email)}'")
            row = cur.fetchone()
            if not row or not check_password(password, row[1]):
                attempt(cur, email, ip, False)
                return fail(401, 'invalid')
            attempt(cur, email, ip, True)
            cur.execute(f"UPDATE {SCHEMA}.users SET last_login_at = NOW() WHERE id = {int(row[0])}")
            tok = new_session(cur, row[0])
            return respond(200, {'token': tok, 'user': {'id': row[0], 'email': email, 'createdAt': row[2].isoformat()}})

        user = session_user(cur, token)
        if not user:
            return fail(401, 'unauthorized')

        if action == 'sync_save':
            return save_state(cur, user['id'], data)

        if action == 'logout':
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token_hash = '{token_hash(token)}'")
            return respond(200, {'ok': True})

        if action == 'logout_all':
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id = {int(user['id'])} AND expires_at > NOW()")
            return respond(200, {'ok': True})

        if action in ('change_password', 'delete_account'):
            cur.execute(f"SELECT password_hash FROM {SCHEMA}.users WHERE id = {int(user['id'])}")
            if not check_password(password, cur.fetchone()[0]):
                return fail(401, 'invalid')
            if action == 'change_password':
                new_pw = str(data.get('newPassword') or '')
                if len(new_pw) < 8 or len(new_pw) > 200:
                    return fail(400, 'weak_password')
                cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = '{esc(hash_password(new_pw))}' WHERE id = {int(user['id'])}")
                cur.execute(
                    f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() "
                    f"WHERE user_id = {int(user['id'])} AND token_hash <> '{token_hash(token)}' AND expires_at > NOW()"
                )
                return respond(200, {'ok': True})
            uid = int(user['id'])
            cur.execute(f"UPDATE {SCHEMA}.user_state SET pet = NULL, achievements = NULL, memory = NULL, rev = rev + 1 WHERE user_id = {uid}")
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id = {uid}")
            cur.execute(
                f"UPDATE {SCHEMA}.users SET email = 'deleted-{uid}-{secrets.token_hex(4)}@deleted.invalid', "
                f"password_hash = 'deleted' WHERE id = {uid}"
            )
            return respond(200, {'ok': True})

        return fail(400, 'bad_request')
    finally:
        conn.close()

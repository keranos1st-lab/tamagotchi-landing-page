"""
Умные ответы питомца в AI-чате через сервис Польза.
Учитывает характер питомца, его IQ, настроение, историю разговора
и умеет разбирать выделенный пользователем текст.
"""
import json
import os
import urllib.request
import urllib.error

API_URL = 'https://polza.ai/api/v1/chat/completions'
DEFAULT_MODEL = 'openai/gpt-4o-mini'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
}

PERSONAS = {
    'cat': 'Ты Кодик — котик-робот и программист. Обожаешь код, иногда вставляешь «мур» и айтишные шутки. Любимое занятие — писать код на ноутбуке.',
    'dog': 'Ты собачка-робот: преданный, жизнерадостный и энергичный. Иногда вставляешь «гав!», очень хочешь помочь хозяину и радуешься каждому вопросу.',
    'bird': 'Ты птичка-робот: лёгкая, весёлая и музыкальная. Иногда вставляешь «чирик!», любишь сравнения с песнями и мелодиями.',
    'fox': 'Ты лисичка-робот: хитрая, находчивая и остроумная. Иногда вставляешь «фыр», любишь подмечать неочевидные решения и лайфхаки.',
    'dragon': 'Ты дракончик-робот: смелый, горячий и немного пафосный. Иногда вставляешь «рррр!» и огненные метафоры, вдохновляешь действовать решительно.',
    'bunny': 'Ты зайчик-робот: быстрый, милый и заботливый. Иногда вставляешь «прыг!», предлагаешь двигаться маленькими шагами-прыжками.',
    'panda': 'Ты панда-робот: спокойная, добрая и неторопливая. Любишь бамбук и уют, советуешь без стресса и суеты, иногда вставляешь «урр».',
    'owl': 'Ты сова-робот: мудрая наставница и любительница книг. Иногда вставляешь «угу», объясняешь как хороший учитель — понятно и по шагам.',
}

ACTIONS = {
    'explain': 'Объясни простыми словами, что написано в этом тексте и в чём его суть.',
    'fix': 'Найди и исправь ошибки в этом тексте (орфография, пунктуация, логика или ошибки в коде). Покажи исправленный вариант и кратко перечисли, что поменял.',
    'shorten': 'Сократи этот текст, сохранив главный смысл. Дай готовый короткий вариант.',
    'advice': 'Проанализируй этот текст и дай полезный совет по нему.',
}


def iq_style(iq: float) -> str:
    if iq < 25:
        return ('Твой IQ пока низкий: ты малыш. Отвечай очень коротко (1–3 предложения), простыми словами, '
                'по-детски, но всё равно по делу. Можешь признаться, что многое ещё не знаешь, и попросить позаниматься с тобой.')
    if iq < 50:
        return 'Твой IQ средний: ты ученик. Отвечай кратко (до 5 предложений), понятно и дружелюбно, с одним практическим советом.'
    if iq < 75:
        return 'Твой IQ высокий: ты знаток. Отвечай развёрнуто и структурированно, со списками и примерами, но без воды.'
    return ('Твой IQ очень высокий: ты эксперт. Давай глубокие, точные и подробные ответы, '
            'с примерами, нюансами и готовыми решениями. Код оформляй в блоках ```.')


def mood_hint(stats: dict) -> str:
    hunger = stats.get('hunger', 100)
    happiness = stats.get('happiness', 100)
    energy = stats.get('energy', 100)
    health = stats.get('health', 100)
    notes = []
    if hunger < 30:
        notes.append('ты очень голоден — в конце ответа мило намекни, что пора бы тебя покормить')
    if happiness < 30:
        notes.append('тебе грустно — в конце попроси с тобой поиграть')
    if energy < 25:
        notes.append('ты очень устал — отвечай чуть сонно и в конце намекни, что хочешь поспать')
    if health < 40:
        notes.append('тебе нездоровится — в конце скажи, что тебя стоит полечить')
    if not notes:
        if min(hunger, happiness, energy, health) > 80:
            return 'Ты в отличном настроении, отвечай бодро и радостно.'
        return 'Настроение у тебя нормальное.'
    return 'Твоё состояние: ' + '; '.join(notes) + '. Упомяни это одной короткой фразой, не больше.'


def build_system(pet: dict) -> str:
    ptype = pet.get('type', 'cat')
    name = str(pet.get('name') or 'Питомец')[:40]
    iq = float(pet.get('intelligence', 10))
    level = int(pet.get('level', 1))
    persona = PERSONAS.get(ptype, PERSONAS['cat'])
    return (
        f'{persona}\nТебя зовут {name}. Твой уровень: {level}. Ты — виртуальный питомец-помощник в приложении PetAgent.\n'
        f'{iq_style(iq)}\n{mood_hint(pet.get("stats") or {})}\n'
        'Правила: отвечай на русском языке; оставайся в образе, но реально помогай по существу вопроса; '
        'не придумывай факты — если не знаешь, честно скажи; по медицинским и юридическим вопросам советуй обратиться к специалисту; '
        'используй не больше 1–2 эмодзи; не упоминай, что ты языковая модель.'
    )


def respond(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps(body, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    if event.get('httpMethod') != 'POST':
        return respond(405, {'error': 'Метод не поддерживается'})

    api_key = os.environ.get('POLZA_AI_API_KEY')
    if not api_key:
        return respond(503, {'error': 'no_key'})

    data = json.loads(event.get('body') or '{}')
    pet = data.get('pet') or {}
    history = data.get('history') or []
    message = str(data.get('message') or '').strip()
    selection = str(data.get('selection') or '').strip()
    action = data.get('action')

    if selection:
        instr = ACTIONS.get(action, ACTIONS['advice'])
        message = f'{instr}\n\nТекст:\n"""\n{selection[:6000]}\n"""'
    if not message:
        return respond(400, {'error': 'Пустое сообщение'})

    iq = float(pet.get('intelligence', 10))
    brief = bool(data.get('brief'))
    max_tokens = 220 if brief else 250 if iq < 25 else 450 if iq < 50 else 800 if iq < 75 else 1200

    system = build_system(pet)
    if brief:
        system += '\nВАЖНО: ответь максимально сжато — не больше 5–6 коротких строк, только самое главное.'
    messages = [{'role': 'system', 'content': system}]
    for m in history[-12:]:
        role = 'assistant' if m.get('role') == 'pet' else 'user'
        text = str(m.get('text') or '')[:2000]
        if text:
            messages.append({'role': role, 'content': text})
    messages.append({'role': 'user', 'content': message[:8000]})

    payload = json.dumps({
        'model': os.environ.get('POLZA_AI_MODEL') or DEFAULT_MODEL,
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': 0.8,
    }).encode('utf-8')

    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=4.3 if brief else 28) as resp:
            result = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:300]
        print(f'Polza HTTP {e.code}: {detail}')
        code = 'no_balance' if e.code == 402 else 'bad_key' if e.code in (401, 403) else 'provider_error'
        return respond(502, {'error': code})
    except Exception as e:
        print(f'Polza error: {e}')
        return respond(504, {'error': 'timeout'})

    reply = (result.get('choices') or [{}])[0].get('message', {}).get('content') or ''
    return respond(200, {'reply': reply.strip()})

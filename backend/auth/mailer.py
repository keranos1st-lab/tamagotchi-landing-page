import os
import smtplib
import ssl
from email.message import EmailMessage

REQUIRED = ('SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM')
TIMEOUT = 10


def is_configured() -> bool:
    return all(os.environ.get(k) for k in REQUIRED)


def send_reset_code(to: str, code: str, minutes: int) -> None:
    host = os.environ['SMTP_HOST']
    port = int(os.environ['SMTP_PORT'])
    msg = EmailMessage()
    msg['Subject'] = 'PetAgent: код для восстановления пароля'
    msg['From'] = os.environ['SMTP_FROM']
    msg['To'] = to
    msg.set_content(
        f'Код для восстановления пароля PetAgent: {code}\n\n'
        f'Код действует {minutes} минут и подходит только один раз.\n'
        'Если вы не запрашивали восстановление, просто проигнорируйте это письмо — пароль не изменится.\n'
    )
    context = ssl.create_default_context()
    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=TIMEOUT, context=context)
    else:
        server = smtplib.SMTP(host, port, timeout=TIMEOUT)
    try:
        if port != 465:
            server.starttls(context=context)
        server.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except smtplib.SMTPException:
            pass

// Used only to reject a legacy server's conversational answer as a note action.
// The server independently parses and authorizes every actual command.
export function isNoteCommand(message: string, name = ''): boolean {
  const names = ['кодик', 'питомец', ...(name && name.length<=80 ? [name] : [])].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const verbs = 'запиши|сохрани|создай|добавь|найди|покажи|прочитай|исправь|измени|обнови|перепиши';
  const prefix = new RegExp(`^(?:эй\\s+)?(?:${names.join('|')})(?:\\s*[,!:]\\s*|\\s+(?=(?:пожалуйста|${verbs})\\s))`, 'i');
  const text = message.trim().replace(prefix, '').replace(/^пожалуйста[,\s]+/i, '');
  return new RegExp(`^(?:${verbs})\\s+(?:мне\\s+)?(?:(?:новую|последнюю)\\s+)?(?:заметку|заметки|идею|запись)(?:\\s|:|$)`, 'i').test(text);
}

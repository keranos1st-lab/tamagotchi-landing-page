import func2url from '../../backend/func2url.json';
import type { PetState } from '@/store/petStore';

export type SelectionAction = 'explain' | 'fix' | 'shorten' | 'advice';

export type AiResult = { ok: true; reply: string } | { ok: false; error: string };

const URL = (func2url as Record<string, string>)['pet-chat'];

type PetCtx = Parameters<typeof request>[0];

export async function askPet(
  pet: PetCtx,
  message: string,
  opts: { selection?: string; action?: SelectionAction } = {},
): Promise<AiResult> {
  const full = await request(pet, message, opts, false);
  if (full.ok || full.error === 'no_key' || full.error === 'no_balance' || full.error === 'bad_key') return full;
  return request(pet, message, opts, true);
}

async function request(
  pet: Pick<PetState, 'name' | 'type' | 'intelligence' | 'level' | 'hunger' | 'happiness' | 'energy' | 'health' | 'chatHistory'>,
  message: string,
  opts: { selection?: string; action?: SelectionAction },
  brief: boolean,
): Promise<AiResult> {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        selection: opts.selection,
        action: opts.action,
        brief,
        history: pet.chatHistory.slice(-13, -1).map((m) => ({ role: m.role, text: m.text })),
        pet: {
          name: pet.name,
          type: pet.type,
          intelligence: pet.intelligence,
          level: pet.level,
          stats: { hunger: pet.hunger, happiness: pet.happiness, energy: pet.energy, health: pet.health },
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.reply) return { ok: true, reply: data.reply };
    return { ok: false, error: data.error || 'provider_error' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

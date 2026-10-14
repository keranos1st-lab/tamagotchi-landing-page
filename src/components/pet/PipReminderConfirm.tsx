import { useEffect, useState } from 'react';
import { usePetStore } from '@/store/petStore';
import { ReminderProposalCard } from './chat/ReminderProposalCard';

const DONE_MS = 4000;
const FRESH_MS = 30 * 60 * 1000;

export function PipReminderConfirm() {
  const msgs = usePetStore((s) => s.chatHistory);
  const [shownId, setShownId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);

  const pending = [...msgs].reverse().find((m) => m.reminderProposal && (m.reminderProposal.state ?? 'pending') === 'pending' && Date.now() - m.timestamp < FRESH_MS);
  const current = pending ?? msgs.find((m) => m.id === shownId && m.reminderProposal);

  useEffect(() => {
    if (pending && pending.id !== shownId) setShownId(pending.id);
  }, [pending, shownId]);

  const finished = !pending && current?.reminderProposal?.state === 'saved' ? current.id : null;
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => setHidden(finished), DONE_MS);
    return () => clearTimeout(t);
  }, [finished]);

  if (!current?.reminderProposal || current.id === hidden) return null;
  if (!pending && current.reminderProposal.state !== 'saved') return null;

  return (
    <div className="absolute inset-x-2 bottom-2 z-10 max-h-[60%] overflow-y-auto" data-testid="pip-reminder">
      <div className="rounded-xl bg-[#12102b]/95 p-1.5 shadow-xl backdrop-blur">
        <ReminderProposalCard key={current.id} msgId={current.id} proposal={current.reminderProposal} compact />
      </div>
    </div>
  );
}

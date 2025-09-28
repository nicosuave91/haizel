import { Participant } from "../mocks/data";
import { Phone, Mail, Calendar, ClipboardList } from "lucide-react";

interface ParticipantPanelProps {
  participant?: Participant;
}

export const ParticipantPanel = ({ participant }: ParticipantPanelProps) => {
  if (!participant) {
    return (
      <aside className="hidden w-72 flex-col border-l bg-[var(--hz-surface-card)] p-4 text-sm text-hz-text-sub lg:flex">
        Select a conversation to view participant details.
      </aside>
    );
  }

  return (
    <aside className="hidden w-72 flex-col gap-4 border-l bg-[var(--hz-surface-card)] p-4 text-sm lg:flex">
      <div>
        <p className="text-sm font-semibold">{participant.name}</p>
        <p className="text-xs text-hz-text-sub">{participant.role}</p>
      </div>
      <div className="space-y-2 text-xs text-hz-text-sub">
        <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {participant.phone}</p>
        <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {participant.email}</p>
      </div>
      <div className="space-y-2">
        <button className="flex w-full items-center gap-2 rounded-hz-md border px-3 py-2 text-xs">
          <Calendar className="h-4 w-4" /> Schedule call
        </button>
        <button className="flex w-full items-center gap-2 rounded-hz-md border px-3 py-2 text-xs">
          <ClipboardList className="h-4 w-4" /> Request docs
        </button>
      </div>
      <div className="rounded-hz-md bg-hz-neutral-100 p-3 text-xs text-hz-text-sub">
        <p className="font-semibold text-[var(--hz-text)]">Quiet hours</p>
        <p>9p – 8a local time. Urgent alerts will override.</p>
      </div>
    </aside>
  );
};

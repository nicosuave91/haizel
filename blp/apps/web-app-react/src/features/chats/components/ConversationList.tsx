import { Conversation } from "../mocks/data";
import { Badge } from "@/components/ui/Badge";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelect: (id: string) => void;
}

export const ConversationList = ({ conversations, activeConversationId, onSelect }: ConversationListProps) => {
  return (
    <aside className="w-full max-w-xs border-r bg-[var(--hz-surface-card)]">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">Conversations</h2>
        <p className="text-xs text-hz-text-sub">Search and prioritize.</p>
      </div>
      <ul className="divide-y">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition ${
                conversation.id === activeConversationId ? "bg-hz-neutral-100" : "hover:bg-hz-neutral-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{conversation.title}</p>
                {conversation.unread > 0 && <Badge tone="primary">{conversation.unread}</Badge>}
              </div>
              <div className="flex items-center gap-2 text-xs text-hz-text-sub">
                <span>{conversation.channel}</span>
                <span>Loan {conversation.loanId}</span>
                {conversation.priority === "high" && <span className="text-hz-danger">High priority</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

import { useMemo, useState } from "react";
import { ConversationList } from "./components/ConversationList";
import { MessageThread } from "./components/MessageThread";
import { Composer } from "./components/Composer";
import { ParticipantPanel } from "./components/ParticipantPanel";
import { conversations as initialConversations, messages as initialMessages, participants } from "./mocks/data";
import type { Conversation, Message } from "./mocks/data";

export const ChatsPage = () => {
  const [conversationId, setConversationId] = useState(initialConversations[0]?.id ?? "");
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  const thread = useMemo(
    () => messages.filter((message) => message.conversationId === conversationId),
    [conversationId, messages]
  );

  const handleSend = (body: string) => {
    if (!conversationId) return;
    const newMessage: Message = {
      id: crypto.randomUUID(),
      conversationId,
      author: "You",
      body,
      direction: "outbound",
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, newMessage]);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unread: 0 } : conversation
      )
    );
  };

  return (
    <div className="flex h-full min-h-[720px] overflow-hidden rounded-hz-xl bg-[var(--hz-surface-card)] shadow-hz-sm">
      <ConversationList
        conversations={conversations}
        activeConversationId={conversationId}
        onSelect={setConversationId}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {conversationId ? (
          <>
            <MessageThread messages={thread} />
            <Composer onSend={handleSend} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-hz-text-sub">
            Select a conversation to begin.
          </div>
        )}
      </div>
      <ParticipantPanel participant={participants[conversationId]} />
    </div>
  );
};

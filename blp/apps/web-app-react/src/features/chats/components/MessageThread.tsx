import { Message } from "../mocks/data";
import { format } from "date-fns";

interface MessageThreadProps {
  messages: Message[];
}

export const MessageThread = ({ messages }: MessageThreadProps) => {
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--hz-surface-muted)] p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-hz-xl px-4 py-3 text-sm shadow-hz-sm ${
                message.direction === "outbound"
                  ? "bg-hz-primary text-white"
                  : "bg-[var(--hz-surface-card)] text-[var(--hz-text)]"
              }`}
            >
              <p className="mb-1 text-xs uppercase tracking-wide text-hz-neutral-500">{message.author}</p>
              <p>{message.body}</p>
              <p className="mt-2 text-xs text-hz-text-sub">
                {format(new Date(message.timestamp), "MMM d, h:mma")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

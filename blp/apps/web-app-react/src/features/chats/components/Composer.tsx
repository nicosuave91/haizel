import { FormEvent, useState } from "react";
import { Paperclip, Send, Smile } from "lucide-react";

interface ComposerProps {
  onSend: (message: string) => void;
}

export const Composer = ({ onSend }: ComposerProps) => {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-[var(--hz-surface-card)] p-4">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-hz-xl border bg-hz-neutral-100 px-3">
        <button type="button" className="text-hz-text-sub" aria-label="Attach file">
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a message, use @mentions, or insert a template"
          className="flex-1 bg-transparent py-3 text-sm outline-none"
        />
        <button type="button" className="text-hz-text-sub" aria-label="Emoji picker">
          <Smile className="h-5 w-5" />
        </button>
        <button
          type="submit"
          className="rounded-hz-md bg-hz-primary px-4 py-2 text-sm font-semibold text-white shadow-hz-sm"
        >
          <Send className="mr-1 inline h-4 w-4" /> Send
        </button>
      </div>
    </form>
  );
};

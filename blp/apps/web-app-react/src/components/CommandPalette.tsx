import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const commands = [
  { label: "Dashboard", href: "/" },
  { label: "Pipeline", href: "/pipeline" },
  { label: "Chats", href: "/chats" }
];

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed inset-0 flex items-start justify-center pt-24">
          <Command
            value={search}
            onValueChange={setSearch}
            className="w-full max-w-xl overflow-hidden rounded-hz-xl bg-[var(--hz-surface-card)] shadow-hz-lg"
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 text-hz-text-sub" />
              <Command.Input
                placeholder="Jump to a loan, person, or action"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-hz-text-sub"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto">
              <Command.Empty className="p-4 text-sm text-hz-text-sub">
                Nothing found. Try a different keyword.
              </Command.Empty>
              <Command.Group heading="Navigate" className="p-2 text-xs uppercase tracking-wide text-hz-text-sub">
                {commands
                  .filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
                  .map((item) => (
                    <Command.Item
                      key={item.href}
                      onSelect={() => {
                        navigate({ to: item.href as "/" | "/pipeline" | "/chats" });
                        onOpenChange(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--hz-text)]",
                        "data-[selected='true']:bg-hz-neutral-100 dark:data-[selected='true']:bg-hz-neutral-300/20"
                      )}
                    >
                      {item.label}
                    </Command.Item>
                  ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

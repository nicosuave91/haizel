import { PropsWithChildren, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Command as CommandIcon,
  Home,
  ListChecks,
  MessageCircle,
  Moon,
  Search,
  Sun
} from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useThemeStore } from "@/stores/ui.theme";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Pipeline", href: "/pipeline", icon: ListChecks },
  { label: "Chats", href: "/chats", icon: MessageCircle }
];

export const AppShell = ({ children }: PropsWithChildren) => {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const route = useRouterState({ select: (state) => state.location.pathname });

  useHotkeys([
    {
      key: "/",
      handler: () => searchRef.current?.focus()
    },
    {
      key: "k",
      meta: true,
      handler: () => setPaletteOpen(true)
    },
    {
      key: "n",
      handler: () => console.info("Shortcut: New loan creation coming soon"),
      shift: false
    }
  ]);

  return (
    <div className="flex min-h-screen bg-[var(--hz-surface-muted)] text-[var(--hz-text)]">
      <aside
        className={cn(
          "flex h-screen flex-col border-r bg-[var(--hz-surface-card)] shadow-hz-sm transition-all",
          navCollapsed ? "w-20" : "w-72"
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <Link to="/" className="text-lg font-semibold">
            {navCollapsed ? "HZ" : "Haizel"}
          </Link>
          <button
            type="button"
            onClick={() => setNavCollapsed((prev) => !prev)}
            className="rounded-full border bg-[var(--hz-surface-muted)] p-1 text-hz-text-sub"
            aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {navCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = route === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href as "/" | "/pipeline" | "/chats"}
                className={cn(
                  "flex items-center gap-3 rounded-hz-md px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-hz-primary text-white shadow-hz-md"
                    : "text-hz-text-sub hover:bg-hz-neutral-100 dark:hover:bg-hz-neutral-300/10"
                )}
              >
                <Icon className="h-4 w-4" />
                {!navCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4 text-xs text-hz-text-sub">
          {!navCollapsed && (
            <p>
              Action: Upload income docs to unlock underwriting.
              <br />
              Assist: We’ll highlight exactly what’s missing.
            </p>
          )}
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-[var(--hz-surface-card)] px-6 py-4 shadow-hz-sm">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hz-text-sub" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Search loans, people, and tasks"
                className="w-full rounded-hz-md bg-hz-neutral-100 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-hz-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-hz-md border px-3 py-2 text-sm text-hz-text-sub transition hover:bg-hz-neutral-100 dark:hover:bg-hz-neutral-300/10 md:flex"
            >
              <CommandIcon className="h-4 w-4" />
              <span>Command</span>
              <kbd className="rounded border bg-hz-neutral-100 px-1 text-xs">⌘K</kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full border bg-[var(--hz-surface-muted)] p-2 text-hz-text-sub"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border bg-[var(--hz-surface-muted)] p-2 text-hz-text-sub"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 rounded-hz-md border px-3 py-2">
              <span className="text-sm font-medium">Jamie Rivera</span>
              <span className="text-xs text-hz-text-sub">LO</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-[var(--hz-surface-muted)] p-6">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
};

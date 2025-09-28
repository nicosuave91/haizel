import { useEffect } from "react";

type Handler = (event: KeyboardEvent) => void;

interface Hotkey {
  key: string;
  handler: Handler;
  meta?: boolean;
  shift?: boolean;
}

export const useHotkeys = (hotkeys: Hotkey[]) => {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      hotkeys.forEach((hotkey) => {
        const matchesKey = event.key.toLowerCase() === hotkey.key.toLowerCase();
        const matchesMeta = !!hotkey.meta === (event.metaKey || event.ctrlKey);
        const matchesShift = !!hotkey.shift === event.shiftKey;
        if (matchesKey && matchesMeta && matchesShift) {
          event.preventDefault();
          hotkey.handler(event);
        }
      });
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [hotkeys]);
};

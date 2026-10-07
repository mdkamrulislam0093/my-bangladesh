import { useEffect, useRef } from "react";

/*
 * Overlays (district sheet, guided questions, share sheet) each own one history entry,
 * so the phone's back button closes the top-most overlay instead of leaving the page.
 * One global listener: pops we cause ourselves (closing via a button) are skipped.
 */
const stack: { close: () => void }[] = [];
let ownPops = 0;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (ownPops > 0) {
      ownPops--;
      return;
    }
    const top = stack.pop();
    top?.close();
  });
}

export function useOverlayHistory(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const entry = { close: () => closeRef.current() };
    stack.push(entry);
    history.pushState({ overlay: true }, "");
    return () => {
      const i = stack.indexOf(entry);
      // Still on the stack = closed by the app, not by Back: remove our history entry too.
      if (i !== -1) {
        stack.splice(i, 1);
        ownPops++;
        history.back();
      }
    };
  }, [open]);
}

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

/**
 * Makes the Android hardware back button (and the WebView's own back
 * history generally) follow standard navigation conventions: step back one
 * screen at a time, only exiting the app once there is nowhere left to go
 * back to. See mobile/android/.../MainActivity.java's onBackPressed
 * override, which asks the WebView to go back through its real history
 * before ever falling through to the system default (exit).
 *
 * Every state transition that should be one "back" step -- an App.tsx tab
 * switch or route push, a LessonsScreen level/module drill-down -- calls
 * pushFrame(onPop) with a closure that restores the state being left,
 * then performs the transition. onPop is called only when the user
 * actually navigates back to that point (hardware back, or an in-app back
 * control calling goBack()), via the same window.history.back() call
 * either way -- so there is exactly one code path, never two notions of
 * "how far back are we" that could drift out of sync with each other.
 */
type HistoryContextValue = {
  pushFrame: (onPop: () => void) => void;
  goBack: () => void;
};

const HistoryContext = createContext<HistoryContextValue | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    function onPopState() {
      const handler = handlersRef.current.pop();
      if (handler) handler();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const value: HistoryContextValue = {
    pushFrame(onPop) {
      handlersRef.current.push(onPop);
      window.history.pushState(null, "", "");
    },
    goBack() {
      window.history.back();
    },
  };

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useHistoryStack(): HistoryContextValue {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistoryStack must be used within <HistoryProvider>");
  return ctx;
}

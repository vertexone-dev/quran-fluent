import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    // `active` guards both callbacks below against updating this effect
    // instance's state after it's no longer the current one -- React 18+
    // Strict Mode deliberately mounts every effect, cleans it up, then
    // mounts it again in development, and supabase.auth.getSession()'s
    // promise (and, in principle, an onAuthStateChange event) can resolve
    // for the *first* (already-cleaned-up) instance after the *second*
    // one has already taken over. Without this guard, that stale
    // resolution still landed on the same component's setState calls --
    // "Can't perform a React state update on a component that hasn't
    // mounted yet" is React's own warning for exactly that scenario, and
    // in the worst case it can also let a stale/slower resolution clobber
    // a newer one with outdated session data. Setting `active = false` in
    // the cleanup function (which always runs before a new effect
    // instance's body, and always runs on real unmount too) makes both
    // callbacks below no-ops once they're no longer wanted -- the
    // subscription itself is still unsubscribed exactly as before.
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [router, queryClient]);

  const value = useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    return { user: error ? null : data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  // beforeLoad used to `throw redirect()` here, which swapped the matched
  // route straight to /auth while this ssr:false route's ClientOnly
  // fallback-to-content handoff was still completing -- React ended up
  // hydrating /auth's real markup against this route's empty SSR
  // placeholder, logging a hydration mismatch on every unauthenticated
  // visit to a protected route. Redirecting from an effect instead
  // guarantees the navigation only fires after this component's own
  // hydration has fully committed (the same pattern AuthPage already uses
  // for its own already-logged-in redirect).
  useEffect(() => {
    if (!user) navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <Outlet />
    </div>
  );
}

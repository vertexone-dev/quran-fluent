import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — QuranRoots" },
      { name: "description", content: "Set a new password for your QuranRoots account." },
      { property: "og:title", content: "Choose a new password — QuranRoots" },
      { property: "og:description", content: "Set a new password for your QuranRoots account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { t, d } = useI18n();
  const a = d.auth;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(a.reset.success);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="surface-hero flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8" aria-label={t("common.brand.homeAria")}>
        <Logo />
      </Link>
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader>
          <CardTitle className="font-display text-2xl" asChild>
            <h1>{a.reset.title}</h1>
          </CardTitle>
          <CardDescription>{a.reset.desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">{a.fields.newPassword}</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? t("common.actions.pleaseWait") : a.reset.cta}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

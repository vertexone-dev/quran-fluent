import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/**
 * Client-side validation. Supabase enforces its own rules server-side; these
 * messages exist so learners get a clear, localized reason before the request
 * is even sent.
 */
const emailSchema = z.string().trim().min(1).email().max(255);
const passwordSchema = z.string().min(8).max(72);
const nameSchema = z.string().trim().min(1).max(80);

const searchSchema = z.object({
  mode: z.enum(["login", "signup", "forgot"]).catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — QuranRoots" },
      {
        name: "description",
        content: "Create your QuranRoots account and start learning Qur'anic Arabic today.",
      },
      { property: "og:title", content: "Sign in — QuranRoots" },
      {
        property: "og:description",
        content: "Create your QuranRoots account and start learning Qur'anic Arabic today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, d } = useI18n();
  const a = d.auth;
  const copy = a[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState<null | "confirm" | "reset">(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string; firstName?: string }>(
    {},
  );

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  async function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (busy) return;

    const nextErrors: { email?: string; password?: string; firstName?: string } = {};
    if (!emailSchema.safeParse(email).success) nextErrors.email = a.validation.email;
    if (mode !== "forgot" && !passwordSchema.safeParse(password).success) {
      nextErrors.password = a.validation.password;
    }
    if (mode === "signup" && !nameSchema.safeParse(firstName).success) {
      nextErrors.firstName = a.validation.firstName;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { first_name: firstName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setEmailSent("confirm");
          return;
        }
        navigate({ to: "/onboarding" });
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setEmailSent("reset");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Native Supabase OAuth. Not wired to any button yet — the Google
  // provider isn't enabled on the Supabase project (see project audit),
  // so this is kept implemented-but-unused rather than shipping a
  // clickable button that redirects into a provider error. Wire it back
  // in once the provider is enabled in Supabase's Auth settings.
  async function signInWithGoogle() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setBusy(false);
      toast.error(a.googleError);
    }
  }

  return (
    <div className="surface-hero flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8" aria-label="QuranRoots home">
        <Logo tagline />
      </Link>

      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader>
          <CardTitle className="font-display text-2xl" asChild>
            <h1>{copy.title}</h1>
          </CardTitle>
          <CardDescription>{copy.desc}</CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4 text-sm">
              <p className="text-foreground">
                {emailSent === "confirm" ? a.confirmSent : a.resetSent}
              </p>
              <Button variant="secondary" className="w-full" onClick={() => setEmailSent(null)}>
                {t("common.actions.back")}
              </Button>
            </div>
          ) : (
            <>
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{a.fields.firstName}</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      maxLength={80}
                      aria-invalid={Boolean(errors.firstName)}
                      aria-describedby={errors.firstName ? "firstName-error" : undefined}
                      required
                    />
                    {errors.firstName && (
                      <p id="firstName-error" role="alert" className="text-sm text-destructive">
                        {errors.firstName}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">{a.fields.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    maxLength={255}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    required
                  />
                  {errors.email && (
                    <p id="email-error" role="alert" className="text-sm text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label htmlFor="password">{a.fields.password}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      minLength={8}
                      maxLength={72}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby="password-hint"
                      required
                    />
                    <p
                      id="password-hint"
                      className={
                        errors.password
                          ? "text-sm text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                      role={errors.password ? "alert" : undefined}
                    >
                      {errors.password ?? a.validation.passwordHint}
                    </p>
                  </div>
                )}
                {/* type="button", not "submit": before React hydrates and
                    attaches the form's onSubmit, a type="submit" button
                    falls through to the browser's native GET-to-self form
                    submission, which strips the mode search param entirely
                    and lands on validateSearch's "login" fallback — losing
                    signup/forgot context on any click that lands in that
                    window. onClick calls the same handler directly, so a
                    pre-hydration click is simply inert instead of
                    triggering a stray navigation; Enter-key submission
                    still works via the form's onSubmit once hydrated. */}
                <Button type="button" className="w-full" disabled={busy} onClick={handleSubmit}>
                  {busy ? t("common.actions.pleaseWait") : copy.cta}
                </Button>
              </form>

              {/* Google sign-in is hidden until the Google provider is
                  enabled in Supabase's Auth settings — see
                  signInWithGoogle() above. No "or" divider either, since
                  it has nothing to separate the password form from right
                  now. */}

              <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
                {mode === "login" && (
                  <>
                    <p>
                      <Link
                        to="/auth"
                        search={{ mode: "forgot" }}
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        {a.forgotLink}
                      </Link>
                    </p>
                    <p>
                      {a.newHere}{" "}
                      <Link
                        to="/auth"
                        search={{ mode: "signup" }}
                        className="font-medium text-primary underline underline-offset-4"
                      >
                        {a.createAccount}
                      </Link>
                    </p>
                  </>
                )}
                {mode !== "login" && (
                  <p>
                    {a.haveAccount}{" "}
                    <Link
                      to="/auth"
                      search={{ mode: "login" }}
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      {a.login.cta}
                    </Link>
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

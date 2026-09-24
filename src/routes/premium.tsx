import { createFileRoute } from "@tanstack/react-router";
import { Check, Globe, Info, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/lib/use-document-title";
import { isBillingCheckoutEnabled } from "@/lib/billing/checkoutFlag";
import { billingFetch } from "@/lib/billing/fetchClient";
import { type BillingPlan } from "@/lib/billing/prices";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Premium — QuranRoots" },
      {
        name: "description",
        content:
          "QuranRoots Premium unlocks Levels 3-6 of the learning path, advanced practice and review. The Qur'an Reader is always free.",
      },
      { property: "og:title", content: "Premium — QuranRoots" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Premium,
});

function Premium() {
  const { d } = useI18n();
  const p = d.billing.pricing;
  useDocumentTitle(`${p.documentTitle} — QuranRoots`);

  const checkoutEnabled = isBillingCheckoutEnabled();
  // Which plan's Checkout Session request is in flight, if any -- disables
  // BOTH buttons while set (not just the clicked one), so a second click on
  // either button can never start a second Checkout Session for the same
  // user while the first request is still pending.
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);

  async function startCheckout(plan: BillingPlan) {
    if (!checkoutEnabled || pendingPlan) return;
    setPendingPlan(plan);
    try {
      // Only ever sends { plan: "monthly" | "annual" } -- never a Stripe
      // price id, customer id, or any other client-controlled value; the
      // server resolves the real Price id itself (src/lib/billing/prices.ts).
      const response = await billingFetch("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });

      if (response.status === 401) {
        toast.error(p.checkoutSignInRequired);
        setPendingPlan(null);
        return;
      }
      if (!response.ok) {
        // Never surfaces the response body (could be a generic server
        // message, but never assume it's safe to show verbatim) -- always
        // this one localized, static string.
        toast.error(p.checkoutError);
        setPendingPlan(null);
        return;
      }

      const body = (await response.json()) as { url?: string };
      if (!body.url) {
        toast.error(p.checkoutError);
        setPendingPlan(null);
        return;
      }

      // Navigation to Stripe's hosted Checkout is already underway --
      // deliberately leave pendingPlan set (buttons stay disabled) rather
      // than resetting it, which would flash them back to clickable for the
      // instant before the browser actually leaves this page.
      window.location.href = body.url;
    } catch (error) {
      // billingFetch throws synchronously (not a rejected response) only
      // when there is no active session at all -- distinguish that from
      // every other failure (network error, offline, DNS, aborted
      // request): those get the generic checkout-error message, never the
      // sign-in one, and never a raw error message or stack trace either
      // way.
      const noSession =
        error instanceof Error && error.message === "billingFetch called with no active session.";
      toast.error(noSession ? p.checkoutSignInRequired : p.checkoutError);
      setPendingPlan(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{p.title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{p.intro}</p>

        <Card className="mt-8 border-amber-300/60 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40">
          <CardContent className="flex items-start gap-3 pt-6">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {p.preparingNotice.title}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                {p.preparingNotice.body}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{p.free.title}</span>
              </CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{p.free.price}</span>
                <span className="text-sm text-muted-foreground">{p.free.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{p.free.description}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {p.free.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" className="mt-6 w-full" disabled>
                {p.free.cta}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{p.premium.title}</span>
                <Badge>{p.premium.trialNotice}</Badge>
              </CardTitle>
              <div className="space-y-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{p.premium.monthlyPrice}</span>
                  <span className="text-sm text-muted-foreground">{p.premium.monthlyPeriod}</span>
                  <span className="text-xs text-muted-foreground">({p.premium.billedMonthly})</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold">{p.premium.annualPrice}</span>
                  <span className="text-sm text-muted-foreground">{p.premium.annualPeriod}</span>
                  <span className="text-xs text-muted-foreground">
                    ({p.premium.billedAnnually})
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{p.premium.description}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {p.premium.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 grid gap-2">
                <Button
                  className="w-full"
                  disabled={!checkoutEnabled || pendingPlan !== null}
                  onClick={() => void startCheckout("monthly")}
                >
                  {p.premium.monthlyCta}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!checkoutEnabled || pendingPlan !== null}
                  onClick={() => void startCheckout("annual")}
                >
                  {p.premium.annualCta}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">{p.levelsNote}</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="flex gap-3">
            <Globe className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">{p.localCurrency.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.localCurrency.body}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">{p.secureBilling.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.secureBilling.body}</p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="font-display text-xl font-semibold">{p.faq.title}</h2>
          <dl className="mt-4 space-y-6">
            {[p.faq.quranNeverPaywalled, p.faq.trial, p.faq.refund].map((item) => (
              <div key={item.question}>
                <dt className="font-medium">{item.question}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

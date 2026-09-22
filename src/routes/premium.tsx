import { createFileRoute } from "@tanstack/react-router";
import { Check, Globe, Info, ShieldCheck } from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/lib/use-document-title";
import { isBillingCheckoutEnabled } from "@/lib/billing/checkoutFlag";

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
                <Button className="w-full" disabled={!checkoutEnabled}>
                  {p.premium.monthlyCta}
                </Button>
                <Button variant="outline" className="w-full" disabled={!checkoutEnabled}>
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

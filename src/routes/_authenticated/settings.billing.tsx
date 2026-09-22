import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/lib/use-document-title";
import { billingFetch } from "@/lib/billing/fetchClient";
import { isBillingCheckoutEnabled } from "@/lib/billing/checkoutFlag";
import { isBillingStatus, type BillingStatus } from "@/lib/billing/entitlement";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  head: () => ({
    meta: [
      { title: "Billing — QuranRoots" },
      { name: "description", content: "Manage your QuranRoots subscription." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsBilling,
});

type BillingStatusResponse =
  | { hasSubscription: false; isPremium: false; enforcementEnabled: boolean }
  | {
      hasSubscription: true;
      status: BillingStatus;
      priceId: string;
      currentPeriodEnd: string | null;
      trialEnd: string | null;
      cancelAtPeriodEnd: boolean;
      isPremium: boolean;
      enforcementEnabled: boolean;
    };

function SettingsBilling() {
  const { user } = useAuth();
  const { t, d, locale } = useI18n();
  const s = d.billing.settings;
  useDocumentTitle(`${s.documentTitle} — QuranRoots`);

  const checkoutEnabled = isBillingCheckoutEnabled();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["billing-status", user?.id],
    queryFn: async (): Promise<BillingStatusResponse> => {
      const response = await billingFetch("/api/billing/status");
      if (!response.ok) throw new Error(`Billing status request failed: ${response.status}`);
      return (await response.json()) as BillingStatusResponse;
    },
    enabled: Boolean(user?.id),
    retry: 1,
    refetchOnReconnect: false,
  });

  async function openPortal() {
    if (!checkoutEnabled) return;
    const response = await billingFetch("/api/billing/portal", { method: "POST" });
    if (!response.ok) return;
    const body = (await response.json()) as { url?: string };
    if (body.url) window.location.href = body.url;
  }

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Card className="shadow-soft">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-muted-foreground">{s.error.title}</p>
            <Button variant="secondary" onClick={() => void refetch()}>
              {s.error.retry}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{s.title}</h1>
      <p className="mt-2 text-muted-foreground">{s.intro}</p>

      <Card className="mt-6 border-amber-300/60 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40">
        <CardContent className="flex items-start gap-3 py-4">
          <Info
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden="true"
          />
          <p className="text-sm text-amber-800 dark:text-amber-300">{s.preparingNotice}</p>
        </CardContent>
      </Card>

      <div className="mt-6">
        {!data?.hasSubscription ? (
          <Card className="shadow-soft">
            <CardContent className="space-y-3 py-8 text-center">
              <p className="font-semibold">{s.noSubscription.title}</p>
              <p className="text-sm text-muted-foreground">{s.noSubscription.body}</p>
              <Button asChild>
                <Link to="/premium">{s.noSubscription.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{s.currentPlan.title}</span>
                {isBillingStatus(data.status) && (
                  <Badge variant={data.isPremium ? "default" : "secondary"}>
                    {s.status[data.status]}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.trialEnd && (
                <p className="text-sm text-muted-foreground">
                  {t("billing.settings.currentPlan.trialEndsOn", {
                    date: formatDate(data.trialEnd),
                  })}
                </p>
              )}
              {data.cancelAtPeriodEnd && data.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  {t("billing.settings.currentPlan.cancelsOn", {
                    date: formatDate(data.currentPeriodEnd),
                  })}
                </p>
              )}
              {!data.cancelAtPeriodEnd && data.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  {t("billing.settings.currentPlan.renewsOn", {
                    date: formatDate(data.currentPeriodEnd),
                  })}
                </p>
              )}
              <Button onClick={() => void openPortal()} disabled={!checkoutEnabled}>
                {s.currentPlan.manageCta}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

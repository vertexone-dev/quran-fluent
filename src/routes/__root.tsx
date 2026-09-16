import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Compass } from "lucide-react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/lib/use-document-title";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

// Both render inside <I18nProvider> (it wraps <Outlet/>, and TanStack
// Router's notFound/error boundaries for a route render within that
// route's own subtree) -- and even in the one path where a provider
// truly isn't mounted (e.g. RootComponent itself failing before rendering
// its children), useI18n()'s context default is FALLBACK_STATE, which
// degrades to plain English rather than throwing (see src/lib/i18n.tsx).
// So these two use the same translated copy as everything else with no
// extra fallback handling needed here.
function NotFoundComponent() {
  const { t } = useI18n();
  useDocumentTitle(`${t("common.errors.notFoundTitle")} — QuranRoots`);
  return (
    <div className="flex min-h-screen flex-col">
      {/* Real site branding/header on the 404 page, same as every other
          public route -- this is purely presentational (SiteHeader renders
          inside the same providers RootComponent already mounts) and has
          no effect on the real HTTP 404 status this page is served with. */}
      <SiteHeader />
      <div className="flex flex-1 items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Compass className="size-6" aria-hidden />
          </div>
          <h1 className="mt-6 text-7xl font-bold text-foreground">404</h1>
          <h2 className="mt-4 text-xl font-semibold text-foreground">
            {t("common.errors.notFoundTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("common.errors.notFoundBody")}</p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("common.errors.goHome")}
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("common.errors.crashTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("common.errors.crashBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.errors.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("common.errors.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "QuranRoots — Learn Arabic. Understand the Qur'an." },
      {
        name: "description",
        content: "Build your Qur'anic Arabic skills one word, one verse, and one lesson at a time.",
      },
      { name: "author", content: "QuranRoots" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Cairo:wght@500;600;700;800&family=Open+Sans:wght@300;400;500;600;700&family=Amiri:wght@400;700&family=Amiri+Quran&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <I18nProvider>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
            <Toaster position="top-center" />
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

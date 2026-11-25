import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";
import { currentNonce } from "./lib/request-nonce.server";

// On the server the Worker (src/server.ts) scopes this request's CSP nonce
// with runWithNonce(). In the browser TanStack reads it back from
// <meta property="csp-nonce"> (rendered by the root shell), so nothing is
// needed here.
const serverNonce = createIsomorphicFn()
  .server((): string | undefined => currentNonce())
  .client((): string | undefined => undefined);

export const getRouter = () => {
  const queryClient = new QueryClient();

  const nonce = serverNonce();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};

// Per-request CSP nonce, carried from the Worker entry (src/server.ts) to the
// router factory (src/router.tsx) without a module-level variable: the Worker
// serves overlapping requests, so shared mutable state would hand one
// request another's nonce. AsyncLocalStorage (workerd, nodejs_compat) scopes
// the value to the request's async chain.
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<string>();

export function runWithNonce<T>(nonce: string, fn: () => T): T {
  return storage.run(nonce, fn);
}

export function currentNonce(): string | undefined {
  return storage.getStore();
}

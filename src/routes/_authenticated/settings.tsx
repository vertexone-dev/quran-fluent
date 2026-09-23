import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout route for /settings and its children (currently /settings/billing).
 *
 * ROOT CAUSE OF THE PRODUCTION BUG THIS FIXES: this file used to declare
 * `createFileRoute("/_authenticated/settings")` with a `component` that
 * rendered the entire general-settings page directly, no `<Outlet />`
 * anywhere. Once `settings.billing.tsx` was added, TanStack Router's file
 * generator correctly wired it as this route's *child*
 * (`getParentRoute: () => AuthenticatedSettingsRoute`,
 * `_addFileChildren(...)` -- see src/routeTree.gen.ts) -- but a parent
 * route's own component is what actually renders visually; children only
 * ever appear where that parent explicitly renders `<Outlet />`. Route
 * `head()` metadata resolves per matched route independent of this, which
 * is exactly why production showed the *child's* title
 * ("Billing — QuranRoots") while rendering only the *parent's* content
 * (Profile/Learning/Appearance/Account) at /settings/billing -- the child
 * component had nowhere to mount.
 *
 * Fix: this file is now a pure layout -- the original general-settings
 * page moved unchanged to settings.index.tsx (the "/settings/" index
 * child), so `/settings` renders it via this Outlet exactly as before,
 * and `/settings/billing` renders SettingsBilling via the same Outlet
 * instead of never mounting at all.
 */
export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return <Outlet />;
}

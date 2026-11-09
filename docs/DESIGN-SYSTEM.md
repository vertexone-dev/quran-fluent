# QuranRoots design system (Milestones B + C)

This describes the cinematic layer that sits on top of shadcn/Radix (`src/components/ui/`) and the tokens in `src/styles.css`. Extend these pieces rather than copying class strings into pages.

## Tokens (`src/styles.css`)

| Token / utility | Use |
|---|---|
| `--font-display` (Cormorant Garamond), `--font-sans` (Nunito Sans), `--font-arabic-ui` (Tajawal), `--font-quran` (Amiri Quran), `.text-quran` | Typography. Quran text always uses `.text-quran` and is rendered exactly as stored. |
| Midnight Teal `oklch(0.2 0.035 195.1)` / `oklch(0.324 0.046 195.1)`, Antique Gold `oklch(0.767 0.139 91.1)` (`GOLD`), Ivory `oklch(0.97 0.012 85)` | The fixed cinematic palette. These surfaces stay dark in both themes. |
| `nav-glass`, `nav-glass-dense`, `nav-pill-*` | Glass bars: header, Reader toolbar, mini-player. |
| `surface-hero-cinematic`, `hero-grain`, `cta-ring-spin`, `hero-flicker` | Homepage hero only. |
| `.verse-frame` | Gold corner ornaments for `VerseFrame`. CSS only, and they mirror under RTL. |
| Global `prefers-reduced-motion` rule | Removes the animation from every transition and keyframe. |

Breakpoints are the Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. The floating nav shows from `xl` up; below `xl` the bottom tab bar is used instead. Tested widths: 390, 768 and 1440.

## Components (`src/design/`)

| Component | Since | Notes |
|---|---|---|
| `GlassPanel`, `SectionHeading`, `ContentState` | B (`offline` kind added in C) | `ContentState kind="loading\|error\|empty\|unavailable\|offline"` is the single honest state for missing content. Never use placeholder text. |
| `AuthShell`, `artwork.ts` | B | All artwork goes through `ACTIVE_ART`. |
| `CinematicButton` / `cinematicButtonVariants` | C | Variants: `gold`, `ghost`, `quiet`, `icon`. Sizes: `sm`, `md`, `lg`, `icon`. Supports `asChild` for links. 44 px touch target and gold focus ring. Directional icons take `className="dir-icon"` so they flip under RTL. |
| `VerseFrame` | C | The gold-edged āyah container (`label`, `highlighted`, `selected`, `size`). It never modifies its children. |
| `CinematicTabs*` | C | A visual skin over the Radix tabs. Keyboard and ARIA behaviour come from Radix. Pass `dir` for Arabic. |
| `DIALOG_SURFACE` | C | Class string for `DialogContent` and `SheetContent`. |
| `useOnlineStatus` (`src/hooks/`) | C | Chooses between the `offline` and `error` states. |

Navigation menus use `MENU_SURFACE`, `MENU_ITEM` and `ICON_BUTTON` from `src/components/layout/navMenuStyles.ts`.

## Rules

1. Write directional CSS with logical properties (`ms-`, `me-`, `start`, `end`, `inset-inline-*`). Translations get `dir="ltr"` or `dir="auto"`, so they keep their own direction under the Arabic interface.
2. Every interface string goes through `src/locales/{en,fr,ar}`. New French and Arabic copy is marked `NEEDS NATIVE REVIEW`.
3. No sample Quran text, translations, tafsir or word meanings in `src/`. Test fixtures live only in `tests/e2e/fixtures/`.

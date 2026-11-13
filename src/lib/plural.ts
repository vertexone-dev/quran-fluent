/**
 * Locale-aware count formatting that fits the existing `{count}` string
 * architecture (no new dependency).
 *
 * A locale string is either an ordinary template ("{count} min") or a
 * category list using CLDR plural categories, separated by "|":
 *
 *   "one:آية واحدة|two:آيتان|few:{count} آيات|many:{count} آية|other:{count} آية"
 *
 * The category is chosen with Intl.PluralRules for the active locale; an
 * unlisted category falls back to `other`. English and French strings stay
 * ordinary templates, so their output is unchanged.
 */
const CATEGORY_LIST =
  /^(?:(?:zero|one|two|few|many|other):[^|]*\|)*(?:zero|one|two|few|many|other):/;
const CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;
type Category = (typeof CATEGORIES)[number];

export function isPluralTemplate(template: string): boolean {
  return CATEGORY_LIST.test(template);
}

export function formatPlural(
  template: string,
  count: number,
  locale: string,
  /** Extra named placeholders to fill after the form is chosen, e.g. {completed}/{total}. */
  vars: Record<string, string | number> = {},
): string {
  const fill = (s: string) =>
    s
      .replace(/\{count\}/g, String(count))
      .replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
  if (!isPluralTemplate(template)) return fill(template);
  const forms: Partial<Record<Category, string>> = {};
  for (const part of template.split("|")) {
    const i = part.indexOf(":");
    forms[part.slice(0, i) as Category] = part.slice(i + 1);
  }
  const category = new Intl.PluralRules(locale).select(count) as Category;
  return fill(forms[category] ?? forms.other ?? "");
}

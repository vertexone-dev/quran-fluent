import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const fx = JSON.parse(readFileSync("tests/e2e/fixtures/al-fatiha.fixture.json", "utf8"));
const out = "/root/mc/shots";
const p = (u, k) => { const v = new URL(u).searchParams.get(k); return v ? v.replace(/^eq\./, "") : null; };
async function fixture(page) {
  const reply = (route, rows) => { const obj = (route.request().headers()["accept"]||"").includes("vnd.pgrst.object"); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(obj ? rows[0] ?? {} : rows) }); };
  await page.route("**/rest/v1/surahs*", r => { const n = p(r.request().url(), "number"); return reply(r, n ? fx.surahs.filter(s => String(s.number) === n) : fx.surahs); });
  await page.route("**/rest/v1/ayahs*", r => { const u = r.request().url(); const s = p(u,"surah_number"), a = p(u,"ayah_number"); return reply(r, fx.ayahs.filter(x => String(x.surah_number)===s && (!a || String(x.ayah_number)===a))); });
  await page.route("**/rest/v1/content_sources*", r => { const l = p(r.request().url(),"language"); return reply(r, l==="en"?[{id:"fx-p",translator:"Marmaduke Pickthall"}]: l==="fr"?[{id:"fx-k",translator:"Albin de Kazimirski Biberstein"}]:[]); });
  await page.route("**/rest/v1/translations*", r => reply(r, p(r.request().url(),"surah_number")==="1"?fx.pickthall:[]));
  await page.route("**/rest/v1/translation_segment_ayahs*", r => reply(r, p(r.request().url(),"surah_number")==="1"?fx.kazimirski:[]));
  await page.route("**/recitations/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ audio_files: [] }) }));
}
const b = await chromium.launch();
const views = [["desktop",1440,900],["tablet",768,1024],["mobile",390,844]];
const only = process.argv[2];
for (const loc of ["en","fr","ar"]) for (const [vn,w,h] of views) {
  if (only && !(only.includes(loc) && only.includes(vn))) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(l => localStorage.setItem("quranroots-locale", l), loc);
  const page = await ctx.newPage(); await fixture(page);
  await page.goto("http://localhost:5177/quran?surah=1&ayah=2"); await page.waitForTimeout(3500);
  await page.getByTestId("ayah-card-1-2").scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
  await page.getByTestId("ayah-card-1-2").locator("button").first().click().catch(()=>{}); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/reader-${loc}-${vn}.jpg`, type: "jpeg", quality: 70 });
  await page.goto("http://localhost:5177/quran/understand?surah=1&ayah=7"); await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/understand-${loc}-${vn}.jpg`, type: "jpeg", quality: 70, fullPage: vn !== "desktop" });
  await page.getByTestId("understand-tab-words").click(); await page.waitForTimeout(500);
  await page.getByTestId("understand-tab-words").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/understand-words-${loc}-${vn}.jpg`, type: "jpeg", quality: 70 });
  await ctx.close();
}
await b.close();

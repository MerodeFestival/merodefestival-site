// Bouwt de Engelse en Franse versie van de site (site/en/ en site/fr/). Draait na build-pages.mjs en vertaal.mjs:
//   node scripts/build-talen.mjs
//
// Per taal:
//  1. een kopie van site/ in .build/talen/<taal>/, met vertaalde gegevens (agenda, producties, teksten...)
//     uit vertalingen/cache.json; wat nog niet vertaald is, blijft Nederlands;
//  2. daarin draait de gewone bouw (build-pages.mjs) met TAAL=<taal>;
//  3. de pagina’s komen in site/<taal>/; verwijzingen naar css, beelden en lettertypes wijzen naar de gedeelde bestanden.
// Daarna krijgen alle pagina’s (ook de Nederlandse) een taalkeuze en hreflang-verwijzingen, en de sitemap alle talen.

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { VERTAALD, TALEN, NAAM, V, vertaalBestanden, tekstenNl, GEEN_TEKST } from "./talen.mjs";

const SITE = (process.env.SITE_URL || "https://www.merodefestival.be").replace(/\/$/, "");
const ROOT = path.resolve("site");
const STAGING = path.resolve(".build/talen");
const lees = async (f, standaard) => { try { return JSON.parse(await fs.readFile(f, "utf8")); } catch { return standaard; } };
const bestaat = async f => { try { await fs.access(f); return true; } catch { return false; } };

const catalogus = await lees(path.resolve(".build/teksten-catalogus.json"), null);
if (!catalogus) { console.error("Geen .build/teksten-catalogus.json: draai eerst node scripts/build-pages.mjs."); process.exit(1); }
const notionTeksten = await lees(path.join(ROOT, "data/teksten.json"), {});

// Beeldpaden in de gegevens wijzen vanuit /en/ één map hoger (de beelden staan maar één keer op de site)
const op = src => src && !/^(https?:|\/|data:)/.test(src) ? "../" + src : src;

// Alle HTML-pagina’s onder een map, zonder de mappen met bestanden
async function paginas(dir, rel = "") {
  const uit = [];
  for (const e of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!rel && ["data", "fonts", "img", "css", "js", "seizoen", ...VERTAALD].includes(e.name)) continue;
      uit.push(...await paginas(dir, path.join(rel, e.name)));
    } else if (e.name.endsWith(".html")) uit.push(path.join(rel, e.name).split(path.sep).join("/"));
  }
  return uit;
}

for (const taal of VERTAALD) {
  const vt = t => V(t, taal);
  const map = path.join(STAGING, taal);
  await fs.rm(map, { recursive: true, force: true });
  await fs.mkdir(STAGING, { recursive: true });
  await fs.cp(ROOT, map, { recursive: true, filter: bron => !VERTAALD.some(t => bron === path.join(ROOT, t)) });

  // ---------- 1. vertaalde gegevens ----------
  const d = n => path.join(map, "data", n);
  const v = vertaalBestanden({
    agenda: await lees(d("agenda.json"), []),
    producties: await lees(d("producties.json"), []),
    wesp: await lees(d("wesp.json"), []),
    edities: await lees(d("edities.json"), []),
    kerkconcerten: await lees(d("kerkconcerten.json"), []),
    teksten: tekstenNl(catalogus, notionTeksten),
  }, vt);
  for (const e of v.agenda) { e.foto = op(e.foto); for (const b of e.beelden || []) b.src = op(b.src); }
  for (const p of v.producties) { p.foto = op(p.foto); p.fotos = (p.fotos || []).map(op); }
  for (const r of v.wesp) r.foto = op(r.foto);
  const beeldbank = (await lees(d("beeldbank.json"), [])).map(b => ({ ...b, src: op(b.src) }));
  // Instellingen (statistieken, adressen) blijven zoals in Notion
  const teksten = { ...Object.fromEntries(Object.entries(notionTeksten).filter(([k]) => GEEN_TEKST.test(k))), ...v.teksten };
  const schrijf = async (naam, data, js) => {
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(d(naam + ".json"), json + "\n");
    if (js) await fs.writeFile(d(naam + ".js"), `window.${js} = ${json};\n`);
  };
  await schrijf("agenda", v.agenda, "AGENDA");
  await schrijf("producties", v.producties, "PRODUCTIES");
  await schrijf("wesp", v.wesp);
  await schrijf("edities", v.edities);
  await schrijf("kerkconcerten", v.kerkconcerten);
  await schrijf("beeldbank", beeldbank, "BEELDBANK");
  await schrijf("teksten", teksten, "TEKSTEN");
  const seizoen = path.join(map, "seizoen/seizoen.js");
  await fs.writeFile(seizoen, (await fs.readFile(seizoen, "utf8")).replace(/:\s*"seizoen\//g, ': "../seizoen/'));

  // ---------- 2. de gewone bouw, in die taal ----------
  execFileSync(process.execPath, ["scripts/build-pages.mjs"], {
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, TAAL: taal, SITE_MAP: map, SITE_URL: `${SITE}/${taal}` },
  });

  // ---------- 3. naar site/<taal>/ ----------
  const doel = path.join(ROOT, taal);
  await fs.rm(doel, { recursive: true, force: true });
  const mee = [...await paginas(map),
    ...(await fs.readdir(path.join(map, "concert"))).filter(f => f.endsWith(".ics")).map(f => `concert/${f}`),
    "data/agenda.js", "data/edities.js", "data/beeldbank.js", "seizoen/seizoen.js", "js/producties-extra.js", "js/afwerking.js"];
  for (const f of mee) {
    if (!await bestaat(path.join(map, f))) continue;
    await fs.mkdir(path.dirname(path.join(doel, f)), { recursive: true });
    await fs.copyFile(path.join(map, f), path.join(doel, f));
  }
  // Verwijzingen naar bestanden die niet in site/<taal>/ staan (css, beelden, lettertypes...) gaan naar de gedeelde versie
  for (const f of await paginas(doel)) {
    const pad = path.join(doel, f), hier = path.dirname(pad), nl = path.dirname(path.join(ROOT, f));
    let h = await fs.readFile(pad, "utf8");
    const herschrijf = async u => {
      if (!u || /^(?:[a-z]+:|\/|#|\$\{)/i.test(u)) return u;
      const [kaal, rest = ""] = u.split(/(?=[?#])/);
      let bestand;
      try { bestand = decodeURI(kaal); } catch { return u; }
      if (!kaal || await bestaat(path.join(hier, bestand))) return u;
      const gedeeld = path.join(nl, bestand);
      return await bestaat(gedeeld) ? path.relative(hier, gedeeld).split(path.sep).join("/") + rest : u;
    };
    const stukken = [];
    for (const m of h.matchAll(/\b(href|src|content)="([^"]*)"|url\(([^)'"]+)\)/g)) stukken.push(m);
    let uit = "", vorige = 0;
    for (const m of stukken) {
      const oud = m[2] ?? m[3];
      if (m[1] === "content" && !/\.(png|jpe?g|webp|svg|ico)$/i.test(oud)) continue;
      const nieuw = await herschrijf(oud);
      if (nieuw === oud) continue;
      uit += h.slice(vorige, m.index) + m[0].replace(oud, nieuw);
      vorige = m.index + m[0].length;
    }
    h = (uit + h.slice(vorige)).replace(new RegExp(`${SITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${taal}/\\.\\./`, "g"), `${SITE}/`);
    await fs.writeFile(pad, h);
  }
  console.log(`Versie ${NAAM[taal]}: ${mee.filter(f => f.endsWith(".html")).length} pagina’s in site/${taal}/.`);
}

// ---------- taalkeuze, hreflang en sitemap ----------
const nlPaginas = await paginas(ROOT);
const per = {};
for (const taal of TALEN) per[taal] = new Set(taal === "nl" ? nlPaginas : await paginas(path.join(ROOT, taal)));
const adres = (taal, f) => `${SITE}${taal === "nl" ? "" : "/" + taal}/${f === "index.html" ? "" : f.replace(/\.html$/, "")}`;
const KORT = { nl: "NL", en: "EN", fr: "FR" };

for (const taal of TALEN) {
  for (const f of per[taal]) {
    if (f === "404.html") continue;
    const pad = path.join(ROOT, taal === "nl" ? "" : taal, f);
    let h = await fs.readFile(pad, "utf8");
    if (h.includes('class="talen"')) h = h.replace(/<div class="talen"[\s\S]*?<\/div>\n?/, "").replace(/<li class="talen-menu">[\s\S]*?<\/li>/, "").replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, "");
    const talen = TALEN.filter(t => per[t].has(f));
    if (talen.length < 2) { await fs.writeFile(pad, h); continue; }
    const terug = "../".repeat(f.split("/").length - 1 + (taal === "nl" ? 0 : 1));
    const link = t => t === taal
      ? `<span aria-current="true" lang="${t}" title="${NAAM[t]}">${KORT[t]}</span>`
      : `<a href="${terug}${t === "nl" ? "" : t + "/"}${f}" hreflang="${t}" lang="${t}" title="${NAAM[t]}">${KORT[t]}</a>`;
    const keuze = talen.map(link).join("");
    const label = { nl: "Taal", en: "Language", fr: "Langue" }[taal];
    h = h.replace(/(<a class="btn[^"]*"[^>]*>[^<]*<\/a>\s*<\/div>\s*<\/header>)/, `<div class="talen" role="group" aria-label="${label}">${keuze}</div>\n    $1`);
    h = h.replace(/(<nav id="hoofdmenu"[^>]*>\s*<ul>[\s\S]*?)(<\/ul>)/, `$1<li class="talen-menu">${keuze}</li>$2`);
    const alternatief = [...talen.map(t => `<link rel="alternate" hreflang="${t}" href="${adres(t, f)}">`), `<link rel="alternate" hreflang="x-default" href="${adres("nl", f)}">`];
    h = h.replace("</head>", alternatief.join("\n") + "\n</head>");
    await fs.writeFile(pad, h);
  }
}

// Sitemap: elke Nederlandse pagina met haar vertalingen ernaast
const sitemap = await fs.readFile(path.join(ROOT, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const bestandVan = u => { const r = u.slice(SITE.length + 1); return r === "" ? "index.html" : r + ".html"; };
const regels = [];
for (const u of locs) {
  const f = bestandVan(u);
  const talen = TALEN.filter(t => per[t].has(f));
  const alt = talen.length > 1 ? talen.map(t => `<xhtml:link rel="alternate" hreflang="${t}" href="${adres(t, f)}"/>`).join("") : "";
  for (const t of talen) regels.push(`  <url><loc>${adres(t, f)}</loc>${alt}</url>`);
}
await fs.writeFile(path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${regels.join("\n")}\n</urlset>\n`);
console.log(`Taalkeuze en hreflang op alle pagina’s; sitemap met ${regels.length} adressen.`);

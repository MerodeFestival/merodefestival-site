// Meertaligheid: gedeelde hulpmiddelen voor de bouw (build-pages, build-talen) en het vertaalscript (vertaal.mjs).
//
// - TAAL is de taal van de bouw die nu draait (omgevingsvariabele TAAL, standaard nl).
// - Alle vertalingen staan in vertalingen/cache.json, per Nederlandse brontekst (sleutel = hash van die tekst).
//   vertaal.mjs vult die aan (automatisch vertaald, of overgenomen uit de kolommen EN en FR in Notion).
// - V(tekst) geeft de vertaling van een Nederlandse tekst in de huidige taal, of de tekst zelf als er (nog) geen is.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const TALEN = ["nl", "en", "fr"];
export const VERTAALD = ["en", "fr"];
export const TAAL = TALEN.includes(process.env.TAAL) ? process.env.TAAL : "nl";
export const NAAM = { nl: "Nederlands", en: "English", fr: "Français" };
export const LOCALE = { nl: "nl_BE", en: "en_GB", fr: "fr_BE" };
export const KOLOM = { en: "EN", fr: "FR" };   // achtervoegsel van de vertaalkolommen in Notion, bv. "Beschrijving EN"

export const CACHE = path.resolve("vertalingen/cache.json");
export const hash = t => crypto.createHash("sha1").update(String(t)).digest("hex").slice(0, 16);

// Teksten die niet vertaald worden: leeg, zonder letters (jaartallen, prijzen), of een adres
export const vertaalbaar = t => {
  const s = String(t ?? "").trim();
  return !!s && /\p{L}/u.test(s) && !/^(https?:\/\/|mailto:|www\.)\S+$/i.test(s);
};

let cache = null;
export function leesCache() {
  if (!cache) { try { cache = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { cache = {}; } }
  return cache;
}
export function V(tekst, taal = TAAL) {
  if (taal === "nl" || !vertaalbaar(tekst)) return tekst;
  return leesCache()[hash(tekst)]?.[taal] || tekst;
}

// ---------- datums ----------
export const DATUM = {
  nl: {
    maand: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
    maandKort: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
    dag: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"],
  },
  en: {
    maand: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    maandKort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    dag: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  fr: {
    maand: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    maandKort: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
    dag: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  },
};

// ---------- lange teksten uit Notion (blokken) ↔ gewone tekst met opmaaktekens ----------
// In Notion staat de vertaling van de uitgebreide tekst in één tekstkolom (bv. "Lange tekst EN"):
// een lege regel tussen de blokken, "- " voor een opsomming, "1. " voor een genummerde lijst, "> " voor een citaat,
// "## " en "### " voor koppen, **vet**, *cursief* en [tekst](adres) voor een link.
const ontcijfer = t => String(t).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const escHtml = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const htmlNaarMd = h => ontcijfer(String(h)
  .replace(/<br\s*\/?>/g, "\n")
  .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/g, (m, u, t) => `[${t}](${u})`)
  .replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**")
  .replace(/<em>([\s\S]*?)<\/em>/g, "*$1*")
  .replace(/<[^>]+>/g, ""));

const mdNaarHtml = t => escHtml(t)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, x, u) => `<a href="${u}">${x}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const VOORTEKEN = { li: "- ", ul: "- ", ol: "1. ", quote: "> ", h: "## ", h2: "## ", h3: "### " };
export function blokkenNaarMd(blokken) {
  return (blokken || []).map(b => (VOORTEKEN[b.type] || "") + htmlNaarMd(b.html)).join("\n\n");
}

// soort "agenda" (concertpagina’s: p, li, quote, h) of "rijk" (productiepagina’s: p, h2, h3, ul, ol, quote)
export function mdNaarBlokken(md, soort = "agenda") {
  const rijk = soort === "rijk";
  return String(md || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(blok => {
    let type = "p", t = blok;
    let m;
    if ((m = t.match(/^###\s+([\s\S]*)$/))) { type = rijk ? "h3" : "h"; t = m[1]; }
    else if ((m = t.match(/^##?\s+([\s\S]*)$/))) { type = rijk ? "h2" : "h"; t = m[1]; }
    else if ((m = t.match(/^[-•]\s+([\s\S]*)$/))) { type = rijk ? "ul" : "li"; t = m[1]; }
    else if ((m = t.match(/^\d+[.)]\s+([\s\S]*)$/))) { type = rijk ? "ol" : "li"; t = m[1]; }
    else if ((m = t.match(/^>\s?([\s\S]*)$/))) { type = "quote"; t = m[1]; }
    const html = mdNaarHtml(t);
    return { type, html: rijk ? html.replace(/\n/g, "<br>") : html.replace(/\n/g, " ") };
  });
}

// ---------- welke velden vertaald worden ----------
// veld in de JSON van de site → naam van de kolom in Notion (de vertaling staat in "<naam> EN" en "<naam> FR")
export const VELDEN = {
  agenda: { sub: "Ondertitel", text: "Beschrijving", time: "Uur", duur: "Duur", price: "Prijs", cta: "Knoptekst" },
  producties: {
    titel: "Titel", label: "Label", makers: "Makers", tekst: "Tekst", extra: "Extra", waar: "Waar", vorm: "Vorm",
    speelduur: "Speelduur", periode: "Periode", bezetting: "Bezetting", techniek: "Techniek", geschikt: "Geschikt voor",
    prijs: "Prijs", knop: "Knoptekst", data: "Data",
  },
  wesp: { titel: "Titel", label: "Label", tekst: "Tekst", linktekst: "Linktekst" },
};
export const LANGE_TEKST = "Lange tekst";   // kolom voor de uitgebreide tekst uit de pagina zelf

// ---------- de gegevens van de site vertalen ----------
// vt(tekst) geeft de vertaling van één Nederlandse tekst. vertaal.mjs geeft hier een functie die enkel noteert welke
// teksten nodig zijn; build-talen.mjs geeft V, zodat beide altijd over dezelfde teksten gaan.
const WESP_VELDEN = {
  Spoor: ["titel", "label", "tekst", "linktekst"], Project: ["titel", "label", "tekst", "linktekst"], Vriend: ["titel", "label", "tekst", "linktekst"],
  Opdrachtgever: ["tekst"], Partner: ["label", "tekst"], Team: ["titel"],
};
export const wespVelden = soort => WESP_VELDEN[soort] || [];

export function vertaalBestanden(b, vt) {
  const velden = (x, lijst) => { const y = { ...x }; for (const f of lijst) if (x[f]) y[f] = vt(x[f]); return y; };
  const lang = (blokken, soort) => {
    if (!(blokken || []).length) return blokken;
    const md = blokkenNaarMd(blokken), t = vt(md);
    return t === md ? blokken : mdNaarBlokken(t, soort);
  };
  const uit = {};
  if (b.agenda) uit.agenda = b.agenda.map(e => ({
    ...velden(e, Object.keys(VELDEN.agenda)),
    kindNl: e.kind, kind: String(e.kind || "").split(", ").map(vt).join(", "),
    lang: lang(e.lang, "agenda"),
  }));
  if (b.producties) uit.producties = b.producties.map(p => {
    const y = velden(p, Object.keys(VELDEN.producties).filter(f => f !== "data"));
    if ((p.data || []).length) y.data = String(vt(p.data.join("\n"))).split(/\n+/).map(l => l.trim()).filter(Boolean);
    y.lang = lang(p.lang, "rijk");
    return y;
  });
  if (b.wesp) uit.wesp = b.wesp.map(r => ({ ...velden(r, wespVelden(r.soort)), labelNl: r.label }));
  if (b.edities) uit.edities = b.edities.map(x => velden(x, ["titel", "tekst", "datum", "plek", "wandelplekken"]));
  if (b.kerkconcerten) uit.kerkconcerten = b.kerkconcerten.map(z => velden(z, ["opmerking"]));
  if (b.teksten) uit.teksten = Object.fromEntries(Object.entries(b.teksten).map(([k, t]) => [k, vt(t)]));
  if (b.extra) uit.extra = b.extra.map(vt);
  return uit;
}

// De Nederlandse tekst van elke sleutel uit Teksten (website): de tekst uit Notion, anders de standaardtekst uit de code.
// Instellingen (statistieken, adressen) worden niet vertaald.
export const GEEN_TEKST = /^statistiek\.|\.link$|ticketlink$/;
export function tekstenNl(catalogus, notion) {
  const uit = {};
  for (const c of catalogus) {
    if (GEEN_TEKST.test(c.sleutel)) continue;
    const t = (notion[c.sleutel] || "").trim() || c.standaard;
    if (t) uit[c.sleutel] = t;
  }
  return uit;
}

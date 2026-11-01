// Vertaalt de site naar het Engels en het Frans. Draait na de Nederlandse bouw (zie .github/workflows/notion.yml).
//
//  1. Leest de vertaalkolommen in Notion (.build/notion-bron*.json, geschreven door sync-notion.mjs en sync-wesp.mjs).
//     Heeft iemand daar een vertaling aangepast, dan wint die aanpassing.
//  2. Verzamelt alle Nederlandse teksten die de Engelse en Franse site nodig hebben (dezelfde lijst als build-talen.mjs gebruikt).
//  3. Vertaalt wat nog ontbreekt: met Claude als het geheim ANTHROPIC_API_KEY bestaat, anders met GitHub Models
//     (werkt met het gewone GITHUB_TOKEN van de workflow, geen extra sleutel nodig).
//  4. Schrijft de vertalingen terug in de verborgen kolommen EN en FR in Notion, en bewaart alles in vertalingen/cache.json.
//
//   node scripts/vertaal.mjs           alles hierboven
//   node scripts/vertaal.mjs --lijst   enkel .build/te-vertalen.json schrijven met wat nog ontbreekt (geen Notion, geen vertaaldienst)
//
// Lukt het vertalen niet (geen dienst, limiet bereikt), dan toont de site voorlopig de Nederlandse tekst
// en probeert de volgende run opnieuw.

import fs from "node:fs/promises";
import path from "node:path";
import { VERTAALD, NAAM, KOLOM, CACHE, hash, vertaalbaar, vertaalBestanden, tekstenNl, GEEN_TEKST } from "./talen.mjs";
import { laadTeksten } from "./teksten.mjs";
import { statistiek } from "./afwerking.mjs";
import { privacyHtml, PRIVACY_VERSIE } from "./privacy-tekst.mjs";

const LIJST = process.argv.includes("--lijst");
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const STAND = path.resolve("vertalingen/stand.json");
const lees = async (f, standaard) => { try { return JSON.parse(await fs.readFile(f, "utf8")); } catch { return standaard; } };

const cache = await lees(CACHE, {});
const stand = await lees(STAND, {});   // per Notion-veld: van welke Nederlandse tekst de vertaling in Notion komt, en welke vertaling we er zetten
const bron = [...await lees(path.resolve(".build/notion-bron.json"), []), ...await lees(path.resolve(".build/notion-bron-wesp.json"), [])];
const catalogus = await lees(path.resolve(".build/teksten-catalogus.json"), []);
const notionTeksten = await lees(path.resolve("site/data/teksten.json"), {});
const zet = (h, taal, t) => { (cache[h] ||= {})[taal] = t; };

// De Nederlandse tekst van een sleutel uit Teksten (website): Notion, anders de standaardtekst
// (instellingen zoals statistieken en adressen worden niet vertaald)
const standaard = Object.fromEntries(catalogus.map(c => [c.sleutel, c.standaard]));
for (let i = bron.length - 1; i >= 0; i--) {
  const p = bron[i];
  if (p.db !== "teksten") continue;
  if (GEEN_TEKST.test(p.sleutel)) { bron.splice(i, 1); continue; }
  p.velden.tekst.nl = p.velden.tekst.nl.trim() || standaard[p.sleutel] || "";
}

// ---------- 1. aanpassingen in Notion overnemen ----------
let overgenomen = 0;
if (!LIJST) for (const p of bron) for (const [veld, v] of Object.entries(p.velden)) {
  if (!vertaalbaar(v.nl)) continue;
  const h = hash(v.nl);
  for (const taal of VERTAALD) {
    const inNotion = (v[taal] || "").trim(), vorige = stand[`${p.id}:${veld}:${taal}`];
    if (!inNotion) continue;
    // Zelfde Nederlandse tekst, maar een andere vertaling dan wij er zetten: iemand heeft ze aangepast
    if (vorige ? vorige.h === h && inNotion !== vorige.t : !cache[h]?.[taal]) {
      zet(h, taal, inNotion);
      cache[h].handmatig = true;
      overgenomen++;
    }
  }
}

// ---------- 2. welke teksten heeft de site nodig? ----------
const nodig = new Set();
const noteer = t => { if (vertaalbaar(t)) nodig.add(t); return t; };
await laadTeksten(path.resolve("site"));
vertaalBestanden({
  agenda: await lees(path.resolve("site/data/agenda.json"), []),
  producties: await lees(path.resolve("site/data/producties.json"), []),
  wesp: await lees(path.resolve("site/data/wesp.json"), []),
  edities: await lees(path.resolve("site/data/edities.json"), []),
  kerkconcerten: await lees(path.resolve("site/data/kerkconcerten.json"), []),
  teksten: tekstenNl(catalogus, notionTeksten),
  extra: [privacyHtml({ statistiek: statistiek(), esc }), PRIVACY_VERSIE],
}, noteer);
for (const p of bron) for (const v of Object.values(p.velden)) noteer(v.nl);
const ontbreekt = [...nodig].filter(t => VERTAALD.some(taal => !cache[hash(t)]?.[taal]));

if (LIJST) {
  await fs.mkdir(path.resolve(".build"), { recursive: true });
  await fs.writeFile(path.resolve(".build/te-vertalen.json"), JSON.stringify(ontbreekt.map(nl => ({ h: hash(nl), nl })), null, 1) + "\n");
  console.log(`${nodig.size} teksten nodig, ${ontbreekt.length} nog niet vertaald: zie .build/te-vertalen.json.`);
  process.exit(0);
}

// ---------- 3. ontbrekende vertalingen maken ----------
const UITLEG = taal => `Je vertaalt teksten voor de website van Merodefestival uit het Nederlands naar het ${taal === "en" ? "Engels (Brits)" : "Frans (zoals in België)"}.
Merodefestival brengt folk- en wereldmuziek naar kerken, kapellen en natuurgebieden in Landschapspark de Merode (Vlaanderen, België); WESP vzw is de organisatie erachter.
Regels:
- Vertaal vlot en natuurlijk, in de toon van een cultuurhuis: warm, helder, niet wollig. Spreek de lezer aan zoals het origineel (je/jij → you; in het Frans "vous").
- Vertaal geen eigennamen: artiesten, groepen, albums, titels van voorstellingen, reeksen (Holsbeek Sessies, Limburg Sessies, Klanken van de Steden, PARK Festival, Merodefestival, WESP), kerken, dorpen en organisaties blijven zoals ze zijn. Landcodes tussen haakjes (BE, IRL, FR...) blijven ook.
- Behoud precies alle opmaak: regeleinden en lege regels, opmaaktekens (**vet**, *cursief*, [tekst](adres), "- ", "1. ", "> ", "## "), HTML-tags en hun attributen, plaatshouders zoals {n}, {dienst}, {titel}, {nr}, {jaar}, het teken | en adressen (https://..., e-mailadressen).
- Bedragen, datums en uren: zet maand- en dagnamen om en schrijf uren zoals gebruikelijk in de doeltaal (20.00 uur → 8 pm; 20 h), maar verander geen cijfers.
- Een tekst die al in het Engels of een andere taal staat, of enkel uit een naam bestaat, geef je ongewijzigd terug.
Je krijgt een JSON-object met nummers als sleutels. Antwoord met precies hetzelfde JSON-object, met als waarde telkens de vertaling. Geen uitleg erbij.`;

async function vraagClaude(taal, stukken) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 16000, system: UITLEG(taal), messages: [{ role: "user", content: JSON.stringify(stukken) }] }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return JSON.parse(j.content.map(c => c.text || "").join("").replace(/^```(?:json)?\s*|\s*```$/g, ""));
}
async function vraagGitHub(taal, stukken, model = "openai/gpt-4.1") {
  const res = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json", Accept: "application/vnd.github+json" },
    body: JSON.stringify({ model, temperature: 0.2, response_format: { type: "json_object" },
      messages: [{ role: "system", content: UITLEG(taal) }, { role: "user", content: JSON.stringify(stukken) }] }),
  });
  if (res.status === 429 && model !== "openai/gpt-4.1-mini") return vraagGitHub(taal, stukken, "openai/gpt-4.1-mini");
  if (!res.ok) throw new Error(`GitHub Models ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return JSON.parse(j.choices[0].message.content);
}
const dienst = process.env.ANTHROPIC_API_KEY ? vraagClaude : process.env.GITHUB_TOKEN ? vraagGitHub : null;

// Pakketjes van hoogstens 30 teksten of zo’n 8000 tekens
const pakketten = lijst => {
  const uit = [];
  let huidig = [], lengte = 0;
  for (const t of lijst) {
    if (huidig.length && (huidig.length >= 30 || lengte + t.length > 8000)) { uit.push(huidig); huidig = []; lengte = 0; }
    huidig.push(t); lengte += t.length;
  }
  if (huidig.length) uit.push(huidig);
  return uit;
};

let vertaald = 0, mislukt = 0;
if (ontbreekt.length && !dienst) console.log(`${ontbreekt.length} teksten nog niet vertaald, maar er is geen vertaaldienst (GITHUB_TOKEN of ANTHROPIC_API_KEY).`);
if (ontbreekt.length && dienst) for (const taal of VERTAALD) {
  const lijst = ontbreekt.filter(t => !cache[hash(t)]?.[taal]);
  for (const pakket of pakketten(lijst)) {
    const stukken = Object.fromEntries(pakket.map((t, i) => [String(i + 1), t]));
    try {
      const antwoord = await dienst(taal, stukken);
      pakket.forEach((t, i) => {
        const v = antwoord[String(i + 1)];
        if (typeof v === "string" && v.trim()) { zet(hash(t), taal, v.trim()); vertaald++; }
      });
    } catch (err) {
      mislukt += pakket.length;
      console.warn(`Vertalen naar het ${NAAM[taal]} mislukt: ${err.message}`);
      if (/\b(401|403|429)\b/.test(err.message)) break;   // geen toegang of limiet bereikt: volgende run opnieuw
    }
  }
}

// ---------- 4. vertalingen in Notion zetten ----------
async function notion(pad, body, poging = 0) {
  const res = await fetch(`https://api.notion.com/v1/${pad}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429 && poging < 5) {
    await new Promise(r => setTimeout(r, 1500 * (poging + 1)));
    return notion(pad, body, poging + 1);
  }
  if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
// Notion bewaart hoogstens 2000 tekens per stuk tekst
const rich = t => (String(t).match(/[\s\S]{1,1900}/g) || []).slice(0, 100).map(x => ({ type: "text", text: { content: x } }));

let bijgewerkt = 0;
if (NOTION_TOKEN) {
  for (const p of bron) {
    const props = {}, nieuweStand = {};
    for (const [veld, v] of Object.entries(p.velden)) {
      if (!vertaalbaar(v.nl)) continue;
      const h = hash(v.nl);
      for (const taal of VERTAALD) {
        const wil = cache[h]?.[taal];
        if (!wil) continue;
        nieuweStand[`${p.id}:${veld}:${taal}`] = { h, t: wil };
        if ((v[taal] || "").trim() !== wil) props[`${v.kolom} ${KOLOM[taal]}`] = { rich_text: rich(wil) };
      }
    }
    try {
      if (Object.keys(props).length) {
        await notion(`pages/${p.id}`, { properties: props });
        bijgewerkt++;
        await new Promise(r => setTimeout(r, 350));   // Notion staat ongeveer 3 aanvragen per seconde toe
      }
      Object.assign(stand, nieuweStand);
    } catch (err) {
      console.warn(`Vertaling niet in Notion gezet (${p.db}, ${p.id}): ${err.message}`);
      if (/\b(401|403)\b/.test(err.message)) { console.warn("Geen schrijfrechten in Notion: de koppeling heeft het recht ‘Inhoud bijwerken’ nodig."); break; }
    }
  }
}

await fs.mkdir(path.dirname(CACHE), { recursive: true });
const gesorteerd = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
await fs.writeFile(CACHE, JSON.stringify(gesorteerd(cache), null, 1) + "\n");
await fs.writeFile(STAND, JSON.stringify(gesorteerd(stand), null, 1) + "\n");
console.log(`Vertalingen: ${nodig.size} teksten nodig, ${vertaald} nieuw vertaald${mislukt ? `, ${mislukt} mislukt (volgende run opnieuw)` : ""}, ${overgenomen} aangepast in Notion overgenomen, ${bijgewerkt} Notion-pagina’s bijgewerkt.`);

function esc(t) { return String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

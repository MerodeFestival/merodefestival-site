// Omleidingen van de oude Strikingly-adressen naar de nieuwe pagina’s (bestand site/_redirects).
// Zo blijft Google (en elke bezoeker met een oude link) de juiste pagina vinden na de verhuis van het domein.
// Een doel kan een lijst zijn: het eerste adres waarvan de pagina bestaat, wordt gebruikt; het laatste is de terugval.
// Een doel { artiest: /regex/ } wijst naar de concertpagina van het eerste concert waarvan de naam past.

import fs from "node:fs/promises";
import path from "node:path";

const REGELS = [
  // vaste pagina’s
  ["/home", ["/"]],
  ["/muzikale-wandelingen", ["/muzikale-wandelingen", "/kijk-en-luister", "/"]],
  ["/wandelapp", ["/muzikale-wandelingen", "/kijk-en-luister", "/"]],
  ["/b2b", ["/muzikale-wandelingen", "/kijk-en-luister", "/"]],
  ["/klanken", ["/klanken-in-de-kapel", "/kijk-en-luister", "/"]],
  ["/klanken-systeem", ["/klanken-in-de-kapel", "/kijk-en-luister", "/"]],
  ["/klankenvandesteden", ["https://klankenvandesteden.be"]],
  ["/boek", ["/ode-aan-de-merode", "/kijk-en-luister", "/"]],
  ["/ode-aan-de-merode", ["/ode-aan-de-merode", "/kijk-en-luister", "/"]],
  ["/the-sound-of-the-abbey", ["/the-sound-of-the-abbey", "/kijk-en-luister", "/"]],
  ["/sound", ["/the-sound-of-the-abbey", "/kijk-en-luister", "/"]],
  ["/volksliekes", ["/volkscafes", "/kijk-en-luister", "/"]],
  ["/volkscafes", ["/volkscafes", "/kijk-en-luister", "/"]],
  ["/podcast", ["/wandelpodcast", "/kijk-en-luister", "/"]],
  ["/creaties", ["/voor-programmatoren", "/"]],
  ["/projecten", ["/voor-programmatoren", "/"]],
  ["/in-opdracht", ["/voor-gemeenten", "/"]],
  // korte links per doelgroep, om uit te sturen in mails, dossiers en op prospectiekaarten
  ["/muzikanten", ["/voor-muzikanten", "/samenwerken", "/"]],
  ["/residenties", ["/voor-muzikanten", "/samenwerken", "/"]],
  ["/programmatoren", ["/voor-programmatoren", "/samenwerken", "/"]],
  ["/boeken", ["/voor-programmatoren", "/samenwerken", "/"]],
  ["/gemeenten", ["/voor-gemeenten", "/samenwerken", "/"]],
  ["/erfgoed", ["/voor-gemeenten", "/samenwerken", "/"]],
  ["/kerken", ["/voor-gemeenten", "/samenwerken", "/"]],
  // de vroegere rubriek Producties (tot november 2026)
  ["/producties", ["/voor-programmatoren", "/"]],
  // festivals, edities en oude acties
  ["/merodefestival-2023", ["/vorige-edities"]],
  ["/merodefestival-2024", ["/vorige-edities"]],
  ["/merodefestival-2025-1", ["/vorige-edities"]],
  ["/merodefestival-2026-archive", ["/vorige-edities"]],
  ["/merodefestival-2027", [{ artiest: /merodefestival 2027/i }, "/"]],
  ["/save-the-date", [{ artiest: /merodefestival 2027/i }, "/"]],
  ["/artiesten", ["/vorige-edities"]],
  ["/zomeraanbod-2020", ["/vorige-edities"]],
  ["/zomeraanbod-2022", ["/vorige-edities"]],
  ["/covid-19", ["/vorige-edities"]],
  ["/uitgesteld", ["/vorige-edities"]],
  ["/terugbetaling", ["/vorige-edities"]],
  ["/kerkconcerten2022", ["/vorige-edities"]],
  ["/kerkconcerten-copy", ["/vorige-edities"]],
  ["/bier-van-het-festival", ["/vorige-edities"]],
  ["/davidsfonds", ["/"]],
  ["/klasseactie", ["/"]],
  // praktische pagina’s zonder eigen plek op de nieuwe site (voorlopig naar de homepage)
  ["/contact", ["/wesp", "/"]],
  ["/parking", ["/"]],
  ["/de-merode-overnachten", ["/"]],
  ["/tickets", ["/"]],
  ["/nieuwsbrief", ["/"]],
  // blog, winkel en categorieën
  ["/blog", ["/"]],
  ["/blog/categories", ["/"]],
  ["/blog/categories/kerk-26-27", ["/"]],
  ["/store/categories", ["/"]],
  ["/store/products/werner-i-een-fris-gehopte-blonde-prins", ["/"]],
  // concerten
  ["/stijnkuppens", [{ artiest: /stijn kuppens/i }, "/"]],
  ["/lydiethonnard", [{ artiest: /lydie thonnard/i }, "/"]],
  ["/kerst", [{ artiest: /ster bleef stille/i }, "/"]],
  ["/echo", [{ artiest: /echo/i }, "/"]],
  ["/blog/aram-shahab-azinmehr-iran-derya-turkan-tur-robbe-kieckens", [{ artiest: /^aram/i }, "/"]],
  ["/blog/dubbelconcert-amber-haddad-trio-en-simon-leleux-manuel-hermia", [{ artiest: /amber haddad/i }, "/"]],
  ["/blog/gwen", [{ artiest: /gwen cresens/i }, "/"]],
  ["/blog/la-mal-coiffee-fr", [{ artiest: /la mal coiff/i }, "/"]],
  ["/blog/laura-cortese-s-acoustic-evening-iv-met-eliza-carthy-jake-blount-sarah", [{ artiest: /acoustic evening iv/i }, "/"]],
  ["/blog/livia", [{ artiest: /livia giaffreda/i }, "/"]],
  ["/blog/rioghnach-connolly-nir", [{ artiest: /rioghnach/i }, "/"]],
  ["/blog/sam-grassie-sco-dylan-fowler-wal-haroun-iqbal-be", [{ artiest: /sam grassie/i }, "/"]],
  ["/blog/sara-salverius-en-blazerskwartet-adem", [{ artiest: /sara salv/i }, "/"]],
  ["/blog/the-weaving-irl-uk", [{ artiest: /the weaving/i }, "/"]],
];

export async function maakOmleidingen({ agenda, ROOT }) {
  // De vroegere productiepagina’s (/productie-<webadres>) staan nu op /<webadres>
  let items = [];
  try { items = JSON.parse(await fs.readFile(path.join(ROOT, "data/producties.json"), "utf8")); } catch { /* geen gegevens */ }
  const extra = items.filter(p => p.slug && !p.verborgen).map(p => [`/productie-${p.slug}`, [`/${p.slug}`, "/kijk-en-luister", "/"]]);
  const bestaat = async pad => {
    if (pad === "/" || /^https?:/.test(pad)) return true;
    try { await fs.access(path.join(ROOT, pad.replace(/^\//, "").replace(/#.*$/, "") + ".html")); return true; } catch { return false; }
  };
  const concertDoel = d => {
    const kand = agenda.filter(e => d.artiest.test(e.artist));
    const e = kand[0];
    return e ? `/concert/${e.slug}` : null;
  };
  const regels = [];
  for (const [oud, doelen] of [...REGELS, ...extra]) {
    let doel = null;
    for (const d of doelen) {
      const kandidaat = typeof d === "string" ? ((await bestaat(d)) ? d : null) : concertDoel(d);
      if (kandidaat) { doel = kandidaat; break; }
    }
    if (doel && doel !== oud) regels.push(`${oud} ${doel} 301`);
  }
  return [
    "# Oude adressen van de vorige website, doorgestuurd naar de nieuwe pagina’s.",
    "# Dit bestand wordt bij elke bouw opnieuw gemaakt (scripts/omleidingen.mjs).",
    ...regels, "",
  ].join("\n");
}

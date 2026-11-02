// Maakt site/data/archief.json uit de inventaris in geschiedenis/ (lokaal, niet in git:
// die bestanden bevatten privébronnen en interne opmerkingen). Alleen wat publiek mag:
// datum, artiest, plek en video. Afgelaste concerten vallen weg.
//   node scripts/maak-archief.mjs

import fs from "node:fs/promises";
import path from "node:path";

const IN = path.resolve("geschiedenis");
const UIT = path.resolve("site/data/archief.json");

// Volgorde op de pagina, met titel, korte tekst en (optioneel) een publieke opmerking per seizoen
const REEKSEN = [
  {
    id: "holsbeek", bestand: "holsbeek-sessies.json", titel: "Holsbeek Sessies", kaart: ["holsbeek", "sessies"],
    intro: "Sinds 2019 programmeert WESP in opdracht van de gemeente Holsbeek concerten in het Buurthuis van Nieuwrode, later ook kerkconcerten in Kortrijk-Dutsel, junior- en schoolsessies en wandelsessies.",
    link: "https://www.holsbeeksessies.be",
  },
  {
    id: "limburg", bestand: "limburg-sessies.json", titel: "Limburg Sessies", kaart: ["limburg", "sessies"],
    intro: "Sinds 2025 brengen de Limburg Sessies folk en wereldmuziek naar bijzondere plekken in Limburg, van de Academiezaal in Sint-Truiden tot de Abdijsite Herkenrode.",
    link: "https://www.limburgsessies.be",
  },
  {
    id: "park", bestand: "park-festival.json", titel: "PARK Festival", kaart: ["park", "festival"],
    intro: "Rond 11 juli programmeert WESP in opdracht van stad Leuven en de Abdij van Park een gratis festival met folk en wereldmuziek in en rond de abdij. Tot 2022 als Vlaanderen Feest, sinds 2023 als PARK, en sinds 2026 met de PARK Sessies in juni.",
    noten: { "2021": "Vlaanderen Feest in de Abdij van Park", "2022": "Vlaanderen Feest in de Abdij van Park", "2023": "Eerste editie als PARK", "2025": "Eenmalig in de Abdij van Vlierbeek" },
  },
  {
    id: "beleuvenissen", bestand: "beleuvenissen-hogeschoolplein.json", titel: "Beleuvenissen op het Hogeschoolplein", kaart: ["beleuvenissen", ""],
    intro: "Sinds 2017 maakt WESP van het Hogeschoolplein in Leuven tijdens de zomerse Beleuvenissen een luisterplein: gratis vrijdagavonden met folk en wereldmuziek.",
  },
  {
    id: "producties", bestand: "extras.json", titel: "Andere producties", perReeks: true,
    intro: "Daarnaast maakte WESP eigen producties en kleine reeksen: met de Folkwaarts-partners in de Meroderegio, solo in kapellen, en rond de muziek van de steden.",
  },
];

const vandaag = new Date().toISOString().slice(0, 10);
const uit = [];
for (const r of REEKSEN) {
  const bron = JSON.parse(await fs.readFile(path.join(IN, r.bestand), "utf8"));
  const kaarten = [];
  for (const s of bron.seizoenen) {
    const concerten = s.concerten
      .filter(c => !c.afgelast && c.datum && c.datum <= vandaag)
      .map(c => ({ datum: c.datum, artiest: c.artiest, plek: c.kerk, ...(c.video ? { video: c.video } : {}) }))
      .sort((a, b) => a.datum.localeCompare(b.datum));
    if (!concerten.length) continue;
    const kaart = { seizoen: s.seizoen, concerten };
    if (r.perReeks) kaart.titel = s.reeks.replace(/^Folkwaarts – /, "");
    if (r.perReeks && s.reeks.startsWith("Folkwaarts")) {
      // Eén productie op verschillende plekken: de beschrijving één keer bovenaan, per datum enkel de plek
      const t = kaart.titel;
      const beschrijving = concerten.map(c => c.artiest.match(new RegExp(`^${t} \\((.*)\\)$`))?.[1]).find(Boolean);
      kaart.noot = beschrijving ? `Folkwaarts: ${beschrijving}` : "Folkwaarts";
      for (const c of concerten) {
        if (c.artiest.startsWith(`${t} (`)) c.artiest = "";
        else if (c.artiest.startsWith("Wandelsessie")) c.artiest = "Wandelsessie van de Holsbeek Sessies";
      }
    }
    if (r.noten?.[s.seizoen]) kaart.noot = r.noten[s.seizoen];
    kaarten.push(kaart);
  }
  // Nieuwste eerst, zoals bij de kerkconcerten
  kaarten.sort((a, b) => b.concerten[0].datum.localeCompare(a.concerten[0].datum));
  const { bestand, noten, perReeks, ...meta } = r;
  uit.push({ ...meta, kaarten });
}
await fs.writeFile(UIT, JSON.stringify(uit, null, 2) + "\n");
console.log(`archief.json: ${uit.map(r => `${r.titel} ${r.kaarten.length}`).join(", ")}`);

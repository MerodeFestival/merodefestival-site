// Maakt de overzichten op basis van site/data/producties.json (uit Notion, database "Producties (website)"):
//  - kijk-en-luister.html: voor het publiek, per soort media (video’s, albums, podcast, films)
//  - samenwerken.html met drie doelgroeppagina’s: voor-muzikanten.html (residenties en premières),
//    voor-programmatoren.html (creaties om te boeken, Soort "Podiumproductie") en voor-gemeenten.html
//    (formules, Soort "Concept op maat", en luisterplekken, Soort "Installatie")
//  - per item een pagina site/<webadres>.html
// Zo volgt de site het beleidsplan 2028–2032: WESP presenteert en laat werk maken voor zijn podia,
// de muzikant blijft maker en producent. Het woord "producties" staat niet meer op de site.
// Wordt aangeroepen door build-pages.mjs.

import fs from "node:fs/promises";
import path from "node:path";
import { T } from "./teksten.mjs";

const SOORTEN = [
  { naam: "Podiumproductie", id: "podium", titel: "Podiumproducties", meer: "Bekijk de productie →", praktisch: "Praktisch",
    intro: "Concerten en voorstellingen voor cultuurcentra, festivals en bijzondere locaties." },
  { naam: "Installatie", id: "installaties", titel: "Installaties", meer: "Bekijk de installatie →", praktisch: "Praktisch",
    intro: "Muziek en beeld die een plek een verhaal geven, op erfgoedsites en in natuurdomeinen." },
  { naam: "Playlist", id: "playlists", titel: "Playlists", meer: "Bekijk de playlist →", praktisch: "Over deze playlist",
    intro: "Albums en playlists die Merodefestival mee maakte, om te beluisteren en te bestellen." },
  { naam: "Concept op maat", id: "concepten", titel: "Concepten op maat", meer: "Bekijk het concept →", praktisch: "Praktisch",
    intro: "Concepten die je bij ons kunt boeken, uitgewerkt op jouw plek." },
];
const POSITIE = { boven: "center top", onder: "center bottom", links: "left center", rechts: "right center" };

export async function bouwProducties({ ROOT, SITE, S, esc, kopEd, voetEd }) {
  let lijst;
  try { lijst = JSON.parse(await fs.readFile(path.join(ROOT, "data/producties.json"), "utf8")); }
  catch { console.log("Geen producties gevonden."); return []; }
  lijst = lijst.filter(p => p.slug && p.titel);
  if (!lijst.length) { console.log("Geen producties met webadres: sla productiepagina’s over."); return []; }

  // Een tekst met lege regels wordt een reeks alinea’s
  const alinea = t => esc(t).split(/\n{2,}/).map(x => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("");

  // Elk item staat op /<webadres>; een verborgen item staat niet in een overzicht en niet in de zoekmachines
  const bestand = p => `${p.slug}.html`;
  // Oude adressen (productie-*.html, producties.html) opruimen: ze worden doorverwezen (omleidingen.mjs)
  for (const f of await fs.readdir(ROOT)) if (/^productie-.+\.html$/.test(f) || f === "producties.html") await fs.rm(path.join(ROOT, f), { force: true });
  const soortVan = p => (SOORTEN.find(s => s.naam === p.soort) || SOORTEN[0]).naam;
  const br = t => esc(t).replace(/\n/g, "<br>");
  const transp = f => /\.png$/i.test(f || "");

  // ---------- spelers en video's ----------
  const ytId = u => (u.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/) || [])[1];
  const vimeo = u => {
    const m = String(u || "").match(/vimeo\.com\/(?:video\/|channels\/[\w-]+\/)?(\d{6,})(?:\/([0-9a-f]{8,}))?/);
    if (!m) return null;
    const h = m[2] || (u.match(/[?&]h=([0-9a-f]+)/) || [])[1];
    return { id: m[1], h };
  };
  // Vimeo: miniatuur en verborgen deel opzoeken bij Vimeo. Een link met een eigen naam
  // (vimeo.com/naam/video) volgen we tot het nummer. Lukt dat niet, dan bouwen we gewoon verder.
  const VIMEO = {};
  const vimeoLinks = [...new Set(lijst.flatMap(p => (p.videos || []).map(v => v.url)).filter(u => /vimeo\.com\//.test(u || "")))];
  await Promise.all(vimeoLinks.map(async u => {
    let vm = vimeo(u), thumb = "";
    try {
      if (!vm) vm = vimeo((await fetch(u, { redirect: "follow" })).url);
      const r = await fetch("https://vimeo.com/api/oembed.json?width=640&url=" +
        encodeURIComponent(vm ? `https://vimeo.com/${vm.id}${vm.h ? "/" + vm.h : ""}` : u));
      const o = r.ok ? await r.json() : {};
      if (!vm && o.video_id) vm = { id: String(o.video_id) };
      if (vm && !vm.h) vm.h = (String(o.html || "").match(/[?&;]h=([0-9a-f]{6,})/) || [])[1];
      thumb = o.thumbnail_url || "";
    } catch (err) { console.warn(`Vimeo-link ${u} niet opgezocht: ${err.message}`); }
    if (vm) VIMEO[u] = { ...vm, thumb };
  }));

  const video = v => {
    const t = v.titel || "";
    const label = esc(T("algemeen.speel-video", "Speel video af") + (t ? ": " + t : ""));
    const tekst = t ? `<p class="vtitel">${esc(t)}</p>` : "";
    const yt = ytId(v.url);
    if (yt) return `<div class="vblok"><div class="video"><button class="yt" type="button" data-id="${yt}" aria-label="${label}" style="background-image:url(https://i.ytimg.com/vi/${yt}/hqdefault.jpg)"><span class="play" aria-hidden="true"></span></button></div>${tekst}</div>`;
    const vm = VIMEO[v.url] || vimeo(v.url);
    if (vm) return `<div class="vblok"><div class="video"><button class="yt" type="button" data-vimeo="${vm.id}"${vm.h ? ` data-h="${vm.h}"` : ""} aria-label="${label}"${vm.thumb ? ` style="background-image:url(${esc(vm.thumb)})"` : ""}><span class="play" aria-hidden="true"></span></button></div>${tekst}</div>`;
    return `<div class="vblok"><p><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(t || v.url)} ↗</a></p></div>`;
  };
  const allow = 'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"';
  const spotify = (u, titel) => {
    const m = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
    if (!m) return "";
    const hoogte = ["track", "episode"].includes(m[1]) ? 152 : 352;
    return `<iframe class="speler" src="https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator" title="${esc(T("algemeen.op-spotify", "{titel} op Spotify").replace("{titel}", titel))}" width="100%" height="${hoogte}" loading="lazy" ${allow}></iframe>`;
  };
  const soundcloud = (u, titel) =>
    `<iframe class="speler" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}&amp;color=%23e8761a&amp;visual=false" title="${esc(T("algemeen.op-soundcloud", "{titel} op SoundCloud").replace("{titel}", titel))}" width="100%" height="450" loading="lazy" allow="autoplay"></iframe>`;

  // ---------- tekst uit Notion (blokken) ----------
  const tekstHtml = blokken => {
    const uit = [];
    for (let i = 0; i < (blokken || []).length; i++) {
      const b = blokken[i];
      if (b.type === "ul" || b.type === "ol") {
        const items = [b];
        while (blokken[i + 1]?.type === b.type) items.push(blokken[++i]);
        uit.push(`<${b.type} class="${b.type === "ul" ? "lijst" : "nrs lijst"}">${items.map(x => `<li>${x.html}</li>`).join("")}</${b.type}>`);
      } else if (b.type === "quote") uit.push(`<blockquote>${b.html}</blockquote>`);
      else uit.push(`<${b.type}>${b.html}</${b.type}>`);
    }
    return uit.join("\n      ");
  };

  // ---------- gemeenschappelijke pagina-opmaak ----------
  const pagina = ({ titel, beschrijving, naam, afbeelding, body, verborgen }) => {
    let kop = kopEd
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(titel)} | Merodefestival</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(beschrijving)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}/${naam.replace(/\.html$/, "")}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(titel)}">`)
      .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${/^https?:\/\//.test(afbeelding) ? afbeelding : `${SITE}/${afbeelding}`}">`)
      .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="css/producties.css">');
    if (verborgen) kop = kop.replace("</head>", '<meta name="robots" content="noindex">\n</head>');
    return kop + "<main>" + body + "\n</main>" + voetEd;
  };

  // ---------- overzichtspagina’s ----------
  const kaart = (p, meer, href) => {
    const pos = p.positie || POSITIE[p.uitsnede];
    const stijl = pos ? ` style="object-position:${pos}"` : "";
    const klasse = p.uitsnede === "volledig tonen" ? ` class="contain"` : transp(p.foto) ? ` class="transp"` : "";
    const beeld = p.foto
      ? `<img src="${esc(p.foto)}"${klasse}${stijl} alt="${esc(p.alt ?? p.titel)}" width="640" height="480" loading="lazy">`
      : `<span class="ph">${esc(p.titel)}</span>`;
    return `<li><a class="kaart" href="${href || bestand(p)}">${beeld}${p.label ? `<span class="klabel">${esc(p.label)}</span>` : ""}<span class="ktitel">${esc(p.titel)}</span>${p.makers ? `<span class="kmakers">${esc(p.makers)}</span>` : ""}<span class="ktekst">${esc(p.tekst)}</span><span class="kmeer">${esc(meer)}</span></a></li>`;
  };
  const zichtbaar = naam => lijst.filter(p => !p.verborgen && soortVan(p) === naam);
  // Beelden uit de beeldbank (beeld.merodefestival.be); de beschrijving staat in Teksten (sleutel beeld.<naam>)
  const BEELD = "https://beeld.merodefestival.be/merodefestival/";
  const FOTO = {
    "home-kerk": "Vier muzikanten spelen voor een verlicht barokaltaar in een dorpskerk",
    "home-ovatie": "Muzikanten nemen applaus in ontvangst op een openluchtpodium bij avond",
    "home-duo": "Een zangeres met viool en een accordeoniste spelen dicht tegen elkaar aan in blauw licht",
    "home-altaar": "Twee muzikanten met viool en harp onder een hoog verlicht altaar",
    "2026-cavez-montanaro-boom": "Violist en accordeoniste spelen samen aan de voet van een grote boom langs een wandelpad",
    "318184-805557": "Wandelaars luisteren naar muzikanten in een kerkruïne",
    "2026-citadel-publiek": "Volle tribune voor het openluchtpodium in de Citadel van Diest",
    "726393-846860": "Band groet arm in arm het publiek",
    "763186-922168": "Groot ensemble onder een roze tentdoek voor publiek",
    "671301-201421": "Ensemble onder een oranje tentdoek voor vol publiek",
    "merode-nl-inpsik": "Publiek bij een concert in een begroeide kerkruïne",
    "2026-watermolen-wandelaars": "Wandelaars steken een brugje over naast een oude watermolen",
    "268829-462342": "Kwartet speelt voor het altaar in een volle kapel",
    "631059-834612": "Groot publiek op een binnenplein voor een historisch gebouw",
  };
  const POS = { "268829-462342": "center 45%" };
  const foto = naam => ({ src: BEELD + naam + ".webp", alt: T(`beeld.${naam}`, FOTO[naam] || ""), pos: POS[naam] });
  const img = (f, extra = "") => `<img src="${esc(f.src)}" alt="${esc(f.alt)}"${f.pos ? ` style="object-position:${f.pos}"` : ""} width="900" height="675"${extra}>`;
  const fotoband = (...namen) => `<div class="galerij3 fotoband">${namen.map(n => `<figure>${img(foto(n), ' loading="lazy"')}</figure>`).join("")}</div>`;
  const hero = (label, titel, intro, beeldnaam) => beeldnaam ? `
  <section class="chero ov-hero">
    <div class="wrap">
      <div class="chero-tekst">
        <p class="label datumregel">${esc(label)}</p>
        <h1>${esc(titel)}</h1>
        ${alinea(intro).replace(/<p>/g, '<p class="lead">')}
      </div>
      <figure class="cbeeld foto">${img(foto(beeldnaam), ' fetchpriority="high"')}</figure>
    </div>
  </section>` : `
  <section class="pr-hero">
    <div class="wrap" style="display:block">
      <p class="label">${esc(label)}</p>
      <h1>${esc(titel)}</h1>
      ${alinea(intro)}
    </div>
  </section>`;
  const regels = (sleutel, standaard) => T(sleutel, standaard).split(/\n+/).map(r => r.trim()).filter(Boolean).map(r => {
    const [k, ...rest] = r.split("|");
    return { kop: k.trim(), tekst: rest.join("|").trim() };
  });
  const blok = (id, kop, inhoud, intro) => `<section class="rs-blok"${id ? ` id="${id}"` : ""}><h2>${esc(kop)}</h2>${intro ? `<p class="soort-intro">${esc(intro)}</p>` : ""}${inhoud}</section>`;
  const sectie = inhoud => `
  <section class="papier pr-sectie">
    <div class="wrap">
      ${inhoud}
    </div>
  </section>`;
  const MAIL = "jochen@wespvzw.be";
  const mailKnop = (tekst, onderwerp, ghost) => `<a class="btn${ghost ? " ghost" : ""}" href="mailto:${MAIL}?subject=${encodeURIComponent(onderwerp)}">${esc(tekst)}</a>`;
  const actie = (kop, tekst, knoppen) => `<section class="rs-blok rs-actie"><h2>${esc(kop)}</h2>${tekst ? `<p>${esc(tekst)}</p>` : ""}<div class="acties">${knoppen}</div></section>`;
  const schrijf = async (naam, titel, beschrijving, body, afbeelding) =>
    fs.writeFile(path.join(ROOT, naam), pagina({ titel, naam, beschrijving, body, afbeelding: afbeelding || S.artwork }));

  // Gegevens uit “Over WESP (website)”: opdrachtgevers en residenties per jaar
  let wesp = [];
  try { wesp = JSON.parse(await fs.readFile(path.join(ROOT, "data/wesp.json"), "utf8")); } catch { /* geen gegevens */ }
  const opdrachtgevers = wesp.filter(r => r.soort === "Opdrachtgever").map(r => `${esc(r.titel)}${r.tekst ? ` (${esc(r.tekst)})` : ""}`).join(", ");
  const jaren = wesp.filter(r => r.soort === "Jaar" && r.titel && r.tekst).sort((a, b) => String(b.titel).localeCompare(String(a.titel)));

  // Oude overzichten van eerdere voorstellen opruimen
  for (const f of ["luisteren-en-kijken.html", "residenties.html"]) await fs.rm(path.join(ROOT, f), { force: true });

  // ===== 1. Kijk en luister: voor het publiek, per soort media =====
  const kijkTitel = T("kijk.titel", "Kijk en luister");
  const playlists = zichtbaar("Playlist");
  const isPodcast = p => /podcast/i.test(`${p.titel} ${p.label}`);
  const podcasts = playlists.filter(isPodcast);
  const albums = playlists.filter(p => !isPodcast(p) && ((p.spotify || []).length || (p.soundcloud || []).length));
  const films = playlists.filter(p => !isPodcast(p) && !albums.includes(p) && (p.videos || []).length);
  const BASIS_YT = "https://www.youtube.com/watch?v=";
  let edities = [];
  try { edities = JSON.parse(await fs.readFile(path.join(ROOT, "data/edities.json"), "utf8")); } catch { /* geen gegevens */ }
  const laatste = edities.filter(e => (e.videos || []).length).sort((a, b) => b.jaar - a.jaar)[0];
  const festivalVideos = laatste ? laatste.videos.slice(0, 6).map(id => video({ url: BASIS_YT + id, titel: `Merodefestival ${laatste.jaar}` }).replace(/<p class="vtitel">[^<]*<\/p>/, "")) : [];
  const abdij = albums.find(p => (p.videos || []).length > 2);
  const abdijVideos = abdij ? abdij.videos.slice(0, 6).map(video) : [];
  const meer = (href, tekst) => `<p class="kl-meer"><a href="${href}">${esc(tekst)}</a></p>`;
  const speler = p => [...(p.spotify || []).slice(0, 1).map(u => spotify(u, p.titel)), ...(p.soundcloud || []).slice(0, 1).map(u => soundcloud(u, p.titel))].filter(Boolean)[0] || "";
  const mediaBeeld = p => p.foto ? `<a class="kl-beeld${transp(p.foto) ? " transp" : ""}" href="${bestand(p)}" tabindex="-1" aria-hidden="true"><img src="${esc(p.foto)}" alt="" width="640" height="400" loading="lazy"></a>` : "";
  const mediaKaart = (p, inhoud) => `<article class="kl-item">${mediaBeeld(p)}<p class="klabel">${esc(p.label)}</p><h3>${esc(p.titel)}</h3>${p.makers ? `<p class="kmakers">${esc(p.makers)}</p>` : ""}<p>${esc(p.tekst)}</p>${inhoud}${meer(bestand(p), T("kijk.meer-over", "Meer hierover →"))}</article>`;
  // Uitzendingen op Klara: één per regel, als "label | titel | tekst | link" (Teksten › kijk.klara.lijst)
  const klara = T("kijk.klara.lijst", "Klara in concert, 18 november 2026 | Amber Haddad Trio en Simon Leleux & Manuel Hermia | Hun dubbelconcert in de Sint-Luciakerk van Engsbergen (17 oktober 2026), exclusief opgenomen door Klara: oud, contrabas, bansuri, saxofoon en percussie, tussen jazz en Arabische en Indiase tradities. | https://www.vrt.be/vrtmax/luister/radio/k/klara-in-concert~31-229/klara-in-concert~31-32819-0/")
    .split(/\n+/).map(r => r.split("|").map(x => x.trim())).filter(r => r.length >= 4 && /^https?:/.test(r[3])).map(([label, titel, tekst, link, beeld]) => ({ label, titel, tekst, link, beeld }));
  // Beeld bij een uitzending: een vijfde veld, anders de foto of video van het concert in de Agenda met dezelfde naam
  let agenda = [];
  try { agenda = JSON.parse(await fs.readFile(path.join(ROOT, "data/agenda.json"), "utf8")); } catch { /* geen gegevens */ }
  for (const k of klara) {
    if (k.beeld) continue;
    const e = agenda.find(a => a.artist && (a.artist.toLowerCase().includes(k.titel.toLowerCase().slice(0, 16)) || k.titel.toLowerCase().includes(a.artist.toLowerCase().slice(0, 16))));
    if (!e) continue;
    const yt = (e.videos || []).map(ytId).find(Boolean);
    k.beeld = e.foto || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : "");
    k.concert = `concert/${e.slug}.html`;
  }
  const KL = [
    (festivalVideos.length || abdijVideos.length) && ["videos", T("kijk.videos.titel", "Video’s"), T("kijk.videos.intro", "Concerten zoals ze klonken op onze plekken, vastgelegd door onze eigen technici."),
      `${festivalVideos.length ? `<h3 class="kl-sub">${esc(T("kijk.videos.festival", "Op het Merodefestival"))} ${laatste.jaar}</h3><div class="pvideos kl-videos">${festivalVideos.join("")}</div>` : ""}
       ${abdijVideos.length ? `<h3 class="kl-sub">${esc(abdij.titel)}</h3><div class="pvideos kl-videos">${abdijVideos.join("")}</div>${meer(bestand(abdij), T("kijk.videos.abdij-meer", "Alle opnames uit de abdij →"))}` : ""}
       <p class="kl-meer"><a href="https://www.youtube.com/channel/UCahKa1lM3yaWEwXdV_bBJdw" target="_blank" rel="noopener">${esc(T("kijk.videos.youtube", "Alle video’s op ons YouTube-kanaal"))} ↗</a> · <a href="vorige-edities.html">${esc(T("kijk.videos.edities", "Video’s per festivaleditie"))} →</a></p>`],
    klara.length && ["klara", T("kijk.klara.titel", "Op Klara"), T("kijk.klara.intro", "Klara neemt geregeld concerten op bij ons en zendt ze uit in Klara in concert. Herbeluister ze op VRT MAX."),
      `<div class="kl-klara-kop"><img class="kl-logo" src="${BEELD}253924-807552.webp" alt="Klara" width="56" height="59" loading="lazy"></div>
       <ul class="kl-klara">${klara.map(k => `<li><a href="${esc(k.link)}" target="_blank" rel="noopener">${k.beeld ? `<img src="${esc(k.beeld)}" alt="" width="480" height="270" loading="lazy">` : ""}<span class="klabel">${esc(k.label)}</span><span class="ktitel">${esc(k.titel)}</span><span class="ktekst">${esc(k.tekst)}</span><span class="kmeer">${esc(T("kijk.klara.knop", "Luister op VRT MAX"))} ↗</span></a></li>`).join("")}</ul>
       <p class="kl-meer"><a href="https://www.vrt.be/vrtmax/luister/radio/k/klara-in-concert~31-229/" target="_blank" rel="noopener">${esc(T("kijk.klara.programma", "Alle afleveringen van Klara in concert"))} ↗</a></p>`],
    albums.length && ["albums", T("kijk.albums.titel", "Albums en playlists"), T("kijk.albums.intro", "Muziek die op onze plekken ontstond, om thuis te beluisteren."),
      `<div class="kl-lijst">${albums.map(p => mediaKaart(p, speler(p))).join("")}</div>`],
    podcasts.length && ["podcast", T("kijk.podcast.titel", "Podcast"), T("kijk.podcast.intro", "Muzikanten vertellen onderweg over hun muziek, hun traditie en de plek."),
      `<div class="kl-lijst">${podcasts.map(p => mediaKaart(p, speler(p))).join("")}</div>`],
    films.length && ["films", T("kijk.films.titel", "Films"), T("kijk.films.intro", "Korte documentaires over muziek, mensen en plekken in de Merode."),
      films.map(p => `<article class="kl-item kl-breed">${mediaBeeld(p)}<p class="klabel">${esc(p.label)}</p><h3>${esc(p.titel)}</h3>${p.makers ? `<p class="kmakers">${esc(p.makers)}</p>` : ""}<p>${esc(p.tekst)}</p><div class="pvideos kl-videos">${p.videos.map(video).join("")}</div>${meer(bestand(p), T("kijk.meer-over", "Meer hierover →"))}</article>`).join("")],
  ].filter(Boolean);
  await schrijf("kijk-en-luister.html", kijkTitel,
    T("kijk.beschrijving", "Video’s, albums, een podcast en films van Merodefestival: folk- en wereldmuziek zoals ze klonk in abdijen, kerken en het landschap van de Merode."),
    hero(T("kijk.label", "Thuis herbeleven"), kijkTitel, T("kijk.intro", "Concerten, albums, een podcast en films: muziek zoals ze klonk in abdijen, kerken, kapellen en het landschap. Om thuis te herbeleven, of om te ontdekken voor je komt luisteren."), "home-kerk") +
    sectie(`${KL.length > 1 ? `<nav class="kl-nav" aria-label="${esc(T("algemeen.op-deze-pagina", "Op deze pagina"))}">${KL.map(([id, t]) => `<a href="#${id}">${esc(t)}</a>`).join("")}</nav>` : ""}
      ${KL.map(([id, t, intro, inhoud]) => blok(id, t, inhoud, intro)).join("\n      ")}`));

  // ===== 2. Samenwerken: drie deuren =====
  const creaties = zichtbaar("Podiumproductie");
  const formules = zichtbaar("Concept op maat");
  const luisterplekken = zichtbaar("Installatie");
  const DEUREN = [
    { naam: "voor-muzikanten.html", titel: T("samen.muzikanten.titel", "Voor muzikanten"),
      tekst: T("samen.muzikanten.kort", "Maak nieuw werk op een plek die je inspireert, en speel het daarna voor een publiek dat echt luistert."),
      foto: "https://beeld.merodefestival.be/merodefestival/home-trio.webp", alt: T("wesp.foto-muzikanten", "Drie muzikanten spelen in een kapel") },
    { naam: "voor-programmatoren.html", titel: T("samen.programmatoren.titel", "Voor festivals en cultuurcentra"),
      tekst: T("samen.programmatoren.kort", "Drie creaties die bij ons in première gingen en nu op tournee zijn. Bekijk ze en boek ze rechtstreeks bij ons."),
      foto: "https://beeld.merodefestival.be/merodefestival/2026-citadel-publiek.webp", alt: T("samen.programmatoren.alt", "Volle tribune voor het festivalpodium in de Citadel van Diest") },
    { naam: "voor-gemeenten.html", titel: T("samen.gemeenten.titel", "Voor gemeenten, kerkfabrieken en erfgoedsites"),
      tekst: T("samen.gemeenten.kort", "Een kapel, kerk of erfgoedsite die om muziek vraagt? Wij brengen de muzikanten, de techniek en de organisatie mee."),
      foto: "https://beeld.merodefestival.be/merodefestival/268829-462342.webp", positie: "center 45%", alt: T("samen.gemeenten.alt", "Kwartet speelt voor het altaar in een volle kapel") },
  ];
  const samenTitel = T("samen.titel", "Samenwerken");
  await schrijf("samenwerken.html", samenTitel,
    T("samen.beschrijving", "Samenwerken met WESP, het huis achter Merodefestival: voor muzikanten, voor festivals en cultuurcentra, en voor gemeenten, kerkfabrieken en erfgoedsites."),
    hero(T("samen.label", "Met WESP"), samenTitel, T("samen.intro", "Muzikant, programmator of gemeente? Kies je deur. Achter elke deur lees je wat we samen kunnen doen en met wie je contact opneemt."), "home-ovatie") +
    sectie(`<ul class="kaarten sw-deuren">${DEUREN.map(d => kaart({ titel: d.titel, tekst: d.tekst, foto: d.foto, positie: d.positie, alt: d.alt }, T("samen.verder", "Verder →"), d.naam)).join("")}</ul>
      ${opdrachtgevers ? `<p class="rs-noot sw-ref"><strong>${esc(T("wesp.opdrachtgevers.kop", "Zij werkten al met ons samen:"))}</strong> ${opdrachtgevers}.</p>` : ""}`));

  // Kleine navigatie tussen de drie deuren, bovenaan elke doelgroeppagina
  const deurNav = huidig => `<nav class="kl-nav sw-nav" aria-label="${esc(samenTitel)}"><a href="samenwerken.html">${esc(samenTitel)}</a>${DEUREN.map(d => `<a href="${d.naam}"${d.naam === huidig ? ' aria-current="page" class="actief"' : ""}>${esc(d.titel)}</a>`).join("")}</nav>`;

  // ===== 2a. Voor muzikanten =====
  const stappen = regels("samen.muzikanten.stappen", [
    "Een gesprek | Je vertelt wat je wilt maken. Wij zoeken de plek die erbij past.",
    "Een week residentie | In een abdij, een museum of het landschap, met verblijf en techniek.",
    "De première | Op een van onze festivals of reeksen, opgenomen in beeld en geluid, met programmatoren in de zaal.",
    "Verder spelen | Bij ons en elders. Als je dat wilt, boeken wij je creatie mee.",
  ].join("\n"));
  const plekken = regels("residenties.plekken", [
    "Abdij van Park, Leuven | Duo’s en solisten werken aan nieuw repertoire, met een première op Park Festival of tijdens de Park Sessies.",
    "Abdij van Averbode | Vrouwenstemmen onder de abdijgewelven, met een concert ter plaatse.",
    "In samenwerking met Muziekmuseum Vleeshuis, Antwerpen | Elke creatie vertrekt van een instrument of een verhaal uit de collectie van het museum. De plek van de residentie ligt nog niet vast.",
    "De Vijver Wolfsdonk | Muziek die vertrekt vanuit de natuur van het landschapspark, met een première op het Merodefestival.",
    "Een groot vakantiehuis in Landschapspark de Merode | Een Vlaamse maker ontmoet een internationale gast, met een première op het Merodefestival.",
  ].join("\n"));
  // Residenties per jaar (Over WESP › Soort "Jaar"): één regel per residentie,
  // "Naam | wat | waar het te horen was | links". Links: komma-gescheiden, een video (YouTube/Vimeo) of "Label=adres".
  // Een regel zonder | blijft gewone tekst.
  const residenties = tekst => String(tekst || "").split(/\n+/).map(r => r.trim()).filter(Boolean).map(regel => {
    const [naam, wat = "", waar = "", links = ""] = regel.split("|").map(x => x.trim());
    const lijst = links.split(/,\s*(?=(?:[^=,]+=)?https?:)/).map(x => x.trim()).filter(Boolean).map(x => {
      const m = x.match(/^([^=]+)=(https?:.*)$/);
      return m ? { label: m[1].trim(), url: m[2].trim() } : { url: x };
    });
    const vids = lijst.filter(l => !l.label && (ytId(l.url) || vimeo(l.url)));
    const anders = lijst.filter(l => !vids.includes(l));
    const eigen = u => u.replace(/^https:\/\/www\.merodefestival\.be\//, "").replace(/^([\w-]+)$/, "$1.html");
    const extern = u => /^https?:/.test(eigen(u));
    const hoofd = vids[0] ? video({ url: vids[0].url, titel: naam }).replace(/<p class="vtitel">[^<]*<\/p>/, "") : "";
    const knoppen = [...anders.map(l => `<a href="${esc(eigen(l.url))}"${extern(l.url) ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)}${extern(l.url) ? " ↗" : " →"}</a>`)];
    return `<li class="${hoofd ? "met-video" : "zonder-video"}">${hoofd}<p class="rs-naam">${esc(naam)}</p>${wat ? `<p class="rs-wat">${esc(wat)}</p>` : ""}${waar ? `<p class="rs-waar">${esc(waar)}</p>` : ""}${knoppen.length ? `<p class="rs-links">${knoppen.join(" ")}</p>` : ""}</li>`;
  }).join("");
  const muzTitel = DEUREN[0].titel;
  await schrijf("voor-muzikanten.html", muzTitel,
    T("samen.muzikanten.beschrijving", "Residenties en premières bij WESP en Merodefestival: muzikanten maken nieuw werk voor onze plekken en vinden bij ons een vaste podiumpartner."),
    hero(muzTitel, T("samen.muzikanten.kop", "Een samenwerking, geen boeking"),
      T("samen.muzikanten.intro", "Jij hebt een idee, wij hebben de plekken: abdijen, kapellen, een muziekmuseum en het landschap van de Merode. Je werkt er een week in residentie, speelt de première op een van onze podia en daarna verder, bij ons en elders. Alles begint met een gesprek, niet met een contract."), "home-duo") +
    sectie(`${deurNav("voor-muzikanten.html")}
      ${blok("residenties", T("residenties.stappen.kop", "Van residentie tot première, en verder"),
        `<ol class="rs-stappen">${stappen.map(s => `<li><h3>${esc(s.kop)}</h3><p>${esc(s.tekst)}</p></li>`).join("")}</ol>
        ${fotoband("2026-cavez-montanaro-boom", "home-altaar", "318184-805557")}`)}
      ${blok("makersplekken", T("residenties.plekken.kop", "Onze makersplekken"), `<dl class="rs-plekken">${plekken.map(s => `<div><dt>${esc(s.kop)}</dt><dd>${esc(s.tekst)}</dd></div>`).join("")}</dl>`)}
      ${jaren.length ? blok("in-residentie", T("samen.muzikanten.jaren", "Wie er al bij ons in residentie was"),
        jaren.map(r => `<div class="rs-jaar"><h3>${esc(r.titel)}</h3><ul class="rs-res">${residenties(r.tekst)}</ul></div>`).join("")) : ""}
      ${actie(T("samen.muzikanten.actie", "Vertel ons je plannen"), T("samen.muzikanten.contact", "Stuur ons een paar zinnen over je plan en een link naar je muziek. We lezen alles, maar kunnen niet op elk voorstel ingaan. Vaak nodigen we zelf muzikanten uit, wanneer plek, moment en muziek samenvallen."),
        mailKnop(T("wesp.muzikanten.knop", "Vertel ons je plannen"), "Projectvoorstel"))}`));

  // ===== 2b. Voor festivals en cultuurcentra =====
  const progTitel = DEUREN[1].titel;
  await schrijf("voor-programmatoren.html", progTitel,
    T("samen.programmatoren.beschrijving", "Creaties die voor de podia van Merodefestival en WESP ontstonden en nu op tournee zijn, om te boeken voor festivals en cultuurcentra."),
    hero(samenTitel, progTitel, T("samen.programmatoren.intro", "Drie creaties, gemaakt voor onze podia en klaar voor het jouwe. Je boekt ze rechtstreeks bij ons: wij maken de afspraken met de muzikanten."), "2026-citadel-publiek") +
    sectie(`${deurNav("voor-programmatoren.html")}
      ${creaties.length ? blok("creaties", T("residenties.creaties.kop", "Creaties om te boeken"), `<ul class="kaarten">${creaties.map(p => kaart(p, T("residenties.creaties.meer", "Bekijk en boek de creatie →"))).join("")}</ul>`) : ""}
      ${blok("live", T("samen.programmatoren.live.kop", "Zie ze eerst live"), alinea(T("samen.programmatoren.live", "Op het Merodefestival en Park Festival gaan nieuwe creaties in première. Programmatoren zijn er welkom: laat het ons weten, dan reserveren we een plaats.")) + fotoband("726393-846860", "763186-922168", "671301-201421"))}
      ${actie(T("samen.programmatoren.actie", "Een creatie boeken?"), T("samen.programmatoren.actie-tekst", "Op de pagina van elke creatie vind je bezetting, techniek en het contactadres. Vraag er een optie of de prospectiekaart aan."),
        mailKnop(T("samen.programmatoren.knop", "Neem contact op"), "Boeking creatie"))}`),
    creaties[0]?.foto);

  // ===== 2c. Voor gemeenten, kerkfabrieken en erfgoedsites =====
  const gemTitel = DEUREN[2].titel;
  await schrijf("voor-gemeenten.html", gemTitel,
    T("samen.gemeenten.beschrijving", "Muziek op jouw plek met WESP: formules voor gemeenten, kerkfabrieken en erfgoedsites, van Klanken in de kapel tot een festivaldag."),
    hero(samenTitel, gemTitel, T("samen.gemeenten.intro", "Heb je een kapel, een kerk of een erfgoedsite die om muziek vraagt? Wij brengen er folk- en wereldmuziek naartoe. Wij kiezen de muzikanten, zorgen voor techniek en organisatie, en jij geniet mee met je inwoners. Voor één avond, een reeks of een volledige festivaldag."), "merode-nl-inpsik") +
    sectie(`${deurNav("voor-gemeenten.html")}
      ${formules.length ? blok("formules", T("wesp.formules.kop", "Formules voor jouw plek"), `<ul class="kaarten">${formules.map(p => kaart(p, T("wesp.formules.meer", "Bekijk de formule →"))).join("")}</ul>`,
        T("wesp.formules.intro", "Wat we op onze eigen plekken doen, brengen we ook naar jouw plek. Wij zorgen voor de programmatie, de techniek en de omkadering; jij voor een plek die om muziek vraagt.")) : ""}
      ${fotoband("2026-watermolen-wandelaars", "268829-462342", "631059-834612")}
      ${luisterplekken.length ? blok("luisterplekken", T("samen.gemeenten.luisterplekken", "Luisterplekken"), `<ul class="kaarten">${luisterplekken.map(p => kaart(p, T("samen.gemeenten.luisterplekken-meer", "Bekijk de luisterplek →"))).join("")}</ul>`,
        T("samen.gemeenten.luisterplekken-intro", "Muziek en verhalen die blijven klinken op een erfgoedplek, ook buiten het concert.")) : ""}
      ${opdrachtgevers ? blok("referenties", T("samen.gemeenten.referenties", "Zij werkten al met ons samen"), `<p>${opdrachtgevers}.</p>`) : ""}
      ${actie(T("samen.gemeenten.actie", "Bespreek jouw plek"), T("samen.gemeenten.budget", "Wat het kost, hangt af van de plek en van wat je wilt. We maken samen een voorstel op maat."),
        mailKnop(T("wesp.organisatoren.knop", "Bespreek jouw locatie"), "Locatie voor muziek"))}`));

  // Waar een detailpagina naar terugverwijst
  const TERUG = {
    Playlist: ["kijk-en-luister.html", () => "← " + kijkTitel],
    Installatie: ["voor-gemeenten.html#luisterplekken", () => "← " + gemTitel],
    Podiumproductie: ["voor-programmatoren.html#creaties", () => "← " + progTitel],
    "Concept op maat": ["voor-gemeenten.html#formules", () => "← " + gemTitel],
  };

  // ---------- detailpagina’s ----------
  for (const p of lijst) {
    const g = SOORTEN.map(x => ({ ...x, praktisch: T(`soort.${x.id}.praktisch`, x.praktisch) })).find(x => x.naam === soortVan(p));
    const mail = `mailto:${p.contact || "info@merodefestival.be"}?subject=${encodeURIComponent(p.titel)}`;
    const knop = p.knoplink
      ? `<a class="btn" href="${esc(p.knoplink)}" target="_blank" rel="noopener">${esc(p.knop || T("producties.knop-standaard", "Vraag een optie"))}</a>`
      : `<a class="btn" href="${mail}">${esc(p.knop || T("producties.knop-standaard", "Vraag een optie"))}</a>`;
    const hero = p.foto
      ? `<figure class="cbeeld foto${transp(p.foto) ? " transp" : ""}"><img src="${esc(p.foto)}" alt="${esc(p.titel)}"></figure>`
      : `<figure class="cbeeld"><img src="${esc(S.artwork)}" alt=""></figure>`;
    const V = (sleutel, standaard) => T(`veld.${sleutel}`, standaard);
    const feiten = [[V("waar", "Waar"), p.waar], [V("vorm", "Vorm"), p.vorm], [V("speelduur", "Speelduur"), p.speelduur], [V("periode", "Periode"), p.periode],
      [V("bezetting", "Bezetting"), p.bezetting], [V("techniek", "Techniek"), p.techniek], [V("geschikt", "Geschikt voor"), p.geschikt], [V("prijs", "Prijs"), p.prijs]].filter(f => f[1]);
    const spelers = [
      ...(p.spotify || []).map(u => spotify(u, p.titel)),
      ...(p.soundcloud || []).map(u => soundcloud(u, p.titel)),
    ].filter(Boolean).join("\n        ");
    const videos = (p.videos || []).map(video).join("");
    const luister = spelers || videos
      ? `<section class="luister"><h2 class="label">${esc(T("producties.luister", "Kijk en luister"))}</h2>${spelers}${videos ? `<div class="pvideos">${videos}</div>` : ""}</section>`
      : "";
    const reeks = (p.fotos || []).length
      ? `<div class="galerij3${p.fotos.length < 3 ? " twee" : ""}">${p.fotos.map(f => `<figure><img src="${esc(f)}" alt="${esc(p.titel)}" loading="lazy"></figure>`).join("")}</div>`
      : "";
    const body = `
  <section class="chero">
    <div class="wrap">
      <div class="chero-tekst">
        <a class="terug" href="${TERUG[soortVan(p)][0]}">${esc(TERUG[soortVan(p)][1]())}</a>
        <p class="label datumregel">${esc(p.label)}</p>
        <h1>${esc(p.titel)}</h1>
        ${p.makers ? `<p class="waar">${esc(p.makers)}</p>` : ""}
        ${p.tekst ? `<p class="lead">${esc(p.tekst)}</p>` : ""}
        <div class="acties">${knop}</div>
      </div>
      ${hero}
    </div>
  </section>
  <section class="papier">
    <div class="wrap cgrid">
      <article class="ctekst">
      ${tekstHtml(p.lang)}
      ${reeks}
      ${luister}
      </article>
      <aside class="praktisch">
        <h2 class="label">${g.praktisch}</h2>
        <dl>
          ${feiten.map(([k, v]) => `<div><dt>${k}</dt><dd>${br(v)}</dd></div>`).join("\n          ")}
          ${(p.data || []).length ? `<div><dt>${esc(V("data", "Data"))}</dt><dd><ul class="data">${p.data.map(x => `<li>${esc(x)}</li>`).join("")}</ul></dd></div>` : ""}
          <div><dt>${esc(V("contact", "Contact"))}</dt><dd><a href="mailto:${esc(p.contact || "info@merodefestival.be")}">${esc(p.contact || "info@merodefestival.be")}</a></dd></div>
        </dl>
        ${p.extra ? `<p class="extra">${esc(p.extra)}</p>` : ""}
        <div class="acties">${knop}</div>
      </aside>
    </div>
  </section>`;
    await fs.writeFile(path.join(ROOT, bestand(p)), pagina({
      titel: p.titel, naam: bestand(p), afbeelding: p.foto || S.artwork,
      beschrijving: p.tekst || p.makers || p.titel, body, verborgen: p.verborgen,
    }));
  }
  console.log(`Kijk en luister, Samenwerken (3 doelgroepen) en ${lijst.length} itempagina’s gebouwd.`);
  // Alleen de zichtbare pagina’s horen in de sitemap; de verborgen krijgen wel dezelfde extra’s (fotoviewer)
  const uit = ["kijk-en-luister.html", "samenwerken.html", "voor-muzikanten.html", "voor-programmatoren.html", "voor-gemeenten.html", ...lijst.filter(p => !p.verborgen).map(bestand)];
  uit.verborgen = lijst.filter(p => p.verborgen).map(bestand);
  return uit;
}

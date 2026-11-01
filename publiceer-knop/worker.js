// Publiceerknop: Notion → GitHub → website
//
// Een link (of een Notion-knop met "Send webhook") die de GitHub-workflow
// "Notion → website" meteen laat draaien, zodat een aanpassing in Notion
// binnen een paar minuten online staat in plaats van op het volgende halfuur te wachten.
//
//   GET  /?key=<KNOP_KEY>                 pagina met een knop per site
//   POST /?key=<KNOP_KEY>&site=<site>     publiceert die site (merode, holsbeek, limburg of alle)
//
// Instellingen (Cloudflare → Worker → Settings → Variables and Secrets, of `npx wrangler secret put`):
//   KNOP_KEY              geheim woord dat in de link staat
//   GITHUB_TOKEN          classic token van JochenSmets met scope "repo": werkt voor alle drie
//                         (JochenSmets is medewerker van MerodeFestival, geen lid, dus een
//                         fine-grained token van JochenSmets kan niet bij de Merode-repo)
// Of, nauwer, per eigenaar een fine-grained token met recht "Actions: Read and write":
//   GITHUB_TOKEN_MERODE   eigenaar MerodeFestival, repo merodefestival-site
//   GITHUB_TOKEN_JOCHEN   eigenaar JochenSmets, repos holsbeeksessies-site en limburgsessies-site
// Een token per eigenaar gaat voor op GITHUB_TOKEN.

const SITES = {
  merode: { naam: "Merodefestival", repo: "MerodeFestival/merodefestival-site", token: "GITHUB_TOKEN_MERODE", adres: "https://www.merodefestival.be" },
  holsbeek: { naam: "Holsbeek Sessies", repo: "JochenSmets/holsbeeksessies-site", token: "GITHUB_TOKEN_JOCHEN", adres: "https://www.holsbeeksessies.be" },
  limburg: { naam: "Limburg Sessies", repo: "JochenSmets/limburgsessies-site", token: "GITHUB_TOKEN_JOCHEN", adres: "https://www.limburgsessies.be" },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!env.KNOP_KEY || key !== env.KNOP_KEY) {
      return new Response("Geen toegang", { status: 403 });
    }

    // Een gewone klik op de link toont eerst de knoppen: zo publiceert een
    // linkvoorbeeld in Notion of Slack niet per ongeluk.
    if (request.method === "GET") return pagina(knoppen(key));
    if (request.method !== "POST") return new Response("Niet toegestaan", { status: 405 });

    const keuze = url.searchParams.get("site") || "alle";
    const sites = keuze === "alle" ? Object.keys(SITES) : [keuze].filter(s => SITES[s]);
    if (!sites.length) return new Response("Onbekende site: " + keuze, { status: 400 });

    const resultaten = await Promise.all(sites.map(s => publiceer(SITES[s], env)));

    // Notion-webhook of ander script: kort antwoord in JSON
    if (!(request.headers.get("Accept") || "").includes("text/html")) {
      return Response.json(resultaten, { status: resultaten.every(r => r.ok) ? 200 : 502 });
    }

    const regels = resultaten.map(r => r.ok
      ? `<li>✅ <b>${r.naam}</b>: gestart. Over 2 à 3 minuten staat het op <a href="${r.adres}">${r.adres.replace("https://", "")}</a>.</li>`
      : `<li>❌ <b>${r.naam}</b>: lukte niet (${r.fout}).</li>`).join("");
    return pagina(`<h1>Publiceren</h1><ul>${regels}</ul>
      <p class="klein">Herlaad de site na een paar minuten. Zie je je wijziging nog niet, kijk dan in GitHub bij <i>Actions</i>.</p>
      <p><a href="?key=${encodeURIComponent(key)}">← Terug</a></p>`);
  },
};

// Laat de workflow notion.yml van één repo meteen draaien
async function publiceer(site, env) {
  const { naam, adres } = site;
  const token = env[site.token] || env.GITHUB_TOKEN;
  if (!token) return { naam, adres, ok: false, fout: "GitHub-token ontbreekt" };
  const res = await fetch(`https://api.github.com/repos/${site.repo}/actions/workflows/notion.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": "wesp-publiceer-knop",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  return res.ok ? { naam, adres, ok: true } : { naam, adres, ok: false, fout: `GitHub ${res.status}` };
}

function knoppen(key) {
  const k = encodeURIComponent(key);
  const knop = (site, tekst) =>
    `<form method="post" action="?key=${k}&site=${site}"><button>${tekst}</button></form>`;
  return `<h1>Websites publiceren</h1>
    <p>Zet je aanpassingen uit Notion meteen online.</p>
    ${knop("alle", "Alle drie de sites")}
    ${Object.entries(SITES).map(([s, x]) => knop(s, x.naam)).join("")}
    <p class="klein">Zonder klik gebeurt het ook vanzelf, maar minder snel.</p>`;
}

function pagina(inhoud) {
  return new Response(`<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Websites publiceren</title><style>
:root{--bg:#fff;--tekst:#1d1d1b;--knop:#1d1d1b;--knoptekst:#fff;--zacht:#666}
@media (prefers-color-scheme:dark){:root{--bg:#1d1d1b;--tekst:#f2f2f0;--knop:#f2f2f0;--knoptekst:#1d1d1b;--zacht:#aaa}}
body{background:var(--bg);color:var(--tekst);font:17px/1.5 system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 16px}
button{width:100%;margin:.4rem 0;padding:.9rem;border:0;border-radius:.6rem;background:var(--knop);color:var(--knoptekst);font:inherit;font-weight:600;cursor:pointer}
a{color:inherit}.klein{color:var(--zacht);font-size:.9em}ul{padding-left:1.2rem}
</style></head><body>${inhoud}</body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

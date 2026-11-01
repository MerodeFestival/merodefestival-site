(function () {
  // Spotify en SoundCloud: de speler wordt pas geladen na een klik
  document.addEventListener("click", function (e) {
    var knop = e.target.closest ? e.target.closest(".speler-knop") : null;
    if (!knop) return;
    var w = knop.closest(".speler-wacht");
    if (!w) return;
    var f = document.createElement("iframe");
    f.src = w.getAttribute("data-embed");
    f.title = w.getAttribute("data-titel") || "";
    f.setAttribute("height", w.getAttribute("data-hoogte") || "152");
    f.setAttribute("allow", w.getAttribute("data-allow") || "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
    f.className = "speler-geladen" + (w.getAttribute("data-klasse") ? " " + w.getAttribute("data-klasse") : "");
    w.parentNode.replaceChild(f, w);
    f.focus();
  });

  // Vorige edities en kerkconcerten: eerst een overzicht, het programma klapt open op verzoek (zonder script blijft alles zichtbaar)
  var klapbaar = function (selector, klasse, inhoud, tekstOpen, tekstDicht, plaats) {
    var lijst = [].slice.call(document.querySelectorAll(selector)).filter(function (a) { return a.querySelector(inhoud); });
    var zet = function (a, open) {
      a.classList.toggle("open", open);
      var k = a.querySelector(".ed-knop");
      if (k) { k.setAttribute("aria-expanded", open ? "true" : "false"); k.textContent = open ? tekstOpen : tekstDicht; }
    };
    lijst.forEach(function (a) {
      a.classList.add(klasse);
      var knop = document.createElement("button");
      knop.type = "button"; knop.className = "ed-knop";
      knop.addEventListener("click", function () { zet(a, !a.classList.contains("open")); });
      plaats(a, knop);
      zet(a, false);
    });
    return { lijst: lijst, zet: zet };
  };
  // Foto’s van een editie: groot bekijken, met pijltjes en Esc
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest(".ed-fotos a") : null;
    if (!a) return;
    e.preventDefault();
    var reeks = [].slice.call(a.parentNode.querySelectorAll("a")), i = reeks.indexOf(a), terug = a;
    var fv = document.createElement("div");
    fv.className = "fv"; fv.setAttribute("role", "dialog"); fv.setAttribute("aria-modal", "true"); fv.setAttribute("aria-label", "Foto vergroot");
    fv.innerHTML = '<img alt=""><button type="button" class="fv-vorig" aria-label="Vorige foto">‹</button><button type="button" class="fv-volgend" aria-label="Volgende foto">›</button><button type="button" class="fv-dicht" aria-label="Sluiten">×</button><p class="fv-tel"></p>';
    var img = fv.querySelector("img"), tel = fv.querySelector(".fv-tel");
    var toon = function (n) { i = (n + reeks.length) % reeks.length; img.src = reeks[i].href; img.alt = reeks[i].querySelector("img").alt; tel.textContent = (i + 1) + " / " + reeks.length; };
    var sluit = function () { document.removeEventListener("keydown", toets); fv.remove(); terug.focus(); };
    var toets = function (k) { if (k.key === "Escape") sluit(); else if (k.key === "ArrowLeft") toon(i - 1); else if (k.key === "ArrowRight") toon(i + 1); };
    fv.addEventListener("click", function (k) { if (k.target === fv) sluit(); });
    fv.querySelector(".fv-vorig").addEventListener("click", function () { toon(i - 1); });
    fv.querySelector(".fv-volgend").addEventListener("click", function () { toon(i + 1); });
    fv.querySelector(".fv-dicht").addEventListener("click", sluit);
    document.addEventListener("keydown", toets);
    document.body.appendChild(fv);
    toon(i);
    fv.querySelector(".fv-dicht").focus();
  });

  var ed = klapbaar("article.editie", "ed-klap", ".affiche,.tekst,.prog,.videos,.dank,.ed-fotos a:nth-child(5)", "Toon minder", "Toon het programma", function (a, knop) {
    var kol = a.children[1];
    kol.insertBefore(knop, kol.querySelector(".tekst,.prog,.videos,.dank") || null);
  });
  var ks = klapbaar("article.kseizoen", "ks-klap", ".kerk-lijst", "Toon minder", "Toon het programma", function (a, knop) {
    var t = a.querySelector(".kt");
    t.parentNode.insertBefore(knop, t.nextSibling);
  });
  if (ed.lijst.length || ks.lijst.length) {
    var vanHash = function () {
      var id = location.hash.slice(1);
      var doel = id && document.getElementById(id);
      if (!doel) return;
      if (doel.classList.contains("ed-klap")) ed.zet(doel, true);
      else if (doel.classList.contains("ks-klap")) ks.zet(doel, true);
      else return;
      doel.scrollIntoView();
    };
    window.addEventListener("hashchange", vanHash);
    vanHash();
  }
})();

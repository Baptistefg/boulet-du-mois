/* Boulet du mois - code partagé par toutes les pages */
(function () {
  "use strict";
  const App = (window.App = {});

  /* ---------- Constantes ---------- */
  const PEOPLE = [
    { n: "Titouan",     g: ["#ff6b6b", "#ffa94d"] },
    { n: "Abel",        g: ["#845ef7", "#f06595"] },
    { n: "Baptiste",    g: ["#fcc419", "#ff922b"] },
    { n: "Shemseddine", g: ["#339af0", "#22b8cf"] },
    { n: "Mehdi",       g: ["#20c997", "#51cf66"] },
  ];
  const SEP = "2026-09";
  const CYCLE_DAY = 25;   // le cycle change et l'annonce a lieu le 25
  const VOTE_FROM = 20;   // le vote photo est ouvert du 20 au 24
  const MAX_PHOTOS = 3;   // photos max par personne et par cycle
  const K = {
    data: "bdm-actions-v2", ovr: "bdm-overrides-v2", seen: "bdm-seen-v3-",
    votes: "bdm-votes-v1", force: "bdm-voteforce-v1", voter: "bdm-voter-v1",
  };
  const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  Object.assign(App, { PEOPLE, SEP, CYCLE_DAY, VOTE_FROM, MAX_PHOTOS, MONTHS });

  /* ---------- Utilitaires ---------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const person = (n) => PEOPLE.find((p) => p.n === n);
  const grad = (p) => `linear-gradient(135deg, ${p.g[0]}, ${p.g[1]})`;
  const av = (p) => `<span class="avatar" style="background:${grad(p)}">${p.n[0]}</span>`;
  const CROWN = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20v2H2zM3 7l4 4 5-7 5 7 4-4-2 10H5z"/></svg>`;
  const crownIco = `<span class="crown-ico">${CROWN}</span>`;
  const crownInline = `<span class="crown-inline">${CROWN}</span>`;
  const load = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? def : v; } catch (e) { return def; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const plural = (n, w) => n + " " + w + (n > 1 ? "s" : "");
  Object.assign(App, { $, esc, person, grad, av, CROWN, crownIco, crownInline, load, store, plural });

  function toast(msg) {
    const t = $("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400);
  }
  App.toast = toast;

  /* ---------- Cycles (du 25 au 24) ----------
     Un cycle porte le nom du mois où il se termine.
     Ex : "2026-10" = du 25 septembre au 24 octobre, annoncé le 25 octobre. */
  const keyOf = (y, m) => { while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + "-" + String(m).padStart(2, "0"); };
  function cycleKey(d) { const y = d.getFullYear(); let m = d.getMonth() + 1; if (d.getDate() >= CYCLE_DAY) m++; return keyOf(y, m); }
  function prevKey(k) { const [y, m] = k.split("-").map(Number); return keyOf(y, m - 1); }
  const monthName = (k) => { const [y, m] = k.split("-"); return MONTHS[+m - 1] + " " + y; };
  const monthLower = (k) => MONTHS[+k.split("-")[1] - 1].toLowerCase();
  function cycleRange(k) {
    const [y, m] = k.split("-").map(Number);
    const f = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    return "du " + f(new Date(y, m - 2, CYCLE_DAY)) + " au " + f(new Date(y, m - 1, CYCLE_DAY - 1));
  }
  function cycleBounds(now) {
    const y = now.getFullYear(), m = now.getMonth();
    if (now.getDate() < CYCLE_DAY) return { start: new Date(y, m - 1, CYCLE_DAY), end: new Date(y, m, CYCLE_DAY) };
    return { start: new Date(y, m, CYCLE_DAY), end: new Date(y, m + 1, CYCLE_DAY) };
  }
  Object.assign(App, { keyOf, cycleKey, prevKey, monthName, monthLower, cycleRange, cycleBounds });
  App.currentKey = () => cycleKey(new Date());

  /* ---------- Données ---------- */
  App.actions = load(K.data, []);
  App.overrides = load(K.ovr, {});   // uniquement utilisé pour septembre 2026 (déjà élu entre eux)
  App.votes = load(K.votes, {});
  App.force = load(K.force, {});
  App.photos = [];
  App.saveActions = () => store(K.data, App.actions);
  App.saveOverrides = () => store(K.ovr, App.overrides);
  App.saveVotes = () => store(K.votes, App.votes);
  App.saveForce = () => store(K.force, App.force);

  App.addAction = (who, why, ts) => {
    const t = ts || Date.now();
    App.actions.push({ id: t + "-" + Math.random().toString(36).slice(2, 6), who, why, ts: t });
    App.saveActions();
  };
  App.delAction = (id) => { App.actions = App.actions.filter((a) => a.id !== id); App.saveActions(); };
  App.actionsOf = (key) => App.actions.filter((a) => cycleKey(new Date(a.ts)) === key).sort((a, b) => b.ts - a.ts);

  App.scoresFor = (key) => {
    const s = Object.fromEntries(PEOPLE.map((p) => [p.n, 0]));
    App.actions.forEach((a) => { if (cycleKey(new Date(a.ts)) === key && a.who in s) s[a.who]++; });
    return s;
  };
  /* Le Boulet du mois est déterminé par le nombre de mauvaises actions du cycle, sans aucun vote.
     Seule exception : septembre 2026, déjà élu entre eux, saisi à la main pour l'historique. */
  App.winnersOf = (key) => {
    const s = App.scoresFor(key);
    const o = key === SEP ? App.overrides[SEP] : null;
    if (o) return { names: o.names, max: Math.max(0, ...o.names.map((n) => s[n] || 0)), note: o.note || "", manual: true };
    const max = Math.max(...Object.values(s));
    if (max === 0) return { names: [], max: 0, note: "" };
    return { names: PEOPLE.map((p) => p.n).filter((n) => s[n] === max), max, note: "" };
  };
  App.setSeptember = (names, note) => { App.overrides[SEP] = { names, note }; App.saveOverrides(); };
  App.clearSeptember = () => { delete App.overrides[SEP]; App.saveOverrides(); };

  /* ---------- Photos (IndexedDB) ---------- */
  let mem = false;
  function openDb() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no idb"));
      const r = indexedDB.open("bdm-photos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("photos", { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  const dbDo = (mode, fn) => openDb().then((db) => new Promise((res, rej) => {
    const tx = db.transaction("photos", mode), st = tx.objectStore("photos");
    const q = fn(st);
    tx.oncomplete = () => res(q && q.result);
    tx.onerror = () => rej(tx.error);
  }));
  const dbAll = () => dbDo("readonly", (s) => s.getAll());
  const dbPut = (p) => dbDo("readwrite", (s) => s.put(p));
  const dbDel = (id) => dbDo("readwrite", (s) => s.delete(id));
  const dbClear = () => dbDo("readwrite", (s) => s.clear());

  function compress(file, max, q) {
    max = max || 1280; q = q || 0.8;
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        const s = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * s); h = Math.round(h * s);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Image illisible")); };
      img.src = url;
    });
  }
  App.photoKey = (p) => cycleKey(new Date(p.ts));
  App.photosOf = (key) => App.photos.filter((p) => App.photoKey(p) === key).sort((a, b) => b.ts - a.ts);
  App.photoCount = (key, who) => App.photosOf(key).filter((p) => p.who === who).length;

  App.addPhoto = async (who, caption, file) => {
    const key = App.currentKey();
    if (App.photoCount(key, who) >= MAX_PHOTOS) throw new Error(who + " a déjà " + MAX_PHOTOS + " photos sur ce cycle");
    if (!file.type || file.type.indexOf("image/") !== 0) throw new Error("Ce fichier n'est pas une image");
    const data = await compress(file);
    const now = new Date();
    const p = { id: now.getTime() + "-" + Math.random().toString(36).slice(2, 6), who, caption: caption || "", ts: now.getTime(), data };
    if (!mem) { try { await dbPut(p); } catch (e) { mem = true; } }
    App.photos.push(p);
    return p;
  };
  App.delPhoto = async (id) => {
    App.photos = App.photos.filter((p) => p.id !== id);
    Object.keys(App.votes).forEach((k) => { Object.keys(App.votes[k]).forEach((v) => { if (App.votes[k][v] === id) delete App.votes[k][v]; }); });
    App.saveVotes();
    if (!mem) { try { await dbDel(id); } catch (e) {} }
  };

  /* ---------- Votes photo ---------- */
  App.isVoteOpen = () => {
    const d = new Date();
    return (d.getDate() >= VOTE_FROM && d.getDate() < CYCLE_DAY) || !!App.force[App.currentKey()];
  };
  App.voteWindow = () => "du " + VOTE_FROM + " au " + (CYCLE_DAY - 1) + " de chaque mois";
  App.getVoter = () => { try { const v = localStorage.getItem(K.voter); return person(v) ? v : null; } catch (e) { return null; } };
  App.setVoter = (n) => { try { localStorage.setItem(K.voter, n); } catch (e) {} };
  App.castVote = (key, voter, photoId) => {
    const ph = App.photos.find((p) => p.id === photoId);
    if (!ph || ph.who === voter) return false;
    App.votes[key] = App.votes[key] || {};
    App.votes[key][voter] = photoId;
    App.saveVotes();
    return true;
  };
  App.myVote = (key, voter) => (App.votes[key] || {})[voter] || null;
  App.photoResults = (key) => {
    const list = App.photosOf(key);
    const scores = Object.fromEntries(list.map((p) => [p.id, 0]));
    Object.values(App.votes[key] || {}).forEach((id) => { if (id in scores) scores[id]++; });
    const max = Math.max(0, ...Object.values(scores));
    return { scores, max, winners: max > 0 ? list.filter((p) => scores[p.id] === max) : [], total: Object.values(scores).reduce((a, b) => a + b, 0) };
  };

  /* ---------- Cycles terminés et palmarès ---------- */
  App.finishedKeys = () => {
    const cur = App.currentKey();
    const all = new Set([...App.actions.map((a) => cycleKey(new Date(a.ts))), ...(App.overrides[SEP] ? [SEP] : []), ...App.photos.map(App.photoKey)]);
    return [...all].filter((k) => k < cur).sort().reverse();
  };
  App.years = () => {
    const y = String(new Date().getFullYear());
    return [...new Set([y, ...App.finishedKeys().map((k) => k.slice(0, 4))])].sort().reverse();
  };
  App.yearTitles = (year) => {
    const t = Object.fromEntries(PEOPLE.map((p) => [p.n, 0]));
    App.finishedKeys().filter((k) => k.startsWith(year + "-")).forEach((k) => App.winnersOf(k).names.forEach((n) => { if (n in t) t[n]++; }));
    return t;
  };
  App.yearPhotoTitles = (year) => {
    const t = Object.fromEntries(PEOPLE.map((p) => [p.n, 0]));
    App.finishedKeys().filter((k) => k.startsWith(year + "-")).forEach((k) => App.photoResults(k).winners.forEach((p) => { if (p.who in t) t[p.who]++; }));
    return t;
  };

  /* ---------- Blocs HTML réutilisables ---------- */
  App.podiumHTML = (s, winners) => {
    const sorted = PEOPLE.slice().sort((a, b) => s[b.n] - s[a.n]);
    if (!Object.values(s).some((v) => v > 0)) return "";
    const order = [sorted[1], sorted[0], sorted[2]];
    const heights = [150, 100, 70];
    return `<div class="podium">${order.map((p, i) => {
      const rank = i === 1 ? 0 : i === 0 ? 1 : 2;
      const isW = winners.indexOf(p.n) >= 0;
      return `<div class="pcol ${rank === 0 ? "first" : ""}">
        <div class="${isW ? "crown" : ""}">${isW ? crownIco : ""}${av(p)}</div>
        <div class="pname">${p.n}</div>
        <div class="pblock" style="height:${heights[rank]}px;animation-delay:${0.1 + rank * 0.12}s">${s[p.n]}</div>
      </div>`;
    }).join("")}</div>`;
  };
  App.rankRows = (s, opts) => {
    opts = opts || {};
    const list = opts.list || PEOPLE.slice().sort((a, b) => s[b.n] - s[a.n]);
    const mx = Math.max(1, ...Object.values(s));
    let pos = 0, last = null;
    return list.map((p, i) => {
      if (s[p.n] !== last) { pos = i + 1 + (opts.offset || 0); last = s[p.n]; }
      return `<div class="rank">${opts.pos ? `<div class="pos">${pos}</div>` : ""}${av(p)}<div class="nm">${p.n}</div>
        <div class="track"><div class="fill ${opts.alt ? "alt" : ""}" style="width:${s[p.n] / mx * 100}%"></div></div>
        <div class="ct">${s[p.n]}${opts.unit ? ` <small>${opts.unit}${s[p.n] > 1 ? "s" : ""}</small>` : ""}</div></div>`;
    }).join("");
  };
  App.actionItemHTML = (a, withDel) => {
    const p = person(a.who) || PEOPLE[0];
    return `<div class="item">${av(p)}
      <div class="body"><div class="who">${esc(a.who)}</div><div class="why">${esc(a.why)}</div></div>
      <div><div class="dt">${new Date(a.ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>
      ${withDel ? `<div style="text-align:right"><button class="x" data-del="${a.id}" title="Supprimer">×</button></div>` : ""}</div>
    </div>`;
  };
  App.cycleOptions = (selected, extraKeys) => {
    const cur = App.currentKey();
    const keys = [...new Set([cur, ...App.finishedKeys(), ...(extraKeys || [])])].sort().reverse();
    return `<select id="cycleSel">${keys.map((k) => `<option value="${k}" ${k === selected ? "selected" : ""}>${monthName(k)}${k === cur ? " (en cours)" : ""}</option>`).join("")}</select>`;
  };

  /* ---------- Lightbox ---------- */
  App.lightbox = (src, caption) => {
    const lb = $("lightbox"); if (!lb) return;
    lb.innerHTML = `<img src="${src}" alt=""><p>${esc(caption || "")}</p>`;
    lb.classList.add("show");
  };

  /* ---------- Confettis ---------- */
  App.confetti = () => {
    const c = $("confetti"); if (!c) return;
    const ctx = c.getContext("2d");
    c.width = innerWidth; c.height = innerHeight;
    const cols = ["#ff4d6d", "#ffd166", "#4cc9f0", "#80ed99", "#c77dff", "#fff"];
    const parts = Array.from({ length: 170 }, () => ({
      x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.6,
      vx: (Math.random() - 0.5) * 5, vy: 2.5 + Math.random() * 5.5,
      s: 6 + Math.random() * 8, col: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    }));
    let f = 0;
    (function tick() {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.55); ctx.restore();
      });
      if (++f < 300) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
    })();
  };

  /* ---------- Annonces plein écran ---------- */
  function overlay(headHTML, midHTML, onClose, finalFn) {
    const box = $("reveal");
    box.classList.add("show");
    let n = 3;
    box.innerHTML = headHTML + `<div class="cd" id="cd">${n}</div>`;
    const t = setInterval(() => {
      n--;
      if (n > 0) { const c = $("cd"); c.textContent = n; c.style.animation = "none"; void c.offsetWidth; c.style.animation = ""; return; }
      clearInterval(t);
      box.innerHTML = headHTML + midHTML + `<button class="btn" id="cl">Fermer</button>`;
      $("cl").onclick = () => { box.classList.remove("show"); box.innerHTML = ""; onClose(); };
      App.confetti(); setTimeout(App.confetti, 1200);
      if (finalFn) finalFn();
    }, 1000);
  }
  function simpleOverlay(html, onClose) {
    const box = $("reveal");
    box.classList.add("show");
    box.innerHTML = html + `<button class="btn" id="cl">Fermer</button>`;
    $("cl").onclick = () => { box.classList.remove("show"); box.innerHTML = ""; onClose(); };
  }
  const markSeen = (name) => { try { localStorage.setItem(K.seen + name, "1"); } catch (e) {} };
  const wasSeen = (name) => { try { return !!localStorage.getItem(K.seen + name); } catch (e) { return false; } };

  App.showReveal = (key, mark, done) => {
    done = done || function () {};
    const r = App.winnersOf(key);
    const finish = () => { if (mark) markSeen(key); done(); };
    if (!r.names.length) {
      simpleOverlay(`<div class="rm">${monthName(key)}</div><div class="rt">Personne n'a rien fait de mal ce mois-ci. Suspect.</div>`, finish);
      return;
    }
    const head = `<div class="spot"></div><div class="rm">${monthName(key)}</div><div class="rt">Le Boulet du mois est…</div>`;
    const ps = r.names.map(person).filter(Boolean);
    const mid = `<div class="avs">${ps.map((p) => `<div class="av" style="background:${grad(p)}">${p.n[0]}</div>`).join("")}</div>
      <div class="nm">${crownInline}${r.names.join(" & ")}</div>
      <div class="sb">${r.note ? "« " + esc(r.note) + " »" : (r.max ? plural(r.max, "mauvaise action") + " sur ce cycle. " : "") + "Félicitations (ou pas)."}</div>`;
    overlay(head, mid, finish);
  };

  App.showPhotoReveal = (key, mark, done) => {
    done = done || function () {};
    const r = App.photoResults(key);
    const finish = () => { if (mark) markSeen("p-" + key); done(); };
    if (!r.winners.length) {
      simpleOverlay(`<div class="rm">${monthName(key)}</div><div class="rt">Aucun vote pour les photos de ce cycle.</div>`, finish);
      return;
    }
    const head = `<div class="spot"></div><div class="rm">${monthName(key)}</div><div class="rt">La photo du mois est…</div>`;
    const names = [...new Set(r.winners.map((p) => p.who))].join(" & ");
    const mid = `<div class="pimgs">${r.winners.map((p) => `<img class="pimg" src="${p.data}" alt="">`).join("")}</div>
      <div class="nm mid">${crownInline}${names}</div>
      <div class="sb">${plural(r.max, "vote")}${r.winners.length > 1 ? " chacune (égalité)" : ""}.${r.winners[0].caption ? " « " + esc(r.winners[0].caption) + " »" : ""}</div>`;
    overlay(head, mid, finish);
  };

  /* Au premier chargement après le 25, annonce le cycle qui vient de se terminer (une seule fois par navigateur). */
  App.checkReveals = () => {
    const ended = prevKey(App.currentKey());
    const hasBoulet = App.winnersOf(ended).names.length > 0 && !wasSeen(ended);
    const hasPhoto = App.photoResults(ended).winners.length > 0 && !wasSeen("p-" + ended);
    const stepPhoto = () => { if (hasPhoto) App.showPhotoReveal(ended, true); };
    if (hasBoulet) App.showReveal(ended, true, stepPhoto); else stepPhoto();
  };

  /* ---------- Export / import ---------- */
  App.exportAll = () => {
    const blob = new Blob([JSON.stringify({ version: 4, actions: App.actions, overrides: App.overrides, votes: App.votes, photos: App.photos }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "boulet-du-mois.json"; a.click();
  };
  App.importAll = async (text) => {
    const d = JSON.parse(text);
    const acts = Array.isArray(d) ? d : d.actions;
    if (!Array.isArray(acts)) throw new Error("Fichier invalide");
    App.actions = acts;
    App.overrides = (!Array.isArray(d) && d.overrides) || {};
    App.votes = (!Array.isArray(d) && d.votes) || {};
    App.photos = (!Array.isArray(d) && Array.isArray(d.photos)) ? d.photos : [];
    App.saveActions(); App.saveOverrides(); App.saveVotes();
    if (!mem) { try { await dbClear(); for (const p of App.photos) await dbPut(p); } catch (e) { mem = true; } }
  };

  /* ---------- Mise en place de la page ---------- */
  const LINKS = [
    ["index.html", "Accueil", "home"], ["actions.html", "Actions", "actions"], ["classement.html", "Classement", "rank"],
    ["photos.html", "Photos", "photos"], ["palmares.html", "Palmarès", "hof"], ["septembre.html", "Septembre", "sept"],
  ];
  const domReady = new Promise((res) => { if (document.readyState !== "loading") res(); else document.addEventListener("DOMContentLoaded", res); });
  const photosReady = dbAll().then((all) => { App.photos = all || []; }).catch(() => { mem = true; App.photos = []; });

  App.ready = Promise.all([domReady, photosReady]).then(() => {
    document.body.insertAdjacentHTML("afterbegin", '<div class="bg"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div><div class="grain"></div>');
    document.body.insertAdjacentHTML("beforeend", '<div id="reveal"></div><canvas id="confetti"></canvas><div id="toast"></div><div id="lightbox"></div>');
    const page = document.body.dataset.page;
    const nav = $("nav");
    if (nav) nav.innerHTML = LINKS.map((l) => `<a href="${l[0]}" class="${l[2] === page ? "active" : ""}">${l[1]}</a>`).join("");
    $("lightbox").onclick = () => $("lightbox").classList.remove("show");
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("lightbox").classList.remove("show"); });
    if (mem) console.warn("IndexedDB indisponible : les photos ne seront pas conservées après rechargement.");
  });
})();

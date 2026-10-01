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
  const CYCLE_DAY = 25;   // le cycle change et la révélation a lieu le 25
  const MAX_PHOTOS = 3;   // photos max par personne et par cycle
  const K = {
    seen: "bdm-seen-v3-", force: "bdm-voteforce-v1", voter: "bdm-voter-v1",
  };
  const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  Object.assign(App, { PEOPLE, CYCLE_DAY, MAX_PHOTOS, MONTHS });

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

  /* ---------- Configuration ----------
     Tout se règle dans config.js (supabaseUrl + supabaseKey).
     Le site fonctionne uniquement avec la base de données en ligne : tout le monde voit les mêmes données.
     Sans configuration, rien n'est enregistré et un message l'indique. */
  const CFG = window.BDM_CONFIG || {};
  const SB = String(CFG.supabaseUrl || "").trim().replace(/\/+$/, "");
  const SBKEY = String(CFG.supabaseKey || "").trim();
  const CONFIGURED = !!(SB && SBKEY);
  App.configured = CONFIGURED;
  const NOT_CONFIGURED = "La base de données n'est pas encore configurée (config.js).";
  const requireDb = () => { if (!CONFIGURED) throw new Error(NOT_CONFIGURED); if (App.loadError) throw new Error("Base de données injoignable, recharge la page."); };

  /* ---------- Administration ----------
     Seul l'admin (utilisateur créé dans Supabase) peut supprimer des actions ou des photos,
     importer des données et gérer la photothèque. Les règles de setup.sql l'imposent côté serveur. */
  const SESSION_K = "bdm-sb-session";
  let session = load(SESSION_K, null);
  App.adminConfigured = () => CONFIGURED;
  App.isAdmin = () => CONFIGURED && !!(session && session.access_token && session.expires_at > Date.now());
  App.adminEmail = () => (session && session.email) || "";
  async function authToken(grant, body) {
    const r = await fetch(SB + "/auth/v1/token?grant_type=" + grant, {
      method: "POST", headers: { apikey: SBKEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || "Connexion refusée");
    session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000 - 60000, email: (j.user && j.user.email) || body.email || "" };
    store(SESSION_K, session);
  }
  App.adminLogin = async (pw, email) => {
    if (!CONFIGURED) return false;
    try { await authToken("password", { email: String(email || "").trim(), password: pw }); return true; }
    catch (e) { await new Promise((r) => setTimeout(r, 500)); return false; }
  };
  App.adminLogout = () => {
    session = null;
    try { localStorage.removeItem(SESSION_K); } catch (e) {}
  };
  async function refreshSession() {
    if (!session || !session.refresh_token || session.expires_at > Date.now()) return;
    try { await authToken("refresh_token", { refresh_token: session.refresh_token }); }
    catch (e) { App.adminLogout(); }
  }

  /* ---------- Client de la base (Supabase : REST + Storage) ---------- */
  /* Jeton envoyé : celui de l'admin connecté, sinon la clé "anon" (format JWT, commence par eyJ).
     Les nouvelles clés "publishable" (sb_publishable_...) ne sont envoyées que dans l'en-tête apikey. */
  const bearer = () => {
    if (session && session.access_token && session.expires_at > Date.now()) return session.access_token;
    return SBKEY.indexOf("eyJ") === 0 ? SBKEY : "";
  };
  async function sb(path, opts) {
    opts = opts || {};
    const tok = bearer();
    const headers = Object.assign({ apikey: SBKEY }, tok ? { Authorization: "Bearer " + tok } : {}, opts.headers || {});
    const r = await fetch(SB + path, Object.assign({}, opts, { headers }));
    if (!r.ok) {
      let msg = "Erreur " + r.status;
      try { const j = await r.json(); msg = j.message || j.error_description || j.error || j.msg || msg; } catch (e) {}
      if (r.status === 401 || r.status === 403 || /row-level security|policy|Unauthorized/i.test(msg)) msg = "Action refusée par la base (réservé à l'admin ?)";
      throw new Error(msg);
    }
    if (r.status === 204) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  const db = {
    select: (table, q) => sb("/rest/v1/" + table + "?" + (q || "select=*")),
    insert: (table, rows, onConflict) => sb("/rest/v1/" + table + (onConflict ? "?on_conflict=" + onConflict : ""), {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: (onConflict ? "resolution=merge-duplicates," : "") + "return=minimal" },
      body: JSON.stringify(rows),
    }),
    /* Supprime et vérifie qu'au moins une ligne a vraiment été supprimée (sinon refus des règles de sécurité). */
    remove: async (table, q, allowNone) => {
      const rows = await sb("/rest/v1/" + table + "?" + q, { method: "DELETE", headers: { Prefer: "return=representation" } });
      if (!allowNone && (!rows || !rows.length)) throw new Error("Suppression refusée par la base (réservé à l'admin)");
      return rows;
    },
  };
  const bucketUrl = (bucket, name) => SB + "/storage/v1/object/public/" + bucket + "/" + name;
  const files = {
    put: (bucket, name, blob) => sb("/storage/v1/object/" + bucket + "/" + name, { method: "POST", headers: { "Content-Type": "image/jpeg", "cache-control": "31536000" }, body: blob }),
    remove: (bucket, name) => sb("/storage/v1/object/" + bucket + "/" + name, { method: "DELETE" }).catch(() => null),
  };
  function dataUrlToBlob(u) {
    const parts = u.split(","), bin = atob(parts[1] || ""), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: "image/jpeg" });
  }
  const newId = (t) => (t || Date.now()) + "-" + Math.random().toString(36).slice(2, 8);

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

  /* ---------- Données ----------
     Tout est chargé en mémoire au démarrage (depuis la base ou le navigateur),
     puis chaque ajout / suppression est envoyé à la base. */
  App.actions = [];
  App.votes = {};
  App.photos = [];
  App.cup = [];
  App.force = load(K.force, {});
  App.loadError = "";
  App.saveForce = () => store(K.force, App.force);

  const ptsOf = (a) => Math.min(3, Math.max(1, Number(a.pts) || 1));
  App.ptsOf = ptsOf;
  App.addAction = async (who, why, pts, ts) => {
    const t = ts || Date.now();
    const a = { id: newId(t), who, why: String(why).slice(0, 200), pts: Math.min(3, Math.max(1, Number(pts) || 1)), ts: t };
    requireDb();
    await db.insert("actions", a);
    App.actions.push(a);
    return a;
  };
  App.delAction = async (id) => {
    if (!App.isAdmin()) return false;
    requireDb();
    await db.remove("actions", "id=eq." + encodeURIComponent(id));
    App.actions = App.actions.filter((a) => a.id !== id);
    return true;
  };
  App.actionsOf = (key) => App.actions.filter((a) => cycleKey(new Date(a.ts)) === key).sort((a, b) => b.ts - a.ts);

  /* Le score d'un cycle = somme des points de gravité (1 à 3) des mauvaises actions. */
  App.scoresFor = (key) => {
    const s = Object.fromEntries(PEOPLE.map((p) => [p.n, 0]));
    App.actions.forEach((a) => { if (cycleKey(new Date(a.ts)) === key && a.who in s) s[a.who] += ptsOf(a); });
    return s;
  };
  App.totalPoints = (key) => Object.values(App.scoresFor(key)).reduce((a, b) => a + b, 0);
  /* Le Boulet du mois est celui qui a le plus de points de gravité sur le cycle, sans aucun vote.
     Seule exception : septembre 2026, élu avant la création du site, inscrit ici pour l'historique. */
  const FIXED = { "2026-09": { names: ["Titouan"], note: "Élu entre nous avant la création du site." } };
  App.FIXED = FIXED;
  App.winnersOf = (key) => {
    if (FIXED[key]) return { names: FIXED[key].names.slice(), max: 0, note: FIXED[key].note, manual: true };
    const s = App.scoresFor(key);
    const max = Math.max(...Object.values(s));
    if (max === 0) return { names: [], max: 0, note: "" };
    return { names: PEOPLE.map((p) => p.n).filter((n) => s[n] === max), max, note: "" };
  };

  /* ---------- Images ---------- */
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
  const checkImage = (file) => { if (!file || !file.type || file.type.indexOf("image/") !== 0) throw new Error("Ce fichier n'est pas une image"); };

  /* ---------- Photos du concours ---------- */
  App.photoKey = (p) => cycleKey(new Date(p.ts));
  App.photosOf = (key) => App.photos.filter((p) => App.photoKey(p) === key).sort((a, b) => b.ts - a.ts);
  App.photoCount = (key, who) => App.photosOf(key).filter((p) => p.who === who).length;

  App.addPhoto = async (who, caption, file) => {
    requireDb();
    const key = App.currentKey();
    if (App.photoCount(key, who) >= MAX_PHOTOS) throw new Error(who + " a déjà " + MAX_PHOTOS + " photos sur ce cycle");
    checkImage(file);
    const data = await compress(file);
    const t = Date.now();
    const p = { id: newId(t), who, caption: String(caption || "").slice(0, 120), ts: t, data };
    await files.put("photos", p.id + ".jpg", dataUrlToBlob(data));
    try { await db.insert("photos", { id: p.id, who: p.who, caption: p.caption, ts: p.ts }); }
    catch (e) { files.remove("photos", p.id + ".jpg"); throw e; }
    p.data = bucketUrl("photos", p.id + ".jpg");
    App.photos.push(p);
    return p;
  };
  App.delPhoto = async (id) => {
    if (!App.isAdmin()) return false;
    requireDb();
    await db.remove("photos", "id=eq." + encodeURIComponent(id));
    await files.remove("photos", id + ".jpg");
    App.photos = App.photos.filter((p) => p.id !== id);
    Object.keys(App.votes).forEach((k) => { Object.keys(App.votes[k]).forEach((v) => { if (App.votes[k][v] === id) delete App.votes[k][v]; }); });
    return true;
  };

  /* ---------- Photos avec la coupe (photothèque, admin uniquement) ---------- */
  App.cupOf = (key) => App.cup.filter((c) => c.cycle === key).sort((a, b) => a.ts - b.ts);
  App.addCup = async (key, caption, file) => {
    requireDb();
    if (!App.isAdmin()) throw new Error("Réservé à l'admin");
    checkImage(file);
    const data = await compress(file, 1600, 0.85);
    const t = Date.now();
    const c = { id: newId(t), cycle: key, caption: String(caption || "").slice(0, 120), ts: t, data };
    await files.put("coupe", c.id + ".jpg", dataUrlToBlob(data));
    try { await db.insert("cup_photos", { id: c.id, cycle: c.cycle, caption: c.caption, ts: c.ts }); }
    catch (e) { files.remove("coupe", c.id + ".jpg"); throw e; }
    c.data = bucketUrl("coupe", c.id + ".jpg");
    App.cup.push(c);
    return c;
  };
  App.delCup = async (id) => {
    if (!App.isAdmin()) return false;
    requireDb();
    await db.remove("cup_photos", "id=eq." + encodeURIComponent(id));
    await files.remove("coupe", id + ".jpg");
    App.cup = App.cup.filter((c) => c.id !== id);
    return true;
  };

  /* ---------- Révélation des photos et vote ----------
     - Pendant un cycle, ses photos sont cachées (personne ne les voit).
     - Le 25 (jour de la révélation), les photos du cycle qui vient de se terminer s'affichent
       et le vote a lieu ce jour-là, de façon anonyme.
     - À partir du 26, les auteurs et la photo gagnante sont dévoilés et annoncés. */
  App.voteKey = () => {
    const d = new Date();
    return d.getDate() === CYCLE_DAY ? prevKey(cycleKey(d)) : null;
  };
  App.isVoteOpen = (key) => key === App.voteKey() || !!App.force[key];
  App.photosVisible = (key) => key < App.currentKey() || !!App.force[key];
  App.resultsVisible = (key) => key < App.currentKey() && !App.isVoteOpen(key);
  App.voteWindow = () => "le " + CYCLE_DAY + ", jour de la révélation";
  App.getVoter = () => { try { const v = localStorage.getItem(K.voter); return person(v) ? v : null; } catch (e) { return null; } };
  App.setVoter = (n) => { try { localStorage.setItem(K.voter, n); } catch (e) {} };
  App.castVote = async (key, voter, photoId) => {
    const ph = App.photos.find((p) => p.id === photoId);
    if (!ph || ph.who === voter || !person(voter)) return false;
    requireDb();
    await db.insert("votes", { cycle: key, voter, photo_id: photoId }, "cycle,voter");
    App.votes[key] = App.votes[key] || {};
    App.votes[key][voter] = photoId;
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
    const all = new Set([...App.actions.map((a) => cycleKey(new Date(a.ts))), ...Object.keys(FIXED), ...App.photos.map(App.photoKey)]);
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
    App.finishedKeys().filter((k) => k.startsWith(year + "-") && App.resultsVisible(k)).forEach((k) => App.photoResults(k).winners.forEach((p) => { if (p.who in t) t[p.who]++; }));
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
    const pts = ptsOf(a);
    return `<div class="item">${av(p)}
      <div class="body"><div class="who">${esc(a.who)}<span class="pts p${pts}">${pts} pt${pts > 1 ? "s" : ""}</span></div><div class="why">${esc(a.why)}</div></div>
      <div><div class="dt">${new Date(a.ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div>
      ${withDel && App.isAdmin() ? `<div style="text-align:right"><button class="x" data-del="${a.id}" title="Supprimer (admin)">×</button></div>` : ""}</div>
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
      <div class="sb">${r.note ? "« " + esc(r.note) + " »" : (r.max ? plural(r.max, "point") + " sur ce cycle. " : "") + "Félicitations (ou pas)."}</div>`;
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

  /* Annonces automatiques (une seule fois par navigateur) :
     - le 25 : le Boulet du cycle qui vient de se terminer ;
     - à partir du 26 : la photo gagnante, une fois le vote du 25 terminé. */
  App.checkReveals = () => {
    const ended = prevKey(App.currentKey());
    const photoKeys = [prevKey(ended), ended].filter((k) => App.resultsVisible(k) && App.photoResults(k).winners.length > 0 && !wasSeen("p-" + k));
    const stepPhoto = (i) => { if (i < photoKeys.length) App.showPhotoReveal(photoKeys[i], true, () => stepPhoto(i + 1)); };
    const hasBoulet = App.winnersOf(ended).names.length > 0 && !wasSeen(ended);
    if (hasBoulet) App.showReveal(ended, true, () => stepPhoto(0)); else stepPhoto(0);
  };

  /* ---------- Export / import ---------- */
  App.exportAll = () => {
    const payload = { version: 6, actions: App.actions, votes: App.votes, photos: App.photos, cup: App.cup };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "boulet-du-mois.json"; a.click();
  };
  /* Import (admin) : ajoute le contenu d'un fichier d'export dans la base. */
  App.importAll = async (text) => {
    requireDb();
    if (!App.isAdmin()) throw new Error("Réservé à l'admin");
    const d = JSON.parse(text);
    const acts = Array.isArray(d) ? d : d.actions;
    if (!Array.isArray(acts)) throw new Error("Fichier invalide");
    const votes = (!Array.isArray(d) && d.votes) || {};
    const photos = (!Array.isArray(d) && Array.isArray(d.photos)) ? d.photos : [];
    const cup = (!Array.isArray(d) && Array.isArray(d.cup)) ? d.cup : [];
    if (acts.length) await db.insert("actions", acts.map((a) => ({ id: a.id, who: a.who, why: a.why, pts: ptsOf(a), ts: a.ts })), "id");
    const up = async (bucket, table, list, row) => {
      for (const p of list) {
        if (String(p.data || "").indexOf("data:") === 0) await files.put(bucket, p.id + ".jpg", dataUrlToBlob(p.data)).catch(() => null);
        await db.insert(table, row(p), "id");
      }
    };
    await up("photos", "photos", photos, (p) => ({ id: p.id, who: p.who, caption: p.caption || "", ts: p.ts }));
    await up("coupe", "cup_photos", cup, (c) => ({ id: c.id, cycle: c.cycle, caption: c.caption || "", ts: c.ts }));
    const vrows = [];
    Object.keys(votes).forEach((k) => Object.keys(votes[k]).forEach((v) => vrows.push({ cycle: k, voter: v, photo_id: votes[k][v] })));
    if (vrows.length) await db.insert("votes", vrows, "cycle,voter");
    await loadData();
  };

  /* ---------- Chargement des données (depuis la base) ---------- */
  async function loadData() {
    if (!CONFIGURED) throw new Error(NOT_CONFIGURED);
    await refreshSession();
    const [acts, votes, photos, cup] = await Promise.all([
      db.select("actions", "select=*&order=ts.asc"),
      db.select("votes", "select=*"),
      db.select("photos", "select=id,who,caption,ts&order=ts.asc"),
      db.select("cup_photos", "select=id,cycle,caption,ts&order=ts.asc"),
    ]);
    App.actions = acts || [];
    App.votes = {};
    (votes || []).forEach((v) => { (App.votes[v.cycle] = App.votes[v.cycle] || {})[v.voter] = v.photo_id; });
    App.photos = (photos || []).map((p) => Object.assign({}, p, { data: bucketUrl("photos", p.id + ".jpg") }));
    App.cup = (cup || []).map((c) => Object.assign({}, c, { data: bucketUrl("coupe", c.id + ".jpg") }));
  }
  App.reload = async () => { App.loadError = ""; await loadData(); };

  /* ---------- Mise en place de la page ---------- */
  const LINKS = [
    ["index.html", "Accueil", "home"], ["actions.html", "Actions", "actions"], ["classement.html", "Classement", "rank"],
    ["photos.html", "Photos", "photos"], ["phototheque.html", "Photothèque", "cup"], ["palmares.html", "Palmarès", "hof"],
    ["admin.html", "Admin", "admin"],
  ];
  const domReady = new Promise((res) => { if (document.readyState !== "loading") res(); else document.addEventListener("DOMContentLoaded", res); });
  const dataReady = loadData().catch((e) => { App.loadError = e.message || String(e); });

  App.ready = Promise.all([domReady, dataReady]).then(() => {
    document.body.insertAdjacentHTML("afterbegin", '<div class="bg"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div><div class="grain"></div>');
    document.body.insertAdjacentHTML("beforeend", '<div id="reveal"></div><canvas id="confetti"></canvas><div id="toast"></div><div id="lightbox"></div>');
    const page = document.body.dataset.page;
    const nav = $("nav");
    if (nav) nav.innerHTML = LINKS.map((l) => `<a href="${l[0]}" class="${l[2] === page ? "active" : ""}">${l[1]}</a>`).join("");
    if (App.loadError) {
      const wrap = document.querySelector(".wrap");
      const msg = !CONFIGURED
        ? "La base de données n'est pas encore configurée. Rien ne peut être enregistré tant que l'URL et la clé Supabase ne sont pas dans config.js (voir README.md)."
        : `Impossible de joindre la base de données (${esc(App.loadError)}). Vérifie ta connexion, puis recharge la page.`;
      if (wrap) wrap.insertAdjacentHTML("afterbegin", `<div class="notice" style="margin-bottom:18px">${msg}</div>`);
    }
    $("lightbox").onclick = () => $("lightbox").classList.remove("show");
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("lightbox").classList.remove("show"); });
  });
})();

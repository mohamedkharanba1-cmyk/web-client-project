(() => {
  "use strict";

  if (!WC.mustAuth()) return;
  WC.navSync();

  const form = document.getElementById("sForm");
  const input = document.getElementById("sQuery");
  const info = document.getElementById("sInfo");
  const grid = document.getElementById("sGrid");

  const dlgPlayer = document.getElementById("dlgPlayer");
  const pTitle = document.getElementById("pTitle");
  const pFrame = document.getElementById("pFrame");
  const pClose = document.getElementById("pClose");

  const dlgAdd = document.getElementById("dlgAdd");
  const aTitle = document.getElementById("aTitle");
  const aSelect = document.getElementById("aSelect");
  const aNew = document.getElementById("aNew");
  const aCancel = document.getElementById("aCancel");
  const aOk = document.getElementById("aOk");

  const dlgKey = document.getElementById("dlgKey");
  const kInput = document.getElementById("kInput");
  const kCancel = document.getElementById("kCancel");
  const kSave = document.getElementById("kSave");
  const kBtn = document.getElementById("kBtn");
  const kState = document.getElementById("kState");

  let last = [];
  let pending = null;

  const setInfo = (t, bad=false) => {
    info.textContent = t;
    info.classList.toggle("error", bad);
    info.hidden = false;
  };
  const hideInfo = () => info.hidden = true;

  const refreshKey = () => {
    kState.textContent = WC.ytKeyGet() ? "API key is saved locally." : "No API key. Add one to search.";
  };

  const ytSearch = async (q, key) => {
    const u = new URL("https://www.googleapis.com/youtube/v3/search");
    u.searchParams.set("part","snippet");
    u.searchParams.set("type","video");
    u.searchParams.set("maxResults","12");
    u.searchParams.set("q", q);
    u.searchParams.set("key", key);
    const r = await fetch(u);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || "API error");
    return (d.items || []).filter(x => x.id?.videoId);
  };

  const ytDetails = async (ids, key) => {
    const u = new URL("https://www.googleapis.com/youtube/v3/videos");
    u.searchParams.set("part","contentDetails,statistics");
    u.searchParams.set("id", ids.join(","));
    u.searchParams.set("key", key);
    const r = await fetch(u);
    const d = await r.json();
    if (d.error) throw new Error(d.error.message || "API error");
    const map = new Map();
    (d.items || []).forEach(it => {
      map.set(it.id, {
        dur: it.contentDetails?.duration,
        views: it.statistics?.viewCount
      });
    });
    return map;
  };

  const openPlayer = (v) => {
    pTitle.textContent = v.title;
    pFrame.src = `https://www.youtube.com/embed/${v.vid}?autoplay=1`;
    WC.dlgOpen(dlgPlayer);
  };

  const closePlayer = () => {
    pFrame.src = "";
    WC.dlgClose(dlgPlayer);
  };

  const fillPlaylists = () => {
    const me = WC.sessionGet();
    const lists = WC.listsGet(me);
    aSelect.innerHTML = "";
    if (!lists.length) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "No playlists yet";
      aSelect.appendChild(o);
      aSelect.disabled = true;
      return;
    }
    aSelect.disabled = false;
    lists.forEach(l => {
      const o = document.createElement("option");
      o.value = l.id;
      o.textContent = l.title;
      aSelect.appendChild(o);
    });
  };

  const openAdd = (v) => {
    pending = v;
    aTitle.textContent = v.title;
    aNew.value = "";
    fillPlaylists();
    WC.dlgOpen(dlgAdd);
  };

  const closeAdd = () => {
    pending = null;
    WC.dlgClose(dlgAdd);
  };

  const card = (v) => {
    const me = WC.sessionGet();
    const saved = WC.hasAny(me, v.vid);

    return `
      <article class="result-card">
        ${saved ? `<div class="result-badge">Saved</div>` : ``}
        <div class="result-thumb">
          <img src="${v.thumb}" alt="${v.title}" loading="lazy">
          <button class="play-btn" data-play="${v.vid}">Play</button>
        </div>
        <div class="result-body">
          <div class="result-title" title="${v.title}">${v.title}</div>
          <div class="result-meta">
            <span>Length: ${WC.fmtIso(v.dur)}</span>
            <span>Views: ${WC.fmtCount(v.views)}</span>
            <span>Artist: ${v.chan}</span>
          </div>
          <div class="result-actions">
            <span class="chip">${v.chan}</span>
            <button class="btn ghost" data-add="${v.vid}" ${saved ? "disabled" : ""}>
              ${saved ? "In playlist" : "Add"}
            </button>
          </div>
        </div>
      </article>
    `;
  };

  const render = () => {
    grid.innerHTML = last.map(card).join("");
    grid.querySelectorAll("[data-play]").forEach(b => {
      b.addEventListener("click", () => {
        const vid = b.getAttribute("data-play");
        const v = last.find(x => x.vid === vid);
        if (v) openPlayer(v);
      });
    });
    grid.querySelectorAll("[data-add]").forEach(b => {
      b.addEventListener("click", () => {
        const vid = b.getAttribute("data-add");
        const v = last.find(x => x.vid === vid);
        if (v) openAdd(v);
      });
    });
  };

  const run = async (q) => {
    const key = WC.ytKeyGet();
    if (!key) { setInfo("Missing API key. Please add one.", true); WC.dlgOpen(dlgKey); return; }

    hideInfo();
    grid.innerHTML = "";
    setInfo("Loading results...");

    try {
      const items = await ytSearch(q, key);
      const ids = items.map(x => x.id.videoId);
      const det = await ytDetails(ids, key);

      last = items.map(x => {
        const vid = x.id.videoId;
        const d = det.get(vid) || {};
        return {
          vid,
          title: x.snippet.title,
          chan: x.snippet.channelTitle,
          thumb: x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url || "",
          dur: d.dur,
          views: d.views
        };
      });

      WC.qsSet("q", q);
      setInfo(`Found ${last.length} results for "${q}".`);
      render();
    } catch (e) {
      setInfo("Search failed. Try again.", true);
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    run(q);
  });

  // dialogs
  pClose.addEventListener("click", closePlayer);
  aCancel.addEventListener("click", closeAdd);

  kBtn.addEventListener("click", () => {
    kInput.value = WC.ytKeyGet();
    WC.dlgOpen(dlgKey);
  });
  kCancel.addEventListener("click", () => WC.dlgClose(dlgKey));
  kSave.addEventListener("click", () => {
    const k = kInput.value.trim();
    if (!k) { WC.popToast("Enter a valid API key"); return; }
    WC.ytKeySet(k);
    refreshKey();
    WC.dlgClose(dlgKey);
    WC.popToast("API key saved");
  });

  aOk.addEventListener("click", () => {
    if (!pending) return;
    const me = WC.sessionGet();
    const newName = aNew.value.trim();
    let listId = aSelect.value;
    let created = null;

    if (newName) {
      created = WC.listCreate(me, newName);
      listId = created.id;
    }
    if (!listId) { WC.popToast("Choose playlist or create new"); return; }

    const res = WC.trackAdd(me, listId, pending);
    if (!res.ok && res.why === "dup") {
      WC.popToast("Already exists in that playlist");
    } else {
      const list = res.list || created;
      WC.popToast("Added!", { link: { href: `playlists.html?list=${listId}`, text: `Open ${list?.title || "playlist"}` }});
    }
    closeAdd();
    render();
  });

  // init
  refreshKey();
  const q0 = WC.qsGet("q");
  if (q0) { input.value = q0; run(q0); }
})();


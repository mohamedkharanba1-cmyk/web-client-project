(() => {
  "use strict";

  if (!WC.mustAuth()) return;
  WC.navSync();

  const me = WC.sessionGet();

  const side = document.getElementById("plSide");
  const items = document.getElementById("plItems");
  const title = document.getElementById("plTitle");
  const meta = document.getElementById("plMeta");
  const empty = document.getElementById("plEmpty");

  const btnNew = document.getElementById("plNew");
  const btnPlay = document.getElementById("plPlay");
  const btnAZ = document.getElementById("plAZ");
  const btnRate = document.getElementById("plRate");
  const btnDel = document.getElementById("plDel");
  const filter = document.getElementById("plFilter");

  const dlgNew = document.getElementById("dlgNewList");
  const inNew = document.getElementById("newListName");
  const newOk = document.getElementById("newOk");
  const newCancel = document.getElementById("newCancel");

  const dlgPlayer = document.getElementById("dlgListPlayer");
  const frame = document.getElementById("lpFrame");
  const lpTitle = document.getElementById("lpTitle");
  const lpPrev = document.getElementById("lpPrev");
  const lpNext = document.getElementById("lpNext");
  const lpClose = document.getElementById("lpClose");

  let lists = WC.listsGet(me);
  let activeId = WC.qsGet("list");
  let sort = "none";
  let term = "";
  let q = [];
  let idx = 0;

  const refresh = () => {
    lists = WC.listsGet(me);
    if (!lists.length) {
      activeId = null;
      WC.qsSet("list", "");
      return;
    }
    if (!activeId || !lists.some(l => l.id === activeId)) {
      activeId = lists[0].id;
      WC.qsSet("list", activeId);
    }
  };

  const active = () => lists.find(l => l.id === activeId) || null;

  const visibleTracks = (arr) => {
    let out = [...arr];
    if (term) {
      const t = term.toLowerCase();
      out = out.filter(x => (x.title || "").toLowerCase().includes(t));
    }
    if (sort === "az") out.sort((a,b) => (a.title||"").localeCompare(b.title||""));
    if (sort === "rate") out.sort((a,b) => (b.stars||0) - (a.stars||0));
    return out;
  };

  const setEmpty = (t) => { empty.textContent = t; empty.hidden = false; };
  const clearEmpty = () => empty.hidden = true;

  const sideRender = () => {
    side.innerHTML = "";
    if (!lists.length) {
      side.innerHTML = `<div class="muted small">No playlists yet.</div>`;
      return;
    }
    lists.forEach(l => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sidebar-item" + (l.id === activeId ? " active" : "");
      b.textContent = l.title;
      b.onclick = () => {
        activeId = l.id;
        WC.qsSet("list", l.id);
        sideRender();
        mainRender();
      };
      side.appendChild(b);
    });
  };

  const openPlayer = (arr, i) => {
    if (!arr.length) { WC.popToast("Nothing to play"); return; }
    q = arr;
    idx = Math.max(0, Math.min(i, arr.length - 1));
    const cur = q[idx];
    lpTitle.textContent = cur.title;
    frame.src = `https://www.youtube.com/embed/${cur.vid}?autoplay=1`;
    WC.dlgOpen(dlgPlayer);
  };

  const closePlayer = () => { frame.src = ""; WC.dlgClose(dlgPlayer); };

  const mainRender = () => {
    const l = active();

    btnAZ.textContent = sort === "az" ? "Sort A-Z ✓" : "Sort A-Z";
    btnRate.textContent = sort === "rate" ? "Sort by rating ✓" : "Sort by rating";

    if (!l) {
      title.textContent = "Pick a playlist";
      meta.textContent = "";
      items.innerHTML = "";
      btnDel.disabled = true;
      btnPlay.disabled = true;
      setEmpty("Create a playlist to get started.");
      return;
    }

    btnDel.disabled = false;
    title.textContent = l.title;
    meta.textContent = `${l.tracks.length} tracks`;
    btnPlay.disabled = l.tracks.length === 0;

    const view = visibleTracks(l.tracks);
    items.innerHTML = "";

    if (!view.length) {
      setEmpty(term ? "No matches." : "Playlist is empty.");
      return;
    }
    clearEmpty();

    view.forEach((t, i) => {
      const card = document.createElement("div");
      card.className = "song-card";

      const img = document.createElement("img");
      img.src = t.thumb || "https://via.placeholder.com/120x72?text=Video";
      img.alt = t.title;

      const mid = document.createElement("div");
      const tt = document.createElement("div");
      tt.className = "song-title";
      tt.textContent = t.title;

      const meta = document.createElement("div");
      meta.className = "song-meta";
      meta.innerHTML = `
        <span>Artist: ${t.chan || ""}</span>
        <span>Length: ${WC.fmtIso(t.dur)}</span>
        <span>Views: ${WC.fmtCount(t.views)}</span>
      `;

      mid.appendChild(tt);
      mid.appendChild(meta);

      const act = document.createElement("div");
      act.className = "song-actions";

      const stars = document.createElement("div");
      stars.className = "rating";
      for (let s = 1; s <= 5; s++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "star" + (s <= (t.stars || 0) ? " active" : "");
        b.textContent = s <= (t.stars || 0) ? "★" : "☆";
        b.onclick = () => {
          WC.trackUpdate(me, l.id, t.vid, { stars: s });
          refresh();
          mainRender();
        };
        stars.appendChild(b);
      }

      const play = document.createElement("button");
      play.type = "button";
      play.className = "btn ghost";
      play.textContent = "Play";
      play.onclick = () => openPlayer(view, i);

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn ghost";
      rm.textContent = "Remove";
      rm.onclick = () => {
        if (!confirm("Remove this track?")) return;
        WC.trackRemove(me, l.id, t.vid);
        refresh();
        mainRender();
      };

      act.appendChild(stars);
      act.appendChild(play);
      act.appendChild(rm);

      card.appendChild(img);
      card.appendChild(mid);
      card.appendChild(act);

      items.appendChild(card);
    });
  };

  // events
  btnNew.onclick = () => { inNew.value = ""; WC.dlgOpen(dlgNew); };
  newCancel.onclick = () => WC.dlgClose(dlgNew);
  newOk.onclick = () => {
    const name = inNew.value.trim();
    if (!name) { WC.popToast("Enter a playlist name"); return; }
    const created = WC.listCreate(me, name);
    activeId = created.id;
    WC.qsSet("list", activeId);
    WC.dlgClose(dlgNew);
    refresh();
    sideRender();
    mainRender();
    WC.popToast("Playlist created");
  };

  filter.addEventListener("input", (e) => { term = e.target.value.trim(); mainRender(); });
  btnAZ.onclick = () => { sort = (sort === "az") ? "none" : "az"; mainRender(); };
  btnRate.onclick = () => { sort = (sort === "rate") ? "none" : "rate"; mainRender(); };

  btnDel.onclick = () => {
    const l = active();
    if (!l) return;
    if (!confirm("Delete this playlist?")) return;
    const remain = WC.listDelete(me, l.id);
    activeId = remain[0]?.id || null;
    WC.qsSet("list", activeId || "");
    refresh();
    sideRender();
    mainRender();
    WC.popToast("Deleted");
  };

  btnPlay.onclick = () => {
    const l = active();
    if (!l || !l.tracks.length) return;
    openPlayer(visibleTracks(l.tracks), 0);
  };

  lpClose.onclick = closePlayer;
  lpPrev.onclick = () => { if (!q.length) return; idx = (idx - 1 + q.length) % q.length; openPlayer(q, idx); };
  lpNext.onclick = () => { if (!q.length) return; idx = (idx + 1) % q.length; openPlayer(q, idx); };

  dlgPlayer.addEventListener("click", (e) => { if (e.target === dlgPlayer) closePlayer(); });

  // init
  refresh();
  sideRender();
  mainRender();
})();


import { requireAuth, renderHeader, getUsers, saveUsers } from "./app.js";

const current = requireAuth();      // {username, firstName, imageUrl}
renderHeader();

const playlistListEl = document.getElementById("playlistList");
const playlistHeaderEl = document.getElementById("playlistHeader");
const playlistVideosEl = document.getElementById("playlistVideos");

const newPlaylistBtn = document.getElementById("newPlaylistBtn");
const filterEl = document.getElementById("filter");
const sortAZBtn = document.getElementById("sortAZ");
const sortRatingBtn = document.getElementById("sortRating");

let state = {
  selectedPlaylistId: null,
  filter: "",
  sort: "none" // "az" | "rating" | "none"
};

function uid(prefix = "pl") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function loadUser() {
  const users = getUsers();
  const u = users.find(x => (x.username || "").toLowerCase() === current.username.toLowerCase());
  return u || null;
}

function updateUser(mutator) {
  const users = getUsers();
  const i = users.findIndex(x => (x.username || "").toLowerCase() === current.username.toLowerCase());
  if (i === -1) return null;
  const copy = structuredClone(users[i]);
  mutator(copy);
  users[i] = copy;
  saveUsers(users);
  return copy;
}

function getSelectedPlaylist(user) {
  if (!user?.playlists?.length) return null;
  return user.playlists.find(p => p.id === state.selectedPlaylistId) || user.playlists[0];
}

function setQueryStringPlaylist(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("id", id);
  else url.searchParams.delete("id");
  history.replaceState({}, "", url);
}

function renderSidebar(user) {
  playlistListEl.innerHTML = "";

  const pls = user?.playlists || [];
  if (pls.length === 0) {
    playlistListEl.innerHTML = `<li style="color:#777;">אין פלייליסטים עדיין</li>`;
    return;
  }

  for (const p of pls) {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.style.padding = "6px";
    li.style.borderRadius = "6px";
    li.style.marginBottom = "4px";

    const active = p.id === state.selectedPlaylistId;
    if (active) li.style.background = "#eee";

    li.textContent = p.name;

    li.addEventListener("click", () => {
      state.selectedPlaylistId = p.id;
      setQueryStringPlaylist(p.id);
      renderAll();
    });

    playlistListEl.appendChild(li);
  }
}

function renderMain(user) {
  const pl = getSelectedPlaylist(user);

  if (!pl) {
    playlistHeaderEl.innerHTML = `<p style="color:#777;">בחר פלייליסט מהרשימה.</p>`;
    playlistVideosEl.innerHTML = "";
    return;
  }

  // אם לא היה id ב-querystring, קבע לברירת מחדל
  if (!state.selectedPlaylistId) {
    state.selectedPlaylistId = pl.id;
    setQueryStringPlaylist(pl.id);
  }

  playlistHeaderEl.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <h2 style="margin:0;">${pl.name}</h2>
      <button id="deletePlaylistBtn" style="margin-inline-start:auto;">מחק פלייליסט</button>
      <button id="playPlaylistBtn">נגן פלייליסט</button>
    </div>
  `;

  document.getElementById("deletePlaylistBtn").onclick = () => {
    if (!confirm(`למחוק את הפלייליסט "${pl.name}"?`)) return;
    updateUser(u => {
      u.playlists = (u.playlists || []).filter(x => x.id !== pl.id);
    });
    // אחרי מחיקה טען מחדש ובחר ראשון אם קיים
    state.selectedPlaylistId = null;
    renderAll();
  };

  document.getElementById("playPlaylistBtn").onclick = () => {
    alert("בונוס: אפשר לממש ניגון רציף. כרגע לא חובה.");
  };

  // סינון + מיון
  let vids = [...(pl.videos || [])];

  const f = (state.filter || "").toLowerCase();
  if (f) vids = vids.filter(v => (v.title || "").toLowerCase().includes(f));

  if (state.sort === "az") {
    vids.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (state.sort === "rating") {
    vids.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  }

  if (vids.length === 0) {
    playlistVideosEl.innerHTML = `<p style="color:#777;">אין סרטונים להציג.</p>`;
    return;
  }

  playlistVideosEl.innerHTML = vids.map(v => `
    <div data-vid="${v.videoId}" style="border:1px solid #ddd; padding:10px; margin:10px 0; display:flex; gap:12px;">
      <img src="${v.thumbnail || ""}" style="width:160px; object-fit:cover;">
      <div style="flex:1;">
        <div style="font-weight:700;">${v.title || ""}</div>
        <div style="margin-top:8px;">
          דירוג:
          <select class="ratingSel">
            ${[0,1,2,3,4,5].map(r => `<option value="${r}" ${Number(v.rating||0)===r?'selected':''}>${r}</option>`).join("")}
          </select>
          <button class="removeBtn" style="margin-inline-start:10px;">מחק מהפלייליסט</button>
        </div>
      </div>
    </div>
  `).join("");

  // חיבור events אחרי render
  playlistVideosEl.querySelectorAll("[data-vid]").forEach(card => {
    const videoId = card.getAttribute("data-vid");
    const ratingSel = card.querySelector(".ratingSel");
    const removeBtn = card.querySelector(".removeBtn");

    ratingSel.addEventListener("change", () => {
      const newRating = Number(ratingSel.value);
      updateUser(u => {
        const p = (u.playlists || []).find(x => x.id === pl.id);
        if (!p) return;
        const vv = (p.videos || []).find(x => x.videoId === videoId);
        if (vv) vv.rating = newRating;
      });
    });

    removeBtn.addEventListener("click", () => {
      updateUser(u => {
        const p = (u.playlists || []).find(x => x.id === pl.id);
        if (!p) return;
        p.videos = (p.videos || []).filter(x => x.videoId !== videoId);
      });
      renderAll();
    });
  });
}

function renderAll() {
  const user = loadUser();
  if (!user) return;

  // אם אין playlists field, תוסיף
  if (!Array.isArray(user.playlists)) {
    updateUser(u => { u.playlists = []; });
  }

  // קבלת id מה-QueryString
  const qsId = new URLSearchParams(location.search).get("id");
  if (qsId) state.selectedPlaylistId = qsId;

  renderSidebar(user);
  renderMain(user);
}

// --- controls ---
newPlaylistBtn.addEventListener("click", () => {
  const name = prompt("שם פלייליסט חדש:");
  if (!name || !name.trim()) return;

  const newPl = { id: uid(), name: name.trim(), videos: [] };

  const updated = updateUser(u => {
    u.playlists = u.playlists || [];
    u.playlists.push(newPl);
  });

  state.selectedPlaylistId = newPl.id;
  setQueryStringPlaylist(newPl.id);
  renderAll();
});

filterEl.addEventListener("input", () => {
  state.filter = filterEl.value || "";
  renderAll();
});

sortAZBtn.addEventListener("click", () => {
  state.sort = (state.sort === "az") ? "none" : "az";
  renderAll();
});

sortRatingBtn.addEventListener("click", () => {
  state.sort = (state.sort === "rating") ? "none" : "rating";
  renderAll();
});

// init
renderAll();

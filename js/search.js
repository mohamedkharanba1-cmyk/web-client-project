import { requireAuth, renderHeader, getUsers, saveUsers } from "./app.js";
import { YT_API_KEY } from "./config.js";

const current = requireAuth(); // {username, firstName, imageUrl}
renderHeader();

const form = document.getElementById("searchForm");
const input = document.getElementById("q");
const resultsEl = document.getElementById("results");

// Modal נגן
const modal = document.getElementById("modal");
const player = document.getElementById("player");
const closeModalBtn = document.getElementById("closeModal");

// Toast + Modal מועדפים
const toastEl = document.getElementById("toast");
const favModal = document.getElementById("favModal");
const playlistSelect = document.getElementById("playlistSelect");
const newPlaylistName = document.getElementById("newPlaylistName");
const favConfirm = document.getElementById("favConfirm");
const favCancel = document.getElementById("favCancel");
const favError = document.getElementById("favError");

let pendingVideo = null; // הסרטון שמנסים להוסיף

// ---------- Player modal ----------
closeModalBtn.addEventListener("click", () => {
  modal.style.display = "none";
  player.innerHTML = "";
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
    player.innerHTML = "";
  }
});

function openPlayer(videoId) {
  modal.style.display = "block";
  player.innerHTML = `
    <iframe width="100%" height="480"
      src="https://www.youtube.com/embed/${videoId}"
      title="YouTube player"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen></iframe>`;
}

// ---------- helpers ----------
function setQueryString(q) {
  const url = new URL(location.href);
  if (q && q.trim()) url.searchParams.set("q", q.trim());
  else url.searchParams.delete("q");
  history.replaceState({}, "", url);
}

function formatViews(n) {
  return Number(n || 0).toLocaleString("en-US");
}

// ISO8601 duration -> "H:MM:SS" / "M:SS"
function formatDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = Number(m?.[1] || 0);
  const min = Number(m?.[2] || 0);
  const s = Number(m?.[3] || 0);
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${min}:${String(s).padStart(2, "0")}`;
}

function showToast(html, ms = 4500) {
  toastEl.innerHTML = html;
  toastEl.style.display = "block";
  setTimeout(() => (toastEl.style.display = "none"), ms);
}

function uid(prefix = "pl") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function loadUserFromLocal() {
  const users = getUsers();
  return users.find(u => (u.username || "").toLowerCase() === current.username.toLowerCase()) || null;
}

function saveUserToLocal(updatedUser) {
  const users = getUsers();
  const i = users.findIndex(u => (u.username || "").toLowerCase() === current.username.toLowerCase());
  if (i === -1) return;
  users[i] = updatedUser;
  saveUsers(users);
}

// האם סרטון כבר קיים באחת הרשימות?
function isVideoInAnyPlaylist(user, videoId) {
  return (user.playlists || []).some(pl => (pl.videos || []).some(v => v.videoId === videoId));
}

// ---------- YouTube API ----------
async function ytSearch(q) {
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}` +
    `&key=${encodeURIComponent(YT_API_KEY)}`;

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "YouTube search failed");
  return data.items || [];
}

async function ytVideoDetails(videoIds) {
  if (videoIds.length === 0) return new Map();

  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=contentDetails,statistics&id=${encodeURIComponent(videoIds.join(","))}` +
    `&key=${encodeURIComponent(YT_API_KEY)}`;

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "YouTube videos.list failed");

  const map = new Map();
  for (const item of data.items || []) {
    map.set(item.id, {
      duration: item.contentDetails?.duration || "PT0S",
      views: item.statistics?.viewCount || 0,
    });
  }
  return map;
}

// ---------- Favorites modal ----------
function openFavModal(videoObj) {
  const user = loadUserFromLocal();
  if (!user) return;

  // אם אין playlists array
  if (!Array.isArray(user.playlists)) {
    user.playlists = [];
    saveUserToLocal(user);
  }

  pendingVideo = videoObj;
  favError.textContent = "";
  newPlaylistName.value = "";

  // למלא dropdown
  playlistSelect.innerHTML = "";
  if (user.playlists.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "אין פלייליסטים קיימים";
    playlistSelect.appendChild(opt);
  } else {
    for (const pl of user.playlists) {
      const opt = document.createElement("option");
      opt.value = pl.id;
      opt.textContent = pl.name;
      playlistSelect.appendChild(opt);
    }
  }

  favModal.style.display = "block";
}

function closeFavModal() {
  favModal.style.display = "none";
  pendingVideo = null;
  favError.textContent = "";
}

favCancel.addEventListener("click", closeFavModal);
favModal.addEventListener("click", (e) => {
  if (e.target === favModal) closeFavModal();
});

favConfirm.addEventListener("click", () => {
  if (!pendingVideo) return;

  const user = loadUserFromLocal();
  if (!user) return;

  user.playlists = user.playlists || [];

  const wantNew = newPlaylistName.value.trim();
  const selectedId = playlistSelect.value;

  let targetPlaylist = null;

  if (wantNew) {
    // ליצור פלייליסט חדש
    targetPlaylist = { id: uid(), name: wantNew, videos: [] };
    user.playlists.push(targetPlaylist);
  } else {
    // לבחור קיים
    targetPlaylist = user.playlists.find(p => p.id === selectedId) || null;
  }

  if (!targetPlaylist) {
    favError.textContent = "בחר פלייליסט קיים או כתוב שם לפלייליסט חדש.";
    return;
  }

  targetPlaylist.videos = targetPlaylist.videos || [];

  // אם כבר קיים באותה רשימה – לא להוסיף כפול
  const alreadyInTarget = targetPlaylist.videos.some(v => v.videoId === pendingVideo.videoId);
  if (!alreadyInTarget) {
    targetPlaylist.videos.push({
      videoId: pendingVideo.videoId,
      title: pendingVideo.title,
      thumbnail: pendingVideo.thumbnail,
      rating: 0
    });
  }

  saveUserToLocal(user);
  closeFavModal();

  // Toast עם קישור מהיר ל-playlists?id=...
  showToast(`
    נשמר למועדפים ✅<br/>
    <a href="playlists.html?id=${encodeURIComponent(targetPlaylist.id)}" style="color:#7dd3fc;">
      מעבר מהיר לפלייליסט
    </a>
  `);

  // לרענן את התוצאות כדי לסמן V / להפוך כפתור לאפור
  markFavoritesOnCards();
});

// ---------- render cards ----------
function cardHTML({ videoId, title, thumb, duration, views, channelTitle }) {
  return `
  <div class="card" data-id="${videoId}" style="position:relative; display:flex; gap:12px; border:1px solid #ddd; padding:10px; margin:10px 0;">
    <div class="checkMark" style="display:none; position:absolute; top:8px; right:8px; font-size:20px;">✅</div>

    <img class="thumb" src="${thumb}" alt="thumb" style="width:220px; cursor:pointer; object-fit:cover;">
    <div style="flex:1;">
      <div class="title"
           title="${title.replaceAll('"', "&quot;")}"
           style="
             font-weight:700;
             cursor:pointer;
             display:-webkit-box;
             -webkit-line-clamp:2;
             -webkit-box-orient:vertical;
             overflow:hidden;">
        ${title}
      </div>

      <div style="margin-top:6px; font-size:14px; color:#444;">
        <div>Channel: ${channelTitle || ""}</div>
        <div>Duration: <b>${duration}</b></div>
        <div>Views: <b>${formatViews(views)}</b></div>
      </div>

      <div style="margin-top:10px;">
        <button class="addFavBtn">הוסף למועדפים</button>
      </div>
    </div>
  </div>`;
}

async function search(q) {
  resultsEl.innerHTML = `<p>מחפש: <b>${q}</b> ...</p>`;

  const items = await ytSearch(q);
  const videoIds = items.map(x => x.id?.videoId).filter(Boolean);
  const detailsMap = await ytVideoDetails(videoIds);

  const cards = items.map((x) => {
    const videoId = x.id.videoId;
    const title = x.snippet?.title || "";
    const channelTitle = x.snippet?.channelTitle || "";
    const thumb = x.snippet?.thumbnails?.medium?.url || x.snippet?.thumbnails?.default?.url || "";
    const det = detailsMap.get(videoId) || { duration: "PT0S", views: 0 };

    return cardHTML({
      videoId,
      title,
      channelTitle,
      thumb,
      duration: formatDuration(det.duration),
      views: det.views,
    });
  });

  resultsEl.innerHTML = cards.join("") || "<p>אין תוצאות.</p>";

  // events
  resultsEl.querySelectorAll(".card").forEach((card) => {
    const videoId = card.getAttribute("data-id");
    const titleText = card.querySelector(".title").textContent;

    card.querySelector(".thumb").addEventListener("click", () => openPlayer(videoId));
    card.querySelector(".title").addEventListener("click", () => openPlayer(videoId));

    card.querySelector(".addFavBtn").addEventListener("click", () => {
      openFavModal({
        videoId,
        title: titleText,
        thumbnail: card.querySelector(".thumb").src
      });
    });
  });

  // לסמן סרטונים שכבר קיימים
  markFavoritesOnCards();
}

function markFavoritesOnCards() {
  const user = loadUserFromLocal();
  if (!user) return;

  resultsEl.querySelectorAll(".card").forEach(card => {
    const videoId = card.getAttribute("data-id");
    const inFav = isVideoInAnyPlaylist(user, videoId);

    const check = card.querySelector(".checkMark");
    const btn = card.querySelector(".addFavBtn");

    if (inFav) {
      check.style.display = "block";
      btn.disabled = true;
      btn.style.background = "#ddd";
      btn.style.cursor = "not-allowed";
      btn.textContent = "כבר במועדפים";
    } else {
      check.style.display = "none";
      btn.disabled = false;
      btn.style.background = "";
      btn.style.cursor = "pointer";
      btn.textContent = "הוסף למועדפים";
    }
  });
}

// submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  setQueryString(q);

  try {
    await search(q);
  } catch (err) {
    resultsEl.innerHTML = `<p style="color:red;">שגיאה: ${err.message}</p>`;
  }
});

// load from QueryString
const q0 = new URLSearchParams(location.search).get("q");
if (q0) {
  input.value = q0;
  search(q0).catch(err => {
    resultsEl.innerHTML = `<p style="color:red;">שגיאה: ${err.message}</p>`;
  });
}



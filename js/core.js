(() => {
  "use strict";

  const KEYS = Object.freeze({
    USERS: "wc_v2_users",
    LISTS: "wc_v2_lists",
    SESSION: "wc_v2_session_user",
    YTKEY: "wc_v2_youtube_key",
  });

  const jread = (key, fallback) => {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  };

  const jwrite = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const usersAll = () => jread(KEYS.USERS, []);
  const usersSave = (arr) => jwrite(KEYS.USERS, arr);

  const userFind = (name) =>
    usersAll().find(u => (u.handle || "").toLowerCase() === (name || "").toLowerCase()) || null;

  const sessionSet = (handle) => sessionStorage.setItem(KEYS.SESSION, handle);
  const sessionGet = () => sessionStorage.getItem(KEYS.SESSION);
  const sessionClear = () => sessionStorage.removeItem(KEYS.SESSION);

  const profileCurrent = () => {
    const h = sessionGet();
    if (!h) return null;
    return userFind(h) || { handle: h, displayName: h };
  };

  const listsMap = () => jread(KEYS.LISTS, {});
  const listsMapSave = (m) => jwrite(KEYS.LISTS, m);

  const listsGet = (handle) => {
    const m = listsMap();
    return Array.isArray(m[handle]) ? m[handle] : [];
  };

  const listsSet = (handle, lists) => {
    const m = listsMap();
    m[handle] = lists;
    listsMapSave(m);
  };

  const idMake = () =>
    (crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);

  const listCreate = (handle, title) => {
    const lists = listsGet(handle);
    const list = { id: idMake(), title: title.trim(), createdAt: Date.now(), tracks: [] };
    lists.unshift(list);
    listsSet(handle, lists);
    return list;
  };

  const trackAdd = (handle, listId, track) => {
    const lists = listsGet(handle);
    const list = lists.find(l => l.id === listId);
    if (!list) return { ok: false, why: "no_list" };

    if (list.tracks.some(t => t.vid === track.vid)) {
      return { ok: false, why: "dup", list };
    }

    list.tracks.unshift({ ...track, stars: 0, addedAt: Date.now() });
    listsSet(handle, lists);
    return { ok: true, list };
  };

  const trackUpdate = (handle, listId, vid, patch) => {
    const lists = listsGet(handle);
    const list = lists.find(l => l.id === listId);
    if (!list) return false;
    const t = list.tracks.find(x => x.vid === vid);
    if (!t) return false;
    Object.assign(t, patch);
    listsSet(handle, lists);
    return true;
  };

  const trackRemove = (handle, listId, vid) => {
    const lists = listsGet(handle);
    const list = lists.find(l => l.id === listId);
    if (!list) return false;
    list.tracks = list.tracks.filter(x => x.vid !== vid);
    listsSet(handle, lists);
    return true;
  };

  const listDelete = (handle, listId) => {
    const remain = listsGet(handle).filter(l => l.id !== listId);
    listsSet(handle, remain);
    return remain;
  };

  const hasAny = (handle, vid) =>
    listsGet(handle).some(l => (l.tracks || []).some(t => t.vid === vid));

  const pageNow = () => {
    const file = (location.pathname.split("/").pop() || "index.html");
    return file + (location.search || "");
  };

  const mustAuth = () => {
    if (sessionGet()) return true;
    location.href = `login.html?go=${encodeURIComponent(pageNow())}`;
    return false;
  };

  const qsGet = (k) => new URLSearchParams(location.search).get(k);
  const qsSet = (k, v) => {
    const u = new URL(location.href);
    if (!v) u.searchParams.delete(k);
    else u.searchParams.set(k, v);
    history.replaceState({}, "", u);
  };

  const fmtIso = (iso) => {
    const m = (iso || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return "--:--";
    const h = Number(m[1] || 0), mm = Number(m[2] || 0), s = Number(m[3] || 0);
    const sec = String(s).padStart(2, "0");
    if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${sec}`;
    return `${mm}:${sec}`;
  };

  const fmtCount = (n) => {
    const x = Number(n || 0);
    if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
    if (x >= 1_000) return `${(x / 1_000).toFixed(1)}K`;
    return String(x);
  };

  const toast = () => {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.body.appendChild(el);
    }
    return el;
  };

  const popToast = (text, opt = {}) => {
    const el = toast();
    el.innerHTML = "";
    const span = document.createElement("span");
    span.textContent = text;
    el.appendChild(span);

    if (opt.link) {
      const a = document.createElement("a");
      a.href = opt.link.href;
      a.textContent = opt.link.text;
      a.className = "text-link";
      el.appendChild(a);
    }

    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), opt.ms || 2600);
  };

  const dlgOpen = (d) => d?.showModal ? d.showModal() : d?.setAttribute("open", "");
  const dlgClose = (d) => d?.close ? d.close() : d?.removeAttribute("open");

  const ytKeyGet = () => localStorage.getItem(KEYS.YTKEY) || "";
  const ytKeySet = (k) => localStorage.setItem(KEYS.YTKEY, k);

  const navSync = () => {
    const logged = Boolean(sessionGet());
    document.querySelectorAll("[data-show-in]").forEach(el => el.hidden = !logged);
    document.querySelectorAll("[data-show-out]").forEach(el => el.hidden = logged);

    const p = profileCurrent();
    document.querySelectorAll("[data-name]").forEach(el => el.textContent = p ? (p.displayName || p.handle) : "");
    document.querySelectorAll("[data-avatar]").forEach(el => {
      if (p?.avatar) el.src = p.avatar;
    });

    document.querySelectorAll("[data-logout]").forEach(btn => {
      btn.onclick = () => { sessionClear(); location.href = "login.html"; };
    });
  };

  const boot = () => navSync();

  window.WC = {
    KEYS,
    usersAll, usersSave, userFind,
    sessionSet, sessionGet, sessionClear,
    profileCurrent,
    listsGet, listsSet, listCreate,
    trackAdd, trackUpdate, trackRemove, listDelete,
    hasAny,
    mustAuth,
    qsGet, qsSet,
    fmtIso, fmtCount,
    popToast,
    dlgOpen, dlgClose,
    ytKeyGet, ytKeySet,
    navSync,
  };

  document.addEventListener("DOMContentLoaded", boot);
})();

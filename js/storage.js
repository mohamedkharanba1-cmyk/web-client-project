export function getUsers() {
  return JSON.parse(localStorage.getItem("users")) || [];
}

export function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

export function getCurrentUser() {
  return JSON.parse(sessionStorage.getItem("currentUser"));
}

export function setCurrentUser(user) {
  sessionStorage.setItem("currentUser", JSON.stringify(user));
}

export function requireAuth() {
  const u = getCurrentUser();
  if (!u) location.href = "login.html";
}

export function renderHeader() {
  const u = getCurrentUser();
  const header = document.getElementById("header");
  if (!header) return;
  if (!u) {
    header.innerHTML = `<a href="login.html">Login</a> | <a href="register.html">Register</a>`;
    return;
  }
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
      <img src="${u.imageUrl}" alt="user" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
      <div>שלום ${u.firstName}</div>
      <a style="margin-left:auto;" href="search.html">Search</a>
      <a href="playlists.html">Playlists</a>
      <button id="logoutBtn">Logout</button>
    </div>
  `;
  const btn = document.getElementById("logoutBtn");
  btn?.addEventListener("click", () => {
    sessionStorage.removeItem("currentUser");
    location.href = "login.html";
  });
}

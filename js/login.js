(() => {
  "use strict";

  const form = document.getElementById("logForm");
  const msg = document.getElementById("logMsg");
  const uEl = document.getElementById("logHandle");
  const pEl = document.getElementById("logPass");

  const go = WC.qsGet("go");

  const show = (t, bad=false) => {
    msg.textContent = t;
    msg.classList.toggle("error", bad);
    msg.hidden = false;
  };

  if (WC.sessionGet()) {
    location.href = "search.html";
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const handle = uEl.value.trim();
    const pass = pEl.value;

    if (!handle || !pass) { show("Enter username + password.", true); return; }

    const user = WC.userFind(handle);
    if (!user || user.password !== pass) { show("Wrong username or password.", true); return; }

    WC.sessionSet(user.handle);
    WC.navSync();
    location.href = go ? decodeURIComponent(go) : "search.html";
  });
})();


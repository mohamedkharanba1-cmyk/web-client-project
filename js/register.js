(() => {
  "use strict";

  const form = document.getElementById("regForm");
  const msg = document.getElementById("regMsg");

  const show = (t, bad=false) => {
    msg.textContent = t;
    msg.classList.toggle("error", bad);
    msg.hidden = false;
  };

  const okEmail = (v) => /.+@.+\..+/.test(v);
  const okPass = (v) => /^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(v);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const handle = document.getElementById("regHandle").value.trim();
    const displayName = document.getElementById("regName").value.trim();
    const email = document.getElementById("regMail").value.trim();
    const avatar = document.getElementById("regAvatar").value.trim();
    const pass = document.getElementById("regPass").value;
    const pass2 = document.getElementById("regPass2").value;

    if (!handle || !displayName || !email || !avatar || !pass || !pass2) {
      show("All fields are required.", true); return;
    }
    if (WC.userFind(handle)) {
      show("This username already exists.", true); return;
    }
    if (!okEmail(email)) {
      show("Email is not valid.", true); return;
    }
    try { new URL(avatar); } catch { show("Avatar URL is not valid.", true); return; }
    if (!okPass(pass)) {
      show("Password: 6+ chars, include letter and number.", true); return;
    }
    if (pass !== pass2) {
      show("Passwords do not match.", true); return;
    }

    const users = WC.usersAll();
    users.push({
      handle,
      displayName,
      email,
      avatar,
      password: pass,
      createdAt: Date.now()
    });
    WC.usersSave(users);

    show("Account created! Redirecting...", false);
    setTimeout(() => location.href = "login.html", 900);
  });
})();





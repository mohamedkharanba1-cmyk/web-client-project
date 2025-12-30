// register.js
import { getUsers, saveUsers } from "./storage.js";

form.onsubmit = (e) => {
  e.preventDefault();

  const users = getUsers();
  if (users.find(u => u.username === username)) {
    alert("Username already exists");
    return;
  }

  users.push({
    username,
    password,
    firstName,
    imageUrl,
    playlists: []
  });

  saveUsers(users);
  location.href = "login.html";
};

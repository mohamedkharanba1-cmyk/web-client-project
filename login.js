// login.js
sessionStorage.setItem("currentUser", JSON.stringify(user));
location.href = "search.html";
const user = JSON.parse(sessionStorage.getItem("currentUser"));
if (!user) location.href = "login.html";

document.getElementById("header").innerHTML = `
  <img src="${user.imageUrl}">
  <span>שלום ${user.firstName}</span>
`;

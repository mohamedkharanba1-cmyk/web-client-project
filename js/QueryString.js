import { requireAuth, renderHeader } from "./app.js";
requireAuth();
renderHeader();

const form = document.getElementById("searchForm");
const input = document.getElementById("q");

function setQueryString(q) {
  const url = new URL(location.href);
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  history.replaceState({}, "", url);
}

async function doSearch(q) {
  // TODO: פה תעשה קריאה ל-YouTube API ותציג כרטיסיות
  document.getElementById("results").textContent = `מחפש: ${q}`;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  setQueryString(q);
  doSearch(q);
});

// טעינה עם QueryString
const q0 = new URLSearchParams(location.search).get("q");
if (q0) {
  input.value = q0;
  doSearch(q0);
}






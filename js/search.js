const q = new URLSearchParams(location.search).get("q");
if (q) {
  input.value = q;
  search(q);
}

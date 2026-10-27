/* join.html · reads ?code= and builds the signup link. APP_SIGNUP_URL comes from assets/join-switches.js */
(() => {
  // only letters, digits and dashes, 3 to 32 long; anything else is ignored
  const raw = new URLSearchParams(location.search).get("code") || "";
  const code = /^[A-Za-z0-9-]{3,32}$/.test(raw) ? raw.toUpperCase() : "";
  const start = document.getElementById("start");
  if (!code) return;
  document.getElementById("code").textContent = code;
  document.getElementById("code-box").hidden = false;
  document.getElementById("nocode").hidden = true;
  const u = new URL(APP_SIGNUP_URL); u.searchParams.set("code", code);
  start.href = u.toString();
})();

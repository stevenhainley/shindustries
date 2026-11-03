// Movember banner on the homepage. The one switch: the banner shows only while
// Date.now() < MOVEMBER_UNTIL, i.e. until the end of November 30, 2026, US Eastern.
// The HTML ships it hidden, so with no JS or after the cutoff nothing shows.
// Loaded right after the banner markup (not deferred) so it appears before the
// header paints and the hero never jumps. No tracking, no cookies.
const MOVEMBER_UNTIL = "2026-12-01T05:00:00Z";

(() => {
  const el = document.getElementById("mo");
  if (!el) return;
  if (!(Date.now() < Date.parse(MOVEMBER_UNTIL))) { el.remove(); return; }
  // Pages kept alive past the cutoff (Back/Forward cache, a tab left open) check again.
  const left = () => Date.parse(MOVEMBER_UNTIL) - Date.now();
  const relayout = () => dispatchEvent(new Event("resize")); // explain.js re-measures its snap points on resize
  const recheck = () => { if (el.isConnected && !(left() > 0)) { el.remove(); relayout(); } };
  addEventListener("pageshow", recheck);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) recheck(); });
  const arm = () => setTimeout(() => { recheck(); if (el.isConnected) arm(); }, Math.max(0, Math.min(left(), 2147483647))); // clamp: longer delays overflow and fire at once
  arm();
  // Opening the phone menu at the top of the page: scroll the banner away so the menu's height math (header at y=0) holds.
  document.addEventListener("click", e => {
    if (!(e.target instanceof Element) || !e.target.closest(".menu-btn") || el.hidden || !el.isConnected || !document.querySelector("#hdr.open") || scrollY >= el.offsetHeight) return;
    scrollTo({ top: el.offsetHeight, behavior: "instant" });
  });
  const KEY = "mo-banner-closed";
  try { if (sessionStorage.getItem(KEY) === "1") return; } catch (e) { /* storage blocked: show it */ }
  el.hidden = false;
  const x = el.querySelector(".mo-x");
  if (x) x.addEventListener("click", () => {
    el.hidden = true;
    relayout();
    try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* closes for this page view only */ }
    const next = document.querySelector("#hdr .logo");
    if (next) next.focus();
  });
})();

// Seasonal items on the sh. industries homepage: Mo-ify me, Movember 2026.
// The one switch: everything marked data-season="movember" ships with the hidden
// attribute and shows only while Date.now() < UNTIL, i.e. until the end of
// November 30, 2026, US Eastern (the same cutoff as assets/movember-banner.js).
// After that each item is removed, so the numbered product list renumbers itself.
// No JS or past the cutoff = nothing shows. No tracking, no cookies, no storage.
// Loaded right after the product list (not deferred) so the row is in place before
// first paint; the DOMContentLoaded pass catches the footer link further down.
// The constant lives inside the function on purpose: movember-banner.js declares a
// top-level MOVEMBER_UNTIL, and a second top-level const would be a SyntaxError.
(() => {
  const UNTIL = "2026-12-01T05:00:00Z";
  const on = Date.now() < Date.parse(UNTIL);
  const apply = () => document.querySelectorAll('[data-season="movember"]').forEach(el => {
    if (on) el.hidden = false; else el.remove();
  });
  apply();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply, { once: true });
})();

// ==================================================================
// LAUNCH SWITCHES. Read LAUNCH_SWITCHES.md before changing anything.
// Loaded synchronously in the <head> of every page, so one edit here
// flips the whole site. Nothing else needs editing.
// ==================================================================
// SALES_OPEN: the ONE switch. false = every buy button says "Join the
// founding shops waitlist" and the waitlist form shows. true = every buy
// button goes to CHECKOUT_URL. Flip it only after the readiness
// checklist in LAUNCH_SWITCHES.md passes.
const SALES_OPEN = false;
// TODO (Steven): Stripe Payment Link for the founding price ($29/month,
// 7-day money-back). Stripe is the only payment system. Single placeholder.
const CHECKOUT_URL = "https://buy.stripe.com/TODO-steven-creates-glim-link";
// Founding beta counter. These static numbers are honest only if someone
// updates them by hand. TODO: a backend endpoint (e.g. GET /glim/founding)
// will replace both numbers; until then, edit FOUNDING_SPOTS_TAKEN after
// every founding sale. The page never shows scarcity it doesn't have.
const FOUNDING_SPOTS_TOTAL = 10;
const FOUNDING_SPOTS_TAKEN = 0;
// TODO: URL that accepts a JSON POST {business_name, email, business,
// calls_missed, would_pay, wish, carrier, source}. Empty = the form falls
// back to opening an email to glim@shindustries.co.
const WAITLIST_ENDPOINT = "";
const SUPPORT_EMAIL = "glim@shindustries.co";

(() => {
  const left = Math.max(0, FOUNDING_SPOTS_TOTAL - FOUNDING_SPOTS_TAKEN), full = left === 0;
  const root = document.documentElement;
  root.classList.add("js");
  root.classList.toggle("sales-open", SALES_OPEN);
  root.classList.toggle("founding-full", SALES_OPEN && full);
  window.GLIM_CFG = { SALES_OPEN, CHECKOUT_URL, FOUNDING_SPOTS_TOTAL, FOUNDING_SPOTS_TAKEN, WAITLIST_ENDPOINT, SUPPORT_EMAIL, left, full };
  document.addEventListener("DOMContentLoaded", () => {
    // Authored hrefs point at the waitlist (on sub-pages: index.html#waitlist). Open = checkout.
    if (SALES_OPEN) document.querySelectorAll("[data-buy]").forEach(a => { a.href = CHECKOUT_URL; });
    if (SALES_OPEN && full) document.querySelectorAll(".pr").forEach(p => { p.textContent = "$39"; });
    const msg = !SALES_OPEN
      ? `${FOUNDING_SPOTS_TOTAL} founding spots in total. Sales haven't opened yet, so none are taken.`
      : full ? `All ${FOUNDING_SPOTS_TOTAL} founding spots are taken. New businesses pay the standard $39 a month.`
      : FOUNDING_SPOTS_TAKEN === 0 ? `${FOUNDING_SPOTS_TOTAL} founding spots, all ${FOUNDING_SPOTS_TOTAL} still open.`
      : `${left} of ${FOUNDING_SPOTS_TOTAL} founding spots still open.`;
    document.querySelectorAll("[data-spots]").forEach(e => { e.textContent = msg; });
  });
})();

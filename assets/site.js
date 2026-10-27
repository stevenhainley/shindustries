/* sh. industries · shared behaviour: header morph, mobile menu, reveals, magnetic buttons.
 * Loaded with defer on every page. Everything degrades: no JS = static header, visible nav, plain buttons. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* header morph */
  const hdr = document.getElementById("hdr");
  if (hdr) {
    const onScroll = () => hdr.classList.toggle("on", scrollY > 8);
    addEventListener("scroll", onScroll, { passive: true }); onScroll();

    /* mobile menu */
    const btn = hdr.querySelector(".menu-btn"), nav = hdr.querySelector(".nav");
    if (btn && nav) {
      const set = open => { hdr.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); btn.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
      btn.addEventListener("click", () => set(!hdr.classList.contains("open")));
      nav.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && hdr.classList.contains("open")) { set(false); btn.focus(); } });
      document.addEventListener("click", e => { if (hdr.classList.contains("open") && !hdr.contains(e.target)) set(false); });
      matchMedia("(min-width: 900px)").addEventListener("change", e => { if (e.matches) set(false); });
    }
    /* products menu: Escape closes it by moving focus */
    hdr.querySelectorAll(".dd").forEach(dd => dd.addEventListener("keydown", e => { if (e.key === "Escape") { dd.querySelector("a").focus(); dd.querySelector("a").blur(); } }));
    /* current page */
    const here = location.pathname.replace(/\/index\.html$/, "/").replace(/\/$/, "/index.html");
    hdr.querySelectorAll(".nav a[href]").forEach(a => {
      const to = new URL(a.getAttribute("href"), location.href).pathname.replace(/\/$/, "/index.html");
      if (to === here && !a.hash && !a.closest(".dd-in")) a.setAttribute("aria-current", "page");
    });
  }

  /* reveals */
  const rv = document.querySelectorAll(".rv");
  if (reduce || !("IntersectionObserver" in window)) rv.forEach(e => e.classList.add("on"));
  else {
    const io = new IntersectionObserver(es => es.forEach((e, i) => { if (e.isIntersecting) { e.target.style.transitionDelay = Math.min(i, 5) * 40 + "ms"; e.target.classList.add("on"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    rv.forEach(e => io.observe(e));
  }

  /* magnetic buttons: the primary buttons lean 6px toward a fine pointer, then settle. Transform only, 60 fps. */
  if (fine && !reduce) {
    document.querySelectorAll(".btn-go, .btn-ink").forEach(b => {
      let raf = 0;
      b.addEventListener("pointermove", e => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = b.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
          b.style.setProperty("--mx", (dx * 5).toFixed(1) + "px"); b.style.setProperty("--my", (dy * 4).toFixed(1) + "px");
        });
      });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); });
    });
  }
})();

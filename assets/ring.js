// sh. industries homepage · the product ring (markup in index.html, styles in assets/ring.css).
// No tracking, no cookies, no storage, no libraries.
// 1. The ring: each card stands on a circle. `pos` is which card is in front (a fraction while it turns); a card's
//    place is its distance from `pos`, wrapped so a card leaving one side returns from the other. Drag or swipe,
//    the arrow keys, the two arrow buttons, the name buttons, a click on a side card, or tabbing into a card all
//    turn it. It never turns by itself. With reduced motion it jumps instead of gliding.
// 2. The DuckyGuard card's duck: the app's own 3D plate (duckyguard/vendor/plate.js), loaded only when WebGL works
//    and the ring is near the screen, and paused whenever its card is not in front or is off screen. Until then,
//    and without WebGL, the card shows a still of the same plate.
(() => {
  const ring = document.getElementById("ring"); if (!ring) return;
  const track = ring.querySelector(".ring-track"), cards = [...track.children], N = cards.length;
  const dots = [...ring.querySelectorAll(".ring-dot")], say = document.getElementById("ring-say");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const THETA = 40 * Math.PI / 180;                       // angle between neighbours on the circle
  let pos = 0, target = 0, raf = 0, last = 0, front = -1, duck = null;

  ring.classList.add("ring-on");
  const mod = (a, n) => ((a % n) + n) % n;
  const wrap = d => { d = mod(d + N / 2, N) - N / 2; return d; };          // distance from the front, in (-N/2, N/2]

  function place() {
    const w = cards[0].offsetWidth, R = w * 1.36;
    cards.forEach((c, i) => {
      const d = wrap(i - pos), a = d * THETA, ad = Math.abs(d);
      const x = R * Math.sin(a), z = R * (Math.cos(a) - 1) - (ad > 1 ? (ad - 1) * 260 : 0);
      c.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${(a * 180 / Math.PI).toFixed(2)}deg)`;
      c.style.opacity = ad <= 1 ? "1" : Math.max(0, 1 - (ad - 1) * 2.4).toFixed(3);
      c.style.zIndex = String(100 - Math.round(ad * 10));
      c.style.filter = ad < .02 ? "" : `brightness(${(1 - .34 * Math.min(1, ad)).toFixed(3)})`;       // the further round, the dimmer
      c.style.visibility = ad > 1.42 ? "hidden" : "visible";
    });
    const f = mod(Math.round(pos), N);
    if (f !== front) {
      front = f;
      cards.forEach((c, i) => c.classList.toggle("front", i === f));
      dots.forEach((b, i) => b.setAttribute("aria-current", i === f ? "true" : "false"));
      if (say) say.textContent = `${cards[f].dataset.name}, ${f + 1} of ${N}`;
      duckWake();
    }
  }
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    pos += (target - pos) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - pos) < .001) { pos = target; raf = 0; place(); return; }
    place(); raf = requestAnimationFrame(tick);
  }
  function go(t) {
    target = t;
    if (reduce.matches) { pos = target; place(); return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  const toCard = i => go(Math.round(pos) + wrap(i - Math.round(pos)));     // the short way round
  const step = dir => go(Math.round(target) + dir);

  /* drag and swipe */
  let drag = null, moved = 0;
  track.addEventListener("pointerdown", e => { if (e.button) return; drag = { x: e.clientX, pos, t: performance.now(), vx: 0, lx: e.clientX }; moved = 0; });
  addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, now = performance.now(); moved = Math.max(moved, Math.abs(dx));
    if (moved < 6) return;
    track.classList.add("drag"); cancelAnimationFrame(raf); raf = 0;
    drag.vx = (e.clientX - drag.lx) / Math.max(1, now - drag.t); drag.lx = e.clientX; drag.t = now;
    pos = target = drag.pos - dx / (cards[0].offsetWidth * .86); place();
  });
  const drop = () => {
    if (!drag) return; const d = drag; drag = null; track.classList.remove("drag");
    if (moved < 6) return;
    const quick = Math.abs(d.vx) > .35 && Math.abs(pos - d.pos) < .5;       // a short quick flick still carries to the next card
    go(quick ? Math.round(d.pos) - Math.sign(d.vx) : Math.round(pos));
  };
  addEventListener("pointerup", drop); addEventListener("pointercancel", drop);
  // a click: on a side card it brings that card round; after a drag it does nothing; on the front card links work
  track.addEventListener("click", e => {
    const c = e.target.closest(".pc"); if (!c) return;
    if (moved >= 6) { e.preventDefault(); return; }
    const i = cards.indexOf(c); if (i !== front) { e.preventDefault(); toCard(i); }
  }, true);
  track.addEventListener("dragstart", e => e.preventDefault());

  /* keys, buttons, focus */
  ring.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") { step(1); e.preventDefault(); } else if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); }
    else if (e.key === "Home") { toCard(0); e.preventDefault(); } else if (e.key === "End") { toCard(N - 1); e.preventDefault(); }
  });
  ring.querySelectorAll(".ring-btn").forEach(b => b.addEventListener("click", () => step(+b.dataset.dir)));
  dots.forEach((b, i) => b.addEventListener("click", () => toCard(i)));
  cards.forEach((c, i) => c.addEventListener("focusin", () => { if (i !== mod(Math.round(target), N)) toCard(i); }));
  addEventListener("resize", place);
  place();

  /* the DuckyGuard card's duck */
  const box = ring.querySelector(".pc-duck .pc-top"), cv = box && box.querySelector("canvas");
  let near = false, loading = false;
  function duckWake() { if (duck) duck.visible(near && cards[front].classList.contains("pc-duck")); }
  function duckBuild() {
    if (duck || typeof DuckPlate !== "function") return;
    const n = Math.round(Math.max(240, Math.min(360, box.clientWidth)));
    cv.width = cv.height = n; cv.hidden = false;
    try { duck = DuckPlate(cv, { ink: [.976, .878, .082], paper: [.059, .075, .153], red: [.992, .086, .137], texture: "duckyguard/assets/duck-plate.png" }); }
    catch (e) { cv.hidden = true; return; }
    box.classList.add("live"); duckWake();
  }
  function duckLoad() {
    if (loading || !cv) return; loading = true;
    try { const t = document.createElement("canvas"); if (!(t.getContext("webgl2") || t.getContext("webgl"))) return; } catch (e) { return; }
    const s = document.createElement("script"); s.src = "duckyguard/vendor/plate.js"; s.onload = duckBuild; document.head.appendChild(s);
  }
  if (cv && "IntersectionObserver" in window) {
    new IntersectionObserver(es => { near = es[es.length - 1].isIntersecting; duckWake();
      if (near) { if (document.readyState === "complete") duckLoad(); else addEventListener("load", duckLoad, { once: true }); } }, { rootMargin: "200px 0px" }).observe(ring);
  }
})();

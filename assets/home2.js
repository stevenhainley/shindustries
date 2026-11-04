// sh. industries company homepage (index.html) · page script. No tracking, no cookies, no storage.
// (assets/home.js is the Glim page's script; this one is the company page's.)
// 1. Header: glass background once the page scrolls.
// 2. The Glim phone demo: missed call -> text back -> reply -> draft -> approve -> saved. Same steps as
//    /glim/. It plays once when the phone scrolls into view and stops on the finished screen; it never loops.
//    The button under the phone replays it, and while it plays the same button skips to the end (WCAG 2.2.2).
//    The phone ships in its finished state, so with no JS or reduced motion it shows the whole conversation
//    and the button stays hidden.
// 3. The Movember countdown: whole days left until 2026-12-01T05:00:00Z (end of Nov 30, US Eastern).
//    assets/seasonal.js shows the section; this keeps the count current at each US Eastern midnight and, at
//    the cutoff, removes everything marked data-season="movember", even in a tab left open.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1 · header ---------- */
  const hdr = document.getElementById("hdr");
  if (hdr) {
    const mark = () => hdr.classList.toggle("on", hdr.getBoundingClientRect().top <= 0 && scrollY > 8);
    addEventListener("scroll", mark, { passive: true });
    mark();
  }

  /* ---------- 2 · phone ---------- */
  const phone = document.getElementById("phone");
  if (phone) {
    const cnt = document.getElementById("cnt"), cntL = document.getElementById("cnt-l"), notif = phone.querySelector(".notif");
    const parts = phone.querySelectorAll("[data-at]"), body = phone.querySelector(".thr-body");
    const btn = document.getElementById("replay");
    const STEPS = [0, 600, 1300, 2800, 4600, 6400, 9000]; // ms at which step n begins
    let timers = [], running = false;
    const setStep = n => {
      phone.dataset.step = n;
      notif.classList.toggle("on", n === 1 || n === 2);
      parts.forEach(p => {
        const from = +p.dataset.at, to = p.dataset.to === undefined ? Infinity : +p.dataset.to;
        p.classList.toggle("on", n >= from && n <= to);
        if (p.dataset.sent) p.classList.toggle("sent", n >= +p.dataset.sent);
      });
      // newest line in view once the card is full; the 8px rise of a new line alone is not "full"
      const over = body.scrollHeight - body.clientHeight;
      body.scrollTop = over > 10 ? over : 0;
      body.classList.toggle("clip", over > 10);
      phone.classList.toggle("lit", n === 2 || n === 3 || n === 5 || n === 6);
      const saved = n >= 6 ? 1 : 0;
      cnt.textContent = saved;
      cntL.textContent = saved === 1 ? "call saved today" : "calls saved today";
    };
    const label = () => { if (btn) btn.textContent = running ? "Skip to the end" : "Play it again"; };
    const stop = () => { timers.forEach(clearTimeout); timers = []; running = false; };
    const finish = () => { stop(); setStep(6); label(); };
    const play = () => {
      stop(); running = true; label();
      setStep(0);
      STEPS.forEach((t, n) => timers.push(setTimeout(() => setStep(n), t)));
      timers.push(setTimeout(() => { running = false; label(); }, STEPS[6]));   // done: rest on the finished screen
    };
    setStep(6); // the finished screen until the phone scrolls into view
    if (!reduce) {
      if (btn) { btn.hidden = false; btn.addEventListener("click", () => (running ? finish() : play())); }
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); play(); } }, { threshold: .35 });
        io.observe(phone);
      } else play();
    }
  }

  /* ---------- 3 · Movember countdown ---------- */
  const UNTIL = Date.parse("2026-12-01T05:00:00Z"), DAY = 86400000;
  if (document.getElementById("movember")) {
    let timer = 0;
    const fill = () => {
      clearTimeout(timer);
      const ms = UNTIL - Date.now();
      if (!(ms > 0)) { document.querySelectorAll('[data-season="movember"]').forEach(el => el.remove()); return; }
      const left = Math.floor(ms / DAY); // whole days after today, counted to midnight US Eastern; Nov 30 itself is the last day
      const n = document.getElementById("mv-n"), u = document.getElementById("mv-u");
      if (n && u) {
        if (left === 0) { n.textContent = "Last day"; u.textContent = "· ends tonight"; }
        else { n.textContent = `${left} ${left === 1 ? "day" : "days"} left`; u.textContent = "· ends Nov 30"; }
      }
      // next US Eastern midnight (when the count drops), or the cutoff itself on the last day; clamped, since
      // longer delays overflow and fire at once, and never sooner than a second
      timer = setTimeout(fill, Math.min(Math.max(ms % DAY + 50, 1000), 2147483647));
    };
    fill();
    // a tab restored from the back/forward cache or brought back to the front catches up at once
    addEventListener("pageshow", fill);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) fill(); });
  }
})();

/* DuckyGuard page script. No tracking, no cookies, no storage, no network requests of its own.
 * RELEASED, DOWNLOAD_URL, DOWNLOAD_NOTARIZED, REPO_URL and SUPPORT_URL come from config.js; FLIPPER_TRACE from flipper-trace.js.
 * 1. Release state: what the buttons and the "Get it" section say.
 * 2. Tabs: the yellow underline follows the section in view.
 * 3. The duck: the app's own plate (vendor/plate.js, loaded only if WebGL works; the poster image stays otherwise).
 *    It is driven by the timing of the visitor's keys (gap and hold only, never which key) and paused off-screen.
 * 4. The replay: the recorded Flipper Zero run, blocked where the hardware test blocked it; and the same with the hold on.
 * 5. View as ASCII: the plate re-read as characters ten times a second, as in the app. */
(() => {
  const $ = id => document.getElementById(id), q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
  const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* ---------- 1 · release state ---------- */
  const out = RELEASED && !!DOWNLOAD_URL;
  const set = (sel, fn) => qa(sel).forEach(fn);
  set("[data-state]", el => el.textContent = out ? "Out now" : RELEASED ? "Download soon" : "Coming soon");
  if (REPO_URL) {
    set("[data-repo]", a => { a.href = REPO_URL; a.rel = "noopener"; });
    set("[data-repo-btn]", a => { a.href = REPO_URL; a.rel = "noopener"; a.hidden = false; });
  } else set("[data-repo]", a => a.replaceWith(document.createTextNode("")));
  if (out) {
    set("[data-get-title]", el => el.textContent = "Download DuckyGuard.");
    set("[data-get-copy]", el => el.textContent = "Free, and it runs on your Mac alone. After you install it, turn on Input Monitoring and Accessibility for DuckyGuard in System Settings › Privacy & Security. The first-run screen has a button for each.");
    set("[data-get-gk]", el => {
      el.hidden = false;
      const gk = DOWNLOAD_NOTARIZED
        ? "This build passed Apple's notarization check, so it opens normally."
        : "macOS will block the first launch: open System Settings › Privacy & Security and choose Open Anyway.";
      const sha = (typeof DOWNLOAD_SHA256 === "string" && DOWNLOAD_SHA256)
        ? " DMG SHA-256: " + DOWNLOAD_SHA256
        : "";
      el.textContent = gk + sha;
    });
    set("[data-get-btn]", a => { a.href = DOWNLOAD_URL; a.textContent = "Download for Mac"; });
    set("[data-main]", a => { a.href = DOWNLOAD_URL; a.textContent = "Download for Mac"; });
    set("[data-second]", a => { a.href = "#block"; a.textContent = "Watch it block"; });
    set("[data-short]", a => { a.href = DOWNLOAD_URL; a.textContent = "Download"; });
  } else if (RELEASED) {
    set("[data-get-title]", el => el.textContent = "Download soon.");
    set("[data-get-copy]", el => el.textContent = "Version 2.1.0 is out as source on GitHub. The packaged download is being prepared and will appear here.");
  }
  if (SUPPORT_URL) {
    set("[data-support-btn]", a => { a.href = SUPPORT_URL; a.rel = "noopener"; a.textContent = "Buy me a coffee"; });
    set("[data-support-note]", el => { el.hidden = false; el.textContent = "Secure checkout by Stripe. You choose the amount."; });
  }

  /* ---------- 2 · tabs ---------- */
  const tabs = qa("#tabs a"), byId = Object.fromEntries(tabs.map(a => [a.getAttribute("href").slice(1), a]));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      tabs.forEach(a => a.removeAttribute("aria-current")); byId[e.target.id].setAttribute("aria-current", "true");
    }), { rootMargin: innerWidth < 960 ? "-62% 0px -33% 0px" : "-40% 0px -55% 0px" });
    Object.keys(byId).forEach(id => { const el = $(id); if (el) io.observe(el); });
  }

  /* ---------- 3 · the duck ---------- */
  const stage = $("stage"), cv = $("plate"), tapeEl = $("tape"), capR = $("cap-r");
  const S = { mode: "idle", busy: false, lastKeyAt: -1e9, burst: 0, keys: 0, note: "" };   // mode: idle | alert | held
  let plate = null;

  // a CSS colour as [r, g, b] in 0..1 (the plate's shader wants numbers); the fallbacks are the same tokens in sRGB
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgb = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!v || !(window.CSS && CSS.supports("color", v))) return fallback;
    probe.clearRect(0, 0, 1, 1); probe.fillStyle = v; probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255];
  };

  // lines from each reading to the part of the head it describes, as on the app's Overview
  const leads = {}; let N = 372, FROM = {};
  function onParts(parts) {
    for (const k in parts) {
      const L = leads[k]; if (!L) continue;
      const x = clamp(parts[k].x * N, 6, N - 6), y = clamp(parts[k].y * N, 6, N - 6);
      if (Math.abs(x - L.x) < .4 && Math.abs(y - L.y) < .4) continue;
      L.x = x; L.y = y;
      L.line.setAttribute("x1", FROM[k][0]); L.line.setAttribute("y1", FROM[k][1]); L.line.setAttribute("x2", x.toFixed(1)); L.line.setAttribute("y2", y.toFixed(1));
      L.dot.setAttribute("cx", x.toFixed(1)); L.dot.setAttribute("cy", y.toFixed(1));
    }
  }
  function build() {
    if (plate || typeof DuckPlate !== "function") return;
    N = Math.round(clamp(stage.clientWidth, 280, 600));
    cv.width = cv.height = N; cv.hidden = false;
    const mid = Math.round(N * .478) + 24;
    FROM = { burst: [20, 30], press: [N - 20, 30], verdict: [20, mid], rate: [N - 20, mid], halo: [20, N - 30], rhythm: [N - 20, N - 30] };
    const svg = $("leads"); svg.setAttribute("viewBox", `0 0 ${N} ${N}`);
    svg.innerHTML = Object.keys(FROM).map(k => `<line data-k="${k}"/><circle data-k="${k}" r="2.5"/>`).join("");
    for (const k in FROM) leads[k] = { line: svg.querySelector(`line[data-k="${k}"]`), dot: svg.querySelector(`circle[data-k="${k}"]`), x: -9, y: -9 };
    try {
      plate = DuckPlate(cv, { ink: rgb("--color-accent", [.976, .878, .082]), paper: rgb("--color-paper-2", [.059, .075, .153]), red: rgb("--color-danger", [.992, .086, .137]), texture: "assets/duck-plate.png", onParts });
    } catch (e) { cv.hidden = true; return; }
    stage.classList.add("live"); $("b-ascii").hidden = false; $("live-note").hidden = false;
    capR.textContent = matchMedia("(pointer: coarse)").matches ? "Drag the duck to turn its head." : "Type anything. The duck times your keys.";
    if ("IntersectionObserver" in window) new IntersectionObserver(es => plate.visible(es[es.length - 1].isIntersecting)).observe(stage);
  }
  const hasGL = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
  function start() { if (!hasGL) return; const s = document.createElement("script"); s.src = "vendor/plate.js"; s.onload = build; document.head.appendChild(s); }
  if (document.readyState === "complete") start(); else addEventListener("load", start, { once: true });

  // the tape under the plate: one bar per key, as tall as the key was held. An injector barely lifts off the floor.
  const BARS = " ▁▂▃▄▅▆▇█"; let tape = "";
  function tapeKey(gap, hold, blocked) {
    const bar = blocked ? "×" : BARS[clamp(Math.round(hold / 16), 1, 8)], room = Math.max(20, Math.floor(tapeEl.clientWidth / 8.4));
    tape = (tape + (gap > 350 ? "  " : gap > 160 ? " " : "") + bar).slice(-room);
    tapeEl.innerHTML = esc(tape.slice(0, -1)).replace(/×+/g, m => "<u>" + m + "</u>") + (blocked ? "<u>×</u>" : "<b>" + esc(tape.slice(-1)) + "</b>");
  }
  function feed(gap, hold) {
    S.burst = gap > 350 ? 1 : S.burst + 1; S.keys++; S.lastKeyAt = performance.now();
    if (plate) plate.pushKey(gap, hold);
    tapeKey(gap, hold, false);
  }

  // the visitor's own typing: timing only. Which key it was is used once, to pair a key-up with its key-down, and dropped.
  const downAt = new Map(), MODS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Fn"]); let lastDown = 0;
  addEventListener("keydown", e => { if (e.repeat || MODS.has(e.key) || e.metaKey || e.ctrlKey) return; downAt.set(e.code, performance.now()); });
  addEventListener("keyup", e => {
    const t = downAt.get(e.code); if (t == null) return; downAt.delete(e.code);
    if (S.busy) return;                                             // during a replay your own keyboard is "off", as in a real hold
    const gap = lastDown ? t - lastDown : 600; lastDown = t; S.note = "";
    feed(gap, performance.now() - t);
  });

  // the readings round the plate, and the sentence in the replay pane
  const statusEl = $("status"), verdictEl = $("verdict");
  function readings() {
    const now = performance.now(), typing = now - S.lastKeyAt < 1500, s = plate ? plate.stats() : { rate: 0, cv: 0, hold: 0, n: 0 };
    if (S.mode === "idle") {
      const machine = typing && s.hold < 10 && S.burst >= 4;
      $("h-burst").textContent = typing ? plural(S.burst, "key") : "—";
      $("h-hold").textContent = typing && s.hold ? (s.hold < 10 ? s.hold.toFixed(1) : Math.round(s.hold)) + " ms" : "—";
      $("h-rate").textContent = typing && s.rate ? s.rate.toFixed(1) + "/s" : "idle";
      $("h-cv").textContent = typing && s.n >= 3 ? (s.cv < .15 ? "even " : "uneven ") + Math.round(s.cv * 100) + "%" : "—";
      $("h-verdict").textContent = machine ? "a machine" : typing ? "a hand" : "quiet";
      if (!S.busy) verdictEl.textContent = S.note || (typing ? "Typing looks human." : "No typing right now.");
    } else $("h-verdict").textContent = S.mode === "alert" ? "a machine" : "held";
    $("h-halo").textContent = Math.min(64, S.keys);
  }
  setInterval(() => { if (!document.hidden) readings(); }, 150);

  /* ---------- 4 · the replay ---------- */
  const TRACE = typeof FLIPPER_TRACE === "undefined" ? [] : FLIPPER_TRACE, PASS = 4;      // 4 characters got through at this speed in the hardware test
  const pad = $("pad"), decide = $("decide"), aside = $("replay-aside"), ASIDE = aside.innerHTML, DECIDE = decide.innerHTML;
  let timers = [], raf = 0;
  decide.hidden = false;                                              // the replay buttons only exist once this script runs
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const mode = m => { S.mode = m; document.body.classList.toggle("alert", m === "alert"); document.body.classList.toggle("held", m === "held"); document.body.classList.toggle("protected", m === "idle"); };
  const buttons = html => { decide.innerHTML = html; };
  function rest(note) {                                              // back to Protected, with a sentence about what just happened
    timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
    if (plate) plate.set({ alert: 0, hold: 0, burst: 0 });
    mode("idle"); S.busy = false; S.note = note || ""; S.burst = 0;
    statusEl.textContent = "Protected"; aside.innerHTML = ASIDE; buttons(DECIDE); capR.textContent = note ? "1 blocked just now" : capR.textContent;
    const b = $("b-replay"); if (b && note) b.textContent = "Plug it in again";
    readings();
  }
  // type the recording at its real speed; keys before `pass` reach the page, the rest are blocked
  function type(pass, onBlock, onDone) {
    const t0 = performance.now(); let i = 0, through = "", blocked = 0;
    const step = now => {
      const el = now - t0;
      while (i < TRACE.length && TRACE[i][0] <= el) {
        const k = TRACE[i], gap = i ? k[0] - TRACE[i - 1][0] : 600;
        if (i < pass) { feed(gap, k[1]); through += k[2]; }
        else { if (i === pass && onBlock) onBlock(); tapeKey(gap, k[1], true); blocked++; }
        i++;
      }
      pad.innerHTML = (through ? esc(through) : "") + (blocked ? `<u>${"×".repeat(Math.min(blocked, 24))}</u>` : "") || "<i>Nothing yet.</i>";
      if (i < TRACE.length) raf = requestAnimationFrame(step); else onDone(through.length, blocked);
    };
    raf = requestAnimationFrame(step);
  }
  function replayTiming() {
    if (S.busy || !TRACE.length) return;
    S.busy = true; S.note = ""; pad.classList.remove("blocked"); pad.innerHTML = "<i>Nothing yet.</i>";
    qa("#decide button").forEach(b => b.disabled = true);
    statusEl.textContent = "Protected"; verdictEl.textContent = "A new keyboard starts typing.";
    type(PASS, () => {
      mode("alert"); if (plate) plate.set({ alert: 1, burst: PASS });
      const first = TRACE.slice(0, PASS), span = first[PASS - 1][0] - first[0][0];           // the readings freeze on the burst that was blocked
      $("h-burst").textContent = plural(PASS, "key"); $("h-hold").textContent = "<2 ms"; $("h-cv").textContent = "—";
      $("h-rate").textContent = Math.round((PASS - 1) / span * 1000) + "/s";
      statusEl.textContent = "Blocking"; pad.classList.add("blocked");
      verdictEl.textContent = `A keyboard pressed ${PASS} keys in a row and let go of each within 2 ms. A finger holds a key 60 to 150 ms. DuckyGuard blocked it.`;
    }, (n, blocked) => {
      pad.innerHTML = `${esc(TRACE.slice(0, n).map(k => k[2]).join(""))}<u> ×${blocked}</u>\n<i>${n} of ${TRACE.length} keys got through. ${blocked} were blocked.</i>`;
      later(reduce ? 2500 : 4200, () => rest(`Blocked a moment ago: ${TRACE.length} keys in half a second, ${n} got through.`));
    });
  }
  function replayHold() {
    if (S.busy || !TRACE.length) return;
    S.busy = true; S.note = ""; mode("held"); if (plate) plate.set({ hold: 1 });
    pad.classList.remove("blocked"); pad.innerHTML = "<i>Nothing yet.</i>";
    statusEl.textContent = "Keyboard held";
    $("h-burst").textContent = plural(0, "key"); $("h-hold").textContent = "—"; $("h-rate").textContent = "idle"; $("h-cv").textContent = "—";
    verdictEl.textContent = "Identified as Flipper Zero (names itself in its USB strings). Nothing it types gets through until you choose.";
    buttons(`<button class="primary" type="button" data-hold="keep">Keep blocked</button><button class="ghost" type="button" data-hold="once">Allow once</button><button class="ghost" type="button" data-hold="always">Always allow</button>`);
    const t0 = performance.now(), HOLD = 20; let dropped = 0;
    const count = () => {
      const left = Math.max(0, HOLD - Math.floor((performance.now() - t0) / 1000));
      aside.innerHTML = `Your own keyboard is off too until you choose. Use the trackpad or mouse. If you do nothing, this keyboard can type in <b>${left} s</b>. Fast scripted typing is still blocked.`;
      if (left <= 0) return rest("The hold ended with no choice made. That keyboard may type now, and only the timing rules stand in its way.");
      later(250, count);
    };
    count();
    later(1200, () => type(0, null, (n, blocked) => {                 // in the test the Flipper typed 1.2 to 3.5 s after plug-in
      dropped = blocked; capR.textContent = plural(dropped, "key") + " blocked so far"; pad.classList.add("blocked");
      pad.innerHTML = `<u>×${blocked}</u>\n<i>0 of ${TRACE.length} keys got through.</i>`;
    }));
    decide.onclick = e => {
      const b = e.target.closest("[data-hold]"); if (!b) return; decide.onclick = null;
      if (b.dataset.hold === "keep") return rest(`Kept blocked. ${dropped ? "All " + dropped + " keys it typed were stopped." : "It never got to type."}`);
      rest(""); S.note = "Allowed. If it types like a machine, the timing rules still apply."; readings();
      later(900, replayTiming);
    };
  }
  document.addEventListener("click", e => {
    if (e.target.closest("#b-replay")) replayTiming(); else if (e.target.closest("#b-hold")) replayHold();
  });
  // the first time the replay pane is in view, it plays once on its own
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); later(500, replayTiming); } }, { threshold: 1, rootMargin: `-${Math.round(q(".plate").getBoundingClientRect().height * (innerWidth < 960 ? 1 : 0) + 56)}px 0px -12% 0px` });
    io.observe(statusEl);
  }

  /* ---------- 5 · view as ASCII ---------- */
  const RAMP = " .·:-=+*x%#@", COLS = 74, ROWS = 37, pre = $("ascii-plate"), bAscii = $("b-ascii"), reader = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  let asciiOn = false;
  const fit = () => { const w = stage.clientWidth; pre.style.fontSize = (w / COLS / .6).toFixed(2) + "px"; pre.style.lineHeight = (w / ROWS).toFixed(2) + "px"; };
  function mirror() {
    const W = cv.width; reader.canvas.width = reader.canvas.height = W; reader.drawImage(cv, 0, 0);
    const d = reader.getImageData(0, 0, W, W).data, cw = W / COLS, ch = W / ROWS, inverted = S.mode === "alert"; let outp = "";
    for (let y = 0; y < ROWS; y++) { const y0 = Math.floor(y * ch), y1 = Math.floor((y + 1) * ch);
      for (let x = 0; x < COLS; x++) { const x0 = Math.floor(x * cw), x1 = Math.floor((x + 1) * cw); let ink = 0, red = 0, n = 0;
        for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) { const o = (py * W + px) * 4; n++; if (d[o] > 150 && d[o + 1] < 110) red++; else if (d[o + 1] > 128) ink++; }   // green tells yellow ink from navy paper
        let v = ink / n; if (inverted) v = 1 - v - red / n; v = clamp((v - .15) * 1.42, 0, 1);
        outp += red / n > .3 ? "<b>@</b>" : RAMP[Math.round(v * (RAMP.length - 1))];
      } outp += "\n"; }
    pre.innerHTML = outp;
  }
  bAscii.addEventListener("click", () => {
    asciiOn = !asciiOn; bAscii.setAttribute("aria-pressed", asciiOn); bAscii.textContent = asciiOn ? "View as engraving" : "View as ASCII";
    pre.hidden = !asciiOn; if (plate) plate.mirror(asciiOn); if (asciiOn) { fit(); mirror(); }
  });
  addEventListener("resize", () => { if (asciiOn) fit(); });
  setInterval(() => { if (asciiOn && plate && !document.hidden) mirror(); }, 100);

})();

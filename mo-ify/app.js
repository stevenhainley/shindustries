// ====================================================================================
// Steven: this is the one line to change. Paste your own Mo Space link here once you
// have signed up at movember.com, so donations from this page count toward your page.
// Until then it sends people to Movember's own general donate page.
const DONATE_URL = "https://us.movember.com/donate/details?memberId=15609313";
// Where this page will live once published. Used in the caption and printed on the card.
const PAGE_URL = "https://shindustries.co/mo-ify/";
// ====================================================================================
// Movember's general donate page. Captions visitors copy and post always use this one, so
// their posts never send money to Steven's Mo Space without them knowing.
const GENERAL_DONATE_URL = "https://movember.com/donate";
const VIA_MO_SPACE = DONATE_URL !== GENERAL_DONATE_URL;

const CAPTION = "I grew an AI mo for Movember. Your turn: donate or grow one. #Movember";
const CARD_W = 1080, CARD_H = 1350, PHOTO = 1080;
const INK = "#1A1A17", PAPER = "#F7F6F1", LIME = "#C6FF3D", MUTED = "#A8A69F";
const SHORT_URL = PAGE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

const STYLES = [
  { id: "chevron", label: "Chevron", wide: 1.0 },
  { id: "handlebar", label: "Handlebar", wide: 1.25 },
  { id: "walrus", label: "Walrus", wide: 1.12 },
  { id: "pencil", label: "Pencil", wide: 0.92 },
];
const COLORS = [
  { id: "dark", label: "Dark", hex: "#1d1612" },
  { id: "brown", label: "Brown", hex: "#4b2e1b" },
  { id: "ginger", label: "Ginger", hex: "#a24f1f" },
  { id: "blond", label: "Blond", hex: "#c19a5b" },
  { id: "silver", label: "Silver", hex: "#a19d97" },
];

const $ = (id) => document.getElementById(id);
const canvas = $("card");
const ctx = canvas.getContext("2d");
const photoLayer = document.createElement("canvas");
photoLayer.width = PHOTO; photoLayer.height = PHOTO;

const state = { style: STYLES[0], color: COLORS[0], size: 1, mos: [], active: 0, hasPhoto: false, blob: null, label: "Your photo" };

// ---------- moustache geometry ----------
// Unit space: x from -1 (left tip) to 1 (right tip), y grows downward, (0,0) sits just under the nose.
function profile(id, t) {
  const notch = Math.exp(-((t / 0.07) ** 2));
  if (id === "walrus") {
    const top = 0.08 * t * t + 0.04 * notch;
    const fringe = 0.05 * Math.abs(Math.sin(t * 22)) * (1 - 0.5 * t);
    return [top, top + 0.5 * Math.pow(1 - t ** 3, 0.6) + 0.06 + fringe];
  }
  if (id === "pencil") {
    const top = 0.16 + 0.06 * t * t;
    return [top, top + 0.075 * Math.pow(1 - t ** 4, 0.8) + 0.018];
  }
  if (id === "handlebar") {
    const lift = t > 0.55 ? 1.1 * (t - 0.55) ** 2 : 0;
    const top = 0.06 + 0.1 * t * t - lift + 0.035 * notch;
    return [top, top + 0.24 * Math.pow(1 - t, 0.85) + 0.04];
  }
  const top = 0.02 + 0.2 * t ** 1.7 + 0.05 * notch; // chevron
  return [top, top + 0.42 * Math.pow(Math.max(0, 1 - t ** 2.2), 0.65) + 0.04];
}

function shapePath(id) {
  const n = id === "walrus" ? 120 : 60;
  const pts = [];
  for (let i = 0; i <= n; i++) { const x = -1 + (2 * i) / n; pts.push([x, profile(id, Math.abs(x))[0]]); }
  for (let i = n; i >= 0; i--) { const x = -1 + (2 * i) / n; pts.push([x, profile(id, Math.abs(x))[1]]); }
  const p = new Path2D();
  p.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[(i + 1) % pts.length];
    p.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  p.closePath();
  return p;
}
const PATHS = Object.fromEntries(STYLES.map((s) => [s.id, shapePath(s.id)]));

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function drawMo(c, mo, style, color) {
  const s = (mo.w / 2) * state.size;
  const path = PATHS[style.id];
  c.save();
  c.translate(mo.x, mo.y);
  c.rotate(mo.a);
  c.scale(s * style.wide, s);
  // soft shadow so it sits on the face
  c.save();
  c.shadowColor = "rgba(0,0,0,.35)"; c.shadowBlur = 0.06 * s; c.shadowOffsetY = 0.03 * s;
  c.fillStyle = color.hex; c.fill(path);
  c.restore();
  // hair: short strands that fan down and outward from the middle, like a real mo
  const r = rng(7);
  const strand = (x, y, len, w, col, a) => {
    const t = Math.abs(x), dir = Math.sign(x || 1) * (0.25 + 0.95 * t);
    c.strokeStyle = col; c.globalAlpha = a; c.lineWidth = w;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + dir * len * 0.4, y + len * 0.6, x + dir * len * 0.75, y + len); c.stroke();
  };
  c.lineCap = "round";
  c.save();
  c.clip(path);
  for (let i = 0; i < 520; i++) {
    const x = (r() * 2 - 1) * 0.99, [tp, bt] = profile(style.id, Math.abs(x));
    const y = tp + (bt - tp) * r() * 0.85 - 0.02;
    strand(x, y, Math.min(0.12, (bt - tp) * (0.25 + 0.35 * r())) + 0.03, 0.011 + 0.008 * r(), shade(color.hex, r() > 0.45 ? 0.2 : -0.4), 0.4);
  }
  c.globalAlpha = 1;
  const g = c.createLinearGradient(0, -0.1, 0, 0.6);
  g.addColorStop(0, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(0,0,0,.3)");
  c.fillStyle = g; c.fillRect(-1.3, -0.5, 2.6, 1.4);
  c.restore();
  // soft fringe on the lower edge so it doesn't look cut out
  for (let i = 0; i < 260; i++) {
    const x = (r() * 2 - 1) * 0.97, [tp, bt] = profile(style.id, Math.abs(x));
    const th = bt - tp;
    if (th < 0.05) continue;
    const len = Math.min(0.11, th * 0.45) * (0.55 + 0.45 * r());
    strand(x, bt - len * 0.6, len, 0.012 + 0.008 * r(), r() > 0.25 ? color.hex : shade(color.hex, 0.15), 0.8);
  }
  c.globalAlpha = 1;
  // handlebar curls
  if (style.id === "handlebar") {
    // tapered spiral that grows straight out of each tip
    const [tp, bt] = profile("handlebar", 0.985);
    const tip = { x: 0.985, y: (tp + bt) / 2 };
    c.strokeStyle = color.hex; c.lineCap = "round";
    for (const side of [1, -1]) {
      c.save(); c.scale(side, 1);
      const steps = 18, turn = 1.55 * Math.PI, r0 = 0.11, r1 = 0.04;
      const cx = tip.x - r0, cy = tip.y;
      let px = tip.x, py = tip.y;
      for (let i = 1; i <= steps; i++) {
        const f = i / steps, ang = -turn * f, rad = r0 + (r1 - r0) * f;
        const nx = cx + Math.cos(ang) * rad, ny = cy + Math.sin(ang) * rad;
        c.lineWidth = 0.05 - 0.035 * f;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
        px = nx; py = ny;
      }
      c.restore();
    }
  }
  c.restore();
}

// ---------- card rendering ----------
function fitFont(c, text, weight, size, family, maxW) {
  let s = size;
  do { c.font = `${weight} ${s}px "${family}"`; s -= 2; } while (c.measureText(text).width > maxW && s > 20);
}

function drawPlaceholder(c) {
  c.fillStyle = "#EFEDE6"; c.fillRect(0, 0, PHOTO, PHOTO);
  c.strokeStyle = INK; c.lineWidth = 12; c.lineCap = "round"; c.lineJoin = "round";
  c.fillStyle = PAPER;
  c.beginPath(); c.ellipse(540, 560, 250, 310, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(290, 580, 34, 62, 0, 0, Math.PI * 2); c.moveTo(824, 580); c.ellipse(790, 580, 34, 62, 0, 0, Math.PI * 2); c.stroke();
  c.fillStyle = INK;
  for (const x of [445, 635]) { c.beginPath(); c.arc(x, 505, 16, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.moveTo(395, 445); c.quadraticCurveTo(445, 420, 495, 440); c.moveTo(585, 440); c.quadraticCurveTo(635, 420, 685, 445); c.stroke();
  c.beginPath(); c.moveTo(540, 520); c.quadraticCurveTo(520, 600, 545, 625); c.stroke();
  c.beginPath(); c.moveTo(470, 745); c.quadraticCurveTo(540, 790, 610, 745); c.stroke();
  drawMo(c, { x: 540, y: 650, a: 0, w: 330 }, state.style, state.color);
}

function drawBand(c) {
  c.fillStyle = INK; c.fillRect(0, PHOTO, CARD_W, CARD_H - PHOTO);
  c.fillStyle = LIME; c.fillRect(0, PHOTO, CARD_W, 10);
  const pad = 60, maxW = CARD_W - pad * 2;
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.fillStyle = PAPER;
  fitFont(c, "I grew an AI mo for Movember.", 800, 70, "Funnel Display", maxW);
  c.fillText("I grew an AI mo for Movember.", pad, PHOTO + 108);
  fitFont(c, "Your turn: donate or grow one.", 400, 44, "Funnel Sans", maxW);
  c.fillText("Your turn: donate or grow one.", pad, PHOTO + 172);
  c.fillStyle = LIME; c.font = '600 38px "Funnel Sans"';
  c.fillText("#Movember", pad, PHOTO + 236);
  c.fillStyle = MUTED; c.textAlign = "right";
  fitFont(c, SHORT_URL, 400, 30, "Funnel Sans", maxW - 260);
  c.fillText(SHORT_URL, CARD_W - pad, PHOTO + 236);
}

let frame = 0;
const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); }); };
let blobTimer = 0;
function paint(c) {
  c.clearRect(0, 0, CARD_W, CARD_H);
  if (state.hasPhoto) {
    c.drawImage(photoLayer, 0, 0);
    for (const mo of state.mos) drawMo(c, mo, state.style, state.color);
  } else {
    drawPlaceholder(c);
  }
  drawBand(c);
}
// The saved and shared image is painted off screen, so the selection ring never ends up in it.
function exportCard(cb) {
  const out = document.createElement("canvas");
  out.width = CARD_W; out.height = CARD_H;
  paint(out.getContext("2d"));
  out.toBlob(cb, "image/png");
}
// Dashed ring around the selected mo while the card has focus, so keyboard users can see which one the arrows move.
function drawRing(c, mo) {
  const s = (mo.w / 2) * state.size;
  c.save();
  c.translate(mo.x, mo.y); c.rotate(mo.a);
  c.beginPath(); c.ellipse(0, 0.25 * s, s * state.style.wide * 1.2, s * 0.6, 0, 0, Math.PI * 2);
  c.setLineDash([18, 12]);
  c.lineWidth = 10; c.strokeStyle = INK; c.stroke();
  c.lineWidth = 5; c.strokeStyle = LIME; c.stroke();
  c.restore();
}
function render() {
  paint(ctx);
  if (state.hasPhoto && state.mos.length > 1 && document.activeElement === canvas) drawRing(ctx, state.mos[state.active]);
  if (state.hasPhoto) {
    clearTimeout(blobTimer);
    blobTimer = setTimeout(() => exportCard((b) => { state.blob = b; }), 250);
  }
}

// ---------- the face model (loaded from this site, runs on this device) ----------
let ai = null;
function loadAI() {
  if (!ai) {
    const p = (async () => {
      const faceapi = await import("./vendor/face-api/face-api.esm.js");
      let ok = false;
      try { ok = await faceapi.tf.setBackend("webgl"); } catch { ok = false; }
      if (!ok) await faceapi.tf.setBackend("cpu");
      await faceapi.tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromUri("vendor/face-api/model");
      await faceapi.nets.faceLandmark68Net.loadFromUri("vendor/face-api/model");
      document.body.dataset.ai = faceapi.tf.getBackend();
      return faceapi;
    })();
    ai = p;
    p.catch(() => { if (ai === p) ai = null; });
  }
  return ai;
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

const avg = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Crop the photo to the square photo area and put a mo on each face. Returns how many faces got a mo.
function place(img, faces) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  // square crop centred on the faces; for a wide group it grows past the short side and is letterboxed
  let side = Math.min(iw, ih), cx = iw / 2, cy = ih / 2;
  if (faces.length) {
    const all = faces.flat(), xs = all.map((p) => p.x), ys = all.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
    const margin = 0.6 * Math.max(...faces.map((f) => dist(f[0], f[16]))); // room for hair and ears
    side = Math.min(Math.max(iw, ih), Math.max(side, x1 - x0 + 2 * margin, y1 - y0 + 2 * margin));
  }
  const start = (c, len) => (len >= side ? Math.max(0, Math.min(len - side, c - side / 2)) : (len - side) / 2);
  const sx = start(cx, iw), sy = start(cy, ih), sc = PHOTO / side;
  const pc = photoLayer.getContext("2d");
  pc.clearRect(0, 0, PHOTO, PHOTO);
  if (side > Math.min(iw, ih)) {
    // letterbox: a blurred wash of the same photo fills the bars
    const tiny = document.createElement("canvas"), s = Math.min(iw, ih);
    tiny.width = tiny.height = 16;
    tiny.getContext("2d").drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, 0, 0, 16, 16);
    pc.imageSmoothingEnabled = true; pc.imageSmoothingQuality = "high";
    pc.drawImage(tiny, 0, 0, PHOTO, PHOTO);
    pc.fillStyle = "rgba(0,0,0,.25)"; pc.fillRect(0, 0, PHOTO, PHOTO);
  }
  pc.drawImage(img, -sx * sc, -sy * sc, iw * sc, ih * sc);
  const toCard = (p) => ({ x: (p.x - sx) * sc, y: (p.y - sy) * sc });

  state.mos = faces.map((pts) => {
    const P = (i) => toCard(pts[i]);
    const le = avg([36, 37, 38, 39, 40, 41].map(P)), re = avg([42, 43, 44, 45, 46, 47].map(P));
    const anchor = lerp(P(33), P(51), 0.12);
    const w = 0.5 * (dist(P(48), P(54)) * 1.5 + dist(le, re) * 1.15);
    return { x: anchor.x, y: anchor.y, a: Math.atan2(re.y - le.y, re.x - le.x), w };
  }).filter((m) => m.x > -m.w && m.x < PHOTO + m.w && m.y > 0 && m.y < PHOTO);
  const placed = state.mos.length;

  if (!placed) state.mos = [{ x: PHOTO / 2, y: PHOTO * 0.58, a: 0, w: PHOTO * 0.3 }];
  state.mos.forEach((m) => { m.home = { x: m.x, y: m.y, w: m.w }; });
  state.active = 0; state.hasPhoto = true; state.size = 1; $("size").value = 100;
  $("hint").textContent = state.mos.length > 1
    ? "Drag a mo to move it, or use the arrow keys. Press N to pick the next face."
    : "Drag a mo to move it. Arrow keys work too.";
  $("hint").hidden = false;
  $("save").disabled = false;
  updateLabel();
  render();
  return placed;
}

let picks = 0;
async function useImage(img, label) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) throw new Error("empty image");
  const pick = ++picks;
  state.label = label;
  setStatus("Looking for faces…");
  $("controls").disabled = false;
  // show the photo straight away with a centred mo; detection moves it onto the face(s)
  place(img, []);
  const top = canvas.getBoundingClientRect().top;
  if (top < 0 || top > window.innerHeight * 0.6) {
    // on phones scroll to the status line above the card, so the result message stays in view
    const target = matchMedia("(max-width: 899px)").matches ? $("status") : canvas;
    target.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  // small copy for detection
  const k = Math.min(1, 800 / Math.max(iw, ih));
  const small = document.createElement("canvas");
  small.width = Math.round(iw * k); small.height = Math.round(ih * k);
  small.getContext("2d").drawImage(img, 0, 0, small.width, small.height);

  let faces = [], modelFailed = false;
  try {
    const faceapi = await withTimeout(loadAI(), 12000);
    const found = await faceapi.detectAllFaces(small, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.35 })).withFaceLandmarks();
    faces = found.map((f) => f.landmarks.positions.map((p) => ({ x: p.x / k, y: p.y / k })));
  } catch (e) {
    modelFailed = true;
    if (e && e.message === "timeout") ai = null; // a stalled download: try again on the next photo
  }
  if (pick !== picks) return; // a newer photo was chosen meanwhile

  const n = place(img, faces);
  document.body.dataset.faces = String(faces.length);
  if (modelFailed) setStatus("The face model didn't load, so place the mo yourself: drag it onto your top lip.");
  else if (!n) setStatus("No face found. Drag the mo onto your top lip.");
  else if (n === 1) setStatus("Found your face. Drag the mo if it needs a nudge.");
  else setStatus(`Found ${n} faces. Everyone gets a mo.`);
}

function updateLabel() {
  if (!state.hasPhoto) return;
  const n = state.mos.length;
  canvas.setAttribute("aria-label", `${state.label} with ${n === 1 ? "a" : n} ${state.style.label.toLowerCase()} moustache${n === 1 ? "" : "s"}, captioned: ${CAPTION}`);
}

function loadFromUrl(url, label, revoke) {
  const img = new Image();
  img.onload = () => { useImage(img, label).catch(() => setStatus("That photo didn't work. Try another JPG or PNG.")).finally(() => revoke && URL.revokeObjectURL(url)); };
  img.onerror = () => { setStatus("That file didn't open as an image. Try a JPG or PNG."); if (revoke) URL.revokeObjectURL(url); };
  img.src = url;
}

function setStatus(msg) { $("status").textContent = msg; }

// ---------- pointer + keyboard editing ----------
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * CARD_W, y: ((e.clientY - r.top) / r.height) * CARD_H };
}
// nearest mo to a point, and whether the point is on it
function nearest(p) {
  let best = 0, bestD = Infinity;
  state.mos.forEach((m, i) => { const d = dist(p, m); if (d < bestD) { bestD = d; best = i; } });
  return { best, on: bestD <= state.mos[best].w * state.size * 0.8 };
}
let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  if (!state.hasPhoto) return;
  const p = toCanvas(e);
  if (p.y > PHOTO) return;
  const { best, on } = nearest(p);
  // with touch, only a touch that starts on a mo drags it; a swipe anywhere else scrolls the page
  if (!on && e.pointerType !== "mouse") return;
  const mo = state.mos[best];
  state.active = best;
  if (!on) { mo.x = p.x; mo.y = p.y; }
  drag = { dx: p.x - mo.x, dy: p.y - mo.y };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("dragging");
  render();
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = toCanvas(e), mo = state.mos[state.active];
  mo.x = Math.max(0, Math.min(PHOTO, p.x - drag.dx));
  mo.y = Math.max(0, Math.min(PHOTO, p.y - drag.dy));
  schedule();
});
const endDrag = () => { drag = null; canvas.classList.remove("dragging"); };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
// #card has touch-action: pan-y, so the page scrolls; cancel that only when the touch starts on a mo
canvas.addEventListener("touchstart", (e) => {
  if (!state.hasPhoto || e.touches.length !== 1) return;
  const p = toCanvas(e.touches[0]);
  if (p.y <= PHOTO && nearest(p).on) e.preventDefault();
}, { passive: false });
canvas.addEventListener("focus", render);
canvas.addEventListener("blur", render);
canvas.addEventListener("keydown", (e) => {
  if (!state.hasPhoto || e.metaKey || e.ctrlKey || e.altKey) return;
  const step = e.shiftKey ? 24 : 6, mo = state.mos[state.active];
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  const next = e.key === "n" || e.key === "N";
  if (!(e.key in moves || next)) return;
  e.preventDefault();
  if (next) {
    state.active = (state.active + 1) % state.mos.length;
    setStatus(`Mo ${state.active + 1} of ${state.mos.length} selected.`);
  } else {
    mo.x = Math.max(0, Math.min(PHOTO, mo.x + moves[e.key][0]));
    mo.y = Math.max(0, Math.min(PHOTO, mo.y + moves[e.key][1]));
  }
  render();
});

// ---------- controls ----------
function radioGroup(el, items, current, onPick, isSwatch) {
  el.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.type = "button"; b.className = isSwatch ? "opt swatch" : "opt";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(it === current));
    b.tabIndex = it === current ? 0 : -1;
    if (isSwatch) { b.style.setProperty("--sw", it.hex); b.setAttribute("aria-label", it.label); b.title = it.label; }
    else b.textContent = it.label;
    b.addEventListener("click", () => { onPick(it); radioGroup(el, items, it, onPick, isSwatch); el.querySelector('[aria-checked="true"]').focus(); });
    b.addEventListener("keydown", (e) => {
      const i = items.indexOf(it), d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = items[(i + d + items.length) % items.length];
      onPick(next); radioGroup(el, items, next, onPick, isSwatch); el.querySelector('[aria-checked="true"]').focus();
    });
    el.appendChild(b);
  }
}
radioGroup($("styles"), STYLES, state.style, (s) => { state.style = s; updateLabel(); render(); });
radioGroup($("colors"), COLORS, state.color, (c) => { state.color = c; render(); }, true);
$("size").addEventListener("input", (e) => { state.size = e.target.value / 100; schedule(); });
$("reset").addEventListener("click", () => {
  state.mos.forEach((m) => Object.assign(m, m.home));
  state.size = 1; $("size").value = 100; render();
});

$("photo").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = ""; // so choosing the same file again still fires
  // no type check: some pickers report no type or a generic one; img.onerror catches real non-images
  if (f) loadFromUrl(URL.createObjectURL(f), "Your photo", true);
});
$("sample").addEventListener("click", () => loadFromUrl("sample-face.jpg", "The sample face (AI-generated, not a real person)", false));

// ---------- donate, share, nominate ----------
document.querySelectorAll("[data-donate]").forEach((a) => {
  a.href = DONATE_URL;
  if (VIA_MO_SPACE) a.textContent = "Donate via Steven's Mo Space";
});
if (VIA_MO_SPACE) $("donate-note").textContent = "This opens Steven Hainley's Mo Space on movember.com, so your gift counts toward his fundraising page. It still goes straight to Movember. Nothing passes through me.";
const fullCaption = () => `${CAPTION}\nMake yours (your photo stays on your device): ${PAGE_URL}\nDonate: ${GENERAL_DONATE_URL}`;
$("caption").textContent = CAPTION;

async function copy(text, btn) {
  const old = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; }
  catch {
    const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy"); t.remove();
    btn.textContent = ok ? "Copied" : "Select and copy";
  }
  setTimeout(() => { btn.textContent = old; }, 1600);
}
$("copy-caption").addEventListener("click", (e) => copy(fullCaption(), e.currentTarget));

$("save").addEventListener("click", () => {
  exportCard((b) => {
    const url = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = url; a.download = "my-ai-mo.png"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
});

const probe = typeof File === "function" ? new File([new Blob(["x"], { type: "image/png" })], "probe.png", { type: "image/png" }) : null;
if (navigator.canShare && probe && navigator.canShare({ files: [probe] })) {
  $("share").hidden = false;
  $("share").addEventListener("click", async () => {
    if (!state.blob) return;
    const file = new File([state.blob], "my-ai-mo.png", { type: "image/png" });
    try { await navigator.share({ files: [file], text: fullCaption() }); } catch { /* closed the sheet */ }
  });
}
const syncShare = () => { $("share").disabled = !state.hasPhoto; };
new MutationObserver(syncShare).observe($("save"), { attributes: true, attributeFilter: ["disabled"] });

function nomination() {
  const names = ["f1", "f2", "f3"].map((id) => $(id).value.trim()).filter(Boolean);
  const who = names.length ? `${names.join(", ")}: you're up.` : "Your turn.";
  return `I grew an AI mo for Movember. ${who} Donate or grow one in the next 24 hours, then nominate 3 more. #Movember\nMake your mo: ${PAGE_URL}\nDonate: ${GENERAL_DONATE_URL}`;
}
const syncNomination = () => { $("nomination").value = nomination(); };
["f1", "f2", "f3"].forEach((id) => $(id).addEventListener("input", syncNomination));
syncNomination();
$("copy-nomination").addEventListener("click", (e) => copy(nomination(), e.currentTarget));
if (navigator.share) {
  $("share-nomination").hidden = false;
  $("share-nomination").addEventListener("click", async () => { try { await navigator.share({ text: nomination() }); } catch { /* closed */ } });
}

// ---------- start ----------
$("hint").hidden = true;
document.fonts.load('800 70px "Funnel Display"').then(() => document.fonts.load('400 44px "Funnel Sans"')).then(() => document.fonts.load('600 38px "Funnel Sans"')).catch(() => {}).finally(render);
render();
// load the face model right away (not when idle) and say when it's in, since from then on it works offline
loadAI().then(() => { if (!$("status").textContent) setStatus("Face model loaded. It now works with the network off."); }).catch(() => {});

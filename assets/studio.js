/* sh. industries studio homepage interactive console & night-drive canvas (strict CSP). */
(function(){
  'use strict';

  /* Sticky glass header */
  var hdr = document.getElementById('hdr');
  if (hdr) {
    var onScroll = function(){ hdr.classList.toggle('on', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Studio Console Tabs (Blacktop vs DuckyGuard) */
  var tabs = document.querySelectorAll('.st-tab');
  var panes = document.querySelectorAll('.st-pane');
  var badge = document.getElementById('st-con-badge');
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      var id = tab.getAttribute('data-target');
      var label = tab.getAttribute('data-badge') || '';
      tabs.forEach(function(t){ t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
      panes.forEach(function(p){ p.hidden = p.id !== id; });
      if (badge) badge.textContent = label;
    });
  });

  /* Compact Live Night-Drive Canvas inside Hero Console */
  var cv = document.getElementById('st-map');
  if (cv && cv.getContext) {
    var ctx = cv.getContext('2d');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pts = [[0.12,0.84],[0.26,0.68],[0.44,0.62],[0.58,0.40],[0.76,0.34],[0.88,0.18]];
    var color = '#C6FF3D';
    var frame = 0;

    function draw(step) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = cv.clientWidth || 440;
      var h = cv.clientHeight || 184;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0D111A');
      bg.addColorStop(1, '#07080D');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(-0.14);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (var x = -w; x <= w; x += 32) { ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = -h; y <= h; y += 26) { ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.restore();

      var glow = ctx.createRadialGradient(w * 0.78, h * 0.24, 4, w * 0.78, h * 0.24, 72);
      glow.addColorStop(0, 'rgba(255,107,74,0.30)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(function(p, i){
        if (i === 0) ctx.moveTo(p[0] * w, p[1] * h); else ctx.lineTo(p[0] * w, p[1] * h);
      });
      ctx.strokeStyle = color === '#FF4D6A' ? 'rgba(255,77,106,0.32)' : 'rgba(198,255,61,0.28)';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.restore();

      var end = pts[pts.length - 1];
      var pulse = (step * 0.02) % 1;
      ctx.beginPath();
      ctx.arc(end[0] * w, end[1] * h, 5 + pulse * 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,107,74,' + (0.75 * (1 - pulse)).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(end[0] * w, end[1] * h, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FF6B4A';
      ctx.fill();

      var seg = Math.min(pts.length - 2, Math.floor(((step * 0.004) % 1) * (pts.length - 1)));
      var u = (((step * 0.004) % 1) * (pts.length - 1)) - seg;
      var p0 = pts[seg], p1 = pts[seg + 1];
      var cx = (p0[0] + (p1[0] - p0[0]) * u) * w;
      var cy = (p0[1] + (p1[1] - p0[1]) * u) * h;
      var ang = Math.atan2((p1[1] - p0[1]) * h, (p1[0] - p0[0]) * w);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(5.5, 5.5); ctx.lineTo(0, 2.5); ctx.lineTo(-5.5, 5.5); ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }

    function loop() {
      frame += 1;
      draw(frame);
      if (!reduce) window.requestAnimationFrame(loop);
    }
    draw(20);
    if (!reduce) window.requestAnimationFrame(loop);

    var ov = document.getElementById('st-bt-ov');
    var ovT = document.getElementById('st-ov-t');
    var ovS = document.getElementById('st-ov-s');
    var ovP = document.getElementById('st-ov-p');
    var btns = document.querySelectorAll('.st-mini-btn');
    btns.forEach(function(btn){
      btn.addEventListener('click', function(){
        btns.forEach(function(b){ b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        var isBad = btn.getAttribute('data-case') === 'skip';
        color = isBad ? '#FF4D6A' : '#C6FF3D';
        if (ov) ov.className = 'st-bt-overlay' + (isBad ? ' skip' : '');
        if (ovT) ovT.textContent = isBad ? 'Wingstop · $4.75 · 7.6 mi (11.4m RT)' : 'Chipotle · $12.50 · 3.1 mi';
        if (ovS) ovS.textContent = isBad ? '$0.31/mi net · Avg wait 17m · Deadhead trap' : '$3.48/mi net · $31.40/hr · +$1.88 -> VOO';
        if (ovP) ovP.textContent = isBad ? 'SKIP' : 'ACCEPT';
        if (reduce) draw(frame);
      });
    });
  }
})();

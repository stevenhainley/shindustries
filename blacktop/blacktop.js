/* Blacktop interactive cockpit, Canvas night minimap, Shift Split calculator & Mac tabs.
 * Zero external requests, zero inline styles, strict CSP friendly. */
(function(){
  'use strict';

  /* Sticky glass header */
  var hdr = document.getElementById('hdr');
  if (hdr) {
    var onScroll = function(){ hdr.classList.toggle('on', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* 1. Animated 60fps Tactical Dark Night-Drive Minimap Canvas */
  var cv = document.getElementById('bt-map');
  if (cv && cv.getContext) {
    var ctx = cv.getContext('2d');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var routePts = [
      [0.14, 0.86], [0.22, 0.72], [0.36, 0.68], [0.46, 0.52],
      [0.58, 0.48], [0.68, 0.30], [0.83, 0.22]
    ];
    var accentColor = '#C6FF3D';
    var t = 0;

    function drawMap(step) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = cv.clientWidth || 320;
      var h = cv.clientHeight || 186;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Midnight asphalt base
      var bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0D111A');
      bg.addColorStop(1, '#07080D');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle rotated city street grid
      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(-0.18);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (var gx = -w; gx <= w; gx += 28) {
        ctx.beginPath(); ctx.moveTo(gx, -h); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (var gy = -h; gy <= h; gy += 24) {
        ctx.beginPath(); ctx.moveTo(-w, gy); ctx.lineTo(w, gy); ctx.stroke();
      }
      // Major arterial avenues
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-w, -18); ctx.lineTo(w, -18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, -h); ctx.lineTo(-22, h); ctx.stroke();
      ctx.restore();

      // Ambient twilight heatmap zone glow
      var heat = ctx.createRadialGradient(w * 0.72, h * 0.34, 4, w * 0.72, h * 0.34, 68);
      heat.addColorStop(0, 'rgba(255,107,74,0.28)');
      heat.addColorStop(0.6, 'rgba(255,107,74,0.06)');
      heat.addColorStop(1, 'transparent');
      ctx.fillStyle = heat;
      ctx.fillRect(0, 0, w, h);

      // Route glow + crisp ribbon
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      routePts.forEach(function(pt, i){
        var px = pt[0] * w, py = pt[1] * h;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = accentColor === '#FF4D6A' ? 'rgba(255,77,106,0.32)' : 'rgba(198,255,61,0.28)';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.restore();

      // Drop-off destination pulse
      var end = routePts[routePts.length - 1];
      var ex = end[0] * w, ey = end[1] * h;
      var pulse = (step * 0.02) % 1;
      ctx.beginPath();
      ctx.arc(ex, ey, 6 + pulse * 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,107,74,' + (0.75 * (1 - pulse)).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FF6B4A';
      ctx.fill();

      // Animated driver chevron along route
      var seg = Math.min(routePts.length - 2, Math.floor(((step * 0.004) % 1) * (routePts.length - 1)));
      var local = (((step * 0.004) % 1) * (routePts.length - 1)) - seg;
      var p0 = routePts[seg], p1 = routePts[seg + 1];
      var cx = (p0[0] + (p1[0] - p0[0]) * local) * w;
      var cy = (p0[1] + (p1[1] - p0[1]) * local) * h;
      var ang = Math.atan2((p1[1] - p0[1]) * h, (p1[0] - p0[0]) * w);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = '#090A0E';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    function tick() {
      t += 1;
      drawMap(t);
      if (!reduce) window.requestAnimationFrame(tick);
    }
    drawMap(24);
    if (!reduce) window.requestAnimationFrame(tick);

    /* 2. Interactive Offer-Check Simulator */
    var OFFERS = {
      chipotle: {
        cls: '',
        accent: '#C6FF3D',
        pill: 'ACCEPT · $3.48/MI NET',
        time: '0.38s OCR',
        title: 'Chipotle · $12.50 · 3.1 mi',
        sub: 'Est. $31.40/hr · Avg wait 3m · +$2.36 IRS shield',
        island: '+18.2 mi · $13.83 tax',
        net: '$94.60',
        hr: '$28.40',
        voo: '$14.19',
        zone: 'WORCESTER · HIGHLAND ST',
        mph: '29'
      },
      wingstop: {
        cls: 'skip',
        accent: '#FF4D6A',
        pill: 'SKIP · $0.31/MI NET',
        time: '0.34s OCR',
        title: 'Wingstop · $4.75 · 7.6 mi (11.4 mi RT)',
        sub: 'Deadhead trap · Your note: Wingstop avg 17m wait',
        island: 'SAVED 38 MIN · SKIPPED',
        net: '$82.10',
        hr: '$26.80',
        voo: '$12.32',
        zone: 'DEADHEAD WARNING · RT 12',
        mph: '34'
      },
      surge: {
        cls: 'surge',
        accent: '#2CE6C5',
        pill: 'ACCEPT · RAIN SURGE',
        time: '0.41s OCR',
        title: 'Oishi Sushi · $18.25 · 4.8 mi',
        sub: 'WeatherKit Rain +22% · DCU Center exit in 24m',
        island: '+23.0 mi · $17.48 tax',
        net: '$112.85',
        hr: '$33.10',
        voo: '$16.93',
        zone: 'DOWNTOWN · EVENT SURGE',
        mph: '24'
      }
    };

    var vBox = document.getElementById('bt-verdict');
    var vPill = document.getElementById('bt-v-pill');
    var vTime = document.getElementById('bt-v-time');
    var vTitle = document.getElementById('bt-v-title');
    var vSub = document.getElementById('bt-v-sub');
    var islTax = document.getElementById('bt-isl-tax');
    var mNet = document.getElementById('bt-m-net');
    var mHr = document.getElementById('bt-m-hr');
    var mVoo = document.getElementById('bt-m-voo');
    var mZone = document.getElementById('bt-m-zone');
    var mMph = document.getElementById('bt-m-mph');
    var offerBtns = document.querySelectorAll('.bt-offer-btn');

    offerBtns.forEach(function(btn){
      btn.addEventListener('click', function(){
        var key = btn.getAttribute('data-offer');
        var d = OFFERS[key];
        if (!d) return;
        offerBtns.forEach(function(b){ b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        accentColor = d.accent;
        if (vBox) vBox.className = 'bt-verdict' + (d.cls ? ' ' + d.cls : '');
        if (vPill) vPill.textContent = d.pill;
        if (vTime) vTime.textContent = d.time;
        if (vTitle) vTitle.textContent = d.title;
        if (vSub) vSub.textContent = d.sub;
        if (islTax) islTax.textContent = d.island;
        if (mNet) mNet.textContent = d.net;
        if (mHr) mHr.textContent = d.hr;
        if (mVoo) mVoo.textContent = d.voo;
        if (mZone) mZone.textContent = d.zone;
        if (mMph) mMph.textContent = d.mph;
        if (reduce) drawMap(t);
      });
    });
  }

  /* 3. Interactive Shift Split + 2026 Split-Rate Tax Calculator */
  var elGross = document.getElementById('calc-gross');
  var elMiles = document.getElementById('calc-miles');
  var elTax = document.getElementById('calc-tax');
  var elInv = document.getElementById('calc-inv');
  var tickerBtns = document.querySelectorAll('.bt-ticker');
  var activeTicker = { sym: 'VOO', price: 545 };

  function fmt(n) { return '$' + n.toFixed(2); }
  function fmtInt(n) { return '$' + Math.round(n).toLocaleString(); }

  function updateCalc() {
    if (!elGross || !elMiles || !elTax || !elInv) return;
    var gross = parseFloat(elGross.value) || 450;
    var miles = parseFloat(elMiles.value) || 260;
    var taxPct = parseFloat(elTax.value) || 20;
    var invPct = parseFloat(elInv.value) || 15;

    var gasCost = miles * 0.14; // ~$3.50/gal @ 25 mpg estimate
    var net = Math.max(0, gross - gasCost);
    var taxVault = net * (taxPct / 100);
    var invSplit = net * (invPct / 100);
    var takeHome = Math.max(0, net - taxVault - invSplit);

    // 2026 H2 IRS mileage deduction (76.0 cents/mi Jul-Dec 2026)
    var wkDeduction = miles * 0.76;
    var yrInvested = invSplit * 48;
    var yrShares = yrInvested / activeTicker.price;
    var estTips = gross * 0.56; // typical delivery voluntary tip share

    var set = function(id, val){ var el = document.getElementById(id); if (el) el.textContent = val; };
    set('out-gross-v', fmtInt(gross) + '/wk');
    set('out-miles-v', Math.round(miles) + ' mi/wk');
    set('out-tax-v', taxPct + '%');
    set('out-inv-v', invPct + '%');

    set('rec-net', fmt(net));
    set('rec-take', fmt(takeHome));
    set('rec-tax', fmt(taxVault));
    set('rec-inv', fmt(invSplit) + ' -> ' + activeTicker.sym);
    set('rec-deduct', fmt(wkDeduction) + ' (76.0¢/mi)');
    set('rec-tips', fmt(estTips) + ' tracked');
    set('rec-yr', fmtInt(yrInvested) + ' (~' + yrShares.toFixed(2) + ' ' + activeTicker.sym + ')');

    var takePct = Math.max(5, 100 - taxPct - invPct);
    var bTake = document.getElementById('bar-take');
    var bTax = document.getElementById('bar-tax');
    var bInv = document.getElementById('bar-inv');
    if (bTake) bTake.style.width = takePct + '%';
    if (bTax) bTax.style.width = taxPct + '%';
    if (bInv) bInv.style.width = invPct + '%';
  }

  [elGross, elMiles, elTax, elInv].forEach(function(inp){
    if (inp) inp.addEventListener('input', updateCalc);
  });
  tickerBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      tickerBtns.forEach(function(b){ b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      activeTicker = {
        sym: btn.getAttribute('data-sym') || 'VOO',
        price: parseFloat(btn.getAttribute('data-price')) || 545
      };
      updateCalc();
    });
  });
  updateCalc();

  /* 4. Mac Command Center Tabs */
  var macTabs = document.querySelectorAll('.bt-mac-tab');
  var macPanes = document.querySelectorAll('.bt-mac-pane');
  var macTitle = document.getElementById('bt-mac-title');
  macTabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      var target = tab.getAttribute('data-pane');
      var title = tab.getAttribute('data-title') || 'Blacktop — Mac Command Center';
      macTabs.forEach(function(t){ t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
      macPanes.forEach(function(p){ p.hidden = p.id !== target; });
      if (macTitle) macTitle.textContent = title;
    });
  });

  /* 5. Copy Beta Email (zero Mixed-Content mailto form!) */
  var copyBtn = document.getElementById('bt-copy-email');
  var copyMsg = document.getElementById('bt-copy-msg');
  if (copyBtn) {
    copyBtn.addEventListener('click', function(){
      var addr = 'steven@shindustries.co';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addr).then(function(){
          if (copyMsg) copyMsg.textContent = 'Copied steven@shindustries.co — send "Blacktop TestFlight" to get the first invite.';
        }).catch(function(){
          if (copyMsg) copyMsg.textContent = 'Email steven@shindustries.co with subject "Blacktop TestFlight".';
        });
      } else if (copyMsg) {
        copyMsg.textContent = 'Email steven@shindustries.co with subject "Blacktop TestFlight".';
      }
    });
  }
})();

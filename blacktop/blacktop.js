/* Blacktop interactive preview, real-earnings calculator, platform tabs & Stripe checkout handoff.
 * Zero external requests until user clicks Stripe Checkout, zero inline styles, strict CSP friendly. */
(function(){
  'use strict';

  /* Replace with your live Stripe Payment Link once activated in Stripe Dashboard */
  var STRIPE_PAYMENT_LINK = '';

  /* Sticky glass header */
  var hdr = document.getElementById('hdr');
  if (hdr) {
    var onScroll = function(){ hdr.classList.toggle('on', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* 1. Animated Dark Driving Map Canvas */
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

      var bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0D111A');
      bg.addColorStop(1, '#07080D');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

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
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-w, -18); ctx.lineTo(w, -18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, -h); ctx.lineTo(-22, h); ctx.stroke();
      ctx.restore();

      var heat = ctx.createRadialGradient(w * 0.72, h * 0.34, 4, w * 0.72, h * 0.34, 68);
      heat.addColorStop(0, 'rgba(255,107,74,0.28)');
      heat.addColorStop(0.6, 'rgba(255,107,74,0.06)');
      heat.addColorStop(1, 'transparent');
      ctx.fillStyle = heat;
      ctx.fillRect(0, 0, w, h);

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

    /* 2. Plain-English Order Check Simulator */
    var OFFERS = {
      chipotle: {
        cls: '',
        accent: '#C6FF3D',
        pill: 'TAKE IT · $3.48/MI',
        time: 'After gas',
        title: 'Chipotle · $12.50 · 3.1 mi',
        sub: '~$31.40/hr pace · Usually 3m wait · +$2.36 tax write-off',
        island: '18.2 mi · $13.83 write-off',
        net: '$94.60',
        hr: '$28.40',
        voo: '$14.19',
        zone: 'HIGHLAND ST · BUSY',
        mph: '29'
      },
      wingstop: {
        cls: 'skip',
        accent: '#FF4D6A',
        pill: 'SKIP IT · $0.31/MI',
        time: 'After gas',
        title: 'Wingstop · $4.75 · 7.6 mi (long drive back)',
        sub: 'Not worth it · Your note: Wingstop avg 17m wait',
        island: 'SAVED 38 MIN · SKIPPED',
        net: '$82.10',
        hr: '$26.80',
        voo: '$12.32',
        zone: 'LOW PAY · LONG RETURN',
        mph: '34'
      },
      surge: {
        cls: 'surge',
        accent: '#2CE6C5',
        pill: 'TAKE IT · RAIN RUSH',
        time: 'Busy now',
        title: 'Oishi Sushi · $18.25 · 4.8 mi',
        sub: 'Rain rush active · Concert letting out nearby in 24m',
        island: '23.0 mi · $17.48 write-off',
        net: '$112.85',
        hr: '$33.10',
        voo: '$16.93',
        zone: 'DOWNTOWN · BUSY NIGHT',
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

  /* 3. Interactive Real-Earnings & 2026 Tax Calculator */
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

    var gasCost = miles * 0.14;
    var net = Math.max(0, gross - gasCost);
    var taxVault = net * (taxPct / 100);
    var invSplit = net * (invPct / 100);
    var takeHome = Math.max(0, net - taxVault - invSplit);

    var wkDeduction = miles * 0.76;
    var yrInvested = invSplit * 48;
    var estTips = gross * 0.56;

    var set = function(id, val){ var el = document.getElementById(id); if (el) el.textContent = val; };
    set('out-gross-v', fmtInt(gross) + '/wk');
    set('out-miles-v', Math.round(miles) + ' mi/wk');
    set('out-tax-v', taxPct + '%');
    set('out-inv-v', invPct + '%');

    set('rec-net', fmt(net));
    set('rec-take', fmt(takeHome));
    set('rec-tax', fmt(taxVault));
    set('rec-inv', fmt(invSplit) + ' → ' + (activeTicker.sym === 'CASH' ? 'Savings' : activeTicker.sym));
    set('rec-deduct', fmt(wkDeduction) + ' (76.0¢/mi)');
    set('rec-tips', fmt(estTips) + ' tracked');

    if (activeTicker.sym === 'CASH') {
      set('rec-yr', fmtInt(yrInvested) + ' cash saved');
    } else {
      var yrShares = yrInvested / activeTicker.price;
      set('rec-yr', fmtInt(yrInvested) + ' (~' + yrShares.toFixed(2) + ' ' + activeTicker.sym + ')');
    }

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

  /* 4. Platform Showcase Tabs */
  var macTabs = document.querySelectorAll('.bt-mac-tab');
  var macPanes = document.querySelectorAll('.bt-mac-pane');
  var macTitle = document.getElementById('bt-mac-title');
  macTabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      var target = tab.getAttribute('data-pane');
      var title = tab.getAttribute('data-title') || 'Blacktop';
      macTabs.forEach(function(t){ t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
      macPanes.forEach(function(p){ p.hidden = p.id !== target; });
      if (macTitle) macTitle.textContent = title;
    });
  });

  /* 5. Stripe Checkout Button */
  var stripeBtn = document.getElementById('bt-stripe-btn');
  var copyMsg = document.getElementById('bt-copy-msg');
  if (stripeBtn) {
    stripeBtn.addEventListener('click', function(){
      if (STRIPE_PAYMENT_LINK) {
        window.open(STRIPE_PAYMENT_LINK, '_blank', 'noopener');
        return;
      }
      var addr = 'steven@shindustries.co';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(addr).catch(function(){});
      }
      if (copyMsg) {
        copyMsg.textContent = 'Stripe Checkout opens at public launch. Try the full Free Web App now, or email steven@shindustries.co (copied) to get an early Android APK + $9.99 Stripe invoice.';
      }
    });
  }
})();

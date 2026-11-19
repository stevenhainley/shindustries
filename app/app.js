/* Blacktop Mobile Web App (iPhone + Android PWA) · Local-first + Stripe Pro Pass
 * Zero external tracking, strict CSP compliant, works offline. */
(function(){
  'use strict';

  var STORAGE_KEY = 'blacktop_driver_v1';
  var STRIPE_PAYMENT_LINK = ''; /* Paste live Stripe Payment Link when ready */
  var LICENSE_API = 'https://api.shindustries.co/api/verify-license';
  var IRS_H1_2026 = 0.725;
  var IRS_H2_2026 = 0.76;
  var FREE_DAILY_CHECKS = 5;

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function isH1Date(isoDate) {
    var m = parseInt((isoDate || todayStr()).split('-')[1], 10) || 11;
    return m <= 6;
  }

  function rateForDate(isoDate) {
    return isH1Date(isoDate) ? IRS_H1_2026 : IRS_H2_2026;
  }

  function defaultState() {
    return {
      isPro: false,
      licenseKey: '',
      shiftActive: false,
      shiftStartMs: 0,
      shiftElapsedSec: 0,
      extraMilesH1: 0,
      extraMilesH2: 0,
      mpg: 26,
      gasPrice: 3.50,
      taxPct: 20,
      invPct: 15,
      checksDate: todayStr(),
      checksUsedToday: 0,
      deliveries: [],
      spots: [
        { id: 's1', type: 'slow', name: 'Wingstop', note: 'Usually 15–20 min wait on Friday/Saturday nights' },
        { id: 's2', type: 'gate', name: 'Sample Apts', note: '#4821 — Park by Building B side door' }
      ]
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      return defaultState();
    }
  }

  var state = loadState();
  if (state.checksDate !== todayStr()) {
    state.checksDate = todayStr();
    state.checksUsedToday = 0;
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function fmt(n) { return '$' + (Number(n) || 0).toFixed(2); }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  /* Register offline PWA Service Worker */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function(){});
  }

  /* Navigation Tabs */
  var tabs = document.querySelectorAll('.tab');
  var views = document.querySelectorAll('.view');
  function switchTab(name) {
    tabs.forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tab') === name); });
    views.forEach(function(v){ v.classList.toggle('active', v.id === 'view-' + name); });
    if (name === 'recap') renderRecapCanvas();
  }
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){ switchTab(tab.getAttribute('data-tab')); });
  });
  var proBadgeBtn = document.getElementById('pro-badge-btn');
  if (proBadgeBtn) proBadgeBtn.addEventListener('click', function(){ switchTab('recap'); });

  /* Deep-link hash support (#check for iPhone Shortcut, #pro for Stripe unlock) */
  if (location.hash === '#check') switchTab('check');
  if (location.hash === '#pro') switchTab('recap');

  /* Shift Timer & GPS Tracking */
  var gpsWatchId = null;
  var lastPos = null;
  var timerInt = null;

  function currentElapsedSec() {
    var base = state.shiftElapsedSec || 0;
    if (state.shiftActive && state.shiftStartMs) {
      return base + Math.max(0, Math.floor((Date.now() - state.shiftStartMs) / 1000));
    }
    return base;
  }

  function formatHMS(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return [h, m, s].map(function(v){ return String(v).padStart(2, '0'); }).join(':');
  }

  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3958.8;
    var toRad = function(x){ return x * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function computeTotals() {
    var base = 0, tip = 0, cash = 0, h1Miles = state.extraMilesH1 || 0, h2Miles = state.extraMilesH2 || 0;
    state.deliveries.forEach(function(d){
      base += Number(d.base) || 0;
      tip += Number(d.tip) || 0;
      cash += Number(d.cash) || 0;
      if (isH1Date(d.date)) h1Miles += Number(d.miles) || 0;
      else h2Miles += Number(d.miles) || 0;
    });
    var totalMiles = h1Miles + h2Miles;
    var gross = base + tip + cash;
    var gasPerMile = (state.gasPrice || 3.5) / Math.max(10, state.mpg || 26);
    var gasCost = totalMiles * gasPerMile;
    var net = Math.max(0, gross - gasCost);
    var h1Ded = h1Miles * IRS_H1_2026;
    var h2Ded = h2Miles * IRS_H2_2026;
    var totalDed = h1Ded + h2Ded;
    var sec = currentElapsedSec();
    var hrs = sec > 60 ? sec / 3600 : (state.deliveries.length ? state.deliveries.length * 0.35 : 0);
    var realHr = hrs > 0 ? net / hrs : 0;
    return {
      base: base, tip: tip, cash: cash, totalTips: tip + cash,
      h1Miles: h1Miles, h2Miles: h2Miles, totalMiles: totalMiles,
      gross: gross, gasCost: gasCost, net: net,
      h1Ded: h1Ded, h2Ded: h2Ded, totalDed: totalDed,
      realHr: realHr, sec: sec
    };
  }

  function renderAll() {
    var t = computeTotals();
    var set = function(id, v){ var el = document.getElementById(id); if (el) el.textContent = v; };

    set('s-net', fmt(t.net));
    set('s-sub', 'Kept after ' + fmt(t.gasCost) + ' gas · ' + state.deliveries.length + ' ' + (state.deliveries.length === 1 ? 'order' : 'orders'));
    set('s-hr', fmt(t.realHr));
    set('s-miles', t.totalMiles.toFixed(1) + ' mi');
    set('s-tax', fmt(t.totalDed));
    set('s-tips', fmt(t.totalTips));
    set('s-timer', formatHMS(t.sec));
    set('shift-status-sub', state.shiftActive ? 'Shift live' : 'Ready to dash');

    var toggleBtn = document.getElementById('btn-shift-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = state.shiftActive ? 'End Shift' : 'Start Shift';
      toggleBtn.classList.toggle('active-stop', state.shiftActive);
    }

    /* Pro UI state */
    if (proBadgeBtn) {
      proBadgeBtn.textContent = state.isPro ? 'PRO ACTIVE' : 'FREE · Upgrade';
      proBadgeBtn.classList.toggle('pro', state.isPro);
    }
    set('pro-status-tag', state.isPro ? 'PRO UNLOCKED' : '$9.99 Once · Stripe');
    var rem = Math.max(0, FREE_DAILY_CHECKS - (state.checksUsedToday || 0));
    set('checks-left', state.isPro ? 'Unlimited Pro checks' : rem + ' free checks left today');

    /* Delivery list */
    var dl = document.getElementById('delivery-list');
    if (dl) {
      if (!state.deliveries.length) {
        dl.innerHTML = '<li class="empty-msg">No orders logged yet. Start your shift and log your first delivery above.</li>';
      } else {
        dl.innerHTML = state.deliveries.slice().reverse().map(function(d){
          var total = (Number(d.base) || 0) + (Number(d.tip) || 0) + (Number(d.cash) || 0);
          return '<li class="list-item"><div><strong>' + escapeHtml(d.store) + ' · ' + escapeHtml(d.app) + '</strong><span>' + Number(d.miles).toFixed(1) + ' mi · Base ' + fmt(d.base) + ' + Tip ' + fmt((Number(d.tip) || 0) + (Number(d.cash) || 0)) + '</span></div><div class="list-right"><b>' + fmt(total) + '</b><button class="text-btn danger" type="button" data-del-id="' + escapeHtml(d.id) + '" aria-label="Delete order">×</button></div></li>';
        }).join('');
      }
    }

    /* Taxes & Shift Split */
    set('tx-h1', t.h1Miles.toFixed(1) + ' mi · ' + fmt(t.h1Ded));
    set('tx-h2', t.h2Miles.toFixed(1) + ' mi · ' + fmt(t.h2Ded));
    set('tx-total', fmt(t.totalDed));
    set('tx-base', fmt(t.base));
    set('tx-tips', fmt(t.tip));
    set('tx-cash', fmt(t.cash));

    var taxAmt = t.net * (state.taxPct / 100);
    var invAmt = t.net * (state.invPct / 100);
    var keepAmt = Math.max(0, t.net - taxAmt - invAmt);
    set('sp-tax-pct', state.taxPct + '%');
    set('sp-inv-pct', state.invPct + '%');
    set('sp-keep', fmt(keepAmt));
    set('sp-tax-amt', fmt(taxAmt));
    set('sp-inv-amt', fmt(invAmt));

    renderSpots();
  }

  /* Shift Start/End */
  var btnShift = document.getElementById('btn-shift-toggle');
  if (btnShift) {
    btnShift.addEventListener('click', function(){
      if (!state.shiftActive) {
        state.shiftActive = true;
        state.shiftStartMs = Date.now();
      } else {
        state.shiftElapsedSec = currentElapsedSec();
        state.shiftActive = false;
        state.shiftStartMs = 0;
      }
      saveState();
      renderAll();
    });
  }

  timerInt = window.setInterval(function(){
    if (state.shiftActive) {
      var el = document.getElementById('s-timer');
      if (el) el.textContent = formatHMS(currentElapsedSec());
    }
  }, 1000);

  /* Browser GPS Miles */
  var btnGps = document.getElementById('btn-gps-toggle');
  var gpsHint = document.getElementById('gps-hint');
  if (btnGps) {
    btnGps.addEventListener('click', function(){
      if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
        lastPos = null;
        btnGps.textContent = 'GPS Miles: Off';
        if (gpsHint) gpsHint.textContent = 'GPS tracking paused.';
        return;
      }
      if (!navigator.geolocation) {
        if (gpsHint) gpsHint.textContent = 'GPS not supported in this browser — enter miles manually.';
        return;
      }
      btnGps.textContent = 'GPS Miles: On';
      if (gpsHint) gpsHint.textContent = 'Tracking GPS miles while screen stays awake...';
      gpsWatchId = navigator.geolocation.watchPosition(function(pos){
        var c = pos.coords;
        if (c.accuracy && c.accuracy > 80) return;
        if (lastPos) {
          var dist = haversineMiles(lastPos.latitude, lastPos.longitude, c.latitude, c.longitude);
          if (dist > 0.02 && dist < 2.0) {
            if (isH1Date(todayStr())) state.extraMilesH1 += dist;
            else state.extraMilesH2 += dist;
            saveState();
            renderAll();
          }
        }
        lastPos = { latitude: c.latitude, longitude: c.longitude };
      }, function(){
        if (gpsHint) gpsHint.textContent = 'Location permission denied — enter miles manually below.';
        btnGps.textContent = 'GPS Miles: Off';
        gpsWatchId = null;
      }, { enableHighAccuracy: true, maximumAge: 5000 });
    });
  }

  /* Log Delivery Form */
  var delForm = document.getElementById('delivery-form');
  if (delForm) {
    delForm.addEventListener('submit', function(e){
      e.preventDefault();
      var store = (document.getElementById('d-store').value || '').trim();
      var app = document.getElementById('d-app').value;
      var base = parseFloat(document.getElementById('d-base').value) || 0;
      var tip = parseFloat(document.getElementById('d-tip').value) || 0;
      var cash = parseFloat(document.getElementById('d-cash').value) || 0;
      var miles = parseFloat(document.getElementById('d-miles').value) || 0;
      if (!store) return;
      state.deliveries.push({
        id: 'd' + Date.now(),
        date: todayStr(),
        app: app,
        store: store,
        base: base,
        tip: tip,
        cash: cash,
        miles: miles
      });
      delForm.reset();
      document.getElementById('d-tip').value = '0';
      document.getElementById('d-cash').value = '0';
      saveState();
      renderAll();
    });
  }

  /* Delete delivery */
  var delList = document.getElementById('delivery-list');
  if (delList) {
    delList.addEventListener('click', function(e){
      var id = e.target && e.target.getAttribute('data-del-id');
      if (!id) return;
      state.deliveries = state.deliveries.filter(function(d){ return d.id !== id; });
      saveState();
      renderAll();
    });
  }

  /* Extra return miles */
  var btnAddMiles = document.getElementById('btn-add-miles');
  if (btnAddMiles) {
    btnAddMiles.addEventListener('click', function(){
      var inp = document.getElementById('extra-miles-in');
      var m = parseFloat(inp && inp.value) || 0;
      if (m <= 0) return;
      if (isH1Date(todayStr())) state.extraMilesH1 += m;
      else state.extraMilesH2 += m;
      inp.value = '';
      saveState();
      renderAll();
    });
  }

  var btnClearShift = document.getElementById('btn-clear-shift');
  if (btnClearShift) {
    btnClearShift.addEventListener('click', function(){
      state.deliveries = [];
      state.extraMilesH1 = 0;
      state.extraMilesH2 = 0;
      state.shiftActive = false;
      state.shiftStartMs = 0;
      state.shiftElapsedSec = 0;
      saveState();
      renderAll();
    });
  }

  /* TAB 2: ORDER CHECKER */
  var offerForm = document.getElementById('offer-form');
  var presetBtns = document.querySelectorAll('[data-preset]');

  function runOfferCheck(pay, miles, mins, store, includeReturn, mpg, gasPrice) {
    if (!state.isPro && state.checksUsedToday >= FREE_DAILY_CHECKS) {
      var vc = document.getElementById('verdict-card');
      if (vc) vc.className = 'card verdict-card maybe';
      document.getElementById('v-pill').textContent = 'DAILY LIMIT REACHED';
      document.getElementById('v-headline').textContent = 'Unlock unlimited checks for $9.99 once';
      document.getElementById('v-detail').textContent = 'Free includes 5 order checks/day. Grab the one-time Stripe Pro Pass in the Recap tab for unlimited checks forever.';
      return;
    }

    if (!state.isPro) {
      state.checksUsedToday += 1;
    }
    state.mpg = mpg;
    state.gasPrice = gasPrice;
    saveState();

    var effectiveMiles = includeReturn ? miles * 1.45 : miles;
    var gasCost = (effectiveMiles / Math.max(10, mpg)) * gasPrice;
    var netPay = Math.max(0, pay - gasCost);
    var netPerMile = effectiveMiles > 0 ? netPay / effectiveMiles : 0;

    /* Check saved slow-spot notes */
    var storeWarn = '';
    var extraWait = 0;
    if (store) {
      var q = store.toLowerCase();
      state.spots.forEach(function(sp){
        if (sp.type === 'slow' && sp.name.toLowerCase().indexOf(q) !== -1) {
          storeWarn = 'Heads up — your note for ' + sp.name + ': ' + sp.note;
          extraWait = 12;
        }
      });
    }

    var totalMins = Math.max(5, mins + extraWait);
    var estHr = (netPay / totalMins) * 60;
    var taxWriteOff = effectiveMiles * rateForDate(todayStr());

    var cls = 'skip', pill = 'SKIP IT', title = 'Skip this one — not worth the miles';
    if (netPerMile >= 1.5 && estHr >= 20 && !storeWarn) {
      cls = 'take'; pill = 'TAKE IT'; title = 'Good order — solid pay after gas';
    } else if (netPerMile >= 1.0 && estHr >= 15) {
      cls = 'maybe'; pill = 'MAYBE'; title = 'Borderline — only take if slow';
    }

    var vc2 = document.getElementById('verdict-card');
    if (vc2) vc2.className = 'card verdict-card ' + cls;
    document.getElementById('v-pill').textContent = pill + ' · ' + fmt(netPerMile) + '/MI';
    document.getElementById('v-headline').textContent = (store ? store + ' — ' : '') + title;
    document.getElementById('v-detail').textContent = fmt(pay) + ' for ' + miles.toFixed(1) + ' mi (' + effectiveMiles.toFixed(1) + ' mi w/ return) · ~' + totalMins + ' min';
    document.getElementById('v-net-mi').textContent = fmt(netPerMile);
    document.getElementById('v-hr').textContent = fmt(estHr);
    document.getElementById('v-gas').textContent = fmt(gasCost);
    document.getElementById('v-tax').textContent = fmt(taxWriteOff);

    var warnEl = document.getElementById('v-store-warn');
    if (warnEl) {
      warnEl.hidden = !storeWarn;
      warnEl.textContent = storeWarn;
    }
    renderAll();
  }

  if (offerForm) {
    offerForm.addEventListener('submit', function(e){
      e.preventDefault();
      var pay = parseFloat(document.getElementById('o-pay').value) || 0;
      var miles = parseFloat(document.getElementById('o-miles').value) || 0;
      var mins = parseFloat(document.getElementById('o-mins').value) || 20;
      var store = (document.getElementById('o-store').value || '').trim();
      var ret = document.getElementById('o-return').checked;
      var mpg = parseFloat(document.getElementById('o-mpg').value) || 26;
      var gas = parseFloat(document.getElementById('o-gas').value) || 3.5;
      if (pay <= 0 || miles <= 0) return;
      runOfferCheck(pay, miles, mins, store, ret, mpg, gas);
    });
  }

  presetBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      var isGood = btn.getAttribute('data-preset') === 'good';
      document.getElementById('o-pay').value = isGood ? '12.50' : '4.75';
      document.getElementById('o-miles').value = isGood ? '3.1' : '7.6';
      document.getElementById('o-mins').value = isGood ? '20' : '28';
      document.getElementById('o-store').value = isGood ? 'Chipotle' : 'Wingstop';
      runOfferCheck(isGood ? 12.5 : 4.75, isGood ? 3.1 : 7.6, isGood ? 20 : 28, isGood ? 'Chipotle' : 'Wingstop', true, state.mpg, state.gasPrice);
    });
  });

  /* TAB 3: TAXES & SPLIT */
  var spTax = document.getElementById('sp-tax');
  var spInv = document.getElementById('sp-inv');
  if (spTax) {
    spTax.value = state.taxPct;
    spTax.addEventListener('input', function(){ state.taxPct = parseInt(spTax.value, 10) || 20; saveState(); renderAll(); });
  }
  if (spInv) {
    spInv.value = state.invPct;
    spInv.addEventListener('input', function(){ state.invPct = parseInt(spInv.value, 10) || 15; saveState(); renderAll(); });
  }

  var btnCopySplit = document.getElementById('btn-copy-split');
  if (btnCopySplit) {
    btnCopySplit.addEventListener('click', function(){
      var t = computeTotals();
      var invAmt = (t.net * (state.invPct / 100)).toFixed(2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(invAmt).catch(function(){});
      }
      var msg = document.getElementById('split-msg');
      if (msg) msg.textContent = 'Copied $' + invAmt + ' — paste right into Robinhood, Fidelity, or Cash App.';
    });
  }

  var btnAddHist = document.getElementById('btn-add-hist');
  if (btnAddHist) {
    btnAddHist.addEventListener('click', function(){
      state.extraMilesH1 += 50;
      saveState();
      renderAll();
      var msg = document.getElementById('tax-msg');
      if (msg) msg.textContent = 'Added +50.0 mi to Jan–Jun 2026 (72.5¢/mi) for testing.';
    });
  }

  var btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', function(){
      if (!state.isPro) {
        var msg = document.getElementById('tax-msg');
        if (msg) msg.textContent = 'Full 2026 Tax CSV export is included in the $9.99 one-time Stripe Pro Pass (tap Recap tab to unlock).';
        return;
      }
      var rows = [['Date','Period','IRS_Rate','App','Store','Miles','Write_Off_USD','Base_Pay','In_App_Tip','Cash_Tip']];
      state.deliveries.forEach(function(d){
        var r = rateForDate(d.date);
        rows.push([d.date, isH1Date(d.date) ? '2026-H1' : '2026-H2', r.toFixed(3), d.app, d.store, Number(d.miles).toFixed(2), (Number(d.miles) * r).toFixed(2), Number(d.base).toFixed(2), Number(d.tip).toFixed(2), Number(d.cash).toFixed(2)]);
      });
      if (state.extraMilesH1 > 0) rows.push(['2026-06-30','2026-H1','0.725','Shift','Unassigned / Return Miles',state.extraMilesH1.toFixed(2),(state.extraMilesH1*IRS_H1_2026).toFixed(2),'0.00','0.00','0.00']);
      if (state.extraMilesH2 > 0) rows.push([todayStr(),'2026-H2','0.760','Shift','Unassigned / Return Miles',state.extraMilesH2.toFixed(2),(state.extraMilesH2*IRS_H2_2026).toFixed(2),'0.00','0.00','0.00']);
      var csv = rows.map(function(row){ return row.map(function(cell){ return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'blacktop-2026-tax-log.csv';
      a.click();
    });
  }

  /* TAB 4: GATE CODES & SLOW SPOTS */
  var spotSearch = document.getElementById('spot-search');
  function renderSpots() {
    var ul = document.getElementById('spot-list');
    if (!ul) return;
    var q = (spotSearch && spotSearch.value || '').trim().toLowerCase();
    var filtered = state.spots.filter(function(s){
      return !q || s.name.toLowerCase().indexOf(q) !== -1 || s.note.toLowerCase().indexOf(q) !== -1;
    });
    if (!filtered.length) {
      ul.innerHTML = '<li class="empty-msg">No saved spots match your search.</li>';
      return;
    }
    ul.innerHTML = filtered.map(function(s){
      var cls = s.type === 'gate' ? 'gate' : 'slow';
      var lbl = s.type === 'gate' ? 'GATE' : 'SLOW';
      return '<li class="list-item"><div><strong><span class="spot-badge ' + cls + '">' + lbl + '</span>' + escapeHtml(s.name) + '</strong><span>' + escapeHtml(s.note) + '</span></div><button class="text-btn danger" type="button" data-spot-del="' + escapeHtml(s.id) + '" aria-label="Delete note">×</button></li>';
    }).join('');
  }

  var spotForm = document.getElementById('spot-form');
  if (spotForm) {
    spotForm.addEventListener('submit', function(e){
      e.preventDefault();
      var type = document.getElementById('sp-type').value;
      var name = (document.getElementById('sp-name').value || '').trim();
      var note = (document.getElementById('sp-note').value || '').trim();
      if (!name || !note) return;
      state.spots.unshift({ id: 'sp' + Date.now(), type: type, name: name, note: note });
      spotForm.reset();
      saveState();
      renderSpots();
    });
  }
  if (spotSearch) spotSearch.addEventListener('input', renderSpots);
  var spotList = document.getElementById('spot-list');
  if (spotList) {
    spotList.addEventListener('click', function(e){
      var id = e.target && e.target.getAttribute('data-spot-del');
      if (!id) return;
      state.spots = state.spots.filter(function(s){ return s.id !== id; });
      saveState();
      renderSpots();
    });
  }

  /* TAB 5: SHIFT RECAP CANVAS & STRIPE PRO */
  function renderRecapCanvas() {
    var cv = document.getElementById('recap-canvas');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var t = computeTotals();
    var w = cv.width, h = cv.height;

    var bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0D111A');
    bg.addColorStop(1, '#07080C');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (var x = 0; x < w; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (var y = 0; y < h; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    var glow = ctx.createRadialGradient(w * 0.8, h * 0.16, 10, w * 0.8, h * 0.16, 220);
    glow.addColorStop(0, 'rgba(198,255,61,0.22)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#C6FF3D';
    ctx.font = '700 18px monospace';
    ctx.fillText('BLACKTOP // SHIFT RECAP', 36, 56);
    ctx.fillStyle = '#98A2B8';
    ctx.font = '400 15px monospace';
    ctx.fillText(todayStr() + ' · shindustries.co', 36, 82);

    var grade = t.realHr >= 28 ? 'S' : (t.realHr >= 22 ? 'A' : (t.realHr >= 16 ? 'B' : 'C'));
    ctx.strokeStyle = '#C6FF3D';
    ctx.lineWidth = 3;
    ctx.strokeRect(w - 104, 34, 68, 68);
    ctx.fillStyle = '#C6FF3D';
    ctx.font = '800 42px sans-serif';
    ctx.fillText(grade, w - 84, 83);

    ctx.fillStyle = '#98A2B8';
    ctx.font = '600 16px sans-serif';
    ctx.fillText('KEPT AFTER GAS', 36, 174);
    ctx.fillStyle = '#F4F5F7';
    ctx.font = '800 72px sans-serif';
    ctx.fillText(fmt(t.net), 36, 250);

    var stats = [
      ['REAL HOURLY', fmt(t.realHr) + '/hr', '#C6FF3D'],
      ['TOTAL MILES', t.totalMiles.toFixed(1) + ' mi', '#F4F5F7'],
      ['2026 TAX WRITE-OFF', fmt(t.totalDed), '#2CE6C5'],
      ['TIPS LOGGED', fmt(t.totalTips), '#FF6B4A'],
      ['ORDERS COMPLETED', String(state.deliveries.length), '#F4F5F7']
    ];
    var yPos = 325;
    stats.forEach(function(row){
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(36, yPos - 34, w - 72, 54);
      ctx.fillStyle = '#98A2B8';
      ctx.font = '600 15px monospace';
      ctx.fillText(row[0], 54, yPos);
      ctx.fillStyle = row[2];
      ctx.font = '700 22px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(row[1], w - 54, yPos + 2);
      ctx.textAlign = 'left';
      yPos += 68;
    });

    ctx.fillStyle = '#98A2B8';
    ctx.font = '500 14px monospace';
    ctx.fillText('Get Blacktop · shindustries.co/blacktop', 36, h - 28);
  }

  var btnDlRecap = document.getElementById('btn-download-recap');
  if (btnDlRecap) {
    btnDlRecap.addEventListener('click', function(){
      renderRecapCanvas();
      var cv = document.getElementById('recap-canvas');
      var a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = 'blacktop-shift-recap-' + todayStr() + '.png';
      a.click();
    });
  }
  var btnRefRecap = document.getElementById('btn-refresh-recap');
  if (btnRefRecap) btnRefRecap.addEventListener('click', renderRecapCanvas);

  /* Stripe Pro Checkout + License Key Verification */
  var btnStripe = document.getElementById('btn-buy-stripe');
  var licMsg = document.getElementById('license-msg');
  if (btnStripe) {
    btnStripe.addEventListener('click', function(){
      if (STRIPE_PAYMENT_LINK) {
        window.open(STRIPE_PAYMENT_LINK, '_blank', 'noopener');
      } else if (licMsg) {
        licMsg.textContent = 'Stripe Checkout opens at public launch. Email steven@shindustries.co for an early $9.99 Stripe invoice + instant Pro license key.';
      }
    });
  }

  var btnActivate = document.getElementById('btn-activate-key');
  if (btnActivate) {
    btnActivate.addEventListener('click', function(){
      var key = (document.getElementById('license-key-in').value || '').trim().toUpperCase();
      if (!/^BLK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
        if (licMsg) licMsg.textContent = 'Enter a valid Stripe license key formatted like BLK-XXXX-XXXX-XXXX.';
        return;
      }
      if (licMsg) licMsg.textContent = 'Verifying license key with sh. industries...';
      fetch(LICENSE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key, platform: 'web-pwa' })
      }).then(function(r){ return r.json(); }).then(function(data){
        if (data && data.valid) {
          state.isPro = true;
          state.licenseKey = key;
          saveState();
          renderAll();
          if (licMsg) licMsg.textContent = 'Blacktop Pro unlocked! Your Stripe license is active on this device.';
        } else if (licMsg) {
          licMsg.textContent = (data && data.error) || 'License key not recognized. Check your Stripe receipt email or contact steven@shindustries.co.';
        }
      }).catch(function(){
        if (licMsg) licMsg.textContent = 'Could not reach license server right now. Make sure you are online and try again.';
      });
    });
  }

  renderAll();
  renderRecapCanvas();
})();

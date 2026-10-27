/* Glim home page · hero phone demo, Try it, cost calculator, autopilot, waitlist, Explain Glim boot.
 * Shared header/footer/reveals live in site.js; launch switches in switches.js. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;


  /* phone: missed call -> text back -> reply -> approve -> saved */
  const phone = document.getElementById("phone"), cnt = document.getElementById("cnt"), notif = phone.querySelector(".notif");
  const parts = phone.querySelectorAll("[data-at]");
  const STEPS = [0, 1200, 1900, 3400, 5200, 7000, 9600];  // ms at which step n begins
  let timers = [], running = false;
  const setStep = n => {
    phone.dataset.step = n;
    notif.classList.toggle("on", n === 1 || n === 2);
    parts.forEach(p => {
      const at = +p.dataset.at; p.classList.toggle("on", n >= at);
      if (p.dataset.sent) p.classList.toggle("sent", n >= +p.dataset.sent);
    });
    phone.classList.toggle("lit", n === 2 || n === 3 || n === 5 || n === 6);
    cnt.textContent = n >= 6 ? "1" : "0";
  };
  const stop = () => { timers.forEach(clearTimeout); timers = []; running = false; };
  const play = () => {
    stop(); running = true;
    if (reduce) { setStep(6); running = false; return; }
    setStep(0);
    STEPS.forEach((t, n) => timers.push(setTimeout(() => setStep(n), t)));
    timers.push(setTimeout(() => { running = false; play(); }, STEPS[6] + 5200));
  };
  document.getElementById("replay").addEventListener("click", play);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !running) play(); else if (!e.isIntersecting) stop(); }), {threshold:.35}).observe(phone);
  } else play();

  /* try it: mini demo, templates from apps/glim-mobile/src/data/verticals.json (same fill as renderTextback) */
  const V = [{"k":"salon","n":"Salon & barber","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s with a client and {callback}. What service are you looking for, and what day works? Reply STOP to opt out.","q":[20,9],"f":[2,6],"c":"Maya","a":"Do you have anything Saturday for a cut and color?","r":"Hi Maya! Let me check Saturday for a cut and color. Morning or afternoon?"},{"k":"cleaning","n":"Cleaning","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s on a clean and {callback}. Is this for a regular clean or a one-time clean? Reply STOP to opt out.","q":[19,8],"f":[2,6],"c":"Alicia","a":"Can I get a quote for a move-out clean?","r":"Happy to, Alicia. How many bedrooms and bathrooms, and what day do you move out?"},{"k":"plumbing","n":"Plumbing","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s on a job and {callback}. Is it a leak, a clog, or no hot water? Reply STOP to opt out.","q":[20,8],"f":[2,5],"c":"Dana","a":"Sink is leaking under the cabinet. Can someone come today?","r":"Got it, Dana. Turn the shutoff valve under the sink to stop the water. We can come by this afternoon. Does that work?"},{"k":"hvac","n":"HVAC","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s on a job and {callback}. Is it no heat, no cooling, or a tune-up? Reply STOP to opt out.","q":[20,8],"f":[2,5],"c":"Marcus","a":"Heat's not coming on and the house is getting cold.","r":"Sorry about that, Marcus. What does the thermostat say? We can get a tech out this afternoon."},{"k":"electrical","n":"Electrical","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s on a job and {callback}. Is it a repair, an outage, or new work? Reply STOP to opt out.","q":[20,8],"f":[2,5],"c":"Tom","a":"Half the kitchen outlets stopped working.","r":"Thanks, Tom. Check for a tripped GFCI or breaker first. If that doesn't fix it, we can come by this afternoon."},{"k":"landscaping","n":"Landscaping & lawn","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s out on a job and {callback}. Is it mowing, a cleanup, or a new project? Reply STOP to opt out.","q":[19,8],"f":[3,7],"c":"Ken","a":"Need a spring cleanup and fresh mulch out front.","r":"We can do that, Ken. What's the address? We'll stop by to size it up this week."},{"k":"roofing","n":"Roofing","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s on a roof and {callback}. Is it a leak, storm damage, or a new roof? Reply STOP to opt out.","q":[20,8],"f":[3,8],"c":"Rosa","a":"Water's coming through the ceiling after the storm.","r":"Sorry, Rosa. Can you send a photo from the ground? We can get someone out for an inspection today or tomorrow."},{"k":"painting","n":"Painting","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s on a job and {callback}. Is it interior, exterior, or both? Reply STOP to opt out.","q":[19,8],"f":[3,7],"c":"Jordan","a":"Looking to paint two bedrooms and a hallway.","r":"We'd love to, Jordan. Can you send a few photos? We can come by for an estimate this week."},{"k":"handyman","n":"Handyman","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s on a job and {callback}. What needs fixing? A photo helps. Reply STOP to opt out.","q":[20,8],"f":[2,5],"c":"Sam","a":"Need a TV mounted and a door that won't latch fixed.","r":"Can do both in one visit, Sam. What day works, and do you have the wall mount already?"},{"k":"pest_control","n":"Pest control","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s on a service call and {callback}. What are you seeing, and where? Reply STOP to opt out.","q":[20,8],"f":[2,5],"c":"Lena","a":"We've got ants all over the kitchen counter.","r":"Sorry, Lena. Can you send a photo? We can come treat the kitchen and outside this week."},{"k":"auto_repair","n":"Auto repair","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s under a car and {callback}. What's the make and model, and what's it doing? Reply STOP to opt out.","q":[19,8],"f":[2,5],"c":"Chris","a":"Brakes are squealing on my truck.","r":"Thanks, Chris. What's the year, make, and model? We can look at it tomorrow morning."},{"k":"other","n":"Any other business","t":"{hi}this is {owner}'s assistant at {shop}. {owner}'s with a customer and {callback}. What can we help you with? Reply STOP to opt out.","q":[19,8],"f":[3,7],"c":"Jamie","a":"Hi, are you taking new customers this week?","r":"We are, Jamie. What do you need, and what day works for you?"}];
  const $id = id => document.getElementById(id);
  const sel = $id("try-type"), shopIn = $id("try-shop"), ownIn = $id("try-owner"), thr = $id("thr");
  $id("tryform").addEventListener("submit", e => { e.preventDefault(); render(); playThread(); });
  V.forEach(v => { const o = document.createElement("option"); o.value = v.k; o.textContent = v.n; sel.appendChild(o); });
  const hr = h => (h % 12 || 12) + (h < 12 ? " a.m." : " p.m.");
  const render = () => {
    const v = V.find(x => x.k === sel.value) || V[0];
    const shop = shopIn.value.trim() || "your business", own = ownIn.value.trim();
    let first = true;
    const txt = v.t.replace(/\{hi\}/g, "Hi, ").replace(/\{callback\}/g, "will get back to you shortly").replace(/\{shop\}/g, shop)
      .replace(/\{owner\}/g, () => { const r = own || (first ? "the owner" : "The owner"); first = false; return r; });
    $id("thr-text").textContent = txt;
    $id("thr-who").textContent = v.c + ", a new customer";
    $id("thr-cname").textContent = v.c + " · a minute later";
    $id("thr-ask").textContent = v.a;
    $id("thr-reply").textContent = v.r;
    $id("thr-meta").textContent = `${shopIn.value.trim() || "Your business"}: quiet hours ${hr(v.q[0])} to ${hr(v.q[1])}; quote check-ins on day ${v.f[0]} and day ${v.f[1]}, then it stops. All adjustable.`;
  };
  let tTimers = [];
  const playThread = () => {
    tTimers.forEach(clearTimeout); tTimers = [];
    const bs = thr.querySelectorAll(".tb");
    if (reduce) { bs.forEach(b => b.classList.add("on")); return; }
    bs.forEach(b => b.classList.remove("on"));
    bs.forEach((b, i) => tTimers.push(setTimeout(() => b.classList.add("on"), 450 + i * 900)));
  };
  sel.value = "salon"; render(); thr.querySelectorAll(".tb").forEach(b => b.classList.add("on"));
  sel.addEventListener("change", () => { render(); playThread(); });
  shopIn.addEventListener("input", render); ownIn.addEventListener("input", render);

  /* what a missed call costs: the visitor's own numbers only, nothing prefilled but the week count */
  const cC = $id("c-calls"), cW = $id("c-worth"), cK = $id("c-weeks"), cS = $id("c-share"), cO = $id("c-out"), cL = $id("c-lbl");
  const money = n => "$" + Math.round(n).toLocaleString("en-US");
  const calc = () => {
    const a = parseFloat(cC.value), b = parseFloat(cW.value), w = parseFloat(cK.value), sh = cS && cS.value !== "" ? parseFloat(cS.value) : null;
    if (!(a >= 0) || !(b >= 0) || !(w > 0) || cC.value === "" || cW.value === "") { cO.textContent = "$ —"; cL.textContent = "Fill in your two numbers above."; return; }
    if (a > 1000 || b > 1000000 || w > 52 || (sh !== null && (sh < 0 || sh > 100))) { cO.textContent = "$ —"; cL.textContent = "Check your numbers: calls up to 1,000 a week, customer value up to $1,000,000, weeks up to 52, share 0 to 100."; return; }
    const base = a * b * w;
    if (sh === null) {
      cO.textContent = money(base);
      cL.textContent = `At most: ${a} missed call${a === 1 ? "" : "s"} a week × ${money(b)} × ${w} week${w === 1 ? "" : "s"}, if every missed call would have booked. Add the share that would have to see a more realistic number.`;
    } else {
      cO.textContent = money(base * sh / 100);
      cL.textContent = `Your estimate: ${a} missed call${a === 1 ? "" : "s"} a week × ${sh}% would have booked × ${money(b)} × ${w} week${w === 1 ? "" : "s"}.`;
    }
  };
  [cC, cW, cK, cS].filter(Boolean).forEach(i => i.addEventListener("input", calc)); calc();

  /* waitlist: POST to WAITLIST_ENDPOINT then thanks.html, else open a prefilled email (no-JS: the form's mailto action) */
  const cfg = window.GLIM_CFG || {}, wf = $id("wl-form");
  if (wf) {
    const wish = $id("wl-wish"), cnt = $id("wl-cnt");
    wish.addEventListener("input", () => { cnt.textContent = `${wish.value.length} / 300`; });
    wf.addEventListener("submit", async e => {
      e.preventDefault();
      const nm = $id("wl-name"), em = $id("wl-email"), ty = $id("wl-type"), ca = $id("wl-carrier"), cl = $id("wl-calls"), py = $id("wl-pay"), err = $id("wl-err"), btn = $id("wl-btn");
      const pay = wf.querySelector('input[name="would_pay"]:checked');
      err.textContent = ""; [nm, em, ty, cl, py].forEach(x => x.removeAttribute("aria-invalid"));
      const bad = (el, msg, focusEl) => { err.textContent = msg; el.setAttribute("aria-invalid", "true"); (focusEl || el).focus(); };
      if (!nm.value.trim()) return bad(nm, "Tell us your business name.");
      if (!em.checkValidity() || !em.value.trim()) return bad(em, "Enter an email we can reach you at, like you@yourbusiness.com.");
      if (!ty.value) return bad(ty, "Choose the kind of business, or “Something else”.");
      if (!cl.value) return bad(cl, "Choose how many calls you miss in a typical week. “Not sure” is fine.");
      if (!pay) return bad(py, "Tell us if you would pay $29 a month. “Maybe” and “Not for me” are useful answers too.", wf.querySelector('input[name="would_pay"]'));
      const data = { business_name: nm.value.trim(), email: em.value.trim(), business: ty.value, calls_missed: cl.value, would_pay: pay.value,
                     wish: wish.value.trim().slice(0, 300), carrier: ca.value, website: $id("wl-hp").value, source: "site-v6" };
      const done = () => {
        wf.hidden = true; const d = $id("wl-done"); d.hidden = false;
        $id("wl-done-p").textContent = `Your email app opened with your answers for ${cfg.SUPPORT_EMAIL || "glim@shindustries.co"}. Press send and you're counted. We'll email you once when the founding spots open.`;
        d.focus();
      };
      if (cfg.WAITLIST_ENDPOINT) {
        btn.disabled = true; btn.textContent = "Sending…";
        try {
          const r = await fetch(cfg.WAITLIST_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
          if (!r.ok) throw new Error(r.status);
          location.href = "thanks.html"; return;
        } catch (_) {
          btn.disabled = false; btn.textContent = "Tell us, and join the list";
          err.textContent = "That didn't go through. Try again, or email glim@shindustries.co and we'll add you by hand."; return;
        }
      }
      const body = `Please add me to the Glim founding shops waitlist.\n\nBusiness name: ${data.business_name}\nEmail: ${data.email}\nKind of business: ${data.business}\nCalls missed in a typical week: ${data.calls_missed}\nWould pay $29/month: ${data.would_pay}\nWhat would make Glim a no-brainer: ${data.wish || "-"}\nCarrier: ${data.carrier || "skip"}`;
      location.href = `mailto:${cfg.SUPPORT_EMAIL || "glim@shindustries.co"}?subject=${encodeURIComponent("Glim founding waitlist")}&body=${encodeURIComponent(body)}`;
      done();
    });
  }


  const O = {
    textback:"Dana gets the text-back 9 seconds after her call, automatically. When she replies, Glim drafts an answer and it sits in your inbox until you tap Approve. The quote follow-up on day 2 also waits for your tap.",
    approve:"Dana's missed call shows up in your inbox with the text-back already written. Nothing goes to her until you tap Approve. Slowest option, but every word is yours.",
    hands:"Dana gets the text-back in 9 seconds, Glim answers her leak question and offers the 3 to 5 window, and follows up the quote on day 2 and day 5 by itself. You get one summary a day. A quote over your limit still waits for you."
  };
  const out = document.getElementById("outcome"), outP = document.getElementById("outcome-p");
  const setOut = v => { if (reduce) { outP.textContent = O[v]; return; } out.classList.add("swap"); setTimeout(() => { outP.textContent = O[v]; out.classList.remove("swap"); }, 160); };
  outP.textContent = O.textback;
  document.querySelectorAll('input[name="auto"]').forEach(r => r.addEventListener("change", () => setOut(r.value)));

  /* Explain Glim: lazy init after the hero has painted and the page is idle */
  const bootExplain = () => { const s = document.createElement("script"); s.src = "assets/explain/explain.js"; s.defer = true; document.body.appendChild(s); };
  const idle = cb => ("requestIdleCallback" in window ? requestIdleCallback(cb, {timeout: 1500}) : setTimeout(cb, 300));
  if (document.readyState === "complete") idle(bootExplain); else addEventListener("load", () => idle(bootExplain), {once:true});
})();

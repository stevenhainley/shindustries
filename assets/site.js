/* sh. industries · website v3 motion + interactions. One system: headline reveal, staggered section reveal,
   subtle media parallax, chips drift on hover, header compress, Simple mode. Reduced motion and Simple mode get the
   still end state; pages with <body data-motion="off"> (policies) get no effects. */
(() => {
  const d = document, root = d.documentElement, body = d.body;
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => rm.matches || root.dataset.mode === 'simple' || body.dataset.motion === 'off';
  const store = { get: k => { try { return localStorage.getItem(k) } catch (e) { return null } },
                  set: (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} },
                  del: k => { try { localStorage.removeItem(k) } catch (e) {} } };

  /* headline split: words wrapped for the mask reveal (text stays one string for screen readers) */
  d.querySelectorAll('[data-split]').forEach(h => {
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(' ');
    h.classList.add('h-split');
  });

  /* reveal: only when motion is allowed and the tab is visible (a hidden tab would freeze content at opacity 0) */
  const targets = [...d.querySelectorAll('[data-reveal],[data-split]')];
  targets.forEach(t => [...t.children].forEach((c, i) => { if (!c.style.getPropertyValue('--i')) c.style.setProperty('--i', Math.min(i, 6)) }));
  const showAll = () => targets.forEach(t => t.classList.add('in'));
  if (!still() && !d.hidden && 'IntersectionObserver' in window) {
    root.classList.add('rv');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(t => io.observe(t));
    setTimeout(showAll, 4000);              // safety net: nothing stays hidden
    d.addEventListener('visibilitychange', showAll, { once: true });
  } else showAll();

  /* header compress + parallax, one rAF per frame */
  const hdr = d.querySelector('.hdr');
  const par = [...d.querySelectorAll('[data-parallax]')];
  let ticking = false;
  const frame = () => {
    ticking = false;
    if (hdr) hdr.classList.toggle('is-compact', scrollY > 16);
    if (still() || innerWidth < 1024) { par.forEach(e => e.style.transform = ''); return }
    const vh = innerHeight;
    par.forEach(e => {
      const r = e.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const k = ((r.top + r.height / 2) - vh / 2) / vh;
      e.style.transform = `translate3d(0,${(-k * (+e.dataset.parallax || 24)).toFixed(1)}px,0)`;
    });
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame) } };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); frame();

  /* chips drift on hover */
  d.querySelectorAll('[data-drift]').forEach(zone => {
    const chips = [...zone.querySelectorAll('.chip-a')];
    zone.addEventListener('pointermove', e => {
      if (still() || e.pointerType !== 'mouse') return;
      const r = zone.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      chips.forEach((c, i) => { const k = (i % 2 ? -1 : 1) * (10 + i * 4); c.style.translate = `${(x * k).toFixed(1)}px ${(y * k).toFixed(1)}px` });
    });
    zone.addEventListener('pointerleave', () => chips.forEach(c => c.style.translate = ''));
  });

  /* menu: dropdown / bottom sheet */
  const menu = d.getElementById('menu');
  const mbtn = d.querySelector('.menu-btn');
  const setMenu = open => {
    if (!menu || !mbtn) return;
    menu.hidden = !open; mbtn.setAttribute('aria-expanded', open);
    if (open) (menu.querySelector('a') || menu).focus(); else mbtn.focus({ preventScroll: true });
  };
  mbtn && mbtn.addEventListener('click', () => setMenu(menu.hidden));
  menu && menu.addEventListener('click', e => { if (e.target.closest('[data-close]')) setMenu(false) });
  d.addEventListener('keydown', e => { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false) });

  /* Simple mode: a short declutter, then the plain page; remembered on this device */
  const sw = d.querySelector('[data-simple]');
  const apply = m => {
    if (m === 'simple') root.dataset.mode = 'simple'; else delete root.dataset.mode;
    sw && sw.setAttribute('aria-checked', m === 'simple');
    store.set('sh-mode', m); showAll(); frame();
  };
  if (sw) {
    sw.setAttribute('aria-checked', root.dataset.mode === 'simple');
    sw.addEventListener('click', () => {
      const toSimple = root.dataset.mode !== 'simple';
      if (toSimple && !rm.matches && body.dataset.motion !== 'off') {
        root.classList.add('declutter');
        setTimeout(() => { apply('simple'); root.classList.remove('declutter'); }, 460);
      } else apply(toSimple ? 'simple' : 'full');
    });
  }

  /* product pages: plan pills drive the plan panel */
  d.querySelectorAll('[data-plans]').forEach(form => {
    const panels = [...d.querySelectorAll('[data-plan]')];
    const sync = () => {
      const v = (form.querySelector('input:checked') || {}).value;
      panels.forEach(p => p.hidden = p.dataset.plan !== v);
    };
    form.addEventListener('change', sync); sync();
  });

  /* product gallery tabs */
  d.querySelectorAll('[data-gallery]').forEach(g => {
    const tabs = [...g.querySelectorAll('[role=tab]')], panels = [...g.querySelectorAll('[role=tabpanel]')];
    const sel = i => { tabs.forEach((t, j) => { t.setAttribute('aria-selected', i === j); t.tabIndex = i === j ? 0 : -1 });
                       panels.forEach((p, j) => p.classList.toggle('on', i === j)) };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => sel(i));
      t.addEventListener('keydown', e => { const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (n) { const k = (i + n + tabs.length) % tabs.length; sel(k); tabs[k].focus() } });
    });
  });

  /* newsletter: composes an email (no third-party form service) */
  d.querySelectorAll('[data-news]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const v = (f.querySelector('input[type=email]') || {}).value || '';
    location.href = `mailto:stevenhainley@gmail.com?subject=${encodeURIComponent('Release notes')}&body=${encodeURIComponent('Please add me to the release notes: ' + v)}`;
  }));

  /* Manage cookies: nothing to consent to; show what is stored and let people clear it */
  const dlg = d.getElementById('prefs');
  d.querySelectorAll('[data-prefs]').forEach(b => b.addEventListener('click', () => {
    if (!dlg) return;
    const s = dlg.querySelector('[data-stored]');
    if (s) s.textContent = store.get('sh-mode') ? `Simple mode: ${store.get('sh-mode') === 'simple' ? 'on' : 'off'}` : 'Nothing stored yet.';
    dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
  }));
  dlg && dlg.addEventListener('click', e => {
    if (e.target.closest('[data-clear]')) { store.del('sh-mode'); delete root.dataset.mode; sw && sw.setAttribute('aria-checked', false); dlg.close() }
    if (e.target.closest('[data-dismiss]') || e.target === dlg) dlg.close();
  });
})();

/* sh. industries studio homepage interactive console (strict CSP). */
(function(){
  'use strict';

  var hdr = document.getElementById('hdr');
  if (hdr) {
    var onScroll = function(){ hdr.classList.toggle('on', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

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
})();

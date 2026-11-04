// Old Glim links: until 2026-11-03 Glim was the homepage, so /#waitlist, /#pricing and the rest
// pointed at sections that now live on /glim/. GitHub Pages can't redirect a fragment, so this
// forwards them before the company page paints. Loaded synchronously in the <head> of index.html.
(() => {
  const h = location.hash.slice(1);
  if (["waitlist", "pricing", "explain", "story", "trade", "cost", "auto", "beta", "install", "faq"].includes(h)) location.replace("glim/#" + h);
})();

/* Analytics and ad tags. They only load on the real domain, so the test site
   (*.workers.dev) and local previews don't add fake visits or leads to reports.
   GA4: G-58J88R0TGH, G-YDQPMX7RN4 · Google Ads: AW-730409131 · Meta pixel: 1021883557467247 */
(function () {
  var host = location.hostname;
  if (host !== 'acecoatingsutah.com' && host !== 'www.acecoatingsutah.com') return;

  var g = document.createElement('script');
  g.async = true;
  g.src = 'https://www.googletagmanager.com/gtag/js?id=G-58J88R0TGH';
  document.head.appendChild(g);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', 'G-58J88R0TGH');
  gtag('config', 'G-YDQPMX7RN4');
  gtag('config', 'AW-730409131');

  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '1021883557467247');
  fbq('track', 'PageView');

  // Phone taps count as contacts too.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="tel:"]');
    if (!a) return;
    try { gtag('event', 'click_to_call'); fbq('track', 'Contact'); } catch (err) {}
  });
})();

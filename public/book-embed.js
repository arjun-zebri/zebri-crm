/**
 * Zebri booking embed loader.
 *
 * Usage:
 *   <script src="https://app.zebri.com.au/book-embed.js" data-zebri-booking="TOKEN" async></script>
 *
 * Injects the chromeless booking page as an iframe next to the script tag and
 * auto-resizes it from the height the page posts back.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var token = script.getAttribute('data-zebri-booking');
  if (!token) return;

  var origin = new URL(script.src).origin;
  var iframe = document.createElement('iframe');
  iframe.src = origin + '/book/' + token + '?embed=1';
  iframe.title = 'Booking form';
  iframe.setAttribute('loading', 'lazy');
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.minHeight = '640px';
  script.parentNode.insertBefore(iframe, script.nextSibling);

  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return;
    var d = e.data;
    if (d && d.type === 'zebri-book-height' && typeof d.height === 'number') {
      iframe.style.height = d.height + 'px';
    }
  });
})();

/* ============================================================
   Smooth scrolling (Lenis 1.1.13, vendored) + page-wide config.
   Exposes window.ShopViewSmooth = the Lenis instance (or null) for flight.js.

   Config: window.SHOPVIEW_FLIGHT in index.html, overridable per visit with
   URL params for side-by-side comparison:  ?snap=0|1  ?smooth=0|1
   ============================================================ */
(function () {
  'use strict';
  var cfg = window.SHOPVIEW_FLIGHT = Object.assign({
    snap: true,            // soft snap to the next checkpoint when scrolling stops inside the flight
    smooth: true,          // Lenis smooth wheel/trackpad scrolling
    wheelMultiplier: 1.3,
    duration: 1.1          // seconds Lenis takes to settle a wheel step
  }, window.SHOPVIEW_FLIGHT || {});
  var q = new URLSearchParams(window.location.search);
  ['snap', 'smooth'].forEach(function (k) { if (q.has(k)) cfg[k] = q.get(k) !== '0' && q.get(k) !== 'false'; });

  window.ShopViewSmooth = null;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!cfg.smooth || reduce || typeof window.Lenis !== 'function') return;

  var lenis = new window.Lenis({
    lerp: 0,                                   // 0 = use duration + easing instead of lerp
    duration: cfg.duration,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },   // expo-out, Lenis' default feel
    wheelMultiplier: cfg.wheelMultiplier,
    smoothWheel: true,
    syncTouch: false                           // touch keeps the platform's native scrolling
  });
  window.ShopViewSmooth = lenis;
  var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);

  // In-page anchors (Back to Top, #results …) glide with Lenis too; #cp-* is flight.js' job.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').indexOf('#cp-') === 0) return;
    var id = a.getAttribute('href').slice(1), el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    lenis.scrollTo(el, { offset: -72, duration: 1.4 });
    history.replaceState(null, '', '#' + id);
  });
})();

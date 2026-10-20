/* ============================================================
   Rain over the flight: one <canvas> above the video (and its shade), below the copy.
   Rain only — no lightning, flashes or audio. Two depth layers: far (thin, short, slower)
   and near (a little thicker, longer, faster, softened).

   flight.js drives it: window.ShopViewRain.level(0…1) from the scroll position (full through
   S0/L0 and the start of L1, fading out while the camera passes through the open bay door into
   Hall A, gone inside the hall; back in on the way up). At level 0 the loop stops entirely.

   Config: window.SHOPVIEW_FLIGHT.rain = { enabled, opacity, density, angle } in index.html.
   Off for prefers-reduced-motion and below 760px (phones show stills).
   ============================================================ */
(function () {
  'use strict';
  window.ShopViewRain = { level: function () {} };
  var root = document.documentElement;
  if (!root.classList.contains('flight-live')) return;           // phones / reduced motion: static stills, no rain
  var cfg = Object.assign({ enabled: true, opacity: 0.4, density: 350, angle: 10 },
                          (window.SHOPVIEW_FLIGHT && window.SHOPVIEW_FLIGHT.rain) || {});
  if (!cfg.enabled) return;
  var stage = document.querySelector('.flight__stage');
  if (!stage) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'flight__rain';
  canvas.setAttribute('aria-hidden', 'true');
  var shade = stage.querySelector('.flight__shade');
  stage.insertBefore(canvas, shade ? shade.nextSibling : stage.firstChild);
  var ctx = canvas.getContext('2d');

  var COLOR = 'rgba(174, 194, 224, 0.6)';
  var rad = cfg.angle * Math.PI / 180, sx = Math.sin(rad), cy = Math.cos(rad);   // drops fall along (sx, cy)
  var W = 0, H = 0, dpr = 1, drops = [];
  var LAYERS = [   // share of drops, length px, width px, speed px/s, alpha, soften
    { share: 0.62, len: [9, 16],  width: 1,   speed: [520, 760],   alpha: 0.55, blur: 0 },
    { share: 0.38, len: [20, 34], width: 1.6, speed: [1050, 1450], alpha: 0.9,  blur: 2 }
  ];
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  function spawn(d, anywhere) {
    var L = LAYERS[d.layer];
    d.len = rnd(L.len[0], L.len[1]);
    d.v = rnd(L.speed[0], L.speed[1]);
    // start above the top edge (or anywhere on first fill); spread wide enough for the slant
    d.x = rnd(-0.15 * W, 1.15 * W);
    d.y = anywhere ? rnd(-H * 0.1, H) : rnd(-0.25 * H, -d.len);
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var n = Math.round(cfg.density * (W * H) / (1440 * 900));     // ~350 at 1440×900, scales with area
    drops = [];
    LAYERS.forEach(function (L, li) {
      for (var k = 0, m = Math.round(n * L.share); k < m; k++) { var d = { layer: li }; spawn(d, true); drops.push(d); }
    });
  }

  var level = 0, running = false, last = 0, raf = 0, visible = true, onScreen = true;
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = COLOR; ctx.lineCap = 'round';
    for (var li = 0; li < LAYERS.length; li++) {
      var L = LAYERS[li];
      ctx.globalAlpha = L.alpha;
      ctx.lineWidth = L.width;
      ctx.shadowColor = L.blur ? COLOR : 'transparent';
      ctx.shadowBlur = L.blur * dpr;                                // near layer: a touch softened
      ctx.beginPath();
      for (var i = 0; i < drops.length; i++) {
        var d = drops[i];
        if (d.layer !== li) continue;
        d.x += sx * d.v * dt; d.y += cy * d.v * dt;
        if (d.y - d.len > H || d.x < -0.2 * W || d.x > 1.2 * W) spawn(d, false);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - sx * d.len, d.y - cy * d.len);
      }
      ctx.stroke();
    }
    raf = requestAnimationFrame(frame);
  }
  function update() {
    var want = level > 0.001 && visible && onScreen;
    canvas.style.opacity = (cfg.opacity * level).toFixed(3);
    canvas.style.visibility = level > 0.001 ? 'visible' : 'hidden';
    if (want && !running) { running = true; last = 0; if (!raf) raf = requestAnimationFrame(frame); }
    else if (!want && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; if (level <= 0.001) ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  window.ShopViewRain = {
    level: function (x) { x = Math.max(0, Math.min(1, x)); if (Math.abs(x - level) < 0.001 && running === (x > 0.001 && visible && onScreen)) return; level = x; update(); }
  };
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; update(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; update(); }).observe(stage);
  }
  window.addEventListener('resize', size);
  size();
})();

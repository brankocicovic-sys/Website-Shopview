/* ============================================================
   Night Shift flight — scroll-scrubbed checkpoints for the homepage.
   Same timing model as the approved scrub engine (scrub-engine.js):
   per-leg scroll length, linger 0.45, optional checkpoint `peak`,
   hard switch between legs at the seam (no crossfade), blob-loaded clips (always seekable),
   coalesced seeks. Unlike the engine it drives the page's own HTML
   (real H1/H2 per checkpoint) instead of building its own DOM.
   Runs only when <html> has .flight-live (desktop + motion allowed);
   otherwise the checkpoints stay static blocks and no video is fetched.
   ============================================================ */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('flight-live')) return;

  var flight = document.getElementById('flight');
  var stage = flight.querySelector('.flight__stage');
  var media = flight.querySelector('.flight__media');
  var poster = flight.querySelector('.flight__poster');
  var rail = flight.querySelector('.rail');
  var hint = flight.querySelector('.hint');
  var shade = flight.querySelector('.flight__shade');
  var beat = flight.querySelector('.trustbeat');
  var cps = Array.prototype.slice.call(flight.querySelectorAll('.cp'));

  // Pacing (viewport heights of scroll per leg): the approved lengths x1.3 so every checkpoint's
  // copy stays up ~30% longer (its fade window and full-opacity hold are fractions of the leg, so
  // both stretch with it; where each copy sits in the clip — and so its clearance of the seams —
  // is unchanged). S3/S4/S5 are pinned to the engine close-up (end of L3a), the laptop
  // technician (start of L4) and the raised dump truck (start of L5).
  var STRETCH = 1.3;
  var LEGS = [
    { clip: 's0', scroll: 1.8 },              // Overview + the trusted-by beat
    { clip: 's1', scroll: 1.3, peak: 0.4 },   // Results (Foothills): out by 0.70, before L1 enters the hall (~0.77)
    { clip: 's2', scroll: 1.3, peak: 0.5 },   // Features (main hall): out by 0.80, before L2 reaches the engine bay (~0.84)
    { clip: 's3', scroll: 1.55, peak: 0.474 }, // Work Orders over the engine close-up; the screen is flat at the peak
    { clip: 's4', scroll: 1.3, peak: 0.15 },  // Scheduling over the laptop technician; hold starts after the L3→L4 seam
    { clip: 's5', scroll: 1.3, peak: 0.15 },  // Revenue over the dump truck on the lifts; after the L4→L5 seam, gone before the EXIT door
    { clip: 's6', scroll: 1.3, peak: 0.1, win: 0.22 },  // the wide parts-room view right after the EXIT door runs from ~0.89 of L5
                                              // to ~0.25 of L6 (clip ~0.78 → ~0.15): fades in from ~0.88 of L5, across the
                                              // seam, holds 0.0–0.2 of L6, out by 0.32 — long before the window into Hall C (~0.72)
    { clip: 's7', scroll: 1.8 }               // Why ShopView + final CTA
  ];
  LEGS.forEach(function (leg) { leg.scroll *= STRETCH; });
  // L0 "trusted by" beat (fractions of L0): S0 copy is gone by 0.25, the strip fades in
  // 0.18→0.34, holds to 0.62 (the slow middle of L0), and is out by 0.80 — S1 copy starts after L0.
  var BEAT = { in0: 0.18, in1: 0.34, out0: 0.62, out1: 0.80 };
  var LINGER = 0.65;             // was 0.45: the camera all but holds while a checkpoint's copy is in
  var PLATEAU = 0.45;            // fraction of each copy window held at full opacity (readable hold)
  var LOOKAHEAD = 2.8;           // start fetching a leg this many screens before it plays (~2 checkpoints)
  var VERSION = 'v4.6';   // clip cache-buster: bump whenever a clip is re-encoded (v4.6 = 1600x900 crf26 set)
  var N = LEGS.length;
  var CFG = window.SHOPVIEW_FLIGHT || { snap: true };
  var lenis = window.ShopViewSmooth || null;     // Lenis smooth scroll (smooth.js); null = native scrolling

  var clamp = function (x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.min(b, Math.max(a, x)); };
  var smooth = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
  // copy opacity from distance-to-peak (0 at the peak, 1 at the window edge): full for the
  // inner PLATEAU, eased out to 0 by the edge
  var hold = function (dist) { return smooth((1 - dist) / (1 - PLATEAU)); };
  // after the peak the copy stays full for longer and fades faster, ending at the same point of the
  // window (so it is still gone before the next scene and never meets the next checkpoint's copy)
  var PLATEAU_OUT = 0.72;
  var holdOut = function (dist) { return smooth((1 - dist) / (1 - PLATEAU_OUT)); };
  var lingerMid = function (x, L) { var c = x - 0.5; return (1 - L) * x + L * (4 * c * c * c + 0.5); };
  var lingerPeak = function (x, L, p) {
    if (x <= p && p > 0) { var u = x / p; return p * ((1 - L) * u + L * (1 - Math.pow(1 - u, 3))); }
    if (p >= 1) return x;
    var w = (x - p) / (1 - p); return p + (1 - p) * ((1 - L) * w + L * w * w * w);
  };

  var vh = window.innerHeight, total = 0, flightTop = 0;
  LEGS.forEach(function (leg, i) {
    leg.i = i; leg.cp = cps[i]; leg.video = null; leg.img = null; leg.loading = false; leg.ready = false; leg.painted = false;
    leg.cur = 0; leg.target = 0; leg.visible = i === 0;
  });

  function layout() {
    vh = window.innerHeight;
    var off = 0;
    LEGS.forEach(function (leg) { leg.start = off * vh; off += leg.scroll; leg.end = off * vh; });
    total = off;
    flight.style.height = (total * vh + vh) + 'px';
    flightTop = flight.getBoundingClientRect().top + window.scrollY;
    read();
  }
  function len(leg) { return leg.end - leg.start; }
  // where a checkpoint's copy begins to fade in (mirrors the opacity rules in read())
  function copyStartY(leg) {
    if (leg.i === N - 1) return leg.start;
    if (leg.peak != null) return peakY(leg) - win(leg) * len(leg);
    return leg.start;
  }
  // half-width of a checkpoint's copy window, as a fraction of its leg (0.3 unless the leg sets `win`)
  function win(leg) { return leg.win != null ? leg.win : 0.3; }
  function peakY(leg) { return leg.start + len(leg) * (leg.peak != null ? leg.peak : 0.5); }
  // Where the rail/tab jumps land: hero at the very top, finale once its copy has settled.
  function checkpointY(leg) {
    if (leg.i === 0) return 0;
    if (leg.i === N - 1) return leg.start + len(leg) * 0.6;
    return peakY(leg);
  }

  // ── clips ────────────────────────────────────────────────
  function load(leg) {
    if (leg.loading) return;
    leg.loading = true;
    // First-frame poster under the clip: covers the gap while the clip downloads and
    // until the video has actually painted a frame (videos can show black before that).
    var img = document.createElement('img');
    img.alt = ''; img.decoding = 'async';
    img.src = leg.i === 0 && poster ? poster.src : 'assets/posters/' + leg.clip + '.webp';
    img.style.opacity = '0';
    media.appendChild(img);
    leg.img = img;
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.style.opacity = '0';
    media.appendChild(v);
    leg.video = v;
    fetch('assets/video/' + leg.clip + '.mp4?' + VERSION)
      .then(function (r) { return r.ok ? r.blob() : Promise.reject(new Error(r.status)); })
      .then(function (blob) {
        v.src = URL.createObjectURL(blob);     // blob = fully seekable, no byte-range dependency
        v.addEventListener('loadedmetadata', function () {
          leg.ready = true;
          try { v.currentTime = 0.001; } catch (e) {}          // sit on frame 0, painted, before the seam arrives
          read();
        }, { once: true });
        v.addEventListener('seeked', function () {
          leg.painted = true; read();
          if (leg.i === 0 && poster) poster.style.opacity = '0';   // S0 still stays up until the first clip paints
        }, { once: true });
      })
      .catch(function () { leg.loading = false; });
  }

  // ── rail ────────────────────────────────────────────────
  var dots = LEGS.map(function (leg) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'rail__dot';
    var label = leg.cp.getAttribute('data-label') || '';
    b.setAttribute('aria-label', label);
    b.innerHTML = '<span class="rail__lbl">' + label + '</span><i></i>';
    b.addEventListener('click', function () { jump(leg.i); });
    rail.appendChild(b);
    return b;
  });
  function jump(i) { glideTo(checkpointY(LEGS[i])); }

  // ── glide: one eased scroll animation shared by snap, keys, rail and tabs ──
  // Never locks scrolling: any wheel / touch / key / pointer input cancels it on the spot.
  var glide = null;
  var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  function glideTo(targetY) {
    cancelGlide();
    var from = window.scrollY, to = flightTop + targetY, dist = Math.abs(to - from);
    if (dist < 2) return;
    var dur = 1200 + 600 * clamp((dist / vh - 0.3) / 1.7);        // 1.2 s short hops … 1.8 s long ones
    if (lenis) {                                                   // one scroll engine: Lenis owns the animation
      glide = { lenis: true };
      lenis.scrollTo(to, {
        duration: dur / 1000, easing: easeInOut, lock: false,
        onComplete: function () { glide = null; anchorY = window.scrollY; inputDir = 0; }
      });
      return;
    }
    var t0 = performance.now();
    glide = { raf: 0 };
    var step = function (now) {
      if (!glide) return;
      var t = clamp((now - t0) / dur);
      window.scrollTo(0, from + (to - from) * easeInOut(t));
      if (t < 1) glide.raf = requestAnimationFrame(step);
      else { glide = null; anchorY = window.scrollY; inputDir = 0; }
    };
    glide.raf = requestAnimationFrame(step);
  }
  function cancelGlide() {
    if (!glide) return;
    // Lenis: park the target where we are, so the input that cancelled us scrolls on from
    // here instead of continuing toward the old checkpoint
    if (glide.lenis) lenis.scrollTo(lenis.animatedScroll, { immediate: true, force: true });
    else cancelAnimationFrame(glide.raf);
    glide = null;
  }
  // User input: cancels a glide immediately, and is the only thing that can arm a snap.
  // Direction comes from the input itself (wheel delta / finger drag), not from scroll
  // events, which browsers may batch.
  var lastInputT = 0, inputDir = 0, touchY = null, anchorY = window.scrollY;
  function userInput() { lastInputT = performance.now(); cancelGlide(); clearTimeout(idleTimer); }
  function armSnap() { if (!CFG.snap) return; clearTimeout(idleTimer); idleTimer = setTimeout(onIdle, SNAP_IDLE); }
  var opt = { passive: true, capture: true };
  window.addEventListener('wheel', function (e) { userInput(); if (e.deltaY) inputDir = e.deltaY > 0 ? 1 : -1; armSnap(); }, opt);
  window.addEventListener('touchstart', function (e) { userInput(); touchY = e.touches[0] ? e.touches[0].clientY : null; }, opt);
  window.addEventListener('touchmove', function (e) {
    lastInputT = performance.now();
    var y = e.touches[0] ? e.touches[0].clientY : null;
    if (touchY != null && y != null && y !== touchY) inputDir = y < touchY ? 1 : -1;
    touchY = y; armSnap();
  }, opt);
  window.addEventListener('touchend', armSnap, opt);
  window.addEventListener('keydown', userInput, opt);
  window.addEventListener('pointerdown', userInput, opt);                       // incl. grabbing the scrollbar
  window.addEventListener('pointermove', function (e) { if (e.buttons) lastInputT = performance.now(); }, opt);
  window.addEventListener('pointerup', function () { if (performance.now() - lastInputT < 800 && window.scrollY !== anchorY) armSnap(); }, opt);

  // ── soft snap: after ~150 ms of no scrolling, finish the move to the next checkpoint ──
  var SNAP_IDLE = 150, SNAP_NEAR = 0.04;   // idle ms; "already there" tolerance in screens
  var idleTimer = 0;
  function cpYs() { return LEGS.map(checkpointY); }
  function lastCpY() { return checkpointY(LEGS[N - 1]); }
  function onIdle() {
    if (glide || !CFG.snap || window.SHOPVIEW_VIDEO_PLAYING) return;
    // with Lenis the page is still easing out after the last input; snap from rest, not mid-glide
    if (lenis && lenis.isScrolling && Math.abs(lenis.velocity) > 0.5) { idleTimer = setTimeout(onIdle, 60); return; }
    var y = window.scrollY - flightTop;
    var dir = inputDir || (window.scrollY > anchorY ? 1 : window.scrollY < anchorY ? -1 : 0);
    var settle = function () { anchorY = window.scrollY; inputDir = 0; };
    if (y <= 0 || y >= lastCpY() || !dir) return settle();   // above the flight, past S7, or no move: free
    var ys = cpYs(), near = SNAP_NEAR * vh, k;
    for (k = 0; k < ys.length; k++) if (Math.abs(ys[k] - y) < near) return settle();   // close enough already
    var target = null;
    if (dir > 0) { for (k = 0; k < ys.length; k++) if (ys[k] > y) { target = ys[k]; break; } }
    else { for (k = ys.length - 1; k >= 0; k--) if (ys[k] < y) { target = ys[k]; break; } }
    if (target != null) glideTo(target); else settle();
  }
  window.addEventListener('scroll', function () {
    if (glide) return;
    // only scrolling the user caused can arm a snap (trackpad inertia keeps sending wheel
    // events, so the idle timer simply waits it out); stray scroll events never do
    if (performance.now() - lastInputT > 800) return;
    armSnap();
  }, { passive: true });

  // ── keys: ↓ / PageDown / Space → next checkpoint, ↑ / PageUp / Shift+Space → previous ──
  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (window.SHOPVIEW_VIDEO_PLAYING) return;                   // the S1 video is playing: no glides
    var down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    var up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
    if (!down && !up) return;
    // leave keys to whatever has focus when it needs them: typing, tab lists, open menus,
    // and Space on buttons/links (that's how they activate)
    var a = document.activeElement;
    if (a && a !== document.body) {
      if (a.closest('input, textarea, select, [contenteditable], [role="tab"], .nav')) return;
      if (e.key === ' ' && a.closest('button, a, summary')) return;
    }
    var y = window.scrollY - flightTop, ys = cpYs(), eps = 0.01 * vh, target = null, k;
    if (down) {
      if (y >= lastCpY() - eps) return;                       // past S7: browser's normal scrolling
      for (k = 0; k < ys.length; k++) if (ys[k] > y + eps) { target = ys[k]; break; }
    } else {
      if (y > total * vh) return;                             // below the flight: normal scrolling
      for (k = ys.length - 1; k >= 0; k--) if (ys[k] < y - eps) { target = ys[k]; break; }
    }
    if (target == null) return;
    e.preventDefault();
    clearTimeout(idleTimer);
    glideTo(target);
  });
  // In-copy tabs (#cp-1 / #cp-4 / #cp-5) jump to their checkpoint instead of anchoring.
  flight.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#cp-"]');
    if (!a) return;
    var i = parseInt(a.getAttribute('href').slice(4), 10);
    if (isNaN(i) || !LEGS[i]) return;
    e.preventDefault(); jump(i);
  });

  // ── per-scroll state ─────────────────────────────────────
  var active = -1, ticking = false;
  function read() {
    ticking = false;
    var y = clamp(window.scrollY - flightTop, 0, total * vh);
    // the one leg on screen: outgoing → 0 and incoming → 1 in the same frame at the seam
    var j = 0; for (var k = 0; k < N; k++) if (y >= LEGS[k].start) j = k;

    LEGS.forEach(function (leg) {
      if (y > leg.start - LOOKAHEAD * vh && y < leg.end + vh) load(leg);
      var local = clamp((y - leg.start) / len(leg));
      leg.target = leg.peak != null ? lingerPeak(local, LINGER, leg.peak) : lingerMid(local, LINGER);
      var on = leg.i === j, near = Math.abs(leg.i - j) === 1;    // previous / next leg: preloaded, parked on its last / first frame
      leg.visible = on || near;                                  // (keeps seeking) — but only the current leg is ever shown
      if (leg.video) {
        var show = on && leg.painted;
        leg.video.style.opacity = show ? '1' : '0';
        leg.video.style.visibility = show ? 'visible' : 'hidden';
      }
      if (leg.img) leg.img.style.opacity = on && !leg.painted ? '1' : '0';   // first-frame still until this leg's clip paints

      // checkpoint copy: fades + slides in around its peak, gone before the next leg
      var pr = (y - leg.start) / len(leg), cop, shift, enter = 0;
      if (leg.i === 0) { cop = y > leg.end ? 0 : smooth((0.25 - pr) / 0.16); shift = -clamp((pr - 0.09) / 0.16) * 3; }   // full to 0.09, gone by 0.25 (as before)
      else if (leg.i === N - 1) { cop = y < leg.start ? 0 : smooth(pr / 0.4); shift = (1 - clamp(pr / 0.4)) * 3; }
      else if (leg.peak != null) {
        var w = win(leg) * len(leg), d = (peakY(leg) - y) / w;
        cop = d >= 0 ? hold(d) : holdOut(-d); shift = clamp(d, -1, 1) * 3 * (1 - cop);
        enter = smooth(clamp(d));          // 1 at the window edge → 0 at the peak, 0 after it (scrubbed, reversible)
      } else {
        cop = (pr < 0 || pr > 1) ? 0 : hold(Math.abs(pr - 0.5) / 0.5); shift = (0.5 - clamp(pr)) * 6 * (1 - cop);
      }
      var el = leg.cp;
      el.style.opacity = cop.toFixed(3);
      el.style.transform = 'translate3d(0,' + shift.toFixed(2) + 'vh,0)';
      el.style.setProperty('--enter', enter.toFixed(4));   // used by the S3 screen's slide-in
      var shot = leg.shot !== undefined ? leg.shot : (leg.shot = el.querySelector('.wo-shot'));
      if (shot) {   // S3/S4 screens: rise from 120px below, tilted back (rotateX) on its bottom edge, fading in; flat at the peak
        var ty = shot.hasAttribute('data-top') ? 0 : -Math.round(shot.offsetHeight * 0.46);   // data-top: anchored by its top edge
        shot.style.transform = enter > 0.0005
          ? 'translate3d(0,' + (ty + 120 * enter).toFixed(2) + 'px,0) perspective(1400px) rotateX(' + (14 * enter).toFixed(3) + 'deg)'
          : 'translate(0,' + ty + 'px)';
        shot.style.opacity = (1 - enter).toFixed(3);
      }
      if (leg.i === N - 1) el.style.setProperty('--in', smooth((pr - 0.08) / 0.4).toFixed(4));   // S7 photo: fades + rises just after the copy
      el.classList.toggle('is-visible', cop > 0.001);
      var interactive = cop > 0.5;
      if (el.inert !== !interactive) el.inert = !interactive;
    });

    // rail: the latest checkpoint whose copy has started to come in
    var near = 0;
    LEGS.forEach(function (leg) { if (leg.i > 0 && y >= copyStartY(leg)) near = leg.i; });
    if (near !== active) {
      if (active !== -1) flashLabel(near);   // not on first paint
      active = near;
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === near); d.setAttribute('aria-current', k === near ? 'step' : 'false'); });
    }
    if (hint) hint.style.opacity = clamp(1 - y / (0.22 * vh)).toFixed(3);
    // rain (rain.js): full through S0/L0 and the start of L1; it fades while the camera passes through the
    // open bay door into Hall A (L1 clip ~0.50 → 0.64) and is gone inside the hall; back in on the way up
    if (window.ShopViewRain) {
      var rainLv = y < LEGS[1].start ? 1 : y >= LEGS[1].end ? 0 : 1 - smooth((LEGS[1].target - 0.50) / 0.14);
      window.ShopViewRain.level(rainLv);
    }
    // S0 is a clean frame (its own bottom-left scrim); the checkpoint shade comes in across L0
    var p0 = y / len(LEGS[0]);
    if (shade) shade.style.opacity = smooth((p0 - 0.3) / 0.55).toFixed(3);
    if (beat) {
      var bo = p0 < BEAT.out0 ? smooth((p0 - BEAT.in0) / (BEAT.in1 - BEAT.in0)) : smooth((BEAT.out1 - p0) / (BEAT.out1 - BEAT.out0));
      beat.style.opacity = bo.toFixed(3);
      beat.style.visibility = bo > 0.001 ? 'visible' : 'hidden';
      beat.style.transform = 'translate3d(0,' + ((1 - bo) * (p0 < BEAT.out0 ? 2 : -1.5)).toFixed(2) + 'vh,0)';
    }
  }

  // the rail shows dots only; the active label flashes for ~1.2 s when the section changes
  var flashTimer = null;
  function flashLabel(i) {
    dots.forEach(function (d) { d.classList.remove('is-flash'); });
    clearTimeout(flashTimer);
    if (!dots[i]) return;
    dots[i].classList.add('is-flash');
    flashTimer = setTimeout(function () { dots[i].classList.remove('is-flash'); }, 1200);
  }

  function raf() {
    for (var i = 0; i < N; i++) {
      var leg = LEGS[i], v = leg.video;
      if (!v || !leg.ready || v.seeking) continue;               // never queue a seek mid-seek
      if (!leg.visible && Math.abs(leg.cur - leg.target) < 0.002) continue;
      leg.cur += (leg.target - leg.cur) * (lenis ? 0.32 : 0.18);   // Lenis already smooths the scroll itself
      var t = clamp(leg.cur, 0, 0.999) * (v.duration || 1);
      if (Math.abs(v.currentTime - t) > 0.008) { try { v.currentTime = t; } catch (e) {} }
    }
    requestAnimationFrame(raf);
  }

  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(read); } }, { passive: true });
  window.addEventListener('resize', layout);
  window.addEventListener('load', layout);
  // Crossing the desktop/phone or motion boundary swaps the whole mode; reload is the clean way.
  ['(min-width: 760px)', '(prefers-reduced-motion: reduce)'].forEach(function (q) {
    var mq = window.matchMedia(q);
    var onChange = function () { window.location.reload(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  });

  layout();
  load(LEGS[0]);
  requestAnimationFrame(raf);
})();

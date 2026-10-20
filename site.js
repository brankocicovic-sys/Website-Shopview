/* ShopView homepage — nav pill, role switcher, testimonials marquee. */
(function () {
  'use strict';

  // ── nav: transparent full-width bar over the hero, pill once past it ──
  // (live flight: the S0 copy is gone by 0.25 of L0 = 0.585 screens; phones/static: a little scroll)
  var nav = document.getElementById('nav');
  var onScroll = function () {
    var past = document.documentElement.classList.contains('flight-live') ? 0.6 * window.innerHeight : 40;
    nav.classList.toggle('is-scrolled', window.scrollY > past);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── header menus (live shopview.com: Platform / Solutions / Free Sh*t) ──
  var items = Array.prototype.slice.call(nav.querySelectorAll('.nav__item'));
  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)');
  var closeTimer = null;
  function setOpen(item, open) {
    item.classList.toggle('is-open', open);
    var t = item.querySelector('.nav__trigger');
    if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function closeAll(except) { items.forEach(function (it) { if (it !== except) setOpen(it, false); }); }
  items.forEach(function (item) {
    var trigger = item.querySelector('.nav__trigger');
    item.addEventListener('mouseenter', function () {
      if (!hoverable.matches) return;
      clearTimeout(closeTimer); closeAll(item); setOpen(item, true);
    });
    item.addEventListener('mouseleave', function () {
      if (!hoverable.matches) return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function () { setOpen(item, false); }, 160);
    });
    trigger.addEventListener('click', function (e) {
      // Buttons toggle. "Free Sh*t" is a real link: first tap opens the menu on touch, a click on desktop follows it.
      if (trigger.tagName === 'A' && (hoverable.matches || item.classList.contains('is-open'))) return;
      e.preventDefault();
      var open = !item.classList.contains('is-open');
      closeAll(item); setOpen(item, open);
    });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); closeAll(item); setOpen(item, true);
        var first = item.querySelector('.menu a'); if (first) first.focus();
      }
    });
    item.addEventListener('focusout', function (e) {
      if (!item.contains(e.relatedTarget)) setOpen(item, false);
    });
  });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = items.filter(function (it) { return it.classList.contains('is-open'); })[0];
    closeAll();
    if (open) open.querySelector('.nav__trigger').focus();
    if (!mnav.hidden) toggleMobile(false, true);
  });

  // Platform: hovering or focusing a hub shows its pane (live behaviour)
  var hubs = Array.prototype.slice.call(nav.querySelectorAll('.hub'));
  var panes = Array.prototype.slice.call(nav.querySelectorAll('.hubpane'));
  hubs.forEach(function (hub) {
    var show = function () {
      var key = hub.getAttribute('data-hub');
      hubs.forEach(function (h) { h.classList.toggle('is-on', h === hub); });
      panes.forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-pane') === key); });
    };
    hub.addEventListener('mouseenter', show);
    hub.addEventListener('focus', show);
  });

  // ── mobile menu (below 1080px) ──
  var burger = nav.querySelector('.nav__burger');
  var mnav = document.getElementById('mnav');
  function toggleMobile(open, refocus) {
    mnav.hidden = !open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-menu-open', open);
    if (!open && refocus) burger.focus();
  }
  burger.addEventListener('click', function () { toggleMobile(mnav.hidden); });
  mnav.addEventListener('click', function (e) { if (e.target.closest('a')) toggleMobile(false); });
  window.matchMedia('(min-width: 1080px)').addEventListener('change', function (e) { if (e.matches) toggleMobile(false); });

  // ── S6 roles: live shopview.com "Making Life Easier" copy ──
  var ROLES = {
    owner:   { name: 'Shop Owner', text: 'See how your shop is performing without digging through disconnected systems or spreadsheets.',
               items: ['Track shop revenue and profitability', 'Monitor technician productivity', 'Review labor efficiency', 'Understand where time and money are being lost'] },
    service: { name: 'Service Manager', text: 'Keep work moving from estimate to completion with a clear view of jobs, people, and priorities.',
               items: ['Schedule jobs efficiently', 'Assign technicians', 'Track repair progress', 'Improve shop workflow'] },
    tech:    { name: 'Technician', text: 'Give technicians the information they need to work faster and document repairs clearly.',
               items: ['View assigned repair orders', 'Log labor hours quickly', 'Add notes and updates', 'Switch between jobs without waiting on admin'] },
    parts:   { name: 'Parts Manager', text: 'Manage parts usage and inventory so jobs do not stall because something is missing.',
               items: ['Track parts inventory', 'Monitor stock levels', 'Manage parts ordering', 'Reduce parts shortages'] },
    admin:   { name: 'Admin Staff', text: 'Simplify the office work that keeps the shop moving and customers informed.',
               items: ['Generate invoices faster', 'Track payments', 'Manage customer records', 'Reduce duplicate data entry'] }
  };
  var card = document.getElementById('role-card');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.roles__list [role="tab"]'));
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function selectRole(btn, focus) {
    var r = ROLES[btn.getAttribute('data-role')];
    if (!r) return;
    tabs.forEach(function (t) {
      var on = t === btn;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    card.setAttribute('aria-labelledby', btn.id);
    card.innerHTML = '<h3>' + esc(r.name) + '</h3><p class="p">' + esc(r.text) + '</p><ul class="checks">' +
      r.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
    if (focus) btn.focus();
  }
  tabs.forEach(function (t, k) {
    t.tabIndex = t.classList.contains('is-on') ? 0 : -1;
    t.addEventListener('click', function () { selectRole(t); });
    t.addEventListener('keydown', function (e) {
      var d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      selectRole(tabs[(k + d + tabs.length) % tabs.length], true);
    });
  });

  // ── testimonials: the new site's two-row marquee ──
  // Source of truth: shopview.com/reviews — the first review listed for each author, verbatim,
  // with its role, star rating and source.
  var REVIEWS = [
    { name: "Hudson P.", role: "Technician", source: "G2", stars: 5, text: "It's allowing me to have more freedom in building jobs, switching between different vehicles on the fly and completing or deferring jobs altogether, giving me more work flow control. Previously to ShopView, we had to approach service for any small changes to the work order. When using it all day, every single day, having the ability to streamline my own jobs is critical." },
    { name: "Heather F.", role: "Administrator", source: "Capterra", stars: 5, text: "Unmatched customer service. Ease of use. Modern user interface design." },
    { name: "Taylor S.", role: "General Manager", source: "Capterra", stars: 5, text: "I love how fast it is, as well as everything/anything you want to see or get to is no more than 2 clicks away. Very user friendly. They also have an amazing customer support team, they are very responsive and care about solving problems." },
    { name: "Brian W.", role: "Fleet Coordinator", source: "G2", stars: 5, text: "The software is easy to set up! It's also intuitive making it easy to train technicians. Customer support is by far the best I have ever dealt with. Fast replies and go above and beyond to help you solve your problem. Being browser based, it was easy to deploy on tablets no matter what brand or OS." },
    { name: "Kerri W.", role: "Parts Specialist", source: "Capterra", stars: 5, text: "I find ShopView easy to navigate through work orders. From setting up work orders to adding parts, managing inventory with the ability to cycle count to keep inventory up to date, and managing tech times and payroll timesheets makes tracking times for payroll a breeze. The ShopView team is quick to respond to any issues that do arise." },
    { name: "Jeffery D.", role: "Shop Manager", source: "Capterra", stars: 5, text: "Before ShopView, I've spent more hours (and let's not talk about the dollars) wrestling with clunky software and spreadsheet gymnastics just to get the right data to manage my team properly. Seriously, this thing is saving me time, money, and probably a few remaining brain cells. At this point, it feels less like software and more like a very competent coworker who actually shows up on time and knows what they're doing." },
    { name: "Kimberly C.", role: "Parts Manager", source: "Capterra", stars: 5, text: "System changeovers are always complicated. Learning how to use ShopView and training new staff on the system has been simple (which is rare with new systems, in my experience). The support team is available to help via the chat feature, which allows for less room for errors." },
    { name: "Chris W.", role: "Shop Owner", source: "G2", stars: 5, text: "ShopView has sped up our team immensely with it's ease of integration and usage as well as it's incredible feature list. It is very apparent that this software was developed by repair professionals FOR repair professionals. Implementation of the vastly superior ShopView platform from our previous software has been a breeze. The user interface is intelligently designed to create a natural and expected flow to successfully and efficiently complete each users intentions. The customer support team is incredibly helpful, and tackles any questions or training requirements without breaking a sweat." }
  ];
  var SOURCE_LOGOS = { Capterra: ['assets/img/logo-capterra.svg', 87, 20], G2: ['assets/img/logo-g2.svg', 19, 19] };
  var rows = document.getElementById('reviews-rows');
  if (rows) {
    var initials = function (n) { return n.replace(/[^A-Za-z ]/g, '').split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase(); };
    var STAR = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="#fdb022" d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 0 0 .95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 0 0-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 0 0-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.69l1.07-3.29z"/></svg>';
    // quote at the top; stars + author + source pinned to the bottom (cards in a row share the tallest height)
    var cardHTML = function (r, hidden) {
      var logo = r.source && SOURCE_LOGOS[r.source];
      return '<blockquote class="review-card"' + (hidden ? ' aria-hidden="true"' : '') + '>' +
        '<p class="review-card__text">“' + esc(r.text) + '”</p>' +
        '<footer class="review-card__foot">' +
          (r.stars ? '<span class="review-card__stars" role="img" aria-label="' + r.stars + ' out of 5 stars">' + new Array(r.stars + 1).join(STAR) + '</span>' : '') +
          '<div class="review-card__head"><div class="review-card__person"><span class="review-card__avatar" aria-hidden="true">' + initials(r.name) + '</span>' +
          '<div><p class="review-card__name">' + esc(r.name) + '</p><p class="review-card__role">' + esc(r.role) + '</p></div></div>' +
          (logo ? '<img class="review-card__source" src="' + logo[0] + '" width="' + logo[1] + '" height="' + logo[2] + '" alt="' + esc(r.source) + ' review" />' : '') +
          '</div>' +
        '</footer></blockquote>';
    };
    // One half of a track must be wider than any screen; three cards are not, so each
    // half repeats the set twice. The second half is a copy for the seamless loop.
    var track = function (list, reverse) {
      var half = list.length >= 6 ? list : list.concat(list);   // each half must be wider than the screen
      return '<div class="reviews__marquee"><div class="reviews__track' + (reverse ? ' reviews__track--reverse' : '') + '">' +
        half.map(function (r, k) { return cardHTML(r, reverse || k >= list.length); }).join('') +
        half.map(function (r) { return cardHTML(r, true); }).join('') +
        '</div></div>';
    };
    rows.innerHTML = track(REVIEWS, false) + track(REVIEWS.slice().reverse(), true);
  }
  // ── S1 case study video: YouTube facade (thumbnail + play) → youtube-nocookie iframe on click ──
  // While it plays, window.SHOPVIEW_VIDEO_PLAYING is true and flight.js holds snap + key glides.
  // The player reports its state over postMessage (enablejsapi=1, no YouTube API script).
  var YT_ORIGIN = 'https://www.youtube-nocookie.com';
  var setPlaying = function (on) { window.SHOPVIEW_VIDEO_PLAYING = on; };
  var players = [];
  var send = function (f, func) { try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: [] }), YT_ORIGIN); } catch (e) {} };
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('button.yt[data-yt]');
    if (!btn) return;
    var f = document.createElement('iframe');
    f.src = YT_ORIGIN + '/embed/' + encodeURIComponent(btn.getAttribute('data-yt')) +
      '?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
    f.title = btn.getAttribute('data-title') || 'YouTube video';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.addEventListener('load', function () {
      try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'sv-yt', channel: 'widget' }), YT_ORIGIN); } catch (err) {}
    });
    var box = document.createElement('div');
    box.className = 'yt is-live';
    box.appendChild(f);
    btn.replaceWith(box);
    players.push(f);
    setPlaying(true);   // autoplay is starting; the player confirms or corrects it below
    f.focus();
  });
  window.addEventListener('message', function (e) {
    if (e.origin !== YT_ORIGIN) return;
    var d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    var st = d && (d.event === 'onStateChange' ? d.info : d.info && d.info.playerState);
    if (typeof st !== 'number') return;
    setPlaying(st === 1 || st === 3);   // 1 playing, 3 buffering; paused / ended / cued release the flight
  });
  // the thumbnail loads only once its checkpoint starts to show (static mode: as it nears the screen)
  var thumbs = Array.prototype.slice.call(document.querySelectorAll('img.yt__thumb[data-src]'));
  var loadThumb = function (img) { if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); } };
  thumbs.forEach(function (img) {
    var cp = img.closest('.cp');
    if (document.documentElement.classList.contains('flight-live') && cp && window.MutationObserver) {
      var mo = new MutationObserver(function () { if (cp.classList.contains('is-visible')) { loadThumb(img); mo.disconnect(); } });
      mo.observe(cp, { attributes: true, attributeFilter: ['class'] });
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { loadThumb(img); io.disconnect(); } }, { rootMargin: '600px 0px' });
      io.observe(img);
    } else loadThumb(img);
  });

  // the card fading out (scrolled on) pauses the video
  var cp1 = document.getElementById('cp-1');
  if (cp1 && window.MutationObserver) {
    new MutationObserver(function () {
      if (cp1.inert && players.length) { players.forEach(function (f) { send(f, 'pauseVideo'); }); setPlaying(false); }
    }).observe(cp1, { attributes: true, attributeFilter: ['inert'] });
  }
  // ── big quote: scroll-driven reveal, row by row (the new site's logic; Lenis scrolls the window,
  // so plain scroll events drive it). Phones: the lines run inline, so each sweep follows the wrapped text in reading order. Reduced motion: static.
  var quote = document.querySelector('.quote');
  if (quote && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var qLines = Array.prototype.slice.call(quote.querySelectorAll('.quote__line'));
    var qTick = false;
    var qUpdate = function () {
      qTick = false;
      var r = quote.getBoundingClientRect(), h = window.innerHeight;
      var p = Math.max(0, Math.min(1, (h - r.top) / (h * 0.7 + r.height * 0.5)));   // 0 → 1 as it scrolls into view
      var p1 = Math.min(1, p / 0.6);                          // line 1: first 60% of the progress
      var p2 = Math.max(0, Math.min(1, (p - 0.6) / 0.4));     // line 2: the remaining 40%
      qLines[0].style.setProperty('--reveal', (-20 + p1 * 140) + '%');
      if (qLines[1]) qLines[1].style.setProperty('--reveal', (-20 + p2 * 140) + '%');
    };
    window.addEventListener('scroll', function () { if (!qTick) { qTick = true; requestAnimationFrame(qUpdate); } }, { passive: true });
    window.addEventListener('resize', qUpdate);
    qUpdate();
  }
  // ── CTA DotPattern: blue dots brighten around the cursor (desktop, fine pointer, motion allowed) ──
  var cta = document.querySelector('.cta');
  if (cta && cta.querySelector('.cta__dots--glow') &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var glowRaf = 0, gx = 0, gy = 0;
    cta.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = cta.getBoundingClientRect(); gx = e.clientX - r.left; gy = e.clientY - r.top;
      if (!glowRaf) glowRaf = requestAnimationFrame(function () {
        glowRaf = 0;
        cta.style.setProperty('--mx', gx + 'px'); cta.style.setProperty('--my', gy + 'px'); cta.style.setProperty('--glow', '1');
      });
    });
    cta.addEventListener('pointerleave', function () { cta.style.setProperty('--glow', '0'); });
  }
})();

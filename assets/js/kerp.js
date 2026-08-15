/* ==========================================================================
   Kerp Barbershop & Salon — proof of concept
   No dependencies. Everything degrades to a readable static page.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- nav */
  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');
  var masthead = document.getElementById('masthead');

  function setDrawer(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.hidden = !open;
    document.body.classList.toggle('is-locked', open);
    if (open) {
      var first = drawer.querySelector('a');
      if (first) first.focus();
    }
  }

  burger.addEventListener('click', function () {
    setDrawer(burger.getAttribute('aria-expanded') !== 'true');
  });

  drawer.addEventListener('click', function (e) {
    if (e.target.closest('a')) setDrawer(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      setDrawer(false);
      burger.focus();
    }
  });

  // The drawer is a mobile affordance; a resize past the desktop breakpoint closes it.
  window.matchMedia('(min-width: 60rem)').addEventListener('change', function (e) {
    if (e.matches) setDrawer(false);
  });

  /* --------------------------------------------------- scroll behaviour */
  var dock = document.querySelector('.dock');
  var lastY = window.scrollY;

  function onScroll() {
    var y = window.scrollY;
    masthead.classList.toggle('is-stuck', y > 8);
    // Dock appears once the hero CTAs have scrolled away, hides again at the top.
    dock.classList.toggle('is-up', y > 420);
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------- open/shut */
  // Mon–Fri 10:00–19:00, Sat 10:00–18:00, Sun closed. Shop time is America/Vancouver.
  var HOURS = {
    0: null,
    1: [600, 1140], 2: [600, 1140], 3: [600, 1140], 4: [600, 1140], 5: [600, 1140],
    6: [600, 1080]
  };
  var DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function shopNow() {
    var parts;
    try {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Vancouver',
        weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
    } catch (err) {
      return null; // no Intl time zone data — leave the static hours table to speak
    }
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(map.weekday);
    var hour = parseInt(map.hour, 10) % 24;
    return { day: idx, mins: hour * 60 + parseInt(map.minute, 10) };
  }

  function clock(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    var suffix = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + suffix;
  }

  function nextOpening(day) {
    for (var i = 1; i <= 7; i++) {
      var d = (day + i) % 7;
      if (HOURS[d]) {
        return (i === 1 ? 'tomorrow' : DAY_NAME[d]) + ' at ' + clock(HOURS[d][0]);
      }
    }
    return null;
  }

  var statusEl = document.getElementById('status');
  var now = shopNow();

  if (now) {
    var today = HOURS[now.day];
    var text = statusEl.querySelector('.status__text');
    statusEl.removeAttribute('data-empty');

    if (today && now.mins >= today[0] && now.mins < today[1]) {
      statusEl.classList.add('is-open');
      text.textContent = 'Open now · until ' + clock(today[1]);
    } else {
      statusEl.classList.add('is-shut');
      if (today && now.mins < today[0]) {
        text.textContent = 'Closed · opens today at ' + clock(today[0]);
      } else {
        var next = nextOpening(now.day);
        text.textContent = next ? 'Closed · opens ' + next : 'Closed';
      }
    }

    var row = document.querySelector('.hours tr[data-day="' + now.day + '"]');
    if (row) row.classList.add('is-today');
  } else {
    statusEl.hidden = true;
  }

  /* -------------------------------------------------------------- tabs */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));

  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      var next = tabs[(i + dir + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });

  /* ------------------------------------------------------------ reveal */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  reveals.forEach(function (el) {
    if (el.dataset.d) el.style.setProperty('--d', el.dataset.d);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------- hero canvas */
  // A slow diagonal drift of steel bands with the occasional brass one —
  // the barber pole, dialled almost all the way down.
  var canvas = document.getElementById('heroCanvas');
  var ctx = canvas.getContext && canvas.getContext('2d');

  if (ctx) {
    var PERIOD = 340;
    var ANGLE = -22 * Math.PI / 180;
    var bands = [];
    var seed = 7;

    // Deterministic pseudo-random so the pattern is stable across reloads.
    function rnd() {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    }

    var cursor = 0;
    while (cursor < PERIOD) {
      var w = 2 + rnd() * 26;
      bands.push({ x: cursor, w: w, a: 0.012 + rnd() * 0.026, brass: rnd() > 0.86 });
      cursor += w + 4 + rnd() * 34;
    }

    var css = getComputedStyle(document.documentElement);
    var tint = { steel: '#ffffff', brass: '#C69B4E' };

    function readTint() {
      tint.brass = (css.getPropertyValue('--brass') || '#C69B4E').trim();
      // Bands lighten a dark ground and darken a light one.
      var light = getComputedStyle(document.documentElement).colorScheme.indexOf('light') > -1;
      tint.steel = light ? '#3F4B50' : '#ffffff';
      tint.scale = light ? 0.5 : 1;
    }
    readTint();

    var w = 0, h = 0, phase = 0, raf = null, visible = true;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      var span = w + h;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(ANGLE);
      var start = -span;
      for (var base = start; base < span; base += PERIOD) {
        for (var i = 0; i < bands.length; i++) {
          var b = bands[i];
          var x = base + b.x + (phase % PERIOD);
          if (x > span || x < start - PERIOD) continue;
          ctx.globalAlpha = b.a * tint.scale * (b.brass ? 1.5 : 1);
          ctx.fillStyle = b.brass ? tint.brass : tint.steel;
          ctx.fillRect(x, -span, b.w, span * 2);
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function tick() {
      phase += 0.16;
      draw();
      raf = visible ? requestAnimationFrame(tick) : null;
    }

    var ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);
    resize();

    if (!reduceMotion) {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible && !raf) raf = requestAnimationFrame(tick);
        }, { threshold: 0 }).observe(canvas);
      }
      raf = requestAnimationFrame(tick);
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      readTint();
      draw();
    });
  }
})();

/* =====================================================================
   IMMERSIVE LESSON READER  (ported from assets/js/reader.js)
   Turns the lesson text under the video into a full-screen reading
   surface: "book" pours the text into sideways-turned columns, "scroll"
   is the familiar continuous column, just wider.

   The lesson text node is MOVED into the reader and put back when the
   reader closes. window.HH.initReader() re-targets the reader at the
   lesson currently on the page; document-level listeners are installed
   once and always act on the current state.
   ===================================================================== */
(function () {
  'use strict';

  window.HH = window.HH || {};

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'midwifery-reader';
  var FS_MIN = 15, FS_MAX = 30, MIN_COL = 300;

  var prefs = { mode: 'book', cols: 'auto', width: 'medium', fs: 19 };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved && typeof saved === 'object') {
      if (saved.mode === 'book' || saved.mode === 'scroll') prefs.mode = saved.mode;
      if (['auto', '1', '2', '3'].indexOf(String(saved.cols)) > -1) prefs.cols = String(saved.cols);
      if (['narrow', 'medium', 'full'].indexOf(saved.width) > -1) prefs.width = saved.width;
      var f = parseInt(saved.fs, 10);
      if (f >= FS_MIN && f <= FS_MAX) prefs.fs = f;
    }
  } catch (e) {}
  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} }

  /* the reader for the lesson currently on screen */
  var R = null;

  function icon(name) {
    return '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function soon(fn) {
    var done = false;
    function run() { if (done) return; done = true; fn(); }
    if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(run); });
    setTimeout(run, 90);
  }

  function create(source) {
    var dir     = source.getAttribute('data-dir') === 'rtl' ? 'rtl' : 'ltr';
    var rtl     = dir === 'rtl';
    var title   = source.getAttribute('data-title') || document.title;
    var eyebrow = source.getAttribute('data-eyebrow') || 'Lesson';
    var lang    = rtl ? ' lang="ps"' : '';

    var S = {
      source: source, dir: dir, rtl: rtl, open: false, negRTL: null, page: 0, measured: false,
      placeholder: document.createComment('lesson-text'), hintGone: false,
      raf: 0, lastWheel: 0, resizeT: 0, settleT: 0
    };

    var reader = document.createElement('div');
    reader.className = 'reader';
    reader.id = 'lesson-reader';
    reader.setAttribute('role', 'dialog');
    reader.setAttribute('aria-modal', 'true');
    reader.setAttribute('aria-label', 'Lesson reader');
    reader.hidden = true;
    reader.innerHTML =
      '<div class="reader__bar">' +
        '<div class="reader__id">' +
          '<span class="reader__eyebrow">' + esc(eyebrow) + '</span>' +
          '<h2 class="reader__title" dir="' + dir + '"' + lang + '>' + esc(title) + '</h2>' +
        '</div>' +
        '<div class="reader__tools">' +
          '<div class="rgroup" role="group" aria-label="Reading mode">' +
            '<span class="rgroup__cap">Read</span>' +
            '<button type="button" class="rgroup__btn" data-mode="book">' + icon('layers') + ' Book</button>' +
            '<button type="button" class="rgroup__btn" data-mode="scroll">' + icon('list') + ' Scroll</button>' +
          '</div>' +
          '<div class="rgroup" role="group" aria-label="Columns" data-cols-group>' +
            '<span class="rgroup__cap">Columns</span>' +
            '<button type="button" class="rgroup__btn" data-cols="auto">Auto</button>' +
            '<button type="button" class="rgroup__btn" data-cols="1">1</button>' +
            '<button type="button" class="rgroup__btn" data-cols="2">2</button>' +
            '<button type="button" class="rgroup__btn" data-cols="3">3</button>' +
          '</div>' +
          '<div class="rgroup" role="group" aria-label="Text size">' +
            '<button type="button" class="rgroup__btn" data-fs="-" aria-label="Smaller text">' + icon('minus') + '</button>' +
            '<span class="rgroup__val" data-fs-out>' + prefs.fs + '</span>' +
            '<button type="button" class="rgroup__btn" data-fs="+" aria-label="Larger text">' + icon('plus') + '</button>' +
          '</div>' +
          '<div class="rgroup" role="group" aria-label="Text width" data-width-group>' +
            '<span class="rgroup__cap">Width</span>' +
            '<button type="button" class="rgroup__btn" data-width="narrow">S</button>' +
            '<button type="button" class="rgroup__btn" data-width="medium">M</button>' +
            '<button type="button" class="rgroup__btn" data-width="full">L</button>' +
          '</div>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-native-fs>' +
            icon('maximize') + ' <span data-native-fs-label>Full screen</span>' +
          '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-reader-close>' + icon('x') + ' Close</button>' +
        '</div>' +
      '</div>' +
      '<div class="reader__stage">' +
        '<button type="button" class="reader__zone reader__zone--prev" data-page="-1" aria-label="Previous page">' + icon('arrow-left') + '</button>' +
        '<button type="button" class="reader__zone reader__zone--next" data-page="1" aria-label="Next page">' + icon('arrow-right') + '</button>' +
        '<div class="reader__doc" data-reader-doc tabindex="0" dir="' + dir + '">' +
          '<div class="reader__inner" data-reader-inner></div>' +
        '</div>' +
        '<div class="reader__hint" data-reader-hint>' +
          '<kbd>' + (rtl ? '→' : '←') + '</kbd> <kbd>' + (rtl ? '←' : '→') + '</kbd> turn the page · <kbd>Esc</kbd> close' +
        '</div>' +
      '</div>' +
      '<div class="reader__foot">' +
        '<button type="button" class="reader__nav" data-page="-1" aria-label="Previous page">' + icon(rtl ? 'arrow-right' : 'arrow-left') + '</button>' +
        '<span class="reader__pos" data-reader-pos>Page 1</span>' +
        '<button type="button" class="reader__nav" data-page="1" aria-label="Next page">' + icon(rtl ? 'arrow-left' : 'arrow-right') + '</button>' +
      '</div>' +
      '<div class="reader__track"><span data-reader-fill></span></div>';

    document.body.appendChild(reader);

    S.reader  = reader;
    S.doc     = $('[data-reader-doc]', reader);
    S.inner   = $('[data-reader-inner]', reader);
    S.posOut  = $('[data-reader-pos]', reader);
    S.fill    = $('[data-reader-fill]', reader);
    S.fsOut   = $('[data-fs-out]', reader);
    S.hint    = $('[data-reader-hint]', reader);
    S.prevBtn = $('.reader__foot [data-page="-1"]', reader);
    S.nextBtn = $('.reader__foot [data-page="1"]', reader);

    wire(S);
    return S;
  }

  /* ---------------- preferences -> DOM ---------------- */
  function autoCols(S) {
    var w = S.doc ? S.doc.clientWidth : window.innerWidth;
    if (w < 720)  return 1;
    if (w < 1180) return 2;
    return 3;
  }
  function effectiveCols(S) {
    var w    = S.doc ? S.doc.clientWidth : window.innerWidth;
    var want = prefs.cols === 'auto' ? autoCols(S) : parseInt(prefs.cols, 10) || 1;
    var fits = Math.max(1, Math.floor(w / MIN_COL));
    return Math.min(want, fits);
  }
  function mark(S, sel, attr, value) {
    $$(sel, S.reader).forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-' + attr) === String(value));
    });
  }
  function applyPrefs(S) {
    S.reader.setAttribute('data-mode', prefs.mode);
    S.reader.setAttribute('data-width', prefs.width);
    S.reader.style.setProperty('--rfs', prefs.fs + 'px');
    S.reader.style.setProperty('--rcols', effectiveCols(S));
    if (S.fsOut) S.fsOut.textContent = prefs.fs;
    mark(S, '[data-mode]', 'mode', prefs.mode);
    mark(S, '[data-cols]', 'cols', prefs.cols);
    mark(S, '[data-width]', 'width', prefs.width);

    var fits = Math.max(1, Math.floor((S.doc ? S.doc.clientWidth : window.innerWidth) / MIN_COL));
    $$('[data-cols]', S.reader).forEach(function (b) {
      var n = parseInt(b.getAttribute('data-cols'), 10);
      b.disabled = !!n && n > fits;
      b.style.opacity = b.disabled ? '.35' : '';
    });
    var colsGroup  = $('[data-cols-group]', S.reader);
    var widthGroup = $('[data-width-group]', S.reader);
    if (colsGroup)  colsGroup.hidden  = prefs.mode !== 'book';
    if (widthGroup) widthGroup.hidden = prefs.mode === 'book';
    soon(function () { relayout(S); });
  }

  /* ---------------- paging maths ---------------- */
  function maxX(S) { return Math.max(0, S.doc.scrollWidth - S.doc.clientWidth); }
  function probe(S) {
    if (!S.rtl) { S.negRTL = false; return; }
    if (S.negRTL !== null) return;
    if (maxX(S) <= 0) return;
    var keep = S.doc.scrollLeft;
    S.doc.scrollLeft = -1;
    S.negRTL = S.doc.scrollLeft < 0;
    S.doc.scrollLeft = keep;
  }
  function getX(S) {
    if (!S.rtl) return S.doc.scrollLeft;
    var m = maxX(S);
    if (m <= 0) return 0;
    probe(S);
    return S.negRTL ? -S.doc.scrollLeft : m - S.doc.scrollLeft;
  }
  function setX(S, x, smooth) {
    var m = maxX(S);
    x = Math.max(0, Math.min(m, x));
    if (S.rtl) probe(S);
    var left = !S.rtl ? x : (S.negRTL ? -x : m - x);
    S.doc.scrollTo({ left: left, behavior: (smooth && !reduced) ? 'smooth' : 'auto' });
    if (smooth && !reduced) {
      clearTimeout(S.settleT);
      S.settleT = setTimeout(function () {
        if (Math.abs(S.doc.scrollLeft - left) > 2) S.doc.scrollTo({ left: left, behavior: 'auto' });
      }, 420);
    }
  }
  function step(S) {
    var gap = parseFloat(getComputedStyle(S.inner).columnGap);
    if (!isFinite(gap)) gap = 0;
    return Math.max(1, S.inner.clientWidth + gap);
  }
  function pageCount(S) {
    if (prefs.mode !== 'book') return 1;
    var gap = parseFloat(getComputedStyle(S.inner).columnGap) || 0;
    return Math.max(1, Math.ceil((S.inner.scrollWidth + gap) / step(S) - 0.02));
  }
  function goToPage(S, p, smooth) {
    var pages = pageCount(S);
    S.page = Math.max(0, Math.min(pages - 1, p));
    setX(S, S.page * step(S), smooth);
    refresh(S);
  }
  function syncPageFromScroll(S) {
    var pages = pageCount(S);
    if (getX(S) >= maxX(S) - 2) S.page = pages - 1;
    else S.page = Math.max(0, Math.min(pages - 1, Math.round(getX(S) / step(S))));
  }
  function relayout(S) {
    if (!S.open) return;
    if (prefs.mode === 'book') goToPage(S, S.page, false);
    else refresh(S);
  }
  function turn(S, delta) {
    if (prefs.mode !== 'book') {
      S.doc.scrollBy({ top: delta * S.doc.clientHeight * 0.9, behavior: reduced ? 'auto' : 'smooth' });
      fadeHint(S);
      return;
    }
    probe(S);
    goToPage(S, S.page + delta, true);
    fadeHint(S);
  }
  function refresh(S) {
    if (!S.open || !S.measured) return;
    if (prefs.mode === 'book') {
      probe(S);
      var pages = pageCount(S);
      var here  = Math.min(pages, S.page + 1);
      S.posOut.textContent = pages > 1 ? 'Page ' + here + ' of ' + pages : 'One page';
      S.prevBtn.disabled = here <= 1;
      S.nextBtn.disabled = here >= pages;
      S.fill.style.width = (pages <= 1 ? 100 : ((here - 1) / (pages - 1)) * 100) + '%';
    } else {
      var m = S.doc.scrollHeight - S.doc.clientHeight;
      var pct = m > 0 ? (S.doc.scrollTop / m) * 100 : 100;
      S.posOut.textContent = m > 0 ? Math.round(pct) + '% read' : 'All on one screen';
      S.prevBtn.disabled = S.doc.scrollTop <= 2;
      S.nextBtn.disabled = pct >= 99.5;
      S.fill.style.width = pct + '%';
    }
  }
  function fadeHint(S) {
    if (S.hintGone || !S.hint) return;
    S.hintGone = true;
    S.hint.classList.add('is-gone');
    setTimeout(function () { if (S.hint) S.hint.hidden = true; }, 600);
  }

  /* ---------------- events on the reader element ---------------- */
  function wire(S) {
    S.reader.addEventListener('click', function (e) {
      var t = e.target.closest('[data-mode],[data-cols],[data-width],[data-fs],[data-page],[data-reader-close],[data-native-fs]');
      if (!t || !S.reader.contains(t)) return;
      if (t.hasAttribute('data-reader-close')) { close(S); return; }
      if (t.hasAttribute('data-native-fs'))    { toggleNativeFullscreen(S); return; }
      if (t.hasAttribute('data-page'))         { turn(S, parseInt(t.getAttribute('data-page'), 10)); return; }
      if (t.hasAttribute('data-mode'))  prefs.mode  = t.getAttribute('data-mode');
      if (t.hasAttribute('data-cols'))  prefs.cols  = t.getAttribute('data-cols');
      if (t.hasAttribute('data-width')) prefs.width = t.getAttribute('data-width');
      if (t.hasAttribute('data-fs')) {
        var d = t.getAttribute('data-fs') === '+' ? 1 : -1;
        prefs.fs = Math.max(FS_MIN, Math.min(FS_MAX, prefs.fs + d));
      }
      savePrefs();
      applyPrefs(S);
    });

    S.doc.addEventListener('scroll', function () {
      if (S.raf) return;
      S.raf = requestAnimationFrame(function () {
        S.raf = 0;
        if (prefs.mode === 'book') syncPageFromScroll(S);
        refresh(S);
      });
    }, { passive: true });

    S.doc.addEventListener('wheel', function (e) {
      if (prefs.mode !== 'book') return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      var now = Date.now();
      if (now - S.lastWheel < 260) return;
      S.lastWheel = now;
      turn(S, e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    var x0 = null, y0 = null;
    S.doc.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    S.doc.addEventListener('touchend', function (e) {
      if (x0 === null || prefs.mode !== 'book') { x0 = null; return; }
      var dx = e.changedTouches[0].clientX - x0;
      var dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) turn(S, (dx < 0 ? 1 : -1) * (S.rtl ? -1 : 1));
      x0 = null;
    }, { passive: true });
  }

  function toggleNativeFullscreen(S) {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (S.reader.requestFullscreen) {
      S.reader.requestFullscreen().catch(function () {});
    }
  }
  function syncNativeLabel(S) {
    if (!S || !S.reader) return;
    var on = document.fullscreenElement === S.reader;
    var label = $('[data-native-fs-label]', S.reader);
    var svg   = $('[data-native-fs] use', S.reader);
    if (label) label.textContent = on ? 'Exit full screen' : 'Full screen';
    if (svg) svg.setAttribute('href', on ? '#i-minimize' : '#i-maximize');
    setTimeout(function () { relayout(S); }, 220);
  }

  /* ---------------- open / close ---------------- */
  function openReader(S) {
    if (!S || S.open) return;
    S.source.parentNode.insertBefore(S.placeholder, S.source);
    S.inner.appendChild(S.source);

    S.reader.removeAttribute('data-mode');
    S.reader.hidden = false;
    document.documentElement.classList.add('reader-open');
    S.open = true;
    void S.reader.offsetHeight;

    S.negRTL = null;
    S.page = 0;
    S.measured = false;
    S.posOut.textContent = '';
    if (S.hint && !S.hintGone) S.hint.hidden = false;

    S.doc.focus({ preventScroll: true });
    soon(function () {
      applyPrefs(S);
      S.doc.scrollTop = 0;
      function publish() {
        if (!S.open || S.measured) return;
        S.measured = true;
        relayout(S);
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(publish);
      setTimeout(publish, 320);
    });
  }

  function close(S) {
    if (!S || !S.open) return;
    if (document.fullscreenElement === S.reader && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    if (S.placeholder.parentNode) {
      S.placeholder.parentNode.insertBefore(S.source, S.placeholder);
      S.placeholder.parentNode.removeChild(S.placeholder);
    }
    S.reader.hidden = true;
    S.reader.removeAttribute('data-mode');
    document.documentElement.classList.remove('reader-open');
    S.open = false;
    var back = $('[data-reader-open]');
    if (back) back.focus();
  }

  function destroy(S) {
    if (!S) return;
    if (S.open) close(S);
    if (S.reader && S.reader.parentNode) S.reader.parentNode.removeChild(S.reader);
    document.documentElement.classList.remove('reader-open');
  }

  /* ---------------- document-level listeners (once) ---------------- */
  function installGlobal() {
    if (window.HH.__readerGlobal) return;
    window.HH.__readerGlobal = true;

    document.addEventListener('keydown', function (e) {
      if (!R) return;
      var t = e.target, tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (!R.open) {
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); openReader(R); }
        return;
      }
      switch (e.key) {
        case 'Escape':     e.preventDefault(); close(R); break;
        case 'ArrowRight': e.preventDefault(); turn(R, R.rtl ? -1 : 1); break;
        case 'ArrowLeft':  e.preventDefault(); turn(R, R.rtl ? 1 : -1); break;
        case 'PageDown':
        case ' ':          e.preventDefault(); turn(R, 1); break;
        case 'PageUp':     e.preventDefault(); turn(R, -1); break;
        case 'Home':
          e.preventDefault();
          if (prefs.mode === 'book') setX(R, 0, true); else R.doc.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        case 'End':
          e.preventDefault();
          if (prefs.mode === 'book') setX(R, maxX(R), true); else R.doc.scrollTo({ top: R.doc.scrollHeight, behavior: 'smooth' });
          break;
        case 'ArrowDown': if (prefs.mode === 'book') { e.preventDefault(); turn(R, 1); } break;
        case 'ArrowUp':   if (prefs.mode === 'book') { e.preventDefault(); turn(R, -1); } break;
      }
    });

    document.addEventListener('click', function (e) {
      var openBtn = e.target.closest('[data-reader-open]');
      if (openBtn) { e.preventDefault(); openReader(R); return; }

      var wide = e.target.closest('[data-wide-toggle]');
      if (wide) {
        var card = wide.closest('[data-lesson-read]') || document.body;
        var on = card.classList.toggle('lesson-read--wide');
        wide.classList.toggle('is-active', on);
        wide.setAttribute('aria-pressed', String(on));
        try { localStorage.setItem('midwifery-lesson-wide', on ? '1' : '0'); } catch (err) {}
      }
    });

    window.addEventListener('resize', function () {
      if (!R || !R.open) return;
      R.reader.style.setProperty('--rcols', effectiveCols(R));
      clearTimeout(R.resizeT);
      R.resizeT = setTimeout(function () { relayout(R); }, 150);
    });
    document.addEventListener('fullscreenchange', function () { syncNativeLabel(R); });
  }

  window.HH.initReader = function () {
    installGlobal();
    var source = document.querySelector('[data-reader-content]');

    /* a reader built for a previous lesson is stale */
    if (R && R.source !== source) { destroy(R); R = null; }
    if (!source) return;
    if (!R) R = create(source);

    /* restore the inline wide preference */
    try {
      if (localStorage.getItem('midwifery-lesson-wide') === '1') {
        var card = $('[data-lesson-read]');
        var btn  = $('[data-wide-toggle]');
        if (card) card.classList.add('lesson-read--wide');
        if (btn) { btn.classList.add('is-active'); btn.setAttribute('aria-pressed', 'true'); }
      }
    } catch (e) {}
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.HH.initReader);
  else window.HH.initReader();
})();

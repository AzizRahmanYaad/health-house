/* =====================================================================
   HEALTH HOUSE — interaction layer + app shell behaviour
   Vanilla JS, no dependencies. Ported from assets/js/app.js + shell.js.

   Next.js keeps the document alive between pages, so nothing here relies
   on DOMContentLoaded any more: window.HH.initApp() binds whatever is on
   the page right now, and <PageBoot> calls it again after every client
   navigation. Element bindings are marked with data-hh-bound so a second
   pass never attaches the same listener twice; document-level listeners
   are installed exactly once.
   ===================================================================== */
(function () {
  'use strict';

  window.HH = window.HH || {};

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function bindOnce(el, key) {
    var k = 'hhBound' + key;
    if (el.dataset[k]) return false;
    el.dataset[k] = '1';
    return true;
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k)     { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------------------------------------------------------------- */
  /* THEME                                                            */
  /* ---------------------------------------------------------------- */
  var Theme = {
    key: 'midwifery-theme',
    set: function (v) {
      root.setAttribute('data-theme', v);
      store(this.key, v);
      $$('[data-theme-toggle]').forEach(function (b) {
        b.setAttribute('aria-label', v === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      });
    },
    init: function () {
      var saved = read(this.key);
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.set(saved || (prefersDark ? 'dark' : 'light'));
    },
    toggle: function () {
      this.set(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    }
  };

  /* ---------------------------------------------------------------- */
  /* TOASTS + CONFETTI                                                */
  /* ---------------------------------------------------------------- */
  function toast(message, type) {
    var box = $('.toasts');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toasts';
      document.body.appendChild(box);
    }
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.textContent = message;
    box.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .4s, transform .4s';
      t.style.opacity = '0';
      t.style.transform = 'translateX(120%)';
      setTimeout(function () { t.remove(); }, 420);
    }, 4200);
  }
  window.toast = toast;

  function confetti(count) {
    if (reduced) return;
    var colors = ['#6C4CF1', '#E8557E', '#12B5A6', '#F59E0B', '#7C5CFF'];
    var n = count || 70;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.7) + 's';
      p.style.animationDuration = (2.4 + Math.random() * 1.8) + 's';
      p.style.width = (6 + Math.random() * 7) + 'px';
      p.style.height = (10 + Math.random() * 10) + 'px';
      document.body.appendChild(p);
      (function (el) { setTimeout(function () { el.remove(); }, 4600); })(p);
    }
  }
  window.confetti = confetti;

  /* ---------------------------------------------------------------- */
  /* FLASH MESSAGES  (hh_flash cookie, written by the server)         */
  /* ---------------------------------------------------------------- */
  function readFlashCookie() {
    var m = document.cookie.match(/(?:^|;\s*)hh_flash=([^;]*)/);
    if (!m) return [];
    document.cookie = 'hh_flash=; Max-Age=0; path=/; SameSite=Lax';
    try { return JSON.parse(decodeURIComponent(m[1])) || []; } catch (e) { return []; }
  }
  function showFlashes() {
    var list = readFlashCookie();
    var el = $('#flash-data');
    if (el && !el.dataset.hhShown) {
      el.dataset.hhShown = '1';
      try { list = list.concat(JSON.parse(el.textContent || '[]')); } catch (e) {}
    }
    /* the cookie and the server-rendered copy carry the same messages */
    var seen = {};
    list.forEach(function (f, i) {
      var key = f.type + '|' + f.message;
      if (seen[key]) return;
      seen[key] = 1;
      setTimeout(function () { toast(f.message, f.type); }, i * 260);
    });
  }

  /* ---------------------------------------------------------------- */
  /* SIDEBAR COLLAPSE / FOCUS MODE                                    */
  /* ---------------------------------------------------------------- */
  var SIDEBAR_KEY = 'midwifery-sidebar';
  var FOCUS_KEY   = 'midwifery-focus';

  function applySidebar(state) {
    root.setAttribute('data-sidebar', state);
    var btn = $('[data-sidebar-toggle]');
    if (btn) {
      var collapsed = state === 'collapsed';
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.setAttribute('title', collapsed ? 'Expand the menu' : 'Collapse the menu');
    }
    /* in collapsed mode the label is hidden, so expose it as a tooltip */
    $$('.sidebar .nav-link').forEach(function (a) {
      if (state === 'collapsed') {
        if (!a.dataset.label) a.dataset.label = a.textContent.trim().replace(/\s+/g, ' ');
        a.setAttribute('title', a.dataset.label);
      } else {
        a.removeAttribute('title');
      }
    });
  }

  function applyFocus(on) {
    if (on) root.setAttribute('data-focus', '1');
    else    root.removeAttribute('data-focus');
    $$('[data-focus-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('title', on ? 'Leave full page (F)' : 'Full page (F)');
      var use = btn.querySelector('use');
      if (use) use.setAttribute('href', on ? '#i-minimize' : '#i-maximize');
    });
  }
  function setFocus(on) { applyFocus(on); store(FOCUS_KEY, on ? '1' : '0'); }

  function closeMenus(except) {
    $$('[data-menu]').forEach(function (m) {
      if (m === except) return;
      m.hidden = true;
      var btn = $('[data-menu-toggle-btn="' + m.getAttribute('data-menu') + '"]');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  /* ---------------------------------------------------------------- */
  /* DOCUMENT-LEVEL LISTENERS (installed once)                        */
  /* ---------------------------------------------------------------- */
  function installGlobal() {
    if (window.HH.__appGlobal) return;
    window.HH.__appGlobal = true;

    document.addEventListener('click', function (e) {
      var t = e.target;

      if (t.closest('[data-theme-toggle]')) { Theme.toggle(); return; }

      /* sidebar collapse */
      if (t.closest('[data-sidebar-toggle]')) {
        var next = root.getAttribute('data-sidebar') === 'collapsed' ? 'expanded' : 'collapsed';
        applySidebar(next);
        store(SIDEBAR_KEY, next);
        return;
      }

      /* mobile drawer */
      if (t.closest('[data-menu-toggle]')) {
        e.stopPropagation();
        var sb = $('.sidebar');
        var scrim = ensureScrim();
        if (sb) { sb.classList.toggle('open'); scrim.classList.toggle('show'); }
        return;
      }
      if (t.closest('.sidebar__scrim')) { closeDrawer(); return; }

      /* full page mode */
      if (t.closest('[data-focus-toggle], .focus-exit')) {
        setFocus(root.getAttribute('data-focus') !== '1');
        return;
      }

      /* header menus (notices, account) */
      var mb = t.closest('[data-menu-toggle-btn]');
      if (mb) {
        var name = mb.getAttribute('data-menu-toggle-btn');
        var menu = $('[data-menu="' + name + '"]');
        if (!menu) return;
        var opening = menu.hidden;
        closeMenus(opening ? menu : null);
        menu.hidden = !opening;
        mb.setAttribute('aria-expanded', String(opening));
        return;
      }
      if (t.closest('[data-menu]')) return;      /* a click inside an open menu must not close it */
      closeMenus(null);

      /* compact-screen search button */
      if (t.closest('[data-search-open]')) {
        var box = $('.topsearch');
        if (!box) return;
        box.classList.toggle('is-open');
        if (box.classList.contains('is-open')) $('.topsearch__input').focus();
        return;
      }

      /* confirm before destructive submit */
      var c = t.closest('[data-confirm]');
      if (c && !window.confirm(c.dataset.confirm)) { e.preventDefault(); e.stopPropagation(); return; }

      /* modals */
      var mo = t.closest('[data-modal-open]');
      if (mo) {
        var m = document.getElementById(mo.dataset.modalOpen);
        if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
        return;
      }
      var mc = t.closest('[data-modal-close]');
      if (mc) { closeModal(mc.closest('.modal-backdrop')); return; }
      if (t.classList && t.classList.contains('modal-backdrop')) { closeModal(t); return; }

      /* tabs */
      var tab = t.closest('[data-tabs] .tab');
      if (tab) {
        var group = tab.closest('[data-tabs]');
        $$('.tab', group).forEach(function (x) { x.classList.remove('active'); });
        tab.classList.add('active');
        $$('[data-tab-panel]').forEach(function (p) {
          if (p.dataset.tabPanel === tab.dataset.tab) p.removeAttribute('hidden');
          else p.setAttribute('hidden', '');
        });
        return;
      }

      /* demo credentials */
      var fill = t.closest('[data-fill]');
      if (fill) {
        var parts = fill.dataset.fill.split('|');
        var ef = $('#email'), pf = $('#password');
        if (ef) { setNativeValue(ef, parts[0]); }
        if (pf) { setNativeValue(pf, parts[1]); }
        toast('Demo credentials filled in', 'info');
        return;
      }

      /* back to top */
      if (t.closest('.to-top')) {
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        return;
      }

      /* smooth anchor scroll */
      var a = t.closest('a[href^="#"]');
      if (a) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }
      }
    });

    document.addEventListener('keydown', function (e) {
      var t = e.target;
      var typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;

      if (e.key === 'Escape') {
        closeDrawer();
        closeMenus(null);
        $$('.modal-backdrop.open').forEach(closeModal);
      }

      if (typing || e.ctrlKey || e.metaKey) return;

      /* the lesson reader owns Escape / F / "/" while it is open */
      if (root.classList.contains('reader-open')) return;

      if (e.key === '/' && !e.altKey) {
        var input = $('.topsearch__input');
        if (!input) return;
        e.preventDefault();
        $('.topsearch').classList.add('is-open');
        input.focus();
        return;
      }

      if (!e.altKey) {
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setFocus(root.getAttribute('data-focus') !== '1'); }
        if (e.key === 'Escape' && root.getAttribute('data-focus') === '1') { e.preventDefault(); setFocus(false); }
      }

      /* previous / next lesson: Alt + arrows */
      var pager = $('[data-pager]');
      if (pager && e.altKey) {
        var prev = pager.dataset.prev || '', next = pager.dataset.next || '';
        if (e.key === 'ArrowLeft'  && prev) { e.preventDefault(); location.href = prev; }
        if (e.key === 'ArrowRight' && next) { e.preventDefault(); location.href = next; }
      }
    });

    /* reading progress + back-to-top */
    function onScroll() {
      var h = root;
      var bar = $('.readbar__fill');
      var top = $('.to-top');
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      if (bar) bar.style.width = pct.toFixed(2) + '%';
      if (top) top.classList.toggle('show', h.scrollTop > 400);
      var header = $('.site-header');
      if (header) header.classList.toggle('scrolled', window.scrollY > 8);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.HH.__onScroll = onScroll;
  }

  /* React owns the value of controlled inputs; go through the native
     setter so both React and the form see the new value. */
  function setNativeValue(el, value) {
    var proto = Object.getPrototypeOf(el);
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function ensureScrim() {
    var scrim = $('.sidebar__scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.className = 'sidebar__scrim';
      document.body.appendChild(scrim);
    }
    return scrim;
  }
  function closeDrawer() {
    var sb = $('.sidebar'), scrim = $('.sidebar__scrim');
    if (sb) sb.classList.remove('open');
    if (scrim) scrim.classList.remove('show');
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ---------------------------------------------------------------- */
  /* PER-PAGE BINDINGS                                                */
  /* ---------------------------------------------------------------- */
  function initPage() {
    applySidebar(read(SIDEBAR_KEY) === 'collapsed' ? 'collapsed' : 'expanded');
    applyFocus(read(FOCUS_KEY) === '1');
    closeDrawer();
    if (window.HH.__onScroll) window.HH.__onScroll();

    /* reveal on scroll */
    var revealables = $$('.reveal').filter(function (el) { return bindOnce(el, 'Reveal'); });
    if (revealables.length) {
      if ('IntersectionObserver' in window && !reduced) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealables.forEach(function (el, i) {
          el.style.transitionDelay = Math.min(i % 8, 7) * 55 + 'ms';
          io.observe(el);
        });
      } else {
        revealables.forEach(function (el) { el.classList.add('in'); });
      }
    }

    /* animated progress bars */
    var bars = $$('.bar__fill[data-value]').filter(function (el) { return bindOnce(el, 'Bar'); });
    if ('IntersectionObserver' in window) {
      var bio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var v = Math.max(0, Math.min(100, parseFloat(en.target.dataset.value) || 0));
            en.target.style.width = v + '%';
            bio.unobserve(en.target);
          }
        });
      }, { threshold: 0.2 });
      bars.forEach(function (el) { bio.observe(el); });
    } else {
      bars.forEach(function (el) {
        var v = Math.max(0, Math.min(100, parseFloat(el.dataset.value) || 0));
        el.style.width = v + '%';
      });
    }

    /* progress rings */
    $$('.ring[data-value]').forEach(function (ring) {
      if (!bindOnce(ring, 'Ring')) return;
      var fg = $('.ring-fg', ring);
      if (!fg) return;
      var r = parseFloat(fg.getAttribute('r'));
      var c = 2 * Math.PI * r;
      var v = Math.max(0, Math.min(100, parseFloat(ring.dataset.value) || 0));
      fg.style.strokeDasharray = c;
      fg.style.strokeDashoffset = c;
      var run = function () { fg.style.strokeDashoffset = c - (c * v) / 100; };
      if ('IntersectionObserver' in window && !reduced) {
        var io = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { setTimeout(run, 120); io.disconnect(); }
        }, { threshold: 0.3 });
        io.observe(ring);
      } else { run(); }
    });

    /* count-up numbers */
    $$('[data-count]').forEach(function (el) {
      if (!bindOnce(el, 'Count')) return;
      var target = parseFloat(el.dataset.count) || 0;
      var suffix = el.dataset.suffix || '';
      if (reduced) { el.textContent = target + suffix; return; }
      var run = function () {
        var dur = 1100, start = performance.now();
        var step = function (now) {
          var p = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          if (p < 1) { el.textContent = Math.round(target * eased) + suffix; requestAnimationFrame(step); }
          else { el.textContent = target + suffix; }
        };
        requestAnimationFrame(step);
      };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { run(); io.disconnect(); }
        }, { threshold: 0.4 });
        io.observe(el);
      } else { run(); }
    });

    showFlashes();

    /* live table / list filter */
    $$('[data-filter]').forEach(function (inputEl) {
      if (!bindOnce(inputEl, 'Filter')) return;
      inputEl.addEventListener('input', function () {
        var targets = $$(inputEl.dataset.filter);
        var term = inputEl.value.trim().toLowerCase();
        targets.forEach(function (row) {
          var hit = !term || row.textContent.toLowerCase().indexOf(term) !== -1;
          row.style.display = hit ? '' : 'none';
        });
      });
    });

    /* file drop zones */
    $$('.file-drop').forEach(function (zone) {
      if (!bindOnce(zone, 'Drop')) return;
      var input = $('input[type=file]', zone) || document.getElementById(zone.dataset.for);
      if (!input) return;
      zone.addEventListener('click', function (e) { if (e.target !== input) input.click(); });
      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('drag'); });
      });
      zone.addEventListener('drop', function (e) {
        if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      input.addEventListener('change', function () {
        var label = $('[data-file-name]', zone);
        if (label) label.textContent = input.files.length ? input.files[0].name : 'No file chosen';
      });
    });

    /* quiz option highlighting */
    $$('.opt input').forEach(function (inp) {
      if (!bindOnce(inp, 'Opt')) return;
      var sync = function () {
        var wrap = inp.closest('.quiz-q') || document;
        if (inp.type === 'radio') $$('.opt', wrap).forEach(function (o) { o.classList.remove('selected'); });
        inp.closest('.opt').classList.toggle('selected', inp.checked);
      };
      inp.addEventListener('change', sync);
      if (inp.checked) sync();
    });

    /* quiz countdown timer */
    var timerEl = $('[data-countdown]');
    if (timerEl && bindOnce(timerEl, 'Timer')) {
      var left = parseInt(timerEl.dataset.countdown, 10) || 0;
      var tick = function () {
        if (!document.body.contains(timerEl)) return;      /* page changed */
        if (left <= 0) {
          timerEl.textContent = '00:00';
          var form = $('#quiz-form');
          if (form) { toast('Time is up — submitting your answers.', 'info'); form.dataset.forced = '1'; form.requestSubmit(); }
          return;
        }
        var m = String(Math.floor(left / 60)).padStart(2, '0');
        var s = String(left % 60).padStart(2, '0');
        timerEl.textContent = m + ':' + s;
        if (left <= 30) timerEl.style.color = 'var(--danger)';
        left--;
        setTimeout(tick, 1000);
      };
      tick();
    }

    /* unanswered-question guard */
    var quizForm = $('#quiz-form');
    if (quizForm && bindOnce(quizForm, 'Quiz')) {
      quizForm.addEventListener('submit', function (e) {
        if (this.dataset.forced === '1') return;
        var groups = $$('.quiz-q', this);
        var missing = groups.filter(function (g) { return !$$('input:checked', g).length; });
        if (missing.length) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (window.confirm(missing.length + ' question(s) are unanswered. Submit anyway?')) {
            this.dataset.forced = '1';
            this.requestSubmit();
          } else {
            missing[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            missing[0].animate(
              [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' },
               { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
              { duration: 320 });
          }
        }
      }, true);
    }

    /* lesson video: remember position + auto in-progress */
    var vid = $('#lesson-video');
    if (vid && vid.tagName === 'VIDEO' && bindOnce(vid, 'Video')) {
      var key = 'lesson-pos-' + (vid.dataset.lessonId || '0');
      try {
        var savedPos = parseFloat(localStorage.getItem(key));
        if (savedPos > 5 && savedPos < (vid.duration || 1e9)) {
          vid.addEventListener('loadedmetadata', function () { vid.currentTime = savedPos; }, { once: true });
        }
      } catch (e) {}
      var last = 0;
      vid.addEventListener('timeupdate', function () {
        if (vid.currentTime - last > 5) {
          last = vid.currentTime;
          try { localStorage.setItem(key, String(vid.currentTime)); } catch (e) {}
        }
      });
      vid.addEventListener('ended', function () {
        var btn = $('#btn-complete');
        if (btn) {
          toast('Video finished — you can mark this lesson as completed.', 'success');
          btn.classList.add('is-ready');
          btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
            { duration: 600, iterations: 2 });
        }
      });
      /* surface a genuinely broken video instead of a silent black box */
      var errBox = document.getElementById('video-error');
      if (errBox) {
        vid.addEventListener('error', function () { if (vid.error) errBox.hidden = false; });
        ['loadedmetadata', 'loadeddata', 'canplay', 'playing'].forEach(function (ev) {
          vid.addEventListener(ev, function () { errBox.hidden = true; });
        });
      }
    }

    /* celebrate lesson completion (?done=1) */
    if (new URLSearchParams(location.search).get('done') === '1' && !window.HH.__doneFor) {
      window.HH.__doneFor = location.href;
      confetti(90);
    } else if (new URLSearchParams(location.search).get('done') !== '1') {
      window.HH.__doneFor = null;
    }

    /* celebrate a passed quiz */
    var party = $('[data-confetti]');
    if (party && bindOnce(party, 'Confetti')) {
      setTimeout(function () { confetti(parseInt(party.dataset.confetti, 10) || 90); }, 300);
    }

    /* auto-submit filter selects */
    $$('[data-autosubmit]').forEach(function (sel) {
      if (!bindOnce(sel, 'Auto')) return;
      sel.addEventListener('change', function () { sel.form && sel.form.requestSubmit(); });
    });

    /* keep the current lesson visible in the sidebar list */
    var cur = $('.lesson-list--scroll .lesson-item.is-current, .lesson-list--scroll .lesson-nav__item.is-current');
    if (cur) {
      var box = cur.closest('.lesson-list--scroll');
      if (box) box.scrollTop = cur.offsetTop - box.clientHeight / 2 + cur.clientHeight / 2;
    }
  }

  window.HH.initApp = function () {
    Theme.init();
    installGlobal();
    initPage();
  };
  window.HH.toast = toast;
  window.HH.confetti = confetti;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.HH.initApp);
  } else {
    window.HH.initApp();
  }
})();

/* =====================================================================
   PASHTO SUBTITLES + SYNCHRONISED TRANSCRIPT

   Two jobs:
   1. <video> — the browser shows our WebVTT track natively. We only style
      it and keep the transcript panel in step.
   2. YouTube / Vimeo / Drive iframes — a third-party player will NOT accept
      a caption track from us. Instead we render our own Pashto caption
      overlay + transcript, driven by the YouTube IFrame API where it is
      available, and by a manual play/pause clock elsewhere.

   Markup produced by app/student/lesson/[id]/page.tsx:
     <div id="subs" data-subs
          data-vtt="/api/subtitle?lesson=3&lang=ps"
          data-kind="video|iframe"
          data-ytid="dQw4w9WgXcQ">
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------- WebVTT parser ------------------------- */
  function parseVtt(text) {
    var cues = [];
    var blocks = text.replace(/\r\n|\r/g, '\n').split(/\n\n+/);
    var stamp = /(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{1,2}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

    function secs(h, m, s, ms) {
      return (parseInt(h || '0', 10) * 3600) + (parseInt(m, 10) * 60) +
             parseInt(s, 10) + (parseInt(ms, 10) / (ms.length === 2 ? 100 : 1000));
    }

    blocks.forEach(function (b) {
      var lines = b.split('\n').filter(function (l) { return l.trim() !== ''; });
      if (!lines.length) return;
      var i = 0;
      if (/^WEBVTT/i.test(lines[0])) return;
      if (!stamp.test(lines[0]) && lines[1] && stamp.test(lines[1])) i = 1;  // cue identifier line
      var m = lines[i] && lines[i].match(stamp);
      if (!m) return;
      var start = secs((m[1] || '').replace(':', ''), m[2], m[3], m[4]);
      var end   = secs((m[5] || '').replace(':', ''), m[6], m[7], m[8]);
      var txt   = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim();
      if (txt) cues.push({ start: start, end: end, text: txt });
    });
    return cues;
  }

  function fmt(t) {
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* --------------------------- main ------------------------------- */
  function init(box) {
    var vttUrl = box.dataset.vtt;
    var kind   = box.dataset.kind;
    var ytId   = box.dataset.ytid || '';
    var list   = box.querySelector('[data-cues]');
    var overlay = document.getElementById('sub-overlay');
    var toggle = box.querySelector('[data-sub-toggle]');
    var follow = box.querySelector('[data-sub-follow]');
    var cues = [], active = -1, autoScroll = true;

    fetch(vttUrl, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        cues = parseVtt(t || '');
        if (!cues.length) { box.hidden = true; return; }
        render();
        attachClock();
      })
      .catch(function () { box.hidden = true; });

    function render() {
      list.innerHTML = cues.map(function (c, i) {
        return '<button type="button" class="cue" data-i="' + i + '" dir="rtl">' +
               '<span class="cue__t">' + fmt(c.start) + '</span>' +
               '<span class="cue__x">' + c.text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>' +
               '</button>';
      }).join('');
      var cnt = box.querySelector('[data-cue-count]');
      if (cnt) cnt.textContent = cues.length;
    }

    function highlight(t) {
      var i = -1;
      for (var k = 0; k < cues.length; k++) {
        if (t >= cues[k].start && t < cues[k].end) { i = k; break; }
      }
      if (i === active) return;
      active = i;

      Array.prototype.forEach.call(list.children, function (el, k) {
        el.classList.toggle('is-active', k === i);
      });

      if (overlay) {
        if (i >= 0 && overlay.dataset.on === '1') {
          overlay.textContent = cues[i].text;
          overlay.hidden = false;
        } else {
          overlay.hidden = true;
        }
      }
      if (i >= 0 && autoScroll && list.children[i]) {
        var el = list.children[i];
        list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
      }
    }

    /* jump the player when a transcript line is clicked */
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.cue');
      if (!b) return;
      var t = cues[+b.dataset.i].start;
      if (window.__ytPlayer && window.__ytPlayer.seekTo) {
        window.__ytPlayer.seekTo(t, true);
        window.__ytPlayer.playVideo();
      } else {
        var v = document.getElementById('lesson-video');
        if (v) { v.currentTime = t; v.play().catch(function () {}); }
      }
    });

    if (toggle) {
      toggle.addEventListener('click', function () {
        var on = overlay.dataset.on === '1';
        overlay.dataset.on = on ? '0' : '1';
        toggle.classList.toggle('is-active', !on);
        toggle.setAttribute('aria-pressed', String(!on));
        if (on) overlay.hidden = true; else active = -2;   // force a repaint
      });
    }
    if (follow) {
      follow.addEventListener('click', function () {
        autoScroll = !autoScroll;
        follow.classList.toggle('is-active', autoScroll);
      });
    }

    /* ------------------ drive the highlighting ------------------ */
    function attachClock() {
      var v = document.getElementById('lesson-video');
      if (kind === 'video' && v) {
        v.addEventListener('timeupdate', function () { highlight(v.currentTime); });
        return;
      }
      if (ytId) {
        loadYouTubeApi(function () {
          window.__ytPlayer = new window.YT.Player('yt-player', {
            events: {
              onReady: function () {
                var iv = setInterval(function () {
                  if (!document.body.contains(box)) { clearInterval(iv); window.__ytPlayer = null; return; }
                  if (window.__ytPlayer && window.__ytPlayer.getCurrentTime) {
                    highlight(window.__ytPlayer.getCurrentTime());
                  }
                }, 300);
              }
            }
          });
        });
      }
    }

    function loadYouTubeApi(cb) {
      if (window.YT && window.YT.Player) { cb(); return; }
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') prev();
        cb();
      };
      if (!document.getElementById('yt-api')) {
        var s = document.createElement('script');
        s.id = 'yt-api';
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
    }
  }

  window.HH = window.HH || {};
  window.HH.initSubs = function () {
    document.querySelectorAll('[data-subs]').forEach(function (box) {
      if (box.dataset.hhBuilt) return;
      box.dataset.hhBuilt = '1';
      init(box);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.HH.initSubs);
  else window.HH.initSubs();
})();

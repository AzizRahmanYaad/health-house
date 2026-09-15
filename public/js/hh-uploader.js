/* =====================================================================
   CHUNKED FILE UPLOADER
   Sends a file to /api/upload in small pieces, so large videos
   are never blocked by post_max_size / upload_max_filesize / timeouts.

   Markup (see components/Uploader.tsx):
     <div class="uploader" data-uploader
          data-endpoint="/api/upload"
          data-kind="videos"
          data-token="csrf"
          data-target="#video_file_hidden"
          data-name-out="#video_file_name">
       <input type="file" hidden>
       …drop zone…
     </div>
   ===================================================================== */
(function () {
  'use strict';

  var CHUNK = 1024 * 1024 * 2;   // 2 MB — safely under every shared-host limit

  function hex(n) {
    var a = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function human(b) {
    if (!b) return '0 B';
    var u = ['B', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(b) / Math.log(1024));
    i = Math.min(i, u.length - 1);
    return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  }

  function init(box) {
    var input   = box.querySelector('input[type=file]');
    var zone    = box.querySelector('[data-drop]');
    var bar     = box.querySelector('[data-bar]');
    var fill    = box.querySelector('[data-fill]');
    var status  = box.querySelector('[data-status]');
    var preview = box.querySelector('[data-preview]');
    var cancelB = box.querySelector('[data-cancel]');
    var target  = document.querySelector(box.dataset.target);
    var nameOut = box.dataset.nameOut ? document.querySelector(box.dataset.nameOut) : null;

    var xhr = null, aborted = false;

    function say(msg, tone) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'uploader__status' + (tone ? ' is-' + tone : '');
    }

    function progress(p) {
      if (bar) bar.hidden = false;
      if (fill) fill.style.width = Math.max(0, Math.min(100, p)).toFixed(1) + '%';
    }

    function reset() {
      if (bar) bar.hidden = true;
      if (fill) fill.style.width = '0%';
      if (cancelB) cancelB.hidden = true;
      xhr = null;
    }

    function send(file) {
      if (!file) return;
      aborted = false;

      var id = hex(16);
      var total = Math.max(1, Math.ceil(file.size / CHUNK));
      var index = 0;
      var started = Date.now();

      if (cancelB) cancelB.hidden = false;
      say('Preparing “' + file.name + '” (' + human(file.size) + ')…');
      progress(0);

      function step() {
        if (aborted) return;

        var start = index * CHUNK;
        var blob  = file.slice(start, Math.min(start + CHUNK, file.size));

        var fd = new FormData();
        fd.append('_token', box.dataset.token);
        fd.append('kind',   box.dataset.kind || 'videos');
        fd.append('id',     id);
        fd.append('index',  String(index));
        fd.append('total',  String(total));
        fd.append('name',   file.name);
        fd.append('upload', blob, 'chunk');

        xhr = new XMLHttpRequest();
        xhr.open('POST', box.dataset.endpoint, true);
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

        xhr.upload.onprogress = function (e) {
          if (!e.lengthComputable) return;
          var done = start + e.loaded;
          progress((done / file.size) * 100);
          var secs = (Date.now() - started) / 1000;
          var rate = secs > 0.5 ? human(done / secs) + '/s' : '';
          say('Uploading… ' + human(done) + ' of ' + human(file.size) + (rate ? ' · ' + rate : ''));
        };

        xhr.onload = function () {
          var res;
          try { res = JSON.parse(xhr.responseText); }
          catch (e) {
            say('Server replied unexpectedly (HTTP ' + xhr.status + '). ' +
                'Check that /api/upload is reachable.', 'error');
            reset();
            return;
          }
          if (!res.ok) {
            say(res.error || 'Upload failed.', 'error');
            reset();
            return;
          }
          if (res.done) {
            progress(100);
            say('Uploaded ✓ ' + file.name + ' (' + (res.size_text || human(file.size)) + ')', 'ok');
            if (target) {
              var d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value');
              if (d && d.set) d.set.call(target, res.file); else target.value = res.file;
              target.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (nameOut) nameOut.textContent = file.name;
            if (preview) {
              preview.hidden = false;
              preview.innerHTML =
                '<video controls preload="metadata" playsinline src="' + res.url +
                '" style="width:100%;border-radius:14px;background:#000"></video>';
            }
            /* switch the source selector to "uploaded file" automatically */
            var sel = document.getElementById('video_source');
            if (sel && sel.value !== 'file') {
              sel.value = 'file';
              sel.dispatchEvent(new Event('change'));
            }
            if (window.toast) window.toast('Video uploaded — remember to save the lesson.', 'success');
            reset();
            return;
          }
          index++;
          step();
        };

        xhr.onerror = function () {
          say('Network error during upload. Check your connection and try again.', 'error');
          reset();
        };

        xhr.send(fd);
      }

      step();
    }

    /* ---- wiring ---- */
    if (zone) {
      zone.addEventListener('click', function () { input.click(); });
      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('drag'); });
      });
      zone.addEventListener('drop', function (e) {
        if (e.dataTransfer.files.length) send(e.dataTransfer.files[0]);
      });
    }
    input.addEventListener('change', function () {
      if (input.files.length) send(input.files[0]);
    });
    if (cancelB) {
      cancelB.addEventListener('click', function () {
        aborted = true;
        if (xhr) xhr.abort();
        say('Upload cancelled.', 'error');
        reset();
      });
    }
  }

  window.HH = window.HH || {};
  window.HH.initUploader = function () {
    document.querySelectorAll('[data-uploader]').forEach(function (box) {
      if (box.dataset.hhBuilt) return;
      box.dataset.hhBuilt = '1';
      init(box);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.HH.initUploader);
  else window.HH.initUploader();
})();

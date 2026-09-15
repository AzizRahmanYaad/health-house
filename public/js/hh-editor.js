/* =====================================================================
   LIGHTWEIGHT RICH TEXT EDITOR  (ported from assets/js/editor.js)
   No dependencies. Works offline. Full LTR + RTL (Pashto / Dari / Arabic).

   Markup produced by <RichEditor> in components/RichEditor.tsx:
     <div class="rte" data-rte data-toolbar="full|mini">
       <div class="rte__bar"></div>
       <div class="rte__area" contenteditable></div>
       <textarea class="rte__src" name="..." hidden></textarea>
     </div>
   ===================================================================== */
(function () {
  'use strict';

  var SVG = {
    undo:   'M3 7v6h6M3.5 12a8 8 0 1 1 2.6 6',
    redo:   'M21 7v6h-6M20.5 12a8 8 0 1 0-2.6 6',
    bold:   'M7 4h6.5a4 4 0 0 1 0 8H7zM7 12h7.5a4 4 0 0 1 0 8H7z',
    italic: 'M19 4h-9M14 20H5M15 4 9 20',
    under:  'M7 4v7a5 5 0 0 0 10 0V4M5 21h14',
    strike: 'M5 12h14M16 7c-.6-1.9-2.3-3-4.5-3C9 4 7.4 5.3 7.4 7.2c0 1.5 1 2.4 2.6 3M8 17c.7 1.9 2.4 3 4.7 3 2.6 0 4.2-1.4 4.2-3.3 0-.9-.3-1.6-.9-2.2',
    ul:     'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
    ol:     'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2v2H4v2h2',
    alignL: 'M3 6h18M3 12h12M3 18h15',
    alignC: 'M3 6h18M6 12h12M5 18h14',
    alignR: 'M3 6h18M9 12h12M6 18h15',
    alignJ: 'M3 6h18M3 12h18M3 18h18',
    indent: 'M11 6h10M11 12h10M11 18h10M3 8l3 4-3 4z',
    outdent:'M11 6h10M11 12h10M11 18h10M6 8l-3 4 3 4z',
    link:   'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12.2 19',
    unlink: 'M17 7l3-3M4 4l16 16M10 13a5 5 0 0 0 6 .8M14 11a5 5 0 0 0-6-.8l-3.4 3.4a5 5 0 0 0 7 7L13 19',
    quote:  'M7 7h4v5a4 4 0 0 1-4 4M15 7h4v5a4 4 0 0 1-4 4',
    code:   'm9 8-5 4 5 4M15 8l5 4-5 4',
    hr:     'M3 12h18M6 7h12M6 17h12',
    clear:  'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11l4 6M14 11l-4 6',
    rtl:    'M9 4h9M9 9h9M4 14h14M4 19h14M20 12l-3 3 3 3',
    ltr:    'M6 4h9M6 9h9M6 14h14M6 19h14M4 12l3 3-3 3',
    src:    'm8 8-4 4 4 4M16 8l4 4-4 4',
    full:   'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    image:  'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9.5h.01'
  };

  function ico(d) {
    return '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
           'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  }

  function btn(cmd, title, iconPath, extra) {
    return '<button type="button" class="rte__btn" data-cmd="' + cmd + '" title="' + title +
           '" aria-label="' + title + '"' + (extra || '') + '>' + ico(iconPath) + '</button>';
  }

  var SEP = '<span class="rte__sep"></span>';

  /* ---------------- allowed markup when pasting ---------------- */
  var PASTE_TAGS = ['P','BR','DIV','SPAN','H1','H2','H3','H4','H5','H6','STRONG','B','EM','I','U','S',
                    'STRIKE','DEL','INS','MARK','SMALL','SUB','SUP','UL','OL','LI','BLOCKQUOTE','PRE',
                    'CODE','A','HR','TABLE','THEAD','TBODY','TR','TH','TD','FIGURE','FIGCAPTION','IMG'];
  var PASTE_ATTRS = ['href','title','dir','colspan','rowspan','src','alt'];

  function cleanPasted(html) {
    var doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    var root = doc.getElementById('r');
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 1) {
          if (PASTE_TAGS.indexOf(c.tagName) === -1) {
            var drop = ['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','LINK','META','NOSCRIPT'];
            if (drop.indexOf(c.tagName) === -1) {
              while (c.firstChild) node.insertBefore(c.firstChild, c);
            }
            node.removeChild(c);
            return;
          }
          Array.prototype.slice.call(c.attributes).forEach(function (a) {
            if (PASTE_ATTRS.indexOf(a.name.toLowerCase()) === -1) c.removeAttribute(a.name);
          });
          walk(c);
        } else if (c.nodeType === 8) {
          node.removeChild(c);
        }
      });
    })(root);
    return root.innerHTML;
  }

  /* ---------------- build one editor ---------------- */
  function build(wrap) {
    var area = wrap.querySelector('.rte__area');
    var src  = wrap.querySelector('.rte__src');
    var bar  = wrap.querySelector('.rte__bar');
    var mini = wrap.dataset.toolbar === 'mini';

    /* --- toolbar --- */
    var html = '';
    html += '<div class="rte__grp">' + btn('undo', 'Undo (Ctrl+Z)', SVG.undo) + btn('redo', 'Redo (Ctrl+Y)', SVG.redo) + '</div>';

    if (!mini) {
      html += SEP + '<div class="rte__grp">' +
        '<select class="rte__select" data-cmd="formatBlock" title="Paragraph style">' +
          '<option value="p">Paragraph</option>' +
          '<option value="h2">Heading 1</option>' +
          '<option value="h3">Heading 2</option>' +
          '<option value="h4">Heading 3</option>' +
          '<option value="blockquote">Quote</option>' +
          '<option value="pre">Code block</option>' +
        '</select>' +
        '<select class="rte__select rte__select--sm" data-cmd="fontSize" title="Text size">' +
          '<option value="">Size</option>' +
          '<option value="1">Very small</option>' +
          '<option value="2">Small</option>' +
          '<option value="3">Normal</option>' +
          '<option value="5">Large</option>' +
          '<option value="6">Very large</option>' +
        '</select>' +
      '</div>';
    }

    html += SEP + '<div class="rte__grp">' +
      btn('bold', 'Bold (Ctrl+B)', SVG.bold) +
      btn('italic', 'Italic (Ctrl+I)', SVG.italic) +
      btn('underline', 'Underline (Ctrl+U)', SVG.under) +
      (mini ? '' : btn('strikeThrough', 'Strikethrough', SVG.strike)) +
    '</div>';

    if (!mini) {
      html += SEP + '<div class="rte__grp">' +
        '<label class="rte__color" title="Text colour"><span style="background:currentColor"></span>' +
          '<input type="color" data-cmd="foreColor" value="#14172b"></label>' +
        '<label class="rte__color rte__color--hl" title="Highlight"><span style="background:#FDE68A"></span>' +
          '<input type="color" data-cmd="hiliteColor" value="#fde68a"></label>' +
      '</div>';

      html += SEP + '<div class="rte__grp">' +
        btn('insertUnorderedList', 'Bulleted list', SVG.ul) +
        btn('insertOrderedList', 'Numbered list', SVG.ol) +
        btn('outdent', 'Decrease indent', SVG.outdent) +
        btn('indent', 'Increase indent', SVG.indent) +
      '</div>';

      html += SEP + '<div class="rte__grp">' +
        btn('justifyLeft', 'Align left', SVG.alignL) +
        btn('justifyCenter', 'Align centre', SVG.alignC) +
        btn('justifyRight', 'Align right', SVG.alignR) +
        btn('justifyFull', 'Justify', SVG.alignJ) +
      '</div>';
    }

    html += SEP + '<div class="rte__grp">' +
      btn('dirRtl', 'Right-to-left paragraph (Pashto / Dari)', SVG.rtl) +
      btn('dirLtr', 'Left-to-right paragraph', SVG.ltr) +
    '</div>';

    html += SEP + '<div class="rte__grp">' +
      btn('createLink', 'Insert link', SVG.link) +
      btn('unlink', 'Remove link', SVG.unlink) +
      (mini ? '' : btn('insertHorizontalRule', 'Horizontal line', SVG.hr) +
                   btn('removeFormat', 'Clear formatting', SVG.clear)) +
    '</div>';

    if (!mini) {
      html += '<div class="rte__grp rte__grp--end">' +
        btn('source', 'Edit HTML source', SVG.src) +
        btn('fullscreen', 'Full screen', SVG.full) +
      '</div>';
    }
    bar.innerHTML = html;

    /* --- initial content --- */
    area.innerHTML = src.value.trim() || '<p><br></p>';
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}

    var sync = function () { src.value = area.innerHTML; };
    area.addEventListener('input', sync);
    area.addEventListener('blur', sync);

    /* --- keep the selection when the toolbar steals focus --- */
    var saved = null;
    var save = function () {
      var s = window.getSelection();
      if (s && s.rangeCount && area.contains(s.anchorNode)) saved = s.getRangeAt(0);
    };
    area.addEventListener('keyup', save);
    area.addEventListener('mouseup', save);
    document.addEventListener('selectionchange', function () {
      if (document.activeElement === area) save();
    });
    var restore = function () {
      area.focus();
      if (saved) {
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(saved);
      }
    };

    /* --- find the block element holding the caret --- */
    function currentBlock() {
      var n = window.getSelection().anchorNode;
      if (!n || !area.contains(n)) return null;
      if (n.nodeType === 3) n = n.parentNode;
      while (n && n !== area && !/^(P|DIV|H1|H2|H3|H4|H5|H6|LI|BLOCKQUOTE|PRE|TD|TH)$/.test(n.tagName)) {
        n = n.parentNode;
      }
      return (n && n !== area) ? n : null;
    }

    function setDir(dir) {
      restore();
      var b = currentBlock();
      if (b) {
        b.setAttribute('dir', dir);
        b.style.textAlign = (dir === 'rtl') ? 'right' : 'left';
      } else {
        area.setAttribute('dir', dir);
      }
      sync();
      refresh();
    }

    /* --- run a command --- */
    function run(cmd, value) {
      if (cmd === 'dirRtl') return setDir('rtl');
      if (cmd === 'dirLtr') return setDir('ltr');

      if (cmd === 'source') {
        var on = wrap.classList.toggle('is-source');
        if (on) {
          sync();
          src.hidden = false;
          src.classList.add('rte__src--visible');
          src.style.height = Math.max(area.offsetHeight, 240) + 'px';
          area.style.display = 'none';
        } else {
          area.innerHTML = src.value.trim() || '<p><br></p>';
          src.hidden = true;
          src.classList.remove('rte__src--visible');
          area.style.display = '';
        }
        return;
      }
      if (cmd === 'fullscreen') {
        wrap.classList.toggle('is-full');
        document.body.style.overflow = wrap.classList.contains('is-full') ? 'hidden' : '';
        return;
      }
      if (cmd === 'createLink') {
        restore();
        var url = window.prompt('Link address', 'https://');
        if (!url) return;
        if (!/^(https?:|mailto:|\/)/i.test(url)) url = 'https://' + url;
        document.execCommand('createLink', false, url);
        var a = currentBlock() && window.getSelection().anchorNode;
        sync(); refresh();
        return;
      }
      if (cmd === 'formatBlock') {
        restore();
        document.execCommand('formatBlock', false, '<' + value + '>');
        sync(); refresh();
        return;
      }

      restore();
      /* CSS styling is only wanted for colour/size; bold & friends should stay
         semantic (<b>, <i>, <u>) so the markup is meaningful and lighter. */
      try {
        document.execCommand('styleWithCSS', false,
          ['foreColor', 'hiliteColor', 'fontSize'].indexOf(cmd) !== -1);
      } catch (e) {}
      document.execCommand(cmd, false, value);
      sync();
      refresh();
    }

    /* --- toolbar wiring --- */
    bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.rte__btn');
      if (b) run(b.dataset.cmd);
    });
    bar.addEventListener('change', function (e) {
      var el = e.target;
      if (el.classList.contains('rte__select')) {
        if (el.value) run(el.dataset.cmd, el.value);
        if (el.dataset.cmd === 'fontSize') el.value = '';
      } else if (el.type === 'color') {
        run(el.dataset.cmd, el.value);
        var dot = el.previousElementSibling;
        if (dot) dot.style.background = el.value;
      }
    });

    /* --- active-state highlighting --- */
    function refresh() {
      ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList',
       'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].forEach(function (c) {
        var b = bar.querySelector('[data-cmd="' + c + '"]');
        if (!b) return;
        var on = false;
        try { on = document.queryCommandState(c); } catch (e) {}
        b.classList.toggle('is-active', on);
      });
      var blk = currentBlock();
      var dir = blk ? (blk.getAttribute('dir') || '') : (area.getAttribute('dir') || '');
      var r = bar.querySelector('[data-cmd="dirRtl"]'), l = bar.querySelector('[data-cmd="dirLtr"]');
      if (r) r.classList.toggle('is-active', dir === 'rtl');
      if (l) l.classList.toggle('is-active', dir === 'ltr');
    }
    area.addEventListener('keyup', refresh);
    area.addEventListener('mouseup', refresh);

    /* --- clean paste --- */
    area.addEventListener('paste', function (e) {
      var dt = e.clipboardData;
      if (!dt) return;
      e.preventDefault();
      var html = dt.getData('text/html');
      if (html) {
        document.execCommand('insertHTML', false, cleanPasted(html));
      } else {
        var text = dt.getData('text/plain') || '';
        document.execCommand('insertText', false, text);
      }
      sync();
    });

    /* --- Escape leaves full screen --- */
    document.addEventListener('keydown', function (e) {
      if (!document.body.contains(wrap)) return;
      if (e.key === 'Escape' && wrap.classList.contains('is-full')) {
        wrap.classList.remove('is-full');
        document.body.style.overflow = '';
      }
    });

    /* --- always sync before the form is submitted --- */
    var form = wrap.closest('form');
    if (form) {
      form.addEventListener('submit', function () {
        if (!wrap.classList.contains('is-source')) sync();
      });
    }

    /* --- character counter --- */
    var counter = wrap.querySelector('[data-rte-count]');
    if (counter) {
      var count = function () {
        counter.textContent = (area.innerText || '').replace(/\s+/g, ' ').trim().length + ' characters';
      };
      area.addEventListener('input', count);
      count();
    }

    refresh();
  }

  window.HH = window.HH || {};
  window.HH.initEditor = function () {
    document.querySelectorAll('[data-rte]').forEach(function (wrap) {
      if (wrap.dataset.hhBuilt) return;
      wrap.dataset.hhBuilt = '1';
      build(wrap);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.HH.initEditor);
  else window.HH.initEditor();
})();

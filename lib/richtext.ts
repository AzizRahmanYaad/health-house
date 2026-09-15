/**
 * RICH TEXT — whitelist-sanitise admin-authored HTML so formatting survives
 * but scripts cannot. Same allow-lists as sanitizeRichText() in the PHP portal.
 */
import 'server-only';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = ['p','br','div','span','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s',
  'strike','del','ins','mark','small','sub','sup','ul','ol','li','blockquote','pre',
  'code','a','hr','table','thead','tbody','tfoot','tr','th','td','figure','figcaption','img'];

const ALLOWED_ATTRS = ['href','title','target','rel','dir','style','align','colspan','rowspan','src','alt','width','height','class'];

const ALLOWED_CSS = ['color', 'background-color', 'font-size', 'font-weight', 'font-style', 'font-family',
  'text-align', 'text-decoration', 'direction', 'line-height', 'margin-left', 'padding-left'];

function sanitizeStyle(style: string): string {
  const keep: string[] = [];
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i === -1) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val  = decl.slice(i + 1).trim();
    if (!ALLOWED_CSS.includes(prop)) continue;
    if (/(expression|javascript:|url\s*\(|@import|behaviou?r)/i.test(val)) continue;
    keep.push(prop + ':' + val);
  }
  return keep.join(';');
}

export function sanitizeRichText(html: string | null | undefined): string {
  const src = String(html ?? '').trim();
  if (src === '') return '';

  return sanitizeHtml(src, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { '*': ALLOWED_ATTRS },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: true,
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    /* keep readable text of dropped tags, but not of script-ish ones */
    nonTextTags: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link', 'meta', 'base', 'noscript', 'textarea', 'option'],
    parseStyleAttributes: false,
    transformTags: {
      '*': (tagName, attribs) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(attribs)) {
          const name = k.toLowerCase();
          if (name.startsWith('on')) continue;
          if (name === 'style') {
            const clean = sanitizeStyle(v);
            if (clean) out.style = clean;
            continue;
          }
          out[name] = v;
        }
        if (tagName === 'a' && out.href) out.rel = 'noopener noreferrer';
        if (tagName === 'img' && out.src) {
          const ok = /^(https?:)?\/\//i.test(out.src) || /^\//.test(out.src) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(out.src);
          if (!ok) delete out.src;
        }
        return { tagName, attribs: out };
      },
    },
  }).trim();
}

export const EXAM_TEXT_COLORS = [
  { label: 'Đen', value: '#000000' },
  { label: 'Navy Việt Mỹ', value: '#1A365D' },
  { label: 'Đỏ Việt Mỹ', value: '#C8102E' },
  { label: 'Xanh dương', value: '#1D4ED8' },
  { label: 'Xanh lá', value: '#047857' },
  { label: 'Cam đậm', value: '#C2410C' },
  { label: 'Tím', value: '#6D28D9' },
  { label: 'Xám đậm', value: '#475569' },
] as const;

export const EXAM_HIGHLIGHT_COLORS = [
  { label: 'Không nền', value: 'transparent' },
  { label: 'Vàng nhạt', value: '#FEF08A' },
  { label: 'Xanh lá nhạt', value: '#BBF7D0' },
  { label: 'Xanh dương nhạt', value: '#BFDBFE' },
  { label: 'Hồng nhạt', value: '#FECDD3' },
  { label: 'Cam nhạt', value: '#FED7AA' },
] as const;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>');
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    try {
      const normalized = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li)>/gi, '\n');
      const doc = new DOMParser().parseFromString(normalized, 'text/html');
      return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
    } catch {
      // Fallback regex bên dưới
    }
  }
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

const ALLOWED_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'sub',
  'sup',
  'br',
  'span',
  'div',
  'p',
  'font',
]);

const SAFE_COLOR_RE =
  /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)|transparent|[a-z]{3,20})$/i;
const SAFE_SIZE_RE = /^(\d{1,2}(\.\d+)?(px|pt|em|rem|%)|small|medium|large|x-large)$/i;
const SAFE_ALIGN_RE = /^(left|center|right|justify)$/i;

function sanitizeStyleString(rawStyle: string): string {
  const safeParts: string[] = [];
  const declarations = rawStyle.split(';');

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!val || /url\(|expression\(|javascript:/i.test(val)) continue;

    if ((prop === 'color' || prop === 'background-color') && SAFE_COLOR_RE.test(val)) {
      safeParts.push(`${prop}:${val}`);
    } else if (prop === 'font-weight' && /^(normal|bold|[1-9]00)$/.test(val)) {
      safeParts.push(`font-weight:${val}`);
    } else if (prop === 'font-style' && /^(normal|italic)$/.test(val)) {
      safeParts.push(`font-style:${val}`);
    } else if (
      prop === 'text-decoration' &&
      /^(none|underline|line-through|underline line-through)$/.test(val)
    ) {
      safeParts.push(`text-decoration:${val}`);
    } else if (prop === 'font-size' && SAFE_SIZE_RE.test(val)) {
      safeParts.push(`font-size:${val}`);
    } else if (prop === 'text-align' && SAFE_ALIGN_RE.test(val)) {
      safeParts.push(`text-align:${val}`);
    }
  }

  return safeParts.join(';');
}

function sanitizeNode(node: Node, outDoc: Document): Node | null {
  if (node.nodeType === 3) {
    return outDoc.createTextNode(node.textContent ?? '');
  }
  if (node.nodeType !== 1) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (
    tag === 'script' ||
    tag === 'style' ||
    tag === 'iframe' ||
    tag === 'object' ||
    tag === 'embed'
  ) {
    return null;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const frag = outDoc.createDocumentFragment();
    Array.from(el.childNodes).forEach((child) => {
      const cleanChild = sanitizeNode(child, outDoc);
      if (cleanChild) frag.appendChild(cleanChild);
    });
    return frag;
  }

  const outTag = tag === 'font' ? 'span' : tag;
  const outEl = outDoc.createElement(outTag);

  const rawStyleParts: string[] = [];
  const styleAttr = el.getAttribute('style');
  if (styleAttr) {
    const cleanStyle = sanitizeStyleString(styleAttr);
    if (cleanStyle) rawStyleParts.push(cleanStyle);
  }
  if (tag === 'font') {
    const fontColor = el.getAttribute('color')?.trim();
    if (fontColor && SAFE_COLOR_RE.test(fontColor)) {
      rawStyleParts.push(`color:${fontColor}`);
    }
  }

  if (rawStyleParts.length > 0) {
    outEl.setAttribute('style', rawStyleParts.join(';'));
  }

  Array.from(el.childNodes).forEach((child) => {
    const cleanChild = sanitizeNode(child, outDoc);
    if (cleanChild) outEl.appendChild(cleanChild);
  });

  return outEl;
}

/**
 * Làm sạch HTML rich text từ trình soạn thảo nội tuyến, chỉ giữ các thẻ định dạng văn bản an toàn.
 */
export function sanitizeExamHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  if (typeof DOMParser !== 'undefined' && typeof document !== 'undefined') {
    try {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(`<div>${rawHtml}</div>`, 'text/html');
      const sourceRoot = parsed.body.firstElementChild;
      if (!sourceRoot) return '';

      const outDoc = document.implementation.createHTMLDocument('');
      const container = outDoc.createElement('div');
      Array.from(sourceRoot.childNodes).forEach((child) => {
        const clean = sanitizeNode(child, outDoc);
        if (clean) container.appendChild(clean);
      });
      return container.innerHTML;
    } catch {
      // Fallback bên dưới
    }
  }

  return rawHtml
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (full.startsWith('</')) return `</${tag === 'font' ? 'span' : tag}>`;
      if (tag === 'br') return '<br/>';
      const styleMatch = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs);
      const cleanStyle = styleMatch
        ? sanitizeStyleString(styleMatch[1] ?? styleMatch[2] ?? '')
        : '';
      const outTag = tag === 'font' ? 'span' : tag;
      return cleanStyle ? `<${outTag} style="${cleanStyle}">` : `<${outTag}>`;
    });
}

export function isSafeImageDataUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(url.trim());
}

/**
 * Đọc và thu gọn ảnh tải lên từ máy (tối đa chiều rộng 720px, chất lượng 0.85) để nhúng gọn nhẹ vào đề thi & Word.
 */
export function compressImageFileToDataUrl(file: File, maxWidth = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Vui lòng chọn tệp hình ảnh (PNG, JPG, WebP)'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được tệp hình ảnh'));
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Dữ liệu hình ảnh không hợp lệ'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể giải mã hình ảnh'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(outputType, 0.85));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}


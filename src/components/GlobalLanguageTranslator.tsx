import { useEffect } from 'react';
import { useLanguage, type AppLanguage } from '@/context/LanguageContext';
import { translateViText } from '@/lib/i18nDictionary';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
const TRANSLATED_ATTRS = ['placeholder', 'title', 'aria-label'] as const;

const originalTextMap = new WeakMap<Text, string>();
const originalAttrMap = new WeakMap<Element, Partial<Record<(typeof TRANSLATED_ATTRS)[number], string>>>();

function isInsideSkippedContainer(node: Node): boolean {
  let el: Element | null = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute('data-no-translate') || el.classList.contains('u448')) return true;
    el = el.parentElement;
  }
  return false;
}

function processTextNode(node: Text, lang: AppLanguage) {
  if (isInsideSkippedContainer(node)) return;

  const current = node.nodeValue ?? '';
  if (!current.trim()) return;

  if (lang === 'vi') {
    const orig = originalTextMap.get(node);
    if (orig !== undefined && current !== orig) {
      node.nodeValue = orig;
    }
    return;
  }

  let base = originalTextMap.get(node);
  if (base === undefined) {
    base = current;
  }

  const next = translateViText(base, lang);
  if (next !== base) {
    originalTextMap.set(node, base);
    if (current !== next) {
      node.nodeValue = next;
    }
  }
}

function processElementAttrs(el: Element, lang: AppLanguage) {
  if (isInsideSkippedContainer(el)) return;

  for (const attr of TRANSLATED_ATTRS) {
    const val = el.getAttribute(attr);
    if (!val) continue;

    if (lang === 'vi') {
      const saved = originalAttrMap.get(el)?.[attr];
      if (saved !== undefined && val !== saved) {
        el.setAttribute(attr, saved);
      }
      continue;
    }

    let map = originalAttrMap.get(el);
    const base = map?.[attr] ?? val;
    const next = translateViText(base, lang);
    if (next !== base) {
      if (!map) {
        map = {};
        originalAttrMap.set(el, map);
      }
      map[attr] = base;
      if (val !== next) {
        el.setAttribute(attr, next);
      }
    }
  }
}

function translateSubtree(root: Node, lang: AppLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text, lang);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

  if (root.nodeType === Node.ELEMENT_NODE) {
    processElementAttrs(root as Element, lang);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let cur: Node | null = walker.nextNode();
  while (cur) {
    if (cur.nodeType === Node.TEXT_NODE) {
      processTextNode(cur as Text, lang);
    } else if (cur.nodeType === Node.ELEMENT_NODE) {
      processElementAttrs(cur as Element, lang);
    }
    cur = walker.nextNode();
  }
}

/**
 * Tự động dịch các nhãn giao diện trên toàn bộ các trang theo ngôn ngữ đang chọn (VI / EN / ZH)
 * và khôi phục nguyên bản tiếng Việt khi quay lại VI.
 */
export function GlobalLanguageTranslator() {
  const { lang } = useLanguage();

  useEffect(() => {
    const root = document.getElementById('root') ?? document.body;
    if (!root) return;

    let applying = false;
    let scheduled = false;

    const run = () => {
      scheduled = false;
      applying = true;
      try {
        translateSubtree(root, lang);
      } finally {
        applying = false;
      }
    };

    run();

    if (lang === 'vi') return;

    const observer = new MutationObserver(() => {
      if (applying || scheduled) return;
      scheduled = true;
      queueMicrotask(run);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [lang]);

  return null;
}


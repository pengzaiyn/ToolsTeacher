// Lucian UX/UI Prompt #228 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#228
import { useEffect } from 'react';

const AUTO_GLOW_SELECTOR = [
  'section.bg-surface-card.border:not([data-u228-card]):not(.fixed):not(.sticky):not(.absolute)',
  'article.bg-surface-card.border:not([data-u228-card]):not(.fixed):not(.sticky):not(.absolute)',
  'form.bg-surface-card.border:not([data-u228-card]):not(.fixed):not(.sticky):not(.absolute)',
  'a.bg-surface-card.border:not([data-u228-card]):not(.fixed):not(.sticky):not(.absolute)',
  'div.bg-surface-card.border.rounded-xl:not([data-u228-card]):not(.fixed):not(.sticky):not(.absolute)',
  'div.bg-surface-card.border.rounded-2xl:not([data-u228-card]):not(.fixed):not(.sticky):not(.absolute)',
  '.u418-ft',
].join(', ');

/**
 * Kích hoạt hiệu ứng viền thẻ phát sáng theo chuột (#228) trên toàn bộ các thẻ/khung nội dung của ứng dụng.
 * Tự động bỏ qua cảm ứng (touch) và tôn trọng prefers-reduced-motion.
 */
export function GlobalCardGlow() {
  useEffect(() => {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: -500, y: -500 };
    let opacity = 0;
    let targetOpacity = 0;
    let rafId = 0;
    let lastTime = 0;
    const activeSet = new Set<HTMLElement>();

    const apply = () => {
      const cards = document.querySelectorAll<HTMLElement>(AUTO_GLOW_SELECTOR);
      const opStr = opacity.toFixed(3);
      const margin = 260;

      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        // Chỉ cập nhật những thẻ đang gần con trỏ chuột (hoặc vừa sáng trước đó) để giữ 60fps
        const isNear =
          opacity > 0.004 &&
          pointer.x >= r.left - margin &&
          pointer.x <= r.right + margin &&
          pointer.y >= r.top - margin &&
          pointer.y <= r.bottom + margin;

        if (isNear) {
          const lx = pointer.x - r.left;
          const ly = pointer.y - r.top;
          card.style.setProperty('--cx', `${lx.toFixed(1)}px`);
          card.style.setProperty('--cy', `${ly.toFixed(1)}px`);
          card.style.setProperty('--o', opStr);
          activeSet.add(card);
        } else if (activeSet.has(card)) {
          card.style.setProperty('--o', '0');
          activeSet.delete(card);
        }
      });

      if (opacity <= 0.005 && activeSet.size > 0) {
        activeSet.forEach((card) => {
          card.style.setProperty('--o', '0');
        });
        activeSet.clear();
      }
    };

    const frame = (now: number) => {
      rafId = 0;
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      opacity += (targetOpacity - opacity) * (rm ? 1 : Math.min(1, dt * (targetOpacity ? 8 : 2.5)));
      apply();
      if (Math.abs(targetOpacity - opacity) > 0.005) {
        rafId = requestAnimationFrame(frame);
      }
    };

    const kick = () => {
      if (!rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      targetOpacity = 1;
      apply();
      kick();
    };

    const handlePointerLeave = () => {
      targetOpacity = 0;
      kick();
    };

    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', handlePointerLeave);
    window.addEventListener('blur', handlePointerLeave);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
      if (rafId) cancelAnimationFrame(rafId);
      activeSet.forEach((card) => {
        card.style.removeProperty('--cx');
        card.style.removeProperty('--cy');
        card.style.removeProperty('--o');
      });
      activeSet.clear();
    };
  }, []);

  return null;
}


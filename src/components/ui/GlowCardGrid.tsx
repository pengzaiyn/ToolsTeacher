import { useEffect, useRef, type HTMLAttributes } from 'react';

/**
 * Lucian UX/UI Prompt #228 (Cursor-lit glowing card borders)
 * MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#228
 *
 * Bọc quanh lưới thẻ để viền và bề mặt các thẻ lân cận tự động phát sáng theo vị trí chuột.
 * Các thẻ con gắn thuộc tính `data-u228-card` (class `u228-c`) và phần lõi gắn `data-u228-inner` (class `u228-in`).
 */
export function GlowCardGrid({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: -500, y: -500 };
    let opacity = 0;
    let targetOpacity = 0;
    let rafId = 0;
    let lastTime = 0;

    const apply = () => {
      const rb = root.getBoundingClientRect();
      const k = root.offsetWidth / (rb.width || 1);
      const cards = root.querySelectorAll<HTMLElement>('[data-u228-card]');
      const opStr = opacity.toFixed(3);

      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        const lx = pointer.x - (r.left - rb.left) * k;
        const ly = pointer.y - (r.top - rb.top) * k;
        card.style.setProperty('--cx', `${lx.toFixed(1)}px`);
        card.style.setProperty('--cy', `${ly.toFixed(1)}px`);
        card.style.setProperty('--o', opStr);

        const inner = card.querySelector<HTMLElement>('[data-u228-inner]');
        if (inner) {
          inner.style.setProperty('--cx', `${(lx - 1.5).toFixed(1)}px`);
          inner.style.setProperty('--cy', `${(ly - 1.5).toFixed(1)}px`);
          inner.style.setProperty('--o', opStr);
        }
      });
    };

    const frame = (now: number) => {
      rafId = 0;
      if (!root.isConnected) return;
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
      const b = root.getBoundingClientRect();
      const k = root.offsetWidth / (b.width || 1);
      pointer.x = (e.clientX - b.left) * k;
      pointer.y = (e.clientY - b.top) * k;
      targetOpacity = 1;
      apply();
      kick();
    };

    const handlePointerLeave = () => {
      targetOpacity = 0;
      kick();
    };

    root.addEventListener('pointermove', handlePointerMove);
    root.addEventListener('pointerleave', handlePointerLeave);
    apply();

    return () => {
      root.removeEventListener('pointermove', handlePointerMove);
      root.removeEventListener('pointerleave', handlePointerLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={rootRef} className={className} {...rest}>
      {children}
    </div>
  );
}


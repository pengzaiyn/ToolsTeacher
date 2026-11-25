// Lucian UX/UI Prompt #341 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#341
import { useEffect, useRef } from 'react';
import './lucian-341.css';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  b: number;
}

export function LoginConstellationMesh() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const cv = canvasRef.current;
    const ct = countRef.current;
    if (!root || !cv || !ct) return;

    const cx = cv.getContext('2d');
    if (!cx) return;

    const cleanups: Array<() => void> = [];
    const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rm = rmQuery.matches;

    let W = Math.max(320, root.clientWidth || window.innerWidth);
    let H = Math.max(320, root.clientHeight || window.innerHeight);
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    const LINK = 110;
    const PL = 165;
    const MAX = 140;

    function syncSize() {
      if (!root || !cv || !cx) return;
      W = Math.max(320, root.clientWidth || window.innerWidth);
      H = Math.max(320, root.clientHeight || window.innerHeight);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = W * dpr;
      cv.height = H * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    syncSize();

    const P: Particle[] = [];
    let ptr: { x: number; y: number } | null = null;

    function add(x: number, y: number, vx: number, vy: number, born = 0) {
      P.push({ x, y, vx, vy, b: born });
      if (P.length > MAX) P.shift();
    }

    const initialCount = Math.min(105, Math.max(64, Math.round((W * H) / 14000)));
    for (let i = 0; i < initialCount; i++) {
      add(
        Math.random() * W,
        Math.random() * H,
        (Math.random() - 0.5) * 24,
        (Math.random() - 0.5) * 24,
        0
      );
    }

    function isDarkTheme(): boolean {
      return document.documentElement.classList.contains('dark');
    }

    function draw(now: number) {
      if (!cx || !ct) return;
      cx.clearRect(0, 0, W, H);
      const dark = isDarkTheme();
      let links = 0;

      for (let a = 0; a < P.length; a++) {
        for (let b = a + 1; b < P.length; b++) {
          const dx = P[a].x - P[b].x;
          const dy = P[a].y - P[b].y;
          if (Math.abs(dx) > LINK || Math.abs(dy) > LINK) continue;
          const d = Math.hypot(dx, dy);
          if (d > LINK) continue;
          links++;
          const alpha = (1 - d / LINK) * (dark ? 0.45 : 0.28);
          if (dark) {
            const hue = 205 + (P[a].x / W) * 45;
            cx.strokeStyle = `hsla(${hue.toFixed(0)},85%,75%,${alpha.toFixed(2)})`;
          } else {
            cx.strokeStyle = `rgba(26,54,93,${alpha.toFixed(2)})`;
          }
          cx.lineWidth = 1;
          cx.beginPath();
          cx.moveTo(P[a].x, P[a].y);
          cx.lineTo(P[b].x, P[b].y);
          cx.stroke();
        }
      }

      if (ptr) {
        for (let i = 0; i < P.length; i++) {
          const p = P[i];
          const d = Math.hypot(p.x - ptr.x, p.y - ptr.y);
          if (d > PL) continue;
          links++;
          const alpha = ((1 - d / PL) * 0.8).toFixed(2);
          cx.strokeStyle = dark
            ? `rgba(255,224,130,${alpha})`
            : `rgba(200,16,46,${alpha})`;
          cx.lineWidth = 1.3;
          cx.beginPath();
          cx.moveTo(ptr.x, ptr.y);
          cx.lineTo(p.x, p.y);
          cx.stroke();
        }
        cx.fillStyle = dark ? '#FFE082' : '#C8102E';
        cx.beginPath();
        cx.arc(ptr.x, ptr.y, 3.5, 0, Math.PI * 2);
        cx.fill();
      }

      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        const age = (now - p.b) / 600;
        const r = p.b && age < 1 ? 1.7 + (1 - age) * 2.4 : 1.7;
        cx.fillStyle = dark ? '#E7ECFF' : '#1A365D';
        cx.beginPath();
        cx.arc(p.x, p.y, r, 0, Math.PI * 2);
        cx.fill();
      }

      ct.textContent = `${links} links`;
    }

    let vis = true;
    let raf = 0;
    let last = 0;

    function frame(now: number) {
      raf = 0;
      if (!root || !root.isConnected || !vis) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (ptr) {
          const dx = ptr.x - p.x;
          const dy = ptr.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < PL && d > 12) {
            p.vx += (dx / d) * 28 * dt;
            p.vy += (dy / d) * 28 * dt;
          }
        }
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 30) {
          p.vx *= 1 - 1.5 * dt;
          p.vy *= 1 - 1.5 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0 || p.x > W) {
          p.vx *= -1;
          p.x = Math.max(0, Math.min(W, p.x));
        }
        if (p.y < 0 || p.y > H) {
          p.vy *= -1;
          p.y = Math.max(0, Math.min(H, p.y));
        }
      }

      draw(now);
      raf = window.requestAnimationFrame(frame);
    }

    function run() {
      if (rm) {
        draw(performance.now());
        return;
      }
      if (!raf && vis) {
        last = performance.now();
        raf = window.requestAnimationFrame(frame);
      }
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        vis = es[0]?.isIntersecting ?? true;
        run();
      });
      io.observe(root);
      cleanups.push(() => io.disconnect());
    }

    function loc(clientX: number, clientY: number) {
      const r = cv!.getBoundingClientRect();
      const k = cv!.offsetWidth / (r.width || 1);
      return {
        x: (clientX - r.left) * k,
        y: (clientY - r.top) * k,
      };
    }

    const onPointerMove = (e: PointerEvent) => {
      ptr = loc(e.clientX, e.clientY);
      if (rm) draw(performance.now());
    };

    const onPointerLeave = () => {
      ptr = null;
      if (rm) draw(performance.now());
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.u062, button, input, a')) {
        return;
      }
      const q = loc(e.clientX, e.clientY);
      const now = performance.now();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + Math.random() * 0.4;
        const s = 60 + Math.random() * 70;
        add(q.x, q.y, Math.cos(a) * s, Math.sin(a) * s, now);
      }
      if (rm) draw(now);
    };

    const onResize = () => {
      syncSize();
      draw(performance.now());
    };

    const onMotionChange = (e: MediaQueryListEvent) => {
      rm = e.matches;
      if (rm && raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
      run();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);
    rmQuery.addEventListener('change', onMotionChange);

    cleanups.push(() => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
      rmQuery.removeEventListener('change', onMotionChange);
      if (raf) window.cancelAnimationFrame(raf);
    });

    const themeObserver = new MutationObserver(() => {
      if (rm) draw(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    cleanups.push(() => themeObserver.disconnect());

    run();

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div ref={rootRef} className="ux u341" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="u341-cv"
        role="img"
        aria-label="Lưới chòm sao tương tác, chạm vùng trống để tạo hạt mới"
      />
      <span ref={countRef} className="u341-ct" aria-hidden="true" />
    </div>
  );
}


import { useEffect, useRef, useState } from 'react';

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface PaletteColors {
  red: RgbColor;
  redSoft: RgbColor;
  navy: RgbColor;
  navySoft: RgbColor;
  core: RgbColor;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  age: number;
  maxAge: number;
  kind: 'star' | 'dust';
  color: RgbColor;
  twinklePhase: number;
}

interface ClickRipple {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  maxRadius: number;
  color: RgbColor;
}

const MAX_PARTICLES = 90;
const MAX_RIPPLES = 8;
const SPAWN_DISTANCE_PX = 13;
const HALO_FADE_MS = 380;

function parseCssRgb(value: string): RgbColor | null {
  const parts = value.match(/\d+/g);
  if (!parts || parts.length < 3) return null;
  return {
    r: Number(parts[0]),
    g: Number(parts[1]),
    b: Number(parts[2]),
  };
}

function mixRgb(a: RgbColor, b: RgbColor, weightB: number): RgbColor {
  const weightA = 1 - weightB;
  return {
    r: Math.round(a.r * weightA + b.r * weightB),
    g: Math.round(a.g * weightA + b.g * weightB),
    b: Math.round(a.b * weightA + b.b * weightB),
  };
}

function rgba(color: RgbColor, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(3)})`;
}

/**
 * Vẽ ngôi sao 4 cánh cong mềm quanh tâm (0, 0) trên canvas đã dịch chuyển & xoay.
 */
function drawFourPointStar(ctx: CanvasRenderingContext2D, radius: number) {
  const inner = radius * 0.24;
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.quadraticCurveTo(inner, -inner, radius, 0);
  ctx.quadraticCurveTo(inner, inner, 0, radius);
  ctx.quadraticCurveTo(-inner, inner, -radius, 0);
  ctx.quadraticCurveTo(-inner, -inner, 0, -radius);
  ctx.closePath();
}

/**
 * Hiệu ứng bụi sáng & hạt sao lấp lánh (đỏ/navy thương hiệu) di theo con trỏ chuột toàn trang.
 * Tự tắt trên thiết bị cảm ứng thuần hoặc khi bật chế độ giảm chuyển động, và nghỉ hoàn toàn khi chuột đứng yên.
 */
export function CursorSparkleTrail() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointerQuery = window.matchMedia('(pointer: fine)');

    const syncCapability = () => {
      setEnabled(!reducedMotionQuery.matches && finePointerQuery.matches);
    };

    syncCapability();
    reducedMotionQuery.addEventListener('change', syncCapability);
    finePointerQuery.addEventListener('change', syncCapability);

    return () => {
      reducedMotionQuery.removeEventListener('change', syncCapability);
      finePointerQuery.removeEventListener('change', syncCapability);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    const probe = probeRef.current;
    if (!canvas || !probe) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const readTokenColor = (token: string): RgbColor | null => {
      const node = probe.querySelector<HTMLElement>(`[data-token="${token}"]`);
      if (!node) return null;
      return parseCssRgb(window.getComputedStyle(node).color);
    };

    // Lấy màu trực tiếp từ Tailwind token để không cứng hóa mã hex trong component
    const red = readTokenColor('red');
    const navy = readTokenColor('navy');
    const surface = readTokenColor('surface');
    if (!red || !navy || !surface) return;

    const palette: PaletteColors = {
      red,
      redSoft: mixRgb(red, surface, 0.42),
      navy,
      navySoft: mixRgb(navy, surface, 0.42),
      core: surface,
    };

    const pickColor = (): RgbColor => {
      const roll = Math.random();
      if (roll < 0.36) return palette.red;
      if (roll < 0.62) return palette.redSoft;
      if (roll < 0.86) return palette.navy;
      return palette.navySoft;
    };

    const particles: SparkleParticle[] = [];
    const ripples: ClickRipple[] = [];

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();

    let rafId = 0;
    let lastTime = 0;
    let lastMoveTime = 0;
    let hasLastPointer = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let haloX = 0;
    let haloY = 0;
    let haloAlpha = 0;

    const pushParticle = (particle: SparkleParticle) => {
      if (particles.length >= MAX_PARTICLES) {
        particles.shift();
      }
      particles.push(particle);
    };

    const spawnTrailAt = (x: number, y: number, vx: number, vy: number) => {
      const isStar = Math.random() < 0.56;
      const spread = isStar ? 0.55 : 0.7;
      pushParticle({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: vx * 0.14 + (Math.random() - 0.5) * spread,
        vy: vy * 0.14 + (Math.random() - 0.5) * spread - 0.18,
        size: isStar ? 4.2 + Math.random() * 4.2 : 1.5 + Math.random() * 1.8,
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 2.4,
        age: 0,
        maxAge: isStar ? 540 + Math.random() * 240 : 420 + Math.random() * 220,
        kind: isStar ? 'star' : 'dust',
        color: pickColor(),
        twinklePhase: Math.random() * Math.PI * 2,
      });
    };

    const scheduleFrame = () => {
      if (rafId !== 0 || document.hidden) return;
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(renderFrame);
    };

    const renderFrame = (now: number) => {
      rafId = 0;
      const dtMs = Math.min(Math.max(now - lastTime, 1), 36);
      const dtScale = dtMs / 16.667;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Vòng hào quang mềm bám theo chuột khi đang di chuyển và tự mờ đi khi dừng
      const idleElapsed = now - lastMoveTime;
      const targetHaloAlpha = idleElapsed < HALO_FADE_MS ? 1 - idleElapsed / HALO_FADE_MS : 0;
      haloAlpha += (targetHaloAlpha - haloAlpha) * Math.min(1, 0.18 * dtScale);
      haloX += (targetX - haloX) * Math.min(1, 0.24 * dtScale);
      haloY += (targetY - haloY) * Math.min(1, 0.24 * dtScale);

      if (haloAlpha > 0.015 && hasLastPointer) {
        const radius = 30;
        const grad = ctx.createRadialGradient(haloX, haloY, 0, haloX, haloY, radius);
        grad.addColorStop(0, rgba(palette.red, 0.14 * haloAlpha));
        grad.addColorStop(0.55, rgba(palette.navy, 0.06 * haloAlpha));
        grad.addColorStop(1, rgba(palette.navy, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(haloX, haloY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cập nhật & vẽ gợn sóng khi click chuột
      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const ripple = ripples[i];
        ripple.age += dtMs;
        const progress = ripple.age / ripple.maxAge;
        if (progress >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const radius = 4 + (ripple.maxRadius - 4) * easeOut;
        const alpha = 0.44 * (1 - progress);
        ctx.strokeStyle = rgba(ripple.color, alpha);
        ctx.lineWidth = Math.max(0.7, 1.8 * (1 - progress));
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cập nhật & vẽ hạt bụi sáng / sao lấp lánh
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.age += dtMs;
        const progress = p.age / p.maxAge;
        if (progress >= 1) {
          particles.splice(i, 1);
          continue;
        }

        const drag = Math.pow(0.955, dtScale);
        p.vx *= drag;
        p.vy = p.vy * drag - 0.015 * dtScale;
        p.x += p.vx * dtScale;
        p.y += p.vy * dtScale;
        p.rotation += p.vr * (dtMs / 1000);

        const fadeOut = Math.pow(1 - progress, 1.6);
        const fadeIn = Math.min(1, progress * 6);
        const alpha = fadeIn * fadeOut;

        if (p.kind === 'star') {
          const twinkle = 0.8 + 0.22 * Math.sin(progress * 11 + p.twinklePhase);
          const scale = (1 - progress * 0.35) * twinkle;
          const r = p.size * scale;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);

          // Vầng sáng mờ quanh ngôi sao
          ctx.fillStyle = rgba(p.color, alpha * 0.22);
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
          ctx.fill();

          // Cánh sao 4 góc sắc nét
          drawFourPointStar(ctx, r);
          ctx.fillStyle = rgba(p.color, alpha * 0.92);
          ctx.fill();

          // Tâm sáng trắng giúp hạt nổi bật trên cả nền sáng lẫn thẻ màu tối
          if (alpha > 0.25) {
            ctx.fillStyle = rgba(palette.core, alpha * 0.85);
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0.7, r * 0.18), 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        } else {
          const radius = p.size * (1 - progress * 0.45);
          ctx.fillStyle = rgba(p.color, alpha * 0.22);
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius * 2.1, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = rgba(p.color, alpha * 0.85);
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (particles.length > 0 || ripples.length > 0 || haloAlpha > 0.015) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;

      const x = event.clientX;
      const y = event.clientY;
      targetX = x;
      targetY = y;
      lastMoveTime = performance.now();

      if (!hasLastPointer) {
        hasLastPointer = true;
        lastPointerX = x;
        lastPointerY = y;
        haloX = x;
        haloY = y;
        spawnTrailAt(x, y, 0, 0);
        scheduleFrame();
        return;
      }

      const dx = x - lastPointerX;
      const dy = y - lastPointerY;
      const dist = Math.hypot(dx, dy);

      if (dist >= SPAWN_DISTANCE_PX) {
        const steps = Math.min(5, Math.floor(dist / SPAWN_DISTANCE_PX));
        const unitVx = dx / Math.max(dist, 1);
        const unitVy = dy / Math.max(dist, 1);
        const speedFactor = Math.min(dist, 36) * 0.08;

        for (let i = 1; i <= steps; i += 1) {
          const t = i / steps;
          const sx = lastPointerX + dx * t;
          const sy = lastPointerY + dy * t;
          spawnTrailAt(sx, sy, unitVx * speedFactor, unitVy * speedFactor);
        }

        lastPointerX = x;
        lastPointerY = y;
      }

      scheduleFrame();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0) return;

      const x = event.clientX;
      const y = event.clientY;
      targetX = x;
      targetY = y;
      lastPointerX = x;
      lastPointerY = y;
      hasLastPointer = true;
      lastMoveTime = performance.now();

      if (ripples.length >= MAX_RIPPLES) {
        ripples.shift();
      }
      ripples.push({
        x,
        y,
        age: 0,
        maxAge: 460,
        maxRadius: 34,
        color: Math.random() < 0.6 ? palette.red : palette.navy,
      });

      const burstCount = 7;
      for (let i = 0; i < burstCount; i += 1) {
        const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.45;
        const speed = 0.9 + Math.random() * 1.1;
        pushParticle({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.12,
          size: 4 + Math.random() * 3.8,
          rotation: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 3.2,
          age: 0,
          maxAge: 460 + Math.random() * 200,
          kind: i % 3 === 0 ? 'dust' : 'star',
          color: i % 2 === 0 ? palette.red : palette.navySoft,
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }

      scheduleFrame();
    };

    const resetPointerAnchor = () => {
      hasLastPointer = false;
      haloAlpha = 0;
    };

    const handleVisibilityChange = () => {
      if (document.hidden && rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!document.hidden && (particles.length > 0 || ripples.length > 0)) {
        scheduleFrame();
      }
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('blur', resetPointerAnchor);
    document.addEventListener('mouseleave', resetPointerAnchor);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('blur', resetPointerAnchor);
      document.removeEventListener('mouseleave', resetPointerAnchor);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={probeRef}
        className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden opacity-0 print:hidden"
        aria-hidden="true"
      >
        <span data-token="red" className="text-brand-red" />
        <span data-token="navy" className="text-brand-navy" />
        <span data-token="surface" className="text-surface-card" />
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[60] h-full w-full print:hidden"
      />
    </>
  );
}

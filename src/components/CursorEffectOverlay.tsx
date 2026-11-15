import { useEffect, useRef, useState } from 'react';
import { useCursorEffects } from '@/context/CursorEffectContext';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  buildSchemePalette,
  createFieldCapsules,
  createHaloCapsules,
  parseCssRgb,
  pickFromPalette,
  rgba,
  stepAndDrawFieldCapsules,
  stepAndDrawHaloCapsules,
  stepAndDrawSparkles,
  updateAndDrawRipples,
  type ClickRipple,
  type FieldCapsule,
  type HaloCapsule,
  type RgbColor,
  type SparkleParticle,
} from '@/lib/cursorCanvasEngine';
import { DENSITY_SCALE_MAP, INTENSITY_ALPHA_MAP } from '@/lib/cursorEffects';

const MAX_RIPPLES = 8;
const HALO_FADE_MS = 380;

/**
 * Lớp phủ hiệu ứng con trỏ chuột toàn trang, tự đổi ngay theo cài đặt người dùng.
 * Tự tắt trên thiết bị cảm ứng thuần hoặc khi bật Reduced Motion để tối ưu pin & hiệu năng.
 */
export function CursorEffectOverlay() {
  const { settings } = useCursorEffects();
  const { customTheme } = useCustomTheme();
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const [deviceSupported, setDeviceSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointerQuery = window.matchMedia('(pointer: fine)');

    const syncCapability = () => {
      setDeviceSupported(!reducedMotionQuery.matches && finePointerQuery.matches);
    };

    syncCapability();
    reducedMotionQuery.addEventListener('change', syncCapability);
    finePointerQuery.addEventListener('change', syncCapability);

    return () => {
      reducedMotionQuery.removeEventListener('change', syncCapability);
      finePointerQuery.removeEventListener('change', syncCapability);
    };
  }, []);

  const shouldRender = deviceSupported && settings.mode !== 'none';

  useEffect(() => {
    if (!shouldRender) return;

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

    const red = readTokenColor('red');
    const navy = readTokenColor('navy');
    const surface = readTokenColor('surface');
    if (!red || !navy || !surface) return;

    const palette = buildSchemePalette(red, navy, surface, settings.colorScheme);
    const densityScale = DENSITY_SCALE_MAP[settings.density];
    const alphaScale = INTENSITY_ALPHA_MAP[settings.intensity];
    const maxSparkles = Math.round(90 * densityScale);
    const spawnDistancePx = Math.max(8, Math.round(13 / densityScale));

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const sparkles: SparkleParticle[] = [];
    const ripples: ClickRipple[] = [];
    let haloCapsules: HaloCapsule[] = [];
    let fieldCapsules: FieldCapsule[] =
      settings.mode === 'antigravity-field'
        ? createFieldCapsules(width, height, settings, palette)
        : [];

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (settings.mode === 'antigravity-field') {
        fieldCapsules = createFieldCapsules(width, height, settings, palette);
      }
    };

    resizeCanvas();

    let rafId = 0;
    let lastTime = performance.now();
    let lastMoveTime = performance.now();
    const savedPos = lastPointerPosRef.current;
    let pointerInside = savedPos !== null;
    let hasLastPointer = savedPos !== null;
    let lastPointerX = savedPos ? savedPos.x : width / 2;
    let lastPointerY = savedPos ? savedPos.y : height / 2;
    let targetX = lastPointerX;
    let targetY = lastPointerY;
    let haloX = lastPointerX;
    let haloY = lastPointerY;
    let haloAlpha = savedPos ? 1 : 0;
    let pointerSpeed = 0;

    if (savedPos && settings.mode === 'antigravity-halo') {
      haloCapsules = createHaloCapsules(savedPos.x, savedPos.y, settings, palette);
    }

    const pushSparkle = (particle: SparkleParticle) => {
      if (sparkles.length >= maxSparkles) {
        sparkles.shift();
      }
      sparkles.push(particle);
    };

    const spawnSparkleAt = (x: number, y: number, vx: number, vy: number) => {
      const isStar = Math.random() < 0.56;
      const spread = isStar ? 0.55 : 0.7;
      pushSparkle({
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
        color: pickFromPalette(palette),
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
      const tSec = now / 1000;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      haloX += (targetX - haloX) * Math.min(1, 0.22 * dtScale);
      haloY += (targetY - haloY) * Math.min(1, 0.22 * dtScale);
      pointerSpeed *= Math.pow(0.86, dtScale);

      const idleMs = now - lastMoveTime;

      if (settings.mode === 'sparkle') {
        const targetHalo =
          pointerInside && idleMs < HALO_FADE_MS ? 1 - idleMs / HALO_FADE_MS : 0;
        haloAlpha += (targetHalo - haloAlpha) * Math.min(1, 0.18 * dtScale);

        if (haloAlpha > 0.015 && hasLastPointer) {
          const radius = 30;
          const grad = ctx.createRadialGradient(haloX, haloY, 0, haloX, haloY, radius);
          grad.addColorStop(0, rgba(palette[0], 0.14 * haloAlpha * alphaScale));
          grad.addColorStop(0.55, rgba(palette[palette.length - 1], 0.06 * haloAlpha * alphaScale));
          grad.addColorStop(1, rgba(palette[0], 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(haloX, haloY, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        stepAndDrawSparkles(ctx, sparkles, surface, dtMs, dtScale, settings);
      } else if (settings.mode === 'antigravity-halo') {
        // Khi đứng yên lâu, vòng hạt dịu xuống để không che chữ bảng rồi sáng lại ngay khi rê chuột
        const targetVis = !pointerInside ? 0 : idleMs < 1100 ? 1 : 0.26;
        haloAlpha += (targetVis - haloAlpha) * Math.min(1, (pointerInside ? 0.08 : 0.14) * dtScale);

        if (haloCapsules.length > 0 && haloAlpha > 0.015) {
          stepAndDrawHaloCapsules(
            ctx,
            haloCapsules,
            haloX,
            haloY,
            pointerSpeed,
            haloAlpha,
            tSec,
            dtScale,
            settings
          );
        }
      } else if (settings.mode === 'antigravity-field') {
        const targetVis = pointerInside ? 1 : 0;
        haloAlpha += (targetVis - haloAlpha) * Math.min(1, 0.12 * dtScale);

        stepAndDrawFieldCapsules(
          ctx,
          fieldCapsules,
          haloX,
          haloY,
          pointerInside || haloAlpha > 0.02,
          haloAlpha,
          tSec,
          dtScale,
          settings
        );
      }

      if (ripples.length > 0) {
        updateAndDrawRipples(ctx, ripples, dtMs, alphaScale);
      }

      const keepAlive =
        settings.mode === 'antigravity-field' ||
        (settings.mode === 'antigravity-halo' && (pointerInside || haloAlpha > 0.015)) ||
        sparkles.length > 0 ||
        ripples.length > 0 ||
        haloAlpha > 0.015;

      if (keepAlive && !document.hidden) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;

      const x = event.clientX;
      const y = event.clientY;
      targetX = x;
      targetY = y;
      pointerInside = true;
      lastPointerPosRef.current = { x, y };
      lastMoveTime = performance.now();

      if (!hasLastPointer) {
        hasLastPointer = true;
        lastPointerX = x;
        lastPointerY = y;
        haloX = x;
        haloY = y;
        if (settings.mode === 'antigravity-halo' && haloCapsules.length === 0) {
          haloCapsules = createHaloCapsules(x, y, settings, palette);
        }
        if (settings.mode === 'sparkle') {
          spawnSparkleAt(x, y, 0, 0);
        }
        scheduleFrame();
        return;
      }

      const dx = x - lastPointerX;
      const dy = y - lastPointerY;
      const dist = Math.hypot(dx, dy);
      pointerSpeed = Math.min(48, Math.max(pointerSpeed, dist));

      if (settings.mode === 'sparkle' && dist >= spawnDistancePx) {
        const steps = Math.min(5, Math.floor(dist / spawnDistancePx));
        const unitVx = dx / Math.max(dist, 1);
        const unitVy = dy / Math.max(dist, 1);
        const speedFactor = Math.min(dist, 36) * 0.08;

        for (let i = 1; i <= steps; i += 1) {
          const t = i / steps;
          spawnSparkleAt(
            lastPointerX + dx * t,
            lastPointerY + dy * t,
            unitVx * speedFactor,
            unitVy * speedFactor
          );
        }
        lastPointerX = x;
        lastPointerY = y;
      } else if (settings.mode !== 'sparkle') {
        lastPointerX = x;
        lastPointerY = y;
        if (settings.mode === 'antigravity-halo' && haloCapsules.length === 0) {
          haloCapsules = createHaloCapsules(x, y, settings, palette);
        }
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
      pointerInside = true;
      hasLastPointer = true;
      lastPointerPosRef.current = { x, y };
      lastMoveTime = performance.now();

      if (settings.mode === 'antigravity-halo' && haloCapsules.length === 0) {
        haloCapsules = createHaloCapsules(x, y, settings, palette);
      }

      if (!settings.clickRipple) {
        scheduleFrame();
        return;
      }

      if (ripples.length >= MAX_RIPPLES) {
        ripples.shift();
      }
      ripples.push({
        x,
        y,
        age: 0,
        maxAge: 460,
        maxRadius: settings.mode === 'sparkle' ? 34 : 52,
        color: pickFromPalette(palette),
      });

      if (settings.mode === 'sparkle') {
        const burstCount = Math.max(4, Math.round(7 * densityScale));
        for (let i = 0; i < burstCount; i += 1) {
          const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.45;
          const speed = 0.9 + Math.random() * 1.1;
          pushSparkle({
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
            color: palette[i % palette.length],
            twinklePhase: Math.random() * Math.PI * 2,
          });
        }
      } else if (settings.mode === 'antigravity-halo') {
        for (let i = 0; i < haloCapsules.length; i += 1) {
          const p = haloCapsules[i];
          const angle = Math.atan2(p.y - y, p.x - x);
          const impulse = 6.5 + Math.random() * 3.5;
          p.vx += Math.cos(angle) * impulse;
          p.vy += Math.sin(angle) * impulse;
        }
      } else if (settings.mode === 'antigravity-field') {
        const blastRadius = 240;
        for (let i = 0; i < fieldCapsules.length; i += 1) {
          const p = fieldCapsules[i];
          const dx = p.x - x;
          const dy = p.y - y;
          const dist = Math.hypot(dx, dy);
          if (dist < blastRadius && dist > 0.1) {
            const force = (1 - dist / blastRadius) * 11;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }
      }

      scheduleFrame();
    };

    const handlePointerLeave = () => {
      pointerInside = false;
      hasLastPointer = false;
      lastPointerPosRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.hidden && rafId !== 0) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (
        !document.hidden &&
        (settings.mode === 'antigravity-field' ||
          (settings.mode === 'antigravity-halo' && pointerInside))
      ) {
        scheduleFrame();
      }
    };

    if (
      settings.mode === 'antigravity-field' ||
      (settings.mode === 'antigravity-halo' && savedPos !== null)
    ) {
      scheduleFrame();
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('blur', handlePointerLeave);
    document.addEventListener('mouseleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('blur', handlePointerLeave);
      document.removeEventListener('mouseleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    shouldRender,
    settings,
    resolvedTheme,
    customTheme.enabled,
    customTheme.accentPreset,
    customTheme.customPrimaryHex,
    customTheme.customSecondaryHex,
  ]);

  if (!shouldRender) return null;

  return (
    <>
      <div
        ref={probeRef}
        className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden opacity-0 print:hidden"
        aria-hidden="true"
      >
        <span data-token="red" className="text-brand-red" />
        <span data-token="navy" className="text-brand-navy" />
        <span data-token="surface" className="text-surface-bright" />
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[60] h-full w-full print:hidden"
      />
    </>
  );
}

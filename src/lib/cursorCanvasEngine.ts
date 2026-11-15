import {
  DENSITY_SCALE_MAP,
  INTENSITY_ALPHA_MAP,
  type CursorColorScheme,
  type CursorEffectSettings,
} from '@/lib/cursorEffects';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ClickRipple {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  maxRadius: number;
  color: RgbColor;
}

export interface SparkleParticle {
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

export interface HaloCapsule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseAngle: number;
  orbitOffset: number;
  layer: number;
  depth: number;
  length: number;
  thickness: number;
  wavePhase: number;
  color: RgbColor;
}

export interface FieldCapsule {
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  phase: number;
  driftAmp: number;
  driftSpeed: number;
  length: number;
  thickness: number;
  depth: number;
  color: RgbColor;
}

export function parseCssRgb(value: string): RgbColor | null {
  const parts = value.match(/\d+/g);
  if (!parts || parts.length < 3) return null;
  return {
    r: Number(parts[0]),
    g: Number(parts[1]),
    b: Number(parts[2]),
  };
}

export function mixRgb(a: RgbColor, b: RgbColor, weightB: number): RgbColor {
  const weightA = 1 - weightB;
  return {
    r: Math.round(a.r * weightA + b.r * weightB),
    g: Math.round(a.g * weightA + b.g * weightB),
    b: Math.round(a.b * weightA + b.b * weightB),
  };
}

export function rgba(color: RgbColor, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamped.toFixed(3)})`;
}

export function buildSchemePalette(
  red: RgbColor,
  navy: RgbColor,
  surface: RgbColor,
  scheme: CursorColorScheme
): RgbColor[] {
  const redSoft = mixRgb(red, surface, 0.36);
  const redGlow = mixRgb(red, surface, 0.56);
  const navySoft = mixRgb(navy, surface, 0.36);
  const navyGlow = mixRgb(navy, surface, 0.56);

  if (scheme === 'red') return [red, redSoft, redGlow];
  if (scheme === 'navy') return [navy, navySoft, navyGlow];
  return [red, redSoft, navy, navySoft, redGlow];
}

export function pickFromPalette(palette: RgbColor[]): RgbColor {
  return palette[Math.floor(Math.random() * palette.length)];
}

/**
 * Vẽ hình thanh viên nang bo tròn (capsule/dash) quanh tâm (0, 0) theo trục ngang.
 */
export function drawCapsule(
  ctx: CanvasRenderingContext2D,
  length: number,
  thickness: number
): void {
  const radius = thickness / 2;
  const halfStraight = Math.max(0, length / 2 - radius);
  ctx.beginPath();
  ctx.arc(halfStraight, 0, radius, -Math.PI / 2, Math.PI / 2);
  ctx.arc(-halfStraight, 0, radius, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
}

/**
 * Vẽ ngôi sao 4 cánh cong mềm quanh tâm (0, 0).
 */
export function drawFourPointStar(ctx: CanvasRenderingContext2D, radius: number): void {
  const inner = radius * 0.24;
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.quadraticCurveTo(inner, -inner, radius, 0);
  ctx.quadraticCurveTo(inner, inner, 0, radius);
  ctx.quadraticCurveTo(-inner, inner, -radius, 0);
  ctx.quadraticCurveTo(-inner, -inner, 0, -radius);
  ctx.closePath();
}

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

export function updateAndDrawRipples(
  ctx: CanvasRenderingContext2D,
  ripples: ClickRipple[],
  dtMs: number,
  alphaScale: number
): void {
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
    const alpha = 0.42 * (1 - progress) * alphaScale;
    ctx.strokeStyle = rgba(ripple.color, alpha);
    ctx.lineWidth = Math.max(0.7, 1.8 * (1 - progress));
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function createHaloCapsules(
  centerX: number,
  centerY: number,
  settings: CursorEffectSettings,
  palette: RgbColor[]
): HaloCapsule[] {
  const densityScale = DENSITY_SCALE_MAP[settings.density];
  const count = Math.max(20, Math.round(44 * densityScale));
  const result: HaloCapsule[] = [];

  for (let i = 0; i < count; i += 1) {
    const baseAngle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.14;
    const layer = i % 3 === 0 ? 1 : 0;
    const depth = 0.58 + Math.random() * 0.57;
    const orbitOffset = layer === 1 ? -14 + Math.random() * 10 : -4 + Math.random() * 24;
    const radius = 64 + orbitOffset;

    result.push({
      x: centerX + Math.cos(baseAngle) * radius,
      y: centerY + Math.sin(baseAngle) * radius,
      vx: 0,
      vy: 0,
      baseAngle,
      orbitOffset,
      layer,
      depth,
      length: (layer === 1 ? 5.5 : 7.5) + depth * 4.5,
      thickness: 2 + depth * 1.3,
      wavePhase: Math.random() * Math.PI * 2,
      color: palette[i % palette.length],
    });
  }
  return result;
}

export function stepAndDrawHaloCapsules(
  ctx: CanvasRenderingContext2D,
  capsules: HaloCapsule[],
  haloX: number,
  haloY: number,
  pointerSpeed: number,
  visibility: number,
  tSec: number,
  dtScale: number,
  settings: CursorEffectSettings
): void {
  if (visibility <= 0.01) return;

  const alphaScale = INTENSITY_ALPHA_MAP[settings.intensity];
  const speedStretch = Math.min(18, pointerSpeed * 0.45);
  const springK = 0.082;
  const damping = Math.pow(0.81, dtScale);

  for (let i = 0; i < capsules.length; i += 1) {
    const p = capsules[i];
    const swirl = p.baseAngle + tSec * (p.layer === 1 ? -0.34 : 0.42);
    const wave = Math.sin(swirl * 3 - tSec * 2.4 + p.wavePhase) * 9.5;
    const breathe = 0.94 + 0.06 * Math.sin(tSec * 1.7 + p.wavePhase);
    const targetRadius = (62 + p.orbitOffset + wave + speedStretch * 0.45) * breathe;

    const tx = haloX + Math.cos(swirl) * targetRadius;
    const ty = haloY + Math.sin(swirl) * targetRadius;

    p.vx = (p.vx + (tx - p.x) * springK * dtScale) * damping;
    p.vy = (p.vy + (ty - p.y) * springK * dtScale) * damping;
    p.x += p.vx * dtScale;
    p.y += p.vy * dtScale;

    const radialAngle = Math.atan2(p.y - haloY, p.x - haloX);
    const alpha = (0.34 + 0.42 * p.depth) * visibility * alphaScale;
    if (alpha <= 0.015) continue;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(radialAngle);
    drawCapsule(ctx, p.length, p.thickness);
    ctx.fillStyle = rgba(p.color, alpha);
    ctx.fill();
    ctx.restore();
  }
}

export function createFieldCapsules(
  width: number,
  height: number,
  settings: CursorEffectSettings,
  palette: RgbColor[]
): FieldCapsule[] {
  const densityScale = DENSITY_SCALE_MAP[settings.density];
  const area = Math.max(width * height, 320 * 320);
  const baseCount = Math.round((area / 16000) * densityScale);
  const count = Math.max(36, Math.min(165, baseCount));

  const cols = Math.max(4, Math.round(Math.sqrt((count * width) / Math.max(height, 1))));
  const rows = Math.max(4, Math.ceil(count / cols));
  const cellW = width / cols;
  const cellH = height / rows;

  const result: FieldCapsule[] = [];
  for (let r = 0; r < rows && result.length < count; r += 1) {
    for (let c = 0; c < cols && result.length < count; c += 1) {
      const homeX = (c + 0.18 + Math.random() * 0.64) * cellW;
      const homeY = (r + 0.18 + Math.random() * 0.64) * cellH;
      const depth = 0.55 + Math.random() * 0.6;
      const angle = Math.random() * Math.PI * 2;
      result.push({
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        vx: 0,
        vy: 0,
        angle,
        phase: Math.random() * Math.PI * 2,
        driftAmp: 6 + Math.random() * 9,
        driftSpeed: 0.45 + Math.random() * 0.45,
        length: 5.5 + depth * 5.2,
        thickness: 2 + depth * 1.15,
        depth,
        color: palette[(r * cols + c) % palette.length],
      });
    }
  }
  return result;
}

export function stepAndDrawFieldCapsules(
  ctx: CanvasRenderingContext2D,
  capsules: FieldCapsule[],
  haloX: number,
  haloY: number,
  pointerActive: boolean,
  haloVisibility: number,
  tSec: number,
  dtScale: number,
  settings: CursorEffectSettings
): void {
  const alphaScale = INTENSITY_ALPHA_MAP[settings.intensity];
  const magnetRadius = 175;
  const targetRingRadius = 74;
  const damping = Math.pow(0.84, dtScale);

  for (let i = 0; i < capsules.length; i += 1) {
    const p = capsules[i];
    const floatX = p.homeX + Math.cos(tSec * p.driftSpeed + p.phase) * p.driftAmp;
    const floatY = p.homeY + Math.sin(tSec * (p.driftSpeed * 0.88) + p.phase * 1.3) * p.driftAmp;

    let targetX = floatX;
    let targetY = floatY;
    let targetAngle = Math.sin(tSec * 0.55 + p.phase) * 0.6 + p.phase;
    let proximity = 0;

    if (pointerActive && haloVisibility > 0.02) {
      const dx = floatX - haloX;
      const dy = floatY - haloY;
      const dist = Math.hypot(dx, dy);

      if (dist < magnetRadius) {
        const rawInfluence = 1 - dist / magnetRadius;
        proximity = Math.pow(rawInfluence, 1.35) * haloVisibility;
        const radialAngle = Math.atan2(dy, dx);
        const wave = Math.sin(radialAngle * 3 - tSec * 2.3 + p.phase) * 10;
        const ringR = targetRingRadius + wave;
        const ringX = haloX + Math.cos(radialAngle) * ringR;
        const ringY = haloY + Math.sin(radialAngle) * ringR;

        // Kéo hạt vào vòng hào quang từ tính quanh chuột theo mức độ gần
        const pull = proximity * 0.72;
        targetX = floatX + (ringX - floatX) * pull;
        targetY = floatY + (ringY - floatY) * pull;
        targetAngle = lerpAngle(targetAngle, radialAngle, Math.min(1, proximity * 1.15));
      }
    }

    p.vx = (p.vx + (targetX - p.x) * 0.055 * dtScale) * damping;
    p.vy = (p.vy + (targetY - p.y) * 0.055 * dtScale) * damping;
    p.x += p.vx * dtScale;
    p.y += p.vy * dtScale;
    p.angle = lerpAngle(p.angle, targetAngle, Math.min(1, 0.16 * dtScale));

    const ambientAlpha = (0.11 + 0.08 * p.depth) * alphaScale;
    const activeAlpha = (0.64 * proximity) * alphaScale;
    const alpha = ambientAlpha + activeAlpha;
    if (alpha <= 0.015) continue;

    const scaleLen = 1 + proximity * 0.35;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    drawCapsule(ctx, p.length * scaleLen, p.thickness);
    ctx.fillStyle = rgba(p.color, alpha);
    ctx.fill();
    ctx.restore();
  }
}

export function stepAndDrawSparkles(
  ctx: CanvasRenderingContext2D,
  particles: SparkleParticle[],
  coreColor: RgbColor,
  dtMs: number,
  dtScale: number,
  settings: CursorEffectSettings
): void {
  const alphaScale = INTENSITY_ALPHA_MAP[settings.intensity];
  const drag = Math.pow(0.955, dtScale);

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.age += dtMs;
    const progress = p.age / p.maxAge;
    if (progress >= 1) {
      particles.splice(i, 1);
      continue;
    }

    p.vx *= drag;
    p.vy = p.vy * drag - 0.015 * dtScale;
    p.x += p.vx * dtScale;
    p.y += p.vy * dtScale;
    p.rotation += p.vr * (dtMs / 1000);

    const fadeOut = Math.pow(1 - progress, 1.6);
    const fadeIn = Math.min(1, progress * 6);
    const alpha = fadeIn * fadeOut * alphaScale;

    if (p.kind === 'star') {
      const twinkle = 0.8 + 0.22 * Math.sin(progress * 11 + p.twinklePhase);
      const scale = (1 - progress * 0.35) * twinkle;
      const r = p.size * scale;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      ctx.fillStyle = rgba(p.color, alpha * 0.22);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
      ctx.fill();

      drawFourPointStar(ctx, r);
      ctx.fillStyle = rgba(p.color, alpha * 0.9);
      ctx.fill();

      if (alpha > 0.25) {
        ctx.fillStyle = rgba(coreColor, alpha * 0.85);
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
}


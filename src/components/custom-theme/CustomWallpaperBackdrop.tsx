import { useId } from 'react';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { ILLUSTRATED_WALLPAPERS } from '@/lib/customTheme';

function BuiltInPatternLayer({ patternId }: { patternId: string }) {
  const uid = useId().replace(/:/g, '');

  switch (patternId) {
    case 'pattern-avc-waves':
      return (
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 1200 800">
          <defs>
            <linearGradient id={`${uid}-w1`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgb(var(--color-brand-navy))" stopOpacity="0.16" />
              <stop offset="100%" stopColor="rgb(var(--color-brand-red))" stopOpacity="0.14" />
            </linearGradient>
            <linearGradient id={`${uid}-w2`} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--color-brand-red))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="rgb(var(--color-brand-navy))" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          <rect width="1200" height="800" fill="rgb(var(--color-surface-page))" />
          <path
            d="M0 180 Q320 90 640 200 T1200 160 L1200 0 L0 0 Z"
            fill={`url(#${uid}-w1)`}
          />
          <path
            d="M0 640 Q340 530 680 650 T1200 580 L1200 800 L0 800 Z"
            fill={`url(#${uid}-w2)`}
          />
          <path
            d="M0 420 C260 330 480 510 780 410 C980 340 1100 410 1200 380 L1200 800 L0 800 Z"
            fill="rgb(var(--color-brand-navy))"
            fillOpacity="0.06"
          />
        </svg>
      );

    case 'pattern-grid-notebook':
      return (
        <svg className="h-full w-full">
          <defs>
            <pattern id={`${uid}-grid`} width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgb(var(--color-brand-navy-accent))"
                strokeOpacity="0.12"
                strokeWidth="1"
              />
            </pattern>
            <pattern id={`${uid}-grid-lg`} width="160" height="160" patternUnits="userSpaceOnUse">
              <rect width="160" height="160" fill={`url(#${uid}-grid)`} />
              <path
                d="M 160 0 L 0 0 0 160"
                fill="none"
                stroke="rgb(var(--color-brand-red-accent))"
                strokeOpacity="0.15"
                strokeWidth="1.2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="rgb(var(--color-surface-page))" />
          <rect width="100%" height="100%" fill={`url(#${uid}-grid-lg)`} />
        </svg>
      );

    case 'pattern-mesh-aurora':
      return (
        <div className="relative h-full w-full overflow-hidden bg-surface-page">
          <div className="absolute -left-24 -top-24 h-[520px] w-[520px] rounded-full bg-brand-red/25 blur-3xl" />
          <div className="absolute right-[-120px] top-[12%] h-[540px] w-[540px] rounded-full bg-brand-navyText/25 blur-3xl" />
          <div className="absolute bottom-[-160px] left-[22%] h-[500px] w-[500px] rounded-full bg-brand-navy/25 blur-3xl" />
          <div className="absolute bottom-[10%] right-[20%] h-[360px] w-[360px] rounded-full bg-brand-red/20 blur-3xl" />
        </div>
      );

    case 'pattern-starfield':
      return (
        <svg className="h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 800">
          <defs>
            <radialGradient id={`${uid}-night`} cx="50%" cy="35%" r="75%">
              <stop offset="0%" stopColor="rgb(var(--color-brand-navy))" stopOpacity="0.45" />
              <stop offset="100%" stopColor="rgb(var(--color-surface-page))" stopOpacity="1" />
            </radialGradient>
          </defs>
          <rect width="1200" height="800" fill={`url(#${uid}-night)`} />
          {[
            [110, 90, 2.2], [240, 170, 1.5], [390, 80, 2.6], [510, 210, 1.4],
            [680, 110, 2.4], [830, 180, 1.8], [970, 90, 2.8], [1110, 150, 1.5],
            [160, 340, 1.6], [310, 420, 2.2], [460, 360, 1.4], [620, 480, 2.1],
            [790, 330, 1.5], [910, 440, 2.5], [1070, 390, 1.7], [130, 610, 2.4],
            [290, 690, 1.5], [470, 620, 2.0], [640, 710, 1.6], [820, 640, 2.5],
            [990, 690, 1.8], [1140, 600, 2.2],
          ].map(([cx, cy, r], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={r}
              fill="rgb(var(--color-brand-navy-accent))"
              fillOpacity={idx % 2 === 0 ? 0.65 : 0.35}
            />
          ))}
        </svg>
      );

    case 'pattern-sakura-petals':
      return (
        <svg className="h-full w-full">
          <defs>
            <pattern id={`${uid}-petals`} width="140" height="140" patternUnits="userSpaceOnUse">
              <path
                d="M28 24 Q36 16 42 26 Q34 34 28 24 Z"
                fill="rgb(var(--color-brand-red-accent))"
                fillOpacity="0.22"
              />
              <path
                d="M96 48 Q106 42 110 54 Q100 60 96 48 Z"
                fill="rgb(var(--color-brand-red-accent))"
                fillOpacity="0.16"
              />
              <path
                d="M58 104 Q66 96 72 106 Q63 114 58 104 Z"
                fill="rgb(var(--color-brand-navy-accent))"
                fillOpacity="0.14"
              />
              <circle cx="116" cy="112" r="2.2" fill="rgb(var(--color-brand-red-accent))" fillOpacity="0.2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="rgb(var(--color-surface-page))" />
          <rect width="100%" height="100%" fill={`url(#${uid}-petals)`} />
        </svg>
      );

    case 'pattern-pixel-dots':
    default:
      return (
        <svg className="h-full w-full">
          <defs>
            <pattern id={`${uid}-dots`} width="24" height="24" patternUnits="userSpaceOnUse">
              <circle
                cx="12"
                cy="12"
                r="1.4"
                fill="rgb(var(--color-brand-navy-accent))"
                fillOpacity="0.22"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="rgb(var(--color-surface-page))" />
          <rect width="100%" height="100%" fill={`url(#${uid}-dots)`} />
        </svg>
      );
  }
}

/**
 * Lớp ảnh nền toàn trang (ảnh minh họa, ảnh tải lên hoặc họa tiết vector) với độ mờ & phủ đảm bảo dễ đọc.
 */
export function CustomWallpaperBackdrop() {
  const { customTheme, uploadedWallpaperUrl } = useCustomTheme();

  if (!customTheme.enabled || customTheme.wallpaperKind === 'none') {
    return null;
  }

  let imageSrc: string | null = null;
  if (customTheme.wallpaperKind === 'illustration') {
    const found = ILLUSTRATED_WALLPAPERS.find((w) => w.id === customTheme.wallpaperId);
    imageSrc = found?.src ?? null;
  } else if (customTheme.wallpaperKind === 'upload') {
    imageSrc = uploadedWallpaperUrl;
  }

  if (customTheme.wallpaperKind !== 'pattern' && !imageSrc) {
    return null;
  }

  const blurPx = customTheme.wallpaperBlur;
  const dimOpacity = Math.min(0.85, Math.max(0, customTheme.wallpaperDim / 100));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden print:hidden"
    >
      {customTheme.wallpaperKind === 'pattern' ? (
        <div
          className="h-full w-full transition-all duration-300"
          style={{
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            transform: blurPx > 0 ? 'scale(1.03)' : undefined,
          }}
        >
          <BuiltInPatternLayer patternId={customTheme.wallpaperId} />
        </div>
      ) : (
        <img
          src={imageSrc ?? undefined}
          alt=""
          className="h-full w-full object-cover transition-all duration-300"
          style={{
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            transform: blurPx > 0 ? 'scale(1.04)' : undefined,
          }}
        />
      )}

      {/* Lớp phủ đồng màu nền trang giúp chữ & bảng dữ liệu luôn rõ nét */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundColor: `rgb(var(--color-surface-page) / ${dimOpacity})`,
        }}
      />
    </div>
  );
}

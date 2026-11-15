import { useCustomTheme } from '@/context/CustomThemeContext';
import { useTheme } from '@/context/ThemeContext';
import type { GlassIntensity } from '@/lib/theme';

const INTENSITY_OPACITY_CLASSES: Record<GlassIntensity, string> = {
  subtle: 'opacity-50',
  medium: 'opacity-80',
  strong: 'opacity-100',
};

/**
 * Vệt ánh sáng khuếch tán mềm phía sau giúp các tấm kính iOS có chiều sâu khúc xạ tự nhiên.
 * Chỉ render khi người dùng bật hiệu ứng kính + bật ánh sáng nền và chưa đặt ảnh nền tùy chỉnh.
 */
export function AmbientGlassBackdrop() {
  const { glassSettings } = useTheme();
  const { customTheme } = useCustomTheme();

  if (
    glassSettings.mode === 'none' ||
    !glassSettings.ambientGlow ||
    (customTheme.enabled && customTheme.wallpaperKind !== 'none')
  ) {
    return null;
  }

  const intensityClass = INTENSITY_OPACITY_CLASSES[glassSettings.intensity];

  return (
    <div
      aria-hidden="true"
      className={`glass-ambient-layer pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-300 ${intensityClass}`}
    >
      {/* Đốm sáng Đỏ phía góc trên trái */}
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-red/20 blur-3xl dark:bg-brand-red/25" />
      {/* Đốm sáng Xanh Navy/Sky góc trên phải */}
      <div className="absolute -right-24 top-12 h-96 w-96 rounded-full bg-brand-navyText/20 blur-3xl dark:bg-brand-navyText/20" />
      {/* Đốm sáng phụ phía dưới */}
      <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-brand-navy/15 blur-3xl dark:bg-brand-navy/40" />
    </div>
  );
}


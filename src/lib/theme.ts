export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'avc_theme_mode_v1';
export const DEFAULT_THEME_MODE: ThemeMode = 'light';

export interface ThemeOptionMeta {
  value: ThemeMode;
  label: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOptionMeta[] = [
  {
    value: 'light',
    label: 'Giao diện Sáng',
    description: 'Nền trắng sáng rõ nét, chuẩn nhận diện ban ngày của nhà trường.',
  },
  {
    value: 'dark',
    label: 'Giao diện Tối',
    description: 'Nền xanh đêm dịu mắt, nổi bật chữ và hiệu ứng trong phòng chiếu tối.',
  },
  {
    value: 'system',
    label: 'Theo thiết bị',
    description: 'Tự động đổi Sáng/Tối theo cài đặt của Windows, macOS hoặc điện thoại.',
  },
];

const VALID_THEMES = new Set<ThemeMode>(['light', 'dark', 'system']);

export function sanitizeThemeMode(raw: string | null): ThemeMode {
  if (raw && VALID_THEMES.has(raw as ThemeMode)) {
    return raw as ThemeMode;
  }
  return DEFAULT_THEME_MODE;
}

export function loadThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE;
  try {
    return sanitizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

export function saveThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage
  }
}

export function resolveThemeMode(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return mode;
}

export type GlassMode = 'none' | 'frosted' | 'liquid';
export type GlassIntensity = 'subtle' | 'medium' | 'strong';

export interface GlassSettings {
  mode: GlassMode;
  intensity: GlassIntensity;
  ambientGlow: boolean;
}

export const GLASS_STORAGE_KEY = 'avc_glass_effect_v1';

export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
  mode: 'none',
  intensity: 'medium',
  ambientGlow: true,
};

export interface GlassModeOptionMeta {
  value: GlassMode;
  label: string;
  description: string;
}

export interface GlassIntensityOptionMeta {
  value: GlassIntensity;
  label: string;
  description: string;
}

export const GLASS_MODE_OPTIONS: GlassModeOptionMeta[] = [
  {
    value: 'none',
    label: 'Không hiệu ứng',
    description: 'Giao diện phẳng tiêu chuẩn, sắc nét tối đa và không làm mờ nền (mặc định).',
  },
  {
    value: 'frosted',
    label: 'Kính mờ iOS',
    description: 'Mặt kính mờ sương mịn kiểu iOS, nổi khối thanh lịch mà vẫn dễ đọc chữ.',
  },
  {
    value: 'liquid',
    label: 'Kính lỏng iOS',
    description: 'Trong suốt sâu hơn, viền phản quang sáng cạnh trên và ánh sáng trượt nhẹ khi chạm.',
  },
];

export const GLASS_INTENSITY_OPTIONS: GlassIntensityOptionMeta[] = [
  {
    value: 'subtle',
    label: 'Nhẹ',
    description: 'Mờ dịu, giữ nền đặc cao',
  },
  {
    value: 'medium',
    label: 'Vừa',
    description: 'Cân bằng độ trong chuẩn iOS',
  },
  {
    value: 'strong',
    label: 'Rõ',
    description: 'Xuyên thấu & phản quang nổi bật',
  },
];

const VALID_GLASS_MODES = new Set<GlassMode>(['none', 'frosted', 'liquid']);
const VALID_GLASS_INTENSITIES = new Set<GlassIntensity>(['subtle', 'medium', 'strong']);

export function sanitizeGlassSettings(raw: unknown): GlassSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_GLASS_SETTINGS };
  }
  const obj = raw as Partial<GlassSettings>;
  return {
    mode: obj.mode && VALID_GLASS_MODES.has(obj.mode) ? obj.mode : DEFAULT_GLASS_SETTINGS.mode,
    intensity:
      obj.intensity && VALID_GLASS_INTENSITIES.has(obj.intensity)
        ? obj.intensity
        : DEFAULT_GLASS_SETTINGS.intensity,
    ambientGlow:
      typeof obj.ambientGlow === 'boolean' ? obj.ambientGlow : DEFAULT_GLASS_SETTINGS.ambientGlow,
  };
}

export function loadGlassSettings(): GlassSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_GLASS_SETTINGS };
  try {
    const raw = window.localStorage.getItem(GLASS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GLASS_SETTINGS };
    return sanitizeGlassSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GLASS_SETTINGS };
  }
}

export function saveGlassSettings(settings: GlassSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GLASS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage
  }
}

export function applyGlassClasses(root: HTMLElement, settings: GlassSettings): void {
  root.classList.remove(
    'glass-active',
    'glass-frosted',
    'glass-liquid',
    'glass-subtle',
    'glass-medium',
    'glass-strong',
    'glass-ambient'
  );
  if (settings.mode === 'none') return;
  root.classList.add('glass-active', `glass-${settings.mode}`, `glass-${settings.intensity}`);
  if (settings.ambientGlow) {
    root.classList.add('glass-ambient');
  }
}


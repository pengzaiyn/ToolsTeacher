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


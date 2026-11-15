export type CursorEffectMode = 'none' | 'sparkle' | 'antigravity-halo' | 'antigravity-field';
export type CursorDensity = 'low' | 'medium' | 'high';
export type CursorIntensity = 'subtle' | 'balanced' | 'vivid';
export type CursorColorScheme = 'brand' | 'red' | 'navy';

export interface CursorEffectSettings {
  mode: CursorEffectMode;
  density: CursorDensity;
  intensity: CursorIntensity;
  colorScheme: CursorColorScheme;
  clickRipple: boolean;
}

export const CURSOR_EFFECT_STORAGE_KEY = 'avc_cursor_effect_settings_v1';

export const DEFAULT_CURSOR_EFFECT_SETTINGS: CursorEffectSettings = {
  mode: 'none',
  density: 'medium',
  intensity: 'balanced',
  colorScheme: 'brand',
  clickRipple: true,
};

export interface CursorOptionMeta<T extends string> {
  value: T;
  label: string;
  description: string;
}

export const CURSOR_MODE_OPTIONS: CursorOptionMeta<CursorEffectMode>[] = [
  {
    value: 'none',
    label: 'Không có hiệu ứng',
    description:
      'Mặc định: giữ giao diện tĩnh gọn gàng, không hiển thị hiệu ứng theo con trỏ chuột.',
  },
  {
    value: 'antigravity-halo',
    label: 'Vòng hạt từ tính',
    description:
      'Các hạt viên nang tự xoay hướng kết thành vòng tròn gợn sóng êm quanh con trỏ, giữ nền chữ luôn thoáng sạch.',
  },
  {
    value: 'antigravity-field',
    label: 'Trường hạt lơ lửng',
    description:
      'Rải thưa các hạt viên nang trôi nhẹ khắp màn hình, tự xoay và tụ thành vòng sóng khi con trỏ đi qua.',
  },
  {
    value: 'sparkle',
    label: 'Sao lấp lánh',
    description:
      'Rê chuột rải các ngôi sao 4 cánh cùng bụi sáng nhẹ bay lên rồi tan dần.',
  },
];

export const CURSOR_DENSITY_OPTIONS: CursorOptionMeta<CursorDensity>[] = [
  { value: 'low', label: 'Nhẹ', description: 'Ít hạt, thoáng mắt' },
  { value: 'medium', label: 'Vừa', description: 'Cân đối mượt mà' },
  { value: 'high', label: 'Nhiều', description: 'Dày hạt sống động' },
];

export const CURSOR_INTENSITY_OPTIONS: CursorOptionMeta<CursorIntensity>[] = [
  { value: 'subtle', label: 'Dịu nhẹ', description: 'Mờ nhẹ tinh tế' },
  { value: 'balanced', label: 'Cân bằng', description: 'Hài hòa rõ nét' },
  { value: 'vivid', label: 'Rõ nét', description: 'Nổi bật hơn' },
];

export const CURSOR_COLOR_OPTIONS: CursorOptionMeta<CursorColorScheme>[] = [
  { value: 'brand', label: 'Đỏ + Navy thương hiệu', description: 'Kết hợp hài hòa 2 màu trường' },
  { value: 'red', label: 'Chỉ Đỏ', description: 'Tông đỏ chủ đạo' },
  { value: 'navy', label: 'Chỉ Navy', description: 'Tông xanh navy trầm' },
];

export const DENSITY_SCALE_MAP: Record<CursorDensity, number> = {
  low: 0.65,
  medium: 1,
  high: 1.45,
};

export const INTENSITY_ALPHA_MAP: Record<CursorIntensity, number> = {
  subtle: 0.58,
  balanced: 1,
  vivid: 1.32,
};

const VALID_MODES = new Set<CursorEffectMode>([
  'none',
  'sparkle',
  'antigravity-halo',
  'antigravity-field',
]);
const VALID_DENSITIES = new Set<CursorDensity>(['low', 'medium', 'high']);
const VALID_INTENSITIES = new Set<CursorIntensity>(['subtle', 'balanced', 'vivid']);
const VALID_COLORS = new Set<CursorColorScheme>(['brand', 'red', 'navy']);

/**
 * Chuẩn hóa dữ liệu cài đặt đọc từ localStorage để tránh lỗi khi dữ liệu cũ hoặc bị chỉnh sửa.
 */
export function sanitizeCursorEffectSettings(raw: unknown): CursorEffectSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CURSOR_EFFECT_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    mode: VALID_MODES.has(obj.mode as CursorEffectMode)
      ? (obj.mode as CursorEffectMode)
      : DEFAULT_CURSOR_EFFECT_SETTINGS.mode,
    density: VALID_DENSITIES.has(obj.density as CursorDensity)
      ? (obj.density as CursorDensity)
      : DEFAULT_CURSOR_EFFECT_SETTINGS.density,
    intensity: VALID_INTENSITIES.has(obj.intensity as CursorIntensity)
      ? (obj.intensity as CursorIntensity)
      : DEFAULT_CURSOR_EFFECT_SETTINGS.intensity,
    colorScheme: VALID_COLORS.has(obj.colorScheme as CursorColorScheme)
      ? (obj.colorScheme as CursorColorScheme)
      : DEFAULT_CURSOR_EFFECT_SETTINGS.colorScheme,
    clickRipple:
      typeof obj.clickRipple === 'boolean'
        ? obj.clickRipple
        : DEFAULT_CURSOR_EFFECT_SETTINGS.clickRipple,
  };
}

export function loadCursorEffectSettings(): CursorEffectSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_CURSOR_EFFECT_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(CURSOR_EFFECT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CURSOR_EFFECT_SETTINGS };
    return sanitizeCursorEffectSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CURSOR_EFFECT_SETTINGS };
  }
}

export function saveCursorEffectSettings(settings: CursorEffectSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CURSOR_EFFECT_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage (ví dụ chế độ ẩn danh nghiêm ngặt)
  }
}


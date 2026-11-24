import { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  Check,
  Laptop,
  Monitor,
  Moon,
  Orbit,
  Palette,
  Sparkles,
  Sun,
  SunMoon,
  Waves,
} from 'lucide-react';
import { useCursorEffects } from '@/context/CursorEffectContext';
import { useCustomTheme } from '@/context/CustomThemeContext';
import type { SettingsSectionId } from '@/context/SettingsModalContext';
import { useTheme } from '@/context/ThemeContext';
import { THEME_PACKS } from '@/lib/customTheme';
import {
  CURSOR_COLOR_OPTIONS,
  CURSOR_DENSITY_OPTIONS,
  CURSOR_INTENSITY_OPTIONS,
  CURSOR_MODE_OPTIONS,
  type CursorEffectMode,
} from '@/lib/cursorEffects';
import {
  DEFAULT_THEME_MODE,
  THEME_OPTIONS,
  type ThemeMode,
} from '@/lib/theme';
import { CustomThemeSettingsSection } from '@/components/settings/CustomThemeSettingsSection';
import {
  renderColorSwatch,
  renderThemePreview,
} from '@/components/settings/SettingsPreviews';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

const THEME_ICON_MAP: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Laptop,
};

const CURSOR_ICON_MAP: Record<CursorEffectMode, typeof Sparkles> = {
  'antigravity-halo': Orbit,
  'antigravity-field': Waves,
  sparkle: Sparkles,
  none: Ban,
};

interface SettingsPanelProps {
  activeTab: SettingsSectionId;
  onSelectTab: (tab: SettingsSectionId) => void;
  stickyNavTopClass?: string;
}

/**
 * Hook dùng chung cho thao tác khôi phục toàn bộ cài đặt giao diện mặc định.
 */
export function useResetAppearanceSettings() {
  const { resetSettings } = useCursorEffects();
  const { resetCustomTheme } = useCustomTheme();
  const { setTheme, resetGlassSettings } = useTheme();
  const toast = useToast();

  return useCallback(() => {
    setTheme(DEFAULT_THEME_MODE);
    resetGlassSettings();
    resetCustomTheme();
    resetSettings();
    toast.success('Đã khôi phục toàn bộ cài đặt giao diện mặc định');
  }, [setTheme, resetGlassSettings, resetCustomTheme, resetSettings, toast]);
}

/**
 * Nội dung cài đặt giao diện gồm thanh danh mục bên trái và 3 vùng cấu hình tương ứng.
 */
export function SettingsPanel({
  activeTab,
  onSelectTab,
  stickyNavTopClass = 'lg:top-6',
}: SettingsPanelProps) {
  const { settings, updateSettings } = useCursorEffects();
  const { customTheme } = useCustomTheme();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [deviceWarning, setDeviceWarning] = useState<'touch' | 'reduced-motion' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointerQuery = window.matchMedia('(pointer: fine)');

    const syncDeviceStatus = () => {
      if (reducedMotionQuery.matches) {
        setDeviceWarning('reduced-motion');
      } else if (!finePointerQuery.matches) {
        setDeviceWarning('touch');
      } else {
        setDeviceWarning(null);
      }
    };

    syncDeviceStatus();
    reducedMotionQuery.addEventListener('change', syncDeviceStatus);
    finePointerQuery.addEventListener('change', syncDeviceStatus);
    return () => {
      reducedMotionQuery.removeEventListener('change', syncDeviceStatus);
      finePointerQuery.removeEventListener('change', syncDeviceStatus);
    };
  }, []);

  const isCursorDisabled = settings.mode === 'none';

  const ActiveThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;
  const activeCursorMeta = CURSOR_MODE_OPTIONS.find((opt) => opt.value === settings.mode);
  const activePackMeta = customTheme.activePackId
    ? THEME_PACKS.find((pack) => pack.id === customTheme.activePackId)
    : null;
  const customStatusText = !customTheme.enabled
    ? 'Đang tắt'
    : activePackMeta
      ? activePackMeta.label
      : [
          customTheme.wallpaperKind !== 'none' ? 'Ảnh nền' : null,
          customTheme.accentPreset !== 'default' ? 'Màu riêng' : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Đang bật';

  const navItems: {
    id: SettingsSectionId;
    label: string;
    statusText: string;
    icon: typeof SunMoon;
  }[] = [
    {
      id: 'theme',
      label: 'Chế độ Sáng / Tối',
      statusText:
        theme === 'system'
          ? `Theo máy (${resolvedTheme === 'dark' ? 'Tối' : 'Sáng'})`
          : resolvedTheme === 'dark'
            ? 'Đang bật: Tối'
            : 'Đang bật: Sáng',
      icon: SunMoon,
    },
    {
      id: 'custom',
      label: 'Chủ đề tùy chỉnh',
      statusText: customStatusText,
      icon: Palette,
    },
    {
      id: 'cursor',
      label: 'Hiệu ứng con trỏ chuột',
      statusText:
        settings.mode === 'none' ? 'Đang tắt' : (activeCursorMeta?.label ?? 'Đang bật'),
      icon: Orbit,
    },
  ];

  return (
    /* Bố cục 2 cột: Navbar bên trái + Nội dung tùy chỉnh bên phải */
    <div className="flex flex-col items-start gap-6 lg:flex-row">
      <nav
        aria-label="Danh mục cài đặt"
        className={`flex w-full shrink-0 gap-2 overflow-x-auto rounded-xl border border-line bg-surface-card p-2 lg:sticky ${stickyNavTopClass} lg:w-64 lg:flex-col lg:overflow-visible`}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-left transition-colors lg:w-full ${
                active
                  ? 'bg-brand-navySoft text-brand-navy'
                  : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${active ? 'text-brand-red' : ''}`}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="whitespace-nowrap text-sm font-semibold">{item.label}</span>
                <span className="hidden truncate text-xs font-normal text-ink-muted lg:block">
                  {item.statusText}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-6">
        {/* Mục 1: Chế độ Sáng / Tối */}
        {activeTab === 'theme' && (
          <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-ink-primary">Chế độ giao diện</h2>
                <p className="text-xs font-normal text-ink-muted">
                  Chuyển nhanh Sáng, Tối hoặc tự động theo thiết bị trên toàn bộ trang
                </p>
              </div>

              <Badge tone={resolvedTheme === 'dark' ? 'navy' : 'neutral'} className="gap-1">
                <ActiveThemeIcon className="h-3 w-3" aria-hidden="true" />
                <span>
                  {resolvedTheme === 'dark' ? 'Đang hiển thị: Tối' : 'Đang hiển thị: Sáng'}
                </span>
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {THEME_OPTIONS.map((option) => {
                const Icon = THEME_ICON_MAP[option.value];
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={active}
                    className={`flex flex-col justify-between gap-4 rounded-xl border p-4 text-left transition-all ${
                      active
                        ? 'border-brand-navy bg-brand-navySoft/50 ring-2 ring-brand-navy/20'
                        : 'border-line bg-surface-page hover:border-line-strong hover:bg-surface-card'
                    }`}
                  >
                    {renderThemePreview(option.value)}

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-primary">
                          <Icon className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                          <span>{option.label}</span>
                        </span>

                        {active && (
                          <Badge tone="navy" className="gap-1">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            <span>Đang bật</span>
                          </Badge>
                        )}
                      </div>

                      <span className="text-xs font-normal leading-relaxed text-ink-secondary">
                        {option.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Mục 2: Chủ đề tùy chỉnh */}
        {activeTab === 'custom' && <CustomThemeSettingsSection />}

        {/* Mục 3: Hiệu ứng con trỏ chuột */}
        {activeTab === 'cursor' && (
          <>
            {deviceWarning && (
              <div
                role="status"
                className="flex items-start gap-4 rounded-xl border border-status-warningBorder bg-status-warningBg p-4 text-sm font-normal text-status-warningText"
              >
                <Monitor className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  {deviceWarning === 'reduced-motion'
                    ? 'Trình duyệt hoặc hệ điều hành đang bật chế độ Giảm chuyển động (Reduced Motion), nên hiệu ứng con trỏ tạm ẩn. Lựa chọn của bạn vẫn được lưu lại.'
                    : 'Thiết bị hiện tại dùng màn hình cảm ứng thuần (không có chuột), nên hiệu ứng con trỏ sẽ tự ẩn khi thao tác chạm và tự bật khi mở trên máy tính.'}
                </span>
              </div>
            )}

            <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-ink-primary">Kiểu hiệu ứng con trỏ chuột</h2>
                  <p className="text-xs font-normal text-ink-muted">
                    Áp dụng xuyên suốt toàn bộ trang sau khi chọn
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {CURSOR_MODE_OPTIONS.map((option) => {
                  const Icon = CURSOR_ICON_MAP[option.value];
                  const active = settings.mode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateSettings({ mode: option.value })}
                      aria-pressed={active}
                      className={`flex flex-col justify-between gap-4 rounded-xl border p-4 text-left transition-all ${
                        active
                          ? 'border-brand-navy bg-brand-navySoft/50 ring-2 ring-brand-navy/20'
                          : 'border-line bg-surface-page hover:border-line-strong hover:bg-surface-card'
                      }`}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            active
                              ? 'bg-brand-navy text-white'
                              : 'bg-surface-card text-brand-navy ring-1 ring-line'
                          }`}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>

                        {active && (
                          <Badge tone="navy" className="gap-1">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            <span>Đang bật</span>
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-bold text-ink-primary">{option.label}</span>
                        <span className="text-xs font-normal leading-relaxed text-ink-secondary">
                          {option.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              className={`flex flex-col gap-6 rounded-xl border border-line bg-surface-card p-6 transition-opacity ${
                isCursorDisabled ? 'opacity-60' : ''
              }`}
            >
              <div>
                <h2 className="text-base font-bold text-ink-primary">Tinh chỉnh chi tiết</h2>
                <p className="text-xs font-normal text-ink-muted">
                  {isCursorDisabled
                    ? 'Hãy chọn một kiểu hiệu ứng phía trên để điều chỉnh chi tiết'
                    : 'Mọi thay đổi được lưu tự động ngay lập tức'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {(
                  [
                    {
                      key: 'density',
                      title: 'Mật độ hạt',
                      options: CURSOR_DENSITY_OPTIONS,
                      value: settings.density,
                    },
                    {
                      key: 'intensity',
                      title: 'Độ rõ hiệu ứng',
                      options: CURSOR_INTENSITY_OPTIONS,
                      value: settings.intensity,
                    },
                  ] as const
                ).map((group) => (
                  <div key={group.key} className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-ink-primary">{group.title}</span>
                    <div className="grid grid-cols-3 gap-2">
                      {group.options.map((opt) => {
                        const active = group.value === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={isCursorDisabled}
                            onClick={() => updateSettings({ [group.key]: opt.value })}
                            className={`flex flex-col items-center gap-2 rounded-lg border p-2 text-center transition-colors disabled:cursor-not-allowed ${
                              active
                                ? 'border-brand-navy bg-brand-navySoft text-brand-navy'
                                : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle'
                            }`}
                          >
                            <span className="text-sm font-semibold">{opt.label}</span>
                            <span className="text-xs font-normal text-ink-muted">
                              {opt.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 border-t border-line pt-6 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-ink-primary">
                    Phối màu thương hiệu
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {CURSOR_COLOR_OPTIONS.map((opt) => {
                      const active = settings.colorScheme === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={isCursorDisabled}
                          onClick={() => updateSettings({ colorScheme: opt.value })}
                          className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                            active
                              ? 'border-brand-navy bg-brand-navySoft text-brand-navy'
                              : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle'
                          }`}
                        >
                          {renderColorSwatch(opt.value)}
                          <span>{opt.label.replace(' thương hiệu', '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-page p-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-ink-primary">
                      Gợn sóng khi nhấp chuột
                    </span>
                    <span className="text-xs font-normal text-ink-muted">
                      Tạo gợn sóng lan nhẹ và đẩy hạt tản ra mỗi khi bấm chuột trái
                    </span>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.clickRipple}
                    aria-label="Bật tắt gợn sóng khi nhấp chuột"
                    disabled={isCursorDisabled}
                    onClick={() => updateSettings({ clickRipple: !settings.clickRipple })}
                    className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
                      settings.clickRipple ? 'bg-brand-red' : 'bg-line-strong'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${
                        settings.clickRipple ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}


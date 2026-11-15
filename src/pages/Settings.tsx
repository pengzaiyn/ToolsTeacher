import { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  Laptop,
  Monitor,
  Moon,
  Orbit,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Waves,
} from 'lucide-react';
import { useCursorEffects } from '@/context/CursorEffectContext';
import { useTheme } from '@/context/ThemeContext';
import {
  CURSOR_COLOR_OPTIONS,
  CURSOR_DENSITY_OPTIONS,
  CURSOR_INTENSITY_OPTIONS,
  CURSOR_MODE_OPTIONS,
  type CursorColorScheme,
  type CursorEffectMode,
} from '@/lib/cursorEffects';
import { DEFAULT_THEME_MODE, THEME_OPTIONS, type ThemeMode } from '@/lib/theme';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

const THEME_ICON_MAP: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Laptop,
};

function ThemeMiniCanvas({ dark }: { dark: boolean }) {
  return (
    <div
      className={`flex h-full w-full gap-2 p-2 ${
        dark ? 'bg-ink-card text-white' : 'bg-surface-bright text-ink-card'
      }`}
    >
      {/* Thanh bên thu gọn */}
      <div
        className={`flex w-10 shrink-0 flex-col gap-2 rounded-md border p-2 ${
          dark ? 'border-surface-bright/10 bg-surface-bright/5' : 'border-ink-card/10 bg-ink-card/5'
        }`}
      >
        <span className="h-2 w-4 rounded-sm bg-brand-red" />
        <span
          className={`h-2 w-full rounded-sm ${
            dark ? 'bg-surface-bright/25' : 'bg-brand-navy/80'
          }`}
        />
        <span
          className={`h-2 w-4/5 rounded-sm ${
            dark ? 'bg-surface-bright/15' : 'bg-ink-card/20'
          }`}
        />
      </div>

      {/* Vùng nội dung chính */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`h-2 w-12 rounded-sm ${
              dark ? 'bg-surface-bright/80' : 'bg-brand-navy'
            }`}
          />
          <span className="h-2 w-4 rounded-full bg-brand-red" />
        </div>

        <div
          className={`flex flex-1 flex-col justify-between rounded-md border p-2 ${
            dark
              ? 'border-surface-bright/15 bg-surface-bright/10'
              : 'border-ink-card/10 bg-ink-card/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand-red" />
            <span
              className={`h-2 w-10 rounded-sm ${
                dark ? 'bg-surface-bright/75' : 'bg-ink-card/75'
              }`}
            />
          </div>
          <div className="flex gap-2">
            <span
              className={`h-4 flex-1 rounded ${
                dark ? 'bg-brand-navy/80 ring-1 ring-surface-bright/15' : 'bg-brand-navy/15'
              }`}
            />
            <span
              className={`h-4 flex-1 rounded ${
                dark ? 'bg-brand-red/25 ring-1 ring-brand-red/40' : 'bg-brand-red/15'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function renderThemePreview(mode: ThemeMode) {
  if (mode === 'system') {
    return (
      <div
        aria-hidden="true"
        className="relative flex h-24 w-full overflow-hidden rounded-lg border border-line"
      >
        <div className="h-full w-1/2 overflow-hidden">
          <div className="h-full w-[200%]">
            <ThemeMiniCanvas dark={false} />
          </div>
        </div>
        <div className="h-full w-1/2 overflow-hidden border-l border-line-strong">
          <div className="h-full w-[200%] -translate-x-1/2">
            <ThemeMiniCanvas dark={true} />
          </div>
        </div>
        <span className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-white shadow-sm ring-2 ring-surface-card">
          <Laptop className="h-3 w-3" />
        </span>
      </div>
    );
  }

  const isDarkPreview = mode === 'dark';
  const PreviewIcon = isDarkPreview ? Moon : Sun;

  return (
    <div
      aria-hidden="true"
      className="relative h-24 w-full overflow-hidden rounded-lg border border-line"
    >
      <ThemeMiniCanvas dark={isDarkPreview} />
      <span
        className={`absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full shadow-sm ring-1 ${
          isDarkPreview
            ? 'bg-ink-card/90 text-white ring-surface-bright/20'
            : 'bg-surface-bright/90 text-brand-red ring-ink-card/10'
        }`}
      >
        <PreviewIcon className="h-3 w-3" />
      </span>
    </div>
  );
}

const MODE_ICON_MAP: Record<CursorEffectMode, typeof Sparkles> = {
  'antigravity-halo': Orbit,
  'antigravity-field': Waves,
  sparkle: Sparkles,
  none: Ban,
};

function renderColorSwatch(scheme: CursorColorScheme) {
  if (scheme === 'red') {
    return <span className="h-3 w-3 rounded-full bg-brand-red" aria-hidden="true" />;
  }
  if (scheme === 'navy') {
    return <span className="h-3 w-3 rounded-full bg-brand-navy" aria-hidden="true" />;
  }
  return (
    <span className="flex items-center -space-x-1" aria-hidden="true">
      <span className="h-3 w-3 rounded-full bg-brand-red ring-2 ring-surface-card" />
      <span className="h-3 w-3 rounded-full bg-brand-navy ring-2 ring-surface-card" />
    </span>
  );
}

export function Settings() {
  const { settings, updateSettings, resetSettings } = useCursorEffects();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const toast = useToast();
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

  const isDisabled = settings.mode === 'none';

  function handleReset() {
    setTheme(DEFAULT_THEME_MODE);
    resetSettings();
    toast.success('Đã khôi phục cài đặt giao diện mặc định');
  }

  const ActiveThemeIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <Layout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-navySoft text-brand-navy">
              <SlidersHorizontal className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-brand-navy">Cài đặt giao diện</h1>
              <p className="text-sm font-normal text-ink-secondary">
                Tùy chỉnh chế độ Sáng/Tối và hiệu ứng con trỏ chuột theo ý thích, tự lưu riêng trên trình duyệt này
              </p>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Khôi phục mặc định</span>
          </Button>
        </div>

        {/* Chế độ Sáng / Tối */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink-primary">Chế độ giao diện</h2>
              <p className="text-xs font-normal text-ink-muted">
                Chuyển nhanh Sáng, Tối hoặc tự động theo thiết bị trên toàn bộ AVC Connect
              </p>
            </div>

            <Badge tone={resolvedTheme === 'dark' ? 'navy' : 'neutral'} className="gap-1">
              <ActiveThemeIcon className="h-3 w-3" aria-hidden="true" />
              <span>{resolvedTheme === 'dark' ? 'Đang hiển thị: Tối' : 'Đang hiển thị: Sáng'}</span>
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

        {/* Chọn chế độ hiệu ứng */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink-primary">Kiểu hiệu ứng con trỏ chuột</h2>
              <p className="text-xs font-normal text-ink-muted">
                Áp dụng xuyên suốt toàn bộ trang AVC Connect sau khi chọn
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CURSOR_MODE_OPTIONS.map((option) => {
              const Icon = MODE_ICON_MAP[option.value];
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

        {/* Tùy chỉnh thông số */}
        <section
          className={`flex flex-col gap-6 rounded-xl border border-line bg-surface-card p-6 transition-opacity ${
            isDisabled ? 'opacity-60' : ''
          }`}
        >
          <div>
            <h2 className="text-base font-bold text-ink-primary">Tinh chỉnh chi tiết</h2>
            <p className="text-xs font-normal text-ink-muted">
              {isDisabled
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
                        disabled={isDisabled}
                        onClick={() => updateSettings({ [group.key]: opt.value })}
                        className={`flex flex-col items-center gap-2 rounded-lg border p-2 text-center transition-colors disabled:cursor-not-allowed ${
                          active
                            ? 'border-brand-navy bg-brand-navySoft text-brand-navy'
                            : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle'
                        }`}
                      >
                        <span className="text-sm font-semibold">{opt.label}</span>
                        <span className="text-xs font-normal text-ink-muted">{opt.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 border-t border-line pt-6 md:grid-cols-2">
            {/* Phối màu */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink-primary">Phối màu thương hiệu</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CURSOR_COLOR_OPTIONS.map((opt) => {
                  const active = settings.colorScheme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isDisabled}
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

            {/* Gợn sóng click */}
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
                disabled={isDisabled}
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
      </div>
    </Layout>
  );
}

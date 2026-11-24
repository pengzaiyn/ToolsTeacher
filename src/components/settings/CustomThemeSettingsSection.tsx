import { useRef, useState, type ChangeEvent } from 'react';
import {
  Ban,
  Check,
  ImagePlus,
  Palette,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  ACCENT_PRESETS,
  ILLUSTRATED_WALLPAPERS,
  PATTERN_WALLPAPERS,
  THEME_PACKS,
} from '@/lib/customTheme';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

type CustomStudioTab = 'packs' | 'accent' | 'wallpaper';

const STUDIO_TABS: { id: CustomStudioTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'packs', label: 'Bộ phối sẵn', icon: Wand2 },
  { id: 'accent', label: 'Bảng màu nhấn', icon: Palette },
  { id: 'wallpaper', label: 'Ảnh nền', icon: ImagePlus },
];

export function CustomThemeSettingsSection() {
  const {
    customTheme,
    uploadedWallpaperUrl,
    updateCustomTheme,
    applyThemePack,
    setUploadedWallpaper,
    removeUploadedWallpaper,
  } = useCustomTheme();
  const { setTheme } = useTheme();
  const toast = useToast();

  const [studioTab, setStudioTab] = useState<CustomStudioTab>('packs');
  const [syncPackAtmosphere, setSyncPackAtmosphere] = useState(true);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete-upload' | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasWallpaper = customTheme.wallpaperKind !== 'none';

  const handleApplyPack = (packId: string) => {
    const pack = THEME_PACKS.find((item) => item.id === packId);
    const outcome = applyThemePack(packId);
    if (!outcome || !pack) return;

    if (syncPackAtmosphere && outcome.recommendedThemeMode) {
      setTheme(outcome.recommendedThemeMode);
    }
    toast.success(`Đã áp dụng chủ đề "${pack.label}"`);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingWallpaper(true);
    try {
      await setUploadedWallpaper(file);
      toast.success('Đã tải lên và áp dụng ảnh nền riêng');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải ảnh nền lên.');
    } finally {
      setUploadingWallpaper(false);
    }
  };

  const handleConfirm = async () => {
    if (confirmAction === 'delete-upload') {
      await removeUploadedWallpaper();
      toast.success('Đã xóa ảnh nền tải lên từ thiết bị');
    }
    setConfirmAction(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Thẻ tổng quan & công tắc bật/tắt Chủ đề tùy chỉnh */}
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-ink-primary">Chủ đề tùy chỉnh cá nhân</h2>
              <Badge tone={customTheme.enabled ? 'navy' : 'neutral'} className="gap-2">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>{customTheme.enabled ? 'Đang bật' : 'Đang tắt'}</span>
              </Badge>
            </div>
            <p className="text-xs font-normal text-ink-muted">
              Cá nhân hóa màu nhấn và ảnh nền mà không làm ảnh hưởng giao diện mặc định khi tắt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={customTheme.enabled}
              aria-label="Bật tắt chủ đề tùy chỉnh"
              onClick={() => updateCustomTheme({ enabled: !customTheme.enabled })}
              className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-colors ${
                customTheme.enabled ? 'bg-brand-red' : 'bg-line-strong'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${
                  customTheme.enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Thanh điều hướng con 3 mục trong Custom Theme */}
        <div
          role="tablist"
          aria-label="Thành phần chủ đề tùy chỉnh"
          className="flex gap-2 overflow-x-auto border-t border-line pt-4"
        >
          {STUDIO_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = studioTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStudioTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-brand-navy bg-brand-navySoft text-brand-navy'
                    : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? 'text-brand-red' : ''}`}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Mục con 1: Bộ phối sẵn (Theme Packs) */}
      {studioTab === 'packs' && (
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-ink-primary">Bộ chủ đề phối sẵn</h3>
              <p className="text-xs font-normal text-ink-muted">
                Áp dụng nhanh trong 1 chạm đầy đủ màu sắc và ảnh nền đồng điệu
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-page px-4 py-2 text-xs font-semibold text-ink-secondary">
              <input
                type="checkbox"
                checked={syncPackAtmosphere}
                onChange={(e) => setSyncPackAtmosphere(e.target.checked)}
                className="h-4 w-4 accent-brand-red"
              />
              <span>Tự đồng bộ Sáng/Tối theo gói</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {THEME_PACKS.map((pack) => {
              const active =
                pack.id === 'pack-default'
                  ? !customTheme.enabled
                  : customTheme.enabled && customTheme.activePackId === pack.id;
              const accent = ACCENT_PRESETS.find((a) => a.id === pack.settings.accentPreset);
              const wall = ILLUSTRATED_WALLPAPERS.find((w) => w.id === pack.settings.wallpaperId);

              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => handleApplyPack(pack.id)}
                  className={`flex flex-col justify-between gap-4 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-brand-navy bg-brand-navySoft/40 ring-2 ring-brand-navy/20'
                      : 'border-line bg-surface-page hover:border-line-strong hover:bg-surface-card'
                  }`}
                >
                  {/* Khung xem trước trực quan của gói */}
                  <div className="relative h-28 w-full overflow-hidden rounded-lg border border-line bg-surface-card">
                    {wall?.src ? (
                      <img
                        src={wall.src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-surface-subtle text-xs font-semibold text-ink-muted">
                        Chuẩn nhận diện Việt Mỹ
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-card/65 via-transparent to-transparent" />

                    {/* Các chấm màu nhấn của gói */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 rounded-full bg-surface-card/90 px-2 py-1 shadow-sm backdrop-blur-sm">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: accent?.primaryHex ?? '#C8102E' }}
                        />
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: accent?.secondaryHex ?? '#1A365D' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-ink-primary">{pack.label}</span>
                      {active && (
                        <Badge tone="navy" className="gap-1">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span>Đang dùng</span>
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-normal leading-relaxed text-ink-secondary">
                      {pack.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Mục con 2: Bảng màu nhấn */}
      {studioTab === 'accent' && (
        <section className="flex flex-col gap-6 rounded-xl border border-line bg-surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink-primary">Bảng màu nhấn toàn trang</h3>
              <p className="text-xs font-normal text-ink-muted">
                Thay đổi màu nút bấm, mục đang chọn, viền nhấn và thẻ thông báo trong chế độ Sáng lẫn Tối
              </p>
            </div>
            {!customTheme.enabled && (
              <Badge tone="warning">Chọn một bảng màu sẽ tự bật Chủ đề tùy chỉnh</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ACCENT_PRESETS.map((preset) => {
              const active = customTheme.accentPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    updateCustomTheme({
                      enabled: preset.id === 'default' ? customTheme.enabled : true,
                      accentPreset: preset.id,
                    })
                  }
                  className={`flex flex-col justify-between gap-4 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-brand-navy bg-brand-navySoft/50 ring-2 ring-brand-navy/20'
                      : 'border-line bg-surface-page hover:border-line-strong hover:bg-surface-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center -space-x-2">
                      <span
                        className="h-6 w-6 rounded-full ring-2 ring-surface-card"
                        style={{
                          backgroundColor:
                            preset.id === 'custom'
                              ? customTheme.customPrimaryHex
                              : preset.primaryHex,
                        }}
                      />
                      <span
                        className="h-6 w-6 rounded-full ring-2 ring-surface-card"
                        style={{
                          backgroundColor:
                            preset.id === 'custom'
                              ? customTheme.customSecondaryHex
                              : preset.secondaryHex,
                        }}
                      />
                    </div>
                    {active && <Check className="h-4 w-4 text-brand-navy" aria-hidden="true" />}
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-ink-primary">{preset.label}</span>
                    <span className="text-xs font-normal leading-relaxed text-ink-secondary">
                      {preset.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {customTheme.accentPreset === 'custom' && (
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-page p-4 md:grid-cols-2">
              <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface-card p-4">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-ink-primary">Màu nhấn chính</span>
                  <span className="text-xs font-normal text-ink-muted">
                    Áp dụng cho nút hành động chính, badge nổi bật ({customTheme.customPrimaryHex})
                  </span>
                </div>
                <input
                  type="color"
                  value={customTheme.customPrimaryHex}
                  onChange={(e) =>
                    updateCustomTheme({
                      enabled: true,
                      accentPreset: 'custom',
                      customPrimaryHex: e.target.value,
                    })
                  }
                  aria-label="Chọn màu nhấn chính"
                  className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-transparent p-1"
                />
              </label>

              <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface-card p-4">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-ink-primary">Màu bổ trợ</span>
                  <span className="text-xs font-normal text-ink-muted">
                    Áp dụng cho tiêu đề, tab đang chọn, nút phụ ({customTheme.customSecondaryHex})
                  </span>
                </div>
                <input
                  type="color"
                  value={customTheme.customSecondaryHex}
                  onChange={(e) =>
                    updateCustomTheme({
                      enabled: true,
                      accentPreset: 'custom',
                      customSecondaryHex: e.target.value,
                    })
                  }
                  aria-label="Chọn màu bổ trợ"
                  className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-transparent p-1"
                />
              </label>
            </div>
          )}
        </section>
      )}

      {/* Mục con 3: Ảnh nền & độ phủ dễ đọc */}
      {studioTab === 'wallpaper' && (
        <div className="flex flex-col gap-6">
          {/* Thanh trượt độ phủ & làm mờ + tải ảnh lên */}
          <section className="flex flex-col gap-6 rounded-xl border border-line bg-surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-ink-primary">Tùy chỉnh hiển thị ảnh nền</h3>
                <p className="text-xs font-normal text-ink-muted">
                  Tải ảnh cá nhân hoặc điều chỉnh lớp phủ để chữ và bảng thời khóa biểu luôn rõ nét
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  loading={uploadingWallpaper}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>Tải ảnh từ máy</span>
                </Button>

                {hasWallpaper && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateCustomTheme({ wallpaperKind: 'none', wallpaperId: 'none' })
                    }
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    <span>Tắt ảnh nền</span>
                  </Button>
                )}
              </div>
            </div>

            {uploadedWallpaperUrl && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-page p-4">
                <div className="flex items-center gap-4">
                  <img
                    src={uploadedWallpaperUrl}
                    alt="Ảnh nền đã tải lên"
                    className="h-16 w-28 rounded-lg border border-line object-cover"
                  />
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-ink-primary">
                      Ảnh nền riêng của bạn
                    </span>
                    <span className="text-xs font-normal text-ink-muted">
                      Đã lưu cục bộ trên trình duyệt này
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={customTheme.wallpaperKind === 'upload' ? 'navy' : 'secondary'}
                    size="sm"
                    onClick={() =>
                      updateCustomTheme({
                        enabled: true,
                        wallpaperKind: 'upload',
                        wallpaperId: 'user-upload',
                      })
                    }
                  >
                    {customTheme.wallpaperKind === 'upload' ? 'Đang áp dụng' : 'Dùng ảnh này'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmAction('delete-upload')}
                    aria-label="Xóa ảnh nền đã tải lên"
                  >
                    <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm font-semibold text-ink-primary">
                  <span>Độ phủ dễ đọc (che bớt chi tiết)</span>
                  <span className="text-brand-navy">{customTheme.wallpaperDim}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={85}
                  step={5}
                  value={customTheme.wallpaperDim}
                  onChange={(e) =>
                    updateCustomTheme({ wallpaperDim: Number(e.target.value) })
                  }
                  className="w-full accent-brand-red"
                />
                <span className="text-xs font-normal text-ink-muted">
                  Tăng lên 40% - 65% nếu nền có nhiều chi tiết sáng tối.
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm font-semibold text-ink-primary">
                  <span>Độ làm mờ hậu cảnh</span>
                  <span className="text-brand-navy">{customTheme.wallpaperBlur}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={16}
                  step={1}
                  value={customTheme.wallpaperBlur}
                  onChange={(e) =>
                    updateCustomTheme({ wallpaperBlur: Number(e.target.value) })
                  }
                  className="w-full accent-brand-red"
                />
                <span className="text-xs font-normal text-ink-muted">
                  Làm mờ nhẹ ảnh nền để tạo chiều sâu phía sau thẻ nội dung.
                </span>
              </label>
            </div>
          </section>

          {/* Kho ảnh minh họa */}
          <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
            <div>
              <h3 className="text-base font-bold text-ink-primary">
                Kho ảnh minh họa ({ILLUSTRATED_WALLPAPERS.length})
              </h3>
              <p className="text-xs font-normal text-ink-muted">
                Các khung cảnh góc học tập, thiên nhiên, không gian đêm độ phân giải cao
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ILLUSTRATED_WALLPAPERS.map((wall) => {
                const active =
                  customTheme.enabled &&
                  customTheme.wallpaperKind === 'illustration' &&
                  customTheme.wallpaperId === wall.id;
                return (
                  <button
                    key={wall.id}
                    type="button"
                    onClick={() =>
                      updateCustomTheme({
                        enabled: true,
                        wallpaperKind: 'illustration',
                        wallpaperId: wall.id,
                      })
                    }
                    className={`flex flex-col gap-4 rounded-xl border p-2 text-left transition-all ${
                      active
                        ? 'border-brand-navy bg-brand-navySoft/50 ring-2 ring-brand-navy/20'
                        : 'border-line bg-surface-page hover:border-line-strong hover:bg-surface-card'
                    }`}
                  >
                    <div
                      className={`relative h-28 w-full overflow-hidden rounded-lg bg-gradient-to-br ${wall.previewGradient}`}
                    >
                      {wall.src && (
                        <img
                          src={wall.src}
                          alt={wall.label}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                      {active && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-white shadow">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 px-2 pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink-primary">{wall.label}</span>
                        <Badge tone={wall.recommendedTheme === 'dark' ? 'navy' : 'neutral'}>
                          {wall.recommendedTheme === 'dark' ? 'Hợp nền tối' : 'Hợp nền sáng'}
                        </Badge>
                      </div>
                      <span className="text-xs font-normal text-ink-secondary">
                        {wall.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Kho họa tiết vector nhẹ tối đa */}
          <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
            <div>
              <h3 className="text-base font-bold text-ink-primary">
                Họa tiết vector tối giản ({PATTERN_WALLPAPERS.length})
              </h3>
              <p className="text-xs font-normal text-ink-muted">
                Tải tức thì, tự đổi sắc độ theo bảng màu nhấn bạn đang chọn
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PATTERN_WALLPAPERS.map((pat) => {
                const active =
                  customTheme.enabled &&
                  customTheme.wallpaperKind === 'pattern' &&
                  customTheme.wallpaperId === pat.id;
                return (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() =>
                      updateCustomTheme({
                        enabled: true,
                        wallpaperKind: 'pattern',
                        wallpaperId: pat.id,
                      })
                    }
                    className={`flex flex-col justify-between gap-4 rounded-xl border p-4 text-left transition-all ${
                      active
                        ? 'border-brand-navy bg-brand-navySoft/50 ring-2 ring-brand-navy/20'
                        : 'border-line bg-surface-page hover:border-line-strong hover:bg-surface-card'
                    }`}
                  >
                    <div
                      className={`relative h-16 w-full overflow-hidden rounded-lg border border-line bg-gradient-to-br ${pat.previewGradient}`}
                    >
                      {active && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-white shadow">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-ink-primary">{pat.label}</span>
                      <span className="text-xs font-normal text-ink-secondary">
                        {pat.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title="Xóa ảnh nền đã tải lên?"
        message="Ảnh nền tải từ thiết bị sẽ bị xóa khỏi bộ nhớ trình duyệt hiện tại."
        confirmLabel="Xóa ảnh"
        confirmVariant="danger"
      />
    </div>
  );
}

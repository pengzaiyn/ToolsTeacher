import { useRef, useState, type ChangeEvent } from 'react';
import {
  Ban,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  Layers,
  LayoutGrid,
  Lock,
  MousePointer2,
  Palette,
  PawPrint,
  RotateCcw,
  Sparkles,
  Sticker,
  Trash2,
  Unlock,
  Upload,
  Wand2,
} from 'lucide-react';
import { useCustomTheme } from '@/context/CustomThemeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  ACCENT_PRESETS,
  ILLUSTRATED_WALLPAPERS,
  MAX_PLACED_STICKERS,
  PATTERN_WALLPAPERS,
  PET_CATALOG,
  STICKER_CATALOG,
  STICKER_CATEGORIES,
  THEME_PACKS,
  type PetBehavior,
  type PetSize,
  type StickerCategory,
  type StickerSize,
} from '@/lib/customTheme';
import { PetArtwork } from '@/components/custom-theme/PetArtwork';
import { StickerArtwork } from '@/components/custom-theme/StickerArtwork';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

type CustomStudioTab = 'packs' | 'accent' | 'wallpaper' | 'stickers' | 'pet';

const STUDIO_TABS: { id: CustomStudioTab; label: string; icon: typeof Sparkles }[] = [
  { id: 'packs', label: 'Bộ phối sẵn', icon: Wand2 },
  { id: 'accent', label: 'Bảng màu nhấn', icon: Palette },
  { id: 'wallpaper', label: 'Ảnh nền', icon: ImagePlus },
  { id: 'stickers', label: 'Sticker', icon: Sticker },
  { id: 'pet', label: 'Thú cưng', icon: PawPrint },
];

const PET_BEHAVIOR_OPTIONS: { value: PetBehavior; label: string; description: string }[] = [
  { value: 'roam', label: 'Đi dạo mép dưới', description: 'Tự đi dạo êm ái và nghỉ ngơi định kỳ' },
  { value: 'perch', label: 'Ngồi cố định', description: 'Kéo thả đặt ở bất kỳ góc nào bạn thích' },
  { value: 'follow', label: 'Đi theo chuột', description: 'Nhẹ nhàng theo sau con trỏ trên máy tính' },
];

const SIZE_OPTIONS: { value: PetSize | StickerSize; label: string }[] = [
  { value: 'sm', label: 'Nhỏ' },
  { value: 'md', label: 'Vừa' },
  { value: 'lg', label: 'Lớn' },
];

export function CustomThemeSettingsSection() {
  const {
    customTheme,
    uploadedWallpaperUrl,
    updateCustomTheme,
    updatePetSettings,
    applyThemePack,
    addSticker,
    updateSticker,
    removeSticker,
    clearStickers,
    tidyStickersToCorners,
    setUploadedWallpaper,
    removeUploadedWallpaper,
    toggleDecorationsHidden,
  } = useCustomTheme();
  const { setTheme, glassSettings, updateGlassSettings } = useTheme();
  const toast = useToast();

  const [studioTab, setStudioTab] = useState<CustomStudioTab>('packs');
  const [stickerCategory, setStickerCategory] = useState<'all' | StickerCategory>('all');
  const [syncPackAtmosphere, setSyncPackAtmosphere] = useState(true);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clear-stickers' | 'delete-upload' | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredStickers =
    stickerCategory === 'all'
      ? STICKER_CATALOG
      : STICKER_CATALOG.filter((item) => item.category === stickerCategory);

  const selectedPetMeta =
    PET_CATALOG.find((item) => item.id === customTheme.pet.id) ?? null;

  const hasWallpaper = customTheme.wallpaperKind !== 'none';
  const hasDecorations = customTheme.stickers.length > 0 || customTheme.pet.id !== 'none';

  const handleApplyPack = (packId: string) => {
    const pack = THEME_PACKS.find((item) => item.id === packId);
    const outcome = applyThemePack(packId);
    if (!outcome || !pack) return;

    if (syncPackAtmosphere) {
      if (outcome.recommendedThemeMode) {
        setTheme(outcome.recommendedThemeMode);
      }
      if (outcome.recommendedGlass) {
        updateGlassSettings({ mode: outcome.recommendedGlass });
      }
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

  const handleAddSticker = (stickerId: (typeof STICKER_CATALOG)[number]['id'], label: string) => {
    const ok = addSticker(stickerId);
    if (!ok) {
      toast.error(`Tối đa ${MAX_PLACED_STICKERS} sticker cùng lúc để giao diện luôn mượt.`);
      return;
    }
    toast.success(`Đã gắn sticker "${label}" lên màn hình`);
  };

  const handleConfirm = async () => {
    if (confirmAction === 'clear-stickers') {
      clearStickers();
      toast.success('Đã gỡ toàn bộ sticker khỏi màn hình');
    } else if (confirmAction === 'delete-upload') {
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
              Cá nhân hóa màu nhấn, ảnh nền, bộ sticker kéo thả và thú cưng đồng hành mà không làm ảnh hưởng giao diện mặc định khi tắt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {customTheme.enabled && hasDecorations && (
              <Button variant="secondary" size="sm" onClick={toggleDecorationsHidden}>
                {customTheme.decorationsHidden ? (
                  <>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    <span>Hiện sticker &amp; pet</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    <span>Ẩn tạm thời</span>
                  </>
                )}
              </Button>
            )}

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

        {/* Thanh điều hướng con 5 mục trong Custom Theme */}
        <div
          role="tablist"
          aria-label="Thành phần chủ đề tùy chỉnh"
          className="flex gap-2 overflow-x-auto border-t border-line pt-4"
        >
          {STUDIO_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = studioTab === tab.id;
            let countBadge: string | null = null;
            if (tab.id === 'stickers' && customTheme.stickers.length > 0) {
              countBadge = `${customTheme.stickers.length}`;
            } else if (tab.id === 'pet' && customTheme.pet.id !== 'none') {
              countBadge = '1';
            }
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
                {countBadge && (
                  <span className="rounded-full bg-brand-red px-2 text-xs font-bold text-white">
                    {countBadge}
                  </span>
                )}
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
                Áp dụng nhanh trong 1 chạm đầy đủ màu sắc, ảnh nền, sticker và thú cưng đồng điệu
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-page px-4 py-2 text-xs font-semibold text-ink-secondary">
              <input
                type="checkbox"
                checked={syncPackAtmosphere}
                onChange={(e) => setSyncPackAtmosphere(e.target.checked)}
                className="h-4 w-4 accent-brand-red"
              />
              <span>Tự đồng bộ Sáng/Tối &amp; Kính iOS theo gói</span>
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
              const pet = PET_CATALOG.find((p) => p.id === pack.settings.pet?.id);

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

                    {/* Các chấm màu + pet + sticker mini */}
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
                        {pack.settings.stickers && pack.settings.stickers.length > 0 && (
                          <span className="text-xs font-semibold text-ink-primary">
                            +{pack.settings.stickers.length} sticker
                          </span>
                        )}
                      </div>

                      {pet && (
                        <div className="h-10 w-10 rounded-full bg-surface-card/90 p-1 shadow-sm backdrop-blur-sm">
                          <PetArtwork petId={pet.id} mood="idle" />
                        </div>
                      )}
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
          {hasWallpaper && glassSettings.mode === 'none' && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brand-navy/20 bg-brand-navySoft p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Mẹo: Bật thêm Hiệu ứng Kính mờ iOS để các thẻ nội dung xuyên thấu ảnh nền lung linh hơn.
                </span>
              </div>
              <Button
                variant="navy"
                size="sm"
                onClick={() => {
                  updateGlassSettings({ mode: 'frosted' });
                  toast.success('Đã bật Kính mờ iOS kết hợp ảnh nền');
                }}
              >
                Bật Kính mờ iOS
              </Button>
            </div>
          )}

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

      {/* Mục con 4: Kho Sticker kéo thả */}
      {studioTab === 'stickers' && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-ink-primary">
                  Kho Sticker trang trí ({STICKER_CATALOG.length})
                </h3>
                <p className="text-xs font-normal text-ink-muted">
                  Bấm vào sticker để gắn lên màn hình, sau đó kéo thả tự do hoặc bấm trực tiếp để xoay/đổi cỡ
                </p>
              </div>
              <Badge tone="navy">
                Đang gắn: {customTheme.stickers.length}/{MAX_PLACED_STICKERS}
              </Badge>
            </div>

            {/* Bộ lọc nhóm sticker */}
            <div className="flex flex-wrap gap-2">
              {STICKER_CATEGORIES.map((cat) => {
                const active = stickerCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setStickerCategory(cat.id)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-brand-navy bg-brand-navy text-white'
                        : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Lưới 24 sticker */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {filteredStickers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddSticker(item.id, item.label)}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-line bg-surface-page p-4 text-center transition-all hover:border-brand-navy hover:bg-brand-navySoft/40"
                >
                  <div className="h-16 w-16 transition-transform group-hover:scale-110">
                    <StickerArtwork stickerId={item.id} />
                  </div>
                  <span className="text-xs font-semibold text-ink-primary">{item.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Quản lý sticker đang gắn */}
          <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-ink-primary">Sticker đang gắn trên màn hình</h3>
                <p className="text-xs font-normal text-ink-muted">
                  Khóa kéo thả khi đã xếp vừa ý để thao tác chuột xuyên qua sticker vào bảng biểu bên dưới
                </p>
              </div>

              {customTheme.stickers.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={customTheme.stickersLocked ? 'navy' : 'secondary'}
                    size="sm"
                    onClick={() =>
                      updateCustomTheme({ stickersLocked: !customTheme.stickersLocked })
                    }
                  >
                    {customTheme.stickersLocked ? (
                      <>
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        <span>Đang khóa vị trí</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4" aria-hidden="true" />
                        <span>Cho phép kéo thả</span>
                      </>
                    )}
                  </Button>

                  <Button variant="secondary" size="sm" onClick={tidyStickersToCorners}>
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    <span>Xếp gọn các góc</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmAction('clear-stickers')}
                  >
                    <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                    <span>Gỡ hết</span>
                  </Button>
                </div>
              )}
            </div>

            {customTheme.stickers.length === 0 ? (
              <EmptyState
                icon={Sticker}
                title="Chưa có sticker nào trên màn hình"
                description="Hãy chọn các sticker yêu thích ở danh sách phía trên để bắt đầu trang trí."
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {customTheme.stickers.map((placed) => {
                  const meta = STICKER_CATALOG.find((s) => s.id === placed.stickerId);
                  return (
                    <div
                      key={placed.instanceId}
                      className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-page p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 shrink-0">
                          <StickerArtwork stickerId={placed.stickerId} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-bold text-ink-primary">
                            {meta?.label ?? placed.stickerId}
                          </span>
                          <div className="flex gap-2">
                            {SIZE_OPTIONS.map((sz) => (
                              <button
                                key={sz.value}
                                type="button"
                                onClick={() =>
                                  updateSticker(placed.instanceId, { size: sz.value })
                                }
                                className={`rounded border px-2 py-1 text-xs font-semibold ${
                                  placed.size === sz.value
                                    ? 'border-brand-navy bg-brand-navySoft text-brand-navy'
                                    : 'border-line bg-surface-card text-ink-muted hover:text-ink-primary'
                                }`}
                              >
                                {sz.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateSticker(placed.instanceId, { rotation: 0, flipX: false })
                          }
                          aria-label="Đặt thẳng góc xoay"
                          title="Đặt thẳng"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-card text-ink-secondary hover:bg-surface-subtle"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSticker(placed.instanceId)}
                          aria-label="Gỡ sticker này"
                          title="Gỡ sticker"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-card text-brand-red hover:bg-brand-redSoft"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Mục con 5: Thú cưng đồng hành (Pet) */}
      {studioTab === 'pet' && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-ink-primary">
                  Chọn Thú cưng đồng hành ({PET_CATALOG.length})
                </h3>
                <p className="text-xs font-normal text-ink-muted">
                  Bấm trực tiếp vào thú cưng trên màn hình để vuốt ve, cho ăn vặt hoặc nghe lời động viên học tập
                </p>
              </div>
              {customTheme.pet.id !== 'none' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updatePetSettings({ id: 'none' })}
                >
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  <span>Tắt thú cưng</span>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PET_CATALOG.map((pet) => {
                const active = customTheme.enabled && customTheme.pet.id === pet.id;
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() =>
                      updatePetSettings({
                        id: pet.id,
                        name: customTheme.pet.name || pet.label,
                      })
                    }
                    className={`flex flex-col justify-between gap-4 rounded-xl border p-4 text-left transition-all ${
                      active
                        ? 'border-brand-navy bg-brand-navySoft/50 ring-2 ring-brand-navy/20'
                        : 'border-line bg-surface-page hover:border-line-strong hover:bg-surface-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-20 w-20">
                        <PetArtwork petId={pet.id} mood={active ? 'happy' : 'idle'} />
                      </div>
                      {active && (
                        <Badge tone="navy" className="gap-1">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span>Đang nuôi</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink-primary">{pet.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-brand-red">{pet.speciesTag}</span>
                      <span className="text-xs font-normal leading-relaxed text-ink-secondary">
                        {pet.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Tùy chỉnh hành vi thú cưng */}
          <section
            className={`flex flex-col gap-6 rounded-xl border border-line bg-surface-card p-6 transition-opacity ${
              !selectedPetMeta ? 'opacity-60' : ''
            }`}
          >
            <div>
              <h3 className="text-base font-bold text-ink-primary">Tùy chỉnh thú cưng</h3>
              <p className="text-xs font-normal text-ink-muted">
                {selectedPetMeta
                  ? `Món khoái khẩu của ${selectedPetMeta.label}: ${selectedPetMeta.treatName}`
                  : 'Hãy chọn một bé thú cưng ở phía trên để tùy chỉnh tên gọi và cách di chuyển'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Input
                label="Tên gọi riêng của thú cưng"
                placeholder={selectedPetMeta?.label ?? 'Đặt tên dễ thương...'}
                value={customTheme.pet.name}
                disabled={!selectedPetMeta}
                maxLength={24}
                onChange={(e) => updatePetSettings({ name: e.target.value })}
              />

              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-ink-primary">Kích thước hiển thị</span>
                <div className="grid grid-cols-3 gap-2">
                  {SIZE_OPTIONS.map((opt) => {
                    const active = customTheme.pet.size === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={!selectedPetMeta}
                        onClick={() => updatePetSettings({ size: opt.value })}
                        className={`h-10 rounded-lg border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                          active
                            ? 'border-brand-navy bg-brand-navySoft text-brand-navy'
                            : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink-primary">Chế độ di chuyển</span>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {PET_BEHAVIOR_OPTIONS.map((opt) => {
                  const active = customTheme.pet.behavior === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!selectedPetMeta}
                      onClick={() => updatePetSettings({ behavior: opt.value })}
                      className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed ${
                        active
                          ? 'border-brand-navy bg-brand-navySoft text-brand-navy'
                          : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-ink-primary">
                        <MousePointer2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                        <span>{opt.label}</span>
                      </span>
                      <span className="text-xs font-normal text-ink-secondary">
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface-page p-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-ink-primary">
                  Bong bóng lời chúc &amp; nhắc nhở học tập
                </span>
                <span className="text-xs font-normal text-ink-muted">
                  Hiện câu cổ vũ dễ thương bằng tiếng Việt mỗi khi bạn bấm tương tác với thú cưng
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={customTheme.pet.showSpeech}
                aria-label="Bật tắt bong bóng lời nhắn của thú cưng"
                disabled={!selectedPetMeta}
                onClick={() => updatePetSettings({ showSpeech: !customTheme.pet.showSpeech })}
                className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
                  customTheme.pet.showSpeech ? 'bg-brand-red' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${
                    customTheme.pet.showSpeech ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={
          confirmAction === 'clear-stickers'
            ? 'Gỡ toàn bộ sticker?'
            : 'Xóa ảnh nền đã tải lên?'
        }
        message={
          confirmAction === 'clear-stickers'
            ? 'Toàn bộ sticker bạn đã đặt trên màn hình sẽ bị gỡ bỏ. Bạn có thể gắn lại bất cứ lúc nào.'
            : 'Ảnh nền tải từ thiết bị sẽ bị xóa khỏi bộ nhớ trình duyệt hiện tại.'
        }
        confirmLabel={confirmAction === 'clear-stickers' ? 'Gỡ tất cả' : 'Xóa ảnh'}
        confirmVariant="danger"
      />
    </div>
  );
}

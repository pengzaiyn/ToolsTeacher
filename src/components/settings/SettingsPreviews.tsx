import { Laptop, Moon, Sun } from 'lucide-react';
import type { CursorColorScheme } from '@/lib/cursorEffects';
import type { GlassMode, ThemeMode } from '@/lib/theme';

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

export function renderThemePreview(mode: ThemeMode) {
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

export function renderGlassPreview(mode: GlassMode) {
  const cardSurfaceClass =
    mode === 'none'
      ? 'border-line bg-surface-card shadow-sm'
      : mode === 'frosted'
        ? 'border-surface-bright/60 bg-surface-card/75 shadow-sm backdrop-blur-md dark:border-surface-bright/20 dark:bg-surface-card/65'
        : 'border-surface-bright/85 bg-surface-card/45 shadow-md ring-1 ring-surface-bright/40 backdrop-blur-lg dark:border-surface-bright/30 dark:bg-surface-card/40 dark:ring-surface-bright/15';

  return (
    <div
      aria-hidden="true"
      className="no-glass relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-page p-2"
    >
      {/* Đốm sáng màu phía sau tấm kính mô phỏng */}
      <span className="absolute -left-2 -top-2 h-16 w-16 rounded-full bg-brand-red/40 blur-md" />
      <span className="absolute -bottom-2 -right-2 h-16 w-16 rounded-full bg-brand-navyText/40 blur-md" />
      <span className="absolute left-1/2 top-2 h-10 w-10 -translate-x-1/2 rounded-full bg-brand-red/25 blur-sm" />

      {/* Thẻ kính thu gọn */}
      <div
        className={`no-glass relative flex h-16 w-4/5 flex-col justify-between overflow-hidden rounded-lg border p-2 ${cardSurfaceClass}`}
      >
        {mode === 'liquid' && (
          <span className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-surface-bright/45 to-transparent dark:from-surface-bright/15" />
        )}
        <div className="relative flex items-center justify-between gap-2">
          <span className="h-2 w-12 rounded-sm bg-ink-primary/75" />
          <span className="h-2 w-4 rounded-full bg-brand-red" />
        </div>
        <div className="relative flex gap-2">
          <span className="h-4 flex-1 rounded bg-brand-navy/20 dark:bg-brand-navyText/25" />
          <span className="h-4 flex-1 rounded bg-brand-red/20" />
        </div>
      </div>
    </div>
  );
}

export function renderColorSwatch(scheme: CursorColorScheme) {
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


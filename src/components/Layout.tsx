import type { ReactNode } from 'react';
import { AmbientGlassBackdrop } from '@/components/AmbientGlassBackdrop';
import { CustomWallpaperBackdrop } from '@/components/custom-theme/CustomWallpaperBackdrop';
import { Header } from '@/components/Header';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-surface-page md:pl-64">
      <CustomWallpaperBackdrop />
      <AmbientGlassBackdrop />
      <Header />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-line bg-surface-card py-4">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs font-normal text-ink-muted sm:flex-row sm:px-6">
            <span>Trường Cao đẳng Việt Mỹ Hà Nội</span>
            <span>Cổng công cụ hỗ trợ học tập và giảng dạy</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

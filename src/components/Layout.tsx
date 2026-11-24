import type { ReactNode } from 'react';
import { CustomWallpaperBackdrop } from '@/components/custom-theme/CustomWallpaperBackdrop';
import { Header } from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="u417-layout relative flex min-h-screen flex-col bg-surface-page">
      <CustomWallpaperBackdrop />
      <Header />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

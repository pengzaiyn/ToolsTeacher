import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTheme } from '@/context/ThemeContext';
import {
  applyCustomAccentVariables,
  CUSTOM_THEME_STORAGE_KEY,
  DEFAULT_CUSTOM_THEME_SETTINGS,
  DEFAULT_PET_SETTINGS,
  loadCustomThemeSettings,
  MAX_PLACED_STICKERS,
  pickSmartStickerPosition,
  sanitizeCustomThemeSettings,
  saveCustomThemeSettings,
  THEME_PACKS,
  type CustomThemeSettings,
  type PetSettings,
  type PlacedSticker,
  type StickerId,
} from '@/lib/customTheme';
import {
  clearUploadedWallpaper,
  loadUploadedWallpaper,
  prepareUploadedWallpaperDataUrl,
  saveUploadedWallpaper,
} from '@/lib/customThemeStorage';

interface ApplyPackOutcome {
  recommendedThemeMode?: 'light' | 'dark';
  recommendedGlass?: 'none' | 'frosted' | 'liquid';
}

interface CustomThemeContextValue {
  customTheme: CustomThemeSettings;
  uploadedWallpaperUrl: string | null;
  updateCustomTheme: (patch: Partial<CustomThemeSettings>) => void;
  updatePetSettings: (patch: Partial<PetSettings>) => void;
  applyThemePack: (packId: string) => ApplyPackOutcome | null;
  addSticker: (stickerId: StickerId) => boolean;
  updateSticker: (instanceId: string, patch: Partial<PlacedSticker>) => void;
  removeSticker: (instanceId: string) => void;
  clearStickers: () => void;
  tidyStickersToCorners: () => void;
  setUploadedWallpaper: (file: File) => Promise<void>;
  removeUploadedWallpaper: () => Promise<void>;
  toggleDecorationsHidden: () => void;
  resetCustomTheme: () => void;
}

const CustomThemeContext = createContext<CustomThemeContextValue | null>(null);
const WALLPAPER_CHANNEL_NAME = 'avc_custom_wallpaper_sync';

export function CustomThemeProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [customTheme, setCustomTheme] = useState<CustomThemeSettings>(() =>
    loadCustomThemeSettings()
  );
  const [uploadedWallpaperUrl, setUploadedWallpaperUrl] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    let active = true;
    loadUploadedWallpaper().then((url) => {
      if (active) setUploadedWallpaperUrl(url);
    });
    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    applyCustomAccentVariables(document.documentElement, customTheme, resolvedTheme === 'dark');
  }, [customTheme, resolvedTheme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CUSTOM_THEME_STORAGE_KEY) {
        try {
          setCustomTheme(
            sanitizeCustomThemeSettings(event.newValue ? JSON.parse(event.newValue) : null)
          );
        } catch {
          setCustomTheme({ ...DEFAULT_CUSTOM_THEME_SETTINGS });
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(WALLPAPER_CHANNEL_NAME);
      channelRef.current = ch;
      ch.onmessage = () => {
        loadUploadedWallpaper().then((url) => setUploadedWallpaperUrl(url));
      };
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
    };
  }, []);

  const commitState = useCallback(
    (updater: (prev: CustomThemeSettings) => CustomThemeSettings) => {
      setCustomTheme((prev) => {
        const next = sanitizeCustomThemeSettings(updater(prev));
        saveCustomThemeSettings(next);
        return next;
      });
    },
    []
  );

  const updateCustomTheme = useCallback(
    (patch: Partial<CustomThemeSettings>) => {
      commitState((prev) => ({
        ...prev,
        ...patch,
        activePackId: 'activePackId' in patch ? (patch.activePackId ?? null) : null,
      }));
    },
    [commitState]
  );

  const updatePetSettings = useCallback(
    (patch: Partial<PetSettings>) => {
      commitState((prev) => ({
        ...prev,
        enabled: patch.id && patch.id !== 'none' ? true : prev.enabled,
        activePackId: null,
        pet: {
          ...prev.pet,
          ...patch,
        },
      }));
    },
    [commitState]
  );

  const applyThemePack = useCallback(
    (packId: string): ApplyPackOutcome | null => {
      const pack = THEME_PACKS.find((item) => item.id === packId);
      if (!pack) return null;

      commitState((prev) => ({
        ...prev,
        ...pack.settings,
        activePackId: pack.id,
        pet: pack.settings.pet
          ? { ...DEFAULT_PET_SETTINGS, ...pack.settings.pet }
          : { ...DEFAULT_PET_SETTINGS },
        stickers: pack.settings.stickers ? [...pack.settings.stickers] : [],
      }));

      return {
        recommendedThemeMode: pack.recommendedThemeMode,
        recommendedGlass: pack.recommendedGlass,
      };
    },
    [commitState]
  );

  const addSticker = useCallback(
    (stickerId: StickerId): boolean => {
      let added = false;
      commitState((prev) => {
        if (prev.stickers.length >= MAX_PLACED_STICKERS) {
          added = false;
          return prev;
        }
        added = true;
        const pos = pickSmartStickerPosition(prev.stickers.length);
        const newSticker: PlacedSticker = {
          instanceId: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          stickerId,
          xPct: pos.xPct,
          yPct: pos.yPct,
          size: 'md',
          rotation: pos.rotation,
          flipX: false,
        };
        return {
          ...prev,
          enabled: true,
          decorationsHidden: false,
          activePackId: null,
          stickers: [...prev.stickers, newSticker],
        };
      });
      return added;
    },
    [commitState]
  );

  const updateSticker = useCallback(
    (instanceId: string, patch: Partial<PlacedSticker>) => {
      commitState((prev) => ({
        ...prev,
        activePackId: null,
        stickers: prev.stickers.map((item) =>
          item.instanceId === instanceId ? { ...item, ...patch } : item
        ),
      }));
    },
    [commitState]
  );

  const removeSticker = useCallback(
    (instanceId: string) => {
      commitState((prev) => ({
        ...prev,
        activePackId: null,
        stickers: prev.stickers.filter((item) => item.instanceId !== instanceId),
      }));
    },
    [commitState]
  );

  const clearStickers = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      activePackId: null,
      stickers: [],
    }));
  }, [commitState]);

  const tidyStickersToCorners = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      activePackId: null,
      stickers: prev.stickers.map((item, idx) => {
        const pos = pickSmartStickerPosition(idx);
        return {
          ...item,
          xPct: pos.xPct,
          yPct: pos.yPct,
          rotation: pos.rotation,
        };
      }),
    }));
  }, [commitState]);

  const setUploadedWallpaper = useCallback(
    async (file: File) => {
      const dataUrl = await prepareUploadedWallpaperDataUrl(file);
      await saveUploadedWallpaper(dataUrl);
      setUploadedWallpaperUrl(dataUrl);
      channelRef.current?.postMessage({ updatedAt: Date.now() });
      commitState((prev) => ({
        ...prev,
        enabled: true,
        activePackId: null,
        wallpaperKind: 'upload',
        wallpaperId: 'user-upload',
      }));
    },
    [commitState]
  );

  const removeUploadedWallpaper = useCallback(async () => {
    await clearUploadedWallpaper();
    setUploadedWallpaperUrl(null);
    channelRef.current?.postMessage({ updatedAt: Date.now() });
    commitState((prev) => ({
      ...prev,
      activePackId: null,
      wallpaperKind: prev.wallpaperKind === 'upload' ? 'none' : prev.wallpaperKind,
      wallpaperId: prev.wallpaperKind === 'upload' ? 'none' : prev.wallpaperId,
    }));
  }, [commitState]);

  const toggleDecorationsHidden = useCallback(() => {
    commitState((prev) => ({
      ...prev,
      decorationsHidden: !prev.decorationsHidden,
    }));
  }, [commitState]);

  const resetCustomTheme = useCallback(() => {
    const next: CustomThemeSettings = {
      ...DEFAULT_CUSTOM_THEME_SETTINGS,
      stickers: [],
      pet: { ...DEFAULT_PET_SETTINGS },
    };
    saveCustomThemeSettings(next);
    setCustomTheme(next);
  }, []);

  const value = useMemo<CustomThemeContextValue>(
    () => ({
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
      resetCustomTheme,
    }),
    [
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
      resetCustomTheme,
    ]
  );

  return <CustomThemeContext.Provider value={value}>{children}</CustomThemeContext.Provider>;
}

export function useCustomTheme(): CustomThemeContextValue {
  const ctx = useContext(CustomThemeContext);
  if (!ctx) {
    throw new Error('useCustomTheme phải được dùng bên trong CustomThemeProvider');
  }
  return ctx;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

export type SettingsSectionId = 'theme' | 'custom' | 'cursor';

interface SettingsModalContextValue {
  isOpen: boolean;
  activeTab: SettingsSectionId;
  openSettings: (tab?: SettingsSectionId) => void;
  closeSettings: () => void;
  setActiveTab: (tab: SettingsSectionId) => void;
}

const SettingsModalContext = createContext<SettingsModalContextValue | undefined>(undefined);

/**
 * Quản lý trạng thái mở hộp thoại Cài đặt nổi trên màn hình để giữ nguyên ngữ cảnh trang bên dưới.
 */
export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsSectionId>('theme');

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const openSettings = useCallback((tab?: SettingsSectionId) => {
    if (tab) {
      setActiveTab(tab);
    }
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<SettingsModalContextValue>(
    () => ({
      isOpen,
      activeTab,
      openSettings,
      closeSettings,
      setActiveTab,
    }),
    [isOpen, activeTab, openSettings, closeSettings]
  );

  return <SettingsModalContext.Provider value={value}>{children}</SettingsModalContext.Provider>;
}

/**
 * Truy cập thao tác mở/đóng hộp thoại Cài đặt nổi từ bất kỳ component nào bên trong AuthProvider.
 */
export function useSettingsModal() {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error('useSettingsModal phải được dùng bên trong SettingsModalProvider');
  }
  return ctx;
}


import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  Home,
  LogOut,
  Megaphone,
  Menu,
  SlidersHorizontal,
  User,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSettingsModal } from '@/context/SettingsModalContext';
import { ROLE_LABELS, isAdmin, isStaff } from '@/lib/roles';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  matchPrefixes?: string[];
}

export function Header() {
  const { profile, signOut } = useAuth();
  const { isOpen: isSettingsOpen, openSettings } = useSettingsModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const settingsActive = isSettingsOpen || location.pathname === '/settings';

  function handleOpenSettings(onNavigate?: () => void) {
    onNavigate?.();
    if (location.pathname !== '/settings') {
      openSettings();
    }
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const navItems: NavItem[] = [
    { to: '/tools', label: 'Trang chủ', icon: Home },
    { to: '/timetable', label: 'Thời khóa biểu', icon: Calendar },
    { to: '/classes', label: 'Lớp học', icon: BookOpen },
  ];

  if (isStaff(profile?.role)) {
    navItems.push({
      to: '/teacher/tools',
      label: 'Công cụ giảng dạy',
      icon: Wrench,
      matchPrefixes: ['/teacher', '/timetable/upload'],
    });
  }

  if (isAdmin(profile?.role)) {
    navItems.push({ to: '/admin/teachers', label: 'Giáo viên', icon: UserCheck });
    navItems.push({ to: '/admin/announcements', label: 'Thông báo', icon: Megaphone });
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      setMobileOpen(false);
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  function renderSidebarBody(onNavigate?: () => void, showCloseButton = false) {
    return (
      <div className="flex h-full flex-col bg-surface-card">
        <div className="flex h-20 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <Link
            to="/tools"
            onClick={onNavigate}
            aria-label="Trang chủ Trường Cao đẳng Việt Mỹ Hà Nội"
            className="flex min-w-0 flex-1 items-center justify-center"
          >
            <img
              src="/logo-light.png"
              alt="Trường Cao đẳng Việt Mỹ Hà Nội"
              className="h-16 w-auto max-w-full object-contain dark:hidden"
            />
            <img
              src="/logo-dark.png"
              alt="Trường Cao đẳng Việt Mỹ Hà Nội"
              className="hidden h-16 w-auto max-w-full object-contain dark:block"
            />
          </Link>

          {showCloseButton && (
            <button
              type="button"
              onClick={onNavigate}
              aria-label="Đóng thanh điều hướng"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav
          className="flex flex-1 flex-col gap-2 overflow-y-auto p-4"
          aria-label="Điều hướng chính"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const prefixMatch =
              item.matchPrefixes?.some((prefix) => location.pathname.startsWith(prefix)) ?? false;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) => {
                  const active = isActive || prefixMatch;
                  return `flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-brand-navySoft text-brand-navy'
                      : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                  }`;
                }}
              >
                {({ isActive }) => {
                  const active = isActive || prefixMatch;
                  return (
                    <>
                      <Icon
                        className={`h-4 w-4 shrink-0 ${active ? 'text-brand-red' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-2">
          <button
            type="button"
            onClick={() => handleOpenSettings(onNavigate)}
            aria-haspopup="dialog"
            aria-expanded={isSettingsOpen && location.pathname !== '/settings'}
            className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
              settingsActive
                ? 'bg-brand-navySoft text-brand-navy'
                : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
            }`}
          >
            <SlidersHorizontal
              className={`h-4 w-4 shrink-0 ${settingsActive ? 'text-brand-red' : ''}`}
              aria-hidden="true"
            />
            <span>Cài đặt</span>
          </button>
          <ThemeToggle />
        </div>

        <div className="shrink-0 border-t border-line p-4">
          {profile && (
            <Link
              to="/profile"
              onClick={onNavigate}
              className="mb-4 flex items-center gap-2 rounded-lg bg-surface-page p-2 transition-colors hover:bg-surface-subtle"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navySoft text-brand-navy">
                <User className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold leading-tight text-ink-primary">
                  {profile.full_name}
                </span>
                <span className="text-xs font-normal text-ink-muted">
                  {ROLE_LABELS[profile.role]}
                </span>
              </div>
            </Link>
          )}

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={handleSignOut}
            loading={signingOut}
            aria-label="Đăng xuất"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Đăng xuất</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Sidebar cố định bên trái trên màn hình tablet/desktop (md trở lên) */}
      <aside
        className="hidden border-r border-line md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-64 md:flex-col"
        aria-label="Thanh điều hướng bên trái"
      >
        {renderSidebarBody()}
      </aside>

      {/* Thanh tiêu đề trên cùng cho điện thoại (< md) */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-surface-card px-4 md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-primary hover:bg-surface-subtle"
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            to="/tools"
            aria-label="Trang chủ Trường Cao đẳng Việt Mỹ Hà Nội"
            className="flex items-center"
          >
            <img
              src="/logo-mark-light.png"
              alt="Trường Cao đẳng Việt Mỹ Hà Nội"
              className="h-10 w-auto object-contain dark:hidden"
            />
            <img
              src="/logo-mark-dark.png"
              alt="Trường Cao đẳng Việt Mỹ Hà Nội"
              className="hidden h-10 w-auto object-contain dark:block"
            />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          {profile && <Badge tone="navy">{ROLE_LABELS[profile.role]}</Badge>}
        </div>
      </header>

      {/* Ngăn kéo điều hướng trượt từ cạnh trái trên điện thoại */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-ink-card/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-64 max-w-[80vw] flex-col border-r border-line shadow-xl">
            {renderSidebarBody(() => setMobileOpen(false), true)}
          </aside>
        </div>
      )}
    </>
  );
}

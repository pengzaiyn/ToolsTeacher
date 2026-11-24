// Lucian UX/UI Prompt #417 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#417
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  Gamepad2,
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
import { useLanguage } from '@/context/LanguageContext';
import { useSettingsModal } from '@/context/SettingsModalContext';
import { UnreadBadge, useUnreadAnnouncements } from '@/context/UnreadAnnouncementsContext';
import { isValidAvatarUrl } from '@/lib/avatar';
import { isAdmin, isStaff } from '@/lib/roles';
import { LanguagePicker } from '@/components/LanguagePicker';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import './lucian-417.css';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  matchPrefixes?: string[];
  badgeCount?: number;
}

export function Header() {
  const { profile, signOut } = useAuth();
  const { t, roleLabel } = useLanguage();
  const { isOpen: isSettingsOpen, openSettings } = useSettingsModal();
  const { schoolUnreadCount, totalClassUnreadCount } = useUnreadAnnouncements();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const leaveTimerRef = useRef<number | undefined>(undefined);

  const settingsActive = isSettingsOpen || location.pathname === '/settings';
  const collapsed = !hoverExpanded;

  function handleMouseEnterSidebar() {
    window.clearTimeout(leaveTimerRef.current);
    setHoverExpanded(true);
  }

  function handleMouseLeaveSidebar() {
    window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => {
      setHoverExpanded(false);
    }, 120);
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(leaveTimerRef.current);
    };
  }, []);

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
    { to: '/tools', label: t('nav.home'), icon: Home, badgeCount: schoolUnreadCount },
    { to: '/timetable', label: t('nav.timetable'), icon: Calendar },
    { to: '/classes', label: t('nav.classes'), icon: BookOpen, badgeCount: totalClassUnreadCount },
    {
      to: '/games',
      label: t('nav.games'),
      icon: Gamepad2,
      matchPrefixes: ['/games', '/hsk-tower'],
    },
  ];

  if (isStaff(profile?.role)) {
    navItems.push({
      to: '/teacher/tools',
      label: t('nav.teacherTools'),
      icon: Wrench,
      matchPrefixes: ['/teacher', '/timetable/upload'],
    });
  }

  if (isAdmin(profile?.role)) {
    navItems.push({ to: '/admin/teachers', label: t('nav.teachers'), icon: UserCheck });
    navItems.push({
      to: '/admin/announcements',
      label: t('nav.announcements'),
      icon: Megaphone,
      badgeCount: schoolUnreadCount,
    });
  }

  const activeNavIndex = navItems.findIndex(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`) ||
      (item.matchPrefixes?.some((prefix) => location.pathname.startsWith(prefix)) ?? false)
  );

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

  function renderSidebarBody(isRail: boolean, onNavigate?: () => void, showCloseButton = false) {
    return (
      <div className="flex h-full flex-col bg-surface-card">
        <div
          className={`flex h-20 shrink-0 items-center justify-between gap-2 border-b border-line ${
            isRail ? 'px-2' : 'px-4'
          }`}
        >
          <Link
            to="/tools"
            onClick={onNavigate}
            aria-label="Trang chủ Trường Cao đẳng Việt Mỹ Hà Nội"
            className="flex min-w-0 flex-1 items-center justify-center"
          >
            {isRail ? (
              <>
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
              </>
            ) : (
              <>
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
              </>
            )}
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
          className={`flex-1 overflow-y-auto ${isRail ? 'px-3 py-4' : 'p-4'}`}
          aria-label="Điều hướng chính"
        >
          <ul className="u417-nav m-0 flex list-none flex-col gap-2 p-0">
            <li
              className="u417-pl"
              aria-hidden="true"
              style={
                {
                  '--py': `${Math.max(0, activeNavIndex) * 48}px`,
                  opacity: activeNavIndex >= 0 ? 1 : 0,
                } as CSSProperties
              }
            />
            {navItems.map((item) => {
              const Icon = item.icon;
              const prefixMatch =
                item.matchPrefixes?.some((prefix) => location.pathname.startsWith(prefix)) ?? false;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    title={item.label}
                    className={({ isActive }) => {
                      const active = isActive || prefixMatch;
                      return `u417-it ${
                        active
                          ? 'text-brand-navy'
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
                          <span className="u417-lb flex-1">{item.label}</span>
                          {item.badgeCount && item.badgeCount > 0 ? (
                            <UnreadBadge count={item.badgeCount} />
                          ) : null}
                        </>
                      );
                    }}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className={`flex shrink-0 flex-col gap-2 border-t border-line py-2.5 ${
            isRail ? 'items-center px-2' : 'px-4'
          }`}
        >
          <div
            className={`flex items-center gap-2 ${
              isRail ? 'flex-col' : 'w-full justify-between'
            }`}
          >
            <LanguagePicker compact={isRail} />
            <ThemeToggle compact={isRail} />
          </div>
          <button
            type="button"
            onClick={() => handleOpenSettings(onNavigate)}
            aria-haspopup="dialog"
            aria-expanded={isSettingsOpen && location.pathname !== '/settings'}
            title={t('nav.settings')}
            className={`flex h-9 items-center gap-2 rounded-lg text-sm font-semibold transition-colors ${
              isRail ? 'w-9 justify-center px-0' : 'w-full px-3'
            } ${
              settingsActive
                ? 'bg-brand-navySoft text-brand-navy'
                : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
            }`}
          >
            <SlidersHorizontal
              className={`h-4 w-4 shrink-0 ${settingsActive ? 'text-brand-red' : ''}`}
              aria-hidden="true"
            />
            {!isRail && <span>{t('nav.settings')}</span>}
          </button>
        </div>

        <div
          className={`shrink-0 border-t border-line ${
            isRail ? 'flex flex-col items-center gap-2 p-2.5' : 'p-4'
          }`}
        >
          {profile && (
            <Link
              to="/profile"
              onClick={onNavigate}
              title={`${profile.full_name} — ${roleLabel(profile.role)}`}
              className={`flex items-center gap-2 rounded-lg bg-surface-page transition-colors hover:bg-surface-subtle ${
                isRail ? 'h-10 w-10 justify-center p-0' : 'mb-4 p-2'
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-navySoft text-brand-navy">
                {isValidAvatarUrl(profile.avatar_url) ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4" aria-hidden="true" />
                )}
              </div>
              {!isRail && (
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold leading-tight text-ink-primary">
                    {profile.full_name}
                  </span>
                  <span className="text-xs font-normal text-ink-muted">
                    {roleLabel(profile.role)}
                  </span>
                </div>
              )}
            </Link>
          )}

          {isRail ? (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label={t('nav.signOut')}
              title={t('nav.signOut')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-brand-red disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={handleSignOut}
              loading={signingOut}
              aria-label={t('nav.signOut')}
              title={t('nav.signOut')}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{t('nav.signOut')}</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Sidebar cố định bên trái tự bung ra khi di chuột vào và thu gọn khi rời chuột */}
      <aside
        className={`u417-aside ${
          collapsed ? 'is-rail' : ''
        } hidden border-r border-line md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:flex-col`}
        aria-label="Thanh điều hướng bên trái"
        onMouseEnter={handleMouseEnterSidebar}
        onMouseLeave={handleMouseLeaveSidebar}
        onFocus={handleMouseEnterSidebar}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            handleMouseLeaveSidebar();
          }
        }}
      >
        {renderSidebarBody(collapsed)}
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
          {profile && <Badge tone="navy">{roleLabel(profile.role)}</Badge>}
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
            {renderSidebarBody(false, () => setMobileOpen(false), true)}
          </aside>
        </div>
      )}
    </>
  );
}

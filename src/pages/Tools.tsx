import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Lightbulb, Megaphone, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useUnreadAnnouncements } from '@/context/UnreadAnnouncementsContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { isAdmin } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { TOOLS, type ToolItem } from '@/lib/toolsCatalog';
import { formatDateVi } from '@/lib/week';
import type { Announcement } from '@/types/database';
import { Layout } from '@/components/Layout';
import { SchoolAnnouncementPill } from '@/components/SchoolAnnouncementPill';
import { ToolCard } from '@/components/ToolCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlowCardGrid } from '@/components/ui/GlowCardGrid';
import { LoadingState } from '@/components/ui/Spinner';

export { TOOLS, type ToolItem };

interface PendingGameSuggestion {
  id: string;
  major_name: string;
  game_title: string;
  description: string;
  created_by_name: string;
  created_at: string;
}

export function Tools() {
  const { user, profile } = useAuth();
  const { t, roleLabel } = useLanguage();
  const { schoolUnreadCount, markSchoolSeen } = useUnreadAnnouncements();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingGameSuggestion[]>([]);
  const adminRole = isAdmin(profile?.role);

  useEffect(() => {
    if (schoolUnreadCount > 0) {
      markSchoolSeen();
    }
  }, [schoolUnreadCount, markSchoolSeen]);

  const loadAnnouncements = useCallback(async (silent = false) => {
    if (!silent) setLoadingAnnouncements(true);
    try {
      const [annRes, sugRes] = await Promise.all([
        supabase
          .from('announcements')
          .select('*')
          .is('class_id', null)
          .order('created_at', { ascending: false })
          .limit(5)
          .returns<Announcement[]>(),
        adminRole
          ? supabase
              .from('game_suggestions')
              .select('id, major_name, game_title, description, created_by_name, created_at')
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(5)
              .returns<PendingGameSuggestion[]>()
          : Promise.resolve({ data: [] as PendingGameSuggestion[], error: null }),
      ]);
      setAnnouncements(annRes.data ?? []);
      setPendingSuggestions(sugRes.error ? [] : (sugRes.data ?? []));
    } finally {
      if (!silent) setLoadingAnnouncements(false);
    }
  }, [adminRole]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useRealtimeRefresh({
    channelName: 'tools-announcements',
    tables: adminRole
      ? [{ table: 'announcements' }, { table: 'game_suggestions' }]
      : [{ table: 'announcements' }],
    onRefresh: () => loadAnnouncements(true),
  });

  const visibleTools = TOOLS.filter(
    (tool) => tool.category !== 'teaching' && (profile ? tool.roles.includes(profile.role) : false)
  );

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <section className="rounded-2xl border border-line bg-surface-card p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-brand-navy">
                  {t('home.greeting')}, {profile?.full_name}
                </h1>
                {profile && <Badge tone="red">{roleLabel(profile.role)}</Badge>}
              </div>
              <p className="text-sm font-normal text-ink-secondary">
                {t('home.subtitle')}
                {profile?.class_name ? ` — ${t('home.classPrefix')} ${profile.class_name}` : ''}
              </p>
            </div>
            {profile?.student_code && (
              <div className="rounded-xl bg-surface-page px-4 py-2 text-left sm:text-right">
                <p className="text-xs font-normal text-ink-muted">{t('home.studentCode')}</p>
                <p className="text-base font-bold text-brand-navy">{profile.student_code}</p>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-ink-primary">{t('home.toolsHeading')}</h2>
          {visibleTools.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Chưa có công cụ khả dụng"
              description="Tài khoản của bạn hiện chưa được gán công cụ nào."
            />
          ) : (
            <GlowCardGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </GlowCardGrid>
          )}
        </section>

        {adminRole && pendingSuggestions.length > 0 && (
          <section className="flex flex-col gap-4 rounded-2xl border border-brand-red/30 bg-brand-redSoft/30 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Lightbulb className="h-5 w-5 text-brand-red" aria-hidden="true" />
                <h2 className="text-lg font-bold text-brand-navy">
                  Đề xuất trò chơi mới gửi Hiệu trưởng
                </h2>
                <Badge tone="red">{pendingSuggestions.length} chờ duyệt</Badge>
              </div>
              <Link to="/games?tab=suggestions">
                <Button size="sm" variant="primary">
                  <span>Xem & duyệt đề xuất</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {pendingSuggestions.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-card p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="navy">{item.major_name}</Badge>
                    <span className="text-xs font-normal text-ink-muted">
                      {formatDateVi(item.created_at)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-ink-primary">{item.game_title}</h3>
                  <p className="line-clamp-2 text-xs font-normal text-ink-secondary">
                    {item.description}
                  </p>
                  <span className="text-[11px] font-semibold text-ink-muted">
                    Người gửi: {item.created_by_name}
                  </span>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-brand-red" aria-hidden="true" />
              <h2 className="text-lg font-bold text-ink-primary">{t('home.schoolAnnouncements')}</h2>
            </div>
            {isAdmin(profile?.role) && (
              <Link to="/admin/announcements">
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  <span>{t('home.manageAnnouncements')}</span>
                </Button>
              </Link>
            )}
          </div>

          {loadingAnnouncements ? (
            <LoadingState message="Đang tải thông báo..." />
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={t('home.noAnnouncements')}
              description={t('home.noAnnouncementsDesc')}
            />
          ) : (
            <SchoolAnnouncementPill
              announcements={announcements}
              currentUserId={user?.id ?? null}
              manageHref={isAdmin(profile?.role) ? '/admin/announcements' : undefined}
            />
          )}
        </section>
      </div>
    </Layout>
  );
}


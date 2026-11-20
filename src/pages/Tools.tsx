import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Calendar, Megaphone, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUnreadAnnouncements } from '@/context/UnreadAnnouncementsContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { getAnnouncementAudienceMeta } from '@/lib/announcements';
import { quickClassifyAnnouncement } from '@/lib/announcementClassifier';
import { isAdmin, ROLE_LABELS } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { TOOLS, type ToolItem } from '@/lib/toolsCatalog';
import { formatDateVi } from '@/lib/week';
import type { Announcement } from '@/types/database';
import { Layout } from '@/components/Layout';
import { ToolCard } from '@/components/ToolCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/Spinner';

export { TOOLS, type ToolItem };

export function Tools() {
  const { user, profile } = useAuth();
  const { schoolUnreadCount, markSchoolSeen } = useUnreadAnnouncements();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  useEffect(() => {
    if (schoolUnreadCount > 0) {
      markSchoolSeen();
    }
  }, [schoolUnreadCount, markSchoolSeen]);

  const loadAnnouncements = useCallback(async (silent = false) => {
    if (!silent) setLoadingAnnouncements(true);
    try {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .is('class_id', null)
        .order('created_at', { ascending: false })
        .limit(5)
        .returns<Announcement[]>();
      setAnnouncements(data ?? []);
    } finally {
      if (!silent) setLoadingAnnouncements(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  useRealtimeRefresh({
    channelName: 'tools-announcements',
    tables: [{ table: 'announcements' }],
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
                  Xin chào, {profile?.full_name}
                </h1>
                {profile && <Badge tone="red">{ROLE_LABELS[profile.role]}</Badge>}
              </div>
              <p className="text-sm font-normal text-ink-secondary">
                Trung tâm công cụ Trường Cao đẳng Việt Mỹ Hà Nội
                {profile?.class_name ? ` — Lớp ${profile.class_name}` : ''}
              </p>
            </div>
            {profile?.student_code && (
              <div className="rounded-xl bg-surface-page px-4 py-2 text-left sm:text-right">
                <p className="text-xs font-normal text-ink-muted">Mã sinh viên</p>
                <p className="text-base font-bold text-brand-navy">{profile.student_code}</p>
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-ink-primary">Danh sách công cụ</h2>
          {visibleTools.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Chưa có công cụ khả dụng"
              description="Tài khoản của bạn hiện chưa được gán công cụ nào."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-brand-red" aria-hidden="true" />
              <h2 className="text-lg font-bold text-ink-primary">Thông báo nhà trường</h2>
            </div>
            {isAdmin(profile?.role) && (
              <Link to="/admin/announcements">
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  <span>Quản lý & đăng thông báo</span>
                </Button>
              </Link>
            )}
          </div>

          {loadingAnnouncements ? (
            <LoadingState message="Đang tải thông báo..." />
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Chưa có thông báo nào"
              description="Thông báo mới từ nhà trường sẽ xuất hiện tại đây."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {announcements.map((item) => {
                const audience = getAnnouncementAudienceMeta(item, {
                  currentUserId: user?.id ?? null,
                });
                const isWarning = quickClassifyAnnouncement(item.title, item.content) === 'warning';
                return (
                  <article
                    key={item.id}
                    className={`flex flex-col gap-2 rounded-xl border p-6 ${
                      isWarning
                        ? 'border-status-dangerBorder bg-status-dangerBg/40'
                        : 'border-line bg-surface-card'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={audience.tone}>{audience.label}</Badge>
                        {isWarning && (
                          <Badge tone="danger" className="gap-1">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            <span>Cảnh báo</span>
                          </Badge>
                        )}
                        <h3 className="text-base font-bold text-ink-primary">{item.title}</h3>
                      </div>
                      <span className="text-xs font-normal text-ink-muted">
                        {formatDateVi(item.created_at)}
                      </span>
                    </div>
                    {item.content && (
                      <p className="whitespace-pre-line text-sm font-normal text-ink-secondary">
                        {item.content}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}


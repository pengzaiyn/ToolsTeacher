import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckSquare,
  ClipboardList,
  FileCheck2,
  FileText,
  Megaphone,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UnreadBadge, useUnreadAnnouncements } from '@/context/UnreadAnnouncementsContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { classKey } from '@/lib/classKey';
import { isAdmin, isDroppedOutStudent, isStudent } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { CollegeClass, TimetableClassSummary } from '@/types/database';
import { Layout } from '@/components/Layout';
import { ClassAnnouncementsTab } from '@/components/class/ClassAnnouncementsTab';
import { ClassAssignmentsTab } from '@/components/class/ClassAssignmentsTab';
import { ClassAttendancePanel } from '@/components/class/ClassAttendancePanel';
import { ClassGradesTab } from '@/components/class/ClassGradesTab';
import { ClassMaterialsTab } from '@/components/class/ClassMaterialsTab';
import { ClassMembersTab } from '@/components/class/ClassMembersTab';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type ClassTab =
  | 'assignments'
  | 'materials'
  | 'announcements'
  | 'members'
  | 'attendance'
  | 'grades';

export function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as ClassTab | null;
  const { user, profile } = useAuth();
  const { getClassUnreadCount, markClassSeen } = useUnreadAnnouncements();
  const toast = useToast();

  const [cls, setCls] = useState<CollegeClass | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [timetableCount, setTimetableCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClassTab>(() => {
    const validTabs: ClassTab[] = [
      'assignments',
      'materials',
      'announcements',
      'members',
      'attendance',
      'grades',
    ];
    if (requestedTab && validTabs.includes(requestedTab)) return requestedTab;
    return isAdmin(profile?.role) ? 'members' : 'assignments';
  });

  useEffect(() => {
    const validTabs: ClassTab[] = [
      'assignments',
      'materials',
      'announcements',
      'members',
      'attendance',
      'grades',
    ];
    if (requestedTab && validTabs.includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const classUnreadCount = id ? getClassUnreadCount(id) : 0;

  useEffect(() => {
    if (id && activeTab === 'announcements' && classUnreadCount > 0) {
      markClassSeen(id);
    }
  }, [id, activeTab, classUnreadCount, markClassSeen]);

  const studentView = isStudent(profile?.role);

  const loadClass = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      try {
        const [{ data, error }, enrRes, ttRes] = await Promise.all([
          supabase
            .from('classes')
            .select('*, teacher:profiles!classes_teacher_id_fkey(id, full_name, email)')
            .eq('id', id)
            .maybeSingle<CollegeClass>(),
          !studentView
            ? supabase
                .from('enrollments')
                .select('id, student:profiles!enrollments_student_id_fkey(academic_status)')
                .eq('class_id', id)
                .returns<{ id: string; student: { academic_status: string | null } | null }[]>()
            : Promise.resolve({ data: null, error: null }),
          supabase.rpc('timetable_classes'),
        ]);
        if (error) throw new Error(error.message);

        setCls(data ?? null);
        setStudentCount(
          enrRes.data
            ? enrRes.data.filter((row) => !isDroppedOutStudent(row.student)).length
            : null
        );

        if (data) {
          const targetKey = data.class_key || classKey(data.name);
          const ttList = (ttRes.data as TimetableClassSummary[] | null) ?? [];
          const matched = ttList.find((item) => item.class_key === targetKey);
          setTimetableCount(matched ? Number(matched.entries) : 0);
        } else {
          setTimetableCount(0);
        }
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được thông tin lớp học');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, studentView, toast]
  );

  useEffect(() => {
    void loadClass();
  }, [loadClass]);

  useRealtimeRefresh({
    channelName: `class-detail-${id ?? 'none'}`,
    tables: id
      ? [
          { table: 'classes', filter: `id=eq.${id}` },
          { table: 'enrollments', filter: `class_id=eq.${id}` },
          { table: 'timetable_entries' },
        ]
      : [],
    enabled: Boolean(id),
    onRefresh: () => loadClass(true),
  });

  const canManageTeaching = Boolean(
    profile?.role === 'admin' ||
      (profile?.role === 'teacher' && user && cls && cls.teacher_id === user.id)
  );
  const canManageMembers = canManageTeaching;

  const tabs: { key: ClassTab; label: string; icon: typeof ClipboardList }[] = [
    { key: 'assignments', label: 'Bài tập', icon: ClipboardList },
    { key: 'materials', label: 'Tài liệu', icon: FileText },
    { key: 'announcements', label: 'Thông báo', icon: Megaphone },
    ...(!studentView
      ? [
          { key: 'members' as const, label: 'Thành viên', icon: Users },
          { key: 'attendance' as const, label: 'Điểm danh', icon: CheckSquare },
          { key: 'grades' as const, label: 'Bảng điểm', icon: FileCheck2 },
        ]
      : []),
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <Link
            to="/classes"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Quay lại danh sách lớp</span>
          </Link>
        </div>

        {loading ? (
          <LoadingState message="Đang tải lớp học..." />
        ) : !cls || !id ? (
          <EmptyState
            icon={BookOpen}
            title="Không tìm thấy lớp học"
            description="Lớp học không tồn tại hoặc bạn không có quyền truy cập lớp này."
            action={
              <Link to="/classes">
                <Button variant="navy">Về danh sách lớp</Button>
              </Link>
            }
          />
        ) : (
          <>
            <section className="rounded-2xl border border-line bg-surface-card p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-brand-navy">{cls.name}</h1>
                    {cls.subject && <Badge tone="red">{cls.subject}</Badge>}
                    {!studentView && studentCount !== null && (
                      <Badge tone="navy">{studentCount} sinh viên</Badge>
                    )}
                    {timetableCount > 0 && (
                      <Badge tone="success">{timetableCount} buổi TKB</Badge>
                    )}
                  </div>
                  {cls.description && (
                    <p className="text-sm font-normal text-ink-secondary">{cls.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-xl bg-surface-page px-4 py-2 text-sm">
                    <User className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                    <span className="text-ink-secondary">
                      Giáo viên:{' '}
                      <strong className="text-ink-primary">
                        {cls.teacher?.full_name || 'Chưa có giáo viên'}
                      </strong>
                    </span>
                  </div>
                  {(timetableCount > 0 && (!studentView || profile?.class_key === (cls.class_key || classKey(cls.name)))) && (
                    <Link
                      to={
                        studentView
                          ? '/timetable'
                          : `/timetable?class=${encodeURIComponent(cls.class_key || classKey(cls.name))}`
                      }
                    >
                      <Button size="sm" variant="secondary">
                        <Calendar className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                        <span>Xem TKB</span>
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </section>

            <div className="flex gap-2 overflow-x-auto border-b border-line pb-2 pr-2 pt-2" role="tablist">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.key;
                const tabUnread = tab.key === 'announcements' ? classUnreadCount : 0;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.key === 'announcements' && id) {
                        markClassSeen(id);
                      }
                    }}
                    className={`relative inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
                      selected
                        ? 'bg-brand-navy text-white'
                        : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{tab.label}</span>
                    {tabUnread > 0 && <UnreadBadge count={tabUnread} />}
                  </button>
                );
              })}
            </div>

            <div>
              {activeTab === 'assignments' && (
                <ClassAssignmentsTab
                  classId={id}
                  canManage={canManageTeaching}
                  isStudentView={studentView}
                />
              )}
              {activeTab === 'materials' && (
                <ClassMaterialsTab classId={id} canManage={canManageTeaching} />
              )}
              {activeTab === 'announcements' && (
                <ClassAnnouncementsTab classId={id} canManage={canManageTeaching} />
              )}
              {activeTab === 'members' && !studentView && (
                <ClassMembersTab classId={id} canManage={canManageMembers} />
              )}
              {activeTab === 'attendance' && !studentView && (
                <ClassAttendancePanel classItem={cls} canManage={canManageTeaching} />
              )}
              {activeTab === 'grades' && !studentView && (
                <ClassGradesTab classItem={cls} canManage={canManageTeaching} />
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}


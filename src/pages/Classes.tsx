import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UnreadBadge, useUnreadAnnouncements } from '@/context/UnreadAnnouncementsContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { classKey } from '@/lib/classKey';
import { formatClassActionError } from '@/lib/classStorage';
import { isAdmin, isDroppedOutStudent, isStudent, isTeacher } from '@/lib/roles';
import { fetchAllPages, supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import type { ClassSubjectTeacher, CollegeClass, Profile, TimetableClassSummary } from '@/types/database';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type ClassSearchMode = 'all' | 'name' | 'subject' | 'teacher';
type ClassSortBy = 'newest' | 'name_asc' | 'students_desc' | 'students_asc';

const CLASS_SEARCH_OPTIONS: { value: ClassSearchMode; label: string; placeholder: string }[] = [
  { value: 'all', label: 'Tất cả thông tin', placeholder: 'Tìm tên lớp, môn học/ngành, giáo viên (có hoặc không dấu)...' },
  { value: 'name', label: 'Tên lớp', placeholder: 'Nhập tên lớp hoặc nhiều lớp cách nhau dấu phẩy (VD: 10A4, UDPM)...' },
  { value: 'subject', label: 'Môn học / Ngành', placeholder: 'Nhập tên môn học hoặc ngành đào tạo...' },
  { value: 'teacher', label: 'Giáo viên', placeholder: 'Nhập tên giáo viên phụ trách...' },
];

function stripVietnamese(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function Classes() {
  const { profile } = useAuth();
  const { getClassUnreadCount } = useUnreadAnnouncements();
  const toast = useToast();

  const adminRole = isAdmin(profile?.role);
  const teacherRole = isTeacher(profile?.role);
  const studentRole = isStudent(profile?.role);

  const [classes, setClasses] = useState<CollegeClass[]>([]);
  const [subjectTeachersByClass, setSubjectTeachersByClass] = useState<
    Map<string, ClassSubjectTeacher[]>
  >(new Map());
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  const [timetableCounts, setTimetableCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [searchMode, setSearchMode] = useState<ClassSearchMode>('all');
  const [search, setSearch] = useState('');
  const [teacherFilter, setTeacherFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState<'all' | 'has_students' | 'empty' | 'has_timetable'>('all');
  const [sortBy, setSortBy] = useState<ClassSortBy>('newest');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CollegeClass | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [description, setDescription] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<CollegeClass | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [{ data: classData, error: cErr }, teacherRes, countRes, ttRes, subTeacherRes] =
          await Promise.all([
            supabase
              .from('classes')
              .select('*, teacher:profiles!classes_teacher_id_fkey(id, full_name, email)')
              .order('created_at', { ascending: false })
              .returns<CollegeClass[]>(),
            adminRole
              ? supabase
                  .from('profiles')
                  .select('id, full_name, email, subject')
                  .eq('role', 'teacher')
                  .eq('is_active', true)
                  .order('full_name', { ascending: true })
                  .returns<Profile[]>()
              : Promise.resolve({ data: [] as Profile[], error: null }),
            !studentRole
              ? supabase.rpc('class_active_student_counts')
              : Promise.resolve({ data: null, error: null }),
            supabase.rpc('timetable_classes'),
            supabase
              .from('class_teachers')
              .select(
                'id, class_id, teacher_id, subject_name, created_at, teacher:profiles!class_teachers_teacher_id_fkey(id, full_name, email, subject)'
              )
              .returns<ClassSubjectTeacher[]>(),
          ]);
        if (cErr) throw new Error(cErr.message);
        if (teacherRes.error) throw new Error(teacherRes.error.message);

        setClasses(classData ?? []);
        setTeachers(teacherRes.data ?? []);

        const stMap = new Map<string, ClassSubjectTeacher[]>();
        if (!subTeacherRes.error) {
          for (const row of subTeacherRes.data ?? []) {
            const list = stMap.get(row.class_id) ?? [];
            list.push(row);
            stMap.set(row.class_id, list);
          }
        }
        setSubjectTeachersByClass(stMap);

        const tMap = new Map<string, number>();
        ((ttRes.data as TimetableClassSummary[] | null) ?? []).forEach((row) => {
          tMap.set(row.class_key, Number(row.entries));
        });
        setTimetableCounts(tMap);

        if (!studentRole) {
          if (!countRes.error && Array.isArray(countRes.data)) {
            const eMap = new Map<string, number>();
            (countRes.data as { class_id: string; student_count: number }[]).forEach((row) => {
              eMap.set(row.class_id, Number(row.student_count));
            });
            setMemberCounts(eMap);
          } else {
            // Fallback không chặn hiển thị danh sách lớp nếu chưa chạy migration RPC
            void fetchAllPages<{
              class_id: string;
              student: { academic_status: string | null } | null;
            }>((from, to, withCount) =>
              supabase
                .from('enrollments')
                .select(
                  'class_id, student:profiles!enrollments_student_id_fkey(academic_status)',
                  withCount ? { count: 'exact' } : undefined
                )
                .range(from, to)
                .returns<
                  {
                    class_id: string;
                    student: { academic_status: string | null } | null;
                  }[]
                >()
            )
              .then((enrRows) => {
                const eMap = new Map<string, number>();
                enrRows.forEach((row) => {
                  if (isDroppedOutStudent(row.student)) return;
                  eMap.set(row.class_id, (eMap.get(row.class_id) ?? 0) + 1);
                });
                setMemberCounts(eMap);
              })
              .catch(() => {
                // Bỏ qua lỗi phụ khi fallback đếm sĩ số
              });
          }
        }
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách lớp học');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [adminRole, studentRole, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, searchMode, teacherFilter, subjectFilter, sizeFilter, sortBy]);

  useRealtimeRefresh({
    channelName: 'classes-list-realtime',
    tables: [{ table: 'classes' }, { table: 'enrollments' }, { table: 'timetable_entries' }],
    onRefresh: () => load(true),
  });

  const subjectSuggestions = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => {
      if (t.subject?.trim()) set.add(t.subject.trim());
    });
    classes.forEach((c) => {
      if (c.subject?.trim()) set.add(c.subject.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [teachers, classes]);

  const filtered = useMemo(() => {
    const rawQ = search.trim();
    const qLower = rawQ.toLowerCase();
    const qPlain = stripVietnamese(rawQ);
    const nameTokens =
      searchMode === 'name' && rawQ
        ? rawQ
            .split(/[\s,;]+/)
            .map((t) => stripVietnamese(t))
            .filter(Boolean)
        : [];

    const list = classes.filter((cls) => {
      const stuCount = memberCounts.get(cls.id) ?? 0;
      const key = cls.class_key || classKey(cls.name);
      const ttCount = timetableCounts.get(key) ?? 0;

      if (teacherFilter === 'assigned' && !cls.teacher_id) return false;
      if (teacherFilter === 'unassigned' && cls.teacher_id) return false;
      if (subjectFilter !== 'all' && (cls.subject ?? '').trim() !== subjectFilter) return false;
      if (sizeFilter === 'has_students' && stuCount === 0) return false;
      if (sizeFilter === 'empty' && stuCount > 0) return false;
      if (sizeFilter === 'has_timetable' && ttCount === 0) return false;

      if (!rawQ) return true;

      const namePlain = stripVietnamese(cls.name);
      const subjectPlain = stripVietnamese(cls.subject ?? '');
      const teacherPlain = stripVietnamese(cls.teacher?.full_name ?? '');
      const descPlain = stripVietnamese(cls.description ?? '');

      if (searchMode === 'name') {
        if (nameTokens.length > 1) {
          return nameTokens.some((tok) => namePlain.includes(tok));
        }
        return cls.name.toLowerCase().includes(qLower) || namePlain.includes(qPlain);
      }
      if (searchMode === 'subject') {
        return (cls.subject ?? '').toLowerCase().includes(qLower) || subjectPlain.includes(qPlain);
      }
      if (searchMode === 'teacher') {
        return (
          (cls.teacher?.full_name ?? '').toLowerCase().includes(qLower) ||
          teacherPlain.includes(qPlain)
        );
      }

      return (
        cls.name.toLowerCase().includes(qLower) ||
        namePlain.includes(qPlain) ||
        subjectPlain.includes(qPlain) ||
        teacherPlain.includes(qPlain) ||
        descPlain.includes(qPlain)
      );
    });

    if (sortBy === 'name_asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }
    if (sortBy === 'students_desc') {
      return [...list].sort(
        (a, b) => (memberCounts.get(b.id) ?? 0) - (memberCounts.get(a.id) ?? 0)
      );
    }
    if (sortBy === 'students_asc') {
      return [...list].sort(
        (a, b) => (memberCounts.get(a.id) ?? 0) - (memberCounts.get(b.id) ?? 0)
      );
    }
    return list;
  }, [
    classes,
    search,
    searchMode,
    teacherFilter,
    subjectFilter,
    sizeFilter,
    sortBy,
    memberCounts,
    timetableCounts,
  ]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    teacherFilter !== 'all' ||
    subjectFilter !== 'all' ||
    sizeFilter !== 'all' ||
    sortBy !== 'newest';

  function resetFilters() {
    setSearch('');
    setSearchMode('all');
    setTeacherFilter('all');
    setSubjectFilter('all');
    setSizeFilter('all');
    setSortBy('newest');
  }

  function openCreate() {
    setEditing(null);
    setName('');
    setSubject('');
    setTeacherId('');
    setDescription('');
    setFormOpen(true);
  }

  function openEdit(cls: CollegeClass) {
    setEditing(cls);
    setName(cls.name);
    setSubject(cls.subject ?? '');
    setTeacherId(cls.teacher_id ?? '');
    setDescription(cls.description ?? '');
    setFormOpen(true);
  }

  async function handleSyncSystem() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.rpc('sync_system_classes');
      if (error) {
        if (error.message.toLowerCase().includes('could not find the function')) {
          throw new Error(
            'CSDL Supabase chưa chạy migration đồng bộ lớp học (supabase/migrations/20261115000004_sync_classes_system.sql).'
          );
        }
        throw new Error(error.message);
      }
      const created = Number(data ?? 0);
      await load();
      toast.success(
        created > 0
          ? `Đã đồng bộ thêm ${created} lớp học và xếp sinh viên trùng lớp`
          : 'Danh sách lớp và sinh viên đã khớp hoàn toàn với hệ thống'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đồng bộ được lớp học');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên lớp học');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim().replace(/\s+/g, ' '),
        subject: subject.trim() || null,
        teacher_id: teacherId || null,
        description: description.trim() || null,
      };

      if (editing) {
        const { error } = await supabase
          .from('classes')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success(`Đã cập nhật lớp ${payload.name}`);
      } else {
        const { error } = await supabase.from('classes').insert(payload);
        if (error) throw error;
        toast.success(`Đã tạo lớp học ${payload.name}`);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không lưu được thông tin lớp học'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('classes').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`Đã xóa lớp ${deleteTarget.name}`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không xóa được lớp học'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Lớp học</h1>
            <p className="text-sm font-normal text-ink-secondary">
              {adminRole
                ? 'Đồng bộ trực tiếp với danh sách Sinh viên & Thời khóa biểu; phân công giáo viên phụ trách'
                : teacherRole
                  ? 'Các lớp học bạn được Hiệu trưởng phân công giảng dạy, giao bài và chấm điểm'
                  : 'Truy cập tài liệu, thông báo và bài tập của các lớp bạn tham gia'}
            </p>
          </div>
          {adminRole && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" loading={syncing} onClick={handleSyncSystem}>
                <RefreshCw className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                <span>Đồng bộ từ SV & TKB</span>
              </Button>
              <Button variant="primary" onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Tạo lớp học</span>
              </Button>
            </div>
          )}
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <Select
                label="Tìm theo"
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as ClassSearchMode)}
                options={CLASS_SEARCH_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>

            <div className="md:col-span-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="class-search" className="block text-sm font-semibold text-ink-primary">
                  Từ khóa tìm kiếm
                </label>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Xóa bộ lọc</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  id="class-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    CLASS_SEARCH_OPTIONS.find((opt) => opt.value === searchMode)?.placeholder ??
                    'Tìm kiếm lớp học...'
                  }
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Giáo viên phụ trách"
              value={teacherFilter}
              onChange={(e) =>
                setTeacherFilter(e.target.value as 'all' | 'assigned' | 'unassigned')
              }
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'assigned', label: 'Đã phân công GV' },
                { value: 'unassigned', label: 'Chưa có giáo viên' },
              ]}
            />

            <Select
              label="Môn học / Ngành"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Tất cả môn / ngành' },
                ...subjectSuggestions.map((sub) => ({ value: sub, label: sub })),
              ]}
            />

            {!studentRole && (
              <Select
                label="Sĩ số / TKB"
                value={sizeFilter}
                onChange={(e) =>
                  setSizeFilter(
                    e.target.value as 'all' | 'has_students' | 'empty' | 'has_timetable'
                  )
                }
                options={[
                  { value: 'all', label: 'Tất cả lớp' },
                  { value: 'has_students', label: 'Có sinh viên (> 0 SV)' },
                  { value: 'empty', label: 'Chưa có sinh viên (0 SV)' },
                  { value: 'has_timetable', label: 'Có lịch TKB' },
                ]}
              />
            )}

            <Select
              label="Sắp xếp"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ClassSortBy)}
              options={[
                { value: 'newest', label: 'Mới nhất' },
                { value: 'name_asc', label: 'Tên lớp (A–Z)' },
                ...(!studentRole
                  ? [
                      { value: 'students_desc', label: 'Sĩ số nhiều nhất' },
                      { value: 'students_asc', label: 'Sĩ số ít nhất' },
                    ]
                  : []),
              ]}
            />
          </div>
        </section>

        {loading ? (
          <LoadingState message="Đang tải danh sách lớp học..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Chưa có lớp học nào"
            description={
              adminRole
                ? 'Nhấn "Đồng bộ từ SV & TKB" để lấy các lớp hiện có hoặc nhấn "Tạo lớp học" để mở lớp mới.'
                : teacherRole
                  ? 'Bạn chưa được Hiệu trưởng phân công phụ trách lớp học nào.'
                  : 'Bạn chưa được xếp vào lớp học nào.'
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((cls) => {
              const key = cls.class_key || classKey(cls.name);
              const stuCount = memberCounts.get(cls.id) ?? 0;
              const ttCount = timetableCounts.get(key) ?? 0;
              const unreadCount = getClassUnreadCount(cls.id);
              const canViewTimetable =
                ttCount > 0 && (!studentRole || profile?.class_key === key);

              return (
                <article
                  key={cls.id}
                  className="relative flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-6 transition-shadow hover:shadow-md"
                >
                  {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-navySoft text-brand-navy">
                        <BookOpen className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {cls.subject && <Badge tone="red">{cls.subject}</Badge>}
                        {!studentRole && <Badge tone="navy">{stuCount} SV</Badge>}
                        {ttCount > 0 && <Badge tone="success">{ttCount} buổi TKB</Badge>}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <h2 className="text-lg font-bold text-brand-navy">{cls.name}</h2>
                      {cls.description && (
                        <p className="line-clamp-2 text-sm font-normal text-ink-secondary">
                          {cls.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-normal text-ink-muted">
                      <User className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                      <span>
                        GVCN:{' '}
                        <strong className="text-ink-primary">
                          {cls.teacher?.full_name || 'Chưa phân công'}
                        </strong>
                      </span>
                      {(subjectTeachersByClass.get(cls.id)?.length ?? 0) > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            GV bộ môn:{' '}
                            <strong className="text-ink-primary">
                              {subjectTeachersByClass.get(cls.id)?.length}
                            </strong>
                          </span>
                        </>
                      )}
                      <span>•</span>
                      {!studentRole && (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                            {stuCount} sinh viên
                          </span>
                          <span>•</span>
                        </>
                      )}
                      <span>{formatDateVi(cls.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/classes/${cls.id}`}>
                        <Button size="sm" variant="navy">
                          <span>Vào lớp</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </Link>
                      {canViewTimetable && (
                        <Link
                          to={
                            studentRole
                              ? '/timetable'
                              : `/timetable?class=${encodeURIComponent(key)}`
                          }
                        >
                          <Button size="sm" variant="secondary">
                            <Calendar className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                            <span>Xem TKB</span>
                          </Button>
                        </Link>
                      )}
                    </div>

                    {adminRole && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(cls)}
                          aria-label={`Sửa lớp ${cls.name}`}
                        >
                          <Pencil className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeleteTarget(cls)}
                          aria-label={`Xóa lớp ${cls.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="flex justify-center pt-2">
                <Pagination
                  page={page}
                  totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
                  onPageChange={(next) => {
                    setPage(next);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <datalist id="class-subject-suggestions">
        {subjectSuggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) setFormOpen(false);
        }}
        title={editing ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới'}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="Tên lớp học"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: CSSD26-01, UDPM24-01"
            hint="Trùng tên lớp bên Quản lý sinh viên và Thời khóa biểu sẽ tự động xếp sinh viên vào lớp."
            required
          />

          <SearchableSelect
            label="Giáo viên chủ nhiệm"
            value={teacherId}
            onChange={setTeacherId}
            allowClear
            placeholder="(Chưa có giáo viên)"
            searchPlaceholder="Tìm tên, email hoặc bộ môn giáo viên..."
            options={teachers.map((t) => ({
              value: t.id,
              label: `${t.full_name}${t.subject ? ` — ${t.subject}` : ''}`,
              description: t.email,
            }))}
          />

          <Input
            label="Môn học / Chuyên ngành"
            list="class-subject-suggestions"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="VD: Chăm Sóc Sắc Đẹp, Ứng dụng phần mềm (UDPM)"
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="class-desc" className="text-sm font-semibold text-ink-primary">
              Mô tả lớp học
            </label>
            <textarea
              id="class-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Giới thiệu chuyên ngành, lịch học dự kiến hoặc ghi chú cho sinh viên..."
              className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editing ? 'Lưu thay đổi' : 'Tạo lớp học'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel="Xóa lớp học"
        title="Xác nhận xóa lớp học"
        message={`Bạn chắc chắn muốn xóa lớp "${deleteTarget?.name ?? ''}"? Toàn bộ thông báo, tài liệu, bài tập và điểm thuộc lớp này sẽ bị xóa (hồ sơ sinh viên và thời khóa biểu không bị xóa).`}
      />
    </Layout>
  );
}

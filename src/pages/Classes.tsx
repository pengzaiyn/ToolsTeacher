import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { classKey } from '@/lib/classKey';
import { formatClassActionError } from '@/lib/classStorage';
import { isAdmin, isStudent, isTeacher } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import type { CollegeClass, Profile, TimetableClassSummary } from '@/types/database';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export function Classes() {
  const { profile } = useAuth();
  const toast = useToast();

  const adminRole = isAdmin(profile?.role);
  const teacherRole = isTeacher(profile?.role);
  const studentRole = isStudent(profile?.role);

  const [classes, setClasses] = useState<CollegeClass[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  const [timetableCounts, setTimetableCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');

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
        const [{ data: classData, error: cErr }, teacherRes, enrRes, ttRes] = await Promise.all([
        supabase
          .from('classes')
          .select('*, teacher:profiles!classes_teacher_id_fkey(id, full_name, email)')
          .order('created_at', { ascending: false })
          .returns<CollegeClass[]>(),
        adminRole
          ? supabase
              .from('profiles')
              .select('*')
              .eq('role', 'teacher')
              .eq('is_active', true)
              .order('full_name', { ascending: true })
              .returns<Profile[]>()
          : Promise.resolve({ data: [] as Profile[], error: null }),
        !studentRole
          ? supabase.from('enrollments').select('class_id')
          : Promise.resolve({ data: [] as { class_id: string }[], error: null }),
        supabase.rpc('timetable_classes'),
      ]);
      if (cErr) throw new Error(cErr.message);
      if (teacherRes.error) throw new Error(teacherRes.error.message);

      setClasses(classData ?? []);
      setTeachers(teacherRes.data ?? []);

      const eMap = new Map<string, number>();
      ((enrRes.data as { class_id: string }[] | null) ?? []).forEach((row) => {
        eMap.set(row.class_id, (eMap.get(row.class_id) ?? 0) + 1);
      });
      setMemberCounts(eMap);

      const tMap = new Map<string, number>();
      ((ttRes.data as TimetableClassSummary[] | null) ?? []).forEach((row) => {
        tMap.set(row.class_key, Number(row.entries));
      });
      setTimetableCounts(tMap);
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : 'Không tải được danh sách lớp học');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [adminRole, studentRole, toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (cls) =>
        cls.name.toLowerCase().includes(q) ||
        (cls.subject ?? '').toLowerCase().includes(q) ||
        (cls.teacher?.full_name ?? '').toLowerCase().includes(q)
    );
  }, [classes, search]);

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

        <section className="rounded-xl border border-line bg-surface-card p-4">
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên lớp, môn học, giáo viên..."
              className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cls) => {
              const key = cls.class_key || classKey(cls.name);
              const stuCount = memberCounts.get(cls.id) ?? 0;
              const ttCount = timetableCounts.get(key) ?? 0;
              const canViewTimetable =
                ttCount > 0 && (!studentRole || profile?.class_key === key);

              return (
                <article
                  key={cls.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-6 transition-shadow hover:shadow-md"
                >
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
                        GV:{' '}
                        <strong className="text-ink-primary">
                          {cls.teacher?.full_name || 'Chưa có giáo viên'}
                        </strong>
                      </span>
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

          <Select
            label="Giáo viên phụ trách"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            options={[
              { value: '', label: '(Chưa có giáo viên)' },
              ...teachers.map((t) => ({
                value: t.id,
                label: `${t.full_name}${t.subject ? ` — Chủ nhiệm: ${t.subject}` : ''}`,
              })),
            ]}
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

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FileSpreadsheet, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { classKey } from '@/lib/classKey';
import { normalizeStudentCode, studentEmail } from '@/lib/email';
import { manageUsers, supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import type { Gender, Profile, TimetableClassSummary } from '@/types/database';
import { AccountActions } from '@/components/AccountActions';
import { Layout } from '@/components/Layout';
import { StudentImportModal } from '@/components/admin/StudentImportModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

const GENDER_OPTIONS = [
  { value: 'Nam', label: 'Nam' },
  { value: 'Nữ', label: 'Nữ' },
  { value: 'Khác', label: 'Khác' },
];

export function AdminStudents() {
  const toast = useToast();

  const [students, setStudents] = useState<Profile[]>([]);
  const [timetableClasses, setTimetableClasses] = useState<string[]>([]);
  const [systemClasses, setSystemClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<Gender>('Nam');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [className, setClassName] = useState('');
  const [admissionsAdvisor, setAdmissionsAdvisor] = useState('');

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<Gender>('Nam');
  const [editDob, setEditDob] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editAdvisor, setEditAdvisor] = useState('');

  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [{ data: stuRes, error: stuErr }, { data: ttData }, { data: clsData }] =
          await Promise.all([
            supabase
              .from('profiles')
              .select('*')
              .eq('role', 'student')
              .order('created_at', { ascending: false })
              .returns<Profile[]>(),
            supabase.rpc('timetable_classes'),
            supabase.from('classes').select('name').order('name', { ascending: true }),
          ]);
        if (stuErr) throw new Error(stuErr.message);
        setStudents(stuRes ?? []);
        const ttRows = (ttData as TimetableClassSummary[] | null) ?? [];
        setTimetableClasses(ttRows.map((r) => r.class_name));
        setSystemClasses(((clsData as { name: string }[] | null) ?? []).map((r) => r.name));
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách sinh viên');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeRefresh({
    channelName: 'admin-students-realtime',
    tables: [{ table: 'profiles' }, { table: 'classes' }],
    onRefresh: () => loadData(true),
  });

  const classSuggestions = useMemo(() => {
    const map = new Map<string, string>();
    [...systemClasses, ...timetableClasses, ...students.map((s) => s.class_name ?? '')].forEach(
      (name) => {
        const cleaned = name.trim().replace(/\s+/g, ' ');
        if (!cleaned) return;
        const key = classKey(cleaned);
        if (!map.has(key)) map.set(key, cleaned);
      }
    );
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [students, timetableClasses, systemClasses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'inactive' && s.is_active) return false;
      if (classFilter === 'unassigned' && s.class_key) return false;
      if (classFilter !== 'all' && classFilter !== 'unassigned' && s.class_key !== classFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.student_code ?? '').toLowerCase().includes(q) ||
        (s.class_name ?? '').toLowerCase().includes(q) ||
        (s.admissions_advisor ?? '').toLowerCase().includes(q)
      );
    });
  }, [students, search, classFilter, statusFilter]);

  const emailPreview = useMemo(() => {
    const normalized = normalizeStudentCode(studentCode);
    if (!normalized || !fullName.trim()) return null;
    return studentEmail(fullName, normalized);
  }, [fullName, studentCode]);

  const duplicateStudentOwner = useMemo(() => {
    const normalized = normalizeStudentCode(studentCode);
    if (!normalized) return null;
    return students.find((s) => s.student_code?.trim() === normalized) ?? null;
  }, [studentCode, students]);

  const duplicateEmailOwner = useMemo(() => {
    if (!emailPreview) return null;
    const lower = emailPreview.toLowerCase();
    return students.find((s) => s.email.toLowerCase() === lower) ?? null;
  }, [emailPreview, students]);

  function resetCreateForm() {
    setFullName('');
    setGender('Nam');
    setDateOfBirth('');
    setStudentCode('');
    setClassName('');
    setAdmissionsAdvisor('');
  }

  async function handleCreateStudent(event: FormEvent) {
    event.preventDefault();
    if (!fullName.trim()) {
      toast.error('Vui lòng nhập họ tên sinh viên');
      return;
    }
    if (!dateOfBirth) {
      toast.error('Vui lòng chọn ngày sinh');
      return;
    }
    const trimmedCode = studentCode.trim();
    const normalizedCode = trimmedCode ? normalizeStudentCode(trimmedCode) : undefined;
    if (trimmedCode && !normalizedCode) {
      toast.error('Mã sinh viên phải bắt đầu bằng 6111 và gồm 11 chữ số (hoặc nhập 7 số cuối)');
      return;
    }

    setCreating(true);
    try {
      const res = await manageUsers({
        action: 'create_student',
        full_name: fullName.trim(),
        gender,
        date_of_birth: dateOfBirth,
        student_code: normalizedCode ?? undefined,
        class_name: className.trim() || undefined,
        admissions_advisor: admissionsAdvisor.trim() || undefined,
      });
      toast.success(
        `Đã tạo tài khoản sinh viên ${res.user?.full_name ?? ''} (${res.user?.email ?? ''})`
      );
      setCreateOpen(false);
      resetCreateForm();
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được sinh viên');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(student: Profile) {
    setEditing(student);
    setEditName(student.full_name);
    setEditGender(student.gender ?? 'Nam');
    setEditDob(student.date_of_birth ?? '');
    setEditClass(student.class_name ?? '');
    setEditAdvisor(student.admissions_advisor ?? '');
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!editName.trim()) {
      toast.error('Vui lòng nhập họ tên sinh viên');
      return;
    }

    setEditSaving(true);
    try {
      const cleanClass = editClass.trim().replace(/\s+/g, ' ');
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          gender: editGender,
          date_of_birth: editDob || null,
          class_name: cleanClass || null,
          class_key: cleanClass ? classKey(cleanClass) : null,
          admissions_advisor: editAdvisor.trim() || null,
        })
        .eq('id', editing.id);

      if (error) throw new Error(error.message);
      toast.success(`Đã cập nhật hồ sơ sinh viên ${editName.trim()}`);
      setEditing(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không lưu được thay đổi');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      await manageUsers({ action: 'delete_student', user_id: deleting.id });
      toast.success(`Đã xóa tài khoản sinh viên ${deleting.full_name}`);
      setDeleting(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xóa được sinh viên');
    } finally {
      setDeletingLoading(false);
    }
  }

  const columns: TableColumn<Profile>[] = [
    {
      key: 'student',
      header: 'Sinh viên',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink-primary">{row.full_name}</span>
          <span className="text-xs font-normal text-ink-muted">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Mã SV',
      render: (row) => (
        <span className="whitespace-nowrap font-semibold text-brand-navy">
          {row.student_code || '—'}
        </span>
      ),
    },
    {
      key: 'class',
      header: 'Lớp học',
      render: (row) =>
        row.class_name ? (
          <Badge tone="navy">{row.class_name}</Badge>
        ) : (
          <span className="text-xs font-normal text-ink-muted">Chưa gán lớp</span>
        ),
    },
    {
      key: 'bio',
      header: 'Giới tính / Ngày sinh',
      render: (row) => (
        <div className="flex flex-col text-xs font-normal text-ink-secondary">
          <span>{row.gender || '—'}</span>
          <span>{row.date_of_birth ? formatDateVi(row.date_of_birth) : '—'}</span>
        </div>
      ),
    },
    {
      key: 'advisor',
      header: 'Tư vấn TS',
      render: (row) => (
        <span className="text-sm font-normal text-ink-secondary">
          {row.admissions_advisor || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <Badge tone={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Hoạt động' : 'Đã khóa'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Sửa / Gán lớp</span>
          </Button>
          <AccountActions account={row} onUpdated={loadData} />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDeleting(row)}
            title="Xóa tài khoản sinh viên"
          >
            <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
            <span>Xóa</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Quản lý sinh viên</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Tạo tài khoản theo quy chuẩn nhà trường, gán lớp học và quản lý trạng thái truy cập
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              <span>Nhập từ Excel</span>
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Thêm sinh viên</span>
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-card p-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="student-search" className="mb-2 block text-sm font-semibold text-ink-primary">
              Tìm kiếm sinh viên
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="student-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tên, mã sinh viên, email, lớp..."
                className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
            </div>
          </div>

          <Select
            label="Lọc theo lớp"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Tất cả lớp' },
              { value: 'unassigned', label: 'Chưa gán lớp' },
              ...classSuggestions.map((cls) => ({ value: classKey(cls), label: cls })),
            ]}
          />

          <Select
            label="Trạng thái"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'inactive', label: 'Đã khóa' },
            ]}
          />
        </section>

        {loading ? (
          <LoadingState message="Đang tải danh sách sinh viên..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có sinh viên phù hợp"
            description={
              students.length === 0
                ? 'Nhấn "Thêm sinh viên" để tạo tài khoản sinh viên đầu tiên.'
                : 'Không tìm thấy sinh viên khớp bộ lọc hiện tại.'
            }
          />
        ) : (
          <Table
            columns={columns}
            data={filtered}
            rowKey={(row) => row.id}
            caption="Danh sách sinh viên"
          />
        )}
      </div>

      <datalist id="class-suggestions-list">
        {classSuggestions.map((cls) => (
          <option key={cls} value={cls} />
        ))}
      </datalist>

      <Modal
        open={createOpen}
        onClose={() => {
          if (!creating) setCreateOpen(false);
        }}
        title="Tạo tài khoản sinh viên"
        size="lg"
      >
        <form onSubmit={handleCreateStudent} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Họ và tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
            />
            <Select
              label="Giới tính"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              options={GENDER_OPTIONS}
              required
            />
            <Input
              label="Ngày sinh"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
            />
            <Input
              label="Mã sinh viên (tùy chọn)"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="VD: 2600002 hoặc 61112600002"
              hint="Bắt buộc đầu 6111 + 7 số cuối (11 chữ số). Có thể nhập 7 số cuối để tự ghép 6111, hoặc để trống hệ thống tự cấp."
            />
            <Input
              label="Lớp học"
              list="class-suggestions-list"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="VD: CNTT-K18A"
              hint="Chọn lớp có sẵn hoặc nhập tên mới; sinh viên sẽ tự động được xếp vào lớp học và xem được TKB."
            />
            <Input
              label="Tư vấn tuyển sinh"
              value={admissionsAdvisor}
              onChange={(e) => setAdmissionsAdvisor(e.target.value)}
              placeholder="Họ tên cán bộ tư vấn"
            />
          </div>

          <div className="rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
            {emailPreview ? (
              <span>
                Email đăng nhập dự kiến:{' '}
                <strong className="font-semibold text-brand-navy">{emailPreview}</strong>
              </span>
            ) : (
              <span>
                Email sinh viên sẽ được tự động tạo từ tên + 8 số cuối mã sinh viên với đuôi{' '}
                <strong className="font-semibold text-brand-navy">
                  @caodangvietmyhanoi.edu.vn
                </strong>
                . Mật khẩu ban đầu dùng mật khẩu mặc định của hệ thống.
              </span>
            )}
          </div>

          {(duplicateStudentOwner || duplicateEmailOwner) && (
            <div className="flex flex-col gap-2 rounded-lg border border-status-dangerBorder bg-status-dangerBg p-3 text-xs text-status-dangerText">
              <p className="font-semibold">
                {duplicateStudentOwner
                  ? `Mã sinh viên ${duplicateStudentOwner.student_code} đã thuộc về ${duplicateStudentOwner.full_name} (${duplicateStudentOwner.email}).`
                  : `Email dự kiến ${emailPreview} đã thuộc về ${duplicateEmailOwner?.full_name}.`}
              </p>
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setStudentCode('')}
                >
                  Xóa mã để hệ thống tự cấp mã mới
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={creating}
              disabled={Boolean(duplicateStudentOwner || duplicateEmailOwner)}
            >
              Tạo sinh viên
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => {
          if (!editSaving) setEditing(null);
        }}
        title="Chỉnh sửa hồ sơ & gán lớp"
        size="md"
      >
        {editing && (
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div className="rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
              <p>
                Email: <strong className="text-ink-primary">{editing.email}</strong>
              </p>
              <p className="mt-2">
                Mã sinh viên:{' '}
                <strong className="text-brand-navy">{editing.student_code || '—'}</strong>
              </p>
            </div>

            <Input
              label="Họ và tên"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Giới tính"
                value={editGender}
                onChange={(e) => setEditGender(e.target.value as Gender)}
                options={GENDER_OPTIONS}
                required
              />
              <Input
                label="Ngày sinh"
                type="date"
                value={editDob}
                onChange={(e) => setEditDob(e.target.value)}
              />
            </div>
            <Input
              label="Lớp học"
              list="class-suggestions-list"
              value={editClass}
              onChange={(e) => setEditClass(e.target.value)}
              placeholder="VD: CNTT-K18A"
              hint="Chọn lớp có sẵn hoặc nhập tên mới; sinh viên sẽ tự động được xếp vào lớp học và xem được TKB."
            />
            <Input
              label="Tư vấn tuyển sinh"
              value={editAdvisor}
              onChange={(e) => setEditAdvisor(e.target.value)}
            />

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button
                variant="secondary"
                onClick={() => setEditing(null)}
                disabled={editSaving}
              >
                Hủy
              </Button>
              <Button type="submit" variant="navy" loading={editSaving}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        loading={deletingLoading}
        confirmVariant="danger"
        confirmLabel="Xóa sinh viên"
        title="Xác nhận xóa sinh viên"
        message={
          deleting
            ? `Bạn chắc chắn muốn xóa vĩnh viễn tài khoản sinh viên ${deleting.full_name}${
                deleting.student_code ? ` (${deleting.student_code})` : ''
              }? Toàn bộ ghi danh lớp học và bài nộp liên quan sẽ bị xóa và không thể khôi phục.`
            : ''
        }
      />
      <StudentImportModal
        open={importOpen}
        existingStudents={students}
        onClose={() => setImportOpen(false)}
        onImported={loadData}
      />
    </Layout>
  );
}

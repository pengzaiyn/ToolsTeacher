import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { isValidAvatarUrl } from '@/lib/avatar';
import { maskCccd, maskPhone } from '@/lib/privacy';
import { isDroppedOutStudent } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { formatClassActionError, formatDateTimeVi } from '@/lib/classStorage';
import { formatDateVi } from '@/lib/week';
import type { Enrollment, Profile } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

type StudentCandidate = Pick<
  Profile,
  'id' | 'full_name' | 'email' | 'student_code' | 'class_name' | 'class_key' | 'academic_status'
>;

interface ClassmateRow {
  student_id: string;
  full_name: string;
  student_code: string | null;
  class_name: string | null;
  cohort: string | null;
  major: string | null;
  avatar_url: string | null;
  is_self: boolean;
}

interface ClassMembersTabProps {
  classId: string;
  canManage: boolean;
  canViewSensitive?: boolean;
  isStudentView?: boolean;
}

export function ClassMembersTab({
  classId,
  canManage,
  canViewSensitive = false,
  isStudentView = false,
}: ClassMembersTabProps) {
  const toast = useToast();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classmates, setClassmates] = useState<ClassmateRow[]>([]);
  const [classmateSearch, setClassmateSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPhones, setShowPhones] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [candidateStudents, setCandidateStudents] = useState<StudentCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [homeroomClasses, setHomeroomClasses] = useState<{ value: string; label: string }[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [bulkClassKey, setBulkClassKey] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<Enrollment | null>(null);
  const [removing, setRemoving] = useState(false);
  const [detailStudent, setDetailStudent] = useState<Profile | null>(null);
  const [detailSensitive, setDetailSensitive] = useState<{
    cccd: string | null;
    cccd_issued_date: string | null;
  } | null>(null);
  const [modalShowPhone, setModalShowPhone] = useState(false);
  const [modalShowCccd, setModalShowCccd] = useState(false);

  useEffect(() => {
    setModalShowPhone(false);
    setModalShowCccd(false);
    if (!detailStudent || !canViewSensitive) {
      setDetailSensitive(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('student_sensitive_profiles')
      .select('cccd, cccd_issued_date')
      .eq('student_id', detailStudent.id)
      .maybeSingle<{ cccd: string | null; cccd_issued_date: string | null }>()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setDetailSensitive(data);
        } else {
          setDetailSensitive(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [detailStudent, canViewSensitive]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        if (isStudentView) {
          const { data, error } = await supabase.rpc('list_class_classmates', {
            p_class_id: classId,
          });
          if (error) throw new Error(error.message);
          setClassmates((data as ClassmateRow[] | null) ?? []);
          return;
        }

        const { data: enrData, error: eErr } = await supabase
          .from('enrollments')
          .select('*, student:profiles!enrollments_student_id_fkey(*)')
          .eq('class_id', classId)
          .order('enrolled_at', { ascending: false })
          .returns<Enrollment[]>();

        if (eErr) throw new Error(eErr.message);

        setEnrollments((enrData ?? []).filter((row) => !isDroppedOutStudent(row.student)));
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách thành viên');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [classId, isStudentView, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    channelName: `class-members-${classId}`,
    tables: [{ table: 'enrollments', filter: `class_id=eq.${classId}` }],
    onRefresh: () => load(true),
  });

  // Tải danh sách lớp hành chính 1 lần khi mở modal "Thêm sinh viên"
  useEffect(() => {
    if (!addOpen || !canManage || homeroomClasses.length > 0) return;
    let cancelled = false;
    supabase
      .from('classes')
      .select('class_key, name')
      .order('name', { ascending: true })
      .returns<{ class_key: string | null; name: string }[]>()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const map = new Map<string, string>();
        data.forEach((cls) => {
          if (cls.class_key && cls.name && !map.has(cls.class_key)) {
            map.set(cls.class_key, cls.name);
          }
        });
        setHomeroomClasses(
          Array.from(map.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
        );
      });
    return () => {
      cancelled = true;
    };
  }, [addOpen, canManage, homeroomClasses.length]);

  // Tìm kiếm sinh viên trực tiếp trên server (tối đa 60 kết quả/lần, không tải toàn bộ 5.700 SV)
  useEffect(() => {
    if (!addOpen || !canManage) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingCandidates(true);
      try {
        const q = studentSearch.trim().replace(/[,%()]/g, ' ').trim();
        let query = supabase
          .from('profiles')
          .select('id, full_name, email, student_code, class_name, class_key, academic_status')
          .eq('role', 'student')
          .eq('is_active', true)
          .order('full_name', { ascending: true })
          .limit(60);

        if (q) {
          query = query.or(
            `full_name.ilike.%${q}%,student_code.ilike.%${q}%,email.ilike.%${q}%,class_name.ilike.%${q}%,phone.ilike.%${q}%`
          );
        }

        const { data, error } = await query.returns<StudentCandidate[]>();
        if (error) throw new Error(error.message);
        if (!cancelled) {
          setCandidateStudents((data ?? []).filter((s) => !isDroppedOutStudent(s)));
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Không tìm được sinh viên');
        }
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addOpen, canManage, studentSearch, toast]);

  const enrolledIds = useMemo(
    () => new Set(enrollments.map((item) => item.student_id)),
    [enrollments]
  );

  const availableStudents = useMemo(
    () => candidateStudents.filter((stu) => !enrolledIds.has(stu.id)),
    [candidateStudents, enrolledIds]
  );

  async function handleAddStudent(student: StudentCandidate) {
    setAddingId(student.id);
    try {
      const { error } = await supabase.from('enrollments').insert({
        class_id: classId,
        student_id: student.id,
      });
      if (error) throw new Error(error.message);
      toast.success(`Đã thêm sinh viên ${student.full_name} vào lớp`);
      await load(true);
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không thêm được sinh viên'));
    } finally {
      setAddingId(null);
    }
  }

  async function handleBulkAddByClass() {
    if (!bulkClassKey) return;
    setBulkAdding(true);
    try {
      const { data: classStudents, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, academic_status')
        .eq('role', 'student')
        .eq('is_active', true)
        .eq('class_key', bulkClassKey)
        .returns<{ id: string; academic_status: string | null }[]>();

      if (fetchErr) throw new Error(fetchErr.message);

      const candidates = (classStudents ?? []).filter(
        (stu) => !isDroppedOutStudent(stu) && !enrolledIds.has(stu.id)
      );
      if (candidates.length === 0) {
        toast.info('Tất cả sinh viên lớp này đã có trong danh sách');
        return;
      }

      const payload = candidates.map((stu) => ({
        class_id: classId,
        student_id: stu.id,
      }));
      const { error } = await supabase.from('enrollments').insert(payload);
      if (error) throw new Error(error.message);
      toast.success(`Đã thêm ${candidates.length} sinh viên vào lớp học`);
      setBulkClassKey('');
      await load(true);
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không thêm được danh sách lớp'));
    } finally {
      setBulkAdding(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', removeTarget.id);
      if (error) throw new Error(error.message);
      toast.success('Đã xóa sinh viên khỏi lớp');
      setRemoveTarget(null);
      await load(true);
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không xóa được sinh viên khỏi lớp'));
    } finally {
      setRemoving(false);
    }
  }

  const columns: TableColumn<Enrollment>[] = [
    {
      key: 'student',
      header: 'Sinh viên',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink-primary">{row.student?.full_name || '—'}</span>
          <span className="text-xs font-normal text-ink-muted">{row.student?.email || '—'}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Mã SV',
      render: (row) => (
        <span className="font-semibold text-brand-navy">{row.student?.student_code || '—'}</span>
      ),
    },
    {
      key: 'class',
      header: 'Lớp hành chính',
      render: (row) =>
        row.student?.class_name ? (
          <Badge tone="navy">{row.student.class_name}</Badge>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
    {
      key: 'academic',
      header: 'Khóa / Ngành',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-ink-primary">
            {row.student?.cohort || '—'}
          </span>
          <span className="text-xs font-normal text-ink-muted">
            {row.student?.major || row.student?.faculty || '—'}
          </span>
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'phone',
            header: 'Số điện thoại',
            render: (row: Enrollment) => (
              <span className="whitespace-nowrap font-mono text-xs font-medium text-ink-secondary">
                {row.student?.phone
                  ? showPhones
                    ? row.student.phone
                    : maskPhone(row.student.phone)
                  : '—'}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'enrolled_at',
      header: 'Ngày ghi danh',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-muted">
          {formatDateTimeVi(row.enrolled_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (row: Enrollment) => (
        <div className="flex flex-wrap items-center gap-2">
          {row.student && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDetailStudent(row.student as Profile)}
            >
              <Eye className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              <span>Hồ sơ</span>
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setRemoveTarget(row)}>
              <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
              <span>Xóa khỏi lớp</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  const filteredClassmates = useMemo(() => {
    const q = classmateSearch.trim().toLowerCase();
    if (!q) return classmates;
    return classmates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.student_code ?? '').toLowerCase().includes(q) ||
        (c.class_name ?? '').toLowerCase().includes(q)
    );
  }, [classmates, classmateSearch]);

  const classmateColumns: TableColumn<ClassmateRow>[] = [
    {
      key: 'student',
      header: 'Sinh viên',
      render: (row) => {
        const hasAvatar = isValidAvatarUrl(row.avatar_url);
        const initials = row.full_name
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((w) => w[0]?.toUpperCase() ?? '')
          .join('');
        return (
          <div className="flex items-center gap-3">
            {hasAvatar ? (
              <img
                src={row.avatar_url!}
                alt={row.full_name}
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-line"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navySoft text-xs font-bold text-brand-navy">
                {initials || 'SV'}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-ink-primary">{row.full_name}</span>
              {row.is_self && <Badge tone="red">Bạn</Badge>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'code',
      header: 'Mã SV',
      render: (row) => (
        <span className="font-semibold text-brand-navy">{row.student_code || '—'}</span>
      ),
    },
    {
      key: 'class',
      header: 'Lớp hành chính',
      render: (row) =>
        row.class_name ? (
          <Badge tone="navy">{row.class_name}</Badge>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
    {
      key: 'academic',
      header: 'Khóa / Ngành',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-ink-primary">{row.cohort || '—'}</span>
          <span className="text-xs font-normal text-ink-muted">{row.major || '—'}</span>
        </div>
      ),
    },
  ];

  if (isStudentView) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink-primary">Danh sách bạn cùng lớp</h2>
            <Badge tone="navy">{classmates.length} sinh viên</Badge>
          </div>
          {classmates.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={classmateSearch}
                onChange={(e) => setClassmateSearch(e.target.value)}
                placeholder="Tìm bạn cùng lớp theo tên hoặc mã SV..."
                className="h-9 w-full rounded-lg border border-line-strong bg-surface-card pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
            </div>
          )}
        </div>

        {loading ? (
          <LoadingState message="Đang tải danh sách thành viên..." />
        ) : filteredClassmates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có sinh viên nào trong lớp"
            description="Lớp học này chưa có danh sách sinh viên khớp tìm kiếm."
          />
        ) : (
          <Table
            columns={classmateColumns}
            data={filteredClassmates}
            rowKey={(row) => row.student_id}
            caption="Danh sách bạn cùng lớp"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink-primary">Sinh viên trong lớp</h2>
          <Badge tone="navy">{enrollments.length} sinh viên</Badge>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowPhones((v) => !v)}
            >
              {showPhones ? (
                <EyeOff className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              )}
              <span>{showPhones ? 'Ẩn SĐT' : 'Hiện SĐT'}</span>
            </Button>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>Thêm sinh viên</span>
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState message="Đang tải danh sách thành viên..." />
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Chưa có sinh viên nào trong lớp"
          description={
            canManage
              ? 'Thêm từng sinh viên hoặc thêm nhanh cả lớp hành chính.'
              : 'Lớp học này chưa có sinh viên nào được ghi danh.'
          }
        />
      ) : (
        <Table
          columns={columns}
          data={enrollments}
          rowKey={(row) => row.id}
          caption="Danh sách sinh viên trong lớp"
        />
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Thêm sinh viên vào lớp" size="lg">
        <div className="flex flex-col gap-6">
          {homeroomClasses.length > 0 && (
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-page p-4">
              <p className="text-sm font-bold text-brand-navy">Thêm nhanh theo lớp hành chính</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select
                    label="Chọn lớp hành chính"
                    value={bulkClassKey}
                    onChange={(e) => setBulkClassKey(e.target.value)}
                    options={homeroomClasses}
                    placeholder="-- Chọn lớp --"
                  />
                </div>
                <Button
                  variant="navy"
                  disabled={!bulkClassKey}
                  loading={bulkAdding}
                  onClick={handleBulkAddByClass}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Thêm cả lớp</span>
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Tìm sinh viên theo tên, mã SV, email, lớp..."
                className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
            </div>

            {loadingCandidates ? (
              <LoadingState message="Đang tìm sinh viên..." />
            ) : availableStudents.length === 0 ? (
              <p className="py-4 text-center text-sm font-normal text-ink-muted">
                Không còn sinh viên khả dụng khớp tìm kiếm.
              </p>
            ) : (
              <div className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line">
                {availableStudents.slice(0, 50).map((stu) => (
                  <div
                    key={stu.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-4"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-ink-primary">
                        {stu.full_name}
                        {stu.student_code ? ` (${stu.student_code})` : ''}
                      </span>
                      <span className="text-xs font-normal text-ink-muted">
                        {stu.email}
                        {stu.class_name ? ` — Lớp ${stu.class_name}` : ''}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="navy"
                      loading={addingId === stu.id}
                      onClick={() => handleAddStudent(stu)}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>Thêm</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(detailStudent)}
        onClose={() => setDetailStudent(null)}
        title="Hồ sơ sinh viên"
        size="md"
      >
        {detailStudent && (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: 'Họ và tên', value: detailStudent.full_name },
              { label: 'Mã sinh viên', value: detailStudent.student_code },
              { label: 'Email', value: detailStudent.email, fullWidth: true },
              { label: 'Lớp học', value: detailStudent.class_name },
              { label: 'Khóa học', value: detailStudent.cohort },
              { label: 'Khoa', value: detailStudent.faculty },
              { label: 'Ngành học', value: detailStudent.major },
              { label: 'Giới tính', value: detailStudent.gender },
              {
                label: 'Ngày sinh',
                value: detailStudent.date_of_birth ? formatDateVi(detailStudent.date_of_birth) : null,
              },
              { label: 'Nơi sinh', value: detailStudent.place_of_birth },
              {
                label: 'Số điện thoại',
                value: detailStudent.phone
                  ? modalShowPhone || showPhones
                    ? detailStudent.phone
                    : maskPhone(detailStudent.phone)
                  : null,
                toggle: detailStudent.phone
                  ? {
                      revealed: modalShowPhone || showPhones,
                      onToggle: () => setModalShowPhone((v) => !v),
                    }
                  : undefined,
              },
              ...(canViewSensitive
                ? [
                    {
                      label: 'Số CCCD',
                      value: detailSensitive?.cccd
                        ? modalShowCccd
                          ? detailSensitive.cccd
                          : maskCccd(detailSensitive.cccd)
                        : null,
                      toggle: detailSensitive?.cccd
                        ? {
                            revealed: modalShowCccd,
                            onToggle: () => setModalShowCccd((v) => !v),
                          }
                        : undefined,
                    },
                    {
                      label: 'Ngày cấp CCCD',
                      value: detailSensitive?.cccd_issued_date
                        ? formatDateVi(detailSensitive.cccd_issued_date)
                        : null,
                    },
                  ]
                : []),
            ].map((item) => (
              <div
                key={item.label}
                className={`min-w-0 rounded-lg bg-surface-page p-3 ${
                  'fullWidth' in item && item.fullWidth ? 'sm:col-span-2' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs font-normal text-ink-muted">{item.label}</dt>
                  {'toggle' in item && item.toggle && (
                    <button
                      type="button"
                      onClick={item.toggle.onToggle}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-navy hover:underline"
                    >
                      {item.toggle.revealed ? (
                        <EyeOff className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span>{item.toggle.revealed ? 'Ẩn số' : 'Hiện số'}</span>
                    </button>
                  )}
                </div>
                <dd className="mt-1 break-words text-sm font-semibold text-ink-primary">
                  {item.value || '—'}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        loading={removing}
        confirmLabel="Xóa khỏi lớp"
        title="Xác nhận xóa sinh viên khỏi lớp"
        message={`Bạn muốn xóa ${removeTarget?.student?.full_name ?? 'sinh viên này'} khỏi lớp học?`}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { isDroppedOutStudent } from '@/lib/roles';
import { fetchAllPages, supabase } from '@/lib/supabase';
import { formatClassActionError, formatDateTimeVi } from '@/lib/classStorage';
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

interface ClassMembersTabProps {
  classId: string;
  canManage: boolean;
}

export function ClassMembersTab({ classId, canManage }: ClassMembersTabProps) {
  const toast = useToast();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [allStudents, setAllStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [bulkClassKey, setBulkClassKey] = useState('');
  const [bulkAdding, setBulkAdding] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<Enrollment | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [{ data: enrData, error: eErr }, stuData] = await Promise.all([
          supabase
            .from('enrollments')
            .select(
              '*, student:profiles!enrollments_student_id_fkey(id, full_name, email, student_code, class_name, is_active, academic_status)'
            )
            .eq('class_id', classId)
            .order('enrolled_at', { ascending: false })
            .returns<Enrollment[]>(),
          canManage
            ? fetchAllPages<Profile>((from, to, withCount) =>
                supabase
                  .from('profiles')
                  .select('*', withCount ? { count: 'exact' } : undefined)
                  .eq('role', 'student')
                  .eq('is_active', true)
                  .order('full_name', { ascending: true })
                  .range(from, to)
                  .returns<Profile[]>()
              )
            : Promise.resolve([] as Profile[]),
        ]);

        if (eErr) throw new Error(eErr.message);

        setEnrollments((enrData ?? []).filter((row) => !isDroppedOutStudent(row.student)));
        setAllStudents(stuData.filter((s) => !isDroppedOutStudent(s)));
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách thành viên');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [classId, canManage, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    channelName: `class-members-${classId}`,
    tables: [{ table: 'enrollments', filter: `class_id=eq.${classId}` }, { table: 'profiles' }],
    onRefresh: () => load(true),
  });

  const enrolledIds = useMemo(
    () => new Set(enrollments.map((item) => item.student_id)),
    [enrollments]
  );

  const availableStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return allStudents.filter((stu) => {
      if (enrolledIds.has(stu.id)) return false;
      if (!q) return true;
      return (
        stu.full_name.toLowerCase().includes(q) ||
        stu.email.toLowerCase().includes(q) ||
        (stu.student_code ?? '').toLowerCase().includes(q) ||
        (stu.class_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [allStudents, enrolledIds, studentSearch]);

  const homeroomClasses = useMemo(() => {
    const map = new Map<string, string>();
    allStudents.forEach((stu) => {
      if (stu.class_key && stu.class_name && !map.has(stu.class_key)) {
        map.set(stu.class_key, stu.class_name);
      }
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ value: key, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [allStudents]);

  async function handleAddStudent(student: Profile) {
    setAddingId(student.id);
    try {
      const { error } = await supabase.from('enrollments').insert({
        class_id: classId,
        student_id: student.id,
      });
      if (error) throw new Error(error.message);
      toast.success(`Đã thêm sinh viên ${student.full_name} vào lớp`);
      await load();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không thêm được sinh viên'));
    } finally {
      setAddingId(null);
    }
  }

  async function handleBulkAddByClass() {
    if (!bulkClassKey) return;
    const candidates = allStudents.filter(
      (stu) => stu.class_key === bulkClassKey && !enrolledIds.has(stu.id)
    );
    if (candidates.length === 0) {
      toast.info('Tất cả sinh viên lớp này đã có trong danh sách');
      return;
    }

    setBulkAdding(true);
    try {
      const payload = candidates.map((stu) => ({
        class_id: classId,
        student_id: stu.id,
      }));
      const { error } = await supabase.from('enrollments').insert(payload);
      if (error) throw new Error(error.message);
      toast.success(`Đã thêm ${candidates.length} sinh viên vào lớp học`);
      setBulkClassKey('');
      await load();
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
      await load();
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
      key: 'enrolled_at',
      header: 'Ngày ghi danh',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-muted">
          {formatDateTimeVi(row.enrolled_at)}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Thao tác',
            render: (row: Enrollment) => (
              <Button size="sm" variant="secondary" onClick={() => setRemoveTarget(row)}>
                <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                <span>Xóa khỏi lớp</span>
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink-primary">Sinh viên trong lớp</h2>
          <Badge tone="navy">{enrollments.length} sinh viên</Badge>
        </div>
        {canManage && (
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>Thêm sinh viên</span>
          </Button>
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

            {availableStudents.length === 0 ? (
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


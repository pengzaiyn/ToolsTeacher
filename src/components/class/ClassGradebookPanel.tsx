import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Save,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { computeStudentAttendanceSummaries } from '@/lib/attendance';
import { formatClassActionError } from '@/lib/classStorage';
import {
  buildClassGradebook,
  DEFAULT_GRADEBOOK_SETTINGS,
  type GradebookStudentRow,
} from '@/lib/gradebook';
import { exportGradebookToExcel } from '@/lib/gradebookExcel';
import { supabase } from '@/lib/supabase';
import type {
  Assignment,
  AttendanceRecord,
  AttendanceSession,
  ClassGradebookSettings,
  CollegeClass,
  Enrollment,
  Submission,
} from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

interface ClassGradebookPanelProps {
  classItem: CollegeClass;
  canManage: boolean;
}

export function ClassGradebookPanel({ classItem, canManage }: ClassGradebookPanelProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [attendanceWeight, setAttendanceWeight] = useState<number>(
    DEFAULT_GRADEBOOK_SETTINGS.attendance_weight
  );
  const [absenceWarningPct, setAbsenceWarningPct] = useState<number>(
    DEFAULT_GRADEBOOK_SETTINGS.absence_warning_pct
  );
  const [lateWeight, setLateWeight] = useState<number>(DEFAULT_GRADEBOOK_SETTINGS.late_weight);
  const [excusedWeight, setExcusedWeight] = useState<number>(
    DEFAULT_GRADEBOOK_SETTINGS.excused_weight
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'warning' | 'fail'>('all');
  const [pageSize, setPageSize] = useState<10 | 25 | 0>(10);
  const [page, setPage] = useState(1);
  const [listCollapsed, setListCollapsed] = useState(false);

  const assignmentWeight = Math.max(0, 100 - attendanceWeight);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
      const [enrRes, assignRes, sesRes, cfgRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select(
            '*, student:profiles!enrollments_student_id_fkey(id, full_name, email, student_code, class_name, is_active)'
          )
          .eq('class_id', classItem.id)
          .returns<Enrollment[]>(),
        supabase
          .from('assignments')
          .select('*')
          .eq('class_id', classItem.id)
          .order('created_at', { ascending: true })
          .returns<Assignment[]>(),
        supabase
          .from('attendance_sessions')
          .select('*')
          .eq('class_id', classItem.id)
          .order('session_date', { ascending: true })
          .returns<AttendanceSession[]>(),
        supabase
          .from('class_gradebook_settings')
          .select('*')
          .eq('class_id', classItem.id)
          .maybeSingle<ClassGradebookSettings>(),
      ]);

      if (enrRes.error) throw new Error(enrRes.error.message);
      if (assignRes.error) throw new Error(assignRes.error.message);
      if (sesRes.error) throw new Error(sesRes.error.message);
      if (cfgRes.error) throw new Error(cfgRes.error.message);

      const assignList = assignRes.data ?? [];
      const sesList = sesRes.data ?? [];

      const [subRes, recRes] = await Promise.all([
        assignList.length > 0
          ? supabase
              .from('submissions')
              .select('*, grade:grades(*)')
              .in(
                'assignment_id',
                assignList.map((a) => a.id)
              )
              .returns<Submission[]>()
          : Promise.resolve({ data: [] as Submission[], error: null }),
        sesList.length > 0
          ? supabase
              .from('attendance_records')
              .select('*')
              .in(
                'session_id',
                sesList.map((s) => s.id)
              )
              .returns<AttendanceRecord[]>()
          : Promise.resolve({ data: [] as AttendanceRecord[], error: null }),
      ]);

      if (subRes.error) throw new Error(subRes.error.message);
      if (recRes.error) throw new Error(recRes.error.message);

      setEnrollments(enrRes.data ?? []);
      setAssignments(assignList);
      setSubmissions(subRes.data ?? []);
      setSessions(sesList);
      setRecords(recRes.data ?? []);

      if (cfgRes.data) {
        setAttendanceWeight(Number(cfgRes.data.attendance_weight));
        setAbsenceWarningPct(Number(cfgRes.data.absence_warning_pct));
        setLateWeight(Number(cfgRes.data.late_weight));
        setExcusedWeight(Number(cfgRes.data.excused_weight));
      } else {
        setAttendanceWeight(DEFAULT_GRADEBOOK_SETTINGS.attendance_weight);
        setAbsenceWarningPct(DEFAULT_GRADEBOOK_SETTINGS.absence_warning_pct);
        setLateWeight(DEFAULT_GRADEBOOK_SETTINGS.late_weight);
        setExcusedWeight(DEFAULT_GRADEBOOK_SETTINGS.excused_weight);
      }
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : 'Không tải được sổ điểm tổng hợp');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [classItem.id, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeRefresh({
    channelName: `class-gradebook-${classItem.id}`,
    tables: [
      { table: 'attendance_sessions', filter: `class_id=eq.${classItem.id}` },
      { table: 'attendance_records' },
      { table: 'assignments', filter: `class_id=eq.${classItem.id}` },
      { table: 'submissions' },
      { table: 'grades' },
      { table: 'enrollments', filter: `class_id=eq.${classItem.id}` },
      { table: 'class_gradebook_settings', filter: `class_id=eq.${classItem.id}` },
    ],
    enabled: !showConfig,
    onRefresh: () => loadData(true),
  });

  const activeSettings = useMemo(
    () => ({
      attendance_weight: attendanceWeight,
      assignment_weight: assignmentWeight,
      absence_warning_pct: absenceWarningPct,
      late_weight: lateWeight,
      excused_weight: excusedWeight,
    }),
    [attendanceWeight, assignmentWeight, absenceWarningPct, lateWeight, excusedWeight]
  );

  const attendanceSummaries = useMemo(
    () =>
      computeStudentAttendanceSummaries(enrollments, sessions, records, activeSettings),
    [enrollments, sessions, records, activeSettings]
  );

  const gradebookRows = useMemo(
    () =>
      buildClassGradebook(
        enrollments,
        assignments,
        submissions,
        attendanceSummaries,
        activeSettings
      ),
    [enrollments, assignments, submissions, attendanceSummaries, activeSettings]
  );

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return gradebookRows.filter((row) => {
      if (filterMode === 'warning' && !row.isAttendanceWarning) return false;
      if (filterMode === 'fail' && row.classification !== 'Không đạt') return false;
      if (!q) return true;
      return (
        row.fullName.toLowerCase().includes(q) ||
        (row.studentCode ?? '').toLowerCase().includes(q) ||
        (row.homeroomClass ?? '').toLowerCase().includes(q) ||
        row.classification.toLowerCase().includes(q)
      );
    });
  }, [gradebookRows, searchTerm, filterMode]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterMode, pageSize, classItem.id]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows;
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safePage]);

  const stats = useMemo(() => {
    const warningCount = gradebookRows.filter((r) => r.isAttendanceWarning).length;
    const failCount = gradebookRows.filter((r) => r.classification === 'Không đạt').length;
    const validFinals = gradebookRows.filter((r) => r.finalScore10 !== null);
    const avgFinal =
      validFinals.length > 0
        ? Math.round(
            (validFinals.reduce((sum, r) => sum + (r.finalScore10 ?? 0), 0) /
              validFinals.length) *
              10
          ) / 10
        : null;
    const passCount = validFinals.filter((r) => (r.finalScore10 ?? 0) >= 5.0).length;
    return {
      warningCount,
      failCount,
      avgFinal,
      gradedCount: validFinals.length,
      passCount,
    };
  }, [gradebookRows]);

  async function handleSaveSettings(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !user) return;

    if (attendanceWeight < 0 || attendanceWeight > 100) {
      toast.error('Trọng số chuyên cần phải nằm trong khoảng 0 - 100%');
      return;
    }
    if (absenceWarningPct <= 0 || absenceWarningPct > 100) {
      toast.error('Ngưỡng cảnh báo vắng phải lớn hơn 0% và tối đa 100%');
      return;
    }

    setSavingSettings(true);
    try {
      const { error } = await supabase.from('class_gradebook_settings').upsert(
        {
          class_id: classItem.id,
          attendance_weight: attendanceWeight,
          assignment_weight: assignmentWeight,
          absence_warning_pct: absenceWarningPct,
          late_weight: lateWeight,
          excused_weight: excusedWeight,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'class_id' }
      );
      if (error) throw new Error(error.message);

      toast.success('Đã lưu cấu hình trọng số sổ điểm');
      setShowConfig(false);
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không lưu được cấu hình sổ điểm'));
    } finally {
      setSavingSettings(false);
    }
  }

  function handleExportExcel() {
    if (gradebookRows.length === 0) {
      toast.info('Chưa có sinh viên trong lớp để xuất sổ điểm');
      return;
    }
    exportGradebookToExcel({
      className: classItem.name,
      subject: classItem.subject,
      teacherName: classItem.teacher?.full_name ?? null,
      assignments,
      rows: gradebookRows,
      settings: activeSettings,
    });
    toast.success('Đã xuất file Sổ điểm tổng hợp Excel');
  }

  if (loading) {
    return <LoadingState message="Đang tổng hợp sổ điểm..." />;
  }

  const columns: TableColumn<GradebookStudentRow>[] = [
    {
      key: 'stt',
      header: 'STT',
      className: 'w-14',
      render: (_row, idx) => <span className="font-semibold text-ink-muted">{idx + 1}</span>,
    },
    {
      key: 'student',
      header: 'Sinh viên',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink-primary">{row.fullName}</span>
          {row.studentCode && (
            <span className="text-xs text-ink-muted">{row.studentCode}</span>
          )}
        </div>
      ),
    },
    {
      key: 'attendance',
      header: `Chuyên cần (${attendanceWeight}%)`,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-bold text-brand-navy">
            {row.attendanceScore10 !== null ? row.attendanceScore10 : '—'}
          </span>
          {row.markedSessions > 0 && (
            <span
              className={`text-xs ${
                row.isAttendanceWarning
                  ? 'font-semibold text-status-dangerText'
                  : 'text-ink-muted'
              }`}
            >
              Vắng {row.absentCount}/{row.markedSessions} ({row.absentPct}%)
            </span>
          )}
        </div>
      ),
    },
    ...assignments.map((assignment) => ({
      key: `assign_${assignment.id}`,
      header: assignment.title,
      render: (row: GradebookStudentRow) => {
        const cell = row.assignmentCells[assignment.id];
        if (!cell) return <span className="text-ink-muted">—</span>;
        if (cell.rawScore !== null) {
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-ink-primary">
                {cell.rawScore}/{cell.maxScore}
              </span>
              <span className="text-xs text-ink-muted">Quy 10: {cell.score10}</span>
            </div>
          );
        }
        return (
          <span className="text-xs text-ink-muted">
            {cell.submitted ? 'Chờ chấm' : 'Chưa nộp'}
          </span>
        );
      },
    })),
    {
      key: 'assignAvg',
      header: `TB Bài tập (${assignmentWeight}%)`,
      render: (row) => (
        <span className="font-semibold text-ink-primary">
          {row.assignmentAverage10 !== null ? row.assignmentAverage10 : '—'}
        </span>
      ),
    },
    {
      key: 'finalScore',
      header: 'Tổng kết (10)',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-base font-bold text-brand-navy">
            {row.finalScore10 !== null ? row.finalScore10 : '—'}
          </span>
          {row.isProvisional && (
            <span className="text-xs text-ink-muted">Tạm tính</span>
          )}
        </div>
      ),
    },
    {
      key: 'classification',
      header: 'Xếp loại',
      render: (row) => <Badge tone={row.classificationTone}>{row.classification}</Badge>,
    },
    {
      key: 'warning',
      header: 'Chuyên cần',
      render: (row) =>
        row.isAttendanceWarning ? (
          <Badge tone="danger">Vắng quá {absenceWarningPct}%</Badge>
        ) : row.markedSessions > 0 ? (
          <Badge tone="success">Đủ điều kiện</Badge>
        ) : (
          <Badge tone="neutral">Chưa điểm danh</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Sĩ số / Bài tập / Buổi học
          </p>
          <p className="mt-1 text-xl font-bold text-brand-navy">
            {enrollments.length} SV • {assignments.length} BT • {sessions.length} buổi
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Trọng số hiện tại
          </p>
          <p className="mt-1 text-xl font-bold text-ink-primary">
            CC {attendanceWeight}% • BT {assignmentWeight}%
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Điểm TB lớp / Tỷ lệ đạt
          </p>
          <p className="mt-1 text-xl font-bold text-brand-navy">
            {stats.avgFinal !== null ? `${stats.avgFinal} đ` : '—'}
            {stats.gradedCount > 0
              ? ` (${stats.passCount}/${stats.gradedCount} đạt)`
              : ''}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Cảnh báo vắng (&gt; {absenceWarningPct}%)
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              stats.warningCount > 0 ? 'text-brand-red' : 'text-status-successText'
            }`}
          >
            {stats.warningCount} sinh viên
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên, mã sinh viên, lớp hoặc xếp loại..."
              className="h-10 w-full rounded-xl border border-line-strong bg-surface-page pl-10 pr-9 text-sm text-ink-primary placeholder:text-ink-muted transition-colors focus:border-brand-navy focus:bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-navy/15"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowConfig((prev) => !prev)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span>Cấu hình trọng số</span>
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleExportExcel}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Xuất sổ điểm Excel</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'all', label: `Tất cả (${gradebookRows.length})` },
                { key: 'warning', label: `Cảnh báo vắng (${stats.warningCount})` },
                { key: 'fail', label: `Không đạt (${stats.failCount})` },
              ] as const
            ).map((chip) => {
              const active = filterMode === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilterMode(chip.key)}
                  className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-brand-navy bg-brand-navy text-white'
                      : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>
              Khớp <strong className="text-ink-primary">{filteredRows.length}</strong> /{' '}
              {gradebookRows.length} SV
            </span>
            <button
              type="button"
              onClick={() => setListCollapsed((prev) => !prev)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface-page px-2.5 text-xs font-semibold text-brand-navy hover:bg-surface-subtle"
            >
              {listCollapsed ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mở rộng danh sách</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Thu gọn danh sách</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showConfig && canManage && (
        <form
          onSubmit={handleSaveSettings}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-card p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-brand-navy">
              Cấu hình trọng số & ngưỡng chuyên cần của lớp
            </h3>
            <Badge tone="navy">Tổng trọng số = 100%</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Input
              label="Trọng số Chuyên cần (%)"
              type="number"
              min={0}
              max={100}
              step={5}
              value={attendanceWeight}
              onChange={(e) =>
                setAttendanceWeight(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
              }
            />
            <Input
              label="Trọng số Bài tập (%)"
              type="number"
              value={assignmentWeight}
              disabled
            />
            <Input
              label="Ngưỡng cảnh báo vắng (%)"
              type="number"
              min={1}
              max={100}
              value={absenceWarningPct === 0 ? '' : absenceWarningPct}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setAbsenceWarningPct(0);
                  return;
                }
                setAbsenceWarningPct(Math.max(0, Math.min(100, Number(raw))));
              }}
              onBlur={() => {
                if (absenceWarningPct < 1) setAbsenceWarningPct(20);
              }}
            />
            <Select
              label="Hệ số Đi muộn"
              value={String(lateWeight)}
              onChange={(e) => setLateWeight(Number(e.target.value))}
              options={[
                { value: '1', label: '100% (1.0)' },
                { value: '0.5', label: '50% (0.5)' },
                { value: '0', label: '0% (0.0)' },
              ]}
            />
            <Select
              label="Hệ số Có phép"
              value={String(excusedWeight)}
              onChange={(e) => setExcusedWeight(Number(e.target.value))}
              options={[
                { value: '1', label: '100% (1.0)' },
                { value: '0.5', label: '50% (0.5)' },
                { value: '0', label: '0% (0.0)' },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
            <p className="text-xs text-ink-muted">
              Thang xếp loại: &ge; 9.0 Xuất sắc • 8.0–8.9 Giỏi • 7.0–7.9 Khá • 5.0–6.9 Trung bình •
              &lt; 5.0 Không đạt.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowConfig(false)}>
                Đóng
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={savingSettings}>
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>Lưu cấu hình</span>
              </Button>
            </div>
          </div>
        </form>
      )}

      {stats.warningCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-status-dangerBorder bg-status-dangerBg px-4 py-3 text-sm font-semibold text-status-dangerText">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Có {stats.warningCount} sinh viên vắng quá {absenceWarningPct}% tổng số buổi đã điểm danh.
          </span>
        </div>
      )}

      {enrollments.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Chưa có dữ liệu sổ điểm"
          description="Lớp học này chưa có sinh viên ghi danh."
        />
      ) : listCollapsed ? (
        <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-card px-4 py-3 text-sm">
          <span className="text-ink-secondary">
            Danh sách điểm đang được thu gọn ({filteredRows.length} sinh viên phù hợp).
          </span>
          <Button variant="secondary" size="sm" onClick={() => setListCollapsed(false)}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
            <span>Hiện danh sách</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="max-h-[480px] overflow-y-auto rounded-2xl border border-line">
            <Table
              columns={columns}
              data={paginatedRows}
              rowKey={(r) => r.studentId}
              caption="Sổ điểm tổng hợp lớp học"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-card px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2 text-ink-secondary">
              <span>Hiển thị:</span>
              {([10, 25, 0] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={`rounded-lg border px-2.5 py-1 font-semibold transition-colors ${
                    pageSize === size
                      ? 'border-brand-navy bg-brand-navy text-white'
                      : 'border-line bg-surface-page text-ink-secondary hover:bg-surface-subtle'
                  }`}
                >
                  {size === 0 ? 'Tất cả' : `${size} dòng`}
                </button>
              ))}
            </div>

            {pageSize !== 0 && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Trước</span>
                </Button>
                <span className="font-semibold text-ink-primary">
                  Trang {safePage} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <span>Sau</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


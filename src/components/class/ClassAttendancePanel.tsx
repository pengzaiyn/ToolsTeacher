import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCheck,
  Download,
  Plus,
  QrCode,
  Save,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import {
  ATTENDANCE_STATUS_META,
  ATTENDANCE_STATUS_ORDER,
  computeStudentAttendanceSummaries,
  getTimetableSuggestionsForDate,
  type StudentAttendanceSummary,
} from '@/lib/attendance';
import { exportAttendanceToExcel } from '@/lib/attendanceExcel';
import { classKey } from '@/lib/classKey';
import { formatClassActionError } from '@/lib/classStorage';
import { DEFAULT_GRADEBOOK_SETTINGS } from '@/lib/gradebook';
import { isDroppedOutStudent } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { formatDateVi, toIsoDate } from '@/lib/week';
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  ClassGradebookSettings,
  CollegeClass,
  Enrollment,
  TimetableEntry,
} from '@/types/database';
import { AttendanceQrHostModal } from '@/components/class/AttendanceQrHostModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

interface ClassAttendancePanelProps {
  classItem: CollegeClass;
  canManage: boolean;
}

interface DraftMark {
  status: AttendanceStatus;
  note: string;
}

export function ClassAttendancePanel({ classItem, canManage }: ClassAttendancePanelProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [warningThresholdPct, setWarningThresholdPct] = useState<number>(
    DEFAULT_GRADEBOOK_SETTINGS.absence_warning_pct
  );
  const [lateWeight, setLateWeight] = useState<number>(DEFAULT_GRADEBOOK_SETTINGS.late_weight);
  const [excusedWeight, setExcusedWeight] = useState<number>(
    DEFAULT_GRADEBOOK_SETTINGS.excused_weight
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [draftMarks, setDraftMarks] = useState<Record<string, DraftMark>>({});
  const [dirty, setDirty] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'session' | 'summary'>('session');
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'eligible' | 'banned'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => toIsoDate(new Date()));
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionSubject, setSessionSubject] = useState(classItem.subject ?? '');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [sessionRoom, setSessionRoom] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AttendanceSession | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);
  const [pendingSwitchSessionId, setPendingSwitchSessionId] = useState<string | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const targetClassKey = classItem.class_key || classKey(classItem.name);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
      const [enrRes, sesRes, cfgRes, ttRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select(
            '*, student:profiles!enrollments_student_id_fkey(id, full_name, email, student_code, class_name, is_active, academic_status)'
          )
          .eq('class_id', classItem.id)
          .returns<Enrollment[]>(),
        supabase
          .from('attendance_sessions')
          .select('*')
          .eq('class_id', classItem.id)
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false })
          .returns<AttendanceSession[]>(),
        supabase
          .from('class_gradebook_settings')
          .select('*')
          .eq('class_id', classItem.id)
          .maybeSingle<ClassGradebookSettings>(),
        supabase
          .from('timetable_entries')
          .select('*')
          .eq('class_key', targetClassKey)
          .returns<TimetableEntry[]>(),
      ]);

      if (enrRes.error) throw new Error(enrRes.error.message);
      if (sesRes.error) throw new Error(sesRes.error.message);
      if (cfgRes.error) throw new Error(cfgRes.error.message);

      const sesList = sesRes.data ?? [];
      let recList: AttendanceRecord[] = [];
      if (sesList.length > 0) {
        const recRes = await supabase
          .from('attendance_records')
          .select('*')
          .in(
            'session_id',
            sesList.map((s) => s.id)
          )
          .returns<AttendanceRecord[]>();
        if (recRes.error) throw new Error(recRes.error.message);
        recList = recRes.data ?? [];
      }

      setEnrollments((enrRes.data ?? []).filter((row) => !isDroppedOutStudent(row.student)));
      setSessions(sesList);
      setRecords(recList);
      setTimetableEntries(ttRes.data ?? []);

      if (cfgRes.data) {
        setWarningThresholdPct(Number(cfgRes.data.absence_warning_pct));
        setLateWeight(Number(cfgRes.data.late_weight));
        setExcusedWeight(Number(cfgRes.data.excused_weight));
      } else {
        setWarningThresholdPct(DEFAULT_GRADEBOOK_SETTINGS.absence_warning_pct);
        setLateWeight(DEFAULT_GRADEBOOK_SETTINGS.late_weight);
        setExcusedWeight(DEFAULT_GRADEBOOK_SETTINGS.excused_weight);
      }

      setSelectedSessionId((prev) => {
        if (prev && sesList.some((s) => s.id === prev)) return prev;
        return sesList[0]?.id ?? '';
      });
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : 'Không tải được dữ liệu điểm danh');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [classItem.id, targetClassKey, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeRefresh({
    channelName: `class-attendance-${classItem.id}`,
    tables: [
      { table: 'attendance_sessions', filter: `class_id=eq.${classItem.id}` },
      { table: 'attendance_records' },
      { table: 'enrollments', filter: `class_id=eq.${classItem.id}` },
      { table: 'class_gradebook_settings', filter: `class_id=eq.${classItem.id}` },
    ],
    enabled: !dirty,
    onRefresh: () => loadData(true),
  });

  const sortedEnrollments = useMemo(
    () =>
      [...enrollments].sort((a, b) =>
        (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? '', 'vi')
      ),
    [enrollments]
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  useEffect(() => {
    if (!selectedSessionId) {
      setDraftMarks({});
      setDirty(false);
      return;
    }

    const sessionRecords = new Map<string, AttendanceRecord>();
    records.forEach((rec) => {
      if (rec.session_id === selectedSessionId) {
        sessionRecords.set(rec.student_id, rec);
      }
    });

    const nextDraft: Record<string, DraftMark> = {};
    sortedEnrollments.forEach((enr) => {
      const existing = sessionRecords.get(enr.student_id);
      nextDraft[enr.student_id] = {
        status: existing?.status ?? 'present',
        note: existing?.note ?? '',
      };
    });
    setDraftMarks(nextDraft);
    setDirty(sortedEnrollments.length > 0 && sessionRecords.size < sortedEnrollments.length);
  }, [selectedSessionId, records, sortedEnrollments]);

  const summaries = useMemo(
    () =>
      computeStudentAttendanceSummaries(enrollments, sessions, records, {
        absence_warning_pct: warningThresholdPct,
        late_weight: lateWeight,
        excused_weight: excusedWeight,
      }),
    [enrollments, sessions, records, warningThresholdPct, lateWeight, excusedWeight]
  );

  const summaryByStudentId = useMemo(() => {
    const map = new Map<string, StudentAttendanceSummary>();
    summaries.forEach((item) => map.set(item.studentId, item));
    return map;
  }, [summaries]);

  const warningCount = useMemo(
    () => summaries.filter((item) => item.isWarning).length,
    [summaries]
  );

  const timetableSuggestions = useMemo(
    () => getTimetableSuggestionsForDate(timetableEntries, sessionDate),
    [timetableEntries, sessionDate]
  );

  const currentSessionCounts = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
    };
    sortedEnrollments.forEach((enr) => {
      const st = draftMarks[enr.student_id]?.status ?? 'present';
      counts[st] += 1;
    });
    return counts;
  }, [sortedEnrollments, draftMarks]);

  const filteredEnrollments = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sortedEnrollments;
    return sortedEnrollments.filter((enr) => {
      const name = (enr.student?.full_name ?? '').toLowerCase();
      const code = (enr.student?.student_code ?? '').toLowerCase();
      const homeroom = (enr.student?.class_name ?? '').toLowerCase();
      return name.includes(q) || code.includes(q) || homeroom.includes(q);
    });
  }, [sortedEnrollments, searchTerm]);

  const filteredSummaries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return summaries.filter((s) => {
      if (eligibilityFilter === 'eligible' && s.isWarning) return false;
      if (eligibilityFilter === 'banned' && !s.isWarning) return false;
      if (!q) return true;
      return (
        s.fullName.toLowerCase().includes(q) ||
        (s.studentCode ?? '').toLowerCase().includes(q) ||
        (s.homeroomClass ?? '').toLowerCase().includes(q)
      );
    });
  }, [summaries, searchTerm, eligibilityFilter]);

  function openCreateModal() {
    const today = toIsoDate(new Date());
    setSessionDate(today);
    setSessionTitle(`Buổi ${sessions.length + 1}`);
    setSessionSubject(classItem.subject ?? '');
    setPeriodStart('');
    setPeriodEnd('');
    setSessionRoom('');
    setSessionNote('');
    setCreateOpen(true);
  }

  function applyTimetableSuggestion(entry: TimetableEntry) {
    setSessionTitle(`Buổi ${sessions.length + 1} - ${entry.subject}`);
    setSessionSubject(entry.subject);
    setPeriodStart(String(entry.period_start));
    setPeriodEnd(String(entry.period_end));
    setSessionRoom(entry.room ?? '');
  }

  async function handleCreateSession(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    const cleanTitle = sessionTitle.trim();
    if (!cleanTitle) {
      toast.error('Vui lòng nhập tên buổi học');
      return;
    }

    const pStart = periodStart.trim() ? Number(periodStart) : null;
    const pEnd = periodEnd.trim() ? Number(periodEnd) : null;
    if ((pStart !== null && (pStart < 1 || pStart > 15)) || (pEnd !== null && (pEnd < 1 || pEnd > 15))) {
      toast.error('Tiết học phải nằm trong khoảng từ 1 đến 15');
      return;
    }
    if (pStart !== null && pEnd !== null && pEnd < pStart) {
      toast.error('Tiết kết thúc phải lớn hơn hoặc bằng tiết bắt đầu');
      return;
    }

    setCreatingSession(true);
    try {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .insert({
          class_id: classItem.id,
          session_date: sessionDate,
          title: cleanTitle,
          subject: sessionSubject.trim() || null,
          period_start: pStart,
          period_end: pEnd,
          room: sessionRoom.trim() || null,
          note: sessionNote.trim() || null,
          created_by: user.id,
        })
        .select('*')
        .single<AttendanceSession>();

      if (error) throw new Error(error.message);

      if (sortedEnrollments.length > 0) {
        const now = new Date().toISOString();
        const defaultRecords = sortedEnrollments.map((enr) => ({
          session_id: data.id,
          student_id: enr.student_id,
          status: 'present' as AttendanceStatus,
          note: null,
          marked_by: user.id,
          updated_at: now,
        }));
        const { error: recErr } = await supabase
          .from('attendance_records')
          .upsert(defaultRecords, { onConflict: 'session_id,student_id' });
        if (recErr) throw new Error(recErr.message);
      }

      toast.success('Đã tạo buổi điểm danh mới');
      setCreateOpen(false);
      setSelectedSessionId(data.id);
      setViewMode('session');
      await loadData();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không tạo được buổi điểm danh'));
    } finally {
      setCreatingSession(false);
    }
  }

  function updateStudentMark(studentId: string, status: AttendanceStatus) {
    setDraftMarks((prev) => ({
      ...prev,
      [studentId]: {
        status,
        note: prev[studentId]?.note ?? '',
      },
    }));
    setDirty(true);
  }

  function updateStudentNote(studentId: string, note: string) {
    setDraftMarks((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status ?? 'present',
        note,
      },
    }));
    setDirty(true);
  }

  function markAllPresent() {
    const next: Record<string, DraftMark> = {};
    sortedEnrollments.forEach((enr) => {
      next[enr.student_id] = {
        status: 'present',
        note: draftMarks[enr.student_id]?.note ?? '',
      };
    });
    setDraftMarks(next);
    setDirty(true);
  }

  async function handleSaveMarks() {
    if (!selectedSession || !user || sortedEnrollments.length === 0) return;

    setSavingMarks(true);
    try {
      const now = new Date().toISOString();
      const payload = sortedEnrollments.map((enr) => {
        const draft = draftMarks[enr.student_id] ?? { status: 'present' as AttendanceStatus, note: '' };
        return {
          session_id: selectedSession.id,
          student_id: enr.student_id,
          status: draft.status,
          note: draft.note.trim() || null,
          marked_by: user.id,
          updated_at: now,
        };
      });

      const { error } = await supabase
        .from('attendance_records')
        .upsert(payload, { onConflict: 'session_id,student_id' });

      if (error) throw new Error(error.message);

      toast.success(`Đã lưu điểm danh cho ${payload.length} sinh viên`);
      setDirty(false);
      await loadData();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không lưu được điểm danh'));
    } finally {
      setSavingMarks(false);
    }
  }

  async function handleDeleteSession() {
    if (!deleteTarget) return;
    setDeletingSession(true);
    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw new Error(error.message);

      toast.success('Đã xóa buổi điểm danh');
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không xóa được buổi điểm danh'));
    } finally {
      setDeletingSession(false);
    }
  }

  function handleExportExcel() {
    if (enrollments.length === 0) {
      toast.info('Lớp chưa có sinh viên để xuất Excel');
      return;
    }
    exportAttendanceToExcel({
      className: classItem.name,
      subject: classItem.subject,
      teacherName: classItem.teacher?.full_name ?? null,
      warningThresholdPct,
      sessions,
      records,
      summaries,
    });
    toast.success('Đã xuất file Excel điểm danh');
  }

  if (loading) {
    return <LoadingState message="Đang tải dữ liệu điểm danh..." />;
  }

  const sessionColumns: TableColumn<Enrollment>[] = [
    {
      key: 'stt',
      header: 'STT',
      className: 'w-14',
      render: (_row, idx) => <span className="font-semibold text-ink-muted">{idx + 1}</span>,
    },
    {
      key: 'student',
      header: 'Sinh viên',
      render: (enr) => {
        const sum = summaryByStudentId.get(enr.student_id);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-primary">
                {enr.student?.full_name ?? 'Sinh viên'}
              </span>
              {sum?.isWarning && (
                <Badge tone="danger">
                  Vắng {sum.absentPct}%
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              {enr.student?.student_code && <span>{enr.student.student_code}</span>}
              {enr.student?.class_name && <span>• {enr.student.class_name}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng thái buổi học',
      render: (enr) => {
        const currentStatus = draftMarks[enr.student_id]?.status ?? 'present';
        return (
          <div className="flex flex-wrap gap-2">
            {ATTENDANCE_STATUS_ORDER.map((statusKey) => {
              const meta = ATTENDANCE_STATUS_META[statusKey];
              const active = currentStatus === statusKey;
              let activeClass = 'bg-brand-navy text-white border-brand-navy';
              if (statusKey === 'present') {
                activeClass =
                  'bg-status-successBg text-status-successText border-status-successBorder';
              } else if (statusKey === 'late') {
                activeClass =
                  'bg-status-warningBg text-status-warningText border-status-warningBorder';
              } else if (statusKey === 'absent') {
                activeClass =
                  'bg-status-dangerBg text-status-dangerText border-status-dangerBorder';
              } else if (statusKey === 'excused') {
                activeClass = 'bg-brand-navySoft text-brand-navy border-brand-navy/30';
              }

              return (
                <button
                  key={statusKey}
                  type="button"
                  disabled={!canManage}
                  onClick={() => updateStudentMark(enr.student_id, statusKey)}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? activeClass
                      : 'border-line bg-surface-card text-ink-secondary hover:bg-surface-subtle'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'note',
      header: 'Ghi chú',
      className: 'min-w-[180px]',
      render: (enr) => (
        <input
          type="text"
          value={draftMarks[enr.student_id]?.note ?? ''}
          disabled={!canManage}
          onChange={(e) => updateStudentNote(enr.student_id, e.target.value)}
          placeholder="Lý do / ghi chú..."
          className="h-8 w-full rounded-lg border border-line bg-surface-card px-2.5 text-xs text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none disabled:opacity-60"
        />
      ),
    },
  ];

  const summaryColumns: TableColumn<StudentAttendanceSummary>[] = [
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
          <span
            className={`font-semibold ${
              row.isWarning ? 'font-bold text-status-dangerText' : 'text-ink-primary'
            }`}
          >
            {row.fullName}
          </span>
          {row.studentCode && (
            <span
              className={`text-xs ${
                row.isWarning ? 'font-medium text-status-dangerText/80' : 'text-ink-muted'
              }`}
            >
              {row.studentCode}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'present',
      header: 'Có mặt',
      render: (row) => <span className="font-semibold text-status-successText">{row.presentCount}</span>,
    },
    {
      key: 'late',
      header: 'Đi muộn',
      render: (row) => <span className="font-semibold text-status-warningText">{row.lateCount}</span>,
    },
    {
      key: 'excused',
      header: 'Có phép',
      render: (row) => <span className="font-semibold text-brand-navy">{row.excusedCount}</span>,
    },
    {
      key: 'absent',
      header: 'Vắng',
      render: (row) => <span className="font-bold text-status-dangerText">{row.absentCount}</span>,
    },
    {
      key: 'absentPct',
      header: 'Tỷ lệ vắng',
      render: (row) => (
        <span className={`font-semibold ${row.isWarning ? 'text-status-dangerText' : 'text-ink-primary'}`}>
          {row.absentPct}%
        </span>
      ),
    },
    {
      key: 'score',
      header: 'Điểm CC (10)',
      render: (row) => (
        <span className="font-bold text-brand-navy">
          {row.attendanceScore10 !== null ? row.attendanceScore10 : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Điều kiện dự thi',
      render: (row) =>
        row.markedSessions === 0 ? (
          <Badge tone="neutral">Chưa có buổi</Badge>
        ) : row.isWarning ? (
          <Badge tone="danger">Cấm thi</Badge>
        ) : (
          <Badge tone="success">Đủ điều kiện thi</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Tổng buổi đã điểm danh
          </p>
          <p className="mt-1 text-2xl font-bold text-brand-navy">{sessions.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Sĩ số ghi danh
          </p>
          <p className="mt-1 text-2xl font-bold text-ink-primary">{enrollments.length}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Cảnh báo vắng (&gt; {warningThresholdPct}%)
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              warningCount > 0 ? 'text-brand-red' : 'text-status-successText'
            }`}
          >
            {warningCount} sinh viên
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={viewMode === 'session' ? 'navy' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('session')}
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>Điểm danh theo buổi</span>
          </Button>
          <Button
            variant={viewMode === 'summary' ? 'navy' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('summary')}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Tổng hợp chuyên cần</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Xuất Excel (Đủ ĐK &amp; Cấm thi)</span>
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Tạo buổi điểm danh</span>
            </Button>
          )}
        </div>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Lớp chưa có sinh viên"
          description="Hãy thêm sinh viên ở tab Thành viên hoặc đồng bộ lớp học để bắt đầu điểm danh."
        />
      ) : viewMode === 'summary' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên hoặc mã sinh viên..."
                  className="h-10 w-full rounded-lg border border-line bg-surface-card pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant={eligibilityFilter === 'all' ? 'navy' : 'secondary'}
                  onClick={() => setEligibilityFilter('all')}
                >
                  <span>Tất cả ({summaries.length})</span>
                </Button>
                <Button
                  size="sm"
                  variant={eligibilityFilter === 'eligible' ? 'navy' : 'secondary'}
                  onClick={() => setEligibilityFilter('eligible')}
                >
                  <span>Đủ điều kiện thi ({summaries.length - warningCount})</span>
                </Button>
                <Button
                  size="sm"
                  variant={eligibilityFilter === 'banned' ? 'primary' : 'secondary'}
                  onClick={() => setEligibilityFilter('banned')}
                >
                  <span>Cấm thi ({warningCount})</span>
                </Button>
              </div>
            </div>
            {warningCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-status-dangerBorder bg-status-dangerBg px-3 py-2 text-xs font-semibold text-status-dangerText">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Có {warningCount} sinh viên vắng vượt ngưỡng {warningThresholdPct}%.</span>
              </div>
            )}
          </div>

          <Table
            columns={summaryColumns}
            data={filteredSummaries}
            rowKey={(r) => r.studentId}
            rowClassName={(r) =>
              r.isWarning
                ? 'bg-status-dangerBg/60 hover:bg-status-dangerBg text-status-dangerText'
                : undefined
            }
            caption="Tổng hợp chuyên cần cả lớp"
          />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Chưa có buổi điểm danh nào"
          description="Nhấn Tạo buổi điểm danh để bắt đầu ghi nhận chuyên cần cho lớp học này."
          action={
            canManage ? (
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Tạo buổi đầu tiên</span>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-card p-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full lg:max-w-md">
              <Select
                label="Chọn buổi điểm danh"
                value={selectedSessionId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  if (nextId === selectedSessionId) return;
                  if (dirty) {
                    setPendingSwitchSessionId(nextId);
                  } else {
                    setSelectedSessionId(nextId);
                  }
                }}
                options={sessions.map((s) => ({
                  value: s.id,
                  label: `${formatDateVi(s.session_date)} — ${s.title}${
                    s.period_start && s.period_end ? ` (Tiết ${s.period_start}-${s.period_end})` : ''
                  }`,
                }))}
              />
            </div>

            {selectedSession && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedSession.subject && <Badge tone="navy">{selectedSession.subject}</Badge>}
                {selectedSession.room && <Badge tone="neutral">Phòng {selectedSession.room}</Badge>}
                {canManage && (
                  <>
                    <Button
                      variant="navy"
                      size="sm"
                      onClick={() => setQrModalOpen(true)}
                    >
                      <QrCode className="h-4 w-4" aria-hidden="true" />
                      <span>Mở QR điểm danh</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDeleteTarget(selectedSession)}
                    >
                      <Trash2 className="h-4 w-4 text-status-dangerText" aria-hidden="true" />
                      <span>Xóa buổi</span>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Có mặt: {currentSessionCounts.present}</Badge>
              <Badge tone="warning">Đi muộn: {currentSessionCounts.late}</Badge>
              <Badge tone="navy">Có phép: {currentSessionCounts.excused}</Badge>
              <Badge tone="danger">Vắng: {currentSessionCounts.absent}</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm sinh viên..."
                  className="h-9 w-full rounded-lg border border-line bg-surface-page pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none"
                />
              </div>

              {canManage && (
                <>
                  <Button variant="secondary" size="sm" onClick={markAllPresent}>
                    <CheckCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Tất cả Có mặt</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={savingMarks}
                    onClick={handleSaveMarks}
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    <span>{dirty ? 'Lưu điểm danh*' : 'Lưu điểm danh'}</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          <Table
            columns={sessionColumns}
            data={filteredEnrollments}
            rowKey={(r) => r.student_id}
            caption="Danh sách điểm danh sinh viên"
          />
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo buổi điểm danh mới"
        size="md"
      >
        <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DatePicker
              label="Ngày học"
              value={sessionDate}
              onChange={setSessionDate}
              required
            />
            <Input
              label="Tên buổi học"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="VD: Buổi 1"
              required
            />
          </div>

          {timetableSuggestions.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-subtle p-3">
              <p className="text-xs font-semibold text-brand-navy">
                Gợi ý từ Thời khóa biểu ngày {formatDateVi(sessionDate)}:
              </p>
              <div className="flex flex-wrap gap-2">
                {timetableSuggestions.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => applyTimetableSuggestion(entry)}
                    className="rounded-lg border border-line bg-surface-card px-3 py-1.5 text-left text-xs font-semibold text-ink-primary transition-colors hover:border-brand-navy hover:text-brand-navy"
                  >
                    {entry.subject} • Tiết {entry.period_start}-{entry.period_end}
                    {entry.room ? ` • P.${entry.room}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Môn học (tùy chọn)"
              value={sessionSubject}
              onChange={(e) => setSessionSubject(e.target.value)}
              placeholder="VD: Lập trình Web"
            />
            <Input
              label="Phòng học (tùy chọn)"
              value={sessionRoom}
              onChange={(e) => setSessionRoom(e.target.value)}
              placeholder="VD: A302"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Từ tiết (1-15)"
              type="number"
              min={1}
              max={15}
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              placeholder="VD: 1"
            />
            <Input
              label="Đến tiết (1-15)"
              type="number"
              min={1}
              max={15}
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              placeholder="VD: 3"
            />
          </div>

          <Input
            label="Ghi chú buổi học (tùy chọn)"
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            placeholder="Nội dung giảng dạy hoặc ghi chú..."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={creatingSession}>
              Tạo buổi học
            </Button>
          </div>
        </form>
      </Modal>

      <AttendanceQrHostModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        className={classItem.name}
        session={selectedSession}
        enrollments={enrollments}
        onUpdated={() => loadData(true)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSession}
        title="Xóa buổi điểm danh"
        message={`Bạn có chắc muốn xóa "${deleteTarget?.title ?? ''}" (${
          deleteTarget ? formatDateVi(deleteTarget.session_date) : ''
        })? Toàn bộ dữ liệu tích chuyên cần của buổi này sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa buổi"
        loading={deletingSession}
      />

      <ConfirmDialog
        open={Boolean(pendingSwitchSessionId)}
        onClose={() => setPendingSwitchSessionId(null)}
        onConfirm={() => {
          if (pendingSwitchSessionId) {
            setSelectedSessionId(pendingSwitchSessionId);
          }
          setPendingSwitchSessionId(null);
        }}
        title="Chưa lưu thay đổi điểm danh"
        message="Bạn có thay đổi trạng thái điểm danh chưa nhấn Lưu. Chuyển sang buổi khác sẽ hủy các thay đổi chưa lưu này. Bạn có muốn chuyển buổi không?"
        confirmLabel="Chuyển buổi"
        confirmVariant="primary"
      />
    </div>
  );
}


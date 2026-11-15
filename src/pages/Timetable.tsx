import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Search,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { isStaff } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import {
  addDays,
  countEntriesInMap,
  formatDateVi,
  getMondayOfWeek,
  getWeekDays,
  getWeekRangeLabel,
  groupEntriesByWeekday,
  toIsoDate,
  weekdayLabel,
} from '@/lib/week';
import type { TimetableClassSummary, TimetableEntry } from '@/types/database';
import { Layout } from '@/components/Layout';
import { TimetableWeekView } from '@/components/TimetableWeekView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

export function Timetable() {
  const { profile } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const requestedClassKey = searchParams.get('class') ?? '';
  const staff = isStaff(profile?.role);

  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [classes, setClasses] = useState<TimetableClassSummary[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState<string>(requestedClassKey);
  const [linkedClassId, setLinkedClassId] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week');

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadClasses = useCallback(
    async (silent = false) => {
      if (!staff) return;
      if (!silent) setLoadingClasses(true);
      try {
        const { data, error } = await supabase.rpc('timetable_classes');
        if (error) throw new Error(error.message);
        const list = ((data as TimetableClassSummary[] | null) ?? []).map((item) => ({
          ...item,
          entries: Number(item.entries),
        }));
        setClasses(list);
        setSelectedClassKey((prev) => {
          if (requestedClassKey && list.some((c) => c.class_key === requestedClassKey)) {
            return requestedClassKey;
          }
          if (prev && list.some((c) => c.class_key === prev)) return prev;
          return list[0]?.class_key ?? '';
        });
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách lớp');
        }
      } finally {
        if (!silent) setLoadingClasses(false);
      }
    },
    [staff, requestedClassKey, toast]
  );

  useEffect(() => {
    if (staff) {
      void loadClasses();
    } else if (profile) {
      setSelectedClassKey(profile.class_key ?? '');
    }
  }, [staff, profile, loadClasses]);

  const loadEntries = useCallback(
    async (silent = false) => {
      if (!profile) return;
      const targetKey = staff ? selectedClassKey : profile.class_key ?? '';
      if (!targetKey) {
        setEntries([]);
        setLinkedClassId(null);
        if (!silent) setLoadingEntries(false);
        return;
      }

      if (!silent) setLoadingEntries(true);
      try {
        const [{ data, error }, linkedRes] = await Promise.all([
          supabase
            .from('timetable_entries')
            .select('*')
            .eq('class_key', targetKey)
            .order('weekday', { ascending: true })
            .order('period_start', { ascending: true })
            .returns<TimetableEntry[]>(),
          supabase.from('classes').select('id').eq('class_key', targetKey).maybeSingle<{ id: string }>(),
        ]);

        if (error) throw new Error(error.message);
        setEntries(data ?? []);
        setLinkedClassId(linkedRes.error ? null : linkedRes.data?.id ?? null);
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được thời khóa biểu');
        }
      } finally {
        if (!silent) setLoadingEntries(false);
      }
    },
    [profile, staff, selectedClassKey, toast]
  );

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useRealtimeRefresh({
    channelName: `timetable-${profile?.id ?? 'anon'}`,
    tables: [{ table: 'timetable_entries' }, { table: 'timetable_uploads' }, { table: 'classes' }],
    enabled: Boolean(profile),
    onRefresh: async () => {
      if (staff) await loadClasses(true);
      await loadEntries(true);
    },
  });

  const weekDays = useMemo(() => getWeekDays(weekMonday), [weekMonday]);
  const todayIso = toIsoDate(new Date());

  const filteredEntries = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        (e.teacher_name ?? '').toLowerCase().includes(q) ||
        (e.room ?? '').toLowerCase().includes(q)
    );
  }, [entries, keyword]);

  const weekActiveEntries = useMemo(
    () => groupEntriesByWeekday(filteredEntries, weekDays),
    [filteredEntries, weekDays]
  );

  const totalWeekSessions = useMemo(
    () => countEntriesInMap(weekActiveEntries),
    [weekActiveEntries]
  );

  const selectedClassName = useMemo(() => {
    if (!staff) return profile?.class_name ?? '';
    return classes.find((c) => c.class_key === selectedClassKey)?.class_name ?? '';
  }, [staff, profile?.class_name, classes, selectedClassKey]);

  async function handleDeleteClassTimetable() {
    if (!selectedClassKey) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('timetable_entries')
        .delete()
        .eq('class_key', selectedClassKey);

      if (error) throw new Error(error.message);
      toast.success(`Đã xóa thời khóa biểu lớp ${selectedClassName}`);
      setConfirmDeleteOpen(false);
      setEntries([]);
      await loadClasses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xóa được thời khóa biểu');
    } finally {
      setDeleting(false);
    }
  }

  const listColumns: TableColumn<TimetableEntry>[] = [
    {
      key: 'weekday',
      header: 'Thứ',
      render: (row) => (
        <span className="whitespace-nowrap font-semibold text-brand-navy">
          {weekdayLabel(row.weekday)}
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Tiết học',
      render: (row) => (
        <Badge tone="navy">
          Tiết {row.period_start}
          {row.period_end > row.period_start ? `–${row.period_end}` : ''}
        </Badge>
      ),
    },
    {
      key: 'subject',
      header: 'Môn học',
      render: (row) => <span className="font-semibold text-ink-primary">{row.subject}</span>,
    },
    {
      key: 'teacher',
      header: 'Giáo viên',
      render: (row) => <span>{row.teacher_name || '—'}</span>,
    },
    {
      key: 'room',
      header: 'Phòng học',
      render: (row) => <span>{row.room || '—'}</span>,
    },
    {
      key: 'range',
      header: 'Thời gian áp dụng',
      render: (row) => (
        <span className="whitespace-nowrap text-xs font-normal text-ink-secondary">
          {row.date_from || row.date_to
            ? `${row.date_from ? formatDateVi(row.date_from) : '...'} – ${
                row.date_to ? formatDateVi(row.date_to) : '...'
              }`
            : 'Mọi tuần'}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Ghi chú',
      render: (row) => <span className="text-xs text-ink-muted">{row.note || '—'}</span>,
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Thời khóa biểu</h1>
            <p className="text-sm font-normal text-ink-secondary">
              {staff
                ? 'Xem lịch học theo tuần của từng lớp hoặc cập nhật từ file Excel'
                : profile?.class_name
                  ? `Lịch học theo tuần của lớp ${profile.class_name}`
                  : 'Lịch học cá nhân theo tuần'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {linkedClassId && (
              <Link to={`/classes/${linkedClassId}`}>
                <Button variant="secondary">
                  <BookOpen className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                  <span>Vào lớp học</span>
                </Button>
              </Link>
            )}
            {staff && (
              <>
                <Link to="/timetable/upload">
                  <Button variant="primary">
                    <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                    <span>Tải Excel lên</span>
                  </Button>
                </Link>
                {selectedClassKey && (
                  <Button variant="secondary" onClick={() => setConfirmDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                    <span>Xóa lịch lớp này</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {staff && (
              <Select
                label="Chọn lớp"
                value={selectedClassKey}
                onChange={(e) => setSelectedClassKey(e.target.value)}
                disabled={loadingClasses || classes.length === 0}
                options={classes.map((c) => ({
                  value: c.class_key,
                  label: `${c.class_name} (${c.entries} buổi)`,
                }))}
                placeholder={classes.length === 0 ? 'Chưa có lớp nào' : undefined}
              />
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="timetable-search" className="text-sm font-semibold text-ink-primary">
                Tìm môn, giáo viên hoặc phòng
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  id="timetable-search"
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Nhập từ khóa lọc..."
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>
            </div>

            <Input
              label="Chọn ngày xem tuần"
              type="date"
              value={toIsoDate(weekMonday)}
              onChange={(e) => {
                if (e.target.value) {
                  setWeekMonday(getMondayOfWeek(new Date(`${e.target.value}T00:00:00`)));
                }
              }}
            />
          </div>

          <div className="flex flex-col justify-between gap-4 border-t border-line pt-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setWeekMonday((d) => addDays(d, -7))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Tuần trước</span>
              </Button>
              <Button
                variant="navy"
                size="sm"
                onClick={() => setWeekMonday(getMondayOfWeek(new Date()))}
              >
                Tuần này
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setWeekMonday((d) => addDays(d, 7))}
              >
                <span>Tuần sau</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="ml-2 text-sm font-semibold text-brand-navy">
                {getWeekRangeLabel(weekMonday)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={viewMode === 'week' ? 'navy' : 'secondary'}
                onClick={() => setViewMode('week')}
              >
                Lưới tuần
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'navy' : 'secondary'}
                onClick={() => setViewMode('list')}
              >
                Danh sách ({filteredEntries.length})
              </Button>
            </div>
          </div>
        </section>

        {!staff && !profile?.class_key ? (
          <EmptyState
            icon={Calendar}
            title="Tài khoản chưa được gán lớp"
            description="Vui lòng liên hệ giáo viên hoặc văn phòng nhà trường để cập nhật tên lớp vào hồ sơ của bạn."
          />
        ) : loadingClasses || loadingEntries ? (
          <LoadingState message="Đang tải thời khóa biểu..." />
        ) : staff && classes.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Chưa có dữ liệu thời khóa biểu"
            description="Hãy tải file Excel thời khóa biểu lên để giáo viên và sinh viên theo dõi."
            action={
              <Link to="/timetable/upload">
                <Button variant="primary">Tải thời khóa biểu Excel</Button>
              </Link>
            }
          />
        ) : viewMode === 'list' ? (
          filteredEntries.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Không có buổi học phù hợp"
              description="Thử thay đổi bộ lọc từ khóa hoặc chọn lớp khác."
            />
          ) : (
            <Table
              columns={listColumns}
              data={filteredEntries}
              rowKey={(row) => row.id}
              caption="Danh sách buổi học"
            />
          )
        ) : totalWeekSessions === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Không có lịch học trong tuần này"
            description={
              entries.length > 0
                ? 'Các buổi học của lớp nằm ngoài khoảng ngày của tuần đang xem, hoặc không khớp từ khóa tìm kiếm.'
                : 'Lớp hiện chưa có lịch học nào được tải lên.'
            }
          />
        ) : (
          <TimetableWeekView
            weekDays={weekDays}
            entriesByWeekday={weekActiveEntries}
            todayIso={todayIso}
            mode="class"
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteClassTimetable}
        loading={deleting}
        confirmLabel="Xóa lịch học"
        title="Xác nhận xóa thời khóa biểu"
        message={`Bạn chắc chắn muốn xóa toàn bộ ${entries.length} buổi học của lớp ${selectedClassName}?`}
      />
    </Layout>
  );
}

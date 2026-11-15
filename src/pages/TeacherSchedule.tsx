import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  MapPin,
  Search,
  Shuffle,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import {
  countTotalPeriods,
  exportScheduleWeekToExcel,
  extractTeacherOptions,
  findMatchingTeacherKey,
} from '@/lib/teacherSchedule';
import {
  addDays,
  countEntriesInMap,
  formatDateVi,
  getJsDayAsSchoolWeekday,
  getMondayOfWeek,
  getWeekDays,
  getWeekRangeLabel,
  groupEntriesByWeekday,
  isEntryActiveOnDate,
  toIsoDate,
  weekdayLabel,
} from '@/lib/week';
import type { CollegeClass, TimetableEntry } from '@/types/database';
import { Layout } from '@/components/Layout';
import { TimetableWeekView } from '@/components/TimetableWeekView';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

export function TeacherSchedule() {
  const { profile } = useAuth();
  const toast = useToast();
  const adminRole = isAdmin(profile?.role);

  const [allEntries, setAllEntries] = useState<TimetableEntry[]>([]);
  const [classes, setClasses] = useState<Pick<CollegeClass, 'id' | 'name' | 'class_key'>[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTeacherKey, setSelectedTeacherKey] = useState<string>('');
  const [teacherInitialized, setTeacherInitialized] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ttData, error: ttErr }, { data: clsData, error: clsErr }] = await Promise.all([
        supabase
          .from('timetable_entries')
          .select('*')
          .order('weekday', { ascending: true })
          .order('period_start', { ascending: true })
          .returns<TimetableEntry[]>(),
        supabase
          .from('classes')
          .select('id, name, class_key')
          .returns<Pick<CollegeClass, 'id' | 'name' | 'class_key'>[]>(),
      ]);

      if (ttErr) throw new Error(ttErr.message);
      if (clsErr) throw new Error(clsErr.message);

      setAllEntries(ttData ?? []);
      setClasses(clsData ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được lịch giảng dạy');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teacherOptions = useMemo(() => extractTeacherOptions(allEntries), [allEntries]);

  const matchedProfileTeacherKey = useMemo(
    () => findMatchingTeacherKey(profile?.full_name, teacherOptions),
    [profile?.full_name, teacherOptions]
  );

  useEffect(() => {
    if (loading || teacherInitialized) return;
    if (adminRole) {
      setSelectedTeacherKey('all');
    } else if (matchedProfileTeacherKey) {
      setSelectedTeacherKey(matchedProfileTeacherKey);
    } else {
      setSelectedTeacherKey('');
    }
    setTeacherInitialized(true);
  }, [loading, teacherInitialized, adminRole, matchedProfileTeacherKey]);

  const classIdByKey = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((cls) => {
      if (cls.class_key) map.set(cls.class_key, cls.id);
    });
    return map;
  }, [classes]);

  const teacherFilteredEntries = useMemo(() => {
    if (!selectedTeacherKey) return [];
    if (selectedTeacherKey === 'all') return allEntries;
    return allEntries.filter((entry) => entry.teacher_key === selectedTeacherKey);
  }, [allEntries, selectedTeacherKey]);

  const filteredEntries = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return teacherFilteredEntries;
    return teacherFilteredEntries.filter(
      (entry) =>
        entry.subject.toLowerCase().includes(q) ||
        entry.class_name.toLowerCase().includes(q) ||
        (entry.room ?? '').toLowerCase().includes(q) ||
        (entry.teacher_name ?? '').toLowerCase().includes(q)
    );
  }, [teacherFilteredEntries, keyword]);

  const weekDays = useMemo(() => getWeekDays(weekMonday), [weekMonday]);
  const todayDate = new Date();
  const todayIso = toIsoDate(todayDate);
  const todayWeekday = getJsDayAsSchoolWeekday(todayDate);

  const todaySessions = useMemo(
    () =>
      filteredEntries
        .filter(
          (entry) => entry.weekday === todayWeekday && isEntryActiveOnDate(entry, todayIso)
        )
        .sort((a, b) => a.period_start - b.period_start),
    [filteredEntries, todayWeekday, todayIso]
  );

  const weekActiveEntries = useMemo(
    () => groupEntriesByWeekday(filteredEntries, weekDays),
    [filteredEntries, weekDays]
  );

  const weekEntriesFlat = useMemo(() => {
    const list: TimetableEntry[] = [];
    weekActiveEntries.forEach((items) => {
      list.push(...items);
    });
    return list;
  }, [weekActiveEntries]);

  const totalWeekSessions = useMemo(
    () => countEntriesInMap(weekActiveEntries),
    [weekActiveEntries]
  );

  const totalWeekPeriods = useMemo(() => countTotalPeriods(weekEntriesFlat), [weekEntriesFlat]);

  const totalWeekClasses = useMemo(() => {
    const keys = new Set<string>();
    weekEntriesFlat.forEach((item) => keys.add(item.class_key));
    return keys.size;
  }, [weekEntriesFlat]);

  const selectedTeacherLabel = useMemo(() => {
    if (selectedTeacherKey === 'all') return 'Tất cả giảng viên';
    return (
      teacherOptions.find((opt) => opt.key === selectedTeacherKey)?.label ??
      profile?.full_name ??
      'Giảng viên'
    );
  }, [selectedTeacherKey, teacherOptions, profile?.full_name]);

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
        <Badge tone="red">
          Tiết {row.period_start}
          {row.period_end > row.period_start ? `–${row.period_end}` : ''}
        </Badge>
      ),
    },
    {
      key: 'class',
      header: 'Lớp',
      render: (row) => <Badge tone="navy">{row.class_name}</Badge>,
    },
    {
      key: 'subject',
      header: 'Môn học',
      render: (row) => <span className="font-semibold text-ink-primary">{row.subject}</span>,
    },
    {
      key: 'room',
      header: 'Phòng học',
      render: (row) => <span>{row.room || '—'}</span>,
    },
    {
      key: 'teacher',
      header: 'Giảng viên',
      render: (row) => <span>{row.teacher_name || '—'}</span>,
    },
    {
      key: 'range',
      header: 'Áp dụng',
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
      key: 'actions',
      header: 'Thao tác',
      render: (row) => {
        const linkedId = classIdByKey.get(row.class_key);
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/teacher/classroom-kit?class=${encodeURIComponent(row.class_key)}`}>
              <Button size="sm" variant="secondary">
                <Shuffle className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                <span>Điều phối</span>
              </Button>
            </Link>
            {linkedId && (
              <Link to={`/classes/${linkedId}`}>
                <Button size="sm" variant="secondary">
                  <BookOpen className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  <span>Vào lớp</span>
                </Button>
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  function handleExportExcel() {
    if (totalWeekSessions === 0) {
      toast.error('Không có buổi dạy nào trong tuần này để xuất');
      return;
    }
    exportScheduleWeekToExcel(
      filteredEntries,
      weekDays,
      getWeekRangeLabel(weekMonday),
      selectedTeacherLabel
    );
    toast.success('Đã tải xuống lịch dạy tuần Excel');
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Lịch dạy cá nhân</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Tổng hợp lịch giảng dạy theo tuần từ thời khóa biểu, kèm lối tắt điều phối lớp học
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to="/teacher/classroom-kit">
              <Button variant="secondary">
                <Shuffle className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                <span>Điều phối lớp học</span>
              </Button>
            </Link>
            <Button
              variant="primary"
              onClick={handleExportExcel}
              disabled={loading || totalWeekSessions === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Xuất lịch tuần Excel</span>
            </Button>
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select
              label="Giảng viên trên thời khóa biểu"
              value={selectedTeacherKey}
              onChange={(e) => setSelectedTeacherKey(e.target.value)}
              disabled={loading || teacherOptions.length === 0}
              placeholder={teacherOptions.length === 0 ? 'Chưa có dữ liệu TKB' : 'Chọn giảng viên...'}
              options={[
                ...(teacherOptions.length > 0
                  ? [{ value: 'all', label: 'Tất cả giảng viên' }]
                  : []),
                ...teacherOptions.map((opt) => ({
                  value: opt.key,
                  label: `${opt.label} (${opt.entryCount} buổi)`,
                })),
              ]}
            />

            <div className="flex flex-col gap-2">
              <label htmlFor="teacher-schedule-search" className="text-sm font-semibold text-ink-primary">
                Tìm lớp, môn học hoặc phòng
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  id="teacher-schedule-search"
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Nhập tên lớp, môn, phòng..."
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

            <div className="flex flex-wrap items-center gap-2">
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

          {!loading && teacherOptions.length > 0 && !adminRole && !matchedProfileTeacherKey && !selectedTeacherKey && (
            <div className="flex flex-col justify-between gap-4 rounded-lg border border-status-warningBorder bg-status-warningBg p-4 text-sm text-status-warningText sm:flex-row sm:items-center">
              <span>
                Chưa có dòng thời khóa biểu nào trùng với tên tài khoản{' '}
                <strong>{profile?.full_name}</strong>. Bạn có thể chọn tên giảng viên ở ô phía trên
                hoặc xem toàn bộ lịch để kiểm tra.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelectedTeacherKey('all')}
              >
                Xem tất cả giảng viên
              </Button>
            </div>
          )}
        </section>

        {loading ? (
          <LoadingState message="Đang tải lịch giảng dạy..." />
        ) : allEntries.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Chưa có dữ liệu thời khóa biểu"
            description="Hãy tải file Excel thời khóa biểu lên để xem lịch dạy cá nhân theo tuần."
            action={
              <Link to="/timetable/upload">
                <Button variant="primary">Tải thời khóa biểu Excel</Button>
              </Link>
            }
          />
        ) : !selectedTeacherKey ? (
          <EmptyState
            icon={UserCheck}
            title="Chọn tên giảng viên để xem lịch"
            description="Chọn tên của bạn trong danh sách giảng viên phía trên để lọc lịch dạy theo tuần."
            action={
              <Button variant="navy" onClick={() => setSelectedTeacherKey('all')}>
                Hiển thị tất cả giảng viên
              </Button>
            }
          />
        ) : (
          <>
            {/* Khối tóm tắt hôm nay và thống kê tuần */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-brand-red" aria-hidden="true" />
                    <h2 className="text-base font-bold text-brand-navy">
                      Lịch dạy hôm nay — {weekdayLabel(todayWeekday)} ({formatDateVi(todayDate)})
                    </h2>
                  </div>
                  <Badge tone={todaySessions.length > 0 ? 'red' : 'neutral'}>
                    {todaySessions.length} buổi hôm nay
                  </Badge>
                </div>

                {todaySessions.length === 0 ? (
                  <p className="text-sm font-normal text-ink-secondary">
                    Hôm nay không có tiết dạy nào khớp bộ lọc hiện tại.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {todaySessions.map((item) => {
                      const linkedId = classIdByKey.get(item.class_key);
                      return (
                        <article
                          key={item.id}
                          className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-page p-4"
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge tone="red" className="gap-2">
                                <Clock className="h-4 w-4" aria-hidden="true" />
                                <span>
                                  Tiết {item.period_start}
                                  {item.period_end > item.period_start ? `–${item.period_end}` : ''}
                                </span>
                              </Badge>
                              <Badge tone="navy">{item.class_name}</Badge>
                            </div>
                            <h3 className="text-base font-bold text-ink-primary">{item.subject}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-xs font-normal text-ink-secondary">
                              {item.room && (
                                <span className="inline-flex items-center gap-2 font-semibold text-brand-navy">
                                  <MapPin className="h-4 w-4" aria-hidden="true" />
                                  {item.room}
                                </span>
                              )}
                              {selectedTeacherKey === 'all' && item.teacher_name && (
                                <span>GV: {item.teacher_name}</span>
                              )}
                            </div>
                            {item.note && (
                              <p className="text-xs font-normal text-ink-muted">{item.note}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                            <Link
                              to={`/teacher/classroom-kit?class=${encodeURIComponent(
                                item.class_key
                              )}`}
                            >
                              <Button size="sm" variant="navy">
                                <Shuffle className="h-4 w-4" aria-hidden="true" />
                                <span>Điều phối lớp</span>
                              </Button>
                            </Link>
                            {linkedId && (
                              <Link to={`/classes/${linkedId}`}>
                                <Button size="sm" variant="secondary">
                                  <BookOpen className="h-4 w-4 text-brand-red" aria-hidden="true" />
                                  <span>Vào lớp</span>
                                </Button>
                              </Link>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-6">
                <div>
                  <h2 className="text-base font-bold text-brand-navy">Tổng quan tuần đang xem</h2>
                  <p className="mt-2 text-xs font-normal text-ink-muted">{selectedTeacherLabel}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-1">
                  <div className="rounded-lg bg-brand-redSoft p-4">
                    <p className="text-xs font-normal text-ink-secondary">Số buổi dạy</p>
                    <p className="text-2xl font-bold text-brand-red">{totalWeekSessions}</p>
                  </div>
                  <div className="rounded-lg bg-brand-navySoft p-4">
                    <p className="text-xs font-normal text-ink-secondary">Tổng số tiết</p>
                    <p className="text-2xl font-bold text-brand-navy">{totalWeekPeriods}</p>
                  </div>
                  <div className="rounded-lg bg-surface-page p-4">
                    <p className="text-xs font-normal text-ink-secondary">Số lớp phụ trách</p>
                    <p className="text-2xl font-bold text-ink-primary">{totalWeekClasses}</p>
                  </div>
                </div>
              </div>
            </section>

            {viewMode === 'list' ? (
              filteredEntries.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="Không có buổi dạy phù hợp"
                  description="Thử xóa từ khóa lọc hoặc chọn giảng viên khác."
                />
              ) : (
                <Table
                  columns={listColumns}
                  data={filteredEntries}
                  rowKey={(row) => row.id}
                  caption="Danh sách buổi dạy"
                />
              )
            ) : totalWeekSessions === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Không có lịch dạy trong tuần này"
                description={
                  teacherFilteredEntries.length > 0
                    ? 'Các buổi dạy nằm ngoài khoảng ngày của tuần đang xem, hoặc không khớp từ khóa tìm kiếm.'
                    : 'Giảng viên chưa có buổi dạy nào trong thời khóa biểu.'
                }
              />
            ) : (
              <TimetableWeekView
                weekDays={weekDays}
                entriesByWeekday={weekActiveEntries}
                todayIso={todayIso}
                mode="teacher"
                classIdByKey={classIdByKey}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

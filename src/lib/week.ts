import type { TimetableEntry } from '@/types/database';

export interface WeekDayInfo {
  weekday: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  label: string;
  shortLabel: string;
  isoDate: string;
  dateLabel: string;
}

const WEEKDAY_NAMES: Record<number, { label: string; shortLabel: string }> = {
  2: { label: 'Thứ 2', shortLabel: 'T2' },
  3: { label: 'Thứ 3', shortLabel: 'T3' },
  4: { label: 'Thứ 4', shortLabel: 'T4' },
  5: { label: 'Thứ 5', shortLabel: 'T5' },
  6: { label: 'Thứ 6', shortLabel: 'T6' },
  7: { label: 'Thứ 7', shortLabel: 'T7' },
  8: { label: 'Chủ nhật', shortLabel: 'CN' },
};

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_NAMES[weekday]?.label ?? `Thứ ${weekday}`;
}

export function getMondayOfWeek(source: Date): Date {
  const date = new Date(source.getFullYear(), source.getMonth(), source.getDate());
  const day = date.getDay(); // 0 = CN, 1 = T2 ... 6 = T7
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function addDays(source: Date, days: number): Date {
  const date = new Date(source.getFullYear(), source.getMonth(), source.getDate());
  date.setDate(date.getDate() + days);
  return date;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateVi(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) {
    return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(
      2,
      '0'
    )}/${value.getFullYear()}`;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return value;
}

export function getWeekDays(monday: Date): WeekDayInfo[] {
  const list: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i += 1) {
    const dayDate = addDays(monday, i);
    const weekday = (i + 2) as WeekDayInfo['weekday'];
    const meta = WEEKDAY_NAMES[weekday];
    list.push({
      weekday,
      label: meta.label,
      shortLabel: meta.shortLabel,
      isoDate: toIsoDate(dayDate),
      dateLabel: `${String(dayDate.getDate()).padStart(2, '0')}/${String(
        dayDate.getMonth() + 1
      ).padStart(2, '0')}`,
    });
  }
  return list;
}

export function getWeekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  return `${formatDateVi(monday)} – ${formatDateVi(sunday)}`;
}

export function isEntryActiveOnDate(
  entry: Pick<TimetableEntry, 'date_from' | 'date_to'>,
  isoDate: string
): boolean {
  if (entry.date_from && isoDate < entry.date_from) return false;
  if (entry.date_to && isoDate > entry.date_to) return false;
  return true;
}

export function getJsDayAsSchoolWeekday(date: Date): number {
  const day = date.getDay(); // 0 = CN, 1 = T2 ... 6 = T7
  return day === 0 ? 8 : day + 1;
}

export function groupEntriesByWeekday(
  entries: readonly TimetableEntry[],
  weekDays: readonly WeekDayInfo[]
): Map<number, TimetableEntry[]> {
  const map = new Map<number, TimetableEntry[]>();
  weekDays.forEach((day) => {
    const dayEntries = entries.filter(
      (e) => !e.is_internship && e.weekday === day.weekday && isEntryActiveOnDate(e, day.isoDate)
    );
    map.set(day.weekday, dayEntries);
  });
  return map;
}

export function getActiveInternshipsForWeek(
  entries: readonly TimetableEntry[],
  weekDays: readonly WeekDayInfo[]
): TimetableEntry[] {
  if (weekDays.length === 0) return [];
  const weekStart = weekDays[0].isoDate;
  const weekEnd = weekDays[weekDays.length - 1].isoDate;
  return entries.filter((e) => {
    if (!e.is_internship) return false;
    if (e.date_from && weekEnd < e.date_from) return false;
    if (e.date_to && weekStart > e.date_to) return false;
    return true;
  });
}

export interface WeekExamNotice {
  key: string;
  subject: string;
  examDate: string;
  className: string;
  teacherName: string | null;
  room: string | null;
  semester: string | null;
}

export function getExamsInWeek(
  entries: readonly TimetableEntry[],
  weekDays: readonly WeekDayInfo[]
): WeekExamNotice[] {
  if (weekDays.length === 0) return [];
  const weekStart = weekDays[0].isoDate;
  const weekEnd = weekDays[weekDays.length - 1].isoDate;
  const seen = new Set<string>();
  const list: WeekExamNotice[] = [];

  for (const e of entries) {
    if (!e.exam_date) continue;
    if (e.exam_date < weekStart || e.exam_date > weekEnd) continue;
    const dedupeKey = `${e.class_key}|${e.semester ?? ''}|${e.subject}|${e.exam_date}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    list.push({
      key: dedupeKey,
      subject: e.subject,
      examDate: e.exam_date,
      className: e.class_name,
      teacherName: e.teacher_name,
      room: e.room,
      semester: e.semester ?? null,
    });
  }

  return list.sort((a, b) => a.examDate.localeCompare(b.examDate));
}

export interface TimetableSemesterSummary {
  key: string;
  label: string;
  order: number;
  academicYear: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  count: number;
  isCurrent: boolean;
}

export function summarizeSemesters(
  entries: readonly TimetableEntry[],
  todayIso: string
): TimetableSemesterSummary[] {
  const map = new Map<string, TimetableSemesterSummary>();

  for (const e of entries) {
    const label = e.semester?.trim();
    if (!label) continue;
    const order = e.semester_order ?? 99;
    const existing = map.get(label);
    if (!existing) {
      map.set(label, {
        key: label,
        label,
        order,
        academicYear: e.academic_year ?? null,
        dateFrom: e.date_from ?? null,
        dateTo: e.date_to ?? null,
        count: 1,
        isCurrent: false,
      });
    } else {
      existing.count += 1;
      if (order < existing.order) existing.order = order;
      if (!existing.academicYear && e.academic_year) existing.academicYear = e.academic_year;
      if (e.date_from && (!existing.dateFrom || e.date_from < existing.dateFrom)) {
        existing.dateFrom = e.date_from;
      }
      if (e.date_to && (!existing.dateTo || e.date_to > existing.dateTo)) {
        existing.dateTo = e.date_to;
      }
    }
  }

  const list = Array.from(map.values()).sort(
    (a, b) => a.order - b.order || a.label.localeCompare(b.label)
  );

  for (const sem of list) {
    if (sem.dateFrom && sem.dateTo && todayIso >= sem.dateFrom && todayIso <= sem.dateTo) {
      sem.isCurrent = true;
    }
  }

  return list;
}

export function pickDefaultSemesterKey(
  semesters: readonly TimetableSemesterSummary[],
  todayIso: string
): string {
  if (semesters.length === 0) return 'all';
  const active = semesters.find((s) => s.isCurrent);
  if (active) return active.key;
  // Nếu đang ở giữa 2 kỳ hoặc trước kỳ 1, chọn kỳ sắp diễn ra gần nhất
  const upcoming = semesters.find((s) => s.dateFrom && s.dateFrom >= todayIso);
  if (upcoming) return upcoming.key;
  // Nếu tất cả đã kết thúc, chọn kỳ cuối cùng
  return semesters[semesters.length - 1].key;
}

export function countEntriesInMap(map: ReadonlyMap<number, readonly TimetableEntry[]>): number {
  let count = 0;
  map.forEach((list) => {
    count += list.length;
  });
  return count;
}

export type DaySession = 'morning' | 'afternoon' | 'evening';

export function getPeriodSession(periodStart: number): DaySession {
  if (periodStart <= 6) return 'morning';
  if (periodStart <= 12) return 'afternoon';
  return 'evening';
}

export function getEntrySession(
  entry: Pick<TimetableEntry, 'period_start' | 'time_range'>
): DaySession {
  const timeRange = entry.time_range?.trim();
  if (timeRange) {
    const match = /^(\d{1,2})\s*[:h.]\s*(\d{2})/i.exec(timeRange);
    if (match) {
      const hour = Number(match[1]);
      if (hour < 12) return 'morning';
      if (hour < 18) return 'afternoon';
      return 'evening';
    }
  }
  return getPeriodSession(entry.period_start);
}

export const SESSION_LABELS: Record<DaySession, { title: string; range: string }> = {
  morning: { title: 'Buổi sáng', range: '7:30 – 12:15' },
  afternoon: { title: 'Buổi chiều', range: '13:00 – 17:30' },
  evening: { title: 'Buổi tối', range: '18:00 – 21:30' },
};

export type EntryTimeStatus = 'completed' | 'ongoing' | 'upcoming';

const SESSION_DEFAULT_MINUTES: Record<DaySession, { startMin: number; endMin: number }> = {
  morning: { startMin: 7 * 60 + 30, endMin: 12 * 60 + 15 },
  afternoon: { startMin: 13 * 60, endMin: 17 * 60 + 30 },
  evening: { startMin: 18 * 60, endMin: 21 * 60 + 30 },
};

export function parseTimeRangeMinutes(
  timeRange: string | null | undefined
): { startMin: number; endMin: number } | null {
  if (!timeRange) return null;
  const match = /(\d{1,2})\s*[:h.]\s*(\d{2})\s*[-–—]\s*(\d{1,2})\s*[:h.]\s*(\d{2})/i.exec(
    timeRange.trim()
  );
  if (!match) return null;
  const h1 = Number(match[1]);
  const m1 = Number(match[2]);
  const h2 = Number(match[3]);
  const m2 = Number(match[4]);
  if (h1 > 23 || m1 > 59 || h2 > 23 || m2 > 59) return null;
  return { startMin: h1 * 60 + m1, endMin: h2 * 60 + m2 };
}

export function getEntryTimeStatus(
  entry: Pick<TimetableEntry, 'period_start' | 'time_range'>,
  dayIsoDate: string,
  now: Date = new Date()
): EntryTimeStatus {
  const nowIso = toIsoDate(now);
  if (dayIsoDate < nowIso) return 'completed';
  if (dayIsoDate > nowIso) return 'upcoming';

  const range =
    parseTimeRangeMinutes(entry.time_range) ?? SESSION_DEFAULT_MINUTES[getEntrySession(entry)];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (nowMin < range.startMin) return 'upcoming';
  if (nowMin <= range.endMin) return 'ongoing';
  return 'completed';
}


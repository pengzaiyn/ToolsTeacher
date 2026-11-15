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
      (e) => e.weekday === day.weekday && isEntryActiveOnDate(e, day.isoDate)
    );
    map.set(day.weekday, dayEntries);
  });
  return map;
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
  if (periodStart <= 5) return 'morning';
  if (periodStart <= 10) return 'afternoon';
  return 'evening';
}

export const SESSION_LABELS: Record<DaySession, { title: string; range: string }> = {
  morning: { title: 'Buổi sáng', range: 'Tiết 1 – 5' },
  afternoon: { title: 'Buổi chiều', range: 'Tiết 6 – 10' },
  evening: { title: 'Buổi tối', range: 'Tiết 11 – 15' },
};


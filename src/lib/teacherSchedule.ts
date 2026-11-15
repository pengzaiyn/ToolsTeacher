import * as XLSX from 'xlsx';
import { classKey } from '@/lib/classKey';
import { slug } from '@/lib/email';
import { isEntryActiveOnDate, type WeekDayInfo } from '@/lib/week';
import type { TimetableEntry } from '@/types/database';

export interface TeacherOption {
  key: string;
  label: string;
  entryCount: number;
}

function stripTitlePrefix(name: string): string {
  return classKey(name).replace(/^(pgs\.?\s*ts\.?|gs\.?\s*ts\.?|ths\.?|ts\.?|cn\.?|ks\.?|thầy|cô)\s+/i, '');
}

/** Gom danh sách giảng viên duy nhất có mặt trong dữ liệu thời khóa biểu */
export function extractTeacherOptions(entries: readonly TimetableEntry[]): TeacherOption[] {
  const map = new Map<string, TeacherOption>();

  entries.forEach((entry) => {
    const rawName = entry.teacher_name?.trim() ?? '';
    const key = entry.teacher_key?.trim() || (rawName ? classKey(rawName) : '');
    if (!key) return;

    const existing = map.get(key);
    if (existing) {
      existing.entryCount += 1;
      return;
    }

    map.set(key, {
      key,
      label: rawName || key,
      entryCount: 1,
    });
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}

/** Tự tìm teacher_key trong TKB khớp với họ tên tài khoản giảng viên */
export function findMatchingTeacherKey(
  fullName: string | null | undefined,
  options: readonly TeacherOption[]
): string {
  if (!fullName?.trim() || options.length === 0) return '';
  const targetExact = classKey(fullName);
  const exact = options.find((opt) => opt.key === targetExact);
  if (exact) return exact.key;

  const strippedTarget = stripTitlePrefix(fullName);
  const strippedMatches = options.filter((opt) => stripTitlePrefix(opt.label) === strippedTarget);
  return strippedMatches.length === 1 ? strippedMatches[0].key : '';
}

/** Tính tổng số tiết dạy của danh sách buổi học */
export function countTotalPeriods(entries: readonly TimetableEntry[]): number {
  return entries.reduce(
    (sum, entry) => sum + Math.max(1, entry.period_end - entry.period_start + 1),
    0
  );
}

/** Xuất lịch dạy trong tuần đang xem ra file Excel */
export function exportScheduleWeekToExcel(
  entries: readonly TimetableEntry[],
  weekDays: readonly WeekDayInfo[],
  weekRangeLabel: string,
  teacherLabel: string
): void {
  const rows: Record<string, string | number>[] = [];

  weekDays.forEach((day) => {
    const dayItems = entries
      .filter((entry) => entry.weekday === day.weekday && isEntryActiveOnDate(entry, day.isoDate))
      .sort((a, b) => a.period_start - b.period_start);

    dayItems.forEach((item) => {
      rows.push({
        Thứ: day.label,
        Ngày: day.dateLabel,
        'Từ tiết': item.period_start,
        'Đến tiết': item.period_end,
        'Số tiết': Math.max(1, item.period_end - item.period_start + 1),
        Lớp: item.class_name,
        'Môn học': item.subject,
        'Phòng học': item.room ?? '',
        'Giảng viên': item.teacher_name ?? '',
        'Ghi chú': item.note ?? '',
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 }, // Thứ
    { wch: 8 },  // Ngày
    { wch: 8 },  // Từ tiết
    { wch: 8 },  // Đến tiết
    { wch: 8 },  // Số tiết
    { wch: 14 }, // Lớp
    { wch: 28 }, // Môn học
    { wch: 12 }, // Phòng học
    { wch: 22 }, // Giảng viên
    { wch: 24 }, // Ghi chú
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'LichDayTuan');

  const safeTeacher = slug(teacherLabel) || 'giang-vien';
  const safeWeek = slug(weekRangeLabel).slice(0, 16) || 'tuan';
  XLSX.writeFile(wb, `lich-day-${safeTeacher}-${safeWeek}.xlsx`);
}


import * as XLSX from 'xlsx';
import { classKey } from '@/lib/classKey';
import { slug } from '@/lib/email';
import { isEntryActiveOnDate, type WeekDayInfo } from '@/lib/week';
import type { TimetableEntry, TimetableTeacherAccount } from '@/types/database';

export interface TeacherOption {
  key: string;
  label: string;
  entryCount: number;
  hasAccount: boolean;
  account?: TimetableTeacherAccount;
  matchedEntryKeys: string[];
}

export interface TeacherScheduleGroups {
  verified: TeacherOption[];
  unmatched: TeacherOption[];
  verifiedEntryKeys: Set<string>;
  verifiedEntryCount: number;
}

function stripTitlePrefix(name: string): string {
  return classKey(name).replace(
    /^(?:(?:pgs\.?\s*ts\.?|gs\.?\s*ts\.?|ths\.?|ts\.?|cn\.?|ks\.?|gv\.?|thầy|cô)\s+)+/i,
    ''
  );
}

/** Chuẩn hóa khóa định danh tên giáo viên trên một dòng thời khóa biểu */
export function getEntryTeacherKey(
  entry: Pick<TimetableEntry, 'teacher_key' | 'teacher_name'>
): string {
  const rawName = entry.teacher_name?.trim() ?? '';
  return entry.teacher_key?.trim() || (rawName ? classKey(rawName) : '');
}

/**
 * Gom danh sách giảng viên cho trang Lịch dạy cá nhân:
 * - Nhóm `verified`: toàn bộ tài khoản giảng viên / cán bộ thật trên hệ thống, ghép với buổi dạy trong TKB
 * - Nhóm `unmatched`: các tên giáo viên trên file Excel chưa khớp tài khoản thật nào
 */
export function buildTeacherScheduleGroups(
  entries: readonly TimetableEntry[],
  accounts: readonly TimetableTeacherAccount[]
): TeacherScheduleGroups {
  const byExactKey = new Map<string, TimetableTeacherAccount[]>();
  const byStrippedKey = new Map<string, TimetableTeacherAccount[]>();
  const verifiedBuckets = new Map<
    string,
    { account: TimetableTeacherAccount; entryCount: number; entryKeys: Set<string> }
  >();

  accounts.forEach((account) => {
    verifiedBuckets.set(account.id, {
      account,
      entryCount: 0,
      entryKeys: new Set<string>(),
    });

    const exact = classKey(account.full_name);
    if (exact) {
      const list = byExactKey.get(exact) ?? [];
      list.push(account);
      byExactKey.set(exact, list);
    }

    const stripped = stripTitlePrefix(account.full_name);
    if (stripped) {
      const list = byStrippedKey.get(stripped) ?? [];
      list.push(account);
      byStrippedKey.set(stripped, list);
    }
  });

  const unmatchedMap = new Map<string, { label: string; entryCount: number }>();
  const verifiedEntryKeys = new Set<string>();
  let verifiedEntryCount = 0;

  entries.forEach((entry) => {
    const rawName = entry.teacher_name?.trim() ?? '';
    const entryKey = getEntryTeacherKey(entry);
    if (!entryKey) return;

    let matchedAccounts = byExactKey.get(entryKey);
    if (!matchedAccounts || matchedAccounts.length === 0) {
      const strippedEntry = stripTitlePrefix(rawName || entryKey);
      if (strippedEntry) {
        const exactByStripped = byExactKey.get(strippedEntry);
        if (exactByStripped && exactByStripped.length > 0) {
          matchedAccounts = exactByStripped;
        } else {
          const strippedMatches = byStrippedKey.get(strippedEntry);
          if (strippedMatches && strippedMatches.length === 1) {
            matchedAccounts = strippedMatches;
          }
        }
      }
    }

    if (matchedAccounts && matchedAccounts.length > 0) {
      verifiedEntryKeys.add(entryKey);
      verifiedEntryCount += 1;
      matchedAccounts.forEach((account) => {
        const bucket = verifiedBuckets.get(account.id);
        if (!bucket) return;
        bucket.entryCount += 1;
        bucket.entryKeys.add(entryKey);
      });
      return;
    }

    const existing = unmatchedMap.get(entryKey);
    if (existing) {
      existing.entryCount += 1;
      return;
    }
    unmatchedMap.set(entryKey, {
      label: rawName || entryKey,
      entryCount: 1,
    });
  });

  const verified: TeacherOption[] = Array.from(verifiedBuckets.values())
    .map(({ account, entryCount, entryKeys }) => ({
      key: `account:${account.id}`,
      label: account.full_name,
      entryCount,
      hasAccount: true,
      account,
      matchedEntryKeys: Array.from(entryKeys),
    }))
    .sort((a, b) => {
      const aHasEntries = a.entryCount > 0 ? 0 : 1;
      const bHasEntries = b.entryCount > 0 ? 0 : 1;
      if (aHasEntries !== bHasEntries) return aHasEntries - bHasEntries;

      const aRoleRank = a.account?.role === 'teacher' ? 0 : 1;
      const bRoleRank = b.account?.role === 'teacher' ? 0 : 1;
      if (aRoleRank !== bRoleRank) return aRoleRank - bRoleRank;

      return a.label.localeCompare(b.label, 'vi');
    });

  const unmatched: TeacherOption[] = Array.from(unmatchedMap.entries())
    .map(([entryKey, info]) => ({
      key: `raw:${entryKey}`,
      label: info.label,
      entryCount: info.entryCount,
      hasAccount: false,
      matchedEntryKeys: [entryKey],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));

  return {
    verified,
    unmatched,
    verifiedEntryKeys,
    verifiedEntryCount,
  };
}

/** Tự tìm key tùy chọn khớp với tài khoản giảng viên đang đăng nhập */
export function findOptionKeyForProfile(
  profileId: string | null | undefined,
  fullName: string | null | undefined,
  options: readonly TeacherOption[]
): string {
  if (options.length === 0) return '';
  if (profileId) {
    const byId = options.find((opt) => opt.account?.id === profileId);
    if (byId) return byId.key;
  }
  if (!fullName?.trim()) return '';
  const targetExact = classKey(fullName);
  const exact = options.find((opt) => classKey(opt.label) === targetExact);
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

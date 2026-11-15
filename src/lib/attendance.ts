import { getJsDayAsSchoolWeekday, isEntryActiveOnDate } from '@/lib/week';
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  ClassGradebookSettings,
  Enrollment,
  TimetableEntry,
} from '@/types/database';

export interface AttendanceStatusMeta {
  label: string;
  shortCode: string;
  tone: 'success' | 'warning' | 'navy' | 'danger';
}

export const ATTENDANCE_STATUS_ORDER: AttendanceStatus[] = [
  'present',
  'late',
  'excused',
  'absent',
];

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, AttendanceStatusMeta> = {
  present: { label: 'Có mặt', shortCode: 'C', tone: 'success' },
  late: { label: 'Đi muộn', shortCode: 'M', tone: 'warning' },
  excused: { label: 'Có phép', shortCode: 'P', tone: 'navy' },
  absent: { label: 'Vắng', shortCode: 'V', tone: 'danger' },
};

export interface StudentAttendanceSummary {
  studentId: string;
  fullName: string;
  studentCode: string | null;
  homeroomClass: string | null;
  totalSessions: number;
  markedSessions: number;
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  absentPct: number;
  attendanceScore10: number | null;
  isWarning: boolean;
}

export function getTimetableSuggestionsForDate(
  entries: TimetableEntry[],
  isoDate: string
): TimetableEntry[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return [];

  const dateObj = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(dateObj.getTime())) return [];

  const weekday = getJsDayAsSchoolWeekday(dateObj);
  return entries
    .filter((entry) => entry.weekday === weekday && isEntryActiveOnDate(entry, isoDate))
    .sort((a, b) => a.period_start - b.period_start || a.period_end - b.period_end);
}

export function computeStudentAttendanceSummaries(
  enrollments: Enrollment[],
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  settings: Pick<
    ClassGradebookSettings,
    'absence_warning_pct' | 'late_weight' | 'excused_weight'
  >
): StudentAttendanceSummary[] {
  const sessionIds = new Set(sessions.map((s) => s.id));
  const byStudent = new Map<string, Map<string, AttendanceStatus>>();

  records.forEach((rec) => {
    if (!sessionIds.has(rec.session_id)) return;
    let map = byStudent.get(rec.student_id);
    if (!map) {
      map = new Map<string, AttendanceStatus>();
      byStudent.set(rec.student_id, map);
    }
    map.set(rec.session_id, rec.status);
  });

  const sortedEnrollments = [...enrollments].sort((a, b) => {
    const nameA = a.student?.full_name ?? '';
    const nameB = b.student?.full_name ?? '';
    return nameA.localeCompare(nameB, 'vi');
  });

  return sortedEnrollments.map((enr) => {
    const map = byStudent.get(enr.student_id);
    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let absentCount = 0;

    if (map) {
      map.forEach((status) => {
        if (status === 'present') presentCount += 1;
        else if (status === 'late') lateCount += 1;
        else if (status === 'excused') excusedCount += 1;
        else if (status === 'absent') absentCount += 1;
      });
    }

    const markedSessions = presentCount + lateCount + excusedCount + absentCount;
    const absentPct =
      markedSessions > 0 ? Math.round((absentCount / markedSessions) * 1000) / 10 : 0;

    let attendanceScore10: number | null = null;
    if (markedSessions > 0) {
      const earned =
        presentCount +
        lateCount * settings.late_weight +
        excusedCount * settings.excused_weight;
      const raw = (earned / markedSessions) * 10;
      attendanceScore10 = Math.max(0, Math.min(10, Math.round(raw * 10) / 10));
    }

    return {
      studentId: enr.student_id,
      fullName: enr.student?.full_name ?? 'Sinh viên',
      studentCode: enr.student?.student_code ?? null,
      homeroomClass: enr.student?.class_name ?? null,
      totalSessions: sessions.length,
      markedSessions,
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      absentPct,
      attendanceScore10,
      isWarning: markedSessions > 0 && absentPct > settings.absence_warning_pct,
    };
  });
}


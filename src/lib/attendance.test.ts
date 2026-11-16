import { describe, expect, it } from 'vitest';
import { computeStudentAttendanceSummaries } from '@/lib/attendance';
import type { AttendanceRecord, AttendanceSession, Enrollment } from '@/types/database';

function makeEnrollment(studentId: string, fullName: string, studentCode: string): Enrollment {
  return {
    id: `enr-${studentId}`,
    class_id: 'class-1',
    student_id: studentId,
    enrolled_at: '2026-11-01T00:00:00Z',
    student: {
      id: studentId,
      full_name: fullName,
      email: `${studentId}@caodangvietmyhanoi.edu.vn`,
      student_code: studentCode,
      class_name: 'CNTT-K18A',
      is_active: true,
    },
  };
}

function makeSession(id: string, date: string): AttendanceSession {
  return {
    id,
    class_id: 'class-1',
    session_date: date,
    title: `Buổi ${id}`,
    subject: 'Web',
    period_start: 1,
    period_end: 3,
    room: 'A101',
    note: null,
    created_by: 'teacher-1',
    created_at: `${date}T01:00:00Z`,
    updated_at: `${date}T01:00:00Z`,
  };
}

function makeRecord(
  sessionId: string,
  studentId: string,
  status: AttendanceRecord['status']
): AttendanceRecord {
  return {
    id: `rec-${sessionId}-${studentId}`,
    session_id: sessionId,
    student_id: studentId,
    status,
    note: null,
    marked_by: 'teacher-1',
    updated_at: '2026-11-01T02:00:00Z',
  };
}

describe('computeStudentAttendanceSummaries', () => {
  it('computes absence rate, warning flag, and attendance score 10', () => {
    const enrollments = [
      makeEnrollment('sv-1', 'Nguyễn Văn An', '61112600001'),
      makeEnrollment('sv-2', 'Trần Thị Bình', '61112600002'),
    ];
    const sessions = [
      makeSession('s1', '2026-11-01'),
      makeSession('s2', '2026-11-03'),
      makeSession('s3', '2026-11-05'),
      makeSession('s4', '2026-11-07'),
    ];
    const records: AttendanceRecord[] = [
      makeRecord('s1', 'sv-1', 'present'),
      makeRecord('s2', 'sv-1', 'late'),
      makeRecord('s3', 'sv-1', 'excused'),
      makeRecord('s4', 'sv-1', 'present'),
      makeRecord('s1', 'sv-2', 'present'),
      makeRecord('s2', 'sv-2', 'absent'),
      makeRecord('s3', 'sv-2', 'absent'),
      makeRecord('s4', 'sv-2', 'present'),
    ];

    const result = computeStudentAttendanceSummaries(enrollments, sessions, records, {
      absence_warning_pct: 20,
      late_weight: 0.5,
      excused_weight: 1.0,
    });

    const an = result.find((r) => r.studentId === 'sv-1')!;
    const binh = result.find((r) => r.studentId === 'sv-2')!;

    expect(an.absentPct).toBe(0);
    expect(an.isWarning).toBe(false);
    // (2*1 + 1*0.5 + 1*1.0) / 4 * 10 = 8.75 -> 8.8
    expect(an.attendanceScore10).toBe(8.8);

    expect(binh.absentCount).toBe(2);
    expect(binh.absentPct).toBe(50);
    expect(binh.isWarning).toBe(true);
    expect(binh.attendanceScore10).toBe(5);
  });

  it('handles students with zero marked sessions gracefully', () => {
    const result = computeStudentAttendanceSummaries(
      [makeEnrollment('sv-1', 'Nguyễn Văn An', '61112600001')],
      [],
      [],
      { absence_warning_pct: 20, late_weight: 0.5, excused_weight: 1 }
    );

    expect(result[0].markedSessions).toBe(0);
    expect(result[0].attendanceScore10).toBeNull();
    expect(result[0].isWarning).toBe(false);
  });
});


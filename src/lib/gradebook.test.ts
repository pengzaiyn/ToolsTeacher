import { describe, expect, it } from 'vitest';
import type { StudentAttendanceSummary } from '@/lib/attendance';
import { buildClassGradebook, classifyScore10, DEFAULT_GRADEBOOK_SETTINGS } from '@/lib/gradebook';
import type { Assignment, Enrollment, Submission } from '@/types/database';

describe('classifyScore10', () => {
  it('maps numeric scores to Vietnamese academic classifications', () => {
    expect(classifyScore10(null).label).toBe('Chưa đủ điểm');
    expect(classifyScore10(9.2).label).toBe('Xuất sắc');
    expect(classifyScore10(8.0).label).toBe('Giỏi');
    expect(classifyScore10(7.4).label).toBe('Khá');
    expect(classifyScore10(5.0).label).toBe('Trung bình');
    expect(classifyScore10(4.9).label).toBe('Không đạt');
  });
});

describe('buildClassGradebook', () => {
  it('combines attendance and scaled assignment scores using configured weights', () => {
    const enrollments: Enrollment[] = [
      {
        id: 'enr-1',
        class_id: 'c1',
        student_id: 'sv-1',
        enrolled_at: '2026-11-01T00:00:00Z',
        student: {
          id: 'sv-1',
          full_name: 'Nguyễn Văn An',
          email: 'an12600001@caodangvietmyhanoi.edu.vn',
          student_code: '61112600001',
          class_name: 'CNTT-K18A',
          is_active: true,
        },
      },
    ];

    const assignments: Assignment[] = [
      {
        id: 'a1',
        class_id: 'c1',
        title: 'Bài 1',
        description: null,
        type: 'multiple_choice',
        questions: [],
        max_score: 20,
        ai_grading: false,
        due_date: null,
        created_by: 't1',
        created_at: '2026-11-01T00:00:00Z',
      },
    ];

    const submissions: Submission[] = [
      {
        id: 'sub-1',
        assignment_id: 'a1',
        student_id: 'sv-1',
        answers: {},
        file_url: null,
        status: 'graded',
        submitted_at: '2026-11-02T00:00:00Z',
        grade: {
          id: 'g1',
          submission_id: 'sub-1',
          score: 18,
          feedback: null,
          graded_by: 't1',
          ai_score: null,
          ai_feedback: null,
          is_ai: false,
          graded_at: '2026-11-02T01:00:00Z',
        },
      },
    ];

    const attendanceSummaries: StudentAttendanceSummary[] = [
      {
        studentId: 'sv-1',
        fullName: 'Nguyễn Văn An',
        studentCode: '61112600001',
        homeroomClass: 'CNTT-K18A',
        totalSessions: 5,
        markedSessions: 5,
        presentCount: 5,
        lateCount: 0,
        excusedCount: 0,
        absentCount: 0,
        absentPct: 0,
        attendanceScore10: 10,
        isWarning: false,
      },
    ];

    const rows = buildClassGradebook(
      enrollments,
      assignments,
      submissions,
      attendanceSummaries,
      DEFAULT_GRADEBOOK_SETTINGS
    );

    expect(rows).toHaveLength(1);
    // Assignment: 18/20 -> 9.0; Attendance: 10.0; Final: 10*0.1 + 9*0.9 = 9.1
    expect(rows[0].assignmentAverage10).toBe(9);
    expect(rows[0].finalScore10).toBe(9.1);
    expect(rows[0].isProvisional).toBe(false);
    expect(rows[0].classification).toBe('Xuất sắc');
  });

  it('marks final score as provisional when some assignments are not yet graded', () => {
    const enrollments: Enrollment[] = [
      {
        id: 'enr-1',
        class_id: 'c1',
        student_id: 'sv-1',
        enrolled_at: '2026-11-01T00:00:00Z',
        student: {
          id: 'sv-1',
          full_name: 'Nguyễn Văn An',
          email: 'an12600001@caodangvietmyhanoi.edu.vn',
          student_code: '61112600001',
          class_name: 'CNTT-K18A',
          is_active: true,
        },
      },
    ];

    const assignments: Assignment[] = [
      {
        id: 'a1',
        class_id: 'c1',
        title: 'Bài 1',
        description: null,
        type: 'multiple_choice',
        questions: [],
        max_score: 10,
        ai_grading: false,
        due_date: null,
        created_by: 't1',
        created_at: '2026-11-01T00:00:00Z',
      },
      {
        id: 'a2',
        class_id: 'c1',
        title: 'Bài 2',
        description: null,
        type: 'essay',
        questions: [],
        max_score: 10,
        ai_grading: false,
        due_date: null,
        created_by: 't1',
        created_at: '2026-11-02T00:00:00Z',
      },
    ];

    const submissions: Submission[] = [
      {
        id: 'sub-1',
        assignment_id: 'a1',
        student_id: 'sv-1',
        answers: {},
        file_url: null,
        status: 'graded',
        submitted_at: '2026-11-02T00:00:00Z',
        grade: {
          id: 'g1',
          submission_id: 'sub-1',
          score: 8,
          feedback: null,
          graded_by: 't1',
          ai_score: null,
          ai_feedback: null,
          is_ai: false,
          graded_at: '2026-11-02T01:00:00Z',
        },
      },
    ];

    const attendanceSummaries: StudentAttendanceSummary[] = [
      {
        studentId: 'sv-1',
        fullName: 'Nguyễn Văn An',
        studentCode: '61112600001',
        homeroomClass: 'CNTT-K18A',
        totalSessions: 2,
        markedSessions: 2,
        presentCount: 2,
        lateCount: 0,
        excusedCount: 0,
        absentCount: 0,
        absentPct: 0,
        attendanceScore10: 10,
        isWarning: false,
      },
    ];

    const rows = buildClassGradebook(
      enrollments,
      assignments,
      submissions,
      attendanceSummaries,
      DEFAULT_GRADEBOOK_SETTINGS
    );

    expect(rows[0].gradedAssignmentsCount).toBe(1);
    expect(rows[0].totalAssignmentsCount).toBe(2);
    expect(rows[0].isProvisional).toBe(true);
  });
});


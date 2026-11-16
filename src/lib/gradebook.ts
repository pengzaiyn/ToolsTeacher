import type { StudentAttendanceSummary } from '@/lib/attendance';
import type {
  Assignment,
  ClassGradebookSettings,
  Enrollment,
  Grade,
  Submission,
} from '@/types/database';

export type GradeClassification =
  | 'Xuất sắc'
  | 'Giỏi'
  | 'Khá'
  | 'Trung bình'
  | 'Không đạt'
  | 'Chưa đủ điểm';

export type GradeTone = 'success' | 'navy' | 'warning' | 'danger' | 'neutral';

export const DEFAULT_GRADEBOOK_SETTINGS: Omit<
  ClassGradebookSettings,
  'class_id' | 'updated_by' | 'updated_at'
> = {
  attendance_weight: 10,
  assignment_weight: 90,
  absence_warning_pct: 20,
  late_weight: 0.5,
  excused_weight: 1.0,
};

export interface StudentAssignmentCell {
  assignmentId: string;
  rawScore: number | null;
  maxScore: number;
  score10: number | null;
  submitted: boolean;
}

export interface GradebookStudentRow {
  studentId: string;
  fullName: string;
  studentCode: string | null;
  homeroomClass: string | null;
  attendanceScore10: number | null;
  markedSessions: number;
  absentCount: number;
  absentPct: number;
  isAttendanceWarning: boolean;
  assignmentCells: Record<string, StudentAssignmentCell>;
  gradedAssignmentsCount: number;
  totalAssignmentsCount: number;
  assignmentAverage10: number | null;
  finalScore10: number | null;
  isProvisional: boolean;
  classification: GradeClassification;
  classificationTone: GradeTone;
}

export function classifyScore10(score: number | null): {
  label: GradeClassification;
  tone: GradeTone;
} {
  if (score === null || Number.isNaN(score)) {
    return { label: 'Chưa đủ điểm', tone: 'neutral' };
  }
  if (score >= 9.0) return { label: 'Xuất sắc', tone: 'success' };
  if (score >= 8.0) return { label: 'Giỏi', tone: 'success' };
  if (score >= 7.0) return { label: 'Khá', tone: 'navy' };
  if (score >= 5.0) return { label: 'Trung bình', tone: 'warning' };
  return { label: 'Không đạt', tone: 'danger' };
}

function unwrapSubmissionGrade(submission: Submission): Grade | null {
  if (!submission.grade) return null;
  return Array.isArray(submission.grade) ? submission.grade[0] ?? null : submission.grade;
}

export function buildClassGradebook(
  enrollments: Enrollment[],
  assignments: Assignment[],
  submissions: Submission[],
  attendanceSummaries: StudentAttendanceSummary[],
  settings: Pick<
    ClassGradebookSettings,
    'attendance_weight' | 'assignment_weight' | 'absence_warning_pct'
  >
): GradebookStudentRow[] {
  const attendanceByStudent = new Map<string, StudentAttendanceSummary>();
  attendanceSummaries.forEach((item) => {
    attendanceByStudent.set(item.studentId, item);
  });

  const subByKey = new Map<string, Submission>();
  submissions.forEach((sub) => {
    subByKey.set(`${sub.student_id}:${sub.assignment_id}`, sub);
  });

  const sortedEnrollments = [...enrollments].sort((a, b) =>
    (a.student?.full_name ?? '').localeCompare(b.student?.full_name ?? '', 'vi')
  );

  return sortedEnrollments.map((enr) => {
    const att = attendanceByStudent.get(enr.student_id);
    const assignmentCells: Record<string, StudentAssignmentCell> = {};
    let score10Sum = 0;
    let gradedAssignmentsCount = 0;

    assignments.forEach((assignment) => {
      const sub = subByKey.get(`${enr.student_id}:${assignment.id}`);
      const grade = sub ? unwrapSubmissionGrade(sub) : null;
      const rawScore =
        sub && sub.status === 'graded' && grade && grade.score !== null ? Number(grade.score) : null;
      const maxScore = assignment.max_score > 0 ? assignment.max_score : 10;
      const score10 =
        rawScore !== null
          ? Math.max(0, Math.min(10, Math.round((rawScore / maxScore) * 100) / 10))
          : null;

      if (score10 !== null) {
        score10Sum += score10;
        gradedAssignmentsCount += 1;
      }

      assignmentCells[assignment.id] = {
        assignmentId: assignment.id,
        rawScore,
        maxScore,
        score10,
        submitted: Boolean(sub),
      };
    });

    const assignmentAverage10 =
      gradedAssignmentsCount > 0
        ? Math.round((score10Sum / gradedAssignmentsCount) * 10) / 10
        : null;

    const attendanceScore10 = att?.attendanceScore10 ?? null;
    const wAtt = settings.attendance_weight;
    const wAssign = settings.assignment_weight;

    let weightedSum = 0;
    let activeWeightWithData = 0;
    let missingRequiredComponent = false;

    if (wAtt > 0) {
      if (attendanceScore10 !== null) {
        weightedSum += attendanceScore10 * wAtt;
        activeWeightWithData += wAtt;
      } else {
        missingRequiredComponent = true;
      }
    }

    if (wAssign > 0) {
      if (assignmentAverage10 !== null) {
        weightedSum += assignmentAverage10 * wAssign;
        activeWeightWithData += wAssign;
        if (gradedAssignmentsCount < assignments.length) {
          missingRequiredComponent = true;
        }
      } else {
        missingRequiredComponent = true;
      }
    }

    const finalScore10 =
      activeWeightWithData > 0
        ? Math.round((weightedSum / activeWeightWithData) * 10) / 10
        : null;

    const clsResult = classifyScore10(finalScore10);

    return {
      studentId: enr.student_id,
      fullName: enr.student?.full_name ?? 'Sinh viên',
      studentCode: enr.student?.student_code ?? null,
      homeroomClass: enr.student?.class_name ?? null,
      attendanceScore10,
      markedSessions: att?.markedSessions ?? 0,
      absentCount: att?.absentCount ?? 0,
      absentPct: att?.absentPct ?? 0,
      isAttendanceWarning: att?.isWarning ?? false,
      assignmentCells,
      gradedAssignmentsCount,
      totalAssignmentsCount: assignments.length,
      assignmentAverage10,
      finalScore10,
      isProvisional: finalScore10 !== null && missingRequiredComponent,
      classification: clsResult.label,
      classificationTone: clsResult.tone,
    };
  });
}


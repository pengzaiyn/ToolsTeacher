import { describe, expect, it } from 'vitest';
import {
  buildAssignmentGroupsFromTeams,
  findStudentAssignmentGroup,
  isStudentAllowedToSubmitAssignment,
  randomizeGroupLeaders,
  resolveStudentEffectiveSubmission,
  resolveStudentScoreFromGrade,
} from '@/lib/assignmentGroups';
import { buildClassGradebook, DEFAULT_GRADEBOOK_SETTINGS } from '@/lib/gradebook';
import type { Assignment, Enrollment, Submission } from '@/types/database';

describe('assignmentGroups & group gradebook scoring', () => {
  const sampleGroups = buildAssignmentGroupsFromTeams([
    {
      index: 1,
      name: 'Nhóm 1',
      members: [
        { id: 'stu_leader', name: 'Nguyễn Văn A', code: '61110001' },
        { id: 'stu_member', name: 'Trần Thị B', code: '61110002' },
      ],
    },
  ]);

  const groupAssignment: Assignment = {
    id: 'asg_group_1',
    class_id: 'cls_1',
    title: 'Bài tập nhóm số 1',
    description: null,
    type: 'file_upload',
    work_mode: 'group',
    groups: sampleGroups,
    questions: [],
    max_score: 10,
    ai_grading: false,
    due_date: null,
    created_by: 'teacher_1',
    created_at: '2026-11-27T10:00:00.000Z',
  };

  it('allows only the group leader to submit a group assignment', () => {
    expect(isStudentAllowedToSubmitAssignment(groupAssignment, 'stu_leader')).toBe(true);
    expect(isStudentAllowedToSubmitAssignment(groupAssignment, 'stu_member')).toBe(false);
    expect(findStudentAssignmentGroup(groupAssignment, 'stu_member')?.name).toBe('Nhóm 1');
  });

  it('switches to a different member when randomizing leader for a multi-member group', () => {
    const rotated = randomizeGroupLeaders(sampleGroups, () => 0);
    expect(rotated[0].leader_id).toBe('stu_member');
  });

  it('resolves leader submission for teammates and supports per-member custom scores defaulting to leader score', () => {
    const enrollments: Enrollment[] = [
      {
        id: 'enr_1',
        class_id: 'cls_1',
        student_id: 'stu_leader',
        enrolled_at: '2026-11-01T00:00:00Z',
        student: {
          id: 'stu_leader',
          full_name: 'Nguyễn Văn A',
          email: 'a@school.edu.vn',
          student_code: '61110001',
          class_name: 'K24',
          is_active: true,
        },
      },
      {
        id: 'enr_2',
        class_id: 'cls_1',
        student_id: 'stu_member',
        enrolled_at: '2026-11-01T00:00:00Z',
        student: {
          id: 'stu_member',
          full_name: 'Trần Thị B',
          email: 'b@school.edu.vn',
          student_code: '61110002',
          class_name: 'K24',
          is_active: true,
        },
      },
    ];

    const sampleGrade = {
      id: 'grd_1',
      submission_id: 'sub_1',
      score: 9,
      member_scores: { stu_member: 8 },
      feedback: 'Làm tốt',
      graded_by: 'teacher_1',
      ai_score: null,
      ai_feedback: null,
      is_ai: false,
      graded_at: '2026-11-27T12:00:00Z',
    };

    const leaderSub: Submission = {
      id: 'sub_1',
      assignment_id: 'asg_group_1',
      student_id: 'stu_leader',
      answers: {},
      file_url: 'cls_1/stu_leader/anh.png',
      status: 'graded',
      submitted_at: '2026-11-27T11:00:00Z',
      grade: [sampleGrade],
    };

    expect(
      resolveStudentEffectiveSubmission(groupAssignment, 'stu_member', [leaderSub])?.id
    ).toBe('sub_1');
    expect(resolveStudentScoreFromGrade(sampleGrade, 'stu_leader')).toBe(9);
    expect(resolveStudentScoreFromGrade(sampleGrade, 'stu_member')).toBe(8);

    const rows = buildClassGradebook(enrollments, [groupAssignment], [leaderSub], [], {
      attendance_weight: 0,
      assignment_weight: 100,
      absence_warning_pct: DEFAULT_GRADEBOOK_SETTINGS.absence_warning_pct,
    });

    const rowLeader = rows.find((r) => r.studentId === 'stu_leader')!;
    const rowMember = rows.find((r) => r.studentId === 'stu_member')!;
    expect(rowLeader.assignmentCells.asg_group_1.submitted).toBe(true);
    expect(rowMember.assignmentCells.asg_group_1.submitted).toBe(true);
    expect(rowLeader.finalScore10).toBe(9);
    expect(rowMember.finalScore10).toBe(8);
  });
});

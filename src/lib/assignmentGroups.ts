import type { KitTeam } from '@/lib/classroomKit';
import type {
  Assignment,
  AssignmentGroup,
  Grade,
  Submission,
} from '@/types/database';

/**
 * Chuyển kết quả chia nhóm từ `splitIntoTeams` thành cấu trúc `AssignmentGroup[]`
 * (mặc định chọn sinh viên đầu tiên trong mảng đã xáo trộn làm Trưởng nhóm).
 */
export function buildAssignmentGroupsFromTeams(teams: readonly KitTeam[]): AssignmentGroup[] {
  return teams
    .filter((team) => team.members.length > 0)
    .map((team) => ({
      id: `group_${team.index}`,
      name: team.name,
      leader_id: team.members[0].id,
      members: team.members.map((m) => ({
        student_id: m.id,
        full_name: m.name,
        student_code: m.code ?? null,
      })),
    }));
}

/**
 * Chọn ngẫu nhiên Trưởng nhóm cho tất cả các nhóm.
 * Nếu một nhóm có từ 2 thành viên trở lên, ưu tiên bốc người khác với trưởng nhóm hiện tại (nếu có)
 * để mỗi lần giáo viên bấm nút "Chọn random trưởng nhóm" đều thấy thay đổi rõ ràng.
 */
export function randomizeGroupLeaders(
  groups: readonly AssignmentGroup[],
  rng: () => number = Math.random
): AssignmentGroup[] {
  return groups.map((group) => {
    if (group.members.length === 0) return group;
    if (group.members.length === 1) {
      return { ...group, leader_id: group.members[0].student_id };
    }
    const candidates = group.members.filter((m) => m.student_id !== group.leader_id);
    const pool = candidates.length > 0 ? candidates : group.members;
    const picked = pool[Math.floor(rng() * pool.length)] ?? group.members[0];
    return {
      ...group,
      leader_id: picked.student_id,
    };
  });
}

/**
 * Tìm nhóm của một sinh viên trong bài tập nhóm.
 */
export function findStudentAssignmentGroup(
  assignment: Pick<Assignment, 'work_mode' | 'groups'> | null | undefined,
  studentId?: string | null
): AssignmentGroup | null {
  if (!assignment || assignment.work_mode !== 'group' || !studentId) return null;
  const list = Array.isArray(assignment.groups) ? assignment.groups : [];
  return (
    list.find(
      (g) =>
        g.leader_id === studentId ||
        (Array.isArray(g.members) && g.members.some((m) => m.student_id === studentId))
    ) ?? null
  );
}

/**
 * Kiểm tra sinh viên có được phép nộp/sửa/hủy bài tập này hay không:
 * - Bài cá nhân: mọi sinh viên trong lớp đều được nộp.
 * - Bài nhóm: chỉ Trưởng nhóm (`leader_id`) mới được nộp.
 */
export function isStudentAllowedToSubmitAssignment(
  assignment: Pick<Assignment, 'work_mode' | 'groups'> | null | undefined,
  studentId?: string | null
): boolean {
  if (!assignment || !studentId) return false;
  if (assignment.work_mode !== 'group') return true;
  const group = findStudentAssignmentGroup(assignment, studentId);
  return Boolean(group && group.leader_id === studentId);
}

/**
 * Tìm bài nộp hiệu lực áp dụng cho một sinh viên:
 * - Bài cá nhân: bài nộp của chính sinh viên đó.
 * - Bài nhóm: bài nộp của Trưởng nhóm thuộc nhóm của sinh viên đó (hoặc bài nộp trực tiếp nếu có).
 */
export function resolveStudentEffectiveSubmission(
  assignment: Pick<Assignment, 'id' | 'work_mode' | 'groups'>,
  studentId: string,
  submissions: readonly Submission[]
): Submission | null {
  const direct = submissions.find(
    (s) => s.assignment_id === assignment.id && s.student_id === studentId
  );
  if (direct) return direct;

  if (assignment.work_mode === 'group') {
    const group = findStudentAssignmentGroup(assignment, studentId);
    if (group) {
      return (
        submissions.find(
          (s) => s.assignment_id === assignment.id && s.student_id === group.leader_id
        ) ?? null
      );
    }
  }
  return null;
}

/**
 * Lấy điểm số của một sinh viên từ bản ghi `Grade`:
 * - Nếu giảng viên có nhập điểm riêng trong `member_scores[studentId]` thì ưu tiên lấy điểm riêng đó.
 * - Ngược lại mặc định bằng `grade.score` (điểm chung / điểm của Trưởng nhóm).
 */
export function resolveStudentScoreFromGrade(
  grade: Grade | null | undefined,
  studentId?: string | null
): number | null {
  if (!grade) return null;
  if (studentId && grade.member_scores && typeof grade.member_scores === 'object') {
    const custom = grade.member_scores[studentId];
    if (typeof custom === 'number' && Number.isFinite(custom)) {
      return custom;
    }
  }
  if (grade.score !== null && grade.score !== undefined && Number.isFinite(Number(grade.score))) {
    return Number(grade.score);
  }
  return null;
}


import type { UserRole } from '@/types/database';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Hiệu trưởng',
  teacher: 'Giáo viên',
  student: 'Sinh viên',
};

export function isAdmin(role?: UserRole | null): boolean {
  return role === 'admin';
}

export function isTeacher(role?: UserRole | null): boolean {
  return role === 'teacher';
}

export function isStaff(role?: UserRole | null): boolean {
  return role === 'teacher' || role === 'admin';
}

export function isStudent(role?: UserRole | null): boolean {
  return role === 'student';
}


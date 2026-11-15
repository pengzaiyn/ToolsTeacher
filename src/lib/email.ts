export const SCHOOL_DOMAIN = '@caodangvietmyhanoi.edu.vn';

// Bỏ dấu tiếng Việt, viết thường, chỉ giữ a-z và 0-9 (khớp 100% với Edge Function manage-users)
export function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

export const STUDENT_CODE_PREFIX = '6111';

// Chuẩn hóa mã sinh viên: bắt buộc "6111" + 7 số cuối (tối đa 11 chữ số).
// Cho phép nhập đủ 11 số (6111xxxxxxx) hoặc chỉ 7 số cuối (tự ghép đầu 6111).
export function normalizeStudentCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{7}$/.test(trimmed)) return `${STUDENT_CODE_PREFIX}${trimmed}`;
  if (/^6111\d{7}$/.test(trimmed)) return trimmed;
  return null;
}

// Email sinh viên = tên (từ cuối) + 8 số cuối của mã sinh viên + @caodangvietmyhanoi.edu.vn
export function studentEmail(fullName: string, code: string): string | null {
  const parts = fullName.trim().split(/\s+/);
  const given = slug(parts[parts.length - 1] ?? '');
  const digits = code.replace(/\D/g, '');
  if (!given || digits.length < 8) return null;
  return `${given}${digits.slice(-8)}${SCHOOL_DOMAIN}`;
}

export function normalizeTeacherEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.includes('@') ? trimmed : `${trimmed}${SCHOOL_DOMAIN}`;
}

export function isValidSchoolEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(SCHOOL_DOMAIN);
}


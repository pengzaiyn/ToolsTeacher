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

// Chuẩn hóa mã sinh viên:
// - Nhập 7 số cuối -> tự ghép đầu 6111 (VD: 2600001 -> 61112600001)
// - Nhập đầy đủ mã chữ/số 6-20 ký tự (VD: 5111..., 6111..., 8111..., 9111..., N811..., N812..., 13 số)
export function normalizeStudentCode(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (!trimmed) return null;
  if (/^\d{7}$/.test(trimmed)) return `${STUDENT_CODE_PREFIX}${trimmed}`;
  if (/^[A-Za-z0-9]{6,20}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

// Email sinh viên dự phòng = tên (từ cuối) + tối đa 8 ký tự cuối của mã SV + @caodangvietmyhanoi.edu.vn
export function studentEmail(fullName: string, code: string): string | null {
  const parts = fullName.trim().split(/\s+/);
  const given = slug(parts[parts.length - 1] ?? '');
  const cleanCode = slug(code);
  if (!given || cleanCode.length < 6) return null;
  return `${given}${cleanCode.slice(-8)}${SCHOOL_DOMAIN}`;
}

// Chuẩn hóa email có sẵn trong file Excel (bỏ dấu chấm thừa, khoảng trắng, dấu tiếng Việt)
export function sanitizeImportEmail(raw: string): string | null {
  let cleaned = raw.trim().replace(/\.+$/, '');
  if (!cleaned) return null;
  // Sửa trường hợp thiếu @ trước gmail.com / caodangvietmyhanoi.edu.vn
  if (!cleaned.includes('@')) {
    cleaned = cleaned.replace(/(gmail\.com|caodangvietmyhanoi\.edu\.vn|hnet\.edu\.vn)$/i, '@$1');
  }
  const atIndex = cleaned.indexOf('@');
  if (atIndex <= 0) return null;
  const localRaw = cleaned.slice(0, atIndex);
  const domainRaw = cleaned.slice(atIndex + 1).trim().toLowerCase().replace(/\.+$/, '');
  const local = localRaw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._+-]/g, '');
  if (!local || !domainRaw || !domainRaw.includes('.')) return null;
  return `${local}@${domainRaw}`;
}

export function normalizeTeacherEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.includes('@') ? trimmed : `${trimmed}${SCHOOL_DOMAIN}`;
}

export function isValidSchoolEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(SCHOOL_DOMAIN);
}

const PLACEHOLDER_CLASSES = new Set(['chưa phân lớp', 'chờ', '---', '']);

export function isPlaceholderClassName(raw: string | null | undefined): boolean {
  const normalized = (raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return PLACEHOLDER_CLASSES.has(normalized);
}

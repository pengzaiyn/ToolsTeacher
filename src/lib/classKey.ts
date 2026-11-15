// Khóa chuẩn hóa để so khớp tên lớp / tên giáo viên (khớp 100% với Edge Function manage-users)
export function classKey(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}


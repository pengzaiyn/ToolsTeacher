/**
 * Che bớt chữ số ở giữa của số điện thoại (VD: 0987654321 -> 098****321)
 * để tránh lộ thông tin khi trình chiếu lớp học hoặc xem lướt danh sách.
 */
export function maskPhone(raw?: string | null): string {
  const cleaned = (raw ?? '').trim();
  if (!cleaned) return '—';
  const digits = cleaned.replace(/\s+/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length);
  if (digits.length <= 6) {
    return `${digits.slice(0, 2)}***${digits.slice(-1)}`;
  }
  return `${digits.slice(0, 3)}${'*'.repeat(Math.max(3, digits.length - 6))}${digits.slice(-3)}`;
}

/**
 * Che bớt chữ số ở giữa của số CCCD (VD: 001204012345 -> 001******345).
 */
export function maskCccd(raw?: string | null): string {
  const cleaned = (raw ?? '').trim();
  if (!cleaned) return '—';
  if (cleaned.length <= 6) return '*'.repeat(cleaned.length);
  return `${cleaned.slice(0, 3)}${'*'.repeat(Math.max(4, cleaned.length - 6))}${cleaned.slice(-3)}`;
}


export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const RECOVERY_RESEND_COOLDOWN_SECONDS = 60;

const FAILED_LOGIN_STORAGE_KEY = 'avc_failed_login_v1';
const RECOVERY_COOLDOWN_STORAGE_KEY = 'avc_recovery_cooldown_until_v1';

export function normalizeRecoveryEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readFailedMap(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(FAILED_LOGIN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, number> = {};
    Object.entries(parsed).forEach(([key, val]) => {
      if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
        result[key] = Math.floor(val);
      }
    });
    return result;
  } catch {
    return {};
  }
}

function writeFailedMap(map: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(FAILED_LOGIN_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Bỏ qua khi sessionStorage bị chặn
  }
}

/** Lấy số lần nhập sai mật khẩu của một email trong phiên làm việc hiện tại */
export function getFailedLoginAttempts(email: string): number {
  const key = normalizeRecoveryEmail(email);
  if (!key) return 0;
  return readFailedMap()[key] ?? 0;
}

/** Tăng bộ đếm sai mật khẩu của email và trả về tổng số lần sai mới */
export function recordFailedLoginAttempt(email: string): number {
  const key = normalizeRecoveryEmail(email);
  if (!key) return 0;
  const map = readFailedMap();
  const next = (map[key] ?? 0) + 1;
  map[key] = next;
  writeFailedMap(map);
  return next;
}

/** Đặt lại bộ đếm sai mật khẩu khi đăng nhập hoặc khôi phục thành công */
export function clearFailedLoginAttempts(email: string): void {
  const key = normalizeRecoveryEmail(email);
  if (!key) return;
  const map = readFailedMap();
  if (!(key in map)) return;
  delete map[key];
  writeFailedMap(map);
}

/** Đọc số giây còn lại trước khi được gửi lại mã khôi phục về email */
export function getRecoveryResendCooldown(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(RECOVERY_COOLDOWN_STORAGE_KEY);
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until)) return 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

/** Ghi mốc chờ 60 giây sau khi gửi yêu cầu khôi phục mật khẩu */
export function startRecoveryResendCooldown(
  seconds = RECOVERY_RESEND_COOLDOWN_SECONDS
): number {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(
        RECOVERY_COOLDOWN_STORAGE_KEY,
        String(Date.now() + seconds * 1000)
      );
    } catch {
      // Bỏ qua khi sessionStorage bị chặn
    }
  }
  return seconds;
}

/** Chuyển thông báo lỗi Auth sang tiếng Việt dễ hiểu cho người dùng */
export function mapRecoveryAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('banned')) {
    return 'Tài khoản của bạn đang bị khóa. Vui lòng liên hệ nhà trường.';
  }
  if (lower.includes('over_email_send_rate_limit') || lower.includes('email rate limit')) {
    return 'Hệ thống gửi email đang chạm giới hạn tạm thời. Vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên.';
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('for security purposes') ||
    lower.includes('only request this after')
  ) {
    return 'Bạn vừa yêu cầu gửi mã quá nhanh. Vui lòng chờ khoảng 60 giây rồi thử lại.';
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return 'Địa chỉ email không hợp lệ.';
  }
  if (
    lower.includes('expired') ||
    lower.includes('invalid') ||
    lower.includes('otp') ||
    lower.includes('token')
  ) {
    return 'Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại hoặc yêu cầu gửi mã mới.';
  }
  if (lower.includes('different from the old password') || lower.includes('same password')) {
    return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  }
  if (lower.includes('at least') || lower.includes('weak password') || lower.includes('password')) {
    return 'Mật khẩu mới cần ít nhất 8 ký tự và đảm bảo độ an toàn.';
  }

  return 'Không thể thực hiện yêu cầu khôi phục mật khẩu, vui lòng thử lại.';
}


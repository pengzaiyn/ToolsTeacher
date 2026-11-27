/**
 * Kiểm tra xem bài tập đã quá hạn nộp hay chưa.
 * Nếu `dueDate` là `null` / rỗng ("Không giới hạn") thì luôn trả về `false` (vẫn mở).
 */
export function isAssignmentPastDue(dueDate?: string | null, nowMs: number = Date.now()): boolean {
  if (!dueDate) return false;
  const dueMs = Date.parse(dueDate);
  if (Number.isNaN(dueMs)) return false;
  return nowMs > dueMs;
}

/**
 * Sinh viên được phép nộp mới, chỉnh sửa nộp lại hoặc hủy/xóa bài nộp
 * chừng nào bài tập chưa quá hạn `dueDate` mà giảng viên cài đặt.
 */
export function canStudentModifySubmission(
  dueDate?: string | null,
  nowMs: number = Date.now()
): boolean {
  return !isAssignmentPastDue(dueDate, nowMs);
}


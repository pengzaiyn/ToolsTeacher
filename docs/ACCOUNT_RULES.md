# AVC Connect — Quy tắc tài khoản & phân quyền

## Vai trò
- `admin` (**Hiệu trưởng**): Quản lý sinh viên, giáo viên (gồm **Chủ nhiệm môn**), tạo/sửa/xóa lớp học (`classes`), phân công giáo viên phụ trách (hoặc để `(Chưa có giáo viên)`), xếp sinh viên vào lớp (`enrollments`), quản lý nội dung & chấm điểm lớp học, thông báo toàn trường, xem/tải thời khóa biểu
- `teacher` (**Giáo viên**): Giảng dạy các lớp được Hiệu trưởng phân công (thông báo lớp, tài liệu, bài tập, chấm điểm), xem thời khóa biểu các lớp, tải lên/xóa thời khóa biểu
- `student` (**Sinh viên**): Tham gia các lớp được ghi danh (xem tài liệu, thông báo, làm bài tập, xem điểm), xem thời khóa biểu của lớp mình được gán (`profiles.class_key`)

## Quy tắc cấp tài khoản
- Sinh viên và giáo viên **không tự đăng ký** (`Allow new users to sign up` tắt trong Supabase Auth)
- Tài khoản chỉ được tạo bởi Hiệu trưởng thông qua Edge Function `manage-users`
- **Email trường:** `@caodangvietmyhanoi.edu.vn`
- **Email sinh viên:** `<tên không dấu viết thường><8 số cuối mã sinh viên>@caodangvietmyhanoi.edu.vn`
  - Mã sinh viên: 11 chữ số bắt đầu bằng `6111` (`6111` + 7 số cuối; cho phép nhập 7 số cuối để tự ghép đầu `6111`). Nếu bỏ trống khi tạo, Postgres `next_student_code()` tự cấp mã 11 chữ số (`6111` + `YY` + 5 số thứ tự)
- **Mật khẩu mặc định:** Chỉ cấu hình bên trong Edge Function `manage-users`, không xuất hiện ở frontend
- **Khóa tài khoản:** Đồng bộ `profiles.is_active = false` và ban người dùng trong Supabase Auth (`ban_duration`)


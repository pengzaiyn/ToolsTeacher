# AVC Connect — Supabase

Project: `avc-connect`, ref `gyzgvnseizvkonustvyh`, khu vực ap-south-1. URL và khóa công khai (anon/publishable) nằm trong `.env.example`.

## Cài đặt Auth
- "Allow new users to sign up" đã tắt và phải giữ tắt
- Đăng nhập bằng email + mật khẩu. Tài khoản bị khóa bằng cách ban người dùng trong Auth (`ban_duration`) đồng thời `profiles.is_active = false`
- Vai trò lưu ở `profiles.role` (và `app_metadata.role` khi tạo). RLS dựa vào `profiles.role`, không dựa vào JWT

## Bảng (schema public)
Chi tiết cột: `DATA_SPEC.md`, `TIMETABLE_SPEC.md`.
`profiles`, `classes`, `enrollments`, `announcements`, `materials`, `assignments`, `assignment_keys`, `submissions`, `grades`, `timetable_uploads`, `timetable_entries`.

## Hàm
Schema `private` (không lộ qua API, chỉ dùng trong policy; security definer, `search_path = ''`):
`user_role()`, `is_admin()`, `is_class_teacher(cid)`, `is_class_student(cid)`, `can_see_class(cid)`, `class_of_assignment(aid)`, `class_of_submission(sid)`, `is_own_graded_submission(sid)`, `has_teacher(tid)`, `my_class_key()`, `protect_profile()` (trigger), `normalize_class_key(val)`, `classes_set_key()` (trigger), `sync_class_after_write()` (trigger), `sync_profile_class()` (trigger), `sync_classes_from_system()`.

Schema `public` (gọi qua RPC):
- `replace_timetable(p_file_name text, p_entries jsonb) returns integer`: giáo viên/hiệu trưởng; thay thế lịch của các lớp trong file và tự động đồng bộ các lớp mới sang `classes`, một giao dịch
- `sync_system_classes() returns integer`: chỉ hiệu trưởng; đồng bộ toàn bộ lớp từ `profiles` (sinh viên) & `timetable_entries` sang `classes` và tự xếp sinh viên trùng `class_key` vào `enrollments`
- `timetable_classes()`: danh sách lớp có thời khóa biểu (tuân theo RLS)
- `next_student_code() returns text`: chỉ service role; mã 11 chữ số = `6111` + 2 số cuối của năm (giờ VN) + 5 số thứ tự

## Quy tắc phân quyền (tóm tắt)
- `profiles`: xem hồ sơ mình; hiệu trưởng xem tất cả; giáo viên xem mọi sinh viên; sinh viên xem giáo viên của lớp mình. Trigger `protect_profile` chặn người không phải hiệu trưởng sửa email, vai trò, mã sinh viên, môn, trạng thái, giới tính, ngày sinh, tư vấn tuyển sinh, lớp
- Lớp học (`classes`, `enrollments`): **chỉ hiệu trưởng** tạo/sửa/xóa lớp học (`classes`) và phân công giáo viên phụ trách (`teacher_id`); hiệu trưởng và giáo viên phụ trách quản lý ghi danh sinh viên (`enrollments`); sinh viên đọc lớp mình được ghi danh
- Nội dung lớp (`announcements`, `materials`, `assignments`, `assignment_keys`, `submissions`, `grades` và Storage `materials`): giáo viên được phân công phụ trách lớp **và Hiệu trưởng** (`private.is_class_teacher(cid)` trả về `true` cho giáo viên phụ trách lớp hoặc `admin`) đều quản lý và chấm điểm được (hỗ trợ cả lớp `(Chưa có giáo viên)`); sinh viên đọc/nộp bài của lớp mình. Sinh viên chỉ nộp bài với `status = 'pending'`; điểm AI đề xuất chỉ lộ sau khi bài ở trạng thái `graded`
- `timetable_entries`: sinh viên chỉ đọc dòng có `class_key` trùng lớp của mình; giáo viên và hiệu trưởng đọc/ghi/xóa tất cả
- Không có policy cho `anon`

## Storage
Hai bucket riêng tư: `materials` (đường dẫn `<class_id>/<tên file>`, 50 MB) và `submissions` (`<class_id>/<student_id>/<tên file>`, 25 MB). Policy theo lớp.

## Edge Function `manage-users`
`verify_jwt = true`, chỉ hiệu trưởng đang hoạt động gọi được. Gọi qua `manageUsers()` trong `src/lib/supabase.ts`. POST body `{ action, ... }`:
- `create_student`: `full_name`, `gender` (Nam/Nữ/Khác), `date_of_birth` (YYYY-MM-DD), tùy chọn `student_code` (11 số đầu `6111`, hoặc 7 số cuối để tự ghép `6111`; trống thì tự cấp), `admissions_advisor`, `class_name`. Email = tên (không dấu, chữ thường) + 8 số cuối của mã + `@caodangvietmyhanoi.edu.vn`. Kiểm tra trùng, hoàn tác nếu lưu hồ sơ lỗi
- `create_teacher`: `email` (đuôi trường, có thể chỉ nhập phần trước @), `full_name`, `subject` (Chủ nhiệm môn)
- `set_active`: `user_id`, `is_active`
- `reset_password`: `user_id` (về mật khẩu mặc định)
- `delete_student`: `user_id` (chỉ xóa tài khoản sinh viên, dọn file bài nộp trong bucket `submissions` và xóa Auth user kéo theo CASCADE hồ sơ/ghi danh)
Hàm `slug`, `studentEmail`, `classKey` trong function phải khớp với `src/lib/email.ts` và `src/lib/classKey.ts`.

## Thay đổi schema
- Viết migration SQL thuần, không `BEGIN/COMMIT/ROLLBACK`
- Bảng mới: bật RLS, thu quyền của `anon`, viết policy, đánh index cho khóa ngoại
- Dùng `(select auth.uid())` trong policy
- Sau đó chạy advisors bảo mật và hiệu năng
- Schema hiện chỉ nằm trên Supabase, chưa có file migration trong repo. Có thể xuất bằng Supabase CLI (`supabase db pull`)


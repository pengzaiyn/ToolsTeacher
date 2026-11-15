# AVC Connect — Đặc tả dữ liệu (đồng bộ từ Postgres)

## Bảng chính đang sử dụng
- `profiles`: `id (uuid PK -> auth.users)`, `email (unique)`, `full_name`, `student_code (unique, 11 số đầu 6111)`, `role ('admin'|'teacher'|'student')`, `subject` (Chủ nhiệm môn đối với giáo viên), `avatar_url`, `is_active`, `created_at`, `gender ('Nam'|'Nữ'|'Khác')`, `date_of_birth`, `admissions_advisor`, `class_name`, `class_key`
- `timetable_uploads`: `id (uuid PK)`, `file_name`, `uploaded_by (-> profiles)`, `created_at`
- `timetable_entries`: `id (uuid PK)`, `upload_id (-> timetable_uploads)`, `class_name`, `class_key`, `weekday (2..8)`, `period_start (1..15)`, `period_end (1..15, >= period_start)`, `subject`, `teacher_name`, `teacher_key`, `room`, `note`, `date_from`, `date_to`
- `announcements`: `id (uuid PK)`, `class_id (nullable -> classes)`, `title`, `content`, `created_by (-> profiles)`, `created_at`

## Bảng phân hệ lớp học
- `classes`: `id (uuid PK)`, `name`, `class_key (unique, tự chuẩn hóa đồng bộ với profiles & timetable_entries)`, `subject`, `description`, `cover_url`, `teacher_id (uuid nullable -> profiles)`, `created_at`
- `enrollments`, `materials`, `assignments`, `assignment_keys`, `submissions`, `grades`

## Storage Buckets (riêng tư)
- `materials`: tối đa 50 MB
- `submissions`: tối đa 25 MB


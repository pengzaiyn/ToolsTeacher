# AVC Connect — Tiến độ và kế hoạch

## Đã làm
- Cơ sở dữ liệu trên Supabase (`avc-connect`, ref `gyzgvnseizvkonustvyh`): 8 bảng lớp học + 2 bảng thời khóa biểu + `profiles`, RLS, 2 kho Storage, hàm hỗ trợ (xem [SUPABASE.md](SUPABASE.md))
- Edge Function `manage-users`: tạo sinh viên/giáo viên, khóa/mở khóa, đặt lại mật khẩu (đã đồng bộ mã nguồn về `supabase/functions/manage-users/index.ts`)
- Tài khoản hiệu trưởng đầu tiên đã tạo trên Supabase
- Xây dựng lại toàn bộ mã nguồn frontend từ đầu:
  - Khung dự án Vite + React 18 + TypeScript + Tailwind CSS 3 theo bộ màu thương hiệu (`#C8102E`, `#1A365D`, font Inter 400/600/700, `lucide-react`)
  - Bộ thành phần UI (`src/components/ui/`), `Header`, `Layout`, `ProtectedRoute`, `AccountActions`, `GradeTable`
  - Đăng nhập (`/login`), chặn truy cập theo vai trò + kiểm tra `is_active`, hồ sơ + đổi mật khẩu (`/profile`)
  - Trang chủ (`/tools`), thời khóa biểu theo tuần (`/timetable` kèm xóa lịch theo lớp), tải thời khóa biểu từ Excel (`/timetable/upload` kèm tải file mẫu)
  - Công cụ cho giáo viên (Đợt 1): Mục điều hướng **Công cụ giảng dạy** (`/teacher/tools`) tập hợp Lịch dạy cá nhân (`/teacher/schedule`) và Điều phối lớp học (`/teacher/classroom-kit` gồm mini game gọi tên trả bài, chia nhóm xuất Excel và đồng hồ bấm giờ chiếu lớn)
  - Tạo file Excel mẫu thời khóa biểu tại `docs/mau-thoi-khoa-bieu.xlsx`
  - Phân hệ Lớp học (`/classes`, `/classes/:id`): **Đồng bộ 2 chiều với Sinh viên & Thời khóa biểu** (`class_key` thống nhất, tự tạo lớp khi nhập SV/TKB mới, tự xếp sinh viên trùng tên lớp vào `enrollments`, đổi tên lớp tự cập nhật đồng bộ, hiển thị sĩ số & liên kết xem TKB); **Hiệu trưởng** tạo/sửa/xóa lớp học, phân công giáo viên phụ trách (hoặc `(Chưa có giáo viên)`), xếp sinh viên (từng bạn hoặc cả lớp) và quản lý nội dung lớp; **Giáo viên** giảng dạy lớp được phân công (thông báo lớp, tài liệu học tập `materials`, giao bài tập 4 dạng `multiple_choice`/`essay`/`short_answer`/`file_upload`, chấm tự động trắc nghiệm theo `assignment_keys` hoặc chấm tay); **Sinh viên** xem tài liệu, nộp bài và xem điểm sau khi `graded`
  - Trang hiệu trưởng: quản lý sinh viên (`/admin/students`, gán lớp), quản lý giáo viên (`/admin/teachers`), cùng các trang phụ truy cập qua URL (`/admin`, `/admin/announcements`, `/admin/classes`, `/admin/classes/:id`)
- Chạy `npm install` và `npm run build` (`tsc -b && vite build`) thành công

## Chưa kiểm chứng (làm ngay)
1. Thử toàn bộ luồng thật trên trình duyệt: đăng nhập hiệu trưởng, tạo giáo viên (kèm chủ nhiệm môn) và sinh viên, tải file `docs/mau-thoi-khoa-bieu.xlsx`, tạo lớp (có hoặc chưa có giáo viên) và xếp sinh viên vào lớp, đăng nhập giáo viên giao bài tập/chấm điểm, đăng nhập sinh viên xem lịch & nộp bài
2. Thử Edge Function `manage-users` với phiên đăng nhập thật từ giao diện
3. Kiểm tra RLS bằng tài khoản sinh viên và giáo viên: sinh viên không đọc được lịch lớp khác, không sửa được lớp/vai trò của mình, không đọc được `assignment_keys` và chưa thấy điểm trước khi bài ở trạng thái `graded`

## Việc tiếp theo
1. Chỉnh phần đọc Excel theo file thời khóa biểu thật của trường nếu khác định dạng bảng từng dòng (hiện đã hỗ trợ định dạng mẫu `docs/mau-thoi-khoa-bieu.xlsx`)
2. Đưa lên mạng (GitHub + Vercel hoặc Netlify), cấu hình biến môi trường `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Bật kiểm tra mật khẩu rò rỉ (Leaked Password Protection) trong Supabase Auth nếu muốn xử lý cảnh báo advisor

## Ý tưởng (chưa được chủ dự án yêu cầu, cần hỏi trước khi làm)
- Nhập danh sách sinh viên hàng loạt từ Excel
- Bắt đổi mật khẩu ở lần đăng nhập đầu tiên
- Thêm công cụ khác vào trung tâm công cụ (lịch thi, thông báo...)

## Tạm dừng
- AI chấm điểm (`ai-grade`)
- Các trang `/admin/classes`, `/admin/classes/:id`, `/admin/announcements`, `/admin` vẫn truy cập được bằng đường dẫn nhưng không có trong menu

## Câu hỏi còn mở
- Định dạng file thời khóa biểu thật của trường
- Có triển khai phần AI chấm điểm (`ai-grade`) hay không
- Địa chỉ web chính thức (tên miền) khi đưa lên mạng

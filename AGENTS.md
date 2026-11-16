# AVC Connect

Trang công cụ cho thầy cô và sinh viên Trường Cao đẳng Việt Mỹ Hà Nội. Công cụ đầu tiên là thời khóa biểu: giáo viên tải file Excel, sinh viên xem theo tuần. Nền tảng lớp học/bài tập/chấm điểm đã thiết kế nhưng đang tạm dừng.

Đọc `docs/ROADMAP.md` trước để biết đang làm đến đâu.

## Lệnh
- `npm install` cài thư viện
- `npm run dev` chạy ở http://localhost:5173
- `npm test` chạy bộ unit test (`vitest run`)
- `npm run build` kiểm tra kiểu TypeScript rồi đóng gói. Lưu ý: code chưa từng được build, việc đầu tiên là chạy lệnh này và sửa lỗi nếu có
- `npm run verify` kiểm tra bảo mật/migration (`scripts/verify-project.mjs`), chạy unit test và build toàn bộ dự án

## Công nghệ
React 18, Vite, TypeScript, Tailwind CSS 3, React Router 6, Supabase (Postgres, Auth, Storage, Edge Functions), lucide-react, xlsx. Chi tiết: `docs/TECH_STACK.md`.

## Quy tắc bắt buộc
- Toàn bộ chữ trên giao diện, thông báo lỗi, xác nhận đều bằng tiếng Việt
- Màu, font, bo góc, khoảng cách, bố cục điều hướng (sidebar trái) theo `docs/Rules.md` (đỏ #C8102E, navy #1A365D, Inter chỉ 400/600/700, khoảng cách bội số của 8px). Đọc kỹ `docs/Rules.md` trước khi viết/sửa giao diện và dùng token trong `tailwind.config.js`, không viết mã màu rời
- Icon chỉ dùng lucide-react, không dùng emoji trong giao diện
- Không cài thêm thư viện UI trừ khi thật sự cần
- Component PascalCase `.tsx`, hàm/biến camelCase, logic trong `.ts`; import theo alias `@/`
- Mọi thao tác bất đồng bộ có trạng thái loading; mọi trang có trạng thái rỗng; hành động xóa/khóa phải có xác nhận (`ConfirmDialog`); thông báo nhanh dùng `useToast`
- Mobile-first, bảng dùng `Table` (cuộn ngang trên mobile)
- Thêm công cụ mới vào trung tâm công cụ: thêm một mục vào `TOOLS` trong `src/pages/Tools.tsx`

## Bảo mật (không được nới lỏng)
- Sinh viên không tự đăng ký. "Allow new users to sign up" phải luôn tắt trong Supabase Auth. Tài khoản chỉ tạo qua Edge Function `manage-users` (chỉ hiệu trưởng gọi được)
- Không bao giờ đưa service role key vào frontend. Frontend chỉ dùng anon/publishable key trong `.env`
- Mọi bảng trong schema `public` phải bật RLS và có policy theo vai trò. Hàm kiểm tra quyền nằm ở schema `private` (security definer, `set search_path = ''`)
- Đáp án chấm điểm chỉ ở bảng `assignment_keys`, không để trong dữ liệu sinh viên đọc được
- Mật khẩu mặc định chỉ tồn tại trong Edge Function, không viết vào code frontend
- Sau mỗi thay đổi schema: chạy kiểm tra bảo mật/hiệu năng của Supabase (advisors) và xử lý cảnh báo

## Cấu trúc
- `src/components/ui/` thành phần cơ bản; `src/components/` Header, Layout, ProtectedRoute, AccountActions, GradeTable
- `src/pages/` trang chung; `src/pages/admin/` trang của hiệu trưởng
- `src/lib/` Supabase client + `manageUsers()`, `classKey`, `email`, `week`, `timetableExcel`, `roles`
- `src/context/AuthContext.tsx` đăng nhập, hồ sơ, vai trò
- `supabase/functions/manage-users/` Edge Function (bản đang chạy trên Supabase, sửa ở đây rồi deploy lại)
- `docs/` đặc tả

## Supabase
Project `avc-connect` (ref `gyzgvnseizvkonustvyh`), URL và khóa công khai trong `.env.example`. Schema, RLS, hàm, Edge Function: xem `docs/SUPABASE.md`. Nếu có kết nối Supabase MCP thì dùng nó để chạy migration và deploy function. Migration viết SQL thuần, không dùng `BEGIN/COMMIT/ROLLBACK`.

## Tài liệu
| File | Nội dung |
|------|----------|
| `docs/ROADMAP.md` | Đã làm, tạm dừng, việc tiếp theo, câu hỏi còn mở |
| `docs/SUPABASE.md` | Cơ sở dữ liệu, RLS, hàm, Edge Function, cài đặt Auth |
| `docs/Rules.md` | Thương hiệu, đặt tên, responsive, UX |
| `docs/TECH_STACK.md` | Công nghệ và quy ước |
| `docs/ACCOUNT_RULES.md` | Vai trò, quy tắc email, mã sinh viên, mật khẩu |
| `docs/TIMETABLE_SPEC.md` | Thời khóa biểu và định dạng file Excel |
| `docs/DATA_SPEC.md` | Bảng dữ liệu (cuối file có phần thay đổi so với bản đầu) |
| `docs/UI_SPEC.md`, `docs/WORKFLOWS.md`, `docs/AI_GRADING_SPEC.md` | Đặc tả lớp học/bài tập/AI chấm điểm, đang tạm dừng |

## Cách làm việc với chủ dự án
- Chủ dự án giao tiếp bằng tiếng Việt, trả lời bằng tiếng Việt
- Với tính năng lớn, nói ngắn gọn kế hoạch và chờ đồng ý trước khi viết mã
- Việc nào chưa chắc (ví dụ định dạng file Excel thật của trường) thì hỏi, không đoán


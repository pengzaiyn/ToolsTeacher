# AVC Connect — Công nghệ & Quy ước

## Ngăn xếp công nghệ
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 3, React Router 6
- **Icon:** `lucide-react` (không dùng emoji trong giao diện)
- **Xử lý Excel:** `xlsx` (SheetJS)
- **Backend:** Supabase (Postgres 17, Auth, Storage, Edge Functions)

## Quy ước mã nguồn
- Component đặt tên `PascalCase.tsx` trong `src/components/` và `src/pages/`
- Hàm, biến dùng `camelCase`, logic tách riêng trong `src/lib/`
- Luôn import theo alias `@/` (trỏ tới `src/`)
- Toàn bộ giao diện, thông báo lỗi, xác nhận dùng tiếng Việt
- Không lưu `service_role` key hoặc mật khẩu mặc định trong mã nguồn frontend


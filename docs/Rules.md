# AVC Connect — Quy chuẩn thương hiệu & UX

> Lưu ý: Mọi thay đổi về bố cục, điều hướng hoặc quy chuẩn giao diện phải được cập nhật vào file này trước khi viết hoặc sửa mã nguồn.

## Thương hiệu Trường Cao đẳng Việt Mỹ Hà Nội
- **Màu chủ đạo:** Đỏ `#C8102E` (`brand-red`) và Navy `#1A365D` (`brand-navy`), hỗ trợ chuyển đổi **Giao diện Sáng / Tối / Theo thiết bị** qua biến CSS trong `src/index.css` và token trong `tailwind.config.js`
- **Kiểu chữ:** `Inter`, chỉ dùng 3 độ đậm: `400` (`font-normal`), `600` (`font-semibold`), `700` (`font-bold`)
- **Khoảng cách:** Bội số của `8px` (`p-2`, `p-4`, `p-6`, `gap-2`, `gap-4`, `gap-6`...)
- **Biểu tượng:** Chỉ dùng `lucide-react`, không dùng emoji

## Bố cục & Điều hướng (Left Sidebar)
- **Desktop & Tablet ngang (`md`, >= 768px):**
  - Thanh điều hướng đặt cố định bên trái màn hình (`w-64` = `256px`), nền thẻ (`bg-surface-card`), viền phải `border-line`.
  - Khung nội dung chính nằm bên phải (`md:pl-64`, bọc với `min-w-0 flex-1`) để các bảng rộng cuộn ngang an toàn, không tràn khung.
- **Màn hình nhỏ (`< md`, < 768px):**
  - Thanh tiêu đề gọn phía trên (`h-16` = `64px`) chứa nút mở menu, tên hệ thống và nút chuyển nhanh Sáng/Tối.
  - Bấm nút mở menu sẽ hiện ngăn kéo trượt từ cạnh trái (`w-64`, `max-w-[80vw]`) kèm nền phủ tối, hỗ trợ đóng bằng phím `ESC`, bấm ra ngoài hoặc chọn liên kết.
- **Cấu trúc thanh điều hướng (`Header.tsx`):**
  - Đầu thanh: Logo đỏ (`GraduationCap`) + `AVC Connect` + `Cao đẳng Việt Mỹ Hà Nội`.
  - Giữa thanh (cuộn dọc được): Các mục điều hướng theo vai trò (`Trang chủ`, `Thời khóa biểu`, `Lớp học`, `Công cụ giảng dạy` cho GV/HT dẫn tới trang tập hợp công cụ giảng dạy, `Sinh viên` & `Giáo viên` cho HT).
  - Phía trên chân thanh (`shrink-0 border-t border-line px-4 py-2`): Liên kết `Cài đặt` (`/settings`) cùng nút chuyển nhanh Sáng/Tối cho tất cả người dùng.
  - Đáy thanh (`shrink-0 border-t border-line p-4`): Thẻ hồ sơ cá nhân (`/profile`) và nút `Đăng xuất`.

## Quy chuẩn giao diện
- Sử dụng token màu trong `tailwind.config.js`, không viết mã màu hex rời trong component
- Mọi thao tác bất đồng bộ có trạng thái loading
- Mọi trang/danh sách có trạng thái rỗng (`EmptyState`)
- Mọi thao tác xóa, khóa tài khoản, đặt lại mật khẩu, ghi đè thời khóa biểu phải có hộp thoại xác nhận (`ConfirmDialog`)
- Thông báo nhanh dùng `useToast`
- Thiết kế ưu tiên di động (mobile-first), bảng dữ liệu bọc trong `Table` (cuộn ngang trên màn hình nhỏ)

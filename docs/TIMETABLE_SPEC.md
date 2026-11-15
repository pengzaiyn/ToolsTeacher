# AVC Connect — Đặc tả Thời khóa biểu & Định dạng Excel

## Nguyên tắc hoạt động
- Giáo viên hoặc Hiệu trưởng tải file Excel `.xlsx` / `.xls` tại `/timetable/upload`
- Dữ liệu được kiểm tra hợp lệ ở trình duyệt, xem trước bảng buổi học, sau đó gọi RPC `replace_timetable(p_file_name, p_entries)`
- RPC chạy trong một giao dịch: tạo bản ghi `timetable_uploads`, xóa toàn bộ lịch cũ của các `class_key` có mặt trong file, chèn lịch mới (tối đa 5.000 dòng/lần) và tự động đồng bộ các lớp có mặt trong file sang bảng `classes` (kèm tự xếp sinh viên trùng `class_key`)
- Sinh viên vào `/timetable` chỉ đọc được các dòng có `class_key = private.my_class_key()` theo RLS

## Định dạng file Excel mẫu (`docs/mau-thoi-khoa-bieu.xlsx`)
File dạng **mỗi dòng một buổi học** gồm các cột:

| Cột tiếng Việt | Trường DB | Bắt buộc | Quy tắc |
|----------------|-----------|----------|---------|
| `Lớp` | `class_name` | Có | Tên lớp hiển thị (VD: `CNTT-K18A`) |
| `Thứ` | `weekday` | Có | Số `2`–`8` (`8` = Chủ nhật) hoặc chữ `Thứ 2`..`CN` |
| `Từ tiết` | `period_start` | Có | Số nguyên `1`–`15` |
| `Đến tiết` | `period_end` | Có | Số nguyên `1`–`15`, `>= Từ tiết` |
| `Môn học` | `subject` | Có | Tên môn / học phần |
| `Giáo viên` | `teacher_name` | Không | Họ tên giảng viên |
| `Phòng học` | `room` | Không | Tên phòng học / phòng máy |
| `Từ ngày` | `date_from` | Không | `YYYY-MM-DD` hoặc `DD/MM/YYYY` |
| `Đến ngày` | `date_to` | Không | `YYYY-MM-DD` hoặc `DD/MM/YYYY` (`>= Từ ngày`) |
| `Ghi chú` | `note` | Không | Ghi chú buổi học |

Lưu ý: Tên lớp trong file Excel và tên lớp gán trong hồ sơ sinh viên được chuẩn hóa qua `classKey()` (`NFC`, gộp khoảng trắng, chữ thường) để tự động khớp lịch.


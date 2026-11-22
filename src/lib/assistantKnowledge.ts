import type { UserRole } from '@/types/database';

export type AssistantAudienceRole = UserRole | 'guest';

export interface AssistantAction {
  label: string;
  target: string;
}

export interface AssistantKnowledgeTopic {
  id: string;
  title: string;
  roles: AssistantAudienceRole[];
  route: string;
  routeLabel: string;
  keywords: string[];
  routePrefixes?: string[];
  summary: string;
  steps: string[];
  notes: string[];
  sampleQuestions: string[];
}

export interface LocalAssistantResult {
  reply: string;
  actions: AssistantAction[];
  matchedTopicIds: string[];
}

export const ASSISTANT_TOPICS: AssistantKnowledgeTopic[] = [
  {
    id: 'tools-home',
    title: 'Trang chủ & Trung tâm công cụ',
    roles: ['guest', 'student', 'teacher', 'admin'],
    route: '/tools',
    routeLabel: 'Mở Trang chủ',
    routePrefixes: ['/tools', '/'],
    keywords: [
      'trang chu',
      'trung tam cong cu',
      'tools',
      'thong bao toan truong',
      'danh sach cong cu',
      'ma sinh vien',
    ],
    summary:
      'Trang chủ (/tools) hiển thị thông tin chào mừng theo tài khoản, mã sinh viên (nếu là sinh viên), danh sách các công cụ được cấp theo vai trò và tối đa 3 thông báo toàn trường mới nhất.',
    steps: [
      'Sau khi đăng nhập thành công, hệ thống tự động đưa bạn tới Trang chủ (/tools).',
      'Nhấp vào từng thẻ trong mục "Danh sách công cụ" hoặc chọn trên thanh điều hướng bên trái để mở tính năng tương ứng.',
      'Kéo xuống cuối trang để xem mục "Thông báo toàn trường".',
    ],
    notes: [
      'Chỉ những công cụ phù hợp với vai trò tài khoản của bạn mới được hiển thị.',
    ],
    sampleQuestions: [
      'Trang chủ có những tính năng gì?',
      'Xem thông báo toàn trường ở đâu?',
    ],
  },
  {
    id: 'timetable',
    title: 'Thời khóa biểu',
    roles: ['guest', 'student', 'teacher', 'admin'],
    route: '/timetable',
    routeLabel: 'Mở Thời khóa biểu',
    routePrefixes: ['/timetable'],
    keywords: [
      'thoi khoa bieu',
      'tkb',
      'lich hoc',
      'xem lich',
      'phong hoc',
      'chuyen tuan',
      'tuan nay',
      'tuan sau',
      'xoa lich',
    ],
    summary:
      'Trang Thời khóa biểu (/timetable) giúp xem lịch học theo chế độ Lịch tuần hoặc Danh sách, chuyển tuần trước/sau/hiện tại và tìm kiếm theo môn học, giảng viên hoặc phòng học.',
    steps: [
      'Vào mục "Thời khóa biểu" trên thanh điều hướng bên trái.',
      'Dùng nút chuyển tuần (tuần trước, tuần này, tuần sau) để xem lịch theo từng tuần cụ thể.',
      'Chọn chế độ hiển thị dạng Lịch tuần hoặc Danh sách tùy nhu cầu xem trên máy tính hay điện thoại.',
      'Nhập từ khóa vào ô tìm kiếm để lọc theo môn học, phòng học hoặc giảng viên.',
      'Với Giáo viên và Hiệu trưởng: có thêm bộ lọc chọn lớp, liên kết nhanh sang trang Lớp học tương ứng, nút "Tải lên Excel" và nút xóa lịch của lớp đang chọn (có hộp thoại xác nhận).',
    ],
    notes: [
      'Sinh viên chỉ xem được thời khóa biểu của đúng lớp mình được gán theo quy tắc bảo mật RLS.',
      'Nếu sinh viên chưa thấy lịch, cần nhờ Hiệu trưởng kiểm tra tên lớp trong hồ sơ có khớp với tên lớp khi nhập Excel hay không.',
    ],
    sampleQuestions: [
      'Cách xem thời khóa biểu theo tuần và lọc môn học?',
      'Tại sao sinh viên không thấy lịch của lớp khác?',
    ],
  },
  {
    id: 'timetable-upload',
    title: 'Tải lên Thời khóa biểu từ Excel',
    roles: ['teacher', 'admin'],
    route: '/timetable/upload',
    routeLabel: 'Mở Tải TKB Excel',
    routePrefixes: ['/timetable/upload'],
    keywords: [
      'tai thoi khoa bieu',
      'nhap excel',
      'upload tkb',
      'file mau excel',
      'replace_timetable',
      'cot bat buoc',
      'thu tu tiet',
    ],
    summary:
      'Chức năng Tải thời khóa biểu Excel (/timetable/upload) cho phép Giáo viên và Hiệu trưởng tải file mẫu .xlsx, kiểm tra hợp lệ dữ liệu từng dòng và cập nhật hàng loạt lịch học cho các lớp.',
    steps: [
      'Mở Thời khóa biểu -> bấm "Tải lên Excel" hoặc vào từ Công cụ giảng dạy (/teacher/tools).',
      'Bấm "Tải file mẫu" nếu chưa có biểu mẫu chuẩn; bảng gồm các cột bắt buộc: Lớp, Thứ (2-8 hoặc CN), Từ tiết (1-15), Đến tiết (>= Từ tiết), Môn học.',
      'Các cột tùy chọn gồm: Giáo viên, Phòng học, Từ ngày, Đến ngày (YYYY-MM-DD hoặc DD/MM/YYYY), Ghi chú.',
      'Chọn file .xlsx hoặc .xls để hệ thống đọc và xem trước bảng kết quả cũng như cảnh báo lỗi từng dòng (nếu có).',
      'Khi dữ liệu hợp lệ, bấm nút xác nhận tải lên để lưu.',
    ],
    notes: [
      'Khi xác nhận tải lên, hệ thống sẽ thay thế toàn bộ lịch cũ của những lớp có mặt trong file Excel mới (tối đa 5.000 dòng/lần), lịch của các lớp không có trong file vẫn giữ nguyên.',
      'Các lớp mới có trong file sẽ tự động được đồng bộ sang danh sách Lớp học và tự xếp sinh viên trùng tên lớp vào lớp.',
    ],
    sampleQuestions: [
      'File Excel thời khóa biểu cần những cột bắt buộc nào?',
      'Tải file TKB mới có làm mất lịch của các lớp khác không?',
    ],
  },
  {
    id: 'teacher-tools',
    title: 'Trung tâm Công cụ giảng dạy',
    roles: ['teacher', 'admin'],
    route: '/teacher/tools',
    routeLabel: 'Mở Công cụ giảng dạy',
    routePrefixes: ['/teacher/tools'],
    keywords: [
      'cong cu giang day',
      'giang day',
      'tien ich dung lop',
      'teacher tools',
      'lo trinh mo rong',
    ],
    summary:
      'Trung tâm Công cụ giảng dạy (/teacher/tools) tập hợp các tiện ích chuyên biệt cho giảng viên và hiệu trưởng, có thanh tìm kiếm nhanh theo tên/mô tả công cụ.',
    steps: [
      'Chọn "Công cụ giảng dạy" ở thanh menu bên trái hoặc từ Trang chủ.',
      'Gõ từ khóa vào ô "Tìm nhanh công cụ..." để lọc tiện ích cần dùng.',
      'Nhấp vào thẻ công cụ để mở Điểm danh theo buổi, Sổ điểm tổng hợp Excel, Lịch dạy cá nhân, Mini game trả bài, Chia nhóm ngẫu nhiên, Đồng hồ bấm giờ hoặc Tải TKB Excel.',
    ],
    notes: [
      'Sinh viên không thấy mục Công cụ giảng dạy.',
    ],
    sampleQuestions: [
      'Trong Công cụ giảng dạy có những tiện ích nào?',
    ],
  },
  {
    id: 'teacher-attendance',
    title: 'Điểm danh theo buổi',
    roles: ['teacher', 'admin'],
    route: '/teacher/attendance',
    routeLabel: 'Mở Điểm danh theo buổi',
    routePrefixes: ['/teacher/attendance'],
    keywords: [
      'diem danh',
      'chuyen can',
      'vang',
      'di muon',
      'co phep',
      'canh bao vang',
      'buoi hoc',
    ],
    summary:
      'Công cụ Điểm danh theo buổi (/teacher/attendance và tab Điểm danh trong từng lớp học) cho phép Giáo viên và Hiệu trưởng tạo buổi học (gợi ý sẵn từ Thời khóa biểu), tích nhanh trạng thái Có mặt / Đi muộn / Có phép / Vắng, cảnh báo sinh viên vắng vượt ngưỡng và xuất file Excel.',
    steps: [
      'Mở Công cụ giảng dạy (/teacher/tools) -> chọn "Điểm danh theo buổi" hoặc vào tab "Điểm danh" trong Chi tiết lớp học.',
      'Chọn lớp và bấm "Tạo buổi điểm danh" (có thể chọn nhanh môn/tiết/phòng gợi ý từ Thời khóa biểu theo ngày).',
      'Tích trạng thái từng sinh viên hoặc bấm "Tất cả Có mặt" rồi bấm "Lưu điểm danh".',
      'Chuyển sang chế độ "Tổng hợp chuyên cần" hoặc bấm "Xuất Excel" để tải bảng điểm danh cả lớp.',
    ],
    notes: [
      'Ngưỡng cảnh báo vắng mặc định là > 20% số buổi đã điểm danh (có thể cấu hình ở Sổ điểm tổng hợp).',
    ],
    sampleQuestions: [
      'Điểm danh sinh viên theo buổi ở đâu?',
      'Làm sao xuất file Excel điểm danh?',
    ],
  },
  {
    id: 'teacher-gradebook',
    title: 'Sổ điểm tổng hợp Excel',
    roles: ['teacher', 'admin'],
    route: '/teacher/gradebook',
    routeLabel: 'Mở Sổ điểm tổng hợp',
    routePrefixes: ['/teacher/gradebook'],
    keywords: [
      'so diem',
      'bang diem tong hop',
      'trong so',
      'xep loai',
      'xuat diem excel',
      'tong ket',
    ],
    summary:
      'Sổ điểm tổng hợp Excel (/teacher/gradebook và tab Bảng điểm trong Chi tiết lớp học) tự động gom điểm chuyên cần và điểm bài tập của lớp theo trọng số cấu hình, quy đổi thang 10, tự xếp loại học lực và xuất sổ điểm Excel nhiều sheet.',
    steps: [
      'Mở Công cụ giảng dạy (/teacher/tools) -> chọn "Sổ điểm tổng hợp Excel" hoặc vào tab "Bảng điểm" trong Chi tiết lớp học.',
      'Bấm "Cấu hình trọng số" để điều chỉnh % Chuyên cần / % Bài tập, hệ số Đi muộn / Có phép và ngưỡng cảnh báo vắng rồi lưu.',
      'Kiểm tra điểm tổng kết, xếp loại và bấm "Xuất sổ điểm Excel" để tải file .xlsx hoàn chỉnh.',
    ],
    notes: [
      'Mặc định trọng số là Chuyên cần 10% + Bài tập 90%, ngưỡng cảnh báo vắng > 20%.',
    ],
    sampleQuestions: [
      'Chỉnh trọng số điểm chuyên cần và bài tập ở đâu?',
      'Xuất sổ điểm tổng hợp ra Excel như thế nào?',
    ],
  },
  {
    id: 'teacher-schedule',
    title: 'Lịch dạy cá nhân',
    roles: ['teacher', 'admin'],
    route: '/teacher/schedule',
    routeLabel: 'Mở Lịch dạy cá nhân',
    routePrefixes: ['/teacher/schedule'],
    keywords: [
      'lich day',
      'lich day ca nhan',
      'giao vien day',
      'so tiet',
      'xuat excel lich day',
      'hom nay day',
    ],
    summary:
      'Trang Lịch dạy cá nhân (/teacher/schedule) tổng hợp các buổi dạy hôm nay và theo từng tuần của giảng viên, thống kê tổng số tiết và cho phép xuất lịch tuần ra file Excel.',
    steps: [
      'Mở Công cụ giảng dạy -> chọn "Lịch dạy cá nhân".',
      'Hệ thống tự ưu tiên khớp tên tài khoản giảng viên hiện tại; bạn có thể chuyển sang chọn các giảng viên có tài khoản thật trên hệ thống ở ô chọn giảng viên.',
      'Xem thẻ buổi dạy trong ngày hôm nay hoặc duyệt theo từng tuần (tuần trước/này/sau) cùng tổng số tiết dạy.',
      'Bấm nút xuất Excel để tải về bảng lịch giảng dạy của tuần đang xem.',
    ],
    notes: [
      'Danh sách giảng viên được ưu tiên lọc theo các tài khoản giáo viên/hiệu trưởng đang hoạt động trên hệ thống.',
    ],
    sampleQuestions: [
      'Cách xem tổng số tiết và xuất Excel Lịch dạy cá nhân?',
    ],
  },
  {
    id: 'classroom-kit',
    title: 'Bộ điều phối lớp học (Trả bài, Chia nhóm, Bấm giờ)',
    roles: ['teacher', 'admin'],
    route: '/teacher/classroom-kit',
    routeLabel: 'Mở Bộ điều phối lớp',
    routePrefixes: ['/teacher/classroom-kit'],
    keywords: [
      'dieu phoi lop',
      'mini game',
      'tra bai',
      'vong quay may man',
      'lat the bi an',
      'chia nhom',
      'bam gio',
      'dong ho',
      'toan man hinh',
      'classroom kit',
    ],
    summary:
      'Bộ điều phối lớp học (/teacher/classroom-kit) gồm 3 tiện ích đứng lớp: Mini game gọi tên trả bài (Vòng quay may mắn & Lật thẻ bí ẩn), Chia nhóm ngẫu nhiên xuất Excel và Đồng hồ bấm giờ chiếu toàn màn hình.',
    steps: [
      'Vào Công cụ giảng dạy -> bấm "Mở bộ điều phối lớp" hoặc mở trực tiếp từng tab (Trả bài, Chia nhóm, Bấm giờ).',
      'Ở phần nguồn danh sách sinh viên: chọn lớp có sẵn trên hệ thống, tải file Excel danh sách, hoặc dán nhanh danh sách tên sinh viên.',
      'Tab Mini game trả bài: chọn kiểu Vòng quay may mắn hoặc Lật thẻ bí ẩn để gọi ngẫu nhiên sinh viên trả lời và ghi nhận bảng kết quả.',
      'Tab Chia nhóm ngẫu nhiên: nhập số nhóm mong muốn hoặc sĩ số tối đa mỗi nhóm, bấm chia nhóm rồi sao chép hoặc xuất file Excel.',
      'Tab Đồng hồ bấm giờ: đặt số phút/giây cho hoạt động thảo luận, thuyết trình và bật chế độ chiếu toàn màn hình cho cả lớp theo dõi.',
    ],
    notes: [
      'Bạn có thể tải file Excel mẫu danh sách sinh viên ngay trên giao diện Bộ điều phối lớp.',
    ],
    sampleQuestions: [
      'Làm sao nạp danh sách sinh viên vào vòng quay trả bài?',
      'Cách chia nhóm ngẫu nhiên và xuất kết quả ra Excel?',
    ],
  },
  {
    id: 'classes',
    title: 'Lớp học, Tài liệu, Bài tập & Chấm điểm',
    roles: ['guest', 'student', 'teacher', 'admin'],
    route: '/classes',
    routeLabel: 'Mở Lớp học',
    routePrefixes: ['/classes'],
    keywords: [
      'lop hoc',
      'tai lieu',
      'bai tap',
      'nop bai',
      'cham diem',
      'trac nghiem',
      'tu luan',
      'thong bao lop',
      'diem so',
      'dong bo lop',
      'thanh vien lop',
    ],
    summary:
      'Phân hệ Lớp học (/classes và /classes/:id) quản lý danh sách lớp, thông báo lớp, tài liệu học tập, giao/nộp 4 dạng bài tập và theo dõi bảng điểm.',
    steps: [
      'Mở mục "Lớp học" trên thanh điều hướng bên trái để xem các lớp bạn tham gia hoặc quản lý.',
      'Nhấp vào một lớp cụ thể để mở 5 tab: Bài tập, Tài liệu, Thông báo, Thành viên và Điểm số.',
      'Sinh viên: xem tài liệu tải lên (tối đa 50MB/file), đọc thông báo lớp, làm và nộp bài tập (Trắc nghiệm, Tự luận, Trả lời ngắn, Nộp file tối đa 25MB), xem điểm sau khi giáo viên chấm xong (trạng thái Đã chấm).',
      'Giáo viên phụ trách & Hiệu trưởng: đăng thông báo, tải tài liệu, giao bài tập 4 dạng (trắc nghiệm tự động chấm theo đáp án ẩn assignment_keys), chấm điểm bài nộp của sinh viên.',
      'Chỉ Hiệu trưởng: tạo/sửa/xóa lớp học, phân công giáo viên phụ trách và bấm đồng bộ lớp 2 chiều từ dữ liệu Sinh viên & Thời khóa biểu.',
    ],
    notes: [
      'Đáp án trắc nghiệm được lưu bảo mật ở bảng riêng, sinh viên không thể xem trước; điểm bài làm chỉ hiển thị với sinh viên khi trạng thái đã chuyển sang Đã chấm.',
      'Tính năng AI tự động chấm bài luận hiện đang tạm dừng phát triển.',
    ],
    sampleQuestions: [
      'Sinh viên nộp bài tập và xem điểm ở đâu?',
      'Lớp học hỗ trợ những dạng bài tập nào?',
    ],
  },
  {
    id: 'settings-appearance',
    title: 'Cài đặt giao diện nổi (Sáng/Tối, Kính iOS, Chủ đề, Con trỏ)',
    roles: ['guest', 'student', 'teacher', 'admin'],
    route: '#settings-modal',
    routeLabel: 'Mở Cài đặt giao diện',
    routePrefixes: ['/settings'],
    keywords: [
      'cai dat',
      'giao dien',
      'sang toi',
      'dark mode',
      'kinh ios',
      'kinh mo',
      'kinh long',
      'chu de tuy chinh',
      'anh nen',
      'sticker',
      'pet',
      'thu cung',
      'con tro chuot',
      'khoi phuc mac dinh',
    ],
    summary:
      'Mục Cài đặt mở dạng khung nổi ngay trên màn hình (có nút X để đóng mà không làm mất tuần học hay bộ lọc đang xem bên dưới), gồm 4 mục tùy chỉnh bên thanh điều hướng trái.',
    steps: [
      'Nhấn nút "Cài đặt" ở phần dưới thanh menu bên trái để mở khung Cài đặt nổi (hoặc truy cập trực tiếp /settings).',
      'Chế độ Sáng / Tối: chọn Sáng, Tối hoặc Theo thiết bị.',
      'Hiệu ứng kính iOS: mặc định đang Tắt; bạn có thể bật Kính mờ iOS hoặc Kính lỏng iOS, chỉnh 3 mức độ (Nhẹ / Vừa / Rõ) và bật ánh sáng nền dịu.',
      'Chủ đề tùy chỉnh: chọn bộ chủ đề có sẵn hoặc tự phối ảnh nền, sticker trang trí, thú cưng (Pet) và màu nhấn.',
      'Hiệu ứng con trỏ chuột: chọn kiểu vầng hào quang, trường hạt hoặc lấp lánh (tự ẩn trên thiết bị cảm ứng thuần hoặc chế độ giảm chuyển động).',
      'Bấm dấu "X", nhấn phím Esc hoặc bấm "Đóng" để tắt khung Cài đặt và quay lại ngay trang bên dưới; hoặc bấm "Khôi phục mặc định" để đặt lại toàn bộ.',
    ],
    notes: [
      'Lớp nền phía sau khung Cài đặt giữ độ trong nhẹ để bạn nhìn thấy trang Thời khóa biểu hay Lớp học đổi màu và hiệu ứng kính trực tiếp theo thời gian thực.',
    ],
    sampleQuestions: [
      'Làm sao bật hiệu ứng kính mờ iOS và chỉnh mức độ?',
      'Mở Cài đặt khi đang xem Lịch học có làm mất tuần đang xem không?',
    ],
  },
  {
    id: 'profile',
    title: 'Hồ sơ cá nhân & Đổi mật khẩu',
    roles: ['guest', 'student', 'teacher', 'admin'],
    route: '/profile',
    routeLabel: 'Mở Hồ sơ cá nhân',
    routePrefixes: ['/profile'],
    keywords: [
      'ho so',
      'doi mat khau',
      'thong tin ca nhan',
      'sua ten',
      'profile',
      'tai khoan cua toi',
    ],
    summary:
      'Trang Hồ sơ cá nhân (/profile) hiển thị thông tin tài khoản nhà trường (email, vai trò, mã sinh viên/lớp/môn phụ trách), cho phép tự đổi họ tên hiển thị và đổi mật khẩu đăng nhập.',
    steps: [
      'Nhấp vào khung tên tài khoản ở góc dưới thanh menu bên trái (hoặc chọn thẻ Hồ sơ cá nhân trên Trang chủ).',
      'Chỉnh sửa họ và tên hiển thị nếu cần rồi bấm lưu.',
      'Ở mục Đổi mật khẩu, nhập mật khẩu mới và xác nhận lại mật khẩu để cập nhật.',
    ],
    notes: [
      'Sinh viên và giáo viên không thể tự sửa email, vai trò, mã sinh viên hoặc tên lớp — các trường này do Hiệu trưởng quản lý.',
    ],
    sampleQuestions: [
      'Đổi mật khẩu tài khoản ở đâu?',
      'Tôi có thể tự đổi tên lớp hoặc email của mình không?',
    ],
  },
  {
    id: 'login-security',
    title: 'Đăng nhập, Mã xác minh CAPTCHA & Lấy lại mật khẩu',
    roles: ['guest', 'student', 'teacher', 'admin'],
    route: '/login',
    routeLabel: 'Thông tin Đăng nhập & Bảo mật',
    routePrefixes: ['/login', '/reset-password'],
    keywords: [
      'dang nhap',
      'captcha',
      'ma xac minh',
      'quen mat khau',
      'lay lai mat khau',
      'nhap sai nhieu lan',
      'khoa tam',
      'tu dang ky',
      'email khoi phuc',
      'email truong',
      'email sinh vien',
      'email giao vien',
      'quy dinh email',
      'khong dang nhap duoc',
      'tai khoan bi khoa',
      'caodangvietmyhanoi',
      'lay ma qua email',
    ],
    summary:
      'Hệ thống không cho phép tự đăng ký tài khoản; trang đăng nhập (/login) được bảo vệ bằng CAPTCHA phép tính và hỗ trợ gửi mã/liên kết khôi phục qua email khi quên mật khẩu hoặc nhập sai quá nhiều lần.',
    steps: [
      'Nhập đúng Email nhà trường (@caodangvietmyhanoi.edu.vn) và mật khẩu được cấp.',
      'Giải phép tính xác minh CAPTCHA trên ảnh (có nút làm mới phép tính nếu khó nhìn). Nhập sai CAPTCHA 5 lần liên tiếp sẽ tạm chờ 5 giây.',
      'Nếu quên mật khẩu, bấm "Quên mật khẩu? Lấy mã qua email" ngay dưới nút Đăng nhập; hoặc nếu nhập sai mật khẩu quá 5 lần, hệ thống sẽ tự chuyển sang màn hình gửi mã/liên kết khôi phục về email để đặt lại mật khẩu mới.',
      'Trong trường hợp chưa có tài khoản, không nhận được email khôi phục hoặc tài khoản bị khóa, hãy liên hệ Hiệu trưởng / quản trị viên để được cấp hoặc đặt lại mật khẩu.',
    ],
    notes: [
      'Quy tắc email nhà trường: Sinh viên dùng tên (không dấu) + 8 số cuối mã sinh viên + @caodangvietmyhanoi.edu.vn; Giáo viên dùng email <tên>@caodangvietmyhanoi.edu.vn do Hiệu trưởng tạo.',
      'Không có chức năng tự đăng ký tài khoản công khai để đảm bảo an toàn dữ liệu nhà trường.',
    ],
    sampleQuestions: [
      'Nhập sai mật khẩu quá nhiều lần thì lấy lại thế nào?',
      'Vì sao không có nút tự đăng ký tài khoản?',
      'Quy định email trường khi đăng nhập là gì?',
    ],
  },
  {
    id: 'teacher-exam-mixer',
    title: 'Trộn đề thi trắc nghiệm',
    roles: ['teacher', 'admin'],
    route: '/teacher/exam-mixer',
    routeLabel: 'Mở Trộn đề thi trắc nghiệm',
    routePrefixes: ['/teacher/exam-mixer'],
    keywords: [
      'tron de',
      'tron de thi',
      'trac nghiem',
      'ma de',
      'bang dap an',
      'xuat word',
      'exam mixer',
      'ngan hang cau hoi',
    ],
    summary:
      'Trang Trộn đề thi trắc nghiệm (/teacher/exam-mixer) giúp giáo viên nhập câu hỏi từ văn bản dán hoặc file Excel, tự động đảo thứ tự câu hỏi và đáp án thành nhiều mã đề (VD: 101, 102, 103, 104), xuất file Word (.doc) chuẩn A4 và Excel bảng đáp án.',
    steps: [
      'Mở Công cụ giảng dạy -> Trộn đề thi trắc nghiệm (/teacher/exam-mixer).',
      'Bước 1: Dán câu hỏi từ Word/text (đánh dấu *A. hoặc dòng Đáp án: A) hoặc tải lên file Excel theo mẫu.',
      'Bước 2: Điền thông tin đầu đề thi, chọn danh sách mã đề và tùy chọn đảo câu hỏi/đáp án, sau đó bấm "Trộn đề ngay".',
      'Bước 3: Xem trước từng mã đề hoặc Bảng đáp án tổng hợp, rồi tải file Word (.doc), xuất Excel bảng đáp án hoặc in/lưu PDF.',
    ],
    notes: [
      'Hệ thống tự nhận diện các phương án tổng hợp như "Tất cả các đáp án trên đều đúng" (ghim ở cuối) và "Cả A và B đều đúng" (giữ nguyên thứ tự đáp án câu đó).',
    ],
    sampleQuestions: [
      'Làm sao để trộn 4 mã đề trắc nghiệm từ file Word hoặc Excel?',
      'Cách xuất file Word và bảng đáp án Excel sau khi trộn đề?',
    ],
  },
  {
    id: 'admin-teachers',
    title: 'Quản lý giáo viên (Hiệu trưởng)',
    roles: ['admin'],
    route: '/admin/teachers',
    routeLabel: 'Mở Quản lý giáo viên',
    routePrefixes: ['/admin/teachers'],
    keywords: [
      'quan ly giao vien',
      'tao giao vien',
      'chu nhiem mon',
      'giang vien moi',
      'admin teachers',
      'khoa giao vien',
    ],
    summary:
      'Trang Quản lý giáo viên (/admin/teachers) cho phép Hiệu trưởng tạo tài khoản giảng viên mới, cập nhật họ tên và chủ nhiệm môn, khóa/mở khóa hoặc đặt lại mật khẩu.',
    steps: [
      'Mở mục "Giáo viên" trên thanh menu bên trái.',
      'Bấm thêm giáo viên, nhập phần tên email (hệ thống hỗ trợ gắn đuôi @caodangvietmyhanoi.edu.vn), họ tên và chủ nhiệm môn.',
      'Có thể tìm kiếm giảng viên, chỉnh sửa tên/môn phụ trách hoặc thao tác khóa/mở khóa/đặt lại mật khẩu ngay trên bảng.',
    ],
    notes: [
      'Các tài khoản giáo viên đang hoạt động sẽ xuất hiện trong bộ lọc giảng viên ở trang Lịch dạy cá nhân.',
    ],
    sampleQuestions: [
      'Cách tạo tài khoản giáo viên mới và gắn chủ nhiệm môn?',
    ],
  },
];

const TOPIC_BY_ID = new Map(ASSISTANT_TOPICS.map((topic) => [topic.id, topic]));

export function stripVietnameseDiacritics(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getTopicsForRole(role: AssistantAudienceRole): AssistantKnowledgeTopic[] {
  return ASSISTANT_TOPICS.filter((topic) => topic.roles.includes(role));
}

function findTopicForPath(topics: AssistantKnowledgeTopic[], currentPath: string): AssistantKnowledgeTopic | undefined {
  const cleanPath = currentPath.split('?')[0] || '/';
  return topics.find((topic) =>
    topic.routePrefixes?.some((prefix) =>
      prefix === '/' ? cleanPath === '/' : cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)
    )
  );
}

/**
 * Gợi ý tối đa 4 câu hỏi nhanh sát với trang hiện tại và vai trò đang truy cập.
 */
export function getSuggestedQuestions(role: AssistantAudienceRole, currentPath: string): string[] {
  const visible = getTopicsForRole(role);
  const currentTopic = findTopicForPath(visible, currentPath);
  const suggestions: string[] = [];

  if (currentTopic) {
    suggestions.push(...currentTopic.sampleQuestions);
  }

  const overviewPrompt =
    role === 'guest'
      ? 'Website AVC Connect có những chức năng nào?'
      : 'Website này có những chức năng nào dành cho tôi?';
  suggestions.push(overviewPrompt);

  for (const topic of visible) {
    if (suggestions.length >= 4) break;
    if (topic.id === currentTopic?.id) continue;
    const candidate = topic.sampleQuestions[0];
    if (candidate && !suggestions.includes(candidate)) {
      suggestions.push(candidate);
    }
  }

  return suggestions.slice(0, 4);
}

function isActionAllowedForRole(topic: AssistantKnowledgeTopic, role: AssistantAudienceRole, currentPath: string): boolean {
  if (!topic.roles.includes(role)) return false;
  if (role === 'guest') {
    const cleanPath = currentPath.split('?')[0] || '/';
    return topic.route === '/login' && cleanPath !== '/login';
  }
  return true;
}

function toAction(topic: AssistantKnowledgeTopic): AssistantAction {
  return {
    label: topic.route === '/login' ? 'Mở trang Đăng nhập' : topic.routeLabel,
    target: topic.route,
  };
}

/**
 * Tìm tối đa 3 nút điều hướng phù hợp nhất dựa vào nội dung câu hỏi/câu trả lời và vai trò.
 */
export function findRelatedActions(
  text: string,
  role: AssistantAudienceRole,
  preferredIds: string[] = [],
  currentPath = '/'
): AssistantAction[] {
  const visible = getTopicsForRole(role);
  const actions: AssistantAction[] = [];
  const seenTargets = new Set<string>();

  for (const id of preferredIds) {
    const topic = TOPIC_BY_ID.get(id);
    if (
      topic &&
      isActionAllowedForRole(topic, role, currentPath) &&
      !seenTargets.has(topic.route)
    ) {
      seenTargets.add(topic.route);
      actions.push(toAction(topic));
    }
  }

  if (actions.length >= 3) return actions.slice(0, 3);

  const normalized = stripVietnameseDiacritics(text);
  const scored = visible
    .filter((topic) => isActionAllowedForRole(topic, role, currentPath))
    .map((topic) => {
      let score = 0;
      const normTitle = stripVietnameseDiacritics(topic.title);
      if (normalized.includes(normTitle)) score += 6;
      for (const kw of topic.keywords) {
        if (normalized.includes(kw)) score += kw.includes(' ') ? 4 : 2;
      }
      return { topic, score };
    })
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score);

  for (const item of scored) {
    if (actions.length >= 3) break;
    if (!seenTargets.has(item.topic.route)) {
      seenTargets.add(item.topic.route);
      actions.push(toAction(item.topic));
    }
  }

  return actions.slice(0, 3);
}

const GREETING_PATTERNS = [
  'xin chao',
  'chao ban',
  'chao em',
  'chao bot',
  'chao robot',
  'chao tro ly',
  'chao ai',
  'hello',
  'hey',
  'alo',
  'buoi sang',
  'buoi chieu',
  'buoi toi',
];

const THANKS_PATTERNS = ['cam on', 'thank', 'hay qua', 'gioi qua', 'tuyet voi', 'xuatsac', 'xuat sac', 'de thuong', 'ok ban', 'tot qua'];
const BYE_PATTERNS = ['tam biet', 'bye', 'gap lai sau', 'ngu ngon'];
const IDENTITY_PATTERNS = [
  'ban la ai',
  'ten gi',
  'ten la gi',
  'may la ai',
  'con robot',
  'noi chuyen',
  'biet noi',
  'giong noi',
  'nguoi that',
];
const MOOD_PATTERNS = ['khoe khong', 'the nao roi', 'met qua', 'chan qua', 'lo qua', 'cang thang', 'buon qua'];

const OVERVIEW_PATTERNS = [
  'co nhung chuc nang nao',
  'chuc nang gi',
  'tinh nang nao',
  'tinh nang gi',
  'lam duoc gi',
  'co gi hay',
  'huong dan chung',
  'bat dau',
  'gioi thieu',
  'tong quan',
];

function isOverviewQuery(normalizedQuestion: string): boolean {
  return OVERVIEW_PATTERNS.some((pattern) => normalizedQuestion.includes(pattern));
}

function getVocative(role: AssistantAudienceRole): { self: string; user: string; politeEnd: string } {
  if (role === 'teacher' || role === 'admin') {
    return { self: 'em', user: 'thầy/cô', politeEnd: 'ạ' };
  }
  return { self: 'mình', user: 'bạn', politeEnd: 'nhé' };
}

function buildSmallTalkReply(
  normalized: string,
  role: AssistantAudienceRole,
  currentTopic: AssistantKnowledgeTopic | undefined,
  visible: AssistantKnowledgeTopic[],
  currentPath: string
): LocalAssistantResult | null {
  const { self, user, politeEnd } = getVocative(role);
  const tokens = normalized.split(' ').filter(Boolean);
  const shortGreeting =
    tokens.length <= 4 &&
    (tokens.includes('chao') || tokens.includes('hi') || tokens.includes('hello') || tokens.includes('alo'));

  const defaultActions = (currentTopic ? [currentTopic] : visible.slice(0, 2))
    .filter((topic) => isActionAllowedForRole(topic, role, currentPath))
    .slice(0, 2)
    .map(toAction);

  if (BYE_PATTERNS.some((p) => normalized.includes(p))) {
    return {
      reply: `Tạm biệt ${user}! Khi nào cần hỏi lịch học, tìm chức năng hay trò chuyện chút cho vui thì cứ gọi ${self} bất cứ lúc nào ${politeEnd}.`,
      actions: [],
      matchedTopicIds: [],
    };
  }

  if (THANKS_PATTERNS.some((p) => normalized.includes(p))) {
    return {
      reply: `Không có gì đâu ${user}! Giúp được ${user} là ${self} vui rồi. Nếu còn vướng chỗ nào trên AVC Connect thì cứ nói tiếp với ${self} ${politeEnd}.`,
      actions: defaultActions,
      matchedTopicIds: currentTopic ? [currentTopic.id] : [],
    };
  }

  if (MOOD_PATTERNS.some((p) => normalized.includes(p))) {
    return {
      reply:
        role === 'teacher' || role === 'admin'
          ? 'Dạ hôm nay em vẫn tràn đầy năng lượng ạ. Nếu công việc trên trường đang bận rộn, thầy/cô cứ nói em hỗ trợ tra nhanh lịch dạy hoặc hướng dẫn thao tác để tiết kiệm thời gian nhé ạ.'
          : 'Mình lúc nào cũng sẵn sàng lắng nghe bạn nè. Nếu đang hơi mệt vì bài vở hay tìm mãi chưa thấy mục cần dùng trên web, cứ nói mình chỉ nhanh cho nhẹ đầu nhé.',
      actions: defaultActions,
      matchedTopicIds: [],
    };
  }

  if (IDENTITY_PATTERNS.some((p) => normalized.includes(p)) && !isOverviewQuery(normalized)) {
    return {
      reply: `Mình là Trợ lý AI của AVC Connect, người bạn đồng hành nhỏ trên màn hình của ${user} đây! ${self.charAt(0).toUpperCase()}${self.slice(1)} có thể tra cứu nhanh dữ liệu lớp học, sĩ số, thông báo, lịch học và hướng dẫn mọi tính năng trên website theo đúng tài khoản của ${user}. ${user.charAt(0).toUpperCase()}${user.slice(1)} thử hỏi ${self} một câu xem sao ${politeEnd}!`,
      actions: defaultActions,
      matchedTopicIds: currentTopic ? [currentTopic.id] : [],
    };
  }

  if (shortGreeting || GREETING_PATTERNS.some((p) => normalized.includes(p))) {
    const contextHint = currentTopic
      ? `Hiện ${user} đang ở mục ${currentTopic.title}, cần ${self} hỗ trợ gì về phần này hay tra cứu lớp học cứ nhắn cho ${self} ${politeEnd}!`
      : `Hôm nay ${user} muốn ${self} giúp việc gì trên AVC Connect nào? Cứ nhắn tự nhiên cho ${self} ${politeEnd}.`;

    return {
      reply: `Chào ${user}! Rất vui được nói chuyện với ${user}. ${contextHint}`,
      actions: defaultActions,
      matchedTopicIds: currentTopic ? [currentTopic.id] : [],
    };
  }

  return null;
}

function formatTopicReply(topic: AssistantKnowledgeTopic, role: AssistantAudienceRole): string {
  const { self, user, politeEnd } = getVocative(role);
  const lowerSummary = topic.summary.charAt(0).toLowerCase() + topic.summary.slice(1);
  const stepLines = topic.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  const noteLines =
    topic.notes.length > 0
      ? `\n\nLưu ý nhỏ cho ${user}: ${topic.notes.join(' ')}`
      : '';

  return `Về phần ${topic.title}, ${lowerSummary}\n\n${
    role === 'student' ? 'Bạn làm lần lượt như sau nhé:' : 'Thầy/cô thực hiện nhanh theo các bước sau ạ:'
  }\n${stepLines}${noteLines}\n\nNếu đến bước nào thấy khác màn hình thì cứ nói lại để ${self} kiểm tra tiếp cùng ${user} ${politeEnd}.`;
}

/**
 * Bộ tra cứu tri thức nội bộ (dùng làm dự phòng khi chưa cấu hình Gemini API Key hoặc mất kết nối).
 */
export function answerWithLocalKnowledge(
  question: string,
  role: AssistantAudienceRole,
  currentPath: string
): LocalAssistantResult {
  const visible = getTopicsForRole(role);
  const normalized = stripVietnameseDiacritics(question);
  const tokens = normalized.split(' ').filter((t) => t.length >= 2);
  const currentTopic = findTopicForPath(visible, currentPath);
  const { self, user, politeEnd } = getVocative(role);

  if (!normalized) {
    return {
      reply: `Chào ${user}, ${self} đang lắng nghe đây! ${user.charAt(0).toUpperCase()}${user.slice(1)} muốn hỏi về tính năng nào trên AVC Connect cứ nói với ${self} ${politeEnd}.`,
      actions: (currentTopic ? [currentTopic] : visible.slice(0, 2))
        .filter((topic) => isActionAllowedForRole(topic, role, currentPath))
        .map(toAction),
      matchedTopicIds: [],
    };
  }

  const smallTalk = buildSmallTalkReply(normalized, role, currentTopic, visible, currentPath);
  if (smallTalk) {
    return smallTalk;
  }

  if (isOverviewQuery(normalized)) {
    const highlightTitles = visible.map((t) => t.title).join(', ');
    const quickActions = (currentTopic ? [currentTopic, ...visible] : visible)
      .filter((t, idx, arr) => arr.findIndex((x) => x.id === t.id) === idx)
      .filter((topic) => isActionAllowedForRole(topic, role, currentPath))
      .slice(0, 3)
      .map(toAction);

    const intro =
      role === 'guest'
        ? `AVC Connect là cổng công cụ dành cho Trường Cao đẳng Việt Mỹ Hà Nội. Sau khi đăng nhập bằng tài khoản nhà trường cấp, bạn có thể dùng các tính năng như: ${highlightTitles}.`
        : `Với tài khoản ${role === 'admin' ? 'Hiệu trưởng' : role === 'teacher' ? 'Giáo viên' : 'Sinh viên'}, ${user} có thể sử dụng đầy đủ các phần: ${highlightTitles}.`;

    return {
      reply: `${intro}\n\n${user.charAt(0).toUpperCase()}${user.slice(1)} đang quan tâm tới mục nào nhất để ${self} hướng dẫn chi tiết ${politeEnd}?`,
      actions: quickActions,
      matchedTopicIds: visible.slice(0, 3).map((t) => t.id),
    };
  }

  const ranked = visible
    .map((topic) => {
      let score = 0;
      const normTitle = stripVietnameseDiacritics(topic.title);
      const normSummary = stripVietnameseDiacritics(topic.summary);
      const normBody = stripVietnameseDiacritics(`${topic.steps.join(' ')} ${topic.notes.join(' ')}`);

      if (normalized.includes(normTitle)) score += 10;

      for (const kw of topic.keywords) {
        if (normalized.includes(kw)) {
          score += kw.includes(' ') ? 8 : 4;
        }
      }

      for (const token of tokens) {
        if (normTitle.includes(token)) score += 2;
        else if (normSummary.includes(token)) score += 1.5;
        else if (normBody.includes(token)) score += 1;
      }

      if (currentTopic?.id === topic.id && score > 0) {
        score += 2;
      }

      return { topic, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top || top.score < 3) {
    const fallbackTopics = currentTopic ? [currentTopic] : visible.slice(0, 2);
    const fallbackActions = fallbackTopics
      .filter((topic) => isActionAllowedForRole(topic, role, currentPath))
      .map(toAction);
    const replyText =
      role === 'guest'
        ? `Nghe câu này ${self} chưa chắc mình đã hiểu đúng ý bạn lắm. Bạn đang cần hỏi về đăng nhập, mã CAPTCHA, quên mật khẩu qua email hay tính năng nào trên AVC Connect thì nói cụ thể thêm chút để ${self} hỗ trợ ngay nhé.`
        : `Câu này ${self} chưa bắt đúng phần ${user} đang cần tìm trên web. ${user.charAt(0).toUpperCase()}${user.slice(1)} nói rõ hơn một chút (ví dụ xem thời khóa biểu, tải file Excel, quản lý lớp hay đổi giao diện) hoặc bấm thử lối tắt bên dưới ${politeEnd}.`;

    return {
      reply: replyText,
      actions: fallbackActions,
      matchedTopicIds: fallbackTopics.map((t) => t.id),
    };
  }

  const second = ranked[1];
  const matchedTopics =
    second && second.score >= top.score * 0.72 && second.score >= 6
      ? [top.topic, second.topic]
      : [top.topic];

  const reply =
    matchedTopics.length === 1
      ? formatTopicReply(matchedTopics[0], role)
      : `${formatTopicReply(matchedTopics[0], role)}\n\nNgoài ra, phần này còn liên quan tới ${matchedTopics[1].title}: ${matchedTopics[1].summary}`;

  return {
    reply,
    actions: matchedTopics
      .filter((topic) => isActionAllowedForRole(topic, role, currentPath))
      .map(toAction),
    matchedTopicIds: matchedTopics.map((t) => t.id),
  };
}


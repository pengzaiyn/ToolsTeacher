export type UserRole = 'student' | 'teacher' | 'admin';

interface ServerTopic {
  id: string;
  title: string;
  roles: UserRole[];
  route: string;
  details: string;
}

const SERVER_TOPICS: ServerTopic[] = [
  {
    id: 'tools-home',
    title: 'Trang chủ & Trung tâm công cụ (/tools)',
    roles: ['student', 'teacher', 'admin'],
    route: '/tools',
    details:
      'Hiển thị lời chào theo tài khoản, mã sinh viên (nếu là SV), các thẻ công cụ theo đúng vai trò và 3 thông báo toàn trường mới nhất.',
  },
  {
    id: 'timetable',
    title: 'Thời khóa biểu (/timetable)',
    roles: ['student', 'teacher', 'admin'],
    route: '/timetable',
    details:
      'Xem lịch học dạng Lịch tuần hoặc Danh sách, chuyển tuần trước/này/sau, tìm theo môn/giảng viên/phòng học. Sinh viên chỉ xem được lịch đúng lớp mình theo RLS. Giáo viên và Hiệu trưởng lọc được mọi lớp, mở lớp liên kết, xóa lịch theo lớp hoặc chuyển sang tải file Excel.',
  },
  {
    id: 'timetable-upload',
    title: 'Tải lên Thời khóa biểu từ Excel (/timetable/upload)',
    roles: ['teacher', 'admin'],
    route: '/timetable/upload',
    details:
      'Hỗ trợ tải file mẫu .xlsx và đọc file .xlsx/.xls. Cột bắt buộc: Lớp, Thứ (2-8 hoặc CN), Từ tiết (1-15), Đến tiết (>= Từ tiết), Môn học. Cột tùy chọn: Giáo viên, Phòng học, Từ ngày, Đến ngày, Ghi chú. Khi xác nhận tải lên (tối đa 5.000 dòng/lần), lịch cũ của các lớp có trong file sẽ được thay thế và các lớp mới tự đồng bộ sang Lớp học.',
  },
  {
    id: 'teacher-tools',
    title: 'Công cụ giảng dạy (/teacher/tools)',
    roles: ['teacher', 'admin'],
    route: '/teacher/tools',
    details:
      'Trung tâm tiện ích đứng lớp có ô tìm nhanh công cụ, liên kết tới Lịch dạy cá nhân, Bộ điều phối lớp học và Tải TKB Excel.',
  },
  {
    id: 'teacher-schedule',
    title: 'Lịch dạy cá nhân (/teacher/schedule)',
    roles: ['teacher', 'admin'],
    route: '/teacher/schedule',
    details:
      'Xem buổi dạy hôm nay và theo tuần, chỉ lọc/ưu tiên các giảng viên có tài khoản hoạt động trên hệ thống, đếm tổng số tiết và xuất Excel lịch tuần.',
  },
  {
    id: 'classroom-kit',
    title: 'Bộ điều phối lớp học (/teacher/classroom-kit)',
    roles: ['teacher', 'admin'],
    route: '/teacher/classroom-kit',
    details:
      'Nạp danh sách sinh viên từ lớp trên hệ thống, Excel hoặc dán tay. Có 3 tab: (1) Mini game trả bài (Vòng quay may mắn, Lật thẻ bí ẩn kèm bảng kết quả), (2) Chia nhóm ngẫu nhiên theo số nhóm hoặc sĩ số và xuất Excel, (3) Đồng hồ bấm giờ có chế độ chiếu toàn màn hình.',
  },
  {
    id: 'classes',
    title: 'Lớp học, Tài liệu, Bài tập & Điểm số (/classes, /classes/:id)',
    roles: ['student', 'teacher', 'admin'],
    route: '/classes',
    details:
      'Mỗi lớp có 5 tab: Bài tập, Tài liệu, Thông báo, Thành viên, Điểm số. Hỗ trợ 4 dạng bài tập (Trắc nghiệm chấm tự động theo đáp án ẩn assignment_keys, Tự luận, Trả lời ngắn, Nộp file tối đa 25MB), tài liệu tối đa 50MB. Điểm chỉ hiển thị với sinh viên sau khi chuyển sang trạng thái Đã chấm. Chỉ Hiệu trưởng tạo/sửa/xóa lớp, phân công giáo viên và đồng bộ lớp 2 chiều; Giáo viên phụ trách và Hiệu trưởng quản lý nội dung và chấm bài. Tính năng AI tự động chấm bài (ai-grade) hiện đang tạm dừng.',
  },
  {
    id: 'settings-appearance',
    title: 'Cài đặt giao diện nổi (nút Cài đặt ở menu trái / #settings-modal hoặc /settings)',
    roles: ['student', 'teacher', 'admin'],
    route: '#settings-modal',
    details:
      'Mở dưới dạng khung nổi ngay trên trang hiện tại (có nút X, Esc, Đóng) để xem hiệu ứng đổi trực tiếp mà không làm mất tuần hay bộ lọc đang xem. Gồm 4 mục bên trái: Chế độ Sáng/Tối/Theo máy, Hiệu ứng kính iOS (mặc định tắt; chọn Kính mờ hoặc Kính lỏng, 3 mức Nhẹ/Vừa/Rõ và ánh sáng nền), Chủ đề tùy chỉnh (bộ chủ đề, ảnh nền, sticker, thú cưng pet), Hiệu ứng con trỏ chuột và nút Khôi phục mặc định.',
  },
  {
    id: 'profile',
    title: 'Hồ sơ cá nhân & Đổi mật khẩu (/profile)',
    roles: ['student', 'teacher', 'admin'],
    route: '/profile',
    details:
      'Xem thông tin tài khoản trường, tự đổi họ tên hiển thị và đổi mật khẩu đăng nhập. Không thể tự sửa email, vai trò, mã sinh viên hay tên lớp (do Hiệu trưởng quản lý).',
  },
  {
    id: 'login-security',
    title: 'Đăng nhập, CAPTCHA & Lấy lại mật khẩu (/login, /reset-password)',
    roles: ['student', 'teacher', 'admin'],
    route: '/login',
    details:
      'Không có chức năng tự đăng ký tài khoản. Đăng nhập có CAPTCHA phép tính toán học (sai 5 lần chờ 5 giây). Nếu nhập sai mật khẩu quá 5 lần, hệ thống tự chuyển sang khôi phục qua Email (OTP/liên kết tới /reset-password).',
  },
  {
    id: 'admin-students',
    title: 'Quản lý sinh viên (/admin/students)',
    roles: ['admin'],
    route: '/admin/students',
    details:
      'Dành riêng Hiệu trưởng: tạo tài khoản sinh viên (tự cấp mã 11 số đầu 6111, tự ghép email tên + 8 số cuối + @caodangvietmyhanoi.edu.vn qua Edge Function manage-users), lọc lớp/trạng thái, sửa thông tin, gán/chuyển lớp tự đồng bộ, khóa/mở khóa, đặt lại mật khẩu mặc định và xóa tài khoản sinh viên.',
  },
  {
    id: 'admin-teachers',
    title: 'Quản lý giáo viên (/admin/teachers)',
    roles: ['admin'],
    route: '/admin/teachers',
    details:
      'Dành riêng Hiệu trưởng: tạo tài khoản giảng viên (@caodangvietmyhanoi.edu.vn), gắn chủ nhiệm môn, sửa thông tin, khóa/mở khóa và đặt lại mật khẩu mặc định.',
  },
];

export function getRoleLabelVi(role: UserRole): string {
  if (role === 'admin') return 'Hiệu trưởng';
  if (role === 'teacher') return 'Giáo viên';
  return 'Sinh viên';
}

export function buildServerSystemInstruction(params: {
  role: UserRole;
  fullName: string;
  className?: string | null;
  subject?: string | null;
  currentPath: string;
}): string {
  const topics = SERVER_TOPICS.filter((topic) => topic.roles.includes(params.role))
    .map((topic) => `- ${topic.title} [${topic.route}]: ${topic.details}`)
    .join('\n');

  const userExtras = [
    params.className ? `Lớp: ${params.className}` : null,
    params.subject ? `Chủ nhiệm môn: ${params.subject}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const addressingRule =
    params.role === 'student'
      ? 'Xưng "mình" và gọi người dùng là "bạn" (có thể gọi tên thân thiện nếu phù hợp) để tạo cảm giác gần gũi như bạn đồng hành ở trường.'
      : 'Xưng "em" và gọi người dùng là "thầy/cô" một cách lễ phép, tự nhiên, ấm áp như trợ lý văn phòng nhà trường.';

  return [
    'Bạn là Trợ lý AI của website AVC Connect — Trường Cao đẳng Việt Mỹ Hà Nội, có thể trò chuyện trực tiếp bằng chữ và giọng nói.',
    `Người đang trò chuyện: ${params.fullName} | Vai trò: ${getRoleLabelVi(params.role)}${userExtras ? ` | ${userExtras}` : ''}.`,
    `Trang họ đang mở: ${params.currentPath || '/tools'}.`,
    '',
    'PHONG CÁCH GIAO TIẾP NHƯ NGƯỜI THẬT:',
    `1. ${addressingRule}`,
    '2. LUÔN LUÔN trả lời 100% bằng tiếng Việt có dấu tự nhiên, ngay cả khi người dùng mở đầu bằng tiếng Anh (như hello, hi, ok, thank you) hoặc hỏi xen từ tiếng Anh.',
    '3. Nói chuyện tự nhiên, ấm áp, có cảm xúc và linh hoạt theo mạch hội thoại: biết chào hỏi, cảm ơn, hỏi thăm, chia sẻ khi người dùng gặp rắc rối (như quên mật khẩu hoặc chưa thấy lịch học), rồi dẫn dắt giải quyết nhẹ nhàng.',
    '4. Trả lời thật ngắn gọn, súc tích như lời nói đời thường để đọc thành tiếng nghe tự nhiên và phản hồi nhanh: thường chỉ 1-3 câu gọn (khoảng 35-65 từ), đi thẳng vào việc; chỉ hướng dẫn dài hơn khi người dùng thực sự cần làm từng bước.',
    '5. Chỉ xuất văn bản tiếng Việt thuần túy, rõ dấu. Không dùng ký tự markdown (** , ` , # , ---) và tuyệt đối KHÔNG dùng emoji.',
    '6. Khi người dùng hỏi về tính năng website, hướng dẫn chính xác theo tên nút và trang có thật trong DANH SÁCH CHỨC NĂNG BÊN DƯỚI đúng vai trò của họ; không tự bịa nút bấm hay chức năng chưa tồn tại. Nếu hỏi chức năng vượt quyền, giải thích khéo léo rằng phần đó dành cho tài khoản có thẩm quyền.',
    '7. Lưu ý: AI chấm bài tự động hiện đang tạm dừng; nếu họ muốn xem điểm số hay lịch học thực tế của riêng mình thì gợi ý họ mở thẳng trang tương ứng để xem trực tiếp.',
    '',
    'DANH SÁCH CHỨC NĂNG ĐƯỢC PHÉP CHO VAI TRÒ HIỆN TẠI:',
    topics,
  ].join('\n');
}


import {
  BookOpen,
  Calendar,
  CalendarClock,
  CheckSquare,
  FileSpreadsheet,
  ListChecks,
  Megaphone,
  Shuffle,
  Sparkles,
  Timer,
  Trophy,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/database';

export type ToolCategory = 'general' | 'teaching' | 'admin';

export interface ToolItem {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  roles: UserRole[];
  accent: 'red' | 'navy';
  category: ToolCategory;
  badge?: string;
}

// Danh sách công cụ trung tâm (/tools) và công cụ giảng dạy (/teacher/tools)
export const TOOLS: ToolItem[] = [
  {
    id: 'timetable',
    title: 'Thời khóa biểu',
    description: 'Xem lịch học theo tuần, phòng học, môn học và giảng viên phụ trách.',
    to: '/timetable',
    icon: Calendar,
    roles: ['student', 'teacher', 'admin'],
    accent: 'red',
    category: 'general',
  },
  {
    id: 'classes',
    title: 'Lớp học',
    description: 'Quản lý lớp học, tài liệu học tập, thông báo lớp, bài tập và chấm điểm.',
    to: '/classes',
    icon: BookOpen,
    roles: ['student', 'teacher', 'admin'],
    accent: 'navy',
    category: 'general',
  },
  {
    id: 'hsk-tower',
    title: 'Leo Tháp HSK (Tiếng Trung)',
    description:
      'Đấu trường ghi từ vựng HSK 1 thời gian thực (5 suất/phòng), bầu phiếu Pinyin/Chữ Hán, bục vinh danh Top 3 và đề xuất trò chơi theo ngành.',
    to: '/hsk-tower',
    icon: Trophy,
    roles: ['student', 'teacher', 'admin'],
    accent: 'red',
    category: 'general',
    badge: 'Mới',
  },
  {
    id: 'teacher-schedule',
    title: 'Lịch dạy cá nhân',
    description: 'Xem lịch giảng dạy hôm nay và theo tuần, tổng hợp số tiết và xuất file Excel.',
    to: '/teacher/schedule',
    icon: CalendarClock,
    roles: ['teacher', 'admin'],
    accent: 'red',
    category: 'teaching',
  },
  {
    id: 'attendance',
    title: 'Điểm danh theo buổi',
    description: 'Tích nhanh chuyên cần sinh viên theo buổi học, cảnh báo vắng quá ngưỡng và xuất Excel.',
    to: '/teacher/attendance',
    icon: CheckSquare,
    roles: ['teacher', 'admin'],
    accent: 'navy',
    category: 'teaching',
    badge: 'Đợt 2',
  },
  {
    id: 'gradebook',
    title: 'Sổ điểm tổng hợp Excel',
    description: 'Gom điểm bài tập và chuyên cần theo trọng số, tự xếp loại và xuất sổ điểm hoàn chỉnh.',
    to: '/teacher/gradebook',
    icon: FileSpreadsheet,
    roles: ['teacher', 'admin'],
    accent: 'red',
    category: 'teaching',
    badge: 'Đợt 2',
  },
  {
    id: 'exam-mixer',
    title: 'Trộn đề thi trắc nghiệm',
    description:
      'Nhập câu hỏi từ văn bản hoặc Excel, đảo thứ tự câu và đáp án thành nhiều mã đề, xuất Word A4 và Excel đáp án.',
    to: '/teacher/exam-mixer',
    icon: ListChecks,
    roles: ['teacher', 'admin'],
    accent: 'red',
    category: 'teaching',
    badge: 'Mới',
  },
  {
    id: 'classroom-kit-game',
    title: 'Mini game trả bài',
    description: 'Vòng quay may mắn và lật thẻ bí ẩn gọi tên sinh viên trả bài kèm bảng kết quả.',
    to: '/teacher/classroom-kit?tab=random',
    icon: Sparkles,
    roles: ['teacher', 'admin'],
    accent: 'red',
    category: 'teaching',
    badge: 'Đứng lớp',
  },
  {
    id: 'classroom-kit-teams',
    title: 'Chia nhóm ngẫu nhiên',
    description: 'Chia đều danh sách sinh viên theo số nhóm hoặc sĩ số, sao chép và xuất Excel.',
    to: '/teacher/classroom-kit?tab=teams',
    icon: Shuffle,
    roles: ['teacher', 'admin'],
    accent: 'navy',
    category: 'teaching',
    badge: 'Đứng lớp',
  },
  {
    id: 'classroom-kit-timer',
    title: 'Đồng hồ bấm giờ lớp học',
    description: 'Đếm ngược thời gian thảo luận, làm bài hoặc thuyết trình với chế độ chiếu toàn màn hình.',
    to: '/teacher/classroom-kit?tab=timer',
    icon: Timer,
    roles: ['teacher', 'admin'],
    accent: 'navy',
    category: 'teaching',
    badge: 'Đứng lớp',
  },
  {
    id: 'timetable-upload',
    title: 'Tải thời khóa biểu Excel',
    description: 'Nhập lịch học từ file Excel theo từng lớp hoặc tải file Excel mẫu.',
    to: '/timetable/upload',
    icon: FileSpreadsheet,
    roles: ['teacher', 'admin'],
    accent: 'navy',
    category: 'teaching',
  },
  {
    id: 'admin-teachers',
    title: 'Quản lý giáo viên',
    description: 'Tạo tài khoản giảng viên, cập nhật chủ nhiệm môn và quản lý trạng thái.',
    to: '/admin/teachers',
    icon: UserCheck,
    roles: ['admin'],
    category: 'admin',
    accent: 'navy',
  },
  {
    id: 'admin-announcements',
    title: 'Quản lý thông báo',
    description: 'Đăng thông báo toàn trường, gửi riêng từng lớp học hoặc gửi riêng cho giáo viên.',
    to: '/admin/announcements',
    icon: Megaphone,
    roles: ['admin'],
    category: 'admin',
    accent: 'red',
    badge: 'Quản trị',
  },
];


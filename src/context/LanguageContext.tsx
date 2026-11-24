import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UserRole } from '@/types/database';

export type AppLanguage = 'vi' | 'en' | 'zh';

const STORAGE_KEY = 'avc-language';

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  vi: {
    'nav.home': 'Trang chủ',
    'nav.timetable': 'Thời khóa biểu',
    'nav.classes': 'Lớp học',
    'nav.games': 'Trò chơi',
    'nav.teacherTools': 'Công cụ giảng dạy',
    'nav.teachers': 'Giáo viên',
    'nav.announcements': 'Thông báo',
    'nav.settings': 'Cài đặt',
    'nav.signOut': 'Đăng xuất',
    'role.admin': 'Hiệu trưởng',
    'role.teacher': 'Giáo viên',
    'role.student': 'Sinh viên',
    'home.greeting': 'Xin chào',
    'home.subtitle': 'Trung tâm công cụ Trường Cao đẳng Việt Mỹ Hà Nội',
    'home.classPrefix': 'Lớp',
    'home.studentCode': 'Mã sinh viên',
    'home.toolsHeading': 'Danh sách công cụ',
    'home.openTool': 'Mở công cụ',
    'home.schoolAnnouncements': 'Thông báo nhà trường',
    'home.manageAnnouncements': 'Quản lý & đăng thông báo',
    'home.noAnnouncements': 'Chưa có thông báo nào',
    'home.noAnnouncementsDesc': 'Thông báo mới từ nhà trường sẽ xuất hiện tại đây.',
    'tool.timetable.title': 'Thời khóa biểu',
    'tool.timetable.desc': 'Xem lịch học theo tuần, phòng học, môn học và giảng viên phụ trách.',
    'tool.classes.title': 'Lớp học',
    'tool.classes.desc': 'Quản lý lớp học, tài liệu học tập, thông báo lớp, bài tập và chấm điểm.',
    'tool.admin-teachers.title': 'Quản lý giáo viên',
    'tool.admin-teachers.desc': 'Tạo tài khoản giảng viên, cập nhật chủ nhiệm môn và quản lý trạng thái.',
    'tool.admin-announcements.title': 'Quản lý thông báo',
    'tool.admin-announcements.desc': 'Đăng thông báo toàn trường, gửi riêng từng lớp học hoặc gửi riêng cho giáo viên.',
    'footer.schoolName': 'Trường Cao đẳng Việt Mỹ Hà Nội',
    'footer.tagline': 'Cổng công cụ hỗ trợ học tập và giảng dạy',
    'footer.col1': 'Học tập & Trò chơi',
    'footer.col2Staff': 'Giảng dạy & Tài khoản',
    'footer.col2Student': 'Tiện ích & Tài khoản',
    'footer.games': 'Trò chơi học tập',
    'footer.teacherSchedule': 'Lịch dạy cá nhân',
    'footer.hskTower': 'Leo Tháp HSK 1',
    'footer.suggestGame': 'Đề xuất trò chơi',
    'footer.profile': 'Hồ sơ cá nhân',
    'footer.appearance': 'Cài đặt giao diện',
    'footer.manageAnn': 'Quản lý thông báo',
    'games.heading': 'Trò chơi học tập — Tất cả các ngành',
    'games.subtitle':
      'Chọn trò chơi theo ngành học để vào sảnh phòng thi đấu, hoặc gửi đề xuất trò chơi mới cho ngành của bạn tới Hiệu trưởng.',
    'games.suggestBtn': 'Đề xuất trò chơi cho ngành',
    'games.tabList': 'Danh sách trò chơi',
    'games.tabSuggestions': 'Đề xuất trò chơi các ngành',
    'games.enterLobby': 'Vào sảnh trò chơi',
    'lang.changed': 'Đã chuyển ngôn ngữ sang',
    'lang.label': 'Chọn ngôn ngữ',
    'pagination.nav': 'Phân trang',
    'pagination.prev': 'Trang trước',
    'pagination.next': 'Trang sau',
    'qr.copyLink': 'Sao chép link',
    'qr.copied': 'Đã sao chép',
    'sidebar.collapse': 'Thu gọn thanh bên',
    'sidebar.expand': 'Mở rộng thanh bên',
    'theme.light': 'Sáng',
    'theme.dark': 'Tối',
    'theme.toLight': 'Chuyển sang giao diện Sáng',
    'theme.toDark': 'Chuyển sang giao diện Tối',
  },
  en: {
    'nav.home': 'Home',
    'nav.timetable': 'Timetable',
    'nav.classes': 'Classes',
    'nav.games': 'Games',
    'nav.teacherTools': 'Teaching Tools',
    'nav.teachers': 'Teachers',
    'nav.announcements': 'Announcements',
    'nav.settings': 'Settings',
    'nav.signOut': 'Sign out',
    'role.admin': 'Principal',
    'role.teacher': 'Teacher',
    'role.student': 'Student',
    'home.greeting': 'Hello',
    'home.subtitle': 'Tool Hub — Trường Cao đẳng Việt Mỹ Hà Nội',
    'home.classPrefix': 'Class',
    'home.studentCode': 'Student ID',
    'home.toolsHeading': 'Tools',
    'home.openTool': 'Open tool',
    'home.schoolAnnouncements': 'School Announcements',
    'home.manageAnnouncements': 'Manage announcements',
    'home.noAnnouncements': 'No announcements yet',
    'home.noAnnouncementsDesc': 'New school announcements will appear here.',
    'tool.timetable.title': 'Timetable',
    'tool.timetable.desc': 'View weekly schedules, classrooms, subjects, and assigned instructors.',
    'tool.classes.title': 'Classes',
    'tool.classes.desc': 'Manage classes, study materials, class announcements, assignments, and grades.',
    'tool.admin-teachers.title': 'Teacher Management',
    'tool.admin-teachers.desc': 'Create teacher accounts, assign classes, and manage account status.',
    'tool.admin-announcements.title': 'Announcement Management',
    'tool.admin-announcements.desc': 'Publish school-wide, class-specific, or teacher-targeted announcements.',
    'footer.schoolName': 'Trường Cao đẳng Việt Mỹ Hà Nội',
    'footer.tagline': 'Learning & Teaching Support Portal',
    'footer.col1': 'Learning & Games',
    'footer.col2Staff': 'Teaching & Account',
    'footer.col2Student': 'Utilities & Account',
    'footer.games': 'Learning Games',
    'footer.teacherSchedule': 'Teaching Schedule',
    'footer.hskTower': 'HSK 1 Tower Climb',
    'footer.suggestGame': 'Suggest a Game',
    'footer.profile': 'My Profile',
    'footer.appearance': 'Appearance Settings',
    'footer.manageAnn': 'Manage Announcements',
    'games.heading': 'Learning Games — All Majors',
    'games.subtitle':
      'Pick a game by major to join live rooms, or suggest a new learning game for your major to the Principal.',
    'games.suggestBtn': 'Suggest a game',
    'games.tabList': 'Game List',
    'games.tabSuggestions': 'Major Game Suggestions',
    'games.enterLobby': 'Enter game lobby',
    'lang.changed': 'Language switched to',
    'lang.label': 'Select language',
    'pagination.nav': 'Pages',
    'pagination.prev': 'Previous page',
    'pagination.next': 'Next page',
    'qr.copyLink': 'Copy link',
    'qr.copied': 'Copied',
    'sidebar.collapse': 'Collapse sidebar',
    'sidebar.expand': 'Expand sidebar',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.toLight': 'Switch to light mode',
    'theme.toDark': 'Switch to dark mode',
  },
  zh: {
    'nav.home': '首页',
    'nav.timetable': '课程表',
    'nav.classes': '班级',
    'nav.games': '学习游戏',
    'nav.teacherTools': '教学工具',
    'nav.teachers': '教师管理',
    'nav.announcements': '通知公告',
    'nav.settings': '设置',
    'nav.signOut': '退出登录',
    'role.admin': '校长',
    'role.teacher': '教师',
    'role.student': '学生',
    'home.greeting': '你好',
    'home.subtitle': '工具中心 — Trường Cao đẳng Việt Mỹ Hà Nội',
    'home.classPrefix': '班级',
    'home.studentCode': '学号',
    'home.toolsHeading': '工具列表',
    'home.openTool': '打开工具',
    'home.schoolAnnouncements': '学校公告',
    'home.manageAnnouncements': '管理与发布公告',
    'home.noAnnouncements': '暂无公告',
    'home.noAnnouncementsDesc': '学校最新通知将显示在此处。',
    'tool.timetable.title': '课程表',
    'tool.timetable.desc': '按周查看课程安排、教室、科目及任课教师。',
    'tool.classes.title': '班级',
    'tool.classes.desc': '管理班级、学习资料、班级通知、作业与成绩。',
    'tool.admin-teachers.title': '教师管理',
    'tool.admin-teachers.desc': '创建教师账号、分配班级并管理账号状态。',
    'tool.admin-announcements.title': '公告管理',
    'tool.admin-announcements.desc': '发布全校通知、班级通知或发送给指定教师。',
    'footer.schoolName': 'Trường Cao đẳng Việt Mỹ Hà Nội',
    'footer.tagline': '学习与教学辅助工具平台',
    'footer.col1': '学习与游戏',
    'footer.col2Staff': '教学与账号',
    'footer.col2Student': '实用与账号',
    'footer.games': '学习游戏',
    'footer.teacherSchedule': '个人课表',
    'footer.hskTower': 'HSK 1 爬塔闯关',
    'footer.suggestGame': '推荐新游戏',
    'footer.profile': '个人资料',
    'footer.appearance': '界面设置',
    'footer.manageAnn': '公告管理',
    'games.heading': '学习游戏 — 全部专业',
    'games.subtitle': '按专业选择学习游戏进入实时房间，或向校长推荐适合本专业的新游戏。',
    'games.suggestBtn': '为专业推荐游戏',
    'games.tabList': '游戏列表',
    'games.tabSuggestions': '各专业游戏建议',
    'games.enterLobby': '进入游戏大厅',
    'lang.changed': '已切换语言为',
    'lang.label': '选择语言',
    'pagination.nav': '分页',
    'pagination.prev': '上一页',
    'pagination.next': '下一页',
    'qr.copyLink': '复制链接',
    'qr.copied': '已复制',
    'sidebar.collapse': '收起侧边栏',
    'sidebar.expand': '展开侧边栏',
    'theme.light': '浅色',
    'theme.dark': '深色',
    'theme.toLight': '切换到浅色模式',
    'theme.toDark': '切换到深色模式',
  },
};

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
  roleLabel: (role: UserRole) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readInitialLang(): AppLanguage {
  if (typeof window === 'undefined') return 'vi';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'vi' || saved === 'en' || saved === 'zh') return saved;
  return 'vi';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(readInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  }, [lang]);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Bỏ qua khi storage bị hạn chế
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.vi[key] ?? fallback ?? key;
    },
    [lang]
  );

  const roleLabel = useCallback(
    (role: UserRole) => t(`role.${role}`, role),
    [t]
  );

  const value = useMemo(
    () => ({ lang, setLang, t, roleLabel }),
    [lang, setLang, t, roleLabel]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage phải được dùng bên trong LanguageProvider');
  }
  return ctx;
}


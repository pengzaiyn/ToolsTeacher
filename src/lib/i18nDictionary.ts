import type { AppLanguage } from '@/context/LanguageContext';

interface TranslationPair {
  en: string;
  zh: string;
}

const SCHOOL_NAME = 'Trường Cao đẳng Việt Mỹ Hà Nội';

/**
 * Từ điển dịch chuẩn cho toàn bộ giao diện APC Connect (VI -> EN / ZH).
 * Giữ nguyên tên chính thức "Trường Cao đẳng Việt Mỹ Hà Nội" trong mọi ngôn ngữ.
 */
export const PHRASE_DICT: Record<string, TranslationPair> = {
  // Điều hướng & Chung
  'Trang chủ': { en: 'Home', zh: '首页' },
  'Thời khóa biểu': { en: 'Timetable', zh: '课程表' },
  'Lớp học': { en: 'Classes', zh: '班级' },
  'Trò chơi': { en: 'Games', zh: '学习游戏' },
  'Trò chơi học tập': { en: 'Learning Games', zh: '学习游戏' },
  'Công cụ giảng dạy': { en: 'Teaching Tools', zh: '教学工具' },
  'Giáo viên': { en: 'Teachers', zh: '教师' },
  'Thông báo': { en: 'Announcements', zh: '通知公告' },
  'Cài đặt': { en: 'Settings', zh: '设置' },
  'Đăng xuất': { en: 'Sign out', zh: '退出登录' },
  'Đăng nhập': { en: 'Sign in', zh: '登录' },
  'Hiệu trưởng': { en: 'Principal', zh: '校长' },
  'Sinh viên': { en: 'Student', zh: '学生' },
  'Sáng': { en: 'Light', zh: '浅色' },
  'Tối': { en: 'Dark', zh: '深色' },
  'Quản trị': { en: 'Admin', zh: '管理' },
  'Mới': { en: 'New', zh: '新' },
  'Đứng lớp': { en: 'In-class', zh: '课堂' },
  'Đợt 2': { en: 'Phase 2', zh: '第二期' },

  // Nút & Hành động chung
  'Lưu': { en: 'Save', zh: '保存' },
  'Lưu thay đổi': { en: 'Save changes', zh: '保存更改' },
  'Hủy': { en: 'Cancel', zh: '取消' },
  'Đóng': { en: 'Close', zh: '关闭' },
  'Xác nhận': { en: 'Confirm', zh: '确认' },
  'Xóa': { en: 'Delete', zh: '删除' },
  'Chỉnh sửa': { en: 'Edit', zh: '编辑' },
  'Thêm mới': { en: 'Add new', zh: '新增' },
  'Tạo mới': { en: 'Create', zh: '创建' },
  'Tìm kiếm': { en: 'Search', zh: '搜索' },
  'Xóa lọc': { en: 'Clear filters', zh: '清除筛选' },
  'Xóa bộ lọc': { en: 'Clear filters', zh: '清除筛选' },
  'Làm mới': { en: 'Refresh', zh: '刷新' },
  'Quay lại': { en: 'Back', zh: '返回' },
  'Xem chi tiết': { en: 'View details', zh: '查看详情' },
  'Mở công cụ': { en: 'Open tool', zh: '打开工具' },
  'Tải xuống': { en: 'Download', zh: '下载' },
  'Tải lên': { en: 'Upload', zh: '上传' },
  'Xuất Excel': { en: 'Export Excel', zh: '导出 Excel' },
  'Xuất Word': { en: 'Export Word', zh: '导出 Word' },
  'Sao chép': { en: 'Copy', zh: '复制' },
  'Sao chép link': { en: 'Copy link', zh: '复制链接' },
  'Thu gọn': { en: 'Collapse', zh: '收起' },
  'Mở rộng': { en: 'Expand', zh: '展开' },
  'Tất cả': { en: 'All', zh: '全部' },
  'Đang hoạt động': { en: 'Active', zh: '活跃' },
  'Đã khóa': { en: 'Locked', zh: '已锁定' },
  'Trạng thái': { en: 'Status', zh: '状态' },
  'Thao tác': { en: 'Actions', zh: '操作' },
  'Họ và tên': { en: 'Full name', zh: '姓名' },
  'Email': { en: 'Email', zh: '邮箱' },
  'Email nhà trường': { en: 'School Email', zh: '学校邮箱' },
  'Mật khẩu': { en: 'Password', zh: '密码' },
  'Hiện mật khẩu': { en: 'Show password', zh: '显示密码' },
  'Ẩn mật khẩu': { en: 'Hide password', zh: '隐藏密码' },
  'Quên mật khẩu? Lấy mã qua email': {
    en: 'Forgot password? Get code via email',
    zh: '忘记密码？通过邮箱获取验证码',
  },
  'Mã sinh viên': { en: 'Student ID', zh: '学号' },
  'Ghi chú': { en: 'Notes', zh: '备注' },
  'Ngày tạo': { en: 'Created date', zh: '创建日期' },
  'Ẩn trang trí': { en: 'Hide decorations', zh: '隐藏装饰' },
  'Hiện trang trí': { en: 'Show decorations', zh: '显示装饰' },

  // Trang chủ & Thông báo
  'Danh sách công cụ': { en: 'Tools', zh: '工具列表' },
  'Thông báo nhà trường': { en: 'School Announcements', zh: '学校公告' },
  'Cập nhật mới nhất từ nhà trường': { en: 'Latest updates from the school', zh: '学校最新通知' },
  'Quản lý thông báo': { en: 'Manage announcements', zh: '公告管理' },
  'Quản lý & đăng thông báo': { en: 'Manage & post announcements', zh: '管理与发布公告' },
  'Đề xuất trò chơi mới gửi Hiệu trưởng': {
    en: 'New game suggestions for Principal',
    zh: '提交给校长的新游戏建议',
  },
  'Xem & duyệt đề xuất': { en: 'Review suggestions', zh: '查看并审核建议' },
  'Toàn trường': { en: 'School-wide', zh: '全校' },
  'Toàn bộ giáo viên': { en: 'All teachers', zh: '全体教师' },
  'Cảnh báo': { en: 'Warning', zh: '警告' },
  'Chưa có thông báo nào': { en: 'No announcements yet', zh: '暂无公告' },
  'Thông báo mới từ nhà trường sẽ xuất hiện tại đây.': {
    en: 'New school announcements will appear here.',
    zh: '学校最新通知将显示在此处。',
  },
  'Bạn có thắc mắc gì hãy hỏi AI APC': {
    en: 'Have a question? Ask AI APC',
    zh: '有疑问？问问 AI APC',
  },
  'Trợ lý APC Connect': {
    en: 'APC Connect Assistant',
    zh: 'APC Connect 助手',
  },

  // Thời khóa biểu
  'Tuần trước': { en: 'Previous week', zh: '上一周' },
  'Tuần này': { en: 'This week', zh: '本周' },
  'Tuần sau': { en: 'Next week', zh: '下一周' },
  'Tải thời khóa biểu Excel': { en: 'Upload Excel Timetable', zh: '上传 Excel 课程表' },
  'Nhập lịch học từ file Excel theo từng lớp hoặc tải file Excel mẫu.': {
    en: 'Import class schedules from Excel or download the template file.',
    zh: '按班级导入 Excel 课表或下载模板文件。',
  },
  'Chọn lớp học': { en: 'Select class', zh: '选择班级' },
  'Thứ 2': { en: 'Mon', zh: '周一' },
  'Thứ 3': { en: 'Tue', zh: '周二' },
  'Thứ 4': { en: 'Wed', zh: '周三' },
  'Thứ 5': { en: 'Thu', zh: '周四' },
  'Thứ 6': { en: 'Fri', zh: '周五' },
  'Thứ 7': { en: 'Sat', zh: '周六' },
  'Chủ nhật': { en: 'Sun', zh: '周日' },
  'Thứ Hai': { en: 'Monday', zh: '星期一' },
  'Thứ Ba': { en: 'Tuesday', zh: '星期二' },
  'Thứ Tư': { en: 'Wednesday', zh: '星期三' },
  'Thứ Năm': { en: 'Thursday', zh: '星期四' },
  'Thứ Sáu': { en: 'Friday', zh: '星期五' },
  'Thứ Bảy': { en: 'Saturday', zh: '星期六' },
  'Ca 1': { en: 'Shift 1', zh: '第1节' },
  'Ca 2': { en: 'Shift 2', zh: '第2节' },
  'Ca 3': { en: 'Shift 3', zh: '第3节' },
  'Ca 4': { en: 'Shift 4', zh: '第4节' },
  'Ca 5': { en: 'Shift 5', zh: '第5节' },
  'Phòng học': { en: 'Room', zh: '教室' },
  'Môn học': { en: 'Subject', zh: '科目' },
  'Giảng viên': { en: 'Instructor', zh: '教师' },
  'Chưa có lịch học trong tuần này': { en: 'No classes scheduled this week', zh: '本周暂无课程安排' },

  // Lớp học & Chi tiết lớp
  'Danh sách lớp học': { en: 'Class List', zh: '班级列表' },
  'Tạo lớp mới': { en: 'Create class', zh: '创建班级' },
  'Tạo lớp học': { en: 'Create class', zh: '创建班级' },
  'Quản lý lớp học, tài liệu học tập, thông báo lớp, bài tập và chấm điểm.': {
    en: 'Manage classes, study materials, class announcements, assignments, and grades.',
    zh: '管理班级、学习资料、班级通知、作业与成绩。',
  },
  'Tài liệu': { en: 'Materials', zh: '学习资料' },
  'Bài tập': { en: 'Assignments', zh: '作业' },
  'Điểm danh': { en: 'Attendance', zh: '考勤' },
  'Bảng điểm': { en: 'Grades', zh: '成绩表' },
  'Thành viên': { en: 'Members', zh: '成员' },
  'Giáo viên chủ nhiệm': { en: 'Homeroom teacher', zh: '班主任' },
  'Giáo viên bộ môn': { en: 'Subject teachers', zh: '任课教师' },
  'Danh sách sinh viên': { en: 'Student roster', zh: '学生名单' },
  'Nhập sinh viên': { en: 'Import students', zh: '导入学生' },
  'Thêm sinh viên': { en: 'Add student', zh: '添加学生' },
  'Đăng thông báo': { en: 'Post announcement', zh: '发布通知' },
  'Tải tài liệu lên': { en: 'Upload material', zh: '上传资料' },
  'Giao bài tập': { en: 'Create assignment', zh: '布置作业' },
  'Nộp bài': { en: 'Submit', zh: '提交作业' },
  'Chấm điểm': { en: 'Grade', zh: '评分' },
  'Có mặt': { en: 'Present', zh: '出勤' },
  'Muộn': { en: 'Late', zh: '迟到' },
  'Vắng': { en: 'Absent', zh: '缺勤' },
  'Có phép': { en: 'Excused', zh: '请假' },

  // Công cụ giảng dạy
  'Công cụ đang hoạt động': { en: 'Active Tools', zh: '可用工具' },
  'Mở bộ điều phối lớp': { en: 'Open Classroom Kit', zh: '打开课堂工具箱' },
  'Tìm nhanh công cụ...': { en: 'Quick search tools...', zh: '快速搜索工具...' },
  'Lịch dạy cá nhân': { en: 'Personal Teaching Schedule', zh: '个人教学课表' },
  'Xem lịch giảng dạy hôm nay và theo tuần, tổng hợp số tiết và xuất file Excel.': {
    en: 'View today & weekly teaching schedule, summarize periods and export Excel.',
    zh: '查看今日及每周课表、统计课时并导出 Excel。',
  },
  'Điểm danh theo buổi': { en: 'Session Attendance', zh: '课堂考勤' },
  'Tích nhanh chuyên cần sinh viên theo buổi học, cảnh báo vắng quá ngưỡng và xuất Excel.': {
    en: 'Quickly mark student attendance per session, flag high absences and export Excel.',
    zh: '按课时快速记录考勤、预警缺勤超标并导出 Excel。',
  },
  'Sổ điểm tổng hợp Excel': { en: 'Excel Summary Gradebook', zh: '综合成绩册 Excel' },
  'Gom điểm bài tập và chuyên cần theo trọng số, tự xếp loại và xuất sổ điểm hoàn chỉnh.': {
    en: 'Combine weighted assignment & attendance scores, auto-classify and export Excel.',
    zh: '按权重汇总作业与考勤成绩、自动分级并导出完整成绩册。',
  },
  'Trộn đề thi trắc nghiệm': { en: 'Multiple-Choice Exam Mixer', zh: '选择题试卷混排工具' },
  'Nhập câu hỏi từ văn bản hoặc Excel, đảo thứ tự câu và đáp án thành nhiều mã đề, xuất Word A4 và Excel đáp án.': {
    en: 'Import questions from text or Excel, shuffle into multiple exam codes, export Word A4 & answer key.',
    zh: '从文本或 Excel 导入试题，打乱题序与选项生成多套试卷，导出 Word A4 及 Excel 答案。',
  },
  'Mini game trả bài': { en: 'Quick Quiz Mini-Game', zh: '课堂抽查小游戏' },
  'Vòng quay may mắn và lật thẻ bí ẩn gọi tên sinh viên trả bài kèm bảng kết quả.': {
    en: 'Lucky wheel and mystery card flip to pick students for oral quizzes with scoreboard.',
    zh: '幸运转盘与神秘翻牌随机点名抽查，附带成绩榜。',
  },
  'Chia nhóm ngẫu nhiên': { en: 'Random Team Builder', zh: '随机分组' },
  'Chia đều danh sách sinh viên theo số nhóm hoặc sĩ số, sao chép và xuất Excel.': {
    en: 'Evenly split student rosters by group count or size, copy and export Excel.',
    zh: '按组数或人数均匀分组，支持复制和导出 Excel。',
  },
  'Đồng hồ bấm giờ lớp học': { en: 'Classroom Timer', zh: '课堂计时器' },
  'Đếm ngược thời gian thảo luận, làm bài hoặc thuyết trình với chế độ chiếu toàn màn hình.': {
    en: 'Countdown timer for discussions, exercises, or presentations with fullscreen mode.',
    zh: '用于讨论、测验或演讲的倒计时器，支持全屏投影模式。',
  },

  // Trung tâm Trò chơi & Leo Tháp HSK 1
  'Trò chơi học tập — Tất cả các ngành': {
    en: 'Learning Games — All Majors',
    zh: '学习游戏 — 全部专业',
  },
  'Chọn trò chơi theo ngành học để vào sảnh phòng thi đấu, hoặc gửi đề xuất trò chơi mới cho ngành của bạn tới Hiệu trưởng.': {
    en: 'Pick a game by major to join live rooms, or suggest a new learning game for your major to the Principal.',
    zh: '按专业选择学习游戏进入实时房间，或向校长推荐适合本专业的新游戏。',
  },
  'Đề xuất trò chơi cho ngành': { en: 'Suggest a game for major', zh: '为专业推荐游戏' },
  'Danh sách trò chơi': { en: 'Game List', zh: '游戏列表' },
  'Vào sảnh trò chơi': { en: 'Enter game lobby', zh: '进入游戏大厅' },
  'Leo Tháp HSK 1': { en: 'HSK 1 Tower Climb', zh: 'HSK 1 爬塔闯关' },
  'Leo Tháp HSK 1 — Tiếng Trung': { en: 'HSK 1 Tower Climb — Chinese', zh: 'HSK 1 爬塔闯关 — 中文' },
  'Tiếng Trung': { en: 'Chinese', zh: '中文' },
  'Đang mở': { en: 'Live', zh: '开放中' },
  'Tối đa 5 người / phòng': { en: 'Max 5 players / room', zh: '最多 5 人 / 间' },
  'Ngành của bạn chưa có trò chơi?': {
    en: 'No game for your major yet?',
    zh: '你的专业还没有专属游戏？',
  },
  'Nhấn vào đây để gửi đề xuất ý tưởng trò chơi trực tiếp tới Hiệu trưởng!': {
    en: 'Click here to submit your game idea directly to the Principal!',
    zh: '点击这里直接向校长提交你的游戏创意！',
  },
  'Tạo phòng thi đấu': { en: 'Create Match Room', zh: '创建比赛房间' },
  'Vào phòng': { en: 'Join Room', zh: '进入房间' },
  'Rời phòng': { en: 'Leave Room', zh: '离开房间' },
  'Về sảnh phòng': { en: 'Back to Lobby', zh: '返回大厅' },
  'Bắt đầu thi đấu': { en: 'Start Match', zh: '开始比赛' },
  'Kết thúc trận': { en: 'End Match', zh: '结束比赛' },
  'Đang mở tranh suất': { en: 'Open for slots', zh: '抢位中' },
  'Đang thi đấu': { en: 'In progress', zh: '比赛中' },
  'Đã kết thúc': { en: 'Finished', zh: '已结束' },
  'Xem bục vinh danh': { en: 'View Podium', zh: '查看领奖台' },
  'Xem trực tiếp': { en: 'Watch Live', zh: '观战' },
  'Nhân vật:': { en: 'Character:', zh: '角色：' },
  'Chọn nhân vật đại diện của bạn:': { en: 'Choose your avatar:', zh: '选择你的代表角色：' },
  'Gấu Trúc': { en: 'Panda', zh: '熊猫' },
  'Mèo Thần Tài': { en: 'Lucky Cat', zh: '招财猫' },
  'Rồng Con': { en: 'Little Dragon', zh: '小龙' },
  'Hổ Con': { en: 'Tiger Cub', zh: '小虎' },
  'Thỏ Ngọc': { en: 'Jade Rabbit', zh: '玉兔' },
  'Quét mã QR để tranh suất vào phòng': {
    en: 'Scan QR code to grab a slot',
    zh: '扫描二维码抢位进入房间',
  },
  'Phóng to QR (chiếu bảng)': { en: 'Enlarge QR (Projector)', zh: '放大二维码（投影）' },
  'Bầu phiếu chế độ gõ HSK 1': { en: 'Vote HSK 1 Typing Mode', zh: '投票选择 HSK 1 输入模式' },
  'Thí sinh và giáo viên cùng bầu chọn chế độ thi đấu (không dùng trắc nghiệm).': {
    en: 'Students and teachers vote together on the typing mode (no multiple choice).',
    zh: '师生共同投票选择比赛输入模式（非选择题）。',
  },
  'Gõ Pinyin': { en: 'Type Pinyin', zh: '输入拼音' },
  'Gõ Chữ Hán': { en: 'Type Hanzi', zh: '输入汉字' },
  'Tháp Đèn Lồng': { en: 'Lantern Tower', zh: '灯笼宝塔' },
  'Cột Tre Trúc': { en: 'Bamboo Pillar', zh: '青竹翠柱' },
  'Vạn Lý Trường Thành': { en: 'Great Wall', zh: '万里长城' },
  'Leo nấc': { en: 'Climb', zh: '攀登' },
  'Tranh suất vào chơi ngay!': { en: 'Grab a slot now!', zh: '立即抢位参赛！' },
  'Chưa bầu phiếu': { en: 'Not voted', zh: '未投票' },
  'Bầu: Pinyin': { en: 'Voted: Pinyin', zh: '已投：拼音' },
  'Bầu: Chữ Hán': { en: 'Voted: Hanzi', zh: '已投：汉字' },
  'Chờ Hiệu trưởng xem': { en: 'Pending Principal review', zh: '等待校长审阅' },
  'Đang xem xét': { en: 'Reviewing', zh: '审核中' },
  'Đã lên kế hoạch': { en: 'Planned', zh: '已列入计划' },
  'Đã triển khai': { en: 'Launched', zh: '已上线' },
  'Hiệu trưởng duyệt:': { en: 'Principal review:', zh: '校长审批：' },
  'Hiện chưa có phòng nào đang mở': { en: 'No open rooms right now', zh: '当前暂无开放的房间' },
  'Chưa có phòng nào đã kết thúc': { en: 'No finished rooms yet', zh: '暂无已结束的房间' },
  'Tạo phòng Leo Tháp HSK 1': { en: 'Create HSK 1 Tower Room', zh: '创建 HSK 1 爬塔房间' },
  'Mở phòng ngay': { en: 'Open Room Now', zh: '立即开启房间' },
  'Đề xuất trò chơi học tập cho ngành của bạn': {
    en: 'Suggest a learning game for your major',
    zh: '为你的专业推荐学习游戏',
  },
  'Gửi tới Hiệu trưởng': { en: 'Send to Principal', zh: '发送给校长' },
  'Gửi đề xuất ngay': { en: 'Submit suggestion', zh: '立即提交建议' },
  'Tranh suất vào phòng, bầu phiếu chọn chế độ gõ Pinyin / Chữ Hán và đua leo đỉnh tháp nhận điểm thưởng!': {
    en: 'Compete for a slot, vote Pinyin / Hanzi typing mode, and race to the top of the tower for bonus points!',
    zh: '抢位进房，投票选择拼音/汉字模式，竞速爬塔赢取奖励分！',
  },

  // Quản lý Giáo viên & Thông báo (Admin)
  'Quản lý giáo viên': { en: 'Teacher Management', zh: '教师管理' },
  'Tạo tài khoản giảng viên, cập nhật chủ nhiệm môn và quản lý trạng thái.': {
    en: 'Create teacher accounts, assign classes, and manage account status.',
    zh: '创建教师账号、分配班级并管理账号状态。',
  },
  'Đăng thông báo toàn trường, gửi riêng từng lớp học hoặc gửi riêng cho giáo viên.': {
    en: 'Publish school-wide, class-specific, or teacher-targeted announcements.',
    zh: '发布全校通知、班级通知或发送给指定教师。',
  },
  'Theo giáo viên': { en: 'By Teacher', zh: '按教师查看' },
  'Phân công theo lớp': { en: 'Class Assignments', zh: '按班级分配' },
  'Thêm giáo viên': { en: 'Add Teacher', zh: '添加教师' },
  'Phân công lớp': { en: 'Assign Classes', zh: '分配班级' },
  'Đăng thông báo mới': { en: 'Post New Announcement', zh: '发布新公告' },

  // Hồ sơ & Cài đặt
  'Hồ sơ cá nhân': { en: 'My Profile', zh: '个人资料' },
  'Cài đặt giao diện': { en: 'Appearance Settings', zh: '界面设置' },
  'Chế độ Sáng / Tối': { en: 'Light / Dark Mode', zh: '浅色 / 深色模式' },
  'Chủ đề tùy chỉnh': { en: 'Custom Theme', zh: '自定义主题' },
  'Chủ đề tùy chỉnh cá nhân': { en: 'Personal Custom Theme', zh: '个人自定义主题' },
  'Bộ phối sẵn': { en: 'Preset Packs', zh: '预设主题' },
  'Bộ chủ đề phối sẵn': { en: 'Preset Theme Packs', zh: '预设主题包' },
  'Bảng màu nhấn': { en: 'Accent Colors', zh: '强调色板' },
  'Ảnh nền': { en: 'Wallpaper', zh: '背景壁纸' },
  'Hiệu ứng con trỏ chuột': { en: 'Cursor Effects', zh: '鼠标指针特效' },
  'Khôi phục mặc định': { en: 'Reset to default', zh: '恢复默认' },
  'Đổi mật khẩu': { en: 'Change Password', zh: '修改密码' },
  'Thông tin tài khoản': { en: 'Account Information', zh: '账号信息' },
  'Giao diện': { en: 'Theme', zh: '主题' },
  'Hình nền': { en: 'Wallpaper', zh: '背景壁纸' },
  'Hiệu ứng con trỏ': { en: 'Cursor Effects', zh: '鼠标特效' },
  'Chế độ kính': { en: 'Glass Mode', zh: '玻璃质感' },
  'Mặc định': { en: 'Default', zh: '默认' },
  'Kính mờ': { en: 'Frosted Glass', zh: '磨砂玻璃' },
  'Kính lỏng': { en: 'Liquid Glass', zh: '液态玻璃' },

  // Placeholder phổ biến
  'Tìm theo tên phòng, mã phòng, tên ngành hoặc chủ đề...': {
    en: 'Search by room name, code, major, or topic...',
    zh: '按房间名、房间码、专业或主题搜索...',
  },
  'Tìm trò chơi theo tên trò chơi hoặc tên ngành học (VD: Tiếng Trung, HSK)...': {
    en: 'Search games by title or major (e.g., Chinese, HSK)...',
    zh: '按游戏名称或专业搜索（如：中文、HSK）...',
  },
  'Tìm đề xuất theo tên ngành học, tên trò chơi hoặc người đề xuất...': {
    en: 'Search suggestions by major, game title, or author...',
    zh: '按专业、游戏名称或提交人搜索建议...',
  },
  'Nhập mã phòng (VD: HSK82) để tranh suất nhanh...': {
    en: 'Enter room code (e.g., HSK82) to join quickly...',
    zh: '输入房间码（如 HSK82）快速抢位...',
  },

  // Đăng nhập (#062)
  'Caps Lock đang bật': { en: 'Caps Lock is on', zh: '大写锁定已开启' },
  'Chào mừng trở lại': { en: 'Welcome back', zh: '欢迎回来' },
  'Đang chuyển vào hệ thống...': { en: 'Entering workspace...', zh: '正在进入系统...' },
  'Nhập email nhà trường': { en: 'Enter school email', zh: '请输入学校邮箱' },
  'Nhập mật khẩu': { en: 'Enter password', zh: '请输入密码' },
  'Đăng nhập thành công': { en: 'Signed in', zh: '登录成功' },
  'Vào trang chủ': { en: 'Enter Home', zh: '进入首页' },
  'Ảnh đại diện': { en: 'Profile Avatar', zh: '个人头像' },
  'Chọn ảnh đại diện': { en: 'Choose Avatar', zh: '选择头像' },
  'Dùng mặc định': { en: 'Use Default', zh: '恢复默认' },
  'Tùy chọn — không bắt buộc. Nếu chưa đặt, hệ thống dùng logo mặc định của trường.': {
    en: 'Optional — if not set, the default school logo will be displayed.',
    zh: '可选 — 如未设置，系统将默认显示学校徽标。',
  },
  'Đã cập nhật ảnh đại diện': { en: 'Avatar updated', zh: '头像已更新' },
  'Đã khôi phục ảnh đại diện mặc định': { en: 'Restored default avatar', zh: '已恢复默认头像' },
  'Đổi ảnh': { en: 'Change Photo', zh: '更换头像' },
  'Chọn ảnh': { en: 'Upload Photo', zh: '上传头像' },
  'Đổi ảnh đại diện': { en: 'Change Avatar', zh: '更换头像' },
  'Ảnh đại diện tùy chọn — mặc định dùng logo trường.': {
    en: 'Optional avatar — defaults to the school logo.',
    zh: '可选头像 — 默认使用学校徽标。',
  },

  // Trạng thái buổi học thời gian thực
  'Đang học': { en: 'In Progress', zh: '上课中' },
  'Chưa học': { en: 'Upcoming', zh: '未开始' },
  'Đã học': { en: 'Completed', zh: '已结束' },

  // Trộn đề & chọn số bản in
  'Đảo lại thứ tự câu': { en: 'Reshuffle Questions', zh: '重新打乱题序' },
  'Chọn số bản in cho từng mã đề': { en: 'Set Print Copies per Exam Code', zh: '设置各试卷代码打印份数' },
  'Chia nhanh theo tổng sĩ số lớp': { en: 'Quick split by class size', zh: '按班级总人数快速均分' },
  'Kèm 1 trang bảng đáp án tổng hợp ở cuối file': {
    en: 'Append 1 summary answer key page at the end',
    zh: '在文件末尾附 1 页综合答案表',
  },

  // Hồ sơ sinh viên & đồng bộ CIS
  'Đồng bộ CIS': { en: 'Sync CIS', zh: '同步 CIS' },
  'Đồng bộ hồ sơ & xếp lớp từ CIS': {
    en: 'Sync Student Profiles & Classes from CIS',
    zh: '从 CIS 同步学生档案与分班',
  },
  'Hồ sơ sinh viên': { en: 'Student Profile', zh: '学生档案' },
  'Hồ sơ': { en: 'Profile', zh: '档案' },
  'Số điện thoại': { en: 'Phone Number', zh: '手机号码' },
  'Số CCCD': { en: 'ID Card (CCCD)', zh: '身份证号' },
  'Ngày cấp CCCD': { en: 'ID Issue Date', zh: '签发日期' },
  'Nơi sinh': { en: 'Place of Birth', zh: '出生地' },
  'Khóa học': { en: 'Cohort', zh: '年级/届别' },
  'Khoa': { en: 'Faculty', zh: '院系' },
  'Ngành học': { en: 'Major', zh: '专业' },
  'Kiểm tra kết nối': { en: 'Check Connection', zh: '检测连接' },
  'Đồng bộ mới nhất (tăng dần)': { en: 'Incremental Sync', zh: '增量同步' },
  'Đồng bộ toàn bộ & xếp lớp': { en: 'Full Sync & Assign Classes', zh: '全量同步并分班' },
  'Cập nhật 1 SV': { en: 'Sync 1 Student', zh: '同步单个学生' },
  'Đọc từ CIS': { en: 'Read from CIS', zh: '从 CIS 读取' },
  'SV đã cập nhật': { en: 'Updated Students', zh: '已更新学生' },
  'Lớp tạo mới': { en: 'New Classes', zh: '新建班级' },
  'SV tạo mới': { en: 'New Students', zh: '新建学生' },
  'Email đăng nhập': { en: 'Login Email', zh: '登录邮箱' },
  'Khóa / Ngành': { en: 'Cohort / Major', zh: '年级 / 专业' },
  'Hiện SĐT': { en: 'Show Phone', zh: '显示手机号' },
  'Ẩn SĐT': { en: 'Hide Phone', zh: '隐藏手机号' },
  'Hiện CCCD': { en: 'Show ID Card', zh: '显示身份证号' },
  'Ẩn CCCD': { en: 'Hide ID Card', zh: '隐藏身份证号' },
  'Hiện số': { en: 'Show', zh: '显示' },
  'Ẩn số': { en: 'Hide', zh: '隐藏' },
  'Danh sách bạn cùng lớp': { en: 'Classmates', zh: '同班同学名单' },
  'Tìm bạn cùng lớp theo tên hoặc mã SV...': { en: 'Search classmates by name or student ID...', zh: '按姓名或学号搜索同学...' },
  'Bạn': { en: 'You', zh: '本人' },
  'Quét QR điểm danh': { en: 'Scan Attendance QR', zh: '扫码签到' },
  'Mở camera điện thoại quét mã QR động 15 giây trên màn hình máy chiếu để điểm danh nhanh.': {
    en: 'Scan the 15-second rotating QR code on the projector screen with your phone camera to check in quickly.',
    zh: '使用手机摄像头扫描投影屏幕上的 15 秒动态二维码快速签到。',
  },
  'Mở QR điểm danh': { en: 'Open Attendance QR', zh: '打开签到二维码' },
  'Bắt đầu điểm danh': { en: 'Start Attendance', zh: '开始签到' },
  'Kết thúc điểm danh': { en: 'End Attendance', zh: '结束签到' },
  'Đổi mã ngay': { en: 'Rotate Now', zh: '立即换码' },
  'Đã điểm danh (Realtime)': { en: 'Checked In (Realtime)', zh: '已签到（实时）' },
  'Chưa có sinh viên nào quét mã': { en: 'No students have scanned yet', zh: '暂无学生扫码' },
  'Mở Camera quét mã': { en: 'Open Camera to Scan', zh: '打开摄像头扫码' },
  'Tắt Camera': { en: 'Turn Off Camera', zh: '关闭摄像头' },
  'Quét buổi học khác': { en: 'Scan Another Session', zh: '扫描其他课时' },
  'Quét lại mã mới trên bảng': { en: 'Rescan New Code on Board', zh: '重新扫描屏幕新码' },
  'Sao chép link QR': { en: 'Copy QR Link', zh: '复制二维码链接' },
  'Hoặc dán link / mã QR để điểm danh (dùng khi test trên máy tính)': {
    en: 'Or paste QR link / token to check in (for desktop testing)',
    zh: '或粘贴二维码链接/代码签到（用于电脑测试）',
  },
  'Xác nhận mã': { en: 'Verify Code', zh: '确认签到码' },
  'Điều kiện dự thi': { en: 'Exam Eligibility', zh: '考试资格' },
  'Đủ điều kiện thi': { en: 'Eligible for Exam', zh: '符合考试资格' },
  'Cấm thi': { en: 'Banned from Exam', zh: '禁止参加考试' },
  'Xuất Excel (Đủ ĐK & Cấm thi)': {
    en: 'Export Excel (Eligible & Banned)',
    zh: '导出 Excel（合格与禁考名单）',
  },
  'Hỗ trợ phóng to Camera từ 1x đến 5x để quét dễ dàng từ cuối lớp học.': {
    en: 'Supports 1x to 5x camera zoom for easy scanning from the back of the classroom.',
    zh: '支持 1x 至 5x 摄像头缩放，坐在教室后排也能轻松扫码。',
  },
  'Hướng camera điện thoại lên màn hình máy chiếu của giảng viên': {
    en: "Point your phone camera at the instructor's projector screen",
    zh: '将手机摄像头对准教师的投影屏幕',
  },
  'Đã hết hạn': { en: 'Past Due', zh: '已截止' },
  'Đã hết hạn nộp': { en: 'Past Due', zh: '已过提交时间' },
  'Xem / Sửa bài nộp': { en: 'View / Edit Submission', zh: '查看 / 修改作业' },
  'Chỉnh sửa & Nộp lại': { en: 'Edit & Resubmit', zh: '修改并重新提交' },
  'Lưu & Nộp lại': { en: 'Save & Resubmit', zh: '保存并重新提交' },
  'Hủy bài nộp': { en: 'Cancel Submission', zh: '撤回作业' },
  'Xem file cũ': { en: 'View Current File', zh: '查看当前文件' },
  'Xác nhận nộp lại': { en: 'Confirm Resubmit', zh: '确认重新提交' },
  'Xác nhận nộp lại bài': { en: 'Confirm Resubmission', zh: '确认重新提交作业' },
  'Xác nhận hủy bài nộp': { en: 'Confirm Cancel Submission', zh: '确认撤回并删除' },
  'Hủy và xóa bài đã nộp': { en: 'Cancel & Delete Submission', zh: '撤回并删除已交作业' },
  'Còn trong thời gian nộp bài — bạn vẫn có thể chỉnh sửa nộp lại hoặc hủy bài đã nộp.': {
    en: 'Submission window is still open — you can edit & resubmit or cancel your submission.',
    zh: '仍在提交时间内 — 您仍可修改重交或撤回已提交的作业。',
  },
  'Đã hết thời gian nộp bài — không thể chỉnh sửa hoặc hủy bài nộp.': {
    en: 'Submission deadline has passed — editing or canceling is locked.',
    zh: '已过提交截止时间 — 无法修改或撤回作业。',
  },
  'Đã hết thời gian nộp bài mà giảng viên cài đặt. Bạn không thể nộp bài mới.': {
    en: 'The instructor-set deadline has passed. New submissions are closed.',
    zh: '教师设置的截止时间已过，无法继续提交作业。',
  },
  'Bạn vẫn có thể chỉnh sửa, nộp lại hoặc hủy bài nộp trước thời hạn giảng viên cài đặt. Khi hết hạn, bài làm sẽ được khóa. Bạn chắc chắn muốn nộp?': {
    en: 'You can still edit, resubmit, or cancel your work before the instructor-set deadline. Once expired, it will be locked. Submit now?',
    zh: '在教师设置的截止时间前，您仍可修改、重交或撤回作业；截止后将锁定。确认提交吗？',
  },
  'Sau khi nộp, bạn vẫn có thể chỉnh sửa, nộp lại hoặc hủy bài nộp bất cứ lúc nào. Bạn chắc chắn muốn nộp?': {
    en: 'After submitting, you can still edit, resubmit, or cancel your submission anytime. Submit now?',
    zh: '提交后您仍可随时修改、重交或撤回作业。确认提交吗？',
  },
  'Bài nộp hiện tại của bạn sẽ bị xóa để bạn có thể làm lại từ đầu (chỉ thực hiện được khi còn thời hạn nộp bài). Bạn chắc chắn muốn hủy bài nộp?': {
    en: 'Your current submission will be deleted so you can start over (only allowed before the deadline). Cancel submission?',
    zh: '当前提交的作业将被删除以便重新作答（仅限截止时间前）。确认撤回作业吗？',
  },
  'Hình thức làm bài': { en: 'Work Mode', zh: '作业形式' },
  'Làm cá nhân': { en: 'Individual Work', zh: '个人作业' },
  'Làm theo nhóm': { en: 'Group Work', zh: '小组作业' },
  'Giao bài tập cá nhân hoặc bài tập nhóm cho sinh viên trong lớp.': {
    en: 'Assign individual or group coursework to students in the class.',
    zh: '为班级学生布置个人或小组作业。',
  },
  'Ảnh bài làm': { en: 'Work Image', zh: '作业图片' },
  'Xem ảnh cũ': { en: 'View Current Image', zh: '查看当前图片' },
  'Mở ảnh kích thước gốc': { en: 'Open Full-Size Image', zh: '打开原图查看' },
  'Tối đa 25 MB · Hỗ trợ ảnh JPG, PNG, WEBP, HEIC...': {
    en: 'Max 25 MB · Supports JPG, PNG, WEBP, HEIC images...',
    zh: '最大 25 MB · 支持 JPG、PNG、WEBP、HEIC 等图片...',
  },
  'Thành viên nhóm / Ghi chú thêm (tùy chọn)': {
    en: 'Group Members / Additional Note (optional)',
    zh: '小组成员 / 附加说明（可选）',
  },
  'Ghi họ tên / MSV các thành viên trong nhóm hoặc lời nhắn gửi giáo viên...': {
    en: 'List group members (Full name / Student ID) or leave a note for the instructor...',
    zh: '填写小组成员姓名/学号或给教师的留言...',
  },
  'Vui lòng tải lên ảnh bài làm để nộp': {
    en: 'Please upload an image of your work to submit',
    zh: '请上传作业图片后再提交',
  },
  'Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP, HEIC...)': {
    en: 'Please select an image file only (JPG, PNG, WEBP, HEIC...)',
    zh: '请仅选择图片文件（JPG、PNG、WEBP、HEIC...）',
  },
  'Ảnh nộp vượt quá giới hạn 25 MB': {
    en: 'Uploaded image exceeds the 25 MB limit',
    zh: '上传的图片超过 25 MB 限制',
  },
  'Theo số nhóm': { en: 'By Group Count', zh: '按小组数量' },
  'Theo số SV / nhóm': { en: 'By Group Size', zh: '按每组人数' },
  'Số nhóm muốn chia': { en: 'Number of Groups', zh: '分组数量' },
  'Số SV mỗi nhóm': { en: 'Students per Group', zh: '每组学生数' },
  'Chia nhóm ngay': { en: 'Split Groups Now', zh: '立即分组' },
  'Xáo trộn chia lại': { en: 'Shuffle & Resplit', zh: '重新随机分组' },
  'Chọn random trưởng nhóm': { en: 'Randomize Group Leaders', zh: '随机指定组长' },
  'Trưởng nhóm': { en: 'Group Leader', zh: '组长' },
  'Nộp bài nhóm': { en: 'Submit for Group', zh: '提交小组作业' },
  'Nộp bài cho nhóm': { en: 'Submit Group Work', zh: '提交小组作业' },
  'Xem bài nhóm': { en: 'View Group Work', zh: '查看小组作业' },
  'Xem / Sửa bài nhóm': { en: 'View / Edit Group Work', zh: '查看 / 修改小组作业' },
  'Ảnh bài làm của nhóm': { en: 'Group Work Image', zh: '小组作业图片' },
  'Bạn là Trưởng nhóm (Đại diện nộp bài)': {
    en: 'You are the Group Leader (Submitter)',
    zh: '您是组长（代表小组提交）',
  },
  'Bạn là Thành viên (Không phải nộp riêng)': {
    en: 'You are a Member (No separate submission needed)',
    zh: '您是组员（无需单独提交）',
  },
  'Các thành viên trong nhóm không cần nộp bài riêng. Ngay khi Trưởng nhóm tải ảnh bài làm lên, bạn có thể xem bài nộp và điểm số của nhóm tại đây.': {
    en: 'Group members do not need to submit separately. Once the Group Leader uploads the work image, you can view the submission and your score here.',
    zh: '小组成员无需单独提交。组长上传作业图片后，您可在此查看提交内容与成绩。',
  },
  'Mặc định: Cả nhóm nhận bằng điểm Trưởng nhóm': {
    en: 'Default: All members receive the Group Leader score',
    zh: '默认：全组与组长同分',
  },
  'Đang nhập điểm riêng từng thành viên': {
    en: 'Customizing individual member scores',
    zh: '正在单独设置各成员分数',
  },
  'Chấm riêng từng bạn': { en: 'Score Per Member', zh: '按成员单独打分' },
  'Dùng chung điểm nhóm': { en: 'Use Same Group Score', zh: '恢复全组同分' },
  'Chọn một nhóm ở danh sách bên trái để xem bài nộp và chấm điểm.': {
    en: 'Select a group on the left to view its submission and grade.',
    zh: '请在左侧选择一个小组以查看作业并评分。',
  },
  'Tìm sinh viên theo tên hoặc mã SV...': {
    en: 'Search students by name or student ID...',
    zh: '按姓名或学号搜索学生...',
  },
  'Không tìm thấy sinh viên phù hợp': {
    en: 'No matching students found',
    zh: '未找到匹配的学生',
  },
};

interface PatternRule {
  regex: RegExp;
  en: (...args: string[]) => string;
  zh: (...args: string[]) => string;
}

const PATTERN_RULES: PatternRule[] = [
  {
    regex: /^Phòng đang mở \((\d+)\)$/,
    en: (_, n) => `Open Rooms (${n})`,
    zh: (_, n) => `开放中的房间 (${n})`,
  },
  {
    regex: /^Phòng đã kết thúc \((\d+)\)$/,
    en: (_, n) => `Finished Rooms (${n})`,
    zh: (_, n) => `已结束的房间 (${n})`,
  },
  {
    regex: /^Danh sách trò chơi \((.+)\)$/,
    en: (_, n) => `Game List (${n})`,
    zh: (_, n) => `游戏列表 (${n})`,
  },
  {
    regex: /^Đề xuất trò chơi các ngành \((.+)\)$/,
    en: (_, n) => `Major Suggestions (${n})`,
    zh: (_, n) => `各专业游戏建议 (${n})`,
  },
  {
    regex: /^Danh sách tranh suất \((\d+\/\d+)\)$/,
    en: (_, n) => `Slot Roster (${n})`,
    zh: (_, n) => `参赛席位 (${n})`,
  },
  {
    regex: /^Tranh suất \((\d+\/\d+)\)$/,
    en: (_, n) => `Grab Slot (${n})`,
    zh: (_, n) => `抢位 (${n})`,
  },
  {
    regex: /^Suất #(\d+) trống$/,
    en: (_, n) => `Slot #${n} open`,
    zh: (_, n) => `空位 #${n}`,
  },
  {
    regex: /^Mã phòng: (.+)$/,
    en: (_, code) => `Room: ${code}`,
    zh: (_, code) => `房间码：${code}`,
  },
  {
    regex: /^(\d+\/\d+) thí sinh$/,
    en: (_, n) => `${n} players`,
    zh: (_, n) => `${n} 位选手`,
  },
  {
    regex: /^(\d+) công cụ$/,
    en: (_, n) => `${n} tools`,
    zh: (_, n) => `${n} 个工具`,
  },
  {
    regex: /^(\d+) trò chơi$/,
    en: (_, n) => `${n} games`,
    zh: (_, n) => `${n} 款游戏`,
  },
  {
    regex: /^(\d+) phòng đang mở$/,
    en: (_, n) => `${n} open rooms`,
    zh: (_, n) => `${n} 个开放房间`,
  },
  {
    regex: /^(\d+) phòng đã tạo$/,
    en: (_, n) => `${n} rooms created`,
    zh: (_, n) => `已创建 ${n} 个房间`,
  },
  {
    regex: /^Xem (\d+) phòng đã kết thúc$/,
    en: (_, n) => `View ${n} finished rooms`,
    zh: (_, n) => `查看 ${n} 个已结束房间`,
  },
  {
    regex: /^(\d+) tin mới$/,
    en: (_, n) => `${n} new`,
    zh: (_, n) => `${n} 条新通知`,
  },
  {
    regex: /^(\d+) chờ duyệt$/,
    en: (_, n) => `${n} pending`,
    zh: (_, n) => `${n} 条待审核`,
  },
  {
    regex: /^(\d+) phiếu$/,
    en: (_, n) => `${n} votes`,
    zh: (_, n) => `${n} 票`,
  },
  {
    regex: /^(\d+) nấc$/,
    en: (_, n) => `${n} steps`,
    zh: (_, n) => `${n} 阶`,
  },
  {
    regex: /^(\d+) lớp$/,
    en: (_, n) => `${n} classes`,
    zh: (_, n) => `${n} 个班级`,
  },
  {
    regex: /^(\d+) sinh viên$/,
    en: (_, n) => `${n} students`,
    zh: (_, n) => `${n} 名学生`,
  },
  {
    regex: /^(\d+) giáo viên$/,
    en: (_, n) => `${n} teachers`,
    zh: (_, n) => `${n} 位教师`,
  },
  {
    regex: /^Tuần (\d+)$/,
    en: (_, n) => `Week ${n}`,
    zh: (_, n) => `第 ${n} 周`,
  },
  {
    regex: /^Tạo lúc: (.+)$/,
    en: (_, dt) => `Created: ${dt}`,
    zh: (_, dt) => `创建时间：${dt}`,
  },
  {
    regex: /^Người gửi: (.+)$/,
    en: (_, name) => `Submitted by: ${name}`,
    zh: (_, name) => `提交人：${name}`,
  },
  {
    regex: /^Đang tải (.+)\.\.\.$/,
    en: () => 'Loading...',
    zh: () => '正在加载...',
  },
  {
    regex: /^Chủ đề cột leo \((.+)\)$/,
    en: (_, label) => `Tower theme (${PHRASE_DICT[label]?.en ?? label})`,
    zh: (_, label) => `爬塔主题（${PHRASE_DICT[label]?.zh ?? label}）`,
  },
  {
    regex: /^Chào mừng, (.+)$/,
    en: (_, name) => `Welcome, ${name}`,
    zh: (_, name) => `欢迎，${name}`,
  },
  {
    regex: /^Đang tải Mã đề (.+)\.\.\.$/,
    en: (_, code) => `Loading Exam Code ${code}...`,
    zh: (_, code) => `正在加载试卷代码 ${code}...`,
  },
];

export function translateViText(raw: string, lang: AppLanguage): string {
  if (lang === 'vi' || !raw) return raw;

  const trimmed = raw.trim();
  if (!trimmed) return raw;

  // Giữ nguyên tên chính thức của trường
  if (trimmed === SCHOOL_NAME) return raw;

  const leading = raw.slice(0, raw.indexOf(trimmed));
  const trailing = raw.slice(raw.indexOf(trimmed) + trimmed.length);

  const exact = PHRASE_DICT[trimmed];
  if (exact) {
    return `${leading}${exact[lang]}${trailing}`;
  }

  for (const rule of PATTERN_RULES) {
    const m = trimmed.match(rule.regex);
    if (m) {
      const translated = lang === 'en' ? rule.en(...m) : rule.zh(...m);
      return `${leading}${translated}${trailing}`;
    }
  }

  return raw;
}


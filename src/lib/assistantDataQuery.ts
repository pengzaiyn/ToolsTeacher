import {
  type AssistantAction,
  type AssistantAudienceRole,
  stripVietnameseDiacritics,
} from '@/lib/assistantKnowledge';
import { formatDateTimeVi } from '@/lib/classStorage';
import { maskPhone } from '@/lib/privacy';
import { isDroppedOutStudent } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { Announcement, CollegeClass } from '@/types/database';

export interface LiveDataAnswer {
  reply: string;
  actions: AssistantAction[];
}

export function normalizeCompactCode(value: string): string {
  return stripVietnameseDiacritics(value).replace(/[^a-z0-9]/g, '');
}

export function extractStudentCode(question: string): string | null {
  const match = question.match(/\b(6111\d{5,9})\b/);
  return match ? match[1] : null;
}

export function extractMentionedClassCode(question: string): string | null {
  const explicit = question.match(
    /(?:lớp|lop)\s+([a-zA-Z0-9][a-zA-Z0-9._-]{1,24})/i
  );
  if (explicit?.[1]) {
    const candidate = explicit[1].trim();
    const norm = stripVietnameseDiacritics(candidate);
    const stopWords = new Set([
      'nao',
      'nay',
      'do',
      'cua',
      'hoc',
      'minh',
      'toi',
      'em',
      'co',
      'dang',
      'khong',
      'gi',
    ]);
    if (!stopWords.has(norm)) {
      return candidate;
    }
  }

  // Bắt mã lớp dạng chữ+số như UDPM24_01, UDPM24-01, CNTT23-02, 10A4...
  const codeLike = question.match(/\b([A-Za-z]{2,8}\d{2}[-_.]?\d{1,3}|\d{2}[A-Za-z]\d{1,2})\b/);
  return codeLike ? codeLike[1] : null;
}

export function matchClassInQuestion<T extends { name: string; class_key?: string | null }>(
  question: string,
  classes: T[]
): T | null {
  const compactQuestion = normalizeCompactCode(question);
  if (!compactQuestion) return null;

  const mentionedCode = extractMentionedClassCode(question);
  const compactMentioned = mentionedCode ? normalizeCompactCode(mentionedCode) : '';

  let best: { cls: T; score: number } | null = null;

  for (const cls of classes) {
    const compactName = normalizeCompactCode(cls.name);
    if (!compactName) continue;

    if (compactMentioned && compactName === compactMentioned) {
      return cls;
    }

    if (compactName.length >= 3 && compactQuestion.includes(compactName)) {
      const score = compactName.length * 10;
      if (!best || score > best.score) {
        best = { cls, score };
      }
    }
  }

  return best?.cls ?? null;
}

function getVocative(role: AssistantAudienceRole) {
  if (role === 'student') {
    return { self: 'mình', user: 'bạn', end: 'nhé' };
  }
  return { self: 'em', user: 'thầy/cô', end: 'ạ' };
}

function getWeekdayLabel(weekday: number): string {
  if (weekday === 8) return 'Chủ nhật';
  return `Thứ ${weekday}`;
}

function getTodayWeekday(): number {
  const day = new Date().getDay(); // 0 = Sun, 1 = Mon...
  return day === 0 ? 8 : day + 1;
}

/**
 * Tra cứu trực tiếp dữ liệu thật từ Supabase (tuân thủ 100% RLS của tài khoản đang đăng nhập)
 * để trả lời chính xác các câu hỏi về sĩ số lớp, danh sách sinh viên, giáo viên, thông báo, lịch học...
 */
export async function tryAnswerLiveDataQuery(
  question: string,
  role: AssistantAudienceRole
): Promise<LiveDataAnswer | null> {
  if (role === 'guest') return null;

  const normalized = stripVietnameseDiacritics(question);
  if (!normalized) return null;

  const { user, end } = getVocative(role);

  // 1. Tra cứu sinh viên theo mã sinh viên (VD: 61112420027)
  const studentCode = extractStudentCode(question);
  if (studentCode && role !== 'student') {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'full_name, student_code, email, class_name, cohort, faculty, major, date_of_birth, place_of_birth, phone, academic_status, is_active'
      )
      .eq('role', 'student')
      .eq('student_code', studentCode)
      .maybeSingle<{
        full_name: string;
        student_code: string | null;
        email: string;
        class_name: string | null;
        cohort: string | null;
        faculty: string | null;
        major: string | null;
        date_of_birth: string | null;
        place_of_birth: string | null;
        phone: string | null;
        academic_status: string | null;
        is_active: boolean;
      }>();

    if (!error) {
      if (!data) {
        return {
          reply: `Không tìm thấy sinh viên có mã ${studentCode} trên hệ thống ${end}.`,
          actions: [{ label: 'Mở danh sách lớp', target: '/classes' }],
        };
      }
      const lines = [
        `Thông tin sinh viên mã ${studentCode}:`,
        `• Họ tên: ${data.full_name}`,
        `• Lớp: ${data.class_name || 'Chưa xếp lớp'}`,
        ...(data.cohort ? [`• Khóa: ${data.cohort}`] : []),
        ...(data.faculty ? [`• Khoa: ${data.faculty}`] : []),
        ...(data.major ? [`• Ngành: ${data.major}`] : []),
        ...(data.date_of_birth ? [`• Ngày sinh: ${data.date_of_birth}`] : []),
        ...(data.place_of_birth ? [`• Nơi sinh: ${data.place_of_birth}`] : []),
        ...(data.phone ? [`• SĐT: ${maskPhone(data.phone)}`] : []),
        `• Email: ${data.email}`,
        `• Trạng thái: ${data.academic_status || (data.is_active ? 'Đang học' : 'Đã khóa')}`,
      ];
      return {
        reply: lines.join('\n'),
        actions: [{ label: 'Mở danh sách lớp', target: '/classes' }],
      };
    }
  }

  // 2. Xác định các ý định hỏi dữ liệu liên quan đến LỚP CỤ THỂ
  const mentionedCode = extractMentionedClassCode(question);
  const asksCount =
    normalized.includes('bao nhieu') ||
    normalized.includes('si so') ||
    normalized.includes('so luong') ||
    normalized.includes('tong so') ||
    normalized.includes('may ');
  const asksStudentList =
    normalized.includes('danh sach') &&
    (normalized.includes('sinh vien') ||
      normalized.includes('hoc sinh') ||
      normalized.includes('thanh vien'));
  const asksTeacherOfClass =
    (normalized.includes('giao vien') ||
      normalized.includes('giang vien') ||
      normalized.includes('ai day') ||
      normalized.includes('phu trach')) &&
    Boolean(mentionedCode);
  const asksClassAnnouncements =
    normalized.includes('thong bao') && Boolean(mentionedCode);
  const asksClassTimetable =
    (normalized.includes('thoi khoa bieu') ||
      normalized.includes('tkb') ||
      normalized.includes('lich hoc') ||
      normalized.includes('lich day')) &&
    Boolean(mentionedCode);
  const asksClassInfo =
    Boolean(mentionedCode) &&
    (asksCount ||
      asksStudentList ||
      asksTeacherOfClass ||
      normalized.includes('thong tin') ||
      normalized.includes('xem lop') ||
      normalized.includes('hoc sinh') ||
      normalized.includes('sinh vien'));

  if (asksClassInfo || asksClassAnnouncements || asksClassTimetable) {
    const { data: classes, error: clsErr } = await supabase
      .from('classes')
      .select('id, name, class_key, subject, teacher:profiles!classes_teacher_id_fkey(id, full_name, email)')
      .returns<Pick<CollegeClass, 'id' | 'name' | 'class_key' | 'subject' | 'teacher'>[]>();

    if (!clsErr && classes) {
      const matched = matchClassInQuestion(question, classes);
      if (!matched && mentionedCode) {
        const compactHint = normalizeCompactCode(mentionedCode).slice(0, 4);
        const similar = classes
          .filter((c) => compactHint && normalizeCompactCode(c.name).includes(compactHint))
          .slice(0, 5)
          .map((c) => c.name);
        const suggestionLine =
          similar.length > 0 ? `\nCác lớp gần giống trên hệ thống: ${similar.join(', ')}.` : '';
        return {
          reply: `Không tìm thấy lớp "${mentionedCode}" trong danh sách lớp ${user} có quyền xem.${suggestionLine}`,
          actions: [{ label: 'Mở danh sách lớp', target: '/classes' }],
        };
      }

      if (matched) {
        // 2a. Thông báo của lớp
        if (asksClassAnnouncements) {
          const { data: anns } = await supabase
            .from('announcements')
            .select('id, title, content, created_at')
            .eq('class_id', matched.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .returns<Pick<Announcement, 'id' | 'title' | 'content' | 'created_at'>[]>();

          const list = anns ?? [];
          if (list.length === 0) {
            return {
              reply: `Lớp ${matched.name} hiện chưa có thông báo nào ${end}.`,
              actions: [
                {
                  label: `Mở thông báo lớp ${matched.name}`,
                  target: `/classes/${matched.id}?tab=announcements`,
                },
              ],
            };
          }

          const lines = list.map(
            (a, idx) => `${idx + 1}. ${a.title} (${formatDateTimeVi(a.created_at)})`
          );
          return {
            reply: `Thông báo mới nhất của lớp ${matched.name} (${list.length} mục gần nhất):\n${lines.join('\n')}`,
            actions: [
              {
                label: `Xem tab Thông báo lớp ${matched.name}`,
                target: `/classes/${matched.id}?tab=announcements`,
              },
            ],
          };
        }

        // 2b. Thời khóa biểu của lớp
        if (asksClassTimetable) {
          const { data: entries } = await supabase
            .from('timetable_entries')
            .select('weekday, period_start, period_end, time_range, subject, room, teacher_name')
            .eq('class_key', matched.class_key || matched.name.toLowerCase())
            .order('weekday', { ascending: true })
            .order('period_start', { ascending: true })
            .limit(12)
            .returns<
              {
                weekday: number;
                period_start: number;
                period_end: number;
                time_range: string | null;
                subject: string;
                room: string | null;
                teacher_name: string | null;
              }[]
            >();

          const list = entries ?? [];
          if (list.length === 0) {
            return {
              reply: `Lớp ${matched.name} hiện chưa có dữ liệu thời khóa biểu trên hệ thống ${end}.`,
              actions: [{ label: 'Mở Thời khóa biểu', target: '/timetable' }],
            };
          }

          const lines = list.slice(0, 8).map((e) => {
            const slot = e.time_range || `Tiết ${e.period_start}-${e.period_end}`;
            const roomText = e.room ? ` · Phòng ${e.room}` : '';
            const teacherText = e.teacher_name ? ` · GV ${e.teacher_name}` : '';
            return `• ${getWeekdayLabel(e.weekday)} (${slot}): ${e.subject}${roomText}${teacherText}`;
          });

          return {
            reply: `Lịch học của lớp ${matched.name} (${list.length} buổi):\n${lines.join('\n')}`,
            actions: [
              {
                label: `Xem TKB lớp ${matched.name}`,
                target: `/timetable?class=${encodeURIComponent(matched.class_key || matched.name.toLowerCase())}`,
              },
            ],
          };
        }

        // 2c. Sĩ số / Danh sách sinh viên / Thông tin lớp
        const teacherName = matched.teacher?.full_name || 'Chưa phân công giáo viên';
        if (role === 'student') {
          return {
            reply: [
              `Thông tin lớp ${matched.name}:`,
              matched.subject ? `• Môn học / Ngành: ${matched.subject}` : null,
              `• Giáo viên phụ trách: ${teacherName}`,
              'Lưu ý: Tài khoản sinh viên không xem được danh sách sĩ số chi tiết của lớp theo quyền bảo mật.',
            ]
              .filter(Boolean)
              .join('\n'),
            actions: [{ label: `Mở lớp ${matched.name}`, target: `/classes/${matched.id}` }],
          };
        }

        // Giáo viên / Hiệu trưởng: lấy sĩ số chính xác qua RPC + danh sách nếu hỏi
        const [{ data: countRows }, enrollmentRes] = await Promise.all([
          supabase.rpc('class_active_student_counts'),
          asksStudentList
            ? supabase
                .from('enrollments')
                .select(
                  'student:profiles!enrollments_student_id_fkey(full_name, student_code, academic_status)'
                )
                .eq('class_id', matched.id)
                .limit(20)
                .returns<
                  {
                    student: {
                      full_name: string;
                      student_code: string | null;
                      academic_status: string | null;
                    } | null;
                  }[]
                >()
            : Promise.resolve({ data: null }),
        ]);

        let activeCount: number | null = null;
        const rows = (countRows as { class_id: string; active_count: number }[] | null) ?? [];
        const foundCount = rows.find((r) => r.class_id === matched.id);
        if (foundCount) {
          activeCount = Number(foundCount.active_count);
        } else {
          // Dự phòng đếm trực tiếp enrollments
          const { data: fallbackEnr } = await supabase
            .from('enrollments')
            .select('id, student:profiles!enrollments_student_id_fkey(academic_status)')
            .eq('class_id', matched.id)
            .returns<{ id: string; student: { academic_status: string | null } | null }[]>();
          activeCount = (fallbackEnr ?? []).filter((r) => !isDroppedOutStudent(r.student)).length;
        }

        const lines = [
          `Lớp ${matched.name} hiện có ${activeCount} sinh viên đang theo học ${end}.`,
          matched.subject ? `• Môn học / Ngành: ${matched.subject}` : null,
          `• Giáo viên phụ trách: ${teacherName}`,
        ].filter(Boolean) as string[];

        if (asksStudentList && enrollmentRes.data) {
          const activeStudents = enrollmentRes.data
            .map((r) => r.student)
            .filter((s): s is NonNullable<typeof s> => Boolean(s) && !isDroppedOutStudent(s));

          if (activeStudents.length > 0) {
            const preview = activeStudents
              .slice(0, 10)
              .map(
                (s, idx) =>
                  `${idx + 1}. ${s.full_name}${s.student_code ? ` (${s.student_code})` : ''}`
              );
            lines.push(
              `\nDanh sách ${preview.length}/${activeCount} sinh viên đầu tiên:\n${preview.join('\n')}`
            );
          }
        }

        return {
          reply: lines.join('\n'),
          actions: [
            {
              label: `Mở tab Thành viên lớp ${matched.name}`,
              target: `/classes/${matched.id}?tab=members`,
            },
          ],
        };
      }
    }
  }

  // 3. Hỏi tổng số lớp / tổng số giáo viên / tổng số sinh viên
  if (asksCount) {
    if (normalized.includes('lop')) {
      const { count, error } = await supabase
        .from('classes')
        .select('id', { count: 'exact', head: true });
      if (!error && count !== null) {
        return {
          reply: `Hiện hệ thống đang có ${count} lớp học trong phạm vi truy cập của ${user} ${end}.`,
          actions: [{ label: 'Mở danh sách lớp học', target: '/classes' }],
        };
      }
    }

    if (
      (normalized.includes('giao vien') || normalized.includes('giang vien')) &&
      role === 'admin'
    ) {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'teacher')
        .eq('is_active', true);
      if (!error && count !== null) {
        return {
          reply: `Hiện toàn trường đang có ${count} tài khoản giáo viên đang hoạt động ${end}.`,
          actions: [{ label: 'Mở Quản lý giáo viên', target: '/admin/teachers' }],
        };
      }
    }

    if (
      (normalized.includes('sinh vien') || normalized.includes('hoc sinh')) &&
      role !== 'student'
    ) {
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('is_active', true);
      if (!error && count !== null) {
        return {
          reply: `Hiện hệ thống đang có ${count} tài khoản sinh viên đang hoạt động ${end}.`,
          actions: [{ label: 'Mở danh sách lớp học', target: '/classes' }],
        };
      }
    }
  }

  // 4. Hỏi thông báo mới nhất (không chỉ định lớp)
  if (
    normalized.includes('thong bao') &&
    (normalized.includes('moi') ||
      normalized.includes('xem') ||
      normalized.includes('co gi') ||
      normalized.includes('nao khong') ||
      normalized.includes('gan day'))
  ) {
    const { data: anns, error } = await supabase
      .from('announcements')
      .select('id, title, class_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
      .returns<Pick<Announcement, 'id' | 'title' | 'class_id' | 'created_at'>[]>();

    if (!error) {
      const list = anns ?? [];
      if (list.length === 0) {
        return {
          reply: `Hiện chưa có thông báo mới nào cho tài khoản của ${user} ${end}.`,
          actions: [{ label: 'Về Trang chủ', target: '/tools' }],
        };
      }
      const lines = list.map(
        (a, idx) => `${idx + 1}. ${a.title} (${formatDateTimeVi(a.created_at)})`
      );
      return {
        reply: `Đây là ${list.length} thông báo mới nhất của ${user}:\n${lines.join('\n')}`,
        actions: [
          {
            label: role === 'admin' ? 'Mở Quản lý thông báo' : 'Xem tại Trang chủ',
            target: role === 'admin' ? '/admin/announcements' : '/tools',
          },
        ],
      };
    }
  }

  // 5. Hỏi lịch học / lịch dạy hôm nay
  if (
    normalized.includes('hom nay') &&
    (normalized.includes('lich') ||
      normalized.includes('mon gi') ||
      normalized.includes('hoc gi') ||
      normalized.includes('day lop') ||
      normalized.includes('tkb'))
  ) {
    const todayWd = getTodayWeekday();
    const { data: entries, error } = await supabase
      .from('timetable_entries')
      .select('class_name, period_start, period_end, time_range, subject, room, teacher_name')
      .eq('weekday', todayWd)
      .order('period_start', { ascending: true })
      .limit(10)
      .returns<
        {
          class_name: string;
          period_start: number;
          period_end: number;
          time_range: string | null;
          subject: string;
          room: string | null;
          teacher_name: string | null;
        }[]
      >();

    if (!error) {
      const list = entries ?? [];
      if (list.length === 0) {
        return {
          reply: `Hôm nay (${getWeekdayLabel(todayWd)}) chưa có buổi học/dạy nào trong thời khóa biểu của ${user} ${end}.`,
          actions: [{ label: 'Mở Thời khóa biểu', target: '/timetable' }],
        };
      }
      const lines = list.map((e) => {
        const slot = e.time_range || `Tiết ${e.period_start}-${e.period_end}`;
        const roomText = e.room ? ` · Phòng ${e.room}` : '';
        return `• ${e.class_name} (${slot}): ${e.subject}${roomText}`;
      });
      return {
        reply: `Lịch hôm nay (${getWeekdayLabel(todayWd)}) gồm ${list.length} buổi:\n${lines.join('\n')}`,
        actions: [
          {
            label: role === 'student' ? 'Mở Thời khóa biểu' : 'Mở Lịch dạy cá nhân',
            target: role === 'student' ? '/timetable' : '/teacher/schedule',
          },
        ],
      };
    }
  }

  return null;
}

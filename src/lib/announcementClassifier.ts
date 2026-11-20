import { supabase } from '@/lib/supabase';

export type AnnouncementSeverity = 'normal' | 'warning';

interface EdgeAssistantResponse {
  reply?: string;
  error?: string;
}

const WARNING_KEYWORDS = [
  'canh bao',
  'khan cap',
  'khan',
  'cam thi',
  'vi pham',
  'ky luat',
  'dinh chi',
  'thoi hoc',
  'nguy hiem',
  'phat',
  'qua han',
  'han chot',
  'huy lich',
  'hoan thi',
  'nghi dot xuat',
  'bao lu',
  'chay no',
  'nhac nho nghiem',
  'luu y quan trong',
  'bat buoc',
  'gap',
];

function stripVietnamese(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function quickClassifyAnnouncement(
  title: string,
  content: string | null
): AnnouncementSeverity {
  const combined = stripVietnamese(`${title} ${content ?? ''}`);
  if (!combined) return 'normal';
  return WARNING_KEYWORDS.some((kw) => combined.includes(kw)) ? 'warning' : 'normal';
}

/**
 * Dùng Gemini AI (qua Edge Function avc-assistant) để phân loại thông báo là
 * cảnh báo / khẩn cấp ('warning') hay thông báo thường ('normal').
 * Có fallback nhanh về bộ lọc từ khóa nếu mạng/AI phản hồi chậm.
 */
export async function classifyAnnouncementWithAI(
  title: string,
  content: string | null
): Promise<AnnouncementSeverity> {
  const fallback = quickClassifyAnnouncement(title, content);
  const prompt = [
    'Bạn là bộ phân loại thông báo học đường của trường cao đẳng.',
    'Hãy đọc tiêu đề và nội dung thông báo sau và CHỈ trả về đúng 1 từ duy nhất:',
    '- WARNING: nếu thông báo mang tính cảnh báo, khẩn cấp, nhắc nhở vi phạm, kỷ luật, cấm thi, quá hạn, hoãn/hủy đột xuất, sự cố, nguy hiểm hoặc yêu cầu bắt buộc gấp.',
    '- NORMAL: nếu là thông báo thông thường (chào hỏi, giới thiệu giáo viên, lịch học/tài liệu/bài tập bình thường, chúc mừng).',
    '',
    `Tiêu đề: ${title}`,
    `Nội dung: ${content?.trim() || '(Không có nội dung bổ sung)'}`,
  ].join('\n');

  try {
    const invokePromise = supabase.functions.invoke<EdgeAssistantResponse>('avc-assistant', {
      body: {
        mode: 'chat',
        message: prompt,
        currentPath: '/classes',
      },
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 2500);
    });

    const raced = await Promise.race([invokePromise, timeoutPromise]);
    if (!raced || raced.error || !raced.data?.reply) {
      return fallback;
    }

    const reply = raced.data.reply.trim().toUpperCase();
    if (reply.includes('WARNING')) return 'warning';
    if (reply.includes('NORMAL')) return 'normal';
    return fallback;
  } catch {
    return fallback;
  }
}


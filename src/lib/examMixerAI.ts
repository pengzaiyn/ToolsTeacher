import { OPTION_LETTERS, type ExamQuestion, type OptionLetter } from '@/lib/examMixer';
import { supabase } from '@/lib/supabase';

interface EdgeAssistantResponse {
  reply?: string;
  error?: string;
}

/**
 * Gọi Edge Function avc-assistant (Gemini) để AI gợi ý đáp án đúng cho danh sách câu hỏi trắc nghiệm.
 * Giáo viên luôn có thể bấm chọn/sửa lại trực tiếp từng đáp án sau khi AI gợi ý.
 */
export async function suggestExamAnswersWithAI(
  questions: ExamQuestion[],
  subjectHint?: string
): Promise<Map<string, OptionLetter>> {
  const result = new Map<string, OptionLetter>();
  if (questions.length === 0) return result;

  const batchSize = 15;
  for (let start = 0; start < questions.length; start += batchSize) {
    const batch = questions.slice(start, start + batchSize);
    const formatted = batch
      .map((q, idx) => {
        const opts = q.options
          .map((o, oIdx) => `${OPTION_LETTERS[oIdx] ?? 'A'}. ${o.text}`)
          .join('\n');
        return `Câu ${idx + 1}: ${q.prompt}\n${opts}`;
      })
      .join('\n\n');

    const prompt = [
      `Bạn là giảng viên chuyên môn${subjectHint ? ` môn ${subjectHint}` : ''}.`,
      'Hãy chọn 1 đáp án đúng nhất cho từng câu hỏi trắc nghiệm sau.',
      'CHỈ trả về danh sách dạng "1:A, 2:D, 3:C, ..." (không giải thích dài dòng).',
      '',
      formatted,
    ].join('\n');

    const { data, error } = await supabase.functions.invoke<EdgeAssistantResponse>(
      'avc-assistant',
      {
        body: {
          mode: 'chat',
          message: prompt,
          currentPath: '/teacher/exam-mixer',
        },
      }
    );

    if (error) {
      throw new Error('Không kết nối được dịch vụ AI gợi ý đáp án. Bạn có thể tự bấm chọn đáp án trực tiếp.');
    }
    if (data?.error) {
      throw new Error(data.error);
    }

    const reply = data?.reply ?? '';
    const pairRe = /(?:câu\s*)?(\d{1,3})\s*[:.)\-]\s*([A-Fa-f])\b/gi;
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(reply)) !== null) {
      const localIdx = Number(m[1]) - 1;
      const letter = m[2].toUpperCase() as OptionLetter;
      const targetQ = batch[localIdx];
      if (targetQ) {
        const optIdx = OPTION_LETTERS.indexOf(letter);
        if (optIdx >= 0 && optIdx < targetQ.options.length) {
          result.set(targetQ.id, letter);
        }
      }
    }
  }

  return result;
}


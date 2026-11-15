import { HelpCircle } from 'lucide-react';
import {
  getRecitationQuestionTags,
  getTotalQuestionCount,
  type RecitationRecord,
} from '@/lib/classroomKit';

interface RecitationQuestionBoxProps {
  record: RecitationRecord;
}

/** Hiển thị danh sách câu hỏi trả bài (bao gồm câu hỏi cộng dồn từ +2 và Ngôi sao hy vọng) */
export function RecitationQuestionBox({ record }: RecitationQuestionBoxProps) {
  if (record.outcome === 'skipped' || record.unoKind === 'skip' || record.hopeStarKind === 'skip') {
    return null;
  }
  if (record.unoDeck && record.pickedSlotIndex === null) {
    return null;
  }

  const total = getTotalQuestionCount(record);
  if (total <= 0) return null;
  if (total === 1 && record.questions.length === 0) return null;

  const tags = getRecitationQuestionTags(record);
  const hasHopeStarQuestions =
    record.hopeStarStatus === 'resolved' && record.hopeStarKind !== null;

  const heading = hasHopeStarQuestions
    ? `Câu hỏi tích lũy (Tổng ${total} câu)`
    : record.unoKind === 'plus2'
      ? 'Câu hỏi trả bài (1 câu chính + 2 câu cộng thêm)'
      : record.unoKind === 'reverse'
        ? 'Câu hỏi dành cho giảng viên trả lời'
        : 'Câu hỏi trả bài';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-brand-red/20 bg-brand-redSoft/60 p-4">
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase text-brand-red">
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        <span>{heading}</span>
      </span>

      {total === 1 ? (
        <p className="text-sm font-semibold text-ink-primary">{record.questions[0]}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {tags.map((tag, qIdx) => {
            const qText = record.questions[qIdx];
            const isStarTag = tag.startsWith('Ngôi sao');
            return (
              <li
                key={`${tag}-${qIdx}`}
                className="flex flex-wrap items-baseline gap-2 rounded-lg bg-surface-card px-4 py-2 text-sm text-ink-primary"
              >
                <span
                  className={`text-xs font-bold ${
                    isStarTag ? 'text-status-warningText' : 'text-brand-red'
                  }`}
                >
                  {tag}:
                </span>
                <span className={qText ? 'font-semibold' : 'italic text-ink-muted'}>
                  {qText ?? 'Giảng viên nêu câu hỏi trực tiếp tại lớp'}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

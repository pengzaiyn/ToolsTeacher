import { ArrowRight, Play, Star } from 'lucide-react';
import {
  canActivateHopeStar,
  getTotalQuestionCount,
  HOPE_STAR_CARDS,
  UNO_CARDS,
  type RecitationRecord,
} from '@/lib/classroomKit';
import { RecitationQuestionBox } from '@/components/classroom-kit/RecitationQuestionBox';
import { UnoCardFrontSvg } from '@/components/classroom-kit/UnoCardVisual';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface RecitationResultModalProps {
  record: RecitationRecord | null;
  noticeType: 'uno' | 'hope-star' | null;
  hasAvailableNextStudent: boolean;
  onClose: () => void;
  onStartRecitation: () => void;
  onPickNextStudent: () => void;
  onActivateHopeStar: (recordId: string) => void;
}

/** Hộp thoại công bố kết quả bốc thẻ UNO hoặc thẻ Ngôi sao hy vọng */
export function RecitationResultModal({
  record,
  noticeType,
  hasAvailableNextStudent,
  onClose,
  onStartRecitation,
  onPickNextStudent,
  onActivateHopeStar,
}: RecitationResultModalProps) {
  if (!record || !noticeType) return null;

  const isHopeStar = noticeType === 'hope-star';
  const cardKind = isHopeStar ? record.hopeStarKind : record.unoKind;
  if (!cardKind) return null;

  const meta =
    isHopeStar && cardKind !== 'reverse' ? HOPE_STAR_CARDS[cardKind] : UNO_CARDS[cardKind];

  const isSkipOutcome = cardKind === 'skip';
  const isReverseOutcome = !isHopeStar && cardKind === 'reverse';
  const totalQuestions = getTotalQuestionCount(record);

  const modalTitle = isHopeStar
    ? `Ngôi sao hy vọng: ${meta.title}`
    : `Kết quả lá bài: ${meta.title}`;

  const renderFooter = () => {
    if (isSkipOutcome) {
      return (
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          {hasAvailableNextStudent && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onPickNextStudent();
              }}
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span>Chọn sinh viên khác</span>
            </Button>
          )}
        </>
      );
    }

    if (isReverseOutcome) {
      return (
        <>
          <Button variant="primary" onClick={onClose}>
            Xem chi tiết
          </Button>
          {hasAvailableNextStudent && (
            <Button
              variant="navy"
              onClick={() => {
                onClose();
                onPickNextStudent();
              }}
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span>Chọn SV tiếp theo</span>
            </Button>
          )}
        </>
      );
    }

    return (
      <>
        {!isHopeStar && canActivateHopeStar(record) && (
          <Button variant="secondary" onClick={() => onActivateHopeStar(record.id)}>
            <Star className="h-4 w-4 text-status-warningText" aria-hidden="true" />
            <span>Dùng Ngôi sao hy vọng</span>
          </Button>
        )}
        <Button variant="primary" onClick={onStartRecitation}>
          <Play className="h-4 w-4" aria-hidden="true" />
          <span>Bắt đầu trả bài</span>
        </Button>
      </>
    );
  };

  return (
    <Modal open onClose={onClose} title={modalTitle} size="md" footer={renderFooter()}>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="uno-deal-in aspect-[2/3] w-28 shrink-0">
          <UnoCardFrontSvg kind={cardKind} mode={isHopeStar ? 'hope-star' : 'uno'} />
        </div>

        <div className="flex flex-1 flex-col gap-2 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Badge tone="navy">{record.student.name}</Badge>
            {isHopeStar && record.unoKind && cardKind !== 'skip' && (
              <Badge tone="neutral">Lá đầu: {UNO_CARDS[record.unoKind].title}</Badge>
            )}
            <Badge tone={meta.badgeTone}>{meta.subtitle}</Badge>
            {isHopeStar && cardKind !== 'skip' && totalQuestions > 1 && (
              <Badge tone="warning">Tổng {totalQuestions} câu</Badge>
            )}
          </div>

          <h3 className="text-lg font-bold text-ink-primary">{meta.title}</h3>
          <p className="text-sm font-normal leading-relaxed text-ink-secondary">
            {meta.description}
          </p>

          <div className="mt-2 text-left">
            <RecitationQuestionBox record={record} />
          </div>
        </div>
      </div>
    </Modal>
  );
}


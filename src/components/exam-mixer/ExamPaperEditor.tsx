import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  GripVertical,
  ImagePlus,
  LayoutTemplate,
  ListOrdered,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  createExamId,
  ensureVariantBlocks,
  OPTION_LETTERS,
  recalculateVariantFromBlocks,
  reorderItems,
  type ExamBlockStyle,
  type ExamMetadata,
  type ExamPaperBlock,
  type ExamPaperTheme,
  type MixedExamQuestion,
  type MixedExamVariant,
} from '@/lib/examMixer';
import { compressImageFileToDataUrl, isSafeImageDataUrl } from '@/lib/examRichText';
import {
  ExamBlockPalette,
  type PaletteBlockKind,
} from '@/components/exam-mixer/ExamBlockPalette';
import { ExamFormatToolbar } from '@/components/exam-mixer/ExamFormatToolbar';
import { RichTextEditable } from '@/components/exam-mixer/RichTextEditable';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface ExamPaperEditorProps {
  variant: MixedExamVariant;
  metadata: ExamMetadata;
  paperTheme: ExamPaperTheme;
  showAnswersPreview: boolean;
  totalVariantsCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUpdateVariant: (nextVariant: MixedExamVariant, recordHistory?: boolean) => void;
  onUpdatePaperTheme: (patch: Partial<ExamPaperTheme>) => void;
  onInsertMixedQuestionsAt: (targetIndex: number) => void;
  onApplySampleStructure: () => void;
  onClearToBlankSheet: () => void;
}

export function ExamPaperEditor({
  variant,
  metadata,
  paperTheme,
  showAnswersPreview,
  totalVariantsCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUpdateVariant,
  onUpdatePaperTheme,
  onInsertMixedQuestionsAt,
  onApplySampleStructure,
  onClearToBlankSheet,
}: ExamPaperEditorProps) {
  const toast = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [editMode, setEditMode] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dragBlockIdx, setDragBlockIdx] = useState<number | null>(null);
  const [dropBlockIdx, setDropBlockIdx] = useState<number | null>(null);
  const [dragPaletteKind, setDragPaletteKind] = useState<PaletteBlockKind | null>(null);
  const [dropPaletteIdx, setDropPaletteIdx] = useState<number | null>(null);
  const [dragOptionState, setDragOptionState] = useState<{
    blockId: string;
    optIdx: number;
  } | null>(null);
  const [imageTarget, setImageTarget] = useState<{
    blockId: string;
    essayItemId?: string;
  } | null>(null);
  const [deleteBlockTarget, setDeleteBlockTarget] = useState<ExamPaperBlock | null>(null);
  const prevVariantCodeRef = useRef<string>(variant.code);
  const [switchingCode, setSwitchingCode] = useState<string | null>(null);

  useEffect(() => {
    if (prevVariantCodeRef.current === variant.code) return;
    prevVariantCodeRef.current = variant.code;
    const rm =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm) return;

    setSwitchingCode(variant.code);
    const timer = window.setTimeout(() => {
      setSwitchingCode(null);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [variant.code]);

  const blocks = ensureVariantBlocks(variant, metadata);
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  function commitBlocks(nextBlocks: ExamPaperBlock[], recordHistory = true) {
    onUpdateVariant(recalculateVariantFromBlocks(variant, nextBlocks), recordHistory);
  }

  function updateBlockById(
    blockId: string,
    updater: (blk: ExamPaperBlock) => ExamPaperBlock,
    recordHistory = false
  ) {
    const next = blocks.map((b) => (b.id === blockId ? updater(b) : b));
    commitBlocks(next, recordHistory);
  }

  function handleUpdateSelectedBlockStyle(patch: Partial<ExamBlockStyle>) {
    if (!selectedBlockId) return;
    updateBlockById(
      selectedBlockId,
      (blk) => ({
        ...blk,
        style: { ...(blk.style ?? {}), ...patch },
      }),
      true
    );
  }

  function getInsertIndexAfterSelection(): number {
    if (selectedBlockId) {
      const idx = blocks.findIndex((b) => b.id === selectedBlockId);
      if (idx >= 0) return idx + 1;
    }
    const footerIdx = blocks.findIndex((b) => b.type === 'footer');
    return footerIdx >= 0 ? footerIdx : blocks.length;
  }

  function createPaletteBlock(kind: PaletteBlockKind): ExamPaperBlock {
    if (kind === 'header') {
      return {
        id: createExamId('blk-hdr'),
        type: 'header',
        schoolHtml: metadata.schoolName || 'TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI',
        departmentHtml: metadata.department || 'KHOA CÔNG NGHỆ THÔNG TIN',
        examTitleHtml: metadata.examTitle || 'ĐỀ THI KẾT THÚC HỌC PHẦN',
        subjectHtml: metadata.subject ? `Môn: ${metadata.subject}` : 'Môn: ...',
        durationHtml: `Thời gian làm bài: ${metadata.durationMinutes || 45} phút${
          metadata.semester ? ` • ${metadata.semester}` : ''
        }`,
      };
    }
    if (kind === 'student_info') {
      return {
        id: createExamId('blk-stu'),
        type: 'student_info',
        studentLineHtml:
          'Họ và tên thí sinh: .......................................................... Lớp: .........................<br/>Mã sinh viên: ......................................... Số báo danh: ..................................',
        notesHtml: metadata.notes ? `<i>Lưu ý: ${metadata.notes}</i>` : '',
        codeLabelPrefix: 'MÃ ĐỀ:',
      };
    }
    if (kind === 'score_box') {
      return {
        id: createExamId('blk-score'),
        type: 'score_box',
        scoreNumHtml: '<b>Điểm bằng số</b>',
        scoreTextHtml: '<b>Điểm bằng chữ</b>',
        examiner1Html: '<b>Chữ ký GK1</b>',
        examiner2Html: '<b>Chữ ký GK2</b>',
        codeSlotHtml: '<b>Mã phách</b>',
        showCodeSlot: true,
      };
    }
    if (kind === 'essay_section') {
      return {
        id: createExamId('blk-essay-sec'),
        type: 'essay_section',
        titleHtml: '<b>PHẦN TỰ LUẬN:</b> (2 điểm)',
        noteHtml: '',
        showNote: false,
        items: [
          {
            id: createExamId('essay-q'),
            promptHtml: '<b>Câu 1:</b> Nhập nội dung câu hỏi tự luận tại đây...',
            lineCount: 5,
          },
        ],
      };
    }
    if (kind === 'essay_lines') {
      return {
        id: createExamId('blk-essay'),
        type: 'essay_lines',
        titleHtml: '<b>BÀI LÀM:</b>',
        lineCount: 8,
      };
    }
    if (kind === 'section_text') {
      return {
        id: createExamId('blk-sec'),
        type: 'section_text',
        contentHtml: '<b>PHẦN MỚI:</b> Nhập tiêu đề phần thi hoặc đoạn hướng dẫn tại đây...',
        style: { textAlign: 'left' },
      };
    }
    if (kind === 'footer') {
      return {
        id: createExamId('blk-ftr'),
        type: 'footer',
        endTextHtml: '<b>--- HẾT ---</b>',
        showSignatures: true,
        leftRoleHtml: '<b>GIẢNG VIÊN RA ĐỀ</b><br/><i>(Ký và ghi rõ họ tên)</i>',
        rightRoleHtml: '<b>TRƯỞNG BỘ MÔN / KHOA DUYỆT</b><br/><i>(Ký và ghi rõ họ tên)</i>',
      };
    }
    return {
      id: createExamId('blk-q'),
      type: 'question',
      question: {
        number: variant.questions.length + 1,
        sourceQuestionId: createExamId('custom-q'),
        prompt: 'Nội dung câu hỏi mới...',
        promptHtml: 'Nội dung câu hỏi mới...',
        correctLetter: 'A',
        options: [
          {
            sourceOptionId: createExamId('opt'),
            letter: 'A',
            text: 'Phương án A',
            textHtml: 'Phương án A',
            isCorrect: true,
          },
          {
            sourceOptionId: createExamId('opt'),
            letter: 'B',
            text: 'Phương án B',
            textHtml: 'Phương án B',
            isCorrect: false,
          },
          {
            sourceOptionId: createExamId('opt'),
            letter: 'C',
            text: 'Phương án C',
            textHtml: 'Phương án C',
            isCorrect: false,
          },
          {
            sourceOptionId: createExamId('opt'),
            letter: 'D',
            text: 'Phương án D',
            textHtml: 'Phương án D',
            isCorrect: false,
          },
        ],
      },
    };
  }

  function insertNewBlockAt(kind: PaletteBlockKind, targetIndex: number) {
    if (kind === 'mixed_questions') {
      onInsertMixedQuestionsAt(targetIndex);
      return;
    }
    const newBlock = createPaletteBlock(kind);
    const safeIdx = Math.max(0, Math.min(targetIndex, blocks.length));
    const next = [...blocks];
    next.splice(safeIdx, 0, newBlock);
    commitBlocks(next, true);
    setSelectedBlockId(newBlock.id);
    const labels: Record<Exclude<PaletteBlockKind, 'mixed_questions'>, string> = {
      header: 'khung tiêu đề đề thi',
      student_info: 'khung thông tin thí sinh & mã đề',
      score_box: 'khung điểm & chữ ký GK',
      section_text: 'khối tiêu đề / đoạn văn',
      question: 'khung câu hỏi trắc nghiệm',
      essay_section: 'khung phần tự luận',
      essay_lines: 'khung dòng kẻ bài làm',
      footer: 'khung chân trang & ký duyệt',
    };
    toast.success(`Đã chèn ${labels[kind]} và tự động đồng bộ sang tất cả mã đề`);
  }

  function handleQuickInsertFromPalette(kind: PaletteBlockKind) {
    if (kind === 'header') {
      insertNewBlockAt(kind, 0);
      return;
    }
    if (kind === 'footer') {
      insertNewBlockAt(kind, blocks.length);
      return;
    }
    insertNewBlockAt(kind, getInsertIndexAfterSelection());
  }

  function handleDuplicateBlock(index: number) {
    const source = blocks[index];
    if (!source) return;
    const cloned = JSON.parse(JSON.stringify(source)) as ExamPaperBlock;
    cloned.id = createExamId(`blk-${source.type}`);
    if (cloned.type === 'question') {
      cloned.question.sourceQuestionId = createExamId('dup-q');
    }
    const next = [...blocks];
    next.splice(index + 1, 0, cloned);
    commitBlocks(next, true);
    setSelectedBlockId(cloned.id);
    toast.success('Đã nhân bản khối nội dung');
  }

  function handleConfirmDeleteBlock() {
    if (!deleteBlockTarget) return;
    const next = blocks.filter((b) => b.id !== deleteBlockTarget.id);
    commitBlocks(next, true);
    if (selectedBlockId === deleteBlockTarget.id) {
      setSelectedBlockId(null);
    }
    setDeleteBlockTarget(null);
    toast.success('Đã xóa khối khỏi mã đề');
  }

  function handleMoveBlock(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= blocks.length || fromIdx === toIdx) return;
    commitBlocks(reorderItems(blocks, fromIdx, toIdx), true);
  }

  function handleTriggerImageUpload(blockId: string, essayItemId?: string) {
    setImageTarget({ blockId, essayItemId });
    imageInputRef.current?.click();
  }

  async function handleImageSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !imageTarget) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      updateBlockById(
        imageTarget.blockId,
        (blk) => {
          if (blk.type === 'question') {
            return { ...blk, question: { ...blk.question, imageUrl: dataUrl } };
          }
          if (blk.type === 'section_text') {
            return { ...blk, imageUrl: dataUrl };
          }
          if (blk.type === 'essay_section' && imageTarget.essayItemId) {
            return {
              ...blk,
              items: blk.items.map((item) =>
                item.id === imageTarget.essayItemId ? { ...item, imageUrl: dataUrl } : item
              ),
            };
          }
          return blk;
        },
        true
      );
      toast.success('Đã chèn ảnh minh họa vào tờ đề');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể chèn ảnh');
    } finally {
      setImageTarget(null);
    }
  }

  const fontStack =
    paperTheme.fontFamily === 'Times New Roman'
      ? '"Times New Roman", Times, serif'
      : paperTheme.fontFamily === 'Georgia'
        ? 'Georgia, "Times New Roman", serif'
        : `"${paperTheme.fontFamily}", Arial, sans-serif`;

  function getOptionGridClass(q: MixedExamQuestion): string {
    if (paperTheme.optionColumns === 1) return 'grid-cols-1';
    if (paperTheme.optionColumns === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (paperTheme.optionColumns === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
    const maxLen = Math.max(...q.options.map((o) => o.text.length), 0);
    return maxLen <= 38 && q.options.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1';
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={imageInputRef}
        id="exam-block-image-upload"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleImageSelected}
        className="hidden"
      />

      <ExamFormatToolbar
        editMode={editMode}
        onToggleEditMode={() => setEditMode((v) => !v)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        selectedBlockStyle={selectedBlock?.style}
        hasSelectedBlock={Boolean(selectedBlock)}
        onUpdateSelectedBlockStyle={handleUpdateSelectedBlockStyle}
        onApplySampleStructure={onApplySampleStructure}
        onClearToBlankSheet={onClearToBlankSheet}
        paperTheme={paperTheme}
        onUpdatePaperTheme={onUpdatePaperTheme}
        totalVariantsCount={totalVariantsCount}
      />

      {/* Bố cục 2 cột: Khung 1 (Thư viện khối kéo-thả bên trái) + Tờ giấy A4 bên phải */}
      <div
        className={
          editMode
            ? 'grid grid-cols-1 items-start gap-6 lg:grid-cols-[264px_minmax(0,1fr)]'
            : 'flex flex-col'
        }
      >
        {editMode && (
          <ExamBlockPalette
            onInsertBlock={handleQuickInsertFromPalette}
            onDragStartBlock={(kind) => setDragPaletteKind(kind)}
            onDragEndBlock={() => {
              setDragPaletteKind(null);
              setDropPaletteIdx(null);
            }}
          />
        )}

        {/* Tờ giấy A4 tương tác */}
        <div className="relative mx-auto w-full max-w-4xl">
          {switchingCode && (
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface-card/80 backdrop-blur-[2px] transition-opacity"
            >
              <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-card px-5 py-3 shadow-md">
                <Spinner className="h-5 w-5 text-brand-red" />
                <span className="text-sm font-semibold text-ink-primary">
                  Đang tải Mã đề {switchingCode}...
                </span>
              </div>
            </div>
          )}
          <article
          onDragOver={(e) => {
            if (!editMode || dragPaletteKind === null || blocks.length > 0) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (dropPaletteIdx !== 0) setDropPaletteIdx(0);
          }}
          onDrop={(e) => {
            if (!editMode || blocks.length > 0) return;
            const droppedPalette = (e.dataTransfer.getData('application/x-avc-exam-palette') ||
              dragPaletteKind) as PaletteBlockKind | '';
            if (droppedPalette) {
              e.preventDefault();
              insertNewBlockAt(droppedPalette, 0);
            }
            setDragPaletteKind(null);
            setDropPaletteIdx(null);
          }}
          className={`mx-auto min-h-[680px] w-full max-w-4xl rounded-2xl border bg-surface-bright p-6 text-ink-card shadow-sm transition-colors sm:p-10 ${
            blocks.length === 0 && dragPaletteKind !== null
              ? 'border-2 border-dashed border-brand-red bg-brand-redSoft/20'
              : 'border-line'
          }`}
          style={{
            fontFamily: fontStack,
            fontSize: `${paperTheme.baseFontSizePt}pt`,
            lineHeight: paperTheme.lineHeight,
          }}
        >
          {blocks.length === 0 ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center gap-4 text-center font-sans">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navySoft text-brand-navy">
                <LayoutTemplate className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="flex max-w-md flex-col gap-2">
                <h3 className="text-base font-bold text-brand-navy">
                  Trang A4 trống — Sẵn sàng tự thiết kế đề thi
                </h3>
                <p className="text-sm font-normal text-ink-secondary">
                  Kéo thả từng khung từ cột <strong>Khung cơ bản đề thi</strong> bên trái vào trang
                  giấy này để tự sắp xếp theo ý muốn, hoặc dùng nhanh cấu trúc đề thi mẫu bên dưới.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button variant="primary" onClick={onApplySampleStructure}>
                  <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                  <span>Cấu trúc đề thi mẫu</span>
                </Button>
                <Button variant="secondary" onClick={() => onInsertMixedQuestionsAt(0)}>
                  <ListOrdered className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                  <span>
                    Chèn toàn bộ {(variant.sourceMixedQuestions ?? variant.questions).length} câu đã
                    trộn
                  </span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
          {blocks.map((block, index) => {
            const isSelected = editMode && selectedBlockId === block.id;
            const isDropTarget =
              editMode &&
              ((dropBlockIdx === index && dragBlockIdx !== null && dragBlockIdx !== index) ||
                (dropPaletteIdx === index && dragPaletteKind !== null));

            const blockInlineStyle = {
              textAlign: block.style?.textAlign,
              color: block.style?.color,
              backgroundColor:
                block.style?.backgroundColor && block.style.backgroundColor !== 'transparent'
                  ? block.style.backgroundColor
                  : undefined,
              fontSize: block.style?.fontSizePt ? `${block.style.fontSizePt}pt` : undefined,
            };

            return (
              <div
                key={block.id}
                draggable={editMode}
                onClick={() => {
                  if (editMode) setSelectedBlockId(block.id);
                }}
                onDragStart={(e) => {
                  if (!editMode) return;
                  if (dragOptionState || dragPaletteKind) return;
                  setDragBlockIdx(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (!editMode || dragOptionState) return;
                  if (dragPaletteKind !== null) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    if (dropPaletteIdx !== index) setDropPaletteIdx(index);
                    return;
                  }
                  if (dragBlockIdx === null) return;
                  e.preventDefault();
                  if (dropBlockIdx !== index) setDropBlockIdx(index);
                }}
                onDrop={(e) => {
                  if (!editMode || dragOptionState) return;
                  const droppedPalette = (e.dataTransfer.getData('application/x-avc-exam-palette') ||
                    dragPaletteKind) as PaletteBlockKind | '';
                  if (droppedPalette) {
                    e.preventDefault();
                    insertNewBlockAt(droppedPalette, index);
                    setDragPaletteKind(null);
                    setDropPaletteIdx(null);
                    return;
                  }
                  if (dragBlockIdx === null) return;
                  e.preventDefault();
                  handleMoveBlock(dragBlockIdx, index);
                  setDragBlockIdx(null);
                  setDropBlockIdx(null);
                }}
                onDragEnd={() => {
                  setDragBlockIdx(null);
                  setDropBlockIdx(null);
                }}
                className={`group relative rounded-xl transition-all ${
                  editMode ? 'border p-4' : 'py-1'
                } ${
                  isSelected
                    ? 'border-brand-navy ring-2 ring-brand-navy/20'
                    : editMode
                      ? 'border-transparent hover:border-line-strong'
                      : ''
                } ${isDropTarget ? 'border-t-4 border-t-brand-red' : ''}`}
              >
                {editMode && dropPaletteIdx === index && dragPaletteKind !== null && (
                  <div className="mb-2 rounded-lg bg-brand-redSoft px-4 py-1 text-center font-sans text-xs font-semibold text-brand-red">
                    Thả vào đây để chèn khối mới phía trên mục này
                  </div>
                )}
                {/* Thanh thao tác nhỏ của từng khối khi bật Chỉnh sửa */}
                {editMode && (
                  <div
                    className={`mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 font-sans text-xs transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex cursor-grab items-center gap-1 rounded bg-surface-page px-2 py-1 font-semibold text-ink-secondary active:cursor-grabbing"
                        title="Kéo thả để di chuyển khối này"
                      >
                        <GripVertical className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                        <span>
                          {block.type === 'header'
                            ? 'Tiêu đề đề thi'
                            : block.type === 'student_info'
                              ? 'Thông tin thí sinh & Mã đề'
                              : block.type === 'score_box'
                                ? 'Khung điểm & Chữ ký GK'
                                : block.type === 'essay_section'
                                  ? 'Phần tự luận'
                                  : block.type === 'essay_lines'
                                    ? 'Khung dòng kẻ Bài làm'
                                    : block.type === 'section_text'
                                      ? 'Khối tiêu đề / đoạn văn'
                                      : block.type === 'footer'
                                        ? 'Chân trang & Chữ ký'
                                        : `Câu ${block.question.number}`}
                        </span>
                      </span>

                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveBlock(index, index - 1);
                        }}
                        title="Đưa lên trên"
                        aria-label="Đưa khối lên trên"
                        className="flex h-7 w-7 items-center justify-center rounded border border-line bg-surface-card text-ink-secondary hover:border-brand-navy disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === blocks.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveBlock(index, index + 1);
                        }}
                        title="Đưa xuống dưới"
                        aria-label="Đưa khối xuống dưới"
                        className="flex h-7 w-7 items-center justify-center rounded border border-line bg-surface-card text-ink-secondary hover:border-brand-navy disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {(block.type === 'question' || block.type === 'section_text') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTriggerImageUpload(block.id);
                          }}
                          title="Chèn ảnh minh họa"
                          className="inline-flex items-center gap-1 rounded border border-line bg-surface-card px-2 py-1 font-semibold text-ink-secondary hover:border-brand-navy hover:text-brand-navy"
                        >
                          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Chèn ảnh</span>
                        </button>
                      )}

                      {block.type === 'score_box' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateBlockById(
                              block.id,
                              (b) =>
                                b.type === 'score_box'
                                  ? { ...b, showCodeSlot: !b.showCodeSlot }
                                  : b,
                              true
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded border border-line bg-surface-card px-2 py-1 font-semibold text-brand-navy hover:bg-brand-navySoft"
                        >
                          <span>{block.showCodeSlot ? 'Ẩn cột Mã phách' : 'Hiện cột Mã phách'}</span>
                        </button>
                      )}

                      {block.type === 'essay_lines' && (
                        <div className="flex items-center gap-1">
                          {[5, 8, 12, 16].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBlockById(
                                  block.id,
                                  (b) => (b.type === 'essay_lines' ? { ...b, lineCount: cnt } : b),
                                  true
                                );
                              }}
                              className={`rounded border px-2 py-1 font-semibold ${
                                block.lineCount === cnt
                                  ? 'border-brand-navy bg-brand-navy text-white'
                                  : 'border-line bg-surface-card text-ink-secondary hover:border-brand-navy'
                              }`}
                            >
                              {cnt} dòng
                            </button>
                          ))}
                        </div>
                      )}

                      {block.type === 'footer' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateBlockById(
                              block.id,
                              (b) =>
                                b.type === 'footer'
                                  ? { ...b, showSignatures: !b.showSignatures }
                                  : b,
                              true
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded border border-line bg-surface-card px-2 py-1 font-semibold text-brand-navy hover:bg-brand-navySoft"
                        >
                          <span>{block.showSignatures ? 'Ẩn chữ ký' : 'Hiện chữ ký'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateBlock(index);
                        }}
                        title="Nhân bản khối"
                        aria-label="Nhân bản khối"
                        className="flex h-7 w-7 items-center justify-center rounded border border-line bg-surface-card text-ink-secondary hover:border-brand-navy hover:text-brand-navy"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteBlockTarget(block);
                        }}
                        title="Xóa khối này"
                        aria-label="Xóa khối"
                        className="flex h-7 w-7 items-center justify-center rounded border border-line bg-surface-card text-brand-red hover:bg-brand-redSoft"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}

                {/* NỘI DUNG TỪNG LOẠI KHỐI */}
                <div style={blockInlineStyle}>
                  {block.type === 'header' && (
                    <div className="grid grid-cols-1 gap-4 border-b border-line pb-4 sm:grid-cols-2">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <RichTextEditable
                          html={block.schoolHtml}
                          editable={editMode}
                          ariaLabel="Tên trường"
                          className="font-bold uppercase"
                          style={{ color: paperTheme.accentColor }}
                          onFocusField={() => setSelectedBlockId(block.id)}
                          onChange={(nextHtml) =>
                            updateBlockById(block.id, (b) =>
                              b.type === 'header' ? { ...b, schoolHtml: nextHtml } : b
                            )
                          }
                        />
                        <RichTextEditable
                          html={block.departmentHtml}
                          editable={editMode}
                          ariaLabel="Tên khoa hoặc bộ môn"
                          placeholder="Thêm tên Khoa / Bộ môn..."
                          className="font-semibold uppercase"
                          onFocusField={() => setSelectedBlockId(block.id)}
                          onChange={(nextHtml) =>
                            updateBlockById(block.id, (b) =>
                              b.type === 'header' ? { ...b, departmentHtml: nextHtml } : b
                            )
                          }
                        />
                      </div>

                      <div className="flex flex-col items-center gap-1 text-center">
                        <RichTextEditable
                          html={block.examTitleHtml}
                          editable={editMode}
                          ariaLabel="Tiêu đề kỳ thi"
                          className="font-bold uppercase"
                          style={{ color: paperTheme.accentColor }}
                          onFocusField={() => setSelectedBlockId(block.id)}
                          onChange={(nextHtml) =>
                            updateBlockById(block.id, (b) =>
                              b.type === 'header' ? { ...b, examTitleHtml: nextHtml } : b
                            )
                          }
                        />
                        <RichTextEditable
                          html={block.subjectHtml}
                          editable={editMode}
                          ariaLabel="Môn học"
                          placeholder="Thêm tên môn học..."
                          className="font-semibold"
                          onFocusField={() => setSelectedBlockId(block.id)}
                          onChange={(nextHtml) =>
                            updateBlockById(block.id, (b) =>
                              b.type === 'header' ? { ...b, subjectHtml: nextHtml } : b
                            )
                          }
                        />
                        <RichTextEditable
                          html={block.durationHtml}
                          editable={editMode}
                          ariaLabel="Thời gian làm bài và học kỳ"
                          placeholder="Thời gian làm bài..."
                          onFocusField={() => setSelectedBlockId(block.id)}
                          onChange={(nextHtml) =>
                            updateBlockById(block.id, (b) =>
                              b.type === 'header' ? { ...b, durationHtml: nextHtml } : b
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  {block.type === 'student_info' && (
                    <div className="flex flex-col gap-2 border-b border-line pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <RichTextEditable
                            html={block.studentLineHtml}
                            editable={editMode}
                            ariaLabel="Dòng thông tin thí sinh"
                            onFocusField={() => setSelectedBlockId(block.id)}
                            onChange={(nextHtml) =>
                              updateBlockById(block.id, (b) =>
                                b.type === 'student_info'
                                  ? { ...b, studentLineHtml: nextHtml }
                                  : b
                              )
                            }
                          />
                        </div>
                        <div
                          className={`shrink-0 border-2 px-4 py-2 font-bold ${
                            paperTheme.codeBoxStyle === 'square' ? 'rounded-none' : 'rounded-lg'
                          } ${paperTheme.codeBoxStyle === 'filled' ? 'bg-surface-subtle' : ''}`}
                          style={{
                            borderColor: paperTheme.accentColor,
                            color: paperTheme.accentColor,
                          }}
                        >
                          {block.codeLabelPrefix || 'MÃ ĐỀ:'} {variant.code}
                        </div>
                      </div>
                      <RichTextEditable
                        html={block.notesHtml}
                        editable={editMode}
                        ariaLabel="Lưu ý cho thí sinh"
                        placeholder="Thêm lưu ý cho thí sinh..."
                        className="text-sm"
                        onFocusField={() => setSelectedBlockId(block.id)}
                        onChange={(nextHtml) =>
                          updateBlockById(block.id, (b) =>
                            b.type === 'student_info' ? { ...b, notesHtml: nextHtml } : b
                          )
                        }
                      />
                    </div>
                  )}

                  {block.type === 'section_text' && (
                    <div className="flex flex-col gap-2">
                      <RichTextEditable
                        html={block.contentHtml}
                        editable={editMode}
                        ariaLabel="Nội dung khối tiêu đề hoặc đoạn văn"
                        placeholder="Nhập tiêu đề phần thi, đoạn đọc hiểu hoặc hướng dẫn..."
                        onFocusField={() => setSelectedBlockId(block.id)}
                        onChange={(nextHtml) =>
                          updateBlockById(block.id, (b) =>
                            b.type === 'section_text' ? { ...b, contentHtml: nextHtml } : b
                          )
                        }
                      />
                      {isSafeImageDataUrl(block.imageUrl) && (
                        <div className="relative mx-auto mt-2 inline-block">
                          <img
                            src={block.imageUrl}
                            alt="Ảnh minh họa phần thi"
                            className="max-h-64 rounded-lg border border-line object-contain"
                          />
                          {editMode && (
                            <button
                              type="button"
                              onClick={() =>
                                updateBlockById(
                                  block.id,
                                  (b) =>
                                    b.type === 'section_text' ? { ...b, imageUrl: undefined } : b,
                                  true
                                )
                              }
                              aria-label="Gỡ ảnh minh họa"
                              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-red text-white shadow"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {block.type === 'question' && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <span
                          className="shrink-0 font-bold"
                          style={{ color: paperTheme.accentColor }}
                        >
                          Câu {block.question.number}:
                        </span>
                        <RichTextEditable
                          html={block.question.promptHtml ?? block.question.prompt}
                          editable={editMode}
                          ariaLabel={`Nội dung câu ${block.question.number}`}
                          className="min-w-0 flex-1 font-semibold"
                          onFocusField={() => setSelectedBlockId(block.id)}
                          onChange={(nextHtml) =>
                            updateBlockById(block.id, (b) =>
                              b.type === 'question'
                                ? {
                                    ...b,
                                    question: { ...b.question, promptHtml: nextHtml },
                                  }
                                : b
                            )
                          }
                        />
                      </div>

                      {isSafeImageDataUrl(block.question.imageUrl) && (
                        <div className="relative my-2 inline-block pl-6">
                          <img
                            src={block.question.imageUrl}
                            alt={`Ảnh minh họa câu ${block.question.number}`}
                            className="max-h-56 rounded-lg border border-line object-contain"
                          />
                          {editMode && (
                            <button
                              type="button"
                              onClick={() =>
                                updateBlockById(
                                  block.id,
                                  (b) =>
                                    b.type === 'question'
                                      ? {
                                          ...b,
                                          question: { ...b.question, imageUrl: undefined },
                                        }
                                      : b,
                                  true
                                )
                              }
                              aria-label="Gỡ ảnh câu hỏi"
                              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-red text-white shadow"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}

                      <div className={`grid gap-2 pl-4 ${getOptionGridClass(block.question)}`}>
                        {block.question.options.map((opt, optIdx) => {
                          const highlightCorrect = showAnswersPreview && opt.isCorrect;
                          return (
                            <div
                              key={`${block.id}-opt-${optIdx}`}
                              draggable={editMode}
                              onDragStart={(e) => {
                                if (!editMode) return;
                                e.stopPropagation();
                                setDragOptionState({ blockId: block.id, optIdx });
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => {
                                if (!editMode || dragOptionState?.blockId !== block.id) return;
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                if (!editMode || dragOptionState?.blockId !== block.id) return;
                                e.preventDefault();
                                e.stopPropagation();
                                const fromIdx = dragOptionState.optIdx;
                                setDragOptionState(null);
                                if (fromIdx !== optIdx) {
                                  updateBlockById(
                                    block.id,
                                    (b) =>
                                      b.type === 'question'
                                        ? {
                                            ...b,
                                            question: {
                                              ...b.question,
                                              options: reorderItems(
                                                b.question.options,
                                                fromIdx,
                                                optIdx
                                              ),
                                            },
                                          }
                                        : b,
                                    true
                                  );
                                }
                              }}
                              onDragEnd={() => setDragOptionState(null)}
                              className={`flex items-start gap-2 rounded-lg border px-2 py-2 ${
                                highlightCorrect
                                  ? 'border-status-successBorder bg-status-successBg text-status-successText'
                                  : editMode
                                    ? 'border-line bg-surface-page/40'
                                    : 'border-transparent'
                              }`}
                            >
                              {editMode && (
                                <span
                                  className="mt-1 cursor-grab text-ink-muted active:cursor-grabbing"
                                  title="Kéo để đổi vị trí phương án"
                                >
                                  <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                              )}

                              {editMode ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateBlockById(
                                      block.id,
                                      (b) =>
                                        b.type === 'question'
                                          ? {
                                              ...b,
                                              question: {
                                                ...b.question,
                                                options: b.question.options.map((o, i) => ({
                                                  ...o,
                                                  isCorrect: i === optIdx,
                                                })),
                                              },
                                            }
                                          : b,
                                      true
                                    );
                                  }}
                                  title="Bấm để đánh dấu đây là đáp án đúng"
                                  className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 font-sans text-xs font-bold transition-colors ${
                                    opt.isCorrect
                                      ? 'bg-status-successText text-white'
                                      : 'bg-surface-subtle text-brand-navy hover:bg-brand-navy hover:text-white'
                                  }`}
                                >
                                  <span>{opt.letter}.</span>
                                  {opt.isCorrect && <Check className="h-3 w-3" aria-hidden="true" />}
                                </button>
                              ) : (
                                <span className="shrink-0 font-bold">{opt.letter}.</span>
                              )}

                              <RichTextEditable
                                html={opt.textHtml ?? opt.text}
                                editable={editMode}
                                tag="span"
                                ariaLabel={`Phương án ${opt.letter} câu ${block.question.number}`}
                                className="min-w-0 flex-1"
                                onFocusField={() => setSelectedBlockId(block.id)}
                                onChange={(nextHtml) =>
                                  updateBlockById(block.id, (b) =>
                                    b.type === 'question'
                                      ? {
                                          ...b,
                                          question: {
                                            ...b.question,
                                            options: b.question.options.map((o, i) =>
                                              i === optIdx ? { ...o, textHtml: nextHtml } : o
                                            ),
                                          },
                                        }
                                      : b
                                  )
                                }
                              />

                              {editMode && block.question.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateBlockById(
                                      block.id,
                                      (b) =>
                                        b.type === 'question'
                                          ? {
                                              ...b,
                                              question: {
                                                ...b.question,
                                                options: b.question.options.filter(
                                                  (_, i) => i !== optIdx
                                                ),
                                              },
                                            }
                                          : b,
                                      true
                                    );
                                  }}
                                  title="Xóa phương án này"
                                  aria-label={`Xóa phương án ${opt.letter}`}
                                  className="shrink-0 rounded p-1 text-ink-muted hover:bg-brand-redSoft hover:text-brand-red"
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {editMode && block.question.options.length < OPTION_LETTERS.length && (
                        <div className="pl-4 pt-1 font-sans">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              updateBlockById(
                                block.id,
                                (b) =>
                                  b.type === 'question'
                                    ? {
                                        ...b,
                                        question: {
                                          ...b.question,
                                          options: [
                                            ...b.question.options,
                                            {
                                              sourceOptionId: createExamId('opt'),
                                              letter:
                                                OPTION_LETTERS[b.question.options.length] ?? 'E',
                                              text: 'Phương án mới',
                                              textHtml: 'Phương án mới',
                                              isCorrect: false,
                                            },
                                          ],
                                        },
                                      }
                                    : b,
                                true
                              )
                            }
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Thêm phương án</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {block.type === 'score_box' && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-ink-card text-center text-xs">
                        <thead>
                          <tr>
                            <th className="border border-ink-card p-2">
                              <RichTextEditable
                                html={block.scoreNumHtml}
                                editable={editMode}
                                ariaLabel="Tiêu đề cột điểm số"
                                onFocusField={() => setSelectedBlockId(block.id)}
                                onChange={(nextHtml) =>
                                  updateBlockById(block.id, (b) =>
                                    b.type === 'score_box' ? { ...b, scoreNumHtml: nextHtml } : b
                                  )
                                }
                              />
                            </th>
                            <th className="border border-ink-card p-2">
                              <RichTextEditable
                                html={block.scoreTextHtml}
                                editable={editMode}
                                ariaLabel="Tiêu đề cột điểm chữ"
                                onFocusField={() => setSelectedBlockId(block.id)}
                                onChange={(nextHtml) =>
                                  updateBlockById(block.id, (b) =>
                                    b.type === 'score_box' ? { ...b, scoreTextHtml: nextHtml } : b
                                  )
                                }
                              />
                            </th>
                            <th className="border border-ink-card p-2">
                              <RichTextEditable
                                html={block.examiner1Html}
                                editable={editMode}
                                ariaLabel="Tiêu đề cột chữ ký GK1"
                                onFocusField={() => setSelectedBlockId(block.id)}
                                onChange={(nextHtml) =>
                                  updateBlockById(block.id, (b) =>
                                    b.type === 'score_box' ? { ...b, examiner1Html: nextHtml } : b
                                  )
                                }
                              />
                            </th>
                            <th className="border border-ink-card p-2">
                              <RichTextEditable
                                html={block.examiner2Html}
                                editable={editMode}
                                ariaLabel="Tiêu đề cột chữ ký GK2"
                                onFocusField={() => setSelectedBlockId(block.id)}
                                onChange={(nextHtml) =>
                                  updateBlockById(block.id, (b) =>
                                    b.type === 'score_box' ? { ...b, examiner2Html: nextHtml } : b
                                  )
                                }
                              />
                            </th>
                            {block.showCodeSlot && (
                              <th className="border border-ink-card p-2">
                                <RichTextEditable
                                  html={block.codeSlotHtml}
                                  editable={editMode}
                                  ariaLabel="Tiêu đề cột mã phách"
                                  onFocusField={() => setSelectedBlockId(block.id)}
                                  onChange={(nextHtml) =>
                                    updateBlockById(block.id, (b) =>
                                      b.type === 'score_box' ? { ...b, codeSlotHtml: nextHtml } : b
                                    )
                                  }
                                />
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="h-14 border border-ink-card" />
                            <td className="h-14 border border-ink-card" />
                            <td className="h-14 border border-ink-card" />
                            <td className="h-14 border border-ink-card" />
                            {block.showCodeSlot && <td className="h-14 border border-ink-card" />}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {block.type === 'essay_section' && (
                    <div className="flex flex-col gap-4">
                      {/* Khung tiêu đề Phần tự luận + nút + thêm hướng dẫn */}
                      <div
                        className={`flex flex-col gap-2 ${
                          editMode
                            ? 'rounded-xl border border-line bg-surface-page/40 p-3'
                            : ''
                        }`}
                      >
                        <RichTextEditable
                          html={block.titleHtml}
                          editable={editMode}
                          ariaLabel="Tiêu đề phần tự luận"
                          onFocusField={() => setSelectedBlockId(block.id)}
                          onChange={(nextHtml) =>
                            updateBlockById(block.id, (b) =>
                              b.type === 'essay_section' ? { ...b, titleHtml: nextHtml } : b
                            )
                          }
                        />

                        {block.showNote && (
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <RichTextEditable
                                html={block.noteHtml ?? ''}
                                editable={editMode}
                                ariaLabel="Ghi chú hoặc hướng dẫn phần tự luận"
                                placeholder="Nhập yêu cầu hoặc hướng dẫn làm bài tự luận..."
                                className="text-sm italic text-ink-secondary"
                                onFocusField={() => setSelectedBlockId(block.id)}
                                onChange={(nextHtml) =>
                                  updateBlockById(block.id, (b) =>
                                    b.type === 'essay_section' ? { ...b, noteHtml: nextHtml } : b
                                  )
                                }
                              />
                            </div>
                            {editMode && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateBlockById(
                                    block.id,
                                    (b) =>
                                      b.type === 'essay_section'
                                        ? { ...b, showNote: false, noteHtml: '' }
                                        : b,
                                    true
                                  );
                                }}
                                title="Ẩn dòng hướng dẫn"
                                aria-label="Ẩn dòng hướng dẫn"
                                className="shrink-0 rounded p-1 text-ink-muted hover:bg-brand-redSoft hover:text-brand-red"
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        )}

                        {editMode && !block.showNote && (
                          <div className="flex justify-center pt-1 font-sans">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBlockById(
                                  block.id,
                                  (b) =>
                                    b.type === 'essay_section'
                                      ? {
                                          ...b,
                                          showNote: true,
                                          noteHtml:
                                            b.noteHtml ||
                                            '<i>Thí sinh trình bày chi tiết các bước giải vào phần dòng kẻ bên dưới.</i>',
                                        }
                                      : b,
                                  true
                                );
                              }}
                              title="Thêm hướng dẫn / yêu cầu cho phần tự luận"
                              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong bg-surface-card px-3 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:border-brand-navy hover:text-brand-navy"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Thêm hướng dẫn / yêu cầu</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Danh sách các câu hỏi tự luận kèm dòng kẻ bài làm */}
                      <div className="flex flex-col gap-4">
                        {block.items.map((item, itemIdx) => (
                          <div
                            key={item.id}
                            className={`flex flex-col gap-2 ${
                              editMode
                                ? 'rounded-xl border border-line bg-surface-card p-3'
                                : ''
                            }`}
                          >
                            {editMode && (
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 font-sans text-xs">
                                <div className="flex items-center gap-1">
                                  <span className="rounded bg-brand-navySoft px-2 py-0.5 font-semibold text-brand-navy">
                                    Tự luận #{itemIdx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={itemIdx === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateBlockById(
                                        block.id,
                                        (b) =>
                                          b.type === 'essay_section'
                                            ? {
                                                ...b,
                                                items: reorderItems(b.items, itemIdx, itemIdx - 1),
                                              }
                                            : b,
                                        true
                                      );
                                    }}
                                    title="Đưa câu tự luận lên trên"
                                    aria-label="Đưa câu tự luận lên trên"
                                    className="flex h-6 w-6 items-center justify-center rounded border border-line bg-surface-card text-ink-secondary hover:border-brand-navy disabled:opacity-30"
                                  >
                                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={itemIdx === block.items.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateBlockById(
                                        block.id,
                                        (b) =>
                                          b.type === 'essay_section'
                                            ? {
                                                ...b,
                                                items: reorderItems(b.items, itemIdx, itemIdx + 1),
                                              }
                                            : b,
                                        true
                                      );
                                    }}
                                    title="Đưa câu tự luận xuống dưới"
                                    aria-label="Đưa câu tự luận xuống dưới"
                                    className="flex h-6 w-6 items-center justify-center rounded border border-line bg-surface-card text-ink-secondary hover:border-brand-navy disabled:opacity-30"
                                  >
                                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-1">
                                  {[0, 5, 8, 12, 16].map((cnt) => (
                                    <button
                                      key={cnt}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateBlockById(
                                          block.id,
                                          (b) =>
                                            b.type === 'essay_section'
                                              ? {
                                                  ...b,
                                                  items: b.items.map((it) =>
                                                    it.id === item.id
                                                      ? { ...it, lineCount: cnt }
                                                      : it
                                                  ),
                                                }
                                              : b,
                                          true
                                        );
                                      }}
                                      className={`rounded border px-2 py-0.5 font-semibold ${
                                        item.lineCount === cnt
                                          ? 'border-brand-navy bg-brand-navy text-white'
                                          : 'border-line bg-surface-card text-ink-secondary hover:border-brand-navy'
                                      }`}
                                    >
                                      {cnt === 0 ? 'Không kẻ' : `${cnt} dòng`}
                                    </button>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTriggerImageUpload(block.id, item.id);
                                    }}
                                    title="Chèn ảnh minh họa cho câu tự luận này"
                                    className="inline-flex items-center gap-1 rounded border border-line bg-surface-card px-2 py-0.5 font-semibold text-ink-secondary hover:border-brand-navy hover:text-brand-navy"
                                  >
                                    <ImagePlus className="h-3 w-3" aria-hidden="true" />
                                    <span>Ảnh</span>
                                  </button>

                                  {block.items.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateBlockById(
                                          block.id,
                                          (b) =>
                                            b.type === 'essay_section'
                                              ? {
                                                  ...b,
                                                  items: b.items.filter((it) => it.id !== item.id),
                                                }
                                              : b,
                                          true
                                        );
                                      }}
                                      title="Xóa câu tự luận này"
                                      aria-label={`Xóa câu tự luận ${itemIdx + 1}`}
                                      className="flex h-6 w-6 items-center justify-center rounded border border-line bg-surface-card text-brand-red hover:bg-brand-redSoft"
                                    >
                                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            <RichTextEditable
                              html={item.promptHtml}
                              editable={editMode}
                              ariaLabel={`Nội dung câu tự luận ${itemIdx + 1}`}
                              onFocusField={() => setSelectedBlockId(block.id)}
                              onChange={(nextHtml) =>
                                updateBlockById(block.id, (b) =>
                                  b.type === 'essay_section'
                                    ? {
                                        ...b,
                                        items: b.items.map((it) =>
                                          it.id === item.id ? { ...it, promptHtml: nextHtml } : it
                                        ),
                                      }
                                    : b
                                )
                              }
                            />

                            {item.imageUrl && isSafeImageDataUrl(item.imageUrl) && (
                              <div className="relative my-1 inline-block self-start">
                                <img
                                  src={item.imageUrl}
                                  alt={`Minh họa câu tự luận ${itemIdx + 1}`}
                                  className="max-h-56 rounded-lg border border-line object-contain"
                                />
                                {editMode && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateBlockById(
                                        block.id,
                                        (b) =>
                                          b.type === 'essay_section'
                                            ? {
                                                ...b,
                                                items: b.items.map((it) =>
                                                  it.id === item.id
                                                    ? { ...it, imageUrl: undefined }
                                                    : it
                                                ),
                                              }
                                            : b,
                                        true
                                      )
                                    }
                                    title="Xóa ảnh minh họa"
                                    aria-label="Xóa ảnh minh họa"
                                    className="absolute right-2 top-2 rounded-full bg-surface-card/90 p-1 text-brand-red shadow hover:bg-brand-redSoft"
                                  >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                )}
                              </div>
                            )}

                            {item.lineCount > 0 && (
                              <div className="flex flex-col gap-2 pt-1">
                                {Array.from({
                                  length: Math.max(0, Math.min(30, item.lineCount)),
                                }).map((_, lineIdx) => (
                                  <div
                                    key={`${item.id}-line-${lineIdx}`}
                                    className="h-6 border-b border-dotted border-ink-muted"
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Nút + Thêm câu tự luận ngay dưới cùng của khối */}
                        {editMode && (
                          <div className="flex justify-center pt-1 font-sans">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBlockById(
                                  block.id,
                                  (b) => {
                                    if (b.type !== 'essay_section') return b;
                                    const nextNum = b.items.length + 1;
                                    const prevLines =
                                      b.items[b.items.length - 1]?.lineCount ?? 5;
                                    return {
                                      ...b,
                                      items: [
                                        ...b.items,
                                        {
                                          id: createExamId('essay-q'),
                                          promptHtml: `<b>Câu ${nextNum}:</b> Nhập nội dung câu hỏi tự luận...`,
                                          lineCount: prevLines,
                                        },
                                      ],
                                    };
                                  },
                                  true
                                );
                              }}
                              title="Thêm 1 câu hỏi tự luận mới vào phần này"
                              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-brand-navy bg-brand-navySoft/40 px-4 py-1.5 text-xs font-semibold text-brand-navy transition-colors hover:bg-brand-navySoft"
                            >
                              <Plus className="h-4 w-4" aria-hidden="true" />
                              <span>Thêm câu tự luận</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {block.type === 'essay_lines' && (
                    <div className="flex flex-col gap-2">
                      <RichTextEditable
                        html={block.titleHtml}
                        editable={editMode}
                        ariaLabel="Tiêu đề phần bài làm"
                        onFocusField={() => setSelectedBlockId(block.id)}
                        onChange={(nextHtml) =>
                          updateBlockById(block.id, (b) =>
                            b.type === 'essay_lines' ? { ...b, titleHtml: nextHtml } : b
                          )
                        }
                      />
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: Math.max(1, Math.min(30, block.lineCount || 8)) }).map(
                          (_, lineIdx) => (
                            <div
                              key={`${block.id}-line-${lineIdx}`}
                              className="h-6 border-b border-dotted border-ink-muted"
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {block.type === 'footer' && (
                    <div className="flex flex-col gap-4 pt-2">
                      <RichTextEditable
                        html={block.endTextHtml}
                        editable={editMode}
                        ariaLabel="Dòng kết thúc đề thi"
                        className="text-center"
                        onFocusField={() => setSelectedBlockId(block.id)}
                        onChange={(nextHtml) =>
                          updateBlockById(block.id, (b) =>
                            b.type === 'footer' ? { ...b, endTextHtml: nextHtml } : b
                          )
                        }
                      />

                      {block.showSignatures && (
                        <div className="grid grid-cols-2 gap-6 pt-2 text-center">
                          <RichTextEditable
                            html={block.leftRoleHtml}
                            editable={editMode}
                            ariaLabel="Chữ ký bên trái"
                            className="pb-12"
                            onFocusField={() => setSelectedBlockId(block.id)}
                            onChange={(nextHtml) =>
                              updateBlockById(block.id, (b) =>
                                b.type === 'footer' ? { ...b, leftRoleHtml: nextHtml } : b
                              )
                            }
                          />
                          <RichTextEditable
                            html={block.rightRoleHtml}
                            editable={editMode}
                            ariaLabel="Chữ ký bên phải"
                            className="pb-12"
                            onFocusField={() => setSelectedBlockId(block.id)}
                            onChange={(nextHtml) =>
                              updateBlockById(block.id, (b) =>
                                b.type === 'footer' ? { ...b, rightRoleHtml: nextHtml } : b
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Vùng thả cuối tờ đề khi kéo khối mới từ thanh công cụ */}
          {editMode && dragPaletteKind !== null && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (dropPaletteIdx !== blocks.length) setDropPaletteIdx(blocks.length);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const droppedPalette = (e.dataTransfer.getData('application/x-avc-exam-palette') ||
                  dragPaletteKind) as PaletteBlockKind | '';
                if (droppedPalette) {
                  insertNewBlockAt(droppedPalette, blocks.length);
                }
                setDragPaletteKind(null);
                setDropPaletteIdx(null);
              }}
              className={`rounded-xl border-2 border-dashed p-4 text-center font-sans text-xs font-semibold transition-colors ${
                dropPaletteIdx === blocks.length
                  ? 'border-brand-red bg-brand-redSoft text-brand-red'
                  : 'border-line-strong bg-surface-page text-ink-secondary'
              }`}
            >
              Thả vào đây để chèn vào cuối tờ đề
            </div>
          )}
            </div>
          )}
        </article>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteBlockTarget)}
        onClose={() => setDeleteBlockTarget(null)}
        onConfirm={handleConfirmDeleteBlock}
        confirmVariant="danger"
        confirmLabel="Xóa khối"
        title="Xác nhận xóa khối khỏi tờ đề"
        message={
          deleteBlockTarget?.type === 'question'
            ? `Bạn chắc chắn muốn xóa Câu ${deleteBlockTarget.question.number}? Câu hỏi này sẽ bị xóa đồng bộ trên tất cả ${totalVariantsCount} mã đề và bảng đáp án sẽ tự động đánh số lại.`
            : `Bạn chắc chắn muốn xóa khối này khỏi tất cả ${totalVariantsCount} mã đề?`
        }
      />
    </div>
  );
}


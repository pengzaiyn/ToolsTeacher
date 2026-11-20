import {
  AlignJustify,
  ClipboardCheck,
  FilePlus2,
  GripVertical,
  Heading,
  IdCard,
  LayoutTemplate,
  ListOrdered,
  PenLine,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';

export type PaletteBlockKind =
  | 'header'
  | 'student_info'
  | 'score_box'
  | 'section_text'
  | 'mixed_questions'
  | 'question'
  | 'essay_section'
  | 'essay_lines'
  | 'footer';

interface PaletteItem {
  kind: PaletteBlockKind;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: 'navy' | 'red';
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    kind: 'header',
    title: 'Tiêu đề đề thi',
    description: 'Tên trường, khoa, kỳ thi, môn & thời gian',
    icon: Heading,
    accent: 'navy',
  },
  {
    kind: 'student_info',
    title: 'Thông tin thí sinh & Mã đề',
    description: 'Họ tên, lớp, MSV, SBD và khung mã đề',
    icon: IdCard,
    accent: 'navy',
  },
  {
    kind: 'score_box',
    title: 'Khung điểm & Chữ ký GK',
    description: 'Điểm số, điểm chữ, chữ ký GK1, GK2, phách',
    icon: ClipboardCheck,
    accent: 'red',
  },
  {
    kind: 'section_text',
    title: 'Tiêu đề phần / Đoạn văn',
    description: 'Phần I Trắc nghiệm, Phần II Tự luận, hướng dẫn',
    icon: FilePlus2,
    accent: 'navy',
  },
  {
    kind: 'mixed_questions',
    title: 'Toàn bộ câu hỏi đã trộn',
    description: 'Đổ toàn bộ câu hỏi đã trộn của từng mã đề vào tờ A4',
    icon: ListOrdered,
    accent: 'red',
  },
  {
    kind: 'question',
    title: 'Thêm 1 câu hỏi mới',
    description: 'Chèn thêm 1 câu hỏi trắc nghiệm tùy chỉnh',
    icon: PlusCircle,
    accent: 'navy',
  },
  {
    kind: 'essay_section',
    title: 'Phần tự luận',
    description: 'Tiêu đề tự luận, thêm câu hỏi & dòng kẻ bài làm',
    icon: PenLine,
    accent: 'red',
  },
  {
    kind: 'essay_lines',
    title: 'Khung dòng kẻ Bài làm',
    description: 'Dòng kẻ chấm cho phần làm bài tự luận',
    icon: AlignJustify,
    accent: 'navy',
  },
  {
    kind: 'footer',
    title: 'Chân trang & Ký duyệt',
    description: 'Dòng --- HẾT --- và chữ ký giảng viên / khoa',
    icon: LayoutTemplate,
    accent: 'navy',
  },
];

interface ExamBlockPaletteProps {
  onInsertBlock: (kind: PaletteBlockKind) => void;
  onDragStartBlock: (kind: PaletteBlockKind) => void;
  onDragEndBlock: () => void;
}

export function ExamBlockPalette({
  onInsertBlock,
  onDragStartBlock,
  onDragEndBlock,
}: ExamBlockPaletteProps) {
  return (
    <aside
      aria-label="Những khung cơ bản cần có trong đề thi"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-card p-4 lg:sticky lg:top-20"
    >
      <div className="flex flex-col gap-1 border-b border-line pb-3">
        <h3 className="text-sm font-bold text-brand-navy">Khung cơ bản đề thi</h3>
        <p className="text-xs font-normal text-ink-secondary">
          Kéo thả sang tờ đề bên phải hoặc bấm để chèn nhanh
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.kind}
              type="button"
              draggable
              onClick={() => onInsertBlock(item.kind)}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-avc-exam-palette', item.kind);
                e.dataTransfer.effectAllowed = 'copy';
                onDragStartBlock(item.kind);
              }}
              onDragEnd={onDragEndBlock}
              title={`Kéo thả "${item.title}" sang tờ đề hoặc bấm để chèn`}
              className="group flex min-w-[200px] shrink-0 cursor-grab items-start gap-2 rounded-xl border border-line bg-surface-page p-3 text-left transition-all hover:border-brand-navy hover:bg-surface-card hover:shadow-sm active:cursor-grabbing lg:min-w-0"
            >
              <GripVertical
                className="mt-1 h-4 w-4 shrink-0 text-ink-muted group-hover:text-brand-navy"
                aria-hidden="true"
              />
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  item.accent === 'red'
                    ? 'bg-brand-redSoft text-brand-red'
                    : 'bg-brand-navySoft text-brand-navy'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink-primary">{item.title}</p>
                <p className="mt-0.5 text-xs font-normal text-ink-muted">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}


import { useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Eraser,
  File,
  Highlighter,
  Italic,
  LayoutTemplate,
  Palette,
  PenLine,
  Redo2,
  SlidersHorizontal,
  Strikethrough,
  Subscript,
  Superscript,
  Type,
  Underline,
  Undo2,
} from 'lucide-react';
import type {
  ExamBlockStyle,
  ExamCodeBoxStyle,
  ExamOptionColumns,
  ExamPaperFont,
  ExamPaperTheme,
  ExamTextAlign,
} from '@/lib/examMixer';
import { EXAM_HIGHLIGHT_COLORS, EXAM_TEXT_COLORS } from '@/lib/examRichText';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

interface ExamFormatToolbarProps {
  editMode: boolean;
  onToggleEditMode: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedBlockStyle?: ExamBlockStyle;
  hasSelectedBlock: boolean;
  onUpdateSelectedBlockStyle: (patch: Partial<ExamBlockStyle>) => void;
  onApplySampleStructure: () => void;
  onClearToBlankSheet: () => void;
  paperTheme: ExamPaperTheme;
  onUpdatePaperTheme: (patch: Partial<ExamPaperTheme>) => void;
  totalVariantsCount?: number;
}

function execRichCommand(command: string, value?: string) {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return;
  document.execCommand(command, false, value);
}

export function ExamFormatToolbar({
  editMode,
  onToggleEditMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedBlockStyle,
  hasSelectedBlock,
  onUpdateSelectedBlockStyle,
  onApplySampleStructure,
  onClearToBlankSheet,
  paperTheme,
  onUpdatePaperTheme,
  totalVariantsCount = 1,
}: ExamFormatToolbarProps) {
  const [showTextColors, setShowTextColors] = useState(false);
  const [showBgColors, setShowBgColors] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);

  const activeAlign = selectedBlockStyle?.textAlign ?? 'left';

  return (
    <div className="sticky top-2 z-20 flex flex-col gap-3 rounded-2xl border border-line bg-surface-card p-3.5 shadow-sm">
      {/* Hàng 1: Chế độ chỉnh sửa, Mẫu cấu trúc & Kiểu tờ đề */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={editMode ? 'primary' : 'navy'}
            onClick={onToggleEditMode}
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            <span>{editMode ? 'Đang chỉnh sửa trực quan' : 'Bật chỉnh sửa trực quan'}</span>
          </Button>

          {editMode && (
            <>
              <Button size="sm" variant="navy" onClick={onApplySampleStructure}>
                <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                <span>Cấu trúc đề thi mẫu</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={onClearToBlankSheet}>
                <File className="h-4 w-4 text-ink-secondary" aria-hidden="true" />
                <span>Trang A4 trắng</span>
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editMode && totalVariantsCount > 1 && (
            <span className="inline-flex items-center rounded-full border border-status-successBorder bg-status-successBg px-2.5 py-1 text-xs font-semibold text-status-successText">
              Đồng bộ {totalVariantsCount} mã đề
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowThemePanel((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Kiểu tờ đề</span>
            {showThemePanel ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Hàng 2 (khi bật chỉnh sửa): Thanh định dạng chữ, màu sắc, căn lề & cỡ chữ */}
      {editMode && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
          <>
              <div className="flex items-center gap-1 border-r border-line pr-2">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={onUndo}
                  title="Hoàn tác"
                  aria-label="Hoàn tác"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-primary transition-colors hover:border-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={onRedo}
                  title="Làm lại"
                  aria-label="Làm lại"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-primary transition-colors hover:border-brand-navy disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Redo2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Định dạng văn bản đang bôi đen */}
              <div
                className="flex flex-wrap items-center gap-1 border-r border-line pr-2"
                role="group"
                aria-label="Định dạng chữ"
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execRichCommand('bold')}
                  title="In đậm (Ctrl+B)"
                  aria-label="In đậm"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-primary hover:border-brand-navy hover:bg-brand-navySoft"
                >
                  <Bold className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execRichCommand('italic')}
                  title="In nghiêng (Ctrl+I)"
                  aria-label="In nghiêng"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-primary hover:border-brand-navy hover:bg-brand-navySoft"
                >
                  <Italic className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execRichCommand('underline')}
                  title="Gạch chân (Ctrl+U)"
                  aria-label="Gạch chân"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-primary hover:border-brand-navy hover:bg-brand-navySoft"
                >
                  <Underline className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execRichCommand('strikeThrough')}
                  title="Gạch ngang"
                  aria-label="Gạch ngang"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-primary hover:border-brand-navy hover:bg-brand-navySoft"
                >
                  <Strikethrough className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execRichCommand('superscript')}
                  title="Chỉ số trên (x²)"
                  aria-label="Chỉ số trên"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-primary hover:border-brand-navy hover:bg-brand-navySoft"
                >
                  <Superscript className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execRichCommand('subscript')}
                  title="Chỉ số dưới (H₂O)"
                  aria-label="Chỉ số dưới"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-primary hover:border-brand-navy hover:bg-brand-navySoft"
                >
                  <Subscript className="h-4 w-4" aria-hidden="true" />
                </button>

                {/* Màu chữ */}
                <div className="relative">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowTextColors((v) => !v);
                      setShowBgColors(false);
                    }}
                    title="Màu chữ"
                    aria-label="Chọn màu chữ"
                    className="flex h-8 items-center gap-1 rounded-lg border border-line bg-surface-page px-2 text-xs font-semibold text-ink-primary hover:border-brand-navy hover:bg-brand-navySoft"
                  >
                    <Palette className="h-4 w-4 text-brand-red" aria-hidden="true" />
                    <span className="hidden sm:inline">Màu chữ</span>
                  </button>
                  {showTextColors && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      className="absolute left-0 top-10 z-30 flex w-56 flex-col gap-2 rounded-xl border border-line bg-surface-card p-3 shadow-lg"
                    >
                      <span className="text-xs font-semibold text-ink-secondary">
                        Đổi màu chữ đang bôi đen
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {EXAM_TEXT_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              execRichCommand('foreColor', c.value);
                              setShowTextColors(false);
                            }}
                            title={c.label}
                            aria-label={`Màu chữ ${c.label}`}
                            className="flex h-8 items-center justify-center rounded-lg border border-line transition-transform hover:scale-105"
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                      </div>
                      <label className="flex items-center justify-between gap-2 pt-1 text-xs font-semibold text-ink-secondary">
                        <span>Màu tự chọn:</span>
                        <input
                          id="custom-text-color-picker"
                          type="color"
                          defaultValue="#1A365D"
                          onChange={(e) => execRichCommand('foreColor', e.target.value)}
                          className="h-7 w-12 cursor-pointer rounded border border-line"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Màu nền nhấn (Highlight) */}
                <div className="relative">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowBgColors((v) => !v);
                      setShowTextColors(false);
                    }}
                    title="Tô nền chữ"
                    aria-label="Chọn màu nền chữ"
                    className="flex h-8 items-center gap-1 rounded-lg border border-line bg-surface-page px-2 text-xs font-semibold text-ink-primary hover:border-brand-navy hover:bg-brand-navySoft"
                  >
                    <Highlighter className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                    <span className="hidden sm:inline">Nền</span>
                  </button>
                  {showBgColors && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      className="absolute left-0 top-10 z-30 flex w-48 flex-col gap-2 rounded-xl border border-line bg-surface-card p-3 shadow-lg"
                    >
                      <span className="text-xs font-semibold text-ink-secondary">
                        Tô màu nền chữ
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {EXAM_HIGHLIGHT_COLORS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              execRichCommand('hiliteColor', c.value);
                              setShowBgColors(false);
                            }}
                            title={c.label}
                            aria-label={`Màu nền ${c.label}`}
                            className="flex h-8 items-center justify-center rounded-lg border border-line-strong text-xs font-semibold text-ink-primary"
                            style={{ backgroundColor: c.value }}
                          >
                            {c.value === 'transparent' ? 'Xóa' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execRichCommand('removeFormat')}
                  title="Xóa định dạng chữ đang chọn"
                  aria-label="Xóa định dạng"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-page text-ink-secondary hover:border-brand-red hover:text-brand-red"
                >
                  <Eraser className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Căn lề & Cỡ chữ khối đang chọn */}
              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label="Căn lề khối đang chọn"
              >
                {(
                  [
                    { value: 'left', icon: AlignLeft, label: 'Căn trái' },
                    { value: 'center', icon: AlignCenter, label: 'Căn giữa' },
                    { value: 'right', icon: AlignRight, label: 'Căn phải' },
                    { value: 'justify', icon: AlignJustify, label: 'Căn đều' },
                  ] as Array<{ value: ExamTextAlign; icon: typeof AlignLeft; label: string }>
                ).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      disabled={!hasSelectedBlock}
                      onClick={() => onUpdateSelectedBlockStyle({ textAlign: item.value })}
                      title={hasSelectedBlock ? item.label : 'Chọn 1 khối để căn lề'}
                      aria-label={item.label}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        hasSelectedBlock && activeAlign === item.value
                          ? 'border-brand-navy bg-brand-navy text-white'
                          : 'border-line bg-surface-page text-ink-primary hover:border-brand-navy'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  );
                })}

                <div className="ml-1 flex items-center gap-1">
                  <Type className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                  <select
                    id="selected-block-font-size"
                    aria-label="Cỡ chữ khối đang chọn"
                    disabled={!hasSelectedBlock}
                    value={selectedBlockStyle?.fontSizePt ? String(selectedBlockStyle.fontSizePt) : ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      onUpdateSelectedBlockStyle({ fontSizePt: val });
                    }}
                    className="h-8 rounded-lg border border-line bg-surface-page px-2 text-xs font-semibold text-ink-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <option value="">Cỡ mặc định</option>
                    <option value="11">11 pt</option>
                    <option value="12">12 pt</option>
                    <option value="13">13 pt</option>
                    <option value="14">14 pt</option>
                    <option value="16">16 pt</option>
                  </select>
                </div>
              </div>
            </>
          </div>
      )}

      {/* Panel tùy chỉnh kiểu tờ đề chung cho tất cả mã đề */}
      {showThemePanel && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-page p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Select
            label="Phông chữ in"
            value={paperTheme.fontFamily}
            onChange={(e) =>
              onUpdatePaperTheme({ fontFamily: e.target.value as ExamPaperFont })
            }
            options={[
              { value: 'Times New Roman', label: 'Times New Roman (Chuẩn)' },
              { value: 'Arial', label: 'Arial' },
              { value: 'Inter', label: 'Inter' },
              { value: 'Georgia', label: 'Georgia' },
            ]}
          />

          <Select
            label="Cỡ chữ chung"
            value={String(paperTheme.baseFontSizePt)}
            onChange={(e) =>
              onUpdatePaperTheme({ baseFontSizePt: Number(e.target.value) || 12.5 })
            }
            options={[
              { value: '11', label: '11 pt (Gọn)' },
              { value: '12', label: '12 pt' },
              { value: '12.5', label: '12.5 pt (Chuẩn)' },
              { value: '13', label: '13 pt' },
              { value: '14', label: '14 pt (To rõ)' },
            ]}
          />

          <Select
            label="Giãn dòng"
            value={String(paperTheme.lineHeight)}
            onChange={(e) =>
              onUpdatePaperTheme({ lineHeight: Number(e.target.value) || 1.4 })
            }
            options={[
              { value: '1.25', label: '1.25 (Tiết kiệm giấy)' },
              { value: '1.4', label: '1.4 (Chuẩn)' },
              { value: '1.6', label: '1.6 (Thoáng)' },
            ]}
          />

          <Select
            label="Số cột đáp án"
            value={String(paperTheme.optionColumns)}
            onChange={(e) => {
              const raw = e.target.value;
              const next: ExamOptionColumns =
                raw === 'auto' ? 'auto' : (Number(raw) as 1 | 2 | 4);
              onUpdatePaperTheme({ optionColumns: next });
            }}
            options={[
              { value: 'auto', label: 'Tự động (1–2 cột)' },
              { value: '1', label: '1 cột dọc' },
              { value: '2', label: '2 cột song song' },
              { value: '4', label: '4 cột ngang' },
            ]}
          />

          <Select
            label="Khung Mã đề"
            value={paperTheme.codeBoxStyle}
            onChange={(e) =>
              onUpdatePaperTheme({ codeBoxStyle: e.target.value as ExamCodeBoxStyle })
            }
            options={[
              { value: 'rounded', label: 'Viền bo góc' },
              { value: 'square', label: 'Viền vuông chuẩn' },
              { value: 'filled', label: 'Bo góc có nền nhẹ' },
            ]}
          />

          <div className="flex flex-col gap-2">
            <label
              htmlFor="paper-accent-color"
              className="text-sm font-semibold text-ink-primary"
            >
              Màu tiêu đề
            </label>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface-card px-2">
              {[
                { label: 'Đen (in trắng đen)', value: '#000000' },
                { label: 'Navy Việt Mỹ', value: '#1A365D' },
                { label: 'Đỏ Việt Mỹ', value: '#C8102E' },
              ].map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={`Màu tiêu đề ${c.label}`}
                  onClick={() => onUpdatePaperTheme({ accentColor: c.value })}
                  className={`h-6 w-6 rounded-full border-2 ${
                    paperTheme.accentColor.toUpperCase() === c.value
                      ? 'border-ink-primary ring-2 ring-brand-navy/30'
                      : 'border-line'
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
              <input
                id="paper-accent-color"
                type="color"
                value={paperTheme.accentColor}
                onChange={(e) => onUpdatePaperTheme({ accentColor: e.target.value })}
                aria-label="Chọn màu tiêu đề tùy chỉnh"
                className="ml-auto h-7 w-8 cursor-pointer rounded border border-line"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


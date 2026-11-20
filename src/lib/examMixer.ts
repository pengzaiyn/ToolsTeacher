import { htmlToPlainText, plainTextToHtml, sanitizeExamHtml } from '@/lib/examRichText';

export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const OPTION_LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E', 'F'];

export type ExamPaperFont = 'Times New Roman' | 'Arial' | 'Inter' | 'Georgia';
export type ExamOptionColumns = 'auto' | 1 | 2 | 4;
export type ExamCodeBoxStyle = 'square' | 'rounded' | 'filled';
export type ExamTextAlign = 'left' | 'center' | 'right' | 'justify';

export interface ExamPaperTheme {
  fontFamily: ExamPaperFont;
  baseFontSizePt: number;
  lineHeight: number;
  optionColumns: ExamOptionColumns;
  accentColor: string;
  codeBoxStyle: ExamCodeBoxStyle;
}

export const DEFAULT_EXAM_PAPER_THEME: ExamPaperTheme = {
  fontFamily: 'Times New Roman',
  baseFontSizePt: 12.5,
  lineHeight: 1.4,
  optionColumns: 'auto',
  accentColor: '#1A365D',
  codeBoxStyle: 'rounded',
};

export interface ExamBlockStyle {
  textAlign?: ExamTextAlign;
  color?: string;
  backgroundColor?: string;
  fontSizePt?: number;
}

export interface ExamHeaderBlock {
  id: string;
  type: 'header';
  schoolHtml: string;
  departmentHtml: string;
  examTitleHtml: string;
  subjectHtml: string;
  durationHtml: string;
  style?: ExamBlockStyle;
}

export interface ExamStudentInfoBlock {
  id: string;
  type: 'student_info';
  studentLineHtml: string;
  notesHtml: string;
  codeLabelPrefix: string;
  style?: ExamBlockStyle;
}

export interface ExamSectionTextBlock {
  id: string;
  type: 'section_text';
  contentHtml: string;
  imageUrl?: string;
  style?: ExamBlockStyle;
}

export interface ExamQuestionBlock {
  id: string;
  type: 'question';
  question: MixedExamQuestion;
  style?: ExamBlockStyle;
}

export interface ExamFooterBlock {
  id: string;
  type: 'footer';
  endTextHtml: string;
  showSignatures: boolean;
  leftRoleHtml: string;
  rightRoleHtml: string;
  style?: ExamBlockStyle;
}

export interface ExamScoreBoxBlock {
  id: string;
  type: 'score_box';
  scoreNumHtml: string;
  scoreTextHtml: string;
  examiner1Html: string;
  examiner2Html: string;
  codeSlotHtml: string;
  showCodeSlot: boolean;
  style?: ExamBlockStyle;
}

export interface ExamEssayLinesBlock {
  id: string;
  type: 'essay_lines';
  titleHtml: string;
  lineCount: number;
  style?: ExamBlockStyle;
}

export interface ExamEssayQuestionItem {
  id: string;
  promptHtml: string;
  imageUrl?: string;
  lineCount: number;
}

export interface ExamEssaySectionBlock {
  id: string;
  type: 'essay_section';
  titleHtml: string;
  noteHtml?: string;
  showNote?: boolean;
  items: ExamEssayQuestionItem[];
  style?: ExamBlockStyle;
}

export type ExamPaperBlock =
  | ExamHeaderBlock
  | ExamStudentInfoBlock
  | ExamScoreBoxBlock
  | ExamSectionTextBlock
  | ExamQuestionBlock
  | ExamEssaySectionBlock
  | ExamEssayLinesBlock
  | ExamFooterBlock;

export interface ExamOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ExamQuestion {
  id: string;
  prompt: string;
  options: ExamOption[];
  group?: string;
  explanation?: string;
}

export interface ExamMetadata {
  schoolName: string;
  department: string;
  examTitle: string;
  subject: string;
  durationMinutes: number;
  semester: string;
  notes: string;
}

export interface ExamMixConfig {
  examCodes: string[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  keepCompoundOptionAtEnd: boolean;
  questionCount: number;
  seed?: number;
}

export interface MixedExamOption {
  sourceOptionId?: string;
  letter: OptionLetter;
  text: string;
  textHtml?: string;
  isCorrect: boolean;
}

export interface MixedExamQuestion {
  number: number;
  sourceQuestionId: string;
  prompt: string;
  promptHtml?: string;
  imageUrl?: string;
  options: MixedExamOption[];
  correctLetter: OptionLetter;
  group?: string;
  explanation?: string;
}

export interface MixedExamVariant {
  code: string;
  questions: MixedExamQuestion[];
  sourceMixedQuestions?: MixedExamQuestion[];
  answerKey: Record<number, OptionLetter>;
  blocks?: ExamPaperBlock[];
}

export interface QuestionValidation {
  questionId: string;
  valid: boolean;
  errors: string[];
}

export interface ParseTextResult {
  questions: ExamQuestion[];
  warnings: string[];
  autoMatchedAnswersCount?: number;
  essaySectionText?: string;
}

export const DEFAULT_EXAM_METADATA: ExamMetadata = {
  schoolName: 'TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI',
  department: 'KHOA CÔNG NGHỆ THÔNG TIN',
  examTitle: 'ĐỀ THI KẾT THÚC HỌC PHẦN',
  subject: '',
  durationMinutes: 45,
  semester: 'Năm học 2026 - 2027',
  notes: 'Thí sinh không được sử dụng tài liệu. Giám thị không giải thích gì thêm.',
};

let uidCounter = 0;

export function createExamId(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function normalizeViText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiểm tra phương án có tham chiếu tới ký tự đáp án cụ thể (VD: "Cả A và B đều đúng", "A và C đúng").
 * Nếu có, toàn bộ câu hỏi này không nên đảo vị trí đáp án để tránh làm sai ngữ nghĩa tham chiếu.
 */
export function hasExplicitLetterReference(optionText: string): boolean {
  const plain = normalizeViText(optionText);
  return (
    /\bca\s+[a-f]\s*(va|hoac|,|&)\s*[a-f]\b/.test(plain) ||
    /\b[a-f]\s*(va|hoac|,|&)\s*[a-f](\s*(deu\s+)?(dung|sai))?\b/.test(plain) ||
    /\bdap an\s+[a-f]\s*(va|hoac|,|&)\s*[a-f]\b/.test(plain)
  );
}

/**
 * Kiểm tra phương án tổng hợp chung nên ghim ở cuối khi đảo các phương án còn lại
 * (VD: "Tất cả các đáp án trên đều đúng", "Ba câu trên đều đúng", "Không có đáp án nào đúng", "Đáp án khác").
 */
export function isPinnedEndOption(optionText: string): boolean {
  const plain = normalizeViText(optionText);
  return (
    /\btat ca(\s+cac)?(\s+(dap an|phuong an|y|cau))?(\s+tren)?(\s+deu)?\s+(dung|sai)\b/.test(
      plain
    ) ||
    /\b(ca\s+)?(2|hai|3|ba|4|bon)\s+(dap an|phuong an|y|cau)(\s+tren)?(\s+deu)?(\s+(dung|sai))?\b/.test(
      plain
    ) ||
    /\bkhong co\s+(dap an|phuong an|cau tra loi)\s+nao(\s+(dung|phu hop))?\b/.test(plain) ||
    /\b(dap an|phuong an|y kien)\s+khac\b/.test(plain)
  );
}

export function validateQuestion(question: ExamQuestion): QuestionValidation {
  const errors: string[] = [];
  if (!question.prompt.trim()) {
    errors.push('Thiếu nội dung câu hỏi');
  }
  if (question.options.length < 2) {
    errors.push('Cần ít nhất 2 phương án trả lời');
  }
  if (question.options.length > OPTION_LETTERS.length) {
    errors.push(`Tối đa ${OPTION_LETTERS.length} phương án trả lời`);
  }
  const emptyOptCount = question.options.filter((o) => !o.text.trim()).length;
  if (emptyOptCount > 0) {
    errors.push(`Còn ${emptyOptCount} phương án bị trống`);
  }
  const correctCount = question.options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) {
    errors.push('Chưa chọn đáp án đúng');
  } else if (correctCount > 1) {
    errors.push('Chỉ được chọn 1 đáp án đúng duy nhất');
  }

  return {
    questionId: question.id,
    valid: errors.length === 0,
    errors,
  };
}

export function validateQuestionBank(questions: ExamQuestion[]) {
  const map = new Map<string, QuestionValidation>();
  const validQuestions: ExamQuestion[] = [];
  let invalidCount = 0;

  for (const q of questions) {
    const res = validateQuestion(q);
    map.set(q.id, res);
    if (res.valid) {
      validQuestions.push(q);
    } else {
      invalidCount += 1;
    }
  }

  return {
    byId: map,
    validQuestions,
    validCount: validQuestions.length,
    invalidCount,
  };
}

/**
 * Tách nhiều phương án viết trên cùng một dòng (hỗ trợ cả khoảng trắng thường, tab và non-breaking space \u00A0 từ Word):
 * VD: "A. Hà Nội    *B. Đà Nẵng    C. Huế    D. Cần Thơ"
 */
function splitInlineOptions(line: string): Array<{ letter: string; isStar: boolean; text: string }> | null {
  const normalizedLine = line.replace(/\u00A0/g, ' ');
  const tokenRegex = /(?:^|[\t ]+)(\*?\s*[A-Fa-f][.)]\s*)/g;
  const matches: Array<{ index: number; full: string; token: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(normalizedLine)) !== null) {
    const token = m[1];
    const letter = token.replace(/[^A-Fa-f]/g, '').toUpperCase();
    if (matches.length === 0) {
      if (m.index !== 0) return null;
      matches.push({ index: m.index, full: m[0], token });
    } else {
      const prevLetter = matches[matches.length - 1].token.replace(/[^A-Fa-f]/g, '').toUpperCase();
      if (letter.charCodeAt(0) === prevLetter.charCodeAt(0) + 1) {
        matches.push({ index: m.index, full: m[0], token });
      }
    }
  }

  if (matches.length === 0) return null;

  return matches.map((item, idx) => {
    const textStart = item.index + item.full.length;
    const textEnd = idx + 1 < matches.length ? matches[idx + 1].index : normalizedLine.length;
    const rawText = normalizedLine.slice(textStart, textEnd).trim();
    const isStar = item.token.trim().startsWith('*');
    const letter = item.token.replace(/[^A-Fa-f]/g, '').toUpperCase();
    return { letter, isStar, text: rawText };
  });
}

function stripCorrectSuffix(rawText: string): { text: string; markedCorrect: boolean } {
  const trimmed = rawText.trim();
  const suffixMatch = /\s*(?:\(\*\)|\[\*\]|\[đúng\]|\(đúng\)|\[dung\]|\(dung\))$/i.exec(trimmed);
  if (suffixMatch) {
    return {
      text: trimmed.slice(0, suffixMatch.index).trim(),
      markedCorrect: true,
    };
  }
  return { text: trimmed, markedCorrect: false };
}

/**
 * Trích xuất bảng đáp án nhanh từ chuỗi hoặc bảng Hướng dẫn chấm cuối file Word:
 * - Bảng 2 dòng: "| 1 | 2 | 3 |" và "| A | D | C |"
 * - Chuỗi có số câu: "1A 2D 3C 4D" hoặc "1. A, 2. D, 3: C"
 * - Chuỗi chữ cái nối tiếp: "A D C D D D C D D A C B"
 */
export function parseQuickAnswerKey(raw: string): Map<number, OptionLetter> {
  const map = new Map<number, OptionLetter>();
  const text = raw.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Thử nhận diện bảng 2 dòng liên tiếp: dòng số (1 | 2 | 3...) + dòng chữ (A | D | C...)
  for (let i = 0; i < lines.length - 1; i += 1) {
    const numTokens = lines[i]
      .replace(/[`|]/g, ' ')
      .trim()
      .split(/[\s,;\t]+/)
      .filter(Boolean);
    const letterTokens = lines[i + 1]
      .replace(/[`|]/g, ' ')
      .trim()
      .split(/[\s,;\t]+/)
      .filter(Boolean);

    const validNums = numTokens.filter((t) => /^\d{1,3}$/.test(t));
    const validLetters = letterTokens.filter((t) => /^[A-Fa-f]$/.test(t));

    if (
      validNums.length >= 2 &&
      validNums.length === numTokens.length &&
      validLetters.length === letterTokens.length &&
      validNums.length === validLetters.length
    ) {
      validNums.forEach((n, idx) => {
        map.set(Number(n), validLetters[idx].toUpperCase() as OptionLetter);
      });
    }
  }
  if (map.size > 0) return map;

  // 2. Thử nhận diện cặp "1A", "1. A", "1: A", "Câu 1: A"
  const pairRe = /(?:câu\s*)?(\d{1,3})\s*[:.)\-]?\s*([A-Fa-f])(?=\b|[\s,;|]|$)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pairRe.exec(text)) !== null) {
    const num = Number(pm[1]);
    const letter = pm[2].toUpperCase() as OptionLetter;
    if (num >= 1 && num <= 500) {
      map.set(num, letter);
    }
  }
  if (map.size > 0) return map;

  // 3. Thử nhận diện dãy chữ cái thuần: "A D C D B A" hoặc "ADCD"
  const cleaned = text.replace(/[\s,;|.\-]+/g, '').toUpperCase();
  if (/^[A-F]{2,}$/.test(cleaned)) {
    for (let i = 0; i < cleaned.length; i += 1) {
      map.set(i + 1, cleaned[i] as OptionLetter);
    }
  }

  return map;
}

export function applyQuickAnswerKeyToQuestions(
  questions: ExamQuestion[],
  rawKey: string
): { questions: ExamQuestion[]; matchedCount: number } {
  const keyMap = parseQuickAnswerKey(rawKey);
  if (keyMap.size === 0) {
    return { questions, matchedCount: 0 };
  }

  let matchedCount = 0;
  const next = questions.map((q, idx) => {
    const targetLetter = keyMap.get(idx + 1);
    if (!targetLetter) return q;
    const targetOptIdx = OPTION_LETTERS.indexOf(targetLetter);
    if (targetOptIdx < 0 || targetOptIdx >= q.options.length) return q;
    matchedCount += 1;
    return {
      ...q,
      options: q.options.map((opt, oIdx) => ({
        ...opt,
        isCorrect: oIdx === targetOptIdx,
      })),
    };
  });

  return { questions: next, matchedCount };
}

/**
 * Phân tích ngân hàng câu hỏi từ văn bản dán (copy từ Word/PDF/Notepad).
 * Hỗ trợ file đề thi Word hoàn chỉnh có đầu đề, khung phách, phần I Trắc nghiệm, phần II Tự luận,
 * Hướng dẫn chấm (bảng đáp án cuối file) và Ma trận đề.
 */
export function parseQuestionsFromText(rawText: string): ParseTextResult {
  const normalizedRaw = rawText.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
  const lines = normalizedRaw.split('\n');
  const questions: ExamQuestion[] = [];
  const warnings: string[] = [];

  interface DraftQuestion {
    promptLines: string[];
    options: Array<{ letter: string; text: string; isCorrect: boolean }>;
    explicitAnswerLetter: string | null;
    group?: string;
    explanation?: string;
  }

  let current: DraftQuestion | null = null;

  const questionStartRe = /^(?:(?:câu|cau|bài|bai|question|q)\s*\d+\s*[:.)\-]?\s*|\d+\s*[.)]\s+)(.*)$/i;
  const answerLineRe = /^(?:đáp\s*án(?:\s*đúng)?|dap\s*an(?:\s*dung)?|da|answer|key)\s*[:\-]?\s*([A-Fa-f])\b/i;
  const groupLineRe = /^(?:nhóm|nhom|chương|chuong|mức\s*độ|muc\s*do|group)\s*[:\-]\s*(.+)$/i;
  const explainLineRe = /^(?:giải\s*thích|giai\s*thich|chú\s*thích|chu\s*thich|explanation)\s*[:\-]\s*(.+)$/i;
  const stopSectionRe =
    /^(?:(?:phần\s*)?(?:ii|2)\s*[.:)\-]?\s*tự\s*luận|tự\s*luận\b|bài\s*làm\b|hướng\s*dẫn\s*chấm\b|đáp\s*án\s*và\s*biểu\s*điểm\b|ma\s*trận\s*đề\b)/i;
  const essayStartRe = /^(?:(?:phần\s*)?(?:ii|2)\s*[.:)\-]?\s*tự\s*luận|tự\s*luận\b)/i;
  const endEssayRe = /^(?:bài\s*làm\b|hướng\s*dẫn\s*chấm\b|ma\s*trận\s*đề\b|\|)/i;

  // Kiểm tra xem văn bản có đánh số "Câu N:" / "1." rõ ràng không để bỏ qua phần header trường/phách phía trên
  const hasExplicitQuestionHeaders = lines.some((l) => questionStartRe.test(l.trim()));

  // Tách riêng phần cuối (Hướng dẫn chấm / Bảng đáp án) và phần Tự luận (nếu có)
  let mcqEndLineIdx = lines.length;
  let essayStartIdx = -1;
  let essayEndIdx = -1;
  let answerSectionText = '';

  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    if (!t) continue;

    if (mcqEndLineIdx === lines.length && i > 0 && stopSectionRe.test(t)) {
      // Chỉ dừng khi đã đi qua ít nhất 1 câu trắc nghiệm (tránh dừng sớm nếu đề chỉ dán văn bản ngắn)
      if (hasExplicitQuestionHeaders || questions.length > 0) {
        mcqEndLineIdx = i;
      }
    }

    if (essayStartIdx === -1 && essayStartRe.test(t)) {
      essayStartIdx = i;
    } else if (essayStartIdx !== -1 && essayEndIdx === -1 && endEssayRe.test(t)) {
      essayEndIdx = i;
    }

    if (/^(?:hướng\s*dẫn\s*chấm|đáp\s*án\s*(?:phần\s*)?trắc\s*nghiệm|bảng\s*đáp\s*án)/i.test(t)) {
      answerSectionText = lines.slice(i).join('\n');
    }
  }

  let essaySectionText: string | undefined;
  if (essayStartIdx !== -1) {
    const endIdx = essayEndIdx !== -1 ? essayEndIdx : lines.length;
    const essayLines = lines
      .slice(essayStartIdx, endIdx)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^[.…\s]+$/.test(l));
    if (essayLines.length > 0) {
      essaySectionText = essayLines.join('\n');
    }
  }

  function flushCurrent() {
    if (!current) return;
    const prompt = current.promptLines.join('\n').trim();
    if (!prompt && current.options.length === 0) {
      current = null;
      return;
    }
    // Bỏ qua các dòng header/bảng phách không có phương án nào khi văn bản có đánh số Câu rõ ràng
    if (hasExplicitQuestionHeaders && current.options.length === 0) {
      current = null;
      return;
    }

    const opts: ExamOption[] = current.options.map((opt) => {
      const letterMatch =
        current?.explicitAnswerLetter !== null &&
        opt.letter.toUpperCase() === current?.explicitAnswerLetter;
      return {
        id: createExamId('opt'),
        text: opt.text,
        isCorrect: opt.isCorrect || Boolean(letterMatch),
      };
    });

    questions.push({
      id: createExamId('q'),
      prompt,
      options: opts,
      group: current.group,
      explanation: current.explanation,
    });
    current = null;
  }

  let startedQuestions = !hasExplicitQuestionHeaders;

  for (let i = 0; i < mcqEndLineIdx; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (current && current.options.length >= 2) {
        flushCurrent();
      }
      continue;
    }

    // Bỏ qua các dòng kẻ chấm hoặc dòng bảng Markdown header khi chưa vào câu hỏi
    if (!startedQuestions) {
      const qMatch = questionStartRe.exec(trimmed);
      if (qMatch) {
        startedQuestions = true;
        current = {
          promptLines: qMatch[1].trim() ? [qMatch[1].trim()] : [],
          options: [],
          explicitAnswerLetter: null,
        };
      }
      continue;
    }

    const ansMatch = answerLineRe.exec(trimmed);
    if (ansMatch && current) {
      current.explicitAnswerLetter = ansMatch[1].toUpperCase();
      continue;
    }

    const grpMatch = groupLineRe.exec(trimmed);
    if (grpMatch && current) {
      current.group = grpMatch[1].trim();
      continue;
    }

    const expMatch = explainLineRe.exec(trimmed);
    if (expMatch && current) {
      current.explanation = expMatch[1].trim();
      continue;
    }

    const parsedOpts = splitInlineOptions(trimmed);
    if (parsedOpts && parsedOpts.length > 0 && current) {
      for (const item of parsedOpts) {
        const cleaned = stripCorrectSuffix(item.text);
        current.options.push({
          letter: item.letter,
          text: cleaned.text,
          isCorrect: item.isStar || cleaned.markedCorrect,
        });
      }
      continue;
    }

    const qMatch = questionStartRe.exec(trimmed);
    if (qMatch) {
      flushCurrent();
      current = {
        promptLines: qMatch[1].trim() ? [qMatch[1].trim()] : [],
        options: [],
        explicitAnswerLetter: null,
      };
      continue;
    }

    if (!current) {
      current = {
        promptLines: [trimmed],
        options: [],
        explicitAnswerLetter: null,
      };
    } else if (current.options.length === 0) {
      current.promptLines.push(trimmed);
    } else {
      const lastOpt = current.options[current.options.length - 1];
      const cleaned = stripCorrectSuffix(trimmed);
      lastOpt.text = `${lastOpt.text} ${cleaned.text}`.trim();
      if (cleaned.markedCorrect) lastOpt.isCorrect = true;
    }
  }

  flushCurrent();

  // Nếu cuối file có bảng đáp án (Hướng dẫn chấm), tự động khớp đáp án cho các câu chưa có đáp án đúng
  let finalQuestions = questions;
  let autoMatchedAnswersCount = 0;
  if (questions.length > 0 && (answerSectionText || mcqEndLineIdx < lines.length)) {
    const tailText = answerSectionText || lines.slice(mcqEndLineIdx).join('\n');
    const tailKeyMap = parseQuickAnswerKey(tailText);
    if (tailKeyMap.size > 0) {
      finalQuestions = questions.map((q, idx) => {
        if (q.options.some((o) => o.isCorrect)) return q;
        const targetLetter = tailKeyMap.get(idx + 1);
        if (!targetLetter) return q;
        const targetIdx = OPTION_LETTERS.indexOf(targetLetter);
        if (targetIdx < 0 || targetIdx >= q.options.length) return q;
        autoMatchedAnswersCount += 1;
        return {
          ...q,
          options: q.options.map((opt, oIdx) => ({
            ...opt,
            isCorrect: oIdx === targetIdx,
          })),
        };
      });
    }
  }

  if (finalQuestions.length === 0) {
    warnings.push('Không tìm thấy câu hỏi nào trong văn bản đã dán.');
  } else {
    const check = validateQuestionBank(finalQuestions);
    if (check.invalidCount > 0) {
      warnings.push(
        `Có ${check.invalidCount}/${finalQuestions.length} câu hỏi chưa có đáp án đúng — bạn có thể bấm trực tiếp vào A/B/C/D để chọn hoặc dùng nút "AI gợi ý đáp án".`
      );
    }
  }

  return {
    questions: finalQuestions,
    warnings,
    autoMatchedAnswersCount,
    essaySectionText,
  };
}

export function parseExamCodes(raw: string, fallbackCount = 4): string[] {
  const tokens = raw
    .split(/[\s,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const key = token.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(token);
    }
  }

  if (unique.length > 0) return unique;

  const count = Math.max(1, Math.min(24, Math.floor(fallbackCount) || 4));
  return Array.from({ length: count }, (_, idx) => String(101 + idx));
}

export function buildSequentialExamCodes(count: number, startCode = 101): string[] {
  const safeCount = Math.max(1, Math.min(24, Math.floor(count) || 1));
  return Array.from({ length: safeCount }, (_, idx) => String(startCode + idx));
}

function createPrng(seed?: number): () => number {
  if (seed === undefined) {
    return () => {
      if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0] / 4294967296;
      }
      return Math.random();
    };
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(items: T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mixQuestionOptions(
  options: ExamOption[],
  shuffleOptions: boolean,
  keepCompoundOptionAtEnd: boolean,
  rand: () => number
): ExamOption[] {
  if (!shuffleOptions || options.length <= 1) {
    return [...options];
  }

  if (keepCompoundOptionAtEnd) {
    // Nếu có phương án tham chiếu cụ thể tới A/B/C/D -> giữ nguyên thứ tự cả câu để bảo toàn nghĩa
    if (options.some((o) => hasExplicitLetterReference(o.text))) {
      return [...options];
    }

    const movable: ExamOption[] = [];
    const pinnedEnd: ExamOption[] = [];
    for (const opt of options) {
      if (isPinnedEndOption(opt.text)) {
        pinnedEnd.push(opt);
      } else {
        movable.push(opt);
      }
    }

    if (pinnedEnd.length > 0) {
      return [...shuffleArray(movable, rand), ...pinnedEnd];
    }
  }

  return shuffleArray(options, rand);
}

/**
 * Tạo danh sách các mã đề trắc nghiệm đã trộn từ ngân hàng câu hỏi hợp lệ.
 */
export function generateMixedExams(
  questions: ExamQuestion[],
  config: ExamMixConfig
): MixedExamVariant[] {
  const { validQuestions } = validateQuestionBank(questions);
  if (validQuestions.length === 0) {
    throw new Error('Không có câu hỏi hợp lệ nào để trộn đề.');
  }

  const codes = config.examCodes.map((c) => c.trim()).filter(Boolean);
  if (codes.length === 0) {
    throw new Error('Vui lòng nhập ít nhất 1 mã đề.');
  }

  const targetCount =
    config.questionCount > 0
      ? Math.min(config.questionCount, validQuestions.length)
      : validQuestions.length;

  const rand = createPrng(config.seed);
  const previousSignatures = new Set<string>();

  return codes.map((code) => {
    let selected: ExamQuestion[];

    if (config.shuffleQuestions) {
      selected = shuffleArray(validQuestions, rand).slice(0, targetCount);
      // Nếu có >= 3 câu và lỡ trùng hệt thứ tự câu của mã đề trước thì xáo lại 1 lượt
      const sig = selected.map((q) => q.id).join(',');
      if (validQuestions.length >= 3 && previousSignatures.has(sig)) {
        selected = shuffleArray(validQuestions, rand).slice(0, targetCount);
      }
      previousSignatures.add(selected.map((q) => q.id).join(','));
    } else {
      selected = validQuestions.slice(0, targetCount);
    }

    const answerKey: Record<number, OptionLetter> = {};
    const mixedQuestions: MixedExamQuestion[] = selected.map((q, index) => {
      const mixedOpts = mixQuestionOptions(
        q.options,
        config.shuffleOptions,
        config.keepCompoundOptionAtEnd,
        rand
      );

      let correctLetter: OptionLetter = 'A';
      const labeledOptions: MixedExamOption[] = mixedOpts.map((opt, optIdx) => {
        const letter = OPTION_LETTERS[optIdx] ?? 'A';
        if (opt.isCorrect) {
          correctLetter = letter;
        }
        const trimmedText = opt.text.trim();
        return {
          sourceOptionId: opt.id,
          letter,
          text: trimmedText,
          textHtml: plainTextToHtml(trimmedText),
          isCorrect: opt.isCorrect,
        };
      });

      const questionNumber = index + 1;
      answerKey[questionNumber] = correctLetter;
      const trimmedPrompt = q.prompt.trim();

      return {
        number: questionNumber,
        sourceQuestionId: q.id,
        prompt: trimmedPrompt,
        promptHtml: plainTextToHtml(trimmedPrompt),
        options: labeledOptions,
        correctLetter,
        group: q.group,
        explanation: q.explanation,
      };
    });

    return {
      code,
      questions: mixedQuestions,
      sourceMixedQuestions: mixedQuestions,
      answerKey,
    };
  });
}

export function buildQuestionBlocksFromList(questions: MixedExamQuestion[]): ExamQuestionBlock[] {
  return questions.map<ExamQuestionBlock>((q) => ({
    id: `blk-q-${q.sourceQuestionId}`,
    type: 'question',
    question: {
      ...q,
      promptHtml: q.promptHtml ?? plainTextToHtml(q.prompt),
      options: q.options.map((o) => ({
        ...o,
        textHtml: o.textHtml ?? plainTextToHtml(o.text),
      })),
    },
  }));
}

export function insertMixedQuestionsAcrossVariants(
  variants: MixedExamVariant[],
  metadata: ExamMetadata,
  targetIndex: number
): MixedExamVariant[] {
  return variants.map((variant) => {
    const currentBlocks = ensureVariantBlocks(variant, metadata);
    const existingSourceIds = new Set(
      currentBlocks
        .filter((b): b is ExamQuestionBlock => b.type === 'question')
        .map((b) => b.question.sourceQuestionId)
    );
    const pool = variant.sourceMixedQuestions ?? variant.questions;
    const toInsert = buildQuestionBlocksFromList(
      pool.filter((q) => !existingSourceIds.has(q.sourceQuestionId))
    );
    if (toInsert.length === 0) return variant;

    const nextBlocks = [...currentBlocks];
    const safeIdx = Math.max(0, Math.min(targetIndex, nextBlocks.length));
    nextBlocks.splice(safeIdx, 0, ...toInsert);
    return recalculateVariantFromBlocks(variant, nextBlocks);
  });
}

export function buildDefaultPaperBlocks(
  questions: MixedExamQuestion[],
  metadata: ExamMetadata
): ExamPaperBlock[] {
  const durationParts = [
    `Thời gian làm bài: ${metadata.durationMinutes || 45} phút`,
    metadata.semester ? metadata.semester : '',
  ].filter(Boolean);

  const blocks: ExamPaperBlock[] = [
    {
      id: 'blk-hdr-main',
      type: 'header',
      schoolHtml: plainTextToHtml(metadata.schoolName || DEFAULT_EXAM_METADATA.schoolName),
      departmentHtml: plainTextToHtml(metadata.department || ''),
      examTitleHtml: plainTextToHtml(metadata.examTitle || 'ĐỀ THI TRẮC NGHIỆM'),
      subjectHtml: metadata.subject ? plainTextToHtml(`Môn: ${metadata.subject}`) : '',
      durationHtml: plainTextToHtml(durationParts.join(' • ')),
    },
    {
      id: 'blk-stu-main',
      type: 'student_info',
      studentLineHtml:
        'Họ và tên thí sinh: .......................................................... Lớp: .........................<br/>Mã sinh viên: ......................................... Số báo danh: ..................................',
      notesHtml: metadata.notes ? `<i>Lưu ý: ${plainTextToHtml(metadata.notes)}</i>` : '',
      codeLabelPrefix: 'MÃ ĐỀ:',
    },
    ...questions.map<ExamQuestionBlock>((q) => ({
      id: `blk-q-${q.sourceQuestionId}`,
      type: 'question',
      question: {
        ...q,
        promptHtml: q.promptHtml ?? plainTextToHtml(q.prompt),
        options: q.options.map((o) => ({
          ...o,
          textHtml: o.textHtml ?? plainTextToHtml(o.text),
        })),
      },
    })),
    {
      id: 'blk-ftr-main',
      type: 'footer',
      endTextHtml: '<b>--- HẾT ---</b>',
      showSignatures: false,
      leftRoleHtml: '<b>GIẢNG VIÊN RA ĐỀ</b><br/><i>(Ký và ghi rõ họ tên)</i>',
      rightRoleHtml: '<b>TRƯỞNG BỘ MÔN / KHOA DUYỆT</b><br/><i>(Ký và ghi rõ họ tên)</i>',
    },
  ];

  return blocks;
}

export function ensureVariantBlocks(
  variant: MixedExamVariant,
  metadata: ExamMetadata
): ExamPaperBlock[] {
  if (variant.blocks !== undefined) {
    return variant.blocks;
  }
  return buildDefaultPaperBlocks(variant.questions, metadata);
}

/**
 * Tính lại số thứ tự Câu 1..N, nhãn phương án A..F, danh sách questions và answerKey
 * sau mỗi thao tác kéo thả / thêm / sửa / xóa trên tờ đề.
 */
export function recalculateVariantFromBlocks(
  variant: MixedExamVariant,
  blocks: ExamPaperBlock[]
): MixedExamVariant {
  let qCounter = 0;
  const nextQuestions: MixedExamQuestion[] = [];
  const nextAnswerKey: Record<number, OptionLetter> = {};

  const normalizedBlocks: ExamPaperBlock[] = blocks.map((blk) => {
    if (blk.type !== 'question') return blk;
    qCounter += 1;

    const cleanPromptHtml = sanitizeExamHtml(
      blk.question.promptHtml ?? plainTextToHtml(blk.question.prompt)
    );
    const cleanPromptPlain = htmlToPlainText(cleanPromptHtml);

    let correctLetter: OptionLetter = 'A';
    const hasAnyCorrect = blk.question.options.some((o) => o.isCorrect);

    const normalizedOptions: MixedExamOption[] = blk.question.options
      .slice(0, OPTION_LETTERS.length)
      .map((opt, idx) => {
        const letter = OPTION_LETTERS[idx] ?? 'A';
        const isCorrect = hasAnyCorrect ? opt.isCorrect : idx === 0;
        if (isCorrect) correctLetter = letter;
        const cleanOptHtml = sanitizeExamHtml(opt.textHtml ?? plainTextToHtml(opt.text));
        return {
          ...opt,
          letter,
          isCorrect,
          textHtml: cleanOptHtml,
          text: htmlToPlainText(cleanOptHtml),
        };
      });

    const updatedQuestion: MixedExamQuestion = {
      ...blk.question,
      number: qCounter,
      promptHtml: cleanPromptHtml,
      prompt: cleanPromptPlain,
      options: normalizedOptions,
      correctLetter,
    };

    nextQuestions.push(updatedQuestion);
    nextAnswerKey[qCounter] = correctLetter;

    return {
      ...blk,
      question: updatedQuestion,
    };
  });

  return {
    ...variant,
    sourceMixedQuestions:
      variant.sourceMixedQuestions ??
      (variant.questions.length > 0 ? variant.questions : undefined),
    blocks: normalizedBlocks,
    questions: nextQuestions,
    answerKey: nextAnswerKey,
  };
}

export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Đồng bộ nội dung (đề bài, ảnh minh họa, nội dung/đáp án đúng của phương án) của 1 câu hỏi
 * sang tất cả các mã đề khác có cùng sourceQuestionId mà vẫn giữ nguyên thứ tự đảo riêng của từng mã.
 */
export function syncQuestionContentAcrossVariants(
  variants: MixedExamVariant[],
  metadata: ExamMetadata,
  updatedQuestion: MixedExamQuestion
): MixedExamVariant[] {
  const optBySourceId = new Map<string, MixedExamOption>();
  updatedQuestion.options.forEach((opt) => {
    if (opt.sourceOptionId) optBySourceId.set(opt.sourceOptionId, opt);
  });

  return variants.map((variant) => {
    const currentBlocks = ensureVariantBlocks(variant, metadata);
    let touched = false;

    const nextBlocks = currentBlocks.map((blk) => {
      if (blk.type !== 'question' || blk.question.sourceQuestionId !== updatedQuestion.sourceQuestionId) {
        return blk;
      }
      touched = true;
      const mappedOptions = blk.question.options.map((existingOpt, idx) => {
        const matched =
          (existingOpt.sourceOptionId ? optBySourceId.get(existingOpt.sourceOptionId) : undefined) ??
          updatedQuestion.options[idx];
        if (!matched) return existingOpt;
        return {
          ...existingOpt,
          text: matched.text,
          textHtml: matched.textHtml,
          isCorrect: matched.isCorrect,
        };
      });

      return {
        ...blk,
        question: {
          ...blk.question,
          prompt: updatedQuestion.prompt,
          promptHtml: updatedQuestion.promptHtml,
          imageUrl: updatedQuestion.imageUrl,
          options: mappedOptions,
        },
      };
    });

    return touched ? recalculateVariantFromBlocks(variant, nextBlocks) : variant;
  });
}

function cloneBlock<T extends ExamPaperBlock>(blk: T): T {
  return JSON.parse(JSON.stringify(blk)) as T;
}

/**
 * Tự động đồng bộ mọi thay đổi trên 1 mã đề (sửa đầu đề, khung thí sinh, chân trang,
 * thêm/sửa/xóa khối đoạn văn, thêm/sửa/xóa câu hỏi, sửa/thêm/xóa phương án, đổi màu/in đậm/căn lề,
 * chèn ảnh, di chuyển khối bố cục) sang TẤT CẢ các mã đề còn lại,
 * đồng thời vẫn bảo toàn thứ tự xáo trộn câu hỏi & phương án riêng của từng mã đề.
 */
export function applyVariantEditToAll(
  variants: MixedExamVariant[],
  editedVariant: MixedExamVariant,
  metadata: ExamMetadata
): MixedExamVariant[] {
  const prevEdited = variants.find((v) => v.code === editedVariant.code);
  if (!prevEdited) return variants;

  const prevBlocks = ensureVariantBlocks(prevEdited, metadata);
  const nextBlocks = ensureVariantBlocks(editedVariant, metadata);

  const prevNonQIds = new Set<string>();
  const prevNonQIndex = new Map<string, number>();
  const prevQBySourceId = new Map<string, ExamQuestionBlock>();

  prevBlocks.forEach((b, idx) => {
    if (b.type === 'question') {
      prevQBySourceId.set(b.question.sourceQuestionId, b);
    } else {
      prevNonQIds.add(b.id);
      prevNonQIndex.set(b.id, idx);
    }
  });

  const nextNonQById = new Map<string, ExamPaperBlock>();
  const nextNonQIndex = new Map<string, number>();
  const nextQBySourceId = new Map<string, ExamQuestionBlock>();
  const addedBlocks: Array<{ block: ExamPaperBlock; index: number }> = [];

  nextBlocks.forEach((b, idx) => {
    if (b.type === 'question') {
      nextQBySourceId.set(b.question.sourceQuestionId, b);
      if (!prevQBySourceId.has(b.question.sourceQuestionId)) {
        addedBlocks.push({ block: b, index: idx });
      }
    } else {
      nextNonQById.set(b.id, b);
      nextNonQIndex.set(b.id, idx);
      if (!prevNonQIds.has(b.id)) {
        addedBlocks.push({ block: b, index: idx });
      }
    }
  });

  const removedNonQIds = new Set<string>();
  prevNonQIds.forEach((id) => {
    if (!nextNonQById.has(id)) removedNonQIds.add(id);
  });

  const removedQSourceIds = new Set<string>();
  prevQBySourceId.forEach((_, srcId) => {
    if (!nextQBySourceId.has(srcId)) removedQSourceIds.add(srcId);
  });

  // Phát hiện trường hợp người dùng kéo thả 1 khối bố cục (không phải câu hỏi) sang vị trí mới
  let movedNonQ: { id: string; toIndex: number } | null = null;
  if (
    addedBlocks.length === 0 &&
    removedNonQIds.size === 0 &&
    removedQSourceIds.size === 0 &&
    prevBlocks.length === nextBlocks.length
  ) {
    for (const [id, oldIdx] of prevNonQIndex.entries()) {
      const newIdx = nextNonQIndex.get(id);
      if (newIdx !== undefined && newIdx !== oldIdx) {
        movedNonQ = { id, toIndex: newIdx };
        break;
      }
    }
  }

  return variants.map((variant) => {
    if (variant.code === editedVariant.code) {
      return editedVariant;
    }

    // 1. Lọc bỏ các khối hoặc câu hỏi đã bị xóa
    let otherBlocks = ensureVariantBlocks(variant, metadata)
      .filter((blk) => {
        if (blk.type === 'question') {
          return !removedQSourceIds.has(blk.question.sourceQuestionId);
        }
        return !removedNonQIds.has(blk.id);
      })
      .map((blk): ExamPaperBlock => {
        // 2a. Đồng bộ khối bố cục / tiêu đề / đoạn văn / chân trang
        if (blk.type !== 'question') {
          const updated = nextNonQById.get(blk.id);
          return updated ? cloneBlock(updated) : blk;
        }

        // 2b. Đồng bộ nội dung, định dạng, ảnh và phương án của câu hỏi (giữ nguyên thứ tự đảo riêng)
        const updatedQBlock = nextQBySourceId.get(blk.question.sourceQuestionId);
        if (!updatedQBlock) return blk;

        const updatedQ = updatedQBlock.question;
        const updatedOptById = new Map<string, MixedExamOption>();
        updatedQ.options.forEach((opt, idx) => {
          const key = opt.sourceOptionId ?? `__idx_${idx}`;
          updatedOptById.set(key, opt);
        });

        const existingKeySet = new Set<string>();
        const syncedExistingOptions: MixedExamOption[] = [];

        blk.question.options.forEach((existingOpt, idx) => {
          const key = existingOpt.sourceOptionId ?? `__idx_${idx}`;
          const matched = updatedOptById.get(key);
          if (matched) {
            existingKeySet.add(key);
            syncedExistingOptions.push({
              ...existingOpt,
              text: matched.text,
              textHtml: matched.textHtml,
              isCorrect: matched.isCorrect,
            });
          }
        });

        // Thêm các phương án mới được bổ sung vào câu hỏi
        updatedQ.options.forEach((opt, idx) => {
          const key = opt.sourceOptionId ?? `__idx_${idx}`;
          if (!existingKeySet.has(key)) {
            syncedExistingOptions.push({ ...opt });
          }
        });

        return {
          ...blk,
          style: updatedQBlock.style ? { ...updatedQBlock.style } : undefined,
          question: {
            ...blk.question,
            prompt: updatedQ.prompt,
            promptHtml: updatedQ.promptHtml,
            imageUrl: updatedQ.imageUrl,
            options:
              syncedExistingOptions.length >= 2
                ? syncedExistingOptions
                : updatedQ.options.map((o) => ({ ...o })),
          },
        };
      });

    // 3. Chèn các khối hoặc câu hỏi mới thêm
    for (const item of addedBlocks) {
      const cloned = cloneBlock(item.block);
      const insertAt = Math.max(0, Math.min(item.index, otherBlocks.length));
      otherBlocks.splice(insertAt, 0, cloned);
    }

    // 4. Đồng bộ vị trí nếu kéo thả khối bố cục (header / student_info / section_text / footer)
    if (movedNonQ) {
      const currentIdx = otherBlocks.findIndex((b) => b.id === movedNonQ!.id);
      if (currentIdx !== -1 && currentIdx !== movedNonQ.toIndex) {
        const safeTarget = Math.max(0, Math.min(movedNonQ.toIndex, otherBlocks.length - 1));
        otherBlocks = reorderItems(otherBlocks, currentIdx, safeTarget);
      }
    }

    return recalculateVariantFromBlocks(variant, otherBlocks);
  });
}

/**
 * Đồng bộ nội dung câu hỏi & đáp án đúng vừa sửa ở Bước 1 (Ngân hàng câu hỏi)
 * sang tất cả các mã đề đang có ở Bước 3 mà vẫn giữ nguyên thứ tự đảo của từng mã.
 */
export function syncBankQuestionsToVariants(
  variants: MixedExamVariant[],
  bankQuestions: ExamQuestion[],
  metadata: ExamMetadata
): MixedExamVariant[] {
  if (variants.length === 0) return variants;
  const bankById = new Map<string, ExamQuestion>();
  bankQuestions.forEach((q) => bankById.set(q.id, q));

  const syncQuestionList = (list: MixedExamQuestion[]): { next: MixedExamQuestion[]; changed: boolean } => {
    let changed = false;
    const next = list.map((mq) => {
      const src = bankById.get(mq.sourceQuestionId);
      if (!src) return mq;
      const optById = new Map<string, ExamOption>();
      src.options.forEach((o) => optById.set(o.id, o));

      let optChanged = false;
      const nextOpts = mq.options.map((existingOpt, idx) => {
        const matched =
          (existingOpt.sourceOptionId ? optById.get(existingOpt.sourceOptionId) : undefined) ??
          src.options[idx];
        if (!matched) return existingOpt;
        const cleanText = matched.text.trim();
        if (existingOpt.text !== cleanText || existingOpt.isCorrect !== matched.isCorrect) {
          optChanged = true;
          return {
            ...existingOpt,
            text: cleanText,
            textHtml:
              existingOpt.text === cleanText && existingOpt.textHtml
                ? existingOpt.textHtml
                : plainTextToHtml(cleanText),
            isCorrect: matched.isCorrect,
          };
        }
        return existingOpt;
      });

      const cleanPrompt = src.prompt.trim();
      const promptChanged = mq.prompt !== cleanPrompt;
      if (!promptChanged && !optChanged) return mq;
      changed = true;
      return {
        ...mq,
        prompt: cleanPrompt,
        promptHtml:
          !promptChanged && mq.promptHtml ? mq.promptHtml : plainTextToHtml(cleanPrompt),
        options: nextOpts,
      };
    });
    return { next, changed };
  };

  return variants.map((variant) => {
    const currentBlocks = ensureVariantBlocks(variant, metadata);
    let blocksChanged = false;

    const nextBlocks = currentBlocks.map((blk): ExamPaperBlock => {
      if (blk.type !== 'question') return blk;
      const res = syncQuestionList([blk.question]);
      if (!res.changed) return blk;
      blocksChanged = true;
      return { ...blk, question: res.next[0] };
    });

    const pool = variant.sourceMixedQuestions ?? variant.questions;
    const syncedPool = syncQuestionList(pool);

    if (!blocksChanged && !syncedPool.changed) return variant;

    return recalculateVariantFromBlocks(
      {
        ...variant,
        sourceMixedQuestions: syncedPool.next,
      },
      nextBlocks
    );
  });
}

/**
 * Đồng bộ thông tin đầu đề từ Bước 2 (metadata) sang các khối header và student_info
 * của toàn bộ mã đề đang có ở Bước 3.
 */
export function syncMetadataToVariants(
  variants: MixedExamVariant[],
  metadata: ExamMetadata
): MixedExamVariant[] {
  if (variants.length === 0) return variants;
  const durationParts = [
    `Thời gian làm bài: ${metadata.durationMinutes || 45} phút`,
    metadata.semester ? metadata.semester : '',
  ].filter(Boolean);

  return variants.map((variant) => {
    if (!variant.blocks || variant.blocks.length === 0) return variant;
    let touched = false;
    const nextBlocks = variant.blocks.map((blk): ExamPaperBlock => {
      if (blk.type === 'header') {
        touched = true;
        return {
          ...blk,
          schoolHtml: plainTextToHtml(metadata.schoolName || DEFAULT_EXAM_METADATA.schoolName),
          departmentHtml: plainTextToHtml(metadata.department || ''),
          examTitleHtml: plainTextToHtml(metadata.examTitle || 'ĐỀ THI TRẮC NGHIỆM'),
          subjectHtml: metadata.subject ? plainTextToHtml(`Môn: ${metadata.subject}`) : '',
          durationHtml: plainTextToHtml(durationParts.join(' • ')),
        };
      }
      if (blk.type === 'student_info') {
        touched = true;
        return {
          ...blk,
          notesHtml: metadata.notes ? `<i>Lưu ý: ${plainTextToHtml(metadata.notes)}</i>` : '',
        };
      }
      return blk;
    });
    return touched ? { ...variant, blocks: nextBlocks } : variant;
  });
}

/**
 * Tách văn bản phần Tự luận (đã tách từ file Word ở Bước 1) thành khối Phần tự luận (essay_section)
 * chuẩn để chèn vào Bước 3.
 */
export function buildEssaySectionBlockFromText(essayText: string): ExamEssaySectionBlock {
  const lines = essayText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const firstLine = lines[0] ?? 'PHẦN TỰ LUẬN:';
  const isHeaderLine = /^(?:PHẦN\s+)?(?:II|2|B|TỰ\s*LUẬN)/i.test(firstLine);
  const titleHtml = `<b>${plainTextToHtml(isHeaderLine ? firstLine : 'PHẦN TỰ LUẬN:')}</b>`;
  const bodyLines = isHeaderLine ? lines.slice(1) : lines;

  const items: ExamEssayQuestionItem[] = [];
  let currentBuf: string[] = [];

  const flushCurrent = () => {
    const joined = currentBuf.join('\n').trim();
    if (!joined) return;
    items.push({
      id: createExamId('essay-q'),
      promptHtml: plainTextToHtml(joined),
      lineCount: 5,
    });
    currentBuf = [];
  };

  for (const line of bodyLines) {
    if (/^(?:Câu|Bài)\s*\d+\s*[:.)]/i.test(line) && currentBuf.length > 0) {
      flushCurrent();
    }
    currentBuf.push(line);
  }
  flushCurrent();

  if (items.length === 0) {
    items.push({
      id: createExamId('essay-q'),
      promptHtml: '<b>Câu 1:</b> Nhập nội dung câu hỏi tự luận...',
      lineCount: 5,
    });
  }

  return {
    id: 'blk-essay-sec-auto',
    type: 'essay_section',
    titleHtml,
    noteHtml: '',
    showNote: false,
    items,
    style: { textAlign: 'left' },
  };
}

/**
 * Khi bấm "Trộn lại mã mới" trên bộ đề đã có sẵn bố cục (đầu đề, khung điểm, phần tự luận, chân trang),
 * giữ nguyên bố cục giáo viên đã thiết kế và chỉ thay thế danh sách câu hỏi trắc nghiệm bằng lượt trộn mới.
 */
export function applyRemixPreservingLayout(
  newVariants: MixedExamVariant[],
  templateBlocks: ExamPaperBlock[] | undefined
): MixedExamVariant[] {
  if (!templateBlocks || templateBlocks.length === 0) {
    return newVariants.map((v) =>
      recalculateVariantFromBlocks({ ...v, sourceMixedQuestions: v.questions }, [])
    );
  }

  const firstQIdx = templateBlocks.findIndex((b) => b.type === 'question');
  const hadQuestionsOnPaper = firstQIdx >= 0;
  const nonQuestionBlocks = templateBlocks.filter((b) => b.type !== 'question');
  const insertPos = hadQuestionsOnPaper
    ? templateBlocks.slice(0, firstQIdx).filter((b) => b.type !== 'question').length
    : -1;

  return newVariants.map((v) => {
    const clonedLayout: ExamPaperBlock[] = nonQuestionBlocks.map((b) => cloneBlock(b));
    if (hadQuestionsOnPaper && insertPos >= 0) {
      const newQBlocks = buildQuestionBlocksFromList(v.questions);
      clonedLayout.splice(insertPos, 0, ...newQBlocks);
    }
    return recalculateVariantFromBlocks(
      { ...v, sourceMixedQuestions: v.questions },
      clonedLayout
    );
  });
}

export const SAMPLE_EXAM_TEXT = `Câu 1: Trong lập trình web, ngôn ngữ nào dùng để định nghĩa cấu trúc nội dung của trang web?
*A. HTML
B. CSS
C. SQL
D. Python
Nhóm: Chương 1

Câu 2: Giao thức nào sau đây được sử dụng để truyền tải trang web có mã hóa bảo mật?
A. HTTP
B. FTP
*C. HTTPS
D. SMTP
Nhóm: Chương 1

Câu 3: Trong cơ sở dữ liệu quan hệ, câu lệnh SQL nào dùng để truy vấn dữ liệu từ bảng?
A. INSERT
B. UPDATE
C. DELETE
D. SELECT
Đáp án: D
Nhóm: Chương 2

Câu 4: Thành phần nào sau đây thuộc phần mềm hệ thống?
A. Hệ điều hành Windows
B. Hệ điều hành Linux
C. Trình điều khiển thiết bị (Driver)
*D. Tất cả các đáp án trên đều đúng
Nhóm: Chương 2

Câu 5: Trong mạng máy tính, thiết bị nào dùng để định tuyến gói tin giữa các mạng khác nhau?
A. Hub    *B. Router    C. Monitor    D. Printer
Nhóm: Chương 3

Câu 6: Phím tắt thông dụng trên Windows để sao chép và dán lần lượt là gì?
A. Ctrl + X và Ctrl + V
*B. Ctrl + C và Ctrl + V
C. Ctrl + Z và Ctrl + Y
D. Ctrl + A và Ctrl + S
Nhóm: Chương 3`;


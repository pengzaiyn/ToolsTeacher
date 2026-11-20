import * as XLSX from 'xlsx';
import {
  createExamId,
  OPTION_LETTERS,
  type ExamMetadata,
  type ExamOption,
  type ExamQuestion,
  type MixedExamVariant,
  type OptionLetter,
} from '@/lib/examMixer';

export interface ExamExcelImportResult {
  sheetName: string;
  questions: ExamQuestion[];
  skippedRows: number;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const exact = headers.findIndex((h) => aliases.includes(h));
  if (exact !== -1) return exact;
  return headers.findIndex((h) => aliases.some((a) => h.includes(a)));
}

function resolveCorrectLetter(rawAnswer: string, optionTexts: string[]): OptionLetter | null {
  const trimmed = rawAnswer.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  // Dạng "A", "B", "A.", "Đáp án B"
  const letterMatch = /^(?:DAP\s*AN\s*)?([A-F])[.)]?$/i.exec(
    upper.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D')
  );
  if (letterMatch) {
    return letterMatch[1].toUpperCase() as OptionLetter;
  }

  // Dạng số 1..6
  if (/^[1-6]$/.test(trimmed)) {
    const idx = Number(trimmed) - 1;
    return OPTION_LETTERS[idx] ?? null;
  }

  // Khớp nguyên văn nội dung đáp án
  const lower = trimmed.toLowerCase();
  const matchedIdx = optionTexts.findIndex((t) => t.trim().toLowerCase() === lower);
  if (matchedIdx >= 0 && matchedIdx < OPTION_LETTERS.length) {
    return OPTION_LETTERS[matchedIdx];
  }

  return null;
}

export async function parseQuestionsFromWorkbook(file: File): Promise<ExamExcelImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const sheetName =
    wb.SheetNames.find((name) => !normalizeHeader(name).includes('huongdan')) ?? wb.SheetNames[0];

  if (!sheetName) {
    throw new Error('File Excel không có trang tính dữ liệu nào.');
  }

  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  let headerRowIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rawRows.length, 15); i += 1) {
    const candidate = (rawRows[i] ?? []).map(normalizeHeader);
    const hasPrompt =
      findColumnIndex(candidate, ['cau hoi', 'noi dung cau hoi', 'noi dung', 'question']) !== -1;
    const hasOptA = findColumnIndex(candidate, ['dap an a', 'phuong an a', 'a']) !== -1;
    if (hasPrompt && hasOptA) {
      headerRowIdx = i;
      headers = candidate;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error(
      'Không tìm thấy dòng tiêu đề hợp lệ (cần ít nhất cột "Câu hỏi", "Đáp án A", "Đáp án B", "Đáp án đúng").'
    );
  }

  const colPrompt = findColumnIndex(headers, ['cau hoi', 'noi dung cau hoi', 'noi dung', 'question']);
  const colOptions: Array<{ letter: OptionLetter; idx: number }> = OPTION_LETTERS.map((letter) => {
    const low = letter.toLowerCase();
    const idx = findColumnIndex(headers, [
      `dap an ${low}`,
      `phuong an ${low}`,
      `lua chon ${low}`,
      `option ${low}`,
      low,
    ]);
    return { letter, idx };
  }).filter((item) => item.idx !== -1);

  const colAnswer = findColumnIndex(headers, ['dap an dung', 'dap an', 'ket qua', 'answer', 'key']);
  const colGroup = findColumnIndex(headers, ['nhom', 'chuong', 'muc do', 'phan', 'group']);
  const colExplain = findColumnIndex(headers, ['giai thich', 'chu thich', 'explanation']);

  const questions: ExamQuestion[] = [];
  let skippedRows = 0;

  for (let i = headerRowIdx + 1; i < rawRows.length; i += 1) {
    const row = rawRows[i] ?? [];
    const prompt = String(row[colPrompt] ?? '').trim();
    const rawOpts = colOptions
      .map((c) => ({
        letter: c.letter,
        text: String(row[c.idx] ?? '').trim(),
      }))
      .filter((o) => o.text.length > 0);

    if (!prompt && rawOpts.length === 0) {
      continue;
    }
    if (!prompt) {
      skippedRows += 1;
      continue;
    }

    const rawAnswer = colAnswer >= 0 ? String(row[colAnswer] ?? '').trim() : '';
    const correctLetter = resolveCorrectLetter(
      rawAnswer,
      rawOpts.map((o) => o.text)
    );

    const options: ExamOption[] = rawOpts.map((o) => ({
      id: createExamId('opt'),
      text: o.text,
      isCorrect: correctLetter !== null && o.letter === correctLetter,
    }));

    const group = colGroup >= 0 ? String(row[colGroup] ?? '').trim() : '';
    const explanation = colExplain >= 0 ? String(row[colExplain] ?? '').trim() : '';

    questions.push({
      id: createExamId('q'),
      prompt,
      options,
      group: group || undefined,
      explanation: explanation || undefined,
    });
  }

  if (questions.length === 0) {
    throw new Error('Không đọc được câu hỏi nào từ file Excel.');
  }

  return { sheetName, questions, skippedRows };
}

export function downloadExamBankTemplate(): void {
  const wb = XLSX.utils.book_new();
  const sampleRows = [
    [
      'STT',
      'Câu hỏi',
      'Đáp án A',
      'Đáp án B',
      'Đáp án C',
      'Đáp án D',
      'Đáp án đúng',
      'Nhóm / Chương',
      'Giải thích',
    ],
    [
      1,
      'Trong lập trình web, ngôn ngữ nào dùng để định nghĩa cấu trúc nội dung của trang web?',
      'HTML',
      'CSS',
      'SQL',
      'Python',
      'A',
      'Chương 1',
      'HTML là ngôn ngữ đánh dấu cấu trúc trang web.',
    ],
    [
      2,
      'Giao thức nào truyền tải trang web có mã hóa bảo mật?',
      'HTTP',
      'FTP',
      'HTTPS',
      'SMTP',
      'C',
      'Chương 1',
      '',
    ],
    [
      3,
      'Thành phần nào sau đây thuộc phần mềm hệ thống?',
      'Hệ điều hành Windows',
      'Hệ điều hành Linux',
      'Trình điều khiển thiết bị (Driver)',
      'Tất cả các đáp án trên đều đúng',
      'D',
      'Chương 2',
      'Khi trộn, đáp án "Tất cả..." có thể ghim ở cuối.',
    ],
  ];

  const wsData = XLSX.utils.aoa_to_sheet(sampleRows);
  wsData['!cols'] = [
    { wch: 6 },
    { wch: 48 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 30 },
    { wch: 14 },
    { wch: 16 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'NganHangCauHoi');

  const guideRows = [
    ['HƯỚNG DẪN NHẬP NGÂN HÀNG CÂU HỎI TRẮC NGHIỆM'],
    [],
    ['1. Các cột bắt buộc: "Câu hỏi", "Đáp án A", "Đáp án B" (tối đa tới Đáp án F) và "Đáp án đúng".'],
    ['2. Cột "Đáp án đúng": ghi ký tự A / B / C / D (hoặc 1 / 2 / 3 / 4).'],
    ['3. Cột "Nhóm / Chương" và "Giải thích" là tùy chọn.'],
    ['4. Các phương án như "Tất cả các đáp án trên đều đúng" hoặc "Cả A và B đều đúng" sẽ được hệ thống tự nhận diện khi trộn đề.'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 96 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'HuongDan');

  XLSX.writeFile(wb, 'mau-ngan-hang-cau-hoi-avc.xlsx');
}

function buildSafeFileSlug(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'de-thi-trac-nghiem';
}

export function exportAnswerKeysToExcel(
  metadata: ExamMetadata,
  variants: MixedExamVariant[]
): void {
  if (variants.length === 0) return;

  const wb = XLSX.utils.book_new();
  const maxQuestions = Math.max(...variants.map((v) => v.questions.length));

  // Sheet 1: Ma trận đáp án nhanh
  const matrixHeader = ['Câu', ...variants.map((v) => `Mã đề ${v.code}`)];
  const matrixRows: unknown[][] = [
    [metadata.schoolName || 'TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI'],
    [
      `${metadata.examTitle || 'BẢNG ĐÁP ÁN TRẮC NGHIỆM'}${
        metadata.subject ? ` - Môn: ${metadata.subject}` : ''
      }`,
    ],
    [],
    matrixHeader,
  ];

  for (let qNum = 1; qNum <= maxQuestions; qNum += 1) {
    matrixRows.push([qNum, ...variants.map((v) => v.answerKey[qNum] ?? '')]);
  }

  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
  wsMatrix['!cols'] = [{ wch: 10 }, ...variants.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'BangDapAn');

  // Sheet 2: Chi tiết câu hỏi theo từng mã đề
  const detailRows: unknown[][] = [
    ['Mã đề', 'Câu số', 'Nội dung câu hỏi', 'A', 'B', 'C', 'D', 'E', 'F', 'Đáp án đúng', 'Nhóm'],
  ];

  for (const variant of variants) {
    for (const q of variant.questions) {
      const optMap = new Map(q.options.map((o) => [o.letter, o.text]));
      detailRows.push([
        variant.code,
        q.number,
        q.prompt,
        optMap.get('A') ?? '',
        optMap.get('B') ?? '',
        optMap.get('C') ?? '',
        optMap.get('D') ?? '',
        optMap.get('E') ?? '',
        optMap.get('F') ?? '',
        q.correctLetter,
        q.group ?? '',
      ]);
    }
  }

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 10 },
    { wch: 8 },
    { wch: 46 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 13 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'ChiTietCacMaDe');

  const slug = buildSafeFileSlug(metadata.subject || metadata.examTitle);
  XLSX.writeFile(wb, `bang-dap-an-${slug}.xlsx`);
}


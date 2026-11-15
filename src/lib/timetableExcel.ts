import * as XLSX from 'xlsx';
import { classKey } from '@/lib/classKey';
import type { TimetableEntryInput } from '@/types/database';

export interface ParsedTimetableResult {
  entries: TimetableEntryInput[];
  errors: string[];
  classes: { className: string; classKey: string; count: number }[];
  totalRows: number;
}

const MAX_TIMETABLE_ROWS = 5000;

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const HEADER_ALIASES: Record<string, keyof RawRowFields> = {
  lop: 'class_name',
  'ten lop': 'class_name',
  'ma lop': 'class_name',
  'class name': 'class_name',
  'class': 'class_name',
  class_name: 'class_name',

  thu: 'weekday',
  'ngay trong tuan': 'weekday',
  weekday: 'weekday',

  'tu tiet': 'period_start',
  'tiet bat dau': 'period_start',
  'tiet bd': 'period_start',
  'period start': 'period_start',
  period_start: 'period_start',

  'den tiet': 'period_end',
  'tiet ket thuc': 'period_end',
  'tiet kt': 'period_end',
  'period end': 'period_end',
  period_end: 'period_end',

  tiet: 'period_range',
  'ca tiet': 'period_range',

  mon: 'subject',
  'mon hoc': 'subject',
  'hoc phan': 'subject',
  subject: 'subject',

  'giao vien': 'teacher_name',
  'giang vien': 'teacher_name',
  gv: 'teacher_name',
  'teacher name': 'teacher_name',
  teacher: 'teacher_name',
  teacher_name: 'teacher_name',

  phong: 'room',
  'phong hoc': 'room',
  room: 'room',

  'ghi chu': 'note',
  note: 'note',

  'tu ngay': 'date_from',
  'ngay bat dau': 'date_from',
  'date from': 'date_from',
  date_from: 'date_from',

  'den ngay': 'date_to',
  'ngay ket thuc': 'date_to',
  'date to': 'date_to',
  date_to: 'date_to',
};

interface RawRowFields {
  class_name?: unknown;
  weekday?: unknown;
  period_start?: unknown;
  period_end?: unknown;
  period_range?: unknown;
  subject?: unknown;
  teacher_name?: unknown;
  room?: unknown;
  note?: unknown;
  date_from?: unknown;
  date_to?: unknown;
}

function parseWeekday(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 2 && raw <= 8) {
    return raw;
  }
  const text = normalizeHeader(raw);
  if (!text) return null;
  if (text === 'cn' || text === 'chu nhat' || text === 'sunday') return 8;
  const match = /\b([2-8])\b/.exec(text);
  if (match) return Number(match[1]);
  return null;
}

function parsePeriodInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw >= 1 && raw <= 15 ? raw : null;
  }
  const text = String(raw ?? '').trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= 15 ? n : null;
}

function parsePeriodRange(raw: unknown): { start: number; end: number } | null {
  const text = String(raw ?? '')
    .trim()
    .replace(/^tiết\s*/i, '');
  if (!text) return null;
  const pair = /^(\d{1,2})\s*[-–~>tđến]+\s*(\d{1,2})$/i.exec(text);
  if (pair) {
    const start = Number(pair[1]);
    const end = Number(pair[2]);
    if (start >= 1 && start <= 15 && end >= start && end <= 15) {
      return { start, end };
    }
    return null;
  }
  const single = parsePeriodInt(text);
  if (single) return { start: single, end: single };
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseExcelDate(raw: unknown): { value: string | null; valid: boolean } {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { value: null, valid: true };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return {
      value: `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`,
      valid: true,
    };
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y >= 1900 && parsed.m >= 1 && parsed.d >= 1) {
      return {
        value: `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`,
        valid: true,
      };
    }
    return { value: null, valid: false };
  }

  const text = String(raw).trim();
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d) {
      return { value: `${y}-${pad2(m)}-${pad2(d)}`, valid: true };
    }
    return { value: null, valid: false };
  }

  const vnMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (vnMatch) {
    const d = Number(vnMatch[1]);
    const m = Number(vnMatch[2]);
    const y = Number(vnMatch[3]);
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d) {
      return { value: `${y}-${pad2(m)}-${pad2(d)}`, valid: true };
    }
    return { value: null, valid: false };
  }

  return { value: null, valid: false };
}

function cleanText(raw: unknown): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

export function parseTimetableWorkbook(buffer: ArrayBuffer): ParsedTimetableResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { entries: [], errors: ['File Excel không có trang tính nào'], classes: [], totalRows: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (matrix.length < 2) {
    return {
      entries: [],
      errors: ['File Excel phải có dòng tiêu đề và ít nhất một dòng dữ liệu'],
      classes: [],
      totalRows: 0,
    };
  }

  const headerRow = matrix[0] ?? [];
  const columnMap = new Map<number, keyof RawRowFields>();
  headerRow.forEach((cell, idx) => {
    const normalized = normalizeHeader(cell);
    const mapped = HEADER_ALIASES[normalized];
    if (mapped && !Array.from(columnMap.values()).includes(mapped)) {
      columnMap.set(idx, mapped);
    }
  });

  const mappedFields = new Set(columnMap.values());
  const missingCols: string[] = [];
  if (!mappedFields.has('class_name')) missingCols.push('Lớp');
  if (!mappedFields.has('weekday')) missingCols.push('Thứ');
  if (!mappedFields.has('subject')) missingCols.push('Môn học');
  if (
    !mappedFields.has('period_range') &&
    (!mappedFields.has('period_start') || !mappedFields.has('period_end'))
  ) {
    missingCols.push('Từ tiết / Đến tiết');
  }

  if (missingCols.length > 0) {
    return {
      entries: [],
      errors: [
        `Thiếu cột bắt buộc trong dòng tiêu đề: ${missingCols.join(', ')}. Hãy tải file mẫu để xem đúng định dạng.`,
      ],
      classes: [],
      totalRows: 0,
    };
  }

  const entries: TimetableEntryInput[] = [];
  const errors: string[] = [];
  const classCounts = new Map<string, { className: string; count: number }>();
  let totalRows = 0;

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    const isEmpty = row.every((cell) => String(cell ?? '').trim() === '');
    if (isEmpty) continue;

    totalRows += 1;
    const rowNum = i + 1;
    const raw: RawRowFields = {};
    columnMap.forEach((field, colIdx) => {
      raw[field] = row[colIdx];
    });

    const className = cleanText(raw.class_name);
    const subject = cleanText(raw.subject);
    const weekday = parseWeekday(raw.weekday);

    let periodStart = parsePeriodInt(raw.period_start);
    let periodEnd = parsePeriodInt(raw.period_end);
    if ((periodStart === null || periodEnd === null) && raw.period_range !== undefined) {
      const range = parsePeriodRange(raw.period_range);
      if (range) {
        periodStart = range.start;
        periodEnd = range.end;
      }
    } else if (periodStart !== null && periodEnd === null) {
      periodEnd = periodStart;
    }

    const fromParsed = parseExcelDate(raw.date_from);
    const toParsed = parseExcelDate(raw.date_to);
    const teacherName = cleanText(raw.teacher_name) || null;
    const room = cleanText(raw.room) || null;
    const note = cleanText(raw.note) || null;

    const rowErrors: string[] = [];
    if (!className) rowErrors.push('thiếu tên lớp');
    if (weekday === null) rowErrors.push('thứ không hợp lệ (2–8 hoặc Thứ 2–Chủ nhật)');
    if (periodStart === null || periodEnd === null) {
      rowErrors.push('tiết học không hợp lệ (1–15)');
    } else if (periodEnd < periodStart) {
      rowErrors.push('tiết kết thúc nhỏ hơn tiết bắt đầu');
    }
    if (!subject) rowErrors.push('thiếu tên môn học');
    if (!fromParsed.valid) rowErrors.push('Từ ngày sai định dạng (DD/MM/YYYY hoặc YYYY-MM-DD)');
    if (!toParsed.valid) rowErrors.push('Đến ngày sai định dạng (DD/MM/YYYY hoặc YYYY-MM-DD)');
    if (fromParsed.value && toParsed.value && toParsed.value < fromParsed.value) {
      rowErrors.push('Đến ngày nhỏ hơn Từ ngày');
    }

    if (rowErrors.length > 0) {
      errors.push(`Dòng ${rowNum}: ${rowErrors.join('; ')}`);
      continue;
    }

    const cKey = classKey(className);
    entries.push({
      class_name: className,
      class_key: cKey,
      weekday: weekday!,
      period_start: periodStart!,
      period_end: periodEnd!,
      subject,
      teacher_name: teacherName,
      teacher_key: teacherName ? classKey(teacherName) : null,
      room,
      note,
      date_from: fromParsed.value,
      date_to: toParsed.value,
    });

    const prev = classCounts.get(cKey);
    if (prev) {
      prev.count += 1;
    } else {
      classCounts.set(cKey, { className, count: 1 });
    }
  }

  if (totalRows === 0) {
    errors.push('File Excel không có dòng dữ liệu nào');
  }

  if (entries.length > MAX_TIMETABLE_ROWS) {
    errors.push(`Số dòng hợp lệ (${entries.length}) vượt quá giới hạn tối đa ${MAX_TIMETABLE_ROWS} dòng`);
  }

  const classes = Array.from(classCounts.entries())
    .map(([key, info]) => ({
      className: info.className,
      classKey: key,
      count: info.count,
    }))
    .sort((a, b) => a.className.localeCompare(b.className, 'vi'));

  return { entries, errors, classes, totalRows };
}

export const SAMPLE_TIMETABLE_ROWS = [
  {
    Lớp: 'CNTT-K18A',
    Thứ: 2,
    'Từ tiết': 1,
    'Đến tiết': 3,
    'Môn học': 'Lập trình Web cơ bản',
    'Giáo viên': 'Nguyễn Văn An',
    'Phòng học': 'P.301',
    'Từ ngày': '2026-09-07',
    'Đến ngày': '2026-12-27',
    'Ghi chú': 'Lý thuyết',
  },
  {
    Lớp: 'CNTT-K18A',
    Thứ: 2,
    'Từ tiết': 6,
    'Đến tiết': 8,
    'Môn học': 'Cơ sở dữ liệu',
    'Giáo viên': 'Trần Thị Bình',
    'Phòng học': 'PM.202',
    'Từ ngày': '2026-09-07',
    'Đến ngày': '2026-12-27',
    'Ghi chú': 'Thực hành máy tính',
  },
  {
    Lớp: 'CNTT-K18A',
    Thứ: 4,
    'Từ tiết': 1,
    'Đến tiết': 4,
    'Môn học': 'Tiếng Anh chuyên ngành',
    'Giáo viên': 'Lê Minh Châu',
    'Phòng học': 'P.205',
    'Từ ngày': '2026-09-07',
    'Đến ngày': '2026-12-27',
    'Ghi chú': '',
  },
  {
    Lớp: 'CNTT-K18A',
    Thứ: 6,
    'Từ tiết': 6,
    'Đến tiết': 9,
    'Môn học': 'Kỹ năng mềm',
    'Giáo viên': 'Phạm Thu Hà',
    'Phòng học': 'Hội trường B',
    'Từ ngày': '2026-09-07',
    'Đến ngày': '2026-12-27',
    'Ghi chú': '',
  },
  {
    Lớp: 'QTKD-K18B',
    Thứ: 3,
    'Từ tiết': 1,
    'Đến tiết': 3,
    'Môn học': 'Nguyên lý Marketing',
    'Giáo viên': 'Hoàng Quốc Dũng',
    'Phòng học': 'P.104',
    'Từ ngày': '2026-09-07',
    'Đến ngày': '2026-12-27',
    'Ghi chú': '',
  },
  {
    Lớp: 'QTKD-K18B',
    Thứ: 5,
    'Từ tiết': 6,
    'Đến tiết': 8,
    'Môn học': 'Kế toán doanh nghiệp',
    'Giáo viên': 'Vũ Thị Hạnh',
    'Phòng học': 'P.208',
    'Từ ngày': '2026-09-07',
    'Đến ngày': '2026-12-27',
    'Ghi chú': 'Mang máy tính cầm tay',
  },
];

export function createSampleTimetableWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_TIMETABLE_ROWS);
  ws['!cols'] = [
    { wch: 14 }, // Lớp
    { wch: 8 },  // Thứ
    { wch: 10 }, // Từ tiết
    { wch: 10 }, // Đến tiết
    { wch: 26 }, // Môn học
    { wch: 20 }, // Giáo viên
    { wch: 14 }, // Phòng học
    { wch: 13 }, // Từ ngày
    { wch: 13 }, // Đến ngày
    { wch: 22 }, // Ghi chú
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'ThoiKhoaBieu');

  const guideRows = [
    { Cột: 'Lớp', 'Bắt buộc': 'Có', 'Định dạng / Giá trị hợp lệ': 'Tên lớp hiển thị (VD: CNTT-K18A)' },
    { Cột: 'Thứ', 'Bắt buộc': 'Có', 'Định dạng / Giá trị hợp lệ': 'Số từ 2 đến 8 (2 = Thứ 2 ... 7 = Thứ 7, 8 = Chủ nhật) hoặc chữ "Thứ 2", "CN"' },
    { Cột: 'Từ tiết', 'Bắt buộc': 'Có', 'Định dạng / Giá trị hợp lệ': 'Số nguyên từ 1 đến 15' },
    { Cột: 'Đến tiết', 'Bắt buộc': 'Có', 'Định dạng / Giá trị hợp lệ': 'Số nguyên từ 1 đến 15, lớn hơn hoặc bằng Từ tiết' },
    { Cột: 'Môn học', 'Bắt buộc': 'Có', 'Định dạng / Giá trị hợp lệ': 'Tên môn học / học phần' },
    { Cột: 'Giáo viên', 'Bắt buộc': 'Không', 'Định dạng / Giá trị hợp lệ': 'Họ và tên giảng viên' },
    { Cột: 'Phòng học', 'Bắt buộc': 'Không', 'Định dạng / Giá trị hợp lệ': 'Tên phòng học / phòng máy' },
    { Cột: 'Từ ngày', 'Bắt buộc': 'Không', 'Định dạng / Giá trị hợp lệ': 'YYYY-MM-DD hoặc DD/MM/YYYY (để trống nếu áp dụng mọi tuần)' },
    { Cột: 'Đến ngày', 'Bắt buộc': 'Không', 'Định dạng / Giá trị hợp lệ': 'YYYY-MM-DD hoặc DD/MM/YYYY (để trống nếu áp dụng mọi tuần)' },
    { Cột: 'Ghi chú', 'Bắt buộc': 'Không', 'Định dạng / Giá trị hợp lệ': 'Ghi chú thêm (Lý thuyết, Thực hành...)' },
  ];
  const guideSheet = XLSX.utils.json_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 64 }];
  XLSX.utils.book_append_sheet(wb, guideSheet, 'HuongDan');

  return wb;
}

export function downloadTimetableTemplate(): void {
  const wb = createSampleTimetableWorkbook();
  XLSX.writeFile(wb, 'mau-thoi-khoa-bieu.xlsx');
}

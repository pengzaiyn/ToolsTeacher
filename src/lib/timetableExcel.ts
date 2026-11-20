import * as XLSX from 'xlsx';
import { classKey } from '@/lib/classKey';
import type { TimetableEntryInput } from '@/types/database';

export interface ParsedSemesterMeta {
  semester: string;
  semesterOrder: number;
  academicYear: string | null;
  className: string;
  count: number;
}

export interface ParsedTimetableResult {
  entries: TimetableEntryInput[];
  errors: string[];
  classes: { className: string; classKey: string; count: number }[];
  semesters: ParsedSemesterMeta[];
  format: 'school' | 'flat';
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

function cleanText(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseExcelDate(raw: unknown): { value: string | null; valid: boolean } {
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
  if (text === '-' || text === '—') {
    return { value: null, valid: true };
  }

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

function parseSingleWeekdayToken(raw: string): number | null {
  const text = normalizeHeader(raw);
  if (!text) return null;
  if (text === 'cn' || text === 'chu nhat' || text === 'sunday' || text === '8' || text === 'thu 8') {
    return 8;
  }
  if (text.includes('hai') || /\b2\b/.test(text) || text === 't2') return 2;
  if (text.includes('ba') && !text.includes('bay')) return 3;
  if (/\b3\b/.test(text) || text === 't3') return 3;
  if (text.includes('tu') || text.includes('bon') || /\b4\b/.test(text) || text === 't4') return 4;
  if (text.includes('nam') || /\b5\b/.test(text) || text === 't5') return 5;
  if (text.includes('sau') || /\b6\b/.test(text) || text === 't6') return 6;
  if (text.includes('bay') || /\b7\b/.test(text) || text === 't7') return 7;
  return null;
}

/**
 * Hỗ trợ cả 1 thứ ("Thứ Sáu", "3") lẫn nhiều thứ xuống dòng / dấu phẩy trong 1 ô ("Thứ Ba\nThứ Năm").
 */
export function parseWeekdays(raw: unknown): number[] {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 2 && raw <= 8) {
    return [raw];
  }
  const text = String(raw ?? '').trim();
  if (!text || text === '-' || text === '—') return [];

  const parts = text
    .split(/[\r\n,;/+&]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const result: number[] = [];
  for (const part of parts) {
    const w = parseSingleWeekdayToken(part);
    if (w !== null && !result.includes(w)) {
      result.push(w);
    }
  }
  return result;
}

function parseOptionalNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const text = String(raw).trim().replace(',', '.');
  if (!text || text === '-' || text === '—') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
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

/**
 * Suy ra khoảng tiết (1..15) từ Giờ học thật của trường (VD: "7:30-12:15", "8:00-12:00", "13:00-17:00")
 * và số tiết/buổi (VD: 5 hoặc 6).
 */
function derivePeriodsFromTimeRange(
  timeRange: string | null,
  periodsPerSession: number | null
): { start: number; end: number } {
  const span =
    periodsPerSession && periodsPerSession >= 1 && periodsPerSession <= 8
      ? Math.round(periodsPerSession)
      : 5;

  if (timeRange) {
    const m = /^(\d{1,2})\s*[:h.]\s*(\d{2})/i.exec(timeRange);
    if (m) {
      const hour = Number(m[1]);
      if (hour < 12) {
        return { start: 1, end: Math.min(6, span) };
      }
      if (hour < 18) {
        return { start: 7, end: Math.min(12, 7 + span - 1) };
      }
      return { start: 13, end: Math.min(15, 13 + span - 1) };
    }
  }
  return { start: 1, end: Math.min(6, span) };
}

function normalizeSemesterLabel(raw: string): { label: string; order: number } | null {
  const cleaned = cleanText(raw).toUpperCase();
  if (!cleaned) return null;

  // Dạng "HK1", "HK 2", "HK5+6+7", "HK 5+6+7"
  const hkMatch = /^HK\s*([0-9+,\s-]+)$/i.exec(cleaned);
  if (hkMatch) {
    const suffix = hkMatch[1].replace(/\s+/g, '');
    const firstNum = /\d+/.exec(suffix);
    return {
      label: `HK${suffix}`,
      order: firstNum ? Number(firstNum[0]) : 99,
    };
  }

  // Dạng "Học kỳ: I", "Học kỳ: II", "Học kỳ: V+VI+VII", "Học kỳ 3"
  const romanMap: Record<string, number> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
  };
  const labelOnly = cleaned
    .replace(/^HỌC\s*KỲ\s*:?\s*/i, '')
    .replace(/^HOC\s*KY\s*:?\s*/i, '')
    .replace(/\s+/g, '');

  if (!labelOnly) return null;

  const romanParts = labelOnly.split('+').map((p) => romanMap[p] ?? Number(p));
  if (romanParts.length > 0 && romanParts.every((n) => Number.isInteger(n) && n >= 1 && n <= 12)) {
    return {
      label: `HK${romanParts.join('+')}`,
      order: romanParts[0],
    };
  }

  return { label: cleaned, order: 99 };
}

function extractInlineOrNextValue(row: unknown[], colIdx: number, prefixRegex: RegExp): string {
  const cellText = cleanText(row[colIdx]);
  const afterColon = cellText.replace(prefixRegex, '').trim();
  if (afterColon) return afterColon;
  for (let k = colIdx + 1; k < Math.min(row.length, colIdx + 4); k += 1) {
    const nextVal = cleanText(row[k]);
    if (nextVal) return nextVal;
  }
  return '';
}

interface SchoolColMap {
  tt: number;
  subject: number;
  weekday: number;
  timeRange: number;
  dateFrom: number;
  dateTo: number;
  room: number;
  teacher: number;
  examDate: number;
  totalPeriods: number;
  note: number;
  periodsPerSession: number;
  credits: number;
}

function detectSchoolHeaderRow(
  matrix: unknown[][],
  rowIdx: number
): { cols: SchoolColMap; dataStartRow: number } | null {
  const row = matrix[rowIdx] ?? [];
  const normCells = row.map((c) => normalizeHeader(c));
  const subjectIdx = normCells.findIndex((c) => c === 'mon hoc' || c === 'hoc phan');
  const weekdayIdx = normCells.findIndex((c) => c === 'thu');
  if (subjectIdx === -1 || weekdayIdx === -1) return null;

  const ttIdx = normCells.findIndex((c) => c === 'tt' || c === 'stt');
  const roomIdx = normCells.findIndex((c) => c === 'phong hoc' || c === 'phong');
  const teacherIdx = normCells.findIndex((c) => c === 'giang vien' || c === 'giao vien');
  const examDateIdx = normCells.findIndex((c) => c.includes('ngay thi'));
  const totalPeriodsIdx = normCells.findIndex((c) => c.includes('tong so tiet'));
  const noteIdx = normCells.findIndex((c) => c === 'ghi chu');

  // Cần có ít nhất cột phòng học hoặc giảng viên hoặc TT để phân biệt với bảng phẳng cũ
  if (ttIdx === -1 && roomIdx === -1 && teacherIdx === -1 && examDateIdx === -1) {
    return null;
  }

  const nextRow = matrix[rowIdx + 1] ?? [];
  const nextNorm = nextRow.map((c) => normalizeHeader(c));
  const hasSubHeader = nextNorm.some(
    (c) =>
      c.includes('gio hoc') ||
      c.includes('tuan bat dau') ||
      c.includes('tuan ket thuc') ||
      c.includes('so tiet buoi') ||
      c.includes('so tin')
  );

  const findInBoth = (matcher: (norm: string) => boolean): number => {
    if (hasSubHeader) {
      const subIdx = nextNorm.findIndex(matcher);
      if (subIdx !== -1) return subIdx;
    }
    return normCells.findIndex(matcher);
  };

  const timeRangeIdx = findInBoth((c) => c.includes('gio hoc'));
  const dateFromIdx = findInBoth((c) => c.includes('tuan bat dau') || c.includes('ngay bat dau'));
  const dateToIdx = findInBoth((c) => c.includes('tuan ket thuc') || c.includes('ngay ket thuc'));
  const periodsPerSessionIdx = findInBoth((c) => c.includes('so tiet buoi') || c.includes('tiet buoi'));
  const sessionsCountIdx = findInBoth((c) => c === 'so buoi');
  let creditsIdx = findInBoth((c) => c === 'so tin' || c === 'so tin chi' || c === 'tin chi');
  if (creditsIdx === -1 && sessionsCountIdx !== -1) {
    creditsIdx = sessionsCountIdx + 1;
  }

  if (timeRangeIdx === -1 && dateFromIdx === -1 && !hasSubHeader) {
    return null;
  }

  return {
    cols: {
      tt: ttIdx,
      subject: subjectIdx,
      weekday: weekdayIdx,
      timeRange: timeRangeIdx,
      dateFrom: dateFromIdx,
      dateTo: dateToIdx,
      room: roomIdx,
      teacher: teacherIdx,
      examDate: examDateIdx,
      totalPeriods: totalPeriodsIdx,
      note: noteIdx,
      periodsPerSession: periodsPerSessionIdx,
      credits: creditsIdx,
    },
    dataStartRow: hasSubHeader ? rowIdx + 2 : rowIdx + 1,
  };
}

function isSchoolFooterOrBreakRow(row: unknown[]): boolean {
  const joined = normalizeHeader(row.filter(Boolean).join(' '));
  if (!joined) return true;
  if (
    joined.includes('nguoi lap') ||
    joined.includes('phong dao tao') ||
    joined.includes('tp ha noi') ||
    joined.includes('truong cao dang')
  ) {
    return true;
  }
  return false;
}

function parseSchoolMatrix(
  matrix: unknown[][],
  fallbackClassName: string
): { entries: TimetableEntryInput[]; errors: string[]; totalRows: number; matched: boolean } {
  const entries: TimetableEntryInput[] = [];
  const errors: string[] = [];
  let totalRows = 0;
  let matched = false;

  let currentSemester = '';
  let currentSemesterOrder = 1;
  let currentAcademicYear: string | null = null;
  let currentClassName = fallbackClassName;
  let activeHeader: SchoolColMap | null = null;

  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    const nonEmptyCells = row.map((c) => cleanText(c)).filter(Boolean);
    if (nonEmptyCells.length === 0) {
      continue;
    }

    // 1. Bắt dòng đánh dấu học kỳ đơn lẻ kiểu "HK1", "HK2", "HK5+6+7"
    if (nonEmptyCells.length === 1 && /^HK\s*\d+/i.test(nonEmptyCells[0])) {
      const parsedSem = normalizeSemesterLabel(nonEmptyCells[0]);
      if (parsedSem) {
        currentSemester = parsedSem.label;
        currentSemesterOrder = parsedSem.order;
      }
      activeHeader = null;
      continue;
    }

    // 2. Bắt dòng tiêu đề bảng 2 tầng của Phòng Đào tạo
    const detectedHeader = detectSchoolHeaderRow(matrix, i);
    if (detectedHeader) {
      matched = true;
      activeHeader = detectedHeader.cols;
      i = detectedHeader.dataStartRow - 1;
      continue;
    }

    // 3. Bắt metadata đầu học kỳ: Học kỳ, Năm học, Lớp
    let isMetaRow = false;
    for (let c = 0; c < row.length; c += 1) {
      const cell = cleanText(row[c]);
      if (!cell) continue;
      const norm = normalizeHeader(cell);

      if (norm.startsWith('hoc ky')) {
        isMetaRow = true;
        const val = extractInlineOrNextValue(row, c, /^học\s*kỳ\s*:?\s*/i);
        const parsedSem = normalizeSemesterLabel(val);
        if (parsedSem && !currentSemester) {
          currentSemester = parsedSem.label;
          currentSemesterOrder = parsedSem.order;
        } else if (parsedSem && activeHeader === null) {
          currentSemester = parsedSem.label;
          currentSemesterOrder = parsedSem.order;
        }
      } else if (norm.startsWith('nam hoc')) {
        isMetaRow = true;
        const val = extractInlineOrNextValue(row, c, /^năm\s*học\s*:?\s*/i);
        if (val) currentAcademicYear = val;
      } else if (norm === 'lop' || norm.startsWith('lop ')) {
        isMetaRow = true;
        const val = extractInlineOrNextValue(row, c, /^lớp\s*:?\s*/i);
        if (val) currentClassName = val;
      } else if (
        norm.startsWith('he dao tao') ||
        norm.startsWith('nganh dao tao') ||
        norm.includes('truong cao dang') ||
        norm.includes('thoi khoa bieu')
      ) {
        isMetaRow = true;
      }
    }

    if (isMetaRow) {
      activeHeader = null;
      continue;
    }

    // 4. Nếu đang ở vùng chữ ký / chân bảng -> kết thúc block hiện tại
    if (!activeHeader) continue;
    if (isSchoolFooterOrBreakRow(row)) {
      activeHeader = null;
      continue;
    }

    // 5. Đọc dòng môn học trong bảng
    const subject = cleanText(row[activeHeader.subject]);
    const ttRaw = activeHeader.tt >= 0 ? cleanText(row[activeHeader.tt]) : '';
    // Bỏ qua dòng không có tên môn học hoặc dòng chữ ký người lập/phòng đào tạo ở dưới
    if (!subject) continue;
    if (activeHeader.tt >= 0 && ttRaw && !/^\d+$/.test(ttRaw)) {
      activeHeader = null;
      continue;
    }
    if (activeHeader.tt >= 0 && !ttRaw) {
      // Dòng tên người ký nằm ở cột 0/1 nhưng không có STT
      const hasDatesOrSchedule =
        (activeHeader.dateFrom >= 0 && cleanText(row[activeHeader.dateFrom]) !== '') ||
        (activeHeader.weekday >= 0 && cleanText(row[activeHeader.weekday]) !== '');
      if (!hasDatesOrSchedule) {
        activeHeader = null;
        continue;
      }
    }

    totalRows += 1;
    const rowNum = i + 1;
    const clsName = currentClassName || fallbackClassName || 'Chưa rõ lớp';
    const cKey = classKey(clsName);

    const weekdays = parseWeekdays(row[activeHeader.weekday]);
    const timeRangeRaw = activeHeader.timeRange >= 0 ? cleanText(row[activeHeader.timeRange]) : '';
    const timeRange = timeRangeRaw && timeRangeRaw !== '-' ? timeRangeRaw : null;

    const fromParsed =
      activeHeader.dateFrom >= 0
        ? parseExcelDate(row[activeHeader.dateFrom])
        : { value: null, valid: true };
    const toParsed =
      activeHeader.dateTo >= 0
        ? parseExcelDate(row[activeHeader.dateTo])
        : { value: null, valid: true };
    const examParsed =
      activeHeader.examDate >= 0
        ? parseExcelDate(row[activeHeader.examDate])
        : { value: null, valid: true };

    const roomRaw = activeHeader.room >= 0 ? cleanText(row[activeHeader.room]) : '';
    const room = roomRaw && roomRaw !== '-' ? roomRaw : null;
    const teacherRaw = activeHeader.teacher >= 0 ? cleanText(row[activeHeader.teacher]) : '';
    const teacherName = teacherRaw && teacherRaw !== '-' ? teacherRaw : null;
    const noteRaw = activeHeader.note >= 0 ? cleanText(row[activeHeader.note]) : '';
    const note = noteRaw || null;
    const totalPeriods =
      activeHeader.totalPeriods >= 0 ? parseOptionalNumber(row[activeHeader.totalPeriods]) : null;
    const periodsPerSession =
      activeHeader.periodsPerSession >= 0
        ? parseOptionalNumber(row[activeHeader.periodsPerSession])
        : null;
    const credits =
      activeHeader.credits >= 0 ? parseOptionalNumber(row[activeHeader.credits]) : null;

    const rowErrors: string[] = [];
    if (!fromParsed.valid) rowErrors.push('Tuần bắt đầu sai định dạng ngày');
    if (!toParsed.valid) rowErrors.push('Tuần kết thúc sai định dạng ngày');
    if (!examParsed.valid) rowErrors.push('Dự kiến ngày thi sai định dạng ngày');
    if (fromParsed.value && toParsed.value && toParsed.value < fromParsed.value) {
      rowErrors.push('Tuần kết thúc nhỏ hơn Tuần bắt đầu');
    }

    if (rowErrors.length > 0) {
      errors.push(`Dòng ${rowNum} (${subject}): ${rowErrors.join('; ')}`);
      continue;
    }

    const semesterLabel = currentSemester || 'HK1';
    const isInternship = weekdays.length === 0;

    if (isInternship) {
      entries.push({
        class_name: clsName,
        class_key: cKey,
        weekday: 2,
        period_start: 1,
        period_end: 1,
        subject,
        teacher_name: teacherName,
        teacher_key: teacherName ? classKey(teacherName) : null,
        room,
        note,
        date_from: fromParsed.value,
        date_to: toParsed.value,
        semester: semesterLabel,
        semester_order: currentSemesterOrder,
        academic_year: currentAcademicYear,
        time_range: timeRange,
        exam_date: examParsed.value,
        total_periods: totalPeriods !== null ? Math.round(totalPeriods) : null,
        periods_per_session: null,
        credits,
        is_internship: true,
      });
    } else {
      const periods = derivePeriodsFromTimeRange(timeRange, periodsPerSession);
      for (const wd of weekdays) {
        entries.push({
          class_name: clsName,
          class_key: cKey,
          weekday: wd,
          period_start: periods.start,
          period_end: periods.end,
          subject,
          teacher_name: teacherName,
          teacher_key: teacherName ? classKey(teacherName) : null,
          room,
          note,
          date_from: fromParsed.value,
          date_to: toParsed.value,
          semester: semesterLabel,
          semester_order: currentSemesterOrder,
          academic_year: currentAcademicYear,
          time_range: timeRange,
          exam_date: examParsed.value,
          total_periods: totalPeriods !== null ? Math.round(totalPeriods) : null,
          periods_per_session: periodsPerSession !== null ? Math.round(periodsPerSession) : null,
          credits,
          is_internship: false,
        });
      }
    }
  }

  return { entries, errors, totalRows, matched };
}

// ---------- Fallback: Bảng phẳng cũ (tương thích ngược) ----------

interface RawFlatFields {
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
  semester?: unknown;
  time_range?: unknown;
  exam_date?: unknown;
}

const FLAT_HEADER_ALIASES: Record<string, keyof RawFlatFields> = {
  lop: 'class_name',
  'ten lop': 'class_name',
  'ma lop': 'class_name',
  'class name': 'class_name',
  class: 'class_name',
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

  'gio hoc': 'time_range',
  'thoi gian': 'time_range',

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
  'tuan bat dau': 'date_from',
  'date from': 'date_from',
  date_from: 'date_from',

  'den ngay': 'date_to',
  'ngay ket thuc': 'date_to',
  'tuan ket thuc': 'date_to',
  'date to': 'date_to',
  date_to: 'date_to',

  'hoc ky': 'semester',
  ky: 'semester',
  semester: 'semester',

  'ngay thi': 'exam_date',
  'du kien ngay thi': 'exam_date',
  exam_date: 'exam_date',
};

function parseFlatMatrix(matrix: unknown[][]): {
  entries: TimetableEntryInput[];
  errors: string[];
  totalRows: number;
} {
  if (matrix.length < 2) {
    return {
      entries: [],
      errors: ['File Excel phải có dòng tiêu đề và ít nhất một dòng dữ liệu'],
      totalRows: 0,
    };
  }

  const headerRow = matrix[0] ?? [];
  const columnMap = new Map<number, keyof RawFlatFields>();
  headerRow.forEach((cell, idx) => {
    const normalized = normalizeHeader(cell);
    const mapped = FLAT_HEADER_ALIASES[normalized];
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
    !mappedFields.has('time_range') &&
    (!mappedFields.has('period_start') || !mappedFields.has('period_end'))
  ) {
    missingCols.push('Giờ học hoặc Từ tiết / Đến tiết');
  }

  if (missingCols.length > 0) {
    return {
      entries: [],
      errors: [
        `Không nhận diện được mẫu Thời khóa biểu Phòng Đào tạo hoặc thiếu cột bắt buộc: ${missingCols.join(', ')}. Hãy tải file mẫu để xem đúng định dạng.`,
      ],
      totalRows: 0,
    };
  }

  const entries: TimetableEntryInput[] = [];
  const errors: string[] = [];
  let totalRows = 0;

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] ?? [];
    if (row.every((cell) => String(cell ?? '').trim() === '')) continue;

    totalRows += 1;
    const rowNum = i + 1;
    const raw: RawFlatFields = {};
    columnMap.forEach((field, colIdx) => {
      raw[field] = row[colIdx];
    });

    const className = cleanText(raw.class_name);
    const subject = cleanText(raw.subject);
    const weekdays = parseWeekdays(raw.weekday);
    const timeRange = cleanText(raw.time_range) || null;

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
    } else if (periodStart === null && timeRange) {
      const derived = derivePeriodsFromTimeRange(timeRange, null);
      periodStart = derived.start;
      periodEnd = derived.end;
    }

    const fromParsed = parseExcelDate(raw.date_from);
    const toParsed = parseExcelDate(raw.date_to);
    const examParsed = parseExcelDate(raw.exam_date);
    const teacherName = cleanText(raw.teacher_name) || null;
    const room = cleanText(raw.room) || null;
    const note = cleanText(raw.note) || null;
    const semParsed = raw.semester ? normalizeSemesterLabel(String(raw.semester)) : null;

    const rowErrors: string[] = [];
    if (!className) rowErrors.push('thiếu tên lớp');
    if (weekdays.length === 0) rowErrors.push('thứ không hợp lệ (Thứ Hai..Chủ Nhật hoặc 2–8)');
    if (periodStart === null || periodEnd === null) {
      rowErrors.push('tiết học hoặc giờ học không hợp lệ');
    } else if (periodEnd < periodStart) {
      rowErrors.push('tiết kết thúc nhỏ hơn tiết bắt đầu');
    }
    if (!subject) rowErrors.push('thiếu tên môn học');
    if (!fromParsed.valid) rowErrors.push('Từ ngày sai định dạng');
    if (!toParsed.valid) rowErrors.push('Đến ngày sai định dạng');
    if (!examParsed.valid) rowErrors.push('Ngày thi sai định dạng');
    if (fromParsed.value && toParsed.value && toParsed.value < fromParsed.value) {
      rowErrors.push('Đến ngày nhỏ hơn Từ ngày');
    }

    if (rowErrors.length > 0) {
      errors.push(`Dòng ${rowNum}: ${rowErrors.join('; ')}`);
      continue;
    }

    const cKey = classKey(className);
    for (const wd of weekdays) {
      entries.push({
        class_name: className,
        class_key: cKey,
        weekday: wd,
        period_start: periodStart!,
        period_end: periodEnd!,
        subject,
        teacher_name: teacherName,
        teacher_key: teacherName ? classKey(teacherName) : null,
        room,
        note,
        date_from: fromParsed.value,
        date_to: toParsed.value,
        semester: semParsed?.label ?? null,
        semester_order: semParsed?.order ?? null,
        academic_year: null,
        time_range: timeRange,
        exam_date: examParsed.value,
        is_internship: false,
      });
    }
  }

  return { entries, errors, totalRows };
}

function finalizeParsedResult(
  entries: TimetableEntryInput[],
  errors: string[],
  totalRows: number,
  format: 'school' | 'flat'
): ParsedTimetableResult {
  if (totalRows === 0 && errors.length === 0) {
    errors.push('File không có dòng dữ liệu môn học nào');
  }
  if (entries.length > MAX_TIMETABLE_ROWS) {
    errors.push(
      `Số buổi học (${entries.length}) vượt quá giới hạn tối đa ${MAX_TIMETABLE_ROWS} dòng`
    );
  }

  const classCounts = new Map<string, { className: string; count: number }>();
  const semesterMap = new Map<string, ParsedSemesterMeta>();

  for (const e of entries) {
    const prevCls = classCounts.get(e.class_key);
    if (prevCls) {
      prevCls.count += 1;
    } else {
      classCounts.set(e.class_key, { className: e.class_name, count: 1 });
    }

    if (e.semester) {
      const sKey = `${e.class_key}|${e.semester}`;
      const prevSem = semesterMap.get(sKey);
      if (prevSem) {
        prevSem.count += 1;
      } else {
        semesterMap.set(sKey, {
          semester: e.semester,
          semesterOrder: e.semester_order ?? 99,
          academicYear: e.academic_year ?? null,
          className: e.class_name,
          count: 1,
        });
      }
    }
  }

  const classes = Array.from(classCounts.entries())
    .map(([key, info]) => ({
      className: info.className,
      classKey: key,
      count: info.count,
    }))
    .sort((a, b) => a.className.localeCompare(b.className, 'vi'));

  const semesters = Array.from(semesterMap.values()).sort(
    (a, b) =>
      a.className.localeCompare(b.className, 'vi') ||
      a.semesterOrder - b.semesterOrder ||
      a.semester.localeCompare(b.semester, 'vi')
  );

  return { entries, errors, classes, semesters, format, totalRows };
}

function parseWorkbookInternal(workbook: XLSX.WorkBook): ParsedTimetableResult {
  if (workbook.SheetNames.length === 0) {
    return {
      entries: [],
      errors: ['File không có trang tính nào'],
      classes: [],
      semesters: [],
      format: 'school',
      totalRows: 0,
    };
  }

  const schoolEntries: TimetableEntryInput[] = [];
  const schoolErrors: string[] = [];
  let schoolRows = 0;
  let anySchoolMatched = false;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true,
    });
    const res = parseSchoolMatrix(matrix, sheetName);
    if (res.matched) {
      anySchoolMatched = true;
      schoolEntries.push(...res.entries);
      schoolErrors.push(...res.errors);
      schoolRows += res.totalRows;
    }
  }

  if (anySchoolMatched) {
    return finalizeParsedResult(schoolEntries, schoolErrors, schoolRows, 'school');
  }

  // Fallback sang mẫu bảng phẳng cũ trên sheet đầu tiên
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const firstMatrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: '',
    raw: true,
  });
  const flatRes = parseFlatMatrix(firstMatrix);
  return finalizeParsedResult(flatRes.entries, flatRes.errors, flatRes.totalRows, 'flat');
}

export function parseTimetableWorkbook(buffer: ArrayBuffer): ParsedTimetableResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  return parseWorkbookInternal(workbook);
}

/**
 * Đọc trực tiếp nội dung CSV (từ file .csv hoặc dán trực tiếp từ Excel/CSV Phòng Đào tạo).
 * Luôn bật `raw: true` để tránh SheetJS hiểu nhầm ngày DD/MM/YYYY sang MM/DD/YYYY.
 */
export function parseTimetableCsvText(csvText: string): ParsedTimetableResult {
  const trimmed = csvText.trim();
  if (!trimmed) {
    return {
      entries: [],
      errors: ['Nội dung thời khóa biểu đang trống'],
      classes: [],
      semesters: [],
      format: 'school',
      totalRows: 0,
    };
  }
  const workbook = XLSX.read(trimmed, { type: 'string', raw: true });
  return parseWorkbookInternal(workbook);
}

export function createSampleTimetableWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const rows: unknown[][] = [
    ['HK1'],
    ['TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI', '', '', '', '', 'THỜI KHÓA BIỂU - KHÓA 2024 - 2027'],
    ['PHÒNG ĐÀO TẠO', '', '', '', '', 'Địa điểm học: Số 1 Trịnh Văn Bô, Quận Nam Từ Liêm, TP Hà Nội'],
    [],
    ['', 'Hệ đào tạo: Cao đẳng chính quy', '', '', '', '', '', 'Học kỳ: I', 'Thời gian:', '28/04/2025 - 02/08/2025'],
    ['', 'Ngành đào tạo: Tiếng Nhật', '', '', '', '', '', 'Năm học: 2024 - 2025', 'Lớp:', 'TN24-02M', 'Sĩ số: 31'],
    ['TT', 'Môn học', 'Thứ', 'Thời gian học', '', '', 'Phòng học', 'Giảng viên', 'Dự kiến ngày thi', 'Tổng số tiết của môn', 'Ghi chú', '', '', '', ''],
    ['', '', '', 'Giờ học', 'Tuần bắt đầu', 'Tuần kết thúc', '', '', '', '', '', 'số tiết/buổi', 'số tuần', 'số buổi', 'số tín'],
    [1, 'Tiếng Anh 1', 'Thứ Ba\nThứ Năm', '13:00-17:00', '2025-06-24', '2025-07-31', '510', 'Nguyễn Thục Lâm', '2025-08-07', 60, '', 5, 6, 12, 2],
    [2, 'Kỹ năng học tập', 'Thứ Hai\nThứ Tư', '13:00-17:00', '2025-06-23', '2025-07-21', '510', 'Vũ Thị Thu Hiền', '2025-07-28', 45, '', 5, 4.5, 9, 2],
    [],
    ['HK5+6+7'],
    ['TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI', '', '', '', '', 'THỜI KHÓA BIỂU - KHÓA 2024 - 2027'],
    ['', 'Hệ đào tạo: Cao đẳng chính quy', '', '', '', '', '', 'Học kỳ: V+VI+VII', 'Thời gian:', '03/08/2026 - 05/06/2027'],
    ['', 'Ngành đào tạo: Tiếng Nhật', '', '', '', '', '', 'Năm học: 2026 - 2027', 'Lớp:', 'TN24-02M', 'Sĩ số: 15'],
    ['TT', 'Môn học', 'Thứ', 'Thời gian học', '', '', 'Phòng học', 'Giảng viên', 'Dự kiến ngày thi', 'Tổng số tiết của môn', 'Ghi chú', '', '', '', ''],
    ['', '', '', 'Giờ học', 'Tuần bắt đầu', 'Tuần kết thúc', '', '', '', '', '', 'số tiết/buổi', 'số tuần', 'số buổi', 'số tín'],
    [1, 'Tiếng Nhật nâng cao 2', 'Thứ Hai\nThứ Sáu', '7:30-12:15', '2026-08-03', '2026-09-14', '510', 'Nguyễn Quang Vinh', '2026-09-21', 75, '', 6, 6.25, 13, 3],
    [2, 'Thực tập tốt nghiệp', '', '', '2026-10-26', '03/06/2027', 'Doanh nghiệp', 'Trần Minh Đức', '', 270, '', '-', 32, '-', 6],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'TN24-02M');
  return wb;
}

export function downloadTimetableTemplate(): void {
  const wb = createSampleTimetableWorkbook();
  XLSX.writeFile(wb, 'mau-thoi-khoa-bieu-7-ky-avc.xlsx');
}

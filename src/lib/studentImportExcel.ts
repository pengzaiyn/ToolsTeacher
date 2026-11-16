import * as XLSX from 'xlsx';
import {
  isPlaceholderClassName,
  normalizeStudentCode,
  sanitizeImportEmail,
  studentEmail,
} from '@/lib/email';
import type { Gender, Profile } from '@/types/database';

export type StudentDuplicateType =
  | 'none'
  | 'system_code'
  | 'file_code'
  | 'system_email'
  | 'file_email';

const INACTIVE_STATUSES = new Set([
  'thôi học',
  'đã tốt nghiệp',
  'đình chỉ tạm thời',
  'nghỉ học dài ngày',
  'hoàn thành vhpt',
]);

export function isInactiveAcademicStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase();
  return INACTIVE_STATUSES.has(s);
}

export interface StudentImportRow {
  rowNumber: number;
  fullName: string;
  gender: Gender | '';
  dateOfBirth: string;
  studentCode: string;
  className: string;
  admissionsAdvisor: string;
  educationSystem: string;
  major: string;
  cohort: string;
  initialCohort: string;
  academicStatus: string;
  statusReason: string;
  statusNote: string;
  isActive: boolean;
  emailPreview: string | null;
  error: string | null;
  duplicateType: StudentDuplicateType;
  duplicateReason: string | null;
  existingStudentId: string | null;
}

export interface StudentImportParseResult {
  sheetName: string;
  rows: StudentImportRow[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
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

function normalizeGender(value: unknown): Gender | null {
  const raw = normalizeHeader(value);
  if (raw === 'nam' || raw === 'male' || raw === 'm') return 'Nam';
  if (raw === 'nu' || raw === 'female' || raw === 'f') return 'Nữ';
  if (raw === 'khac' || raw === 'other') return 'Khác';
  return null;
}

function formatIsoDate(year: number, month: number, day: number): string | null {
  if (year < 1930 || year > new Date().getFullYear()) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  if (d.getTime() > Date.now()) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return formatIsoDate(parsed.y, parsed.m, parsed.d);
    }
  }

  const text = String(value).trim();
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (isoMatch) {
    return formatIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const vnMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
  if (vnMatch) {
    return formatIsoDate(Number(vnMatch[3]), Number(vnMatch[2]), Number(vnMatch[1]));
  }

  return null;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const exact = headers.findIndex((h) => aliases.includes(h));
  if (exact !== -1) return exact;
  return headers.findIndex((h) => aliases.some((alias) => h.includes(alias)));
}

function findLatestStatusColumn(headers: string[]): number {
  let bestIdx = -1;
  let bestScore = -1;
  headers.forEach((h, idx) => {
    const m = /^thang\s+(\d{1,2})\s+(\d{4})$/.exec(h);
    if (m) {
      const score = Number(m[2]) * 100 + Number(m[1]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }
  });
  if (bestIdx !== -1) return bestIdx;
  return findColumnIndex(headers, ['trang thai', 'tinh trang', 'status']);
}

export async function parseStudentImportWorkbook(
  file: File,
  existingStudents: Profile[]
): Promise<StudentImportParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const sheetName =
    wb.SheetNames.find((name) => normalizeHeader(name).includes('thong ke')) ??
    wb.SheetNames.find((name) => normalizeHeader(name).includes('danhsach')) ??
    wb.SheetNames.find((name) => !normalizeHeader(name).includes('huongdan')) ??
    wb.SheetNames[0];

  if (!sheetName) {
    throw new Error('File Excel không có trang tính dữ liệu nào');
  }

  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rawRows.length, 15); i += 1) {
    const candidate = (rawRows[i] ?? []).map(normalizeHeader);
    const hasName = findColumnIndex(candidate, ['ho va ten', 'ho ten', 'full name']) !== -1;
    const hasIdentity =
      findColumnIndex(candidate, ['ma sinh vien', 'msv', 'ma sv', 'lop', 'ngay sinh', 'email']) !== -1;
    if (hasName && hasIdentity) {
      headerRowIndex = i;
      headers = candidate;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      'Không tìm thấy dòng tiêu đề hợp lệ (cần có cột "Họ và tên" và "Mã sinh viên" / "Lớp").'
    );
  }

  const colName = findColumnIndex(headers, ['ho va ten', 'ho ten', 'full name']);
  const colGender = findColumnIndex(headers, ['gioi tinh', 'gender']);
  const colDob = findColumnIndex(headers, ['ngay sinh', 'dob', 'date of birth']);
  const colCode = findColumnIndex(headers, ['ma sinh vien', 'msv', 'ma sv', 'student code']);
  const colEmail = findColumnIndex(headers, ['email']);
  const colClass = findColumnIndex(headers, ['lop hoc', 'lop', 'class']);
  const colAdvisor = findColumnIndex(headers, [
    'tu van tuyen sinh',
    'tu van ts',
    'tu van',
    'advisor',
  ]);
  const colEduSystem = findColumnIndex(headers, ['he dao tao', 'he']);
  const colMajor = findColumnIndex(headers, ['nganh dao tao', 'nganh']);
  const colCohort = findColumnIndex(headers, ['khoa']);
  const colInitialCohort = findColumnIndex(headers, ['khoa ban dau']);
  const colStatus = findLatestStatusColumn(headers);
  const colReason = findColumnIndex(headers, ['ly do']);
  const colNote = findColumnIndex(headers, ['ghi chu']);

  const existingByCode = new Map<string, Profile>();
  const existingByEmail = new Map<string, Profile>();
  existingStudents.forEach((s) => {
    const code = s.student_code?.trim().toUpperCase();
    if (code) existingByCode.set(code, s);
    existingByEmail.set(s.email.toLowerCase(), s);
  });

  const seenCodeRow = new Map<string, number>();
  const seenEmailRow = new Map<string, number>();

  const rows: StudentImportRow[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i += 1) {
    const raw = rawRows[i] ?? [];
    const rowNumber = i + 1;
    const fullName = String(raw[colName] ?? '').trim().replace(/\s+/g, ' ');
    const rawGender = colGender >= 0 ? raw[colGender] : '';
    const rawDob = colDob >= 0 ? raw[colDob] : '';
    const rawCode = colCode >= 0 ? String(raw[colCode] ?? '').trim() : '';
    const rawEmail = colEmail >= 0 ? String(raw[colEmail] ?? '').trim() : '';
    const rawClassName =
      colClass >= 0 ? String(raw[colClass] ?? '').trim().replace(/\s+/g, ' ') : '';
    const className = isPlaceholderClassName(rawClassName) ? '' : rawClassName;
    const admissionsAdvisor =
      colAdvisor >= 0 ? String(raw[colAdvisor] ?? '').trim().replace(/\s+/g, ' ') : '';
    const educationSystem =
      colEduSystem >= 0 ? String(raw[colEduSystem] ?? '').trim().replace(/\s+/g, ' ') : '';
    const major =
      colMajor >= 0 ? String(raw[colMajor] ?? '').trim().replace(/\s+/g, ' ') : '';
    const cohort =
      colCohort >= 0 ? String(raw[colCohort] ?? '').trim().replace(/\s+/g, ' ') : '';
    const initialCohort =
      colInitialCohort >= 0 ? String(raw[colInitialCohort] ?? '').trim().replace(/\s+/g, ' ') : '';
    const academicStatus =
      colStatus >= 0 ? String(raw[colStatus] ?? '').trim().replace(/\s+/g, ' ') : '';
    const statusReason =
      colReason >= 0 ? String(raw[colReason] ?? '').trim().replace(/\s+/g, ' ') : '';
    const statusNote =
      colNote >= 0 ? String(raw[colNote] ?? '').trim() : '';

    const hasAnyValue =
      Boolean(fullName) ||
      Boolean(String(rawGender ?? '').trim()) ||
      Boolean(String(rawDob ?? '').trim()) ||
      Boolean(rawCode) ||
      Boolean(rawClassName);

    if (!hasAnyValue) continue;

    const errors: string[] = [];
    if (!fullName) {
      errors.push('Thiếu họ tên');
    }

    const parsedGender = String(rawGender ?? '').trim() ? normalizeGender(rawGender) : null;
    if (String(rawGender ?? '').trim() && !parsedGender) {
      errors.push('Giới tính phải là Nam, Nữ hoặc Khác');
    }

    const parsedDob = String(rawDob ?? '').trim() ? parseExcelDate(rawDob) : null;
    if (String(rawDob ?? '').trim() && !parsedDob) {
      errors.push('Ngày sinh không hợp lệ (dùng DD/MM/YYYY hoặc YYYY-MM-DD)');
    }

    let normalizedCode = '';
    let duplicateType: StudentDuplicateType = 'none';
    let duplicateReason: string | null = null;
    let existingStudentId: string | null = null;

    if (rawCode) {
      const codeResult = normalizeStudentCode(rawCode);
      if (!codeResult) {
        errors.push('MSV phải gồm 6–20 ký tự chữ/số (hoặc 7 số cuối)');
      } else {
        normalizedCode = codeResult;
        const fileRow = seenCodeRow.get(normalizedCode);
        const sysMatch = existingByCode.get(normalizedCode);
        if (fileRow !== undefined) {
          duplicateType = 'file_code';
          duplicateReason = `Trùng MSV ${normalizedCode} với dòng ${fileRow} (nhiều lớp)`;
        } else {
          seenCodeRow.set(normalizedCode, rowNumber);
          if (sysMatch) {
            duplicateType = 'system_code';
            existingStudentId = sysMatch.id;
            duplicateReason = `Trùng MSV ${normalizedCode} (${sysMatch.full_name})`;
          }
        }
      }
    }

    const sanitizedEmail = rawEmail ? sanitizeImportEmail(rawEmail) : null;
    const fallbackEmail = fullName && normalizedCode ? studentEmail(fullName, normalizedCode) : null;
    let emailPreview = sanitizedEmail ?? fallbackEmail;

    if (normalizedCode && !emailPreview) {
      errors.push('Không tạo được email từ họ tên và MSV');
    } else if (emailPreview) {
      const lowerEmail = emailPreview.toLowerCase();
      const fileEmailRow = seenEmailRow.get(lowerEmail);
      const sysEmailMatch = existingByEmail.get(lowerEmail);
      if (fileEmailRow !== undefined) {
        if (duplicateType === 'none' && fallbackEmail && fallbackEmail.toLowerCase() !== lowerEmail) {
          emailPreview = fallbackEmail;
        } else if (duplicateType === 'none') {
          duplicateType = 'file_email';
          duplicateReason = `Trùng email ${emailPreview} với dòng ${fileEmailRow} trong file`;
        }
      } else {
        seenEmailRow.set(lowerEmail, rowNumber);
        if (duplicateType === 'none' && sysEmailMatch) {
          duplicateType = 'system_email';
          existingStudentId = sysEmailMatch.id;
          duplicateReason = `Trùng email ${emailPreview} (${sysEmailMatch.full_name})`;
        }
      }
    }

    rows.push({
      rowNumber,
      fullName,
      gender: parsedGender ?? '',
      dateOfBirth: parsedDob ?? '',
      studentCode: normalizedCode,
      className,
      admissionsAdvisor,
      educationSystem,
      major,
      cohort,
      initialCohort,
      academicStatus,
      statusReason,
      statusNote,
      isActive: !isInactiveAcademicStatus(academicStatus),
      emailPreview,
      error: errors.length > 0 ? errors.join('; ') : null,
      duplicateType,
      duplicateReason,
      existingStudentId,
    });
  }

  if (rows.length === 0) {
    throw new Error('File Excel không có dòng dữ liệu sinh viên nào.');
  }

  const validCount = rows.filter((r) => !r.error && r.duplicateType === 'none').length;
  const duplicateCount = rows.filter((r) => !r.error && r.duplicateType !== 'none').length;
  const errorCount = rows.filter((r) => Boolean(r.error)).length;
  return {
    sheetName,
    rows,
    validCount,
    duplicateCount,
    errorCount,
  };
}

export function downloadStudentImportTemplate() {
  const wb = XLSX.utils.book_new();
  const sampleRows = [
    [
      'STT',
      'Họ và tên',
      'Mã sinh viên',
      'Email',
      'Hệ đào tạo',
      'Ngành đào tạo',
      'Khóa',
      'Khóa ban đầu',
      'Lớp',
      'Trạng thái',
      'Lý do',
      'Ghi chú',
    ],
    [
      1,
      'Nguyễn Văn An',
      '61112600001',
      'an12600001@caodangvietmyhanoi.edu.vn',
      'CAO ĐẲNG CHÍNH QUY',
      'Công nghệ thông tin (UDPM)',
      'K26',
      'K26',
      'UDPM26A-01',
      'Đang học',
      '',
      '',
    ],
    [
      2,
      'Trần Thị Bình',
      '',
      '',
      '9+ 7 MÔN',
      'Thiết kế đồ hoạ (VIG)',
      'K26',
      'K26',
      '10A4',
      'Đang học',
      '',
      '(Để trống MSV hệ thống tự cấp)',
    ],
  ];

  const wsData = XLSX.utils.aoa_to_sheet(sampleRows);
  wsData['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 15 },
    { wch: 36 },
    { wch: 20 },
    { wch: 26 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'DanhSachSinhVien');

  const guideRows = [
    ['HƯỚNG DẪN NHẬP SINH VIÊN TỪ FILE EXCEL'],
    [],
    ['1. Cột bắt buộc: Họ và tên. Các cột khác (Mã sinh viên, Email, Hệ đào tạo, Ngành đào tạo, Khóa, Lớp, Trạng thái...) có thể tùy chọn.'],
    ['2. Mã sinh viên: Nhập mã sinh viên của trường (5111..., 6111..., 8111..., 9111..., N811...), 7 số cuối, hoặc để trống để hệ thống tự cấp mã 6111 mới.'],
    ['3. Nhiều lớp: Nếu một sinh viên xuất hiện ở 2 dòng với 2 lớp khác nhau (VD lớp văn hóa + lớp nghề), hệ thống sẽ gộp chung 1 tài khoản và ghi danh vào cả 2 lớp.'],
    ['4. Trạng thái: Thôi học, Đã tốt nghiệp, Đình chỉ tạm thời, Nghỉ học dài ngày, Hoàn thành VHPT sẽ tự động khóa đăng nhập.'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'HuongDan');

  XLSX.writeFile(wb, 'mau-nhap-sinh-vien-avc.xlsx');
}

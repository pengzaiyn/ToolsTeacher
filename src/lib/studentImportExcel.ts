import * as XLSX from 'xlsx';
import { normalizeStudentCode, studentEmail } from '@/lib/email';
import type { Gender, Profile } from '@/types/database';

export interface StudentImportRow {
  rowNumber: number;
  fullName: string;
  gender: Gender | '';
  dateOfBirth: string;
  studentCode: string;
  className: string;
  admissionsAdvisor: string;
  emailPreview: string | null;
  error: string | null;
}

export interface StudentImportParseResult {
  sheetName: string;
  rows: StudentImportRow[];
  validCount: number;
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
  return headers.findIndex((h) => aliases.some((alias) => h === alias || h.includes(alias)));
}

export async function parseStudentImportWorkbook(
  file: File,
  existingStudents: Profile[]
): Promise<StudentImportParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetName =
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
    const hasDob = findColumnIndex(candidate, ['ngay sinh', 'dob', 'date of birth']) !== -1;
    if (hasName && (hasDob || candidate.some((c) => c.includes('gioi tinh')))) {
      headerRowIndex = i;
      headers = candidate;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      'Không tìm thấy dòng tiêu đề hợp lệ (cần có cột "Họ và tên", "Giới tính", "Ngày sinh").'
    );
  }

  const colName = findColumnIndex(headers, ['ho va ten', 'ho ten', 'full name']);
  const colGender = findColumnIndex(headers, ['gioi tinh', 'gender']);
  const colDob = findColumnIndex(headers, ['ngay sinh', 'dob', 'date of birth']);
  const colCode = findColumnIndex(headers, ['ma sinh vien', 'msv', 'ma sv', 'student code']);
  const colClass = findColumnIndex(headers, ['lop hoc', 'lop', 'class']);
  const colAdvisor = findColumnIndex(headers, [
    'tu van tuyen sinh',
    'tu van ts',
    'tu van',
    'advisor',
  ]);

  const existingCodes = new Set(
    existingStudents
      .map((s) => s.student_code?.trim())
      .filter((v): v is string => Boolean(v))
  );
  const existingEmails = new Set(existingStudents.map((s) => s.email.toLowerCase()));

  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  const rows: StudentImportRow[] = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i += 1) {
    const raw = rawRows[i] ?? [];
    const fullName = String(raw[colName] ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    const rawGender = colGender >= 0 ? raw[colGender] : '';
    const rawDob = colDob >= 0 ? raw[colDob] : '';
    const rawCode = colCode >= 0 ? String(raw[colCode] ?? '').trim() : '';
    const className =
      colClass >= 0 ? String(raw[colClass] ?? '').trim().replace(/\s+/g, ' ') : '';
    const admissionsAdvisor =
      colAdvisor >= 0 ? String(raw[colAdvisor] ?? '').trim().replace(/\s+/g, ' ') : '';

    const hasAnyValue =
      Boolean(fullName) ||
      Boolean(String(rawGender ?? '').trim()) ||
      Boolean(String(rawDob ?? '').trim()) ||
      Boolean(rawCode) ||
      Boolean(className);

    if (!hasAnyValue) continue;

    const errors: string[] = [];
    if (!fullName) {
      errors.push('Thiếu họ tên');
    }

    const parsedGender = normalizeGender(rawGender);
    if (!parsedGender) {
      errors.push('Giới tính phải là Nam, Nữ hoặc Khác');
    }

    const parsedDob = parseExcelDate(rawDob);
    if (!parsedDob) {
      errors.push('Ngày sinh không hợp lệ (dùng DD/MM/YYYY hoặc YYYY-MM-DD)');
    }

    let normalizedCode = '';
    if (rawCode) {
      const codeResult = normalizeStudentCode(rawCode);
      if (!codeResult) {
        errors.push('MSV phải đủ 11 số đầu 6111 hoặc 7 số cuối');
      } else {
        normalizedCode = codeResult;
        if (existingCodes.has(normalizedCode)) {
          errors.push(`Trùng MSV ${normalizedCode} trên hệ thống`);
        } else if (seenCodes.has(normalizedCode)) {
          errors.push(`Trùng MSV ${normalizedCode} trong file`);
        }
        seenCodes.add(normalizedCode);
      }
    }

    const emailPreview =
      fullName && normalizedCode ? studentEmail(fullName, normalizedCode) : null;

    if (normalizedCode && !emailPreview) {
      errors.push('Không tạo được email từ họ tên và MSV');
    } else if (emailPreview) {
      const lowerEmail = emailPreview.toLowerCase();
      if (existingEmails.has(lowerEmail)) {
        errors.push(`Email ${emailPreview} đã tồn tại`);
      } else if (seenEmails.has(lowerEmail)) {
        errors.push(`Trùng email ${emailPreview} trong file`);
      }
      seenEmails.add(lowerEmail);
    }

    rows.push({
      rowNumber: i + 1,
      fullName,
      gender: parsedGender ?? '',
      dateOfBirth: parsedDob ?? '',
      studentCode: normalizedCode,
      className,
      admissionsAdvisor,
      emailPreview,
      error: errors.length > 0 ? errors.join('; ') : null,
    });
  }

  if (rows.length === 0) {
    throw new Error('File Excel không có dòng dữ liệu sinh viên nào.');
  }

  const validCount = rows.filter((r) => !r.error).length;
  return {
    sheetName,
    rows,
    validCount,
    errorCount: rows.length - validCount,
  };
}

export function downloadStudentImportTemplate() {
  const wb = XLSX.utils.book_new();
  const sampleRows = [
    [
      'STT',
      'Mã sinh viên',
      'Họ và tên',
      'Giới tính',
      'Ngày sinh',
      'Lớp',
      'Tư vấn tuyển sinh',
      'Email trường (tham khảo)',
    ],
    [
      1,
      '61112600001',
      'Nguyễn Văn An',
      'Nam',
      '2006-02-14',
      'CNTT-K18A',
      'Cô Hương',
      'an12600001@caodangvietmyhanoi.edu.vn',
    ],
    [
      2,
      '',
      'Trần Thị Bình',
      'Nữ',
      '21/05/2006',
      'CNTT-K18A',
      '',
      '(Để trống MSV hệ thống sẽ tự cấp)',
    ],
  ];

  const wsData = XLSX.utils.aoa_to_sheet(sampleRows);
  wsData['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 36 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'DanhSachSinhVien');

  const guideRows = [
    ['HƯỚNG DẪN NHẬP SINH VIÊN TỪ FILE EXCEL'],
    [],
    ['1. Cột bắt buộc: Họ và tên, Giới tính (Nam / Nữ / Khác), Ngày sinh (YYYY-MM-DD hoặc DD/MM/YYYY).'],
    ['2. Mã sinh viên (tùy chọn): Nhập đủ 11 số bắt đầu bằng 6111, hoặc 7 số cuối, hoặc để trống để hệ thống tự cấp mã 6111 tiếp theo.'],
    ['3. Lớp (tùy chọn): Tên lớp trùng khớp với Thời khóa biểu để hệ thống tự động xếp sinh viên vào lớp học.'],
    ['4. Email trường: Hệ thống tự tạo theo quy chuẩn tên + 8 số cuối MSV + @caodangvietmyhanoi.edu.vn; cột Email trong file chỉ để tham khảo.'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 96 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'HuongDan');

  XLSX.writeFile(wb, 'mau-nhap-sinh-vien-avc.xlsx');
}


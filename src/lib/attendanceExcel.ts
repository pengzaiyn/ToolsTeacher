import * as XLSX from 'xlsx';
import { ATTENDANCE_STATUS_META, type StudentAttendanceSummary } from '@/lib/attendance';
import { formatDateVi } from '@/lib/week';
import type { AttendanceRecord, AttendanceSession, AttendanceStatus } from '@/types/database';

function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

// Bảng CRC32 tiêu chuẩn để đóng gói lại file ZIP (.xlsx) không nén (STORE method 0)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CUSTOM_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FFC8102E"/><name val="Arial"/></font>
    <font><b/><sz val="12"/><color rgb="FF1A365D"/><name val="Arial"/></font>
    <font><b/><sz val="11"/><color rgb="FF15803D"/><name val="Arial"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1A365D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFCE8EC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;

function applyStylesToWorksheetXml(xml: string): string {
  return xml.replace(/<row\b[^>]*>[\s\S]*?<\/row>/g, (rowXml) => {
    let styleIdx: number | null = null;
    if (rowXml.includes('<v>Cấm thi</v>')) {
      styleIdx = 2; // Bôi đỏ nền #FCE8EC + chữ đỏ đậm #C8102E + đóng khung
    } else if (rowXml.includes('<v>Đủ điều kiện thi</v>')) {
      styleIdx = 3; // Đóng khung chuẩn cho dòng Đủ điều kiện thi
    } else if (rowXml.includes('<v>Mã sinh viên</v>') || rowXml.includes('<v>Ngày học</v>')) {
      styleIdx = 1; // Header bảng: nền xanh navy #1A365D + chữ trắng đậm
    } else if (rowXml.includes('DANH SÁCH CẤM THI') || rowXml.includes('SINH VIÊN CẤM THI')) {
      styleIdx = 4; // Tiêu đề mục Cấm thi: chữ đỏ đậm
    } else if (
      rowXml.includes('DANH SÁCH XÉT ĐIỀU KIỆN') ||
      rowXml.includes('DANH SÁCH ĐỦ ĐIỀU KIỆN') ||
      rowXml.includes('DANH SÁCH SINH VIÊN ĐỦ ĐIỀU KIỆN') ||
      rowXml.includes('DANH SÁCH CÁC BUỔI')
    ) {
      styleIdx = 5; // Tiêu đề chính: chữ xanh navy đậm
    }

    if (styleIdx === null) return rowXml;
    return rowXml.replace(/<c r="([A-Z]+\d+)"(?![^>]*\bs=")/g, `<c r="$1" s="${styleIdx}"`);
  });
}

/**
 * Đọc ZIP không nén từ SheetJS, tiêm bảng màu OpenXML (xl/styles.xml) và gán style bôi đỏ
 * cho toàn bộ dòng sinh viên "Cấm thi", sau đó đóng gói lại thành buffer .xlsx hợp lệ 100%.
 */
export function injectOpenXmlAttendanceStyles(rawZip: Uint8Array): Uint8Array {
  const view = new DataView(rawZip.buffer, rawZip.byteOffset, rawZip.byteLength);
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();

  const entries: Array<{
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    modTime: number;
    modDate: number;
  }> = [];

  let offset = 0;
  while (offset + 30 <= rawZip.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Local file header signature
    const method = view.getUint16(offset + 8, true);
    if (method !== 0) {
      // Nếu không phải STORE (0), trả nguyên gốc để an toàn
      return rawZip;
    }
    const modTime = view.getUint16(offset + 10, true);
    const modDate = view.getUint16(offset + 12, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const nameBytes = rawZip.subarray(nameStart, nameStart + nameLen);
    const fileName = decoder.decode(nameBytes);
    let dataBytes = rawZip.subarray(dataStart, dataStart + compSize);

    if (fileName === 'xl/styles.xml') {
      dataBytes = encoder.encode(CUSTOM_STYLES_XML);
    } else if (/^xl\/worksheets\/sheet\d+\.xml$/.test(fileName)) {
      const xml = decoder.decode(dataBytes);
      dataBytes = encoder.encode(applyStylesToWorksheetXml(xml));
    }

    entries.push({ nameBytes, dataBytes, modTime, modDate });
    offset = dataStart + compSize;
  }

  if (entries.length === 0) return rawZip;

  // Tính kích thước file ZIP mới
  let localTotal = 0;
  let centralTotal = 0;
  for (const e of entries) {
    localTotal += 30 + e.nameBytes.length + e.dataBytes.length;
    centralTotal += 46 + e.nameBytes.length;
  }
  const out = new Uint8Array(localTotal + centralTotal + 22);
  const outView = new DataView(out.buffer);

  let localOff = 0;
  const localOffsets: number[] = [];
  const crcs: number[] = [];

  for (const e of entries) {
    localOffsets.push(localOff);
    const fileCrc = crc32(e.dataBytes);
    crcs.push(fileCrc);

    outView.setUint32(localOff, 0x04034b50, true);
    outView.setUint16(localOff + 4, 20, true);
    outView.setUint16(localOff + 6, 0, true);
    outView.setUint16(localOff + 8, 0, true);
    outView.setUint16(localOff + 10, e.modTime, true);
    outView.setUint16(localOff + 12, e.modDate, true);
    outView.setUint32(localOff + 14, fileCrc, true);
    outView.setUint32(localOff + 18, e.dataBytes.length, true);
    outView.setUint32(localOff + 22, e.dataBytes.length, true);
    outView.setUint16(localOff + 26, e.nameBytes.length, true);
    outView.setUint16(localOff + 28, 0, true);

    out.set(e.nameBytes, localOff + 30);
    out.set(e.dataBytes, localOff + 30 + e.nameBytes.length);
    localOff += 30 + e.nameBytes.length + e.dataBytes.length;
  }

  let centralOff = localOff;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    outView.setUint32(centralOff, 0x02014b50, true);
    outView.setUint16(centralOff + 4, 20, true);
    outView.setUint16(centralOff + 6, 20, true);
    outView.setUint16(centralOff + 8, 0, true);
    outView.setUint16(centralOff + 10, 0, true);
    outView.setUint16(centralOff + 12, e.modTime, true);
    outView.setUint16(centralOff + 14, e.modDate, true);
    outView.setUint32(centralOff + 16, crcs[i], true);
    outView.setUint32(centralOff + 20, e.dataBytes.length, true);
    outView.setUint32(centralOff + 24, e.dataBytes.length, true);
    outView.setUint16(centralOff + 28, e.nameBytes.length, true);
    outView.setUint16(centralOff + 30, 0, true);
    outView.setUint16(centralOff + 32, 0, true);
    outView.setUint16(centralOff + 34, 0, true);
    outView.setUint16(centralOff + 36, 0, true);
    outView.setUint32(centralOff + 38, 0, true);
    outView.setUint32(centralOff + 42, localOffsets[i], true);

    out.set(e.nameBytes, centralOff + 46);
    centralOff += 46 + e.nameBytes.length;
  }

  // End of Central Directory Record (EOCD)
  outView.setUint32(centralOff, 0x06054b50, true);
  outView.setUint16(centralOff + 4, 0, true);
  outView.setUint16(centralOff + 6, 0, true);
  outView.setUint16(centralOff + 8, entries.length, true);
  outView.setUint16(centralOff + 10, entries.length, true);
  outView.setUint32(centralOff + 12, centralTotal, true);
  outView.setUint32(centralOff + 16, localTotal, true);
  outView.setUint16(centralOff + 20, 0, true);

  return out;
}

export interface AttendanceExportParams {
  className: string;
  subject: string | null;
  teacherName: string | null;
  warningThresholdPct: number;
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  summaries: StudentAttendanceSummary[];
}

export function buildStyledAttendanceExcelBuffer(params: AttendanceExportParams): Uint8Array {
  const {
    className,
    subject,
    teacherName,
    warningThresholdPct,
    sessions,
    records,
    summaries,
  } = params;

  const sortedSessions = [...sessions].sort(
    (a, b) =>
      a.session_date.localeCompare(b.session_date) || a.created_at.localeCompare(b.created_at)
  );

  const statusMap = new Map<string, AttendanceStatus>();
  records.forEach((rec) => {
    statusMap.set(`${rec.student_id}:${rec.session_id}`, rec.status);
  });

  const sessionHeaders = sortedSessions.map((s) => {
    const shortDate = formatDateVi(s.session_date).slice(0, 5);
    return `${shortDate} (${s.title})`;
  });

  const eligibleStudents = summaries.filter((stu) => !stu.isWarning);
  const bannedStudents = summaries.filter((stu) => stu.isWarning);

  const tableHeader: string[] = [
    'STT',
    'Mã sinh viên',
    'Họ và tên',
    'Lớp hành chính',
    ...sessionHeaders,
    'Có mặt',
    'Đi muộn',
    'Có phép',
    'Vắng',
    'Tỷ lệ vắng (%)',
    'Điểm CC (10)',
    'Điều kiện dự thi',
  ];

  function buildStudentRow(stu: StudentAttendanceSummary, idx: number): (string | number)[] {
    const sessionCells = sortedSessions.map((s) => {
      const st = statusMap.get(`${stu.studentId}:${s.id}`);
      return st ? ATTENDANCE_STATUS_META[st].shortCode : '-';
    });
    return [
      idx + 1,
      stu.studentCode ?? '',
      stu.fullName,
      stu.homeroomClass ?? '',
      ...sessionCells,
      stu.presentCount,
      stu.lateCount,
      stu.excusedCount,
      stu.absentCount,
      stu.absentPct,
      stu.attendanceScore10 ?? '',
      stu.isWarning ? 'Cấm thi' : 'Đủ điều kiện thi',
    ];
  }

  const colWidths = [
    { wch: 6 },
    { wch: 15 },
    { wch: 24 },
    { wch: 16 },
    ...sortedSessions.map(() => ({ wch: 15 })),
    { wch: 9 },
    { wch: 9 },
    { wch: 9 },
    { wch: 8 },
    { wch: 15 },
    { wch: 14 },
    { wch: 20 },
  ];

  // Sheet 1: Tổng hợp cả lớp (xếp sinh viên Cấm thi được bôi đỏ nổi bật + tách 2 mục rõ ràng)
  const combinedRows: (string | number)[][] = [
    ['DANH SÁCH XÉT ĐIỀU KIỆN DỰ THI & ĐIỂM DANH - TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI'],
    [
      `Lớp: ${className}`,
      subject ? `Môn: ${subject}` : 'Môn: —',
      `Giảng viên: ${teacherName || 'Chưa phân công'}`,
      `Ngưỡng cấm thi: Vắng > ${warningThresholdPct}%`,
    ],
    [
      `Tổng sĩ số: ${summaries.length} SV`,
      `Đủ điều kiện thi: ${eligibleStudents.length} SV`,
      `Cấm thi: ${bannedStudents.length} SV`,
      'Ký hiệu: C = Có mặt, M = Đi muộn, P = Có phép, V = Vắng',
    ],
    [],
    [`I. MỤC 1: DANH SÁCH ĐỦ ĐIỀU KIỆN THI (${eligibleStudents.length} SINH VIÊN)`],
    tableHeader,
    ...(eligibleStudents.length > 0
      ? eligibleStudents.map((stu, idx) => buildStudentRow(stu, idx))
      : [['', '', 'Không có sinh viên trong mục này']]),
    [],
    [
      `II. MỤC 2: DANH SÁCH CẤM THI (${bannedStudents.length} SINH VIÊN - VẮNG QUÁ ${warningThresholdPct}%)`,
    ],
    tableHeader,
    ...(bannedStudents.length > 0
      ? bannedStudents.map((stu, idx) => buildStudentRow(stu, idx))
      : [['', '', 'Không có sinh viên nào bị cấm thi']]),
  ];

  const wb = XLSX.utils.book_new();

  const wsCombined = XLSX.utils.aoa_to_sheet(combinedRows);
  wsCombined['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsCombined, 'XetDieuKienThi');

  // Sheet 2: Tab "Đủ điều kiện thi"
  const eligibleSheetRows: (string | number)[][] = [
    [`DANH SÁCH SINH VIÊN ĐỦ ĐIỀU KIỆN THI - LỚP ${className.toUpperCase()}`],
    [
      subject ? `Môn: ${subject}` : 'Môn: —',
      `Giảng viên: ${teacherName || 'Chưa phân công'}`,
      `Số lượng: ${eligibleStudents.length}/${summaries.length} sinh viên`,
    ],
    [],
    tableHeader,
    ...(eligibleStudents.length > 0
      ? eligibleStudents.map((stu, idx) => buildStudentRow(stu, idx))
      : [['', '', 'Không có sinh viên trong danh sách này']]),
  ];
  const wsEligible = XLSX.utils.aoa_to_sheet(eligibleSheetRows);
  wsEligible['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsEligible, 'Đủ điều kiện thi');

  // Sheet 3: Tab "Cấm thi" (toàn bộ dòng SV bị cấm thi được tự động bôi đỏ nền #FCE8EC + chữ đỏ đậm #C8102E)
  const bannedSheetRows: (string | number)[][] = [
    [
      `DANH SÁCH SINH VIÊN CẤM THI (VẮNG > ${warningThresholdPct}%) - LỚP ${className.toUpperCase()}`,
    ],
    [
      subject ? `Môn: ${subject}` : 'Môn: —',
      `Giảng viên: ${teacherName || 'Chưa phân công'}`,
      `Số lượng cấm thi: ${bannedStudents.length}/${summaries.length} sinh viên`,
    ],
    [],
    tableHeader,
    ...(bannedStudents.length > 0
      ? bannedStudents.map((stu, idx) => buildStudentRow(stu, idx))
      : [['', '', 'Không có sinh viên nào bị cấm thi']]),
  ];
  const wsBanned = XLSX.utils.aoa_to_sheet(bannedSheetRows);
  wsBanned['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsBanned, 'Cấm thi');

  // Sheet 4: Chi tiết các buổi điểm danh
  const sessionDetailRows: (string | number)[][] = [
    ['DANH SÁCH CÁC BUỔI ĐIỂM DANH'],
    [],
    ['STT', 'Ngày học', 'Tên buổi', 'Môn học', 'Tiết', 'Phòng', 'Ghi chú'],
    ...sortedSessions.map((s, idx) => [
      idx + 1,
      formatDateVi(s.session_date),
      s.title,
      s.subject ?? '',
      s.period_start && s.period_end ? `${s.period_start}-${s.period_end}` : '',
      s.room ?? '',
      s.note ?? '',
    ]),
  ];
  const wsDetail = XLSX.utils.aoa_to_sheet(sessionDetailRows);
  wsDetail['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 26 },
    { wch: 24 },
    { wch: 10 },
    { wch: 12 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'ChiTietBuoiHoc');

  const rawOut = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    compression: false,
  }) as ArrayBuffer;

  return injectOpenXmlAttendanceStyles(new Uint8Array(rawOut));
}

export function exportAttendanceToExcel(params: AttendanceExportParams) {
  const styledBytes = buildStyledAttendanceExcelBuffer(params);
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `xet-dieu-kien-thi-${safeFilePart(params.className)}-${stamp}.xlsx`;

  const blob = new Blob([styledBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

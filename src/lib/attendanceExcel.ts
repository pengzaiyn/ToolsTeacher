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

export function exportAttendanceToExcel(params: {
  className: string;
  subject: string | null;
  teacherName: string | null;
  warningThresholdPct: number;
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  summaries: StudentAttendanceSummary[];
}) {
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

  // Sheet 1: Bảng tổng hợp có đủ 2 mục "I. Đủ điều kiện thi" và "II. Cấm thi" trên cùng 1 trang
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

  // Sheet 2: Tách riêng tab "Đủ điều kiện thi"
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

  // Sheet 3: Tách riêng tab "Cấm thi"
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

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `xet-dieu-kien-thi-${safeFilePart(className)}-${stamp}.xlsx`);
}

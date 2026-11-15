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

  const sortedSessions = [...sessions].sort((a, b) =>
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

  const matrixRows: (string | number)[][] = [
    ['SỔ ĐIỂM DANH CHUYÊN CẦN - TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI'],
    [
      `Lớp: ${className}`,
      subject ? `Môn: ${subject}` : 'Môn: —',
      `Giảng viên: ${teacherName || 'Chưa phân công'}`,
      `Ngưỡng cảnh báo vắng: > ${warningThresholdPct}%`,
    ],
    ['Quy ước ký hiệu: C = Có mặt, M = Đi muộn, P = Có phép, V = Vắng, - = Chưa điểm danh'],
    [],
    [
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
      'Cảnh báo',
    ],
    ...summaries.map((stu, idx) => {
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
        stu.isWarning ? `Vắng quá ngưỡng (>${warningThresholdPct}%)` : 'Bình thường',
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
  wsMatrix['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 24 },
    { wch: 16 },
    ...sortedSessions.map(() => ({ wch: 16 })),
    { wch: 9 },
    { wch: 9 },
    { wch: 9 },
    { wch: 8 },
    { wch: 15 },
    { wch: 14 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'DiemDanh');

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
  XLSX.writeFile(wb, `diem-danh-${safeFilePart(className)}-${stamp}.xlsx`);
}


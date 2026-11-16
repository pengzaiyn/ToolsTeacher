import * as XLSX from 'xlsx';
import type { GradebookStudentRow } from '@/lib/gradebook';
import type { Assignment, ClassGradebookSettings } from '@/types/database';

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

export function exportGradebookToExcel(params: {
  className: string;
  subject: string | null;
  teacherName: string | null;
  assignments: Assignment[];
  rows: GradebookStudentRow[];
  settings: Pick<
    ClassGradebookSettings,
    'attendance_weight' | 'assignment_weight' | 'absence_warning_pct' | 'late_weight' | 'excused_weight'
  >;
}) {
  const { className, subject, teacherName, assignments, rows, settings } = params;

  const assignmentHeaders = assignments.map((a) => `${a.title} (/${a.max_score})`);

  const sheetRows: (string | number)[][] = [
    ['SỔ ĐIỂM TỔNG HỢP - TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI'],
    [
      `Lớp: ${className}`,
      subject ? `Môn: ${subject}` : 'Môn: —',
      `Giảng viên: ${teacherName || 'Chưa phân công'}`,
      `Trọng số: Chuyên cần ${settings.attendance_weight}% + Bài tập ${settings.assignment_weight}%`,
    ],
    [],
    [
      'STT',
      'Mã sinh viên',
      'Họ và tên',
      'Lớp hành chính',
      'Vắng / Tổng buổi',
      'Tỷ lệ vắng (%)',
      `Chuyên cần (${settings.attendance_weight}%)`,
      ...assignmentHeaders,
      `TB Bài tập (${settings.assignment_weight}%)`,
      'Điểm tổng kết (10)',
      'Xếp loại',
      'Ghi chú chuyên cần',
    ],
    ...rows.map((row, idx) => {
      const assignScores = assignments.map((a) => {
        const cell = row.assignmentCells[a.id];
        return cell && cell.rawScore !== null ? cell.rawScore : '';
      });
      return [
        idx + 1,
        row.studentCode ?? '',
        row.fullName,
        row.homeroomClass ?? '',
        `${row.absentCount}/${row.markedSessions}`,
        row.absentPct,
        row.attendanceScore10 ?? '',
        ...assignScores,
        row.assignmentAverage10 ?? '',
        row.finalScore10 ?? '',
        row.isProvisional ? `${row.classification} (Tạm tính)` : row.classification,
        row.isAttendanceWarning
          ? `Vắng quá ngưỡng (>${settings.absence_warning_pct}%)`
          : 'Đủ điều kiện',
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const wsMain = XLSX.utils.aoa_to_sheet(sheetRows);
  wsMain['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    ...assignments.map(() => ({ wch: 18 })),
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMain, 'SoDiemTongHop');

  const countByClass = (label: string) =>
    rows.filter((r) => r.classification === label).length;
  const warningCount = rows.filter((r) => r.isAttendanceWarning).length;
  const gradedFinal = rows.filter((r) => r.finalScore10 !== null);
  const classAvg =
    gradedFinal.length > 0
      ? Math.round(
          (gradedFinal.reduce((sum, r) => sum + (r.finalScore10 ?? 0), 0) /
            gradedFinal.length) *
            10
        ) / 10
      : '';

  const statsRows: (string | number)[][] = [
    ['THỐNG KÊ & QUY TẮC TÍNH ĐIỂM'],
    [],
    ['Thông số cấu hình', 'Giá trị'],
    ['Trọng số Chuyên cần (%)', settings.attendance_weight],
    ['Trọng số Bài tập (%)', settings.assignment_weight],
    ['Hệ số Đi muộn (so với 1 buổi đủ)', settings.late_weight],
    ['Hệ số Nghỉ có phép (so với 1 buổi đủ)', settings.excused_weight],
    ['Ngưỡng cảnh báo vắng (%)', settings.absence_warning_pct],
    [],
    ['Thống kê kết quả lớp', 'Số lượng'],
    ['Tổng số sinh viên', rows.length],
    ['Điểm tổng kết trung bình lớp', classAvg],
    ['Xuất sắc (>= 9.0)', countByClass('Xuất sắc')],
    ['Giỏi (8.0 - 8.9)', countByClass('Giỏi')],
    ['Khá (7.0 - 7.9)', countByClass('Khá')],
    ['Trung bình (5.0 - 6.9)', countByClass('Trung bình')],
    ['Không đạt (< 5.0)', countByClass('Không đạt')],
    ['Chưa đủ điểm', countByClass('Chưa đủ điểm')],
    [`Cảnh báo vắng (> ${settings.absence_warning_pct}%)`, warningCount],
  ];
  const wsStats = XLSX.utils.aoa_to_sheet(statsRows);
  wsStats['!cols'] = [{ wch: 36 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsStats, 'ThongKeVaCongThuc');

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `so-diem-${safeFilePart(className)}-${stamp}.xlsx`);
}


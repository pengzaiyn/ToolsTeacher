import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildStyledAttendanceExcelBuffer } from '@/lib/attendanceExcel';

describe('buildStyledAttendanceExcelBuffer', () => {
  it('generates a valid .xlsx workbook with Eligible & Exam-Banned sections and red OpenXML styles on banned rows', () => {
    const bytes = buildStyledAttendanceExcelBuffer({
      className: 'UDPM24-01',
      subject: 'Lập trình Web',
      teacherName: 'Nguyễn Văn A',
      warningThresholdPct: 20,
      sessions: [
        {
          id: 's1',
          class_id: 'c1',
          session_date: '2026-11-25',
          title: 'Buổi 1',
          subject: 'Lập trình Web',
          period_start: 1,
          period_end: 3,
          room: '301',
          note: null,
          created_by: 't1',
          created_at: '2026-11-25T01:00:00Z',
          updated_at: '2026-11-25T01:00:00Z',
        },
      ],
      records: [],
      summaries: [
        {
          studentId: 'stu-1',
          fullName: 'Nguyễn Hữu Bằng',
          studentCode: '61112420027',
          homeroomClass: 'UDPM24-01',
          totalSessions: 5,
          markedSessions: 5,
          presentCount: 5,
          lateCount: 0,
          excusedCount: 0,
          absentCount: 0,
          absentPct: 0,
          attendanceScore10: 10,
          isWarning: false,
        },
        {
          studentId: 'stu-2',
          fullName: 'Trần Văn Vắng',
          studentCode: '61112420999',
          homeroomClass: 'UDPM24-01',
          totalSessions: 5,
          markedSessions: 5,
          presentCount: 3,
          lateCount: 0,
          excusedCount: 0,
          absentCount: 2,
          absentPct: 40,
          attendanceScore10: 6,
          isWarning: true,
        },
      ],
    });

    // 1. Đảm bảo SheetJS đọc lại file .xlsx hợp lệ 100% với đủ 4 sheet
    const wb = XLSX.read(bytes, { type: 'array' });
    expect(wb.SheetNames).toEqual([
      'XetDieuKienThi',
      'Đủ điều kiện thi',
      'Cấm thi',
      'ChiTietBuoiHoc',
    ]);

    // 2. Đảm bảo XML bên trong đã tiêm bảng màu đỏ #FCE8EC / #C8102E và gán s="2" cho dòng Cấm thi
    const rawUtf8 = new TextDecoder('utf-8').decode(bytes);
    expect(rawUtf8).toContain('FFFCE8EC');
    expect(rawUtf8).toContain('FFC8102E');
    expect(rawUtf8).toMatch(/s="2"[^>]*><v>Cấm thi<\/v>/);
  });
});

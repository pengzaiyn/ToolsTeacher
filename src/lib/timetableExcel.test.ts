import { describe, expect, it } from 'vitest';
import {
  createSampleTimetableWorkbook,
  parseTimetableCsvText,
  parseTimetableWorkbook,
  parseWeekdays,
} from '@/lib/timetableExcel';
import {
  getActiveInternshipsForWeek,
  getEntrySession,
  getExamsInWeek,
  getMondayOfWeek,
  getWeekDays,
  pickDefaultSemesterKey,
  summarizeSemesters,
} from '@/lib/week';
import type { TimetableEntry } from '@/types/database';
import * as XLSX from 'xlsx';

const REAL_SCHOOL_CSV = `HK1,,,,,,,,,,,,,,
TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI,,,,,THỜI KHÓA BIỂU - KHÓA 2024 - 2027,,,,,,,,,
PHÒNG ĐÀO TẠO,,,,,"Địa điểm học: Số 1 Trịnh Văn Bô, Quận Nam Từ Liêm, TP Hà Nội",,,,,,,,,
,,,,,,,,,,,,,,
,Hệ đào tạo: Cao đẳng chính quy,,,,,,Học kỳ: I,Thời gian:,28/04/2025 - 02/08/2025,,,,,
,Ngành đào tạo: Tiếng Nhật,,,,,,Năm học: 2024 - 2025,Lớp:,TN24-02M,Sĩ số: 31,,,,
TT,Môn học,Thứ,Thời gian học,,,Phòng học,Giảng viên,Dự kiến ngày thi,Tổng số tiết của môn,Ghi chú,,,,
,,,Giờ học,Tuần bắt đầu,Tuần kết thúc,,,,,,số tiết/buổi,số tuần,số buổi,số tín
1,Tiếng Anh 1,"Thứ Ba
Thứ Năm",13:00-17:00,2025-06-24,2025-07-31,510,Nguyễn Thục Lâm,2025-08-07,60,,5,6,12,2
2,Kỹ năng học tập ,"Thứ Hai
Thứ Tư",13:00-17:00,2025-06-23,2025-07-21,510,Vũ Thị Thu Hiền,2025-07-28,45,,5,4.5,9,2
,,,,,,,,,,,,,,
,,,,,,,"Tp. Hà Nội, ngày…....tháng …... năm 202…..",,,,,,,
NGƯỜI LẬP,,,,,,,PHÒNG ĐÀO TẠO,,,,,,,
Ngô Thị Nhã Uyên,,,,,,,Nguyễn Lệ Thuỷ,,,,,,,
HK2,,,,,,,,,,,,,,
TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI,,,,,THỜI KHÓA BIỂU - KHÓA 2024 - 2027,,,,,,,,,
,Hệ đào tạo: Cao đẳng chính quy,,,,,,Học kỳ: II,Thời gian:,04/08/2025 - 18/10/2025,,,,,
,Ngành đào tạo: Tiếng Nhật,,,,,,Năm học: 2025 - 2026,Lớp:,TN24-02M,Sĩ số: 27,,,,
TT,Môn học,Thứ,Thời gian học,,,Phòng học,Giảng viên,Dự kiến ngày thi,Tổng số tiết của môn,Ghi chú,,,,
,,,Giờ học,Tuần bắt đầu,Tuần kết thúc,,,,,,số tiết/buổi,số tuần,số buổi,số tín
1,Tiếng Anh 2,Thứ Sáu,7:30-12:15,2025-08-08,2025-10-10,510,Trương Mỹ Hạnh,2025-10-17,60,,6,10,10,2
HK3,,,,,,,,,,,,,,
,Hệ đào tạo: Cao đẳng chính quy,,,,,,Học kỳ: III,Thời gian:,20/10/2025 - 24/04/2026,,,,,
,Ngành đào tạo: Tiếng Nhật,,,,,,Năm học: 2025 - 2026,Lớp:,TN24-02M,Sĩ số: 27,,,,
TT,Môn học,Thứ,Thời gian học,,,Phòng học,Giảng viên,Dự kiến ngày thi,Tổng số tiết của môn,Ghi chú,,,,
,,,Giờ học,Tuần bắt đầu,Tuần kết thúc,,,,,,số tiết/buổi,số tuần,số buổi,
1,Pháp luật,Thứ Tư,7:30-12:15,2025-12-17,2026-01-14,510,Lê Thị Thanh Dung,2026-01-21,30,,6,5,5,2
2,Thực tập nhận thức,,,2026-01-22,2026-04-22,Doanh nghiệp,Trần Minh Đức,,90,,-,12,-,2
HK5+6+7,,,,,,,,,,,,,,
,Hệ đào tạo: Cao đẳng chính quy,,,,,,Học kỳ: V+VI+VII,Thời gian:,03/08/2026 - 05/06/2027,,,,,
,Ngành đào tạo: Tiếng Nhật,,,,,,Năm học: 2026 - 2027,Lớp:,TN24-02M,Sĩ số: 15,,,,
TT,Môn học,Thứ,Thời gian học,,,Phòng học,Giảng viên,Dự kiến ngày thi,Tổng số tiết của môn,Ghi chú,,,,
,,,Giờ học,Tuần bắt đầu,Tuần kết thúc,,,,,,số tiết/buổi,số tuần,số buổi,
1,Tiếng Nhật nâng cao 2,"Thứ Hai
Thứ Sáu",7:30-12:15,2026-08-03,2026-09-14,510,Nguyễn Quang Vinh,2026-09-21,75,,6,6.25,13,3
2,Thực tập tốt nghiệp,,,2026-10-26,03/06/2027,,Trần Minh Đức,,270,,-,32,-,6`;

describe('timetableExcel school 7-semester format', () => {
  it('parses Vietnamese multi-line weekdays accurately', () => {
    expect(parseWeekdays('Thứ Ba\nThứ Năm')).toEqual([3, 5]);
    expect(parseWeekdays('Thứ Hai\nThứ Sáu')).toEqual([2, 6]);
    expect(parseWeekdays('Thứ Sáu')).toEqual([6]);
    expect(parseWeekdays('Chủ Nhật')).toEqual([8]);
    expect(parseWeekdays('')).toEqual([]);
  });

  it('parses real Phòng Đào tạo CSV with HK1..HK5+6+7, multi-day subjects, exam dates, and internships', () => {
    const result = parseTimetableCsvText(REAL_SCHOOL_CSV);
    expect(result.errors).toEqual([]);
    expect(result.format).toBe('school');
    expect(result.classes).toHaveLength(1);
    expect(result.classes[0].className).toBe('TN24-02M');
    expect(result.semesters.map((s) => s.semester)).toEqual(['HK1', 'HK2', 'HK3', 'HK5+6+7']);

    // Tiếng Anh 1 tách thành 2 buổi (Thứ 3 và Thứ 5), buổi chiều (13:00-17:00)
    const eng1 = result.entries.filter((e) => e.subject === 'Tiếng Anh 1');
    expect(eng1).toHaveLength(2);
    expect(eng1.map((e) => e.weekday)).toEqual([3, 5]);
    expect(eng1[0].time_range).toBe('13:00-17:00');
    expect(eng1[0].exam_date).toBe('2025-08-07');
    expect(eng1[0].credits).toBe(2);
    expect(getEntrySession(eng1[0])).toBe('afternoon');

    // Thực tập tốt nghiệp nhận diện is_internship = true và chuyển đúng 03/06/2027 -> 2027-06-03
    const gradIntern = result.entries.find((e) => e.subject === 'Thực tập tốt nghiệp');
    expect(gradIntern?.is_internship).toBe(true);
    expect(gradIntern?.date_from).toBe('2026-10-26');
    expect(gradIntern?.date_to).toBe('2027-06-03');
    expect(gradIntern?.semester).toBe('HK5+6+7');
    expect(gradIntern?.credits).toBe(6);

    // Chuyển sang TimetableEntry để kiểm tra tự động chọn kỳ đang học + lịch thi + thực tập trong tuần
    const dbEntries: TimetableEntry[] = result.entries.map((e, idx) => ({
      ...e,
      id: `tt-${idx}`,
      upload_id: 'up-1',
    }));

    const semsInNov2025 = summarizeSemesters(dbEntries, '2025-12-20');
    expect(pickDefaultSemesterKey(semsInNov2025, '2025-12-20')).toBe('HK3');

    const semsInNov2026 = summarizeSemesters(dbEntries, '2026-11-20');
    expect(pickDefaultSemesterKey(semsInNov2026, '2026-11-20')).toBe('HK5+6+7');

    // Tuần 04/08/2025 - 10/08/2025 có ngày thi Tiếng Anh 1 (2025-08-07)
    const examWeekDays = getWeekDays(getMondayOfWeek(new Date('2025-08-07T00:00:00')));
    const exams = getExamsInWeek(dbEntries, examWeekDays);
    expect(exams).toHaveLength(1);
    expect(exams[0].subject).toBe('Tiếng Anh 1');
    expect(exams[0].examDate).toBe('2025-08-07');

    // Tuần 16/11/2026 - 22/11/2026 đang diễn ra Thực tập tốt nghiệp
    const internWeekDays = getWeekDays(getMondayOfWeek(new Date('2026-11-20T00:00:00')));
    const activeInterns = getActiveInternshipsForWeek(dbEntries, internWeekDays);
    expect(activeInterns).toHaveLength(1);
    expect(activeInterns[0].subject).toBe('Thực tập tốt nghiệp');
  });

  it('round-trips the generated 7-semester sample Excel workbook cleanly', () => {
    const wb = createSampleTimetableWorkbook();
    const arr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = parseTimetableWorkbook(arr);
    expect(parsed.errors).toEqual([]);
    expect(parsed.format).toBe('school');
    expect(parsed.classes[0].className).toBe('TN24-02M');
    expect(parsed.semesters.map((s) => s.semester)).toEqual(['HK1', 'HK5+6+7']);
  });
});


import { describe, expect, it } from 'vitest';
import { getEntryTimeStatus, parseTimeRangeMinutes } from './week';

describe('parseTimeRangeMinutes', () => {
  it('phân tích đúng các định dạng giờ học phổ biến', () => {
    expect(parseTimeRangeMinutes('7:30-12:15')).toEqual({ startMin: 450, endMin: 735 });
    expect(parseTimeRangeMinutes('08:00 – 12:00')).toEqual({ startMin: 480, endMin: 720 });
    expect(parseTimeRangeMinutes('7h30 - 11h30')).toEqual({ startMin: 450, endMin: 690 });
    expect(parseTimeRangeMinutes('')).toBeNull();
    expect(parseTimeRangeMinutes(null)).toBeNull();
  });
});

describe('getEntryTimeStatus', () => {
  const entry = { period_start: 1, time_range: '7:30-12:15' };

  it('đánh dấu đang học khi thời gian thực nằm trong khung giờ môn học', () => {
    const now = new Date(2026, 8, 28, 7, 45); // 28/09/2026 07:45
    expect(getEntryTimeStatus(entry, '2026-09-28', now)).toBe('ongoing');
  });

  it('đánh dấu chưa học khi cùng ngày nhưng chưa tới giờ hoặc là ngày tương lai', () => {
    const beforeClass = new Date(2026, 8, 28, 7, 15);
    expect(getEntryTimeStatus(entry, '2026-09-28', beforeClass)).toBe('upcoming');
    expect(getEntryTimeStatus(entry, '2026-09-29', beforeClass)).toBe('upcoming');
  });

  it('đánh dấu đã học khi đã qua giờ kết thúc hoặc là ngày quá khứ', () => {
    const afterClass = new Date(2026, 8, 28, 12, 30);
    expect(getEntryTimeStatus(entry, '2026-09-28', afterClass)).toBe('completed');
    expect(getEntryTimeStatus(entry, '2026-09-27', afterClass)).toBe('completed');
  });
});


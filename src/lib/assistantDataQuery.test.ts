import { describe, expect, it } from 'vitest';
import {
  extractMentionedClassCode,
  extractStudentCode,
  matchClassInQuestion,
  normalizeCompactCode,
} from '@/lib/assistantDataQuery';

describe('assistantDataQuery helpers', () => {
  it('normalizeCompactCode chuẩn hóa tên lớp có dấu gạch dưới, gạch nối hoặc khoảng trắng', () => {
    expect(normalizeCompactCode('UDPM24_01')).toBe('udpm2401');
    expect(normalizeCompactCode('UDPM24-01')).toBe('udpm2401');
    expect(normalizeCompactCode('  udpm24 01 ')).toBe('udpm2401');
  });

  it('extractMentionedClassCode trích đúng mã lớp từ câu hỏi tự nhiên', () => {
    expect(extractMentionedClassCode('tôi muốn xem lớp UDPM24_01 đang có bao nhiêu học sinh')).toBe(
      'UDPM24_01'
    );
    expect(extractMentionedClassCode('sĩ số UDPM24-01 là bao nhiêu')).toBe('UDPM24-01');
    expect(extractMentionedClassCode('trường có bao nhiêu lớp học')).toBeNull();
  });

  it('matchClassInQuestion khớp đúng lớp UDPM24-01 khi người dùng gõ UDPM24_01', () => {
    const classes = [
      { id: '1', name: 'UDPM24-01', class_key: 'udpm24-01' },
      { id: '2', name: 'UDPM24-02', class_key: 'udpm24-02' },
      { id: '3', name: 'CNTT24-01', class_key: 'cntt24-01' },
    ];
    const matched = matchClassInQuestion(
      'tôi muốn xem lớp UDPM24_01 đang có bao nhiêu học sinh',
      classes
    );
    expect(matched?.id).toBe('1');
  });

  it('extractStudentCode nhận diện mã sinh viên đầu 6111', () => {
    expect(extractStudentCode('tìm sinh viên mã 61112420027')).toBe('61112420027');
    expect(extractStudentCode('lớp UDPM24-01 có mấy bạn')).toBeNull();
  });
});

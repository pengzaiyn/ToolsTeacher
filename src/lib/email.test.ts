import { describe, expect, it } from 'vitest';
import { classKey } from '@/lib/classKey';
import {
  isValidSchoolEmail,
  normalizeStudentCode,
  normalizeTeacherEmail,
  slug,
  studentEmail,
} from '@/lib/email';

describe('email & student code rules', () => {
  it('normalizes Vietnamese text to ASCII slug', () => {
    expect(slug('Đặng Minh Quân')).toBe('dangminhquan');
    expect(slug('Nguyễn Thị Ánh')).toBe('nguyenthianh');
  });

  it('normalizes 7-digit or 11-digit 6111 student codes', () => {
    expect(normalizeStudentCode('2600001')).toBe('61112600001');
    expect(normalizeStudentCode('61112600001')).toBe('61112600001');
    expect(normalizeStudentCode('61122600001')).toBeNull();
    expect(normalizeStudentCode('12345')).toBeNull();
  });

  it('generates student school email from given name and last 8 digits', () => {
    expect(studentEmail('Nguyễn Văn An', '61112600001')).toBe(
      'an12600001@caodangvietmyhanoi.edu.vn'
    );
    expect(studentEmail('Lê Thị Điệp', '61112600099')).toBe(
      'diep12600099@caodangvietmyhanoi.edu.vn'
    );
  });

  it('normalizes teacher email and validates school domain', () => {
    expect(normalizeTeacherEmail('huongnt')).toBe('huongnt@caodangvietmyhanoi.edu.vn');
    expect(normalizeTeacherEmail('HUONGNT@caodangvietmyhanoi.edu.vn')).toBe(
      'huongnt@caodangvietmyhanoi.edu.vn'
    );
    expect(isValidSchoolEmail('gv@caodangvietmyhanoi.edu.vn')).toBe(true);
    expect(isValidSchoolEmail('gv@gmail.com')).toBe(false);
  });
});

describe('classKey normalization', () => {
  it('collapses whitespace and normalizes NFC lowercase', () => {
    expect(classKey('  CNTT -  K18A  ')).toBe('cntt - k18a');
    expect(classKey('Lập\u0020\u0020Trình')).toBe(classKey('lập trình'));
  });
});


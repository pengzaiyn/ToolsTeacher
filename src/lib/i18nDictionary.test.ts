import { describe, expect, it } from 'vitest';
import { translateViText } from '@/lib/i18nDictionary';

describe('translateViText', () => {
  it('giữ nguyên tên chính thức của trường trong mọi ngôn ngữ', () => {
    expect(translateViText('Trường Cao đẳng Việt Mỹ Hà Nội', 'en')).toBe(
      'Trường Cao đẳng Việt Mỹ Hà Nội'
    );
    expect(translateViText('Trường Cao đẳng Việt Mỹ Hà Nội', 'zh')).toBe(
      'Trường Cao đẳng Việt Mỹ Hà Nội'
    );
  });

  it('dịch chính xác các cụm từ giao diện sang Tiếng Anh và Tiếng Trung', () => {
    expect(translateViText('Công cụ giảng dạy', 'en')).toBe('Teaching Tools');
    expect(translateViText('Công cụ giảng dạy', 'zh')).toBe('教学工具');
    expect(translateViText('Tạo phòng thi đấu', 'en')).toBe('Create Match Room');
    expect(translateViText('Tạo phòng thi đấu', 'zh')).toBe('创建比赛房间');
  });

  it('dịch đúng các mẫu động có số lượng và thời gian', () => {
    expect(translateViText('Phòng đang mở (3)', 'en')).toBe('Open Rooms (3)');
    expect(translateViText('Phòng đang mở (3)', 'zh')).toBe('开放中的房间 (3)');
    expect(translateViText('Tuần 12', 'en')).toBe('Week 12');
    expect(translateViText('Tuần 12', 'zh')).toBe('第 12 周');
    expect(translateViText('Tạo lúc: 22/11/2026 23:04', 'en')).toBe('Created: 22/11/2026 23:04');
  });

  it('giữ nguyên khoảng trắng đầu/cuối và không làm hỏng văn bản tiếng Việt khi ở chế độ vi', () => {
    expect(translateViText('  Lớp học  ', 'en')).toBe('  Classes  ');
    expect(translateViText('Lớp học', 'vi')).toBe('Lớp học');
  });
});


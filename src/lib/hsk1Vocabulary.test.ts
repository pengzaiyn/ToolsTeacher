import { describe, expect, it } from 'vitest';
import {
  checkHskAnswer,
  generateRoomCode,
  HSK1_WORDS,
  normalizePinyin,
  pickShuffledHskWords,
} from '@/lib/hsk1Vocabulary';

describe('HSK 1 ver 3.0 Vocabulary & Answer Checker', () => {
  it('chứa trọn bộ 298 từ HSK 1 ver 3.0 đã lọc trùng và gắn cờ từ mới v3.0', () => {
    expect(HSK1_WORDS).toHaveLength(298);
    expect(HSK1_WORDS.some((w) => w.hanzi === '包子' && w.isNewV3)).toBe(true);
    expect(HSK1_WORDS.some((w) => w.hanzi === '大学生' && w.isNewV3)).toBe(true);
    expect(HSK1_WORDS.some((w) => w.hanzi === '做饭' && w.isNewV3)).toBe(true);
  });

  it('normalizePinyin chuẩn hóa dấu thanh điệu và khoảng trắng', () => {
    expect(normalizePinyin('nǐ hǎo')).toBe('nihao');
    expect(normalizePinyin('NI HAO')).toBe('nihao');
    expect(normalizePinyin('nǚ ér')).toBe('nuer');
    expect(normalizePinyin('nv er')).toBe('nuer');
  });

  it('checkHskAnswer chấm đúng Pinyin, Chữ Hán, từ có dấu ngoặc tùy chọn và nhiều cách đọc', () => {
    const word = { hanzi: '你好', pinyin: 'nǐ hǎo' };
    expect(checkHskAnswer(word, 'ni hao', 'pinyin')).toBe(true);
    expect(checkHskAnswer(word, 'nihao', 'pinyin')).toBe(true);
    expect(checkHskAnswer(word, 'nǐ hǎo', 'pinyin')).toBe(true);
    expect(checkHskAnswer(word, 'xie xie', 'pinyin')).toBe(false);
    expect(checkHskAnswer(word, '你好', 'hanzi')).toBe(true);

    // Từ có nhiều cách đọc (shéi / shúi)
    const who = { hanzi: '谁', pinyin: 'shéi / shúi' };
    expect(checkHskAnswer(who, 'shei', 'pinyin')).toBe(true);
    expect(checkHskAnswer(who, 'shui', 'pinyin')).toBe(true);

    // Từ có ký tự tùy chọn trong ngoặc: 没（有） và 有（一）点儿
    const mei = { hanzi: '没（有）', pinyin: 'méi(yǒu)' };
    expect(checkHskAnswer(mei, '没', 'hanzi')).toBe(true);
    expect(checkHskAnswer(mei, '没有', 'hanzi')).toBe(true);
    expect(checkHskAnswer(mei, 'mei', 'pinyin')).toBe(true);
    expect(checkHskAnswer(mei, 'meiyou', 'pinyin')).toBe(true);

    const youdianr = { hanzi: '有（一）点儿', pinyin: 'yǒu(yì)diǎnr' };
    expect(checkHskAnswer(youdianr, '有点儿', 'hanzi')).toBe(true);
    expect(checkHskAnswer(youdianr, '有一点儿', 'hanzi')).toBe(true);
    expect(checkHskAnswer(youdianr, 'youdianr', 'pinyin')).toBe(true);
    expect(checkHskAnswer(youdianr, 'youyidianr', 'pinyin')).toBe(true);
  });

  it('pickShuffledHskWords lọc đúng theo từ loại và nhóm từ mới HSK 3.0', () => {
    const v3Only = pickShuffledHskWords('v3_new', 15);
    expect(v3Only).toHaveLength(15);
    expect(v3Only.every((w) => w.isNewV3)).toBe(true);

    const verbs = pickShuffledHskWords('verb', 10);
    expect(verbs).toHaveLength(10);
    expect(verbs.every((w) => w.topic === 'verb')).toBe(true);
  });

  it('generateRoomCode tạo mã phòng 5 ký tự viết hoa rõ ràng', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  applyQuickAnswerKeyToQuestions,
  applyRemixPreservingLayout,
  applyVariantEditToAll,
  buildDefaultPaperBlocks,
  buildEssaySectionBlockFromText,
  buildSequentialExamCodes,
  DEFAULT_EXAM_METADATA,
  DEFAULT_EXAM_PAPER_THEME,
  generateMixedExams,
  hasExplicitLetterReference,
  insertMixedQuestionsAcrossVariants,
  isPinnedEndOption,
  parseExamCodes,
  parseQuestionsFromText,
  parseQuickAnswerKey,
  recalculateVariantFromBlocks,
  reorderItems,
  SAMPLE_EXAM_TEXT,
  syncBankQuestionsToVariants,
  syncMetadataToVariants,
  syncQuestionContentAcrossVariants,
  validateQuestionBank,
  type ExamPaperBlock,
  type ExamQuestion,
  type MixedExamVariant,
} from '@/lib/examMixer';
import { buildExamPrintHtml } from '@/lib/examMixerExport';

describe('examMixer parser & validator', () => {
  it('parses multi-format Vietnamese questions including inline options and answer lines', () => {
    const parsed = parseQuestionsFromText(SAMPLE_EXAM_TEXT);
    expect(parsed.questions).toHaveLength(6);

    const validation = validateQuestionBank(parsed.questions);
    expect(validation.validCount).toBe(6);
    expect(validation.invalidCount).toBe(0);

    // Câu 1 dùng *A.
    expect(parsed.questions[0].options[0].isCorrect).toBe(true);
    expect(parsed.questions[0].group).toBe('Chương 1');

    // Câu 3 dùng dòng "Đáp án: D"
    expect(parsed.questions[2].options[3].isCorrect).toBe(true);

    // Câu 5 tách phương án viết chung 1 dòng
    expect(parsed.questions[4].options).toHaveLength(4);
    expect(parsed.questions[4].options[1].text).toBe('Router');
    expect(parsed.questions[4].options[1].isCorrect).toBe(true);
  });

  it('flags incomplete questions accurately', () => {
    const raw = `Câu 1: Câu hỏi chưa đánh dấu đáp án đúng
A. Phương án 1
B. Phương án 2

Câu 2: Câu hỏi chỉ có 1 đáp án
*A. Duy nhất`;

    const parsed = parseQuestionsFromText(raw);
    const check = validateQuestionBank(parsed.questions);
    expect(check.validCount).toBe(0);
    expect(check.invalidCount).toBe(2);
    expect(check.byId.get(parsed.questions[0].id)?.errors).toContain('Chưa chọn đáp án đúng');
    expect(check.byId.get(parsed.questions[1].id)?.errors).toContain(
      'Cần ít nhất 2 phương án trả lời'
    );
  });

  it('detects pinned-end options and letter-reference options', () => {
    expect(isPinnedEndOption('Tất cả các đáp án trên đều đúng')).toBe(true);
    expect(isPinnedEndOption('Không có phương án nào đúng')).toBe(true);
    expect(isPinnedEndOption('Đáp án khác')).toBe(true);
    expect(isPinnedEndOption('HTML')).toBe(false);

    expect(hasExplicitLetterReference('Cả A và B đều đúng')).toBe(true);
    expect(hasExplicitLetterReference('Đáp án A và C đúng')).toBe(true);
    expect(hasExplicitLetterReference('Tất cả các đáp án trên đều đúng')).toBe(false);
  });

  it('parses and deduplicates exam codes cleanly', () => {
    expect(parseExamCodes('101, 102, 101 103;104')).toEqual(['101', '102', '103', '104']);
    expect(parseExamCodes('', 3)).toEqual(['101', '102', '103']);
    expect(buildSequentialExamCodes(4, 201)).toEqual(['201', '202', '203', '204']);
  });
});

describe('examMixer shuffling & answer key integrity', () => {
  it('preserves correct answers after shuffling and pins compound options at end', () => {
    const bank: ExamQuestion[] = [
      {
        id: 'q-compound',
        prompt: 'Chọn đáp án tổng hợp',
        options: [
          { id: 'o1', text: 'Ý một', isCorrect: false },
          { id: 'o2', text: 'Ý hai', isCorrect: false },
          { id: 'o3', text: 'Ý ba', isCorrect: false },
          { id: 'o4', text: 'Tất cả các đáp án trên đều đúng', isCorrect: true },
        ],
      },
      {
        id: 'q-ref',
        prompt: 'Chọn câu tham chiếu chữ cái',
        options: [
          { id: 'r1', text: 'Lựa chọn một', isCorrect: false },
          { id: 'r2', text: 'Lựa chọn hai', isCorrect: false },
          { id: 'r3', text: 'Cả A và B đều đúng', isCorrect: true },
          { id: 'r4', text: 'Lựa chọn bốn', isCorrect: false },
        ],
      },
      {
        id: 'q-normal',
        prompt: 'Thủ đô của Việt Nam là gì?',
        options: [
          { id: 'n1', text: 'Hà Nội', isCorrect: true },
          { id: 'n2', text: 'Đà Nẵng', isCorrect: false },
          { id: 'n3', text: 'Huế', isCorrect: false },
          { id: 'n4', text: 'Cần Thơ', isCorrect: false },
        ],
      },
    ];

    const variants = generateMixedExams(bank, {
      examCodes: ['101', '102', '103', '104'],
      shuffleQuestions: true,
      shuffleOptions: true,
      keepCompoundOptionAtEnd: true,
      questionCount: 3,
      seed: 20261120,
    });

    expect(variants).toHaveLength(4);

    for (const variant of variants) {
      expect(variant.questions).toHaveLength(3);
      for (const q of variant.questions) {
        const correctOpt = q.options.find((o) => o.isCorrect);
        expect(correctOpt).toBeDefined();
        expect(variant.answerKey[q.number]).toBe(correctOpt?.letter);

        if (q.sourceQuestionId === 'q-compound') {
          expect(q.options[3].text).toBe('Tất cả các đáp án trên đều đúng');
          expect(q.correctLetter).toBe('D');
        }
        if (q.sourceQuestionId === 'q-ref') {
          // Giữ nguyên thứ tự A, B, C, D vì có "Cả A và B đều đúng"
          expect(q.options[0].text).toBe('Lựa chọn một');
          expect(q.options[1].text).toBe('Lựa chọn hai');
          expect(q.options[2].text).toBe('Cả A và B đều đúng');
          expect(q.correctLetter).toBe('C');
        }
        if (q.sourceQuestionId === 'q-normal') {
          expect(correctOpt?.text).toBe('Hà Nội');
        }
      }
    }

    const html = buildExamPrintHtml(
      {
        schoolName: 'TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI',
        department: 'KHOA CNTT',
        examTitle: 'ĐỀ THI KẾT THÚC HỌC PHẦN',
        subject: 'Tin học cơ sở',
        durationMinutes: 45,
        semester: 'HK1 2026',
        notes: 'Không sử dụng tài liệu',
      },
      variants,
      { includeAnswerKeyPage: true }
    );
    expect(html).toContain('MÃ ĐỀ: 101');
    expect(html).toContain('MÃ ĐỀ: 104');
    expect(html).toContain('BẢNG ĐÁP ÁN TỔNG HỢP');
  });

  it('respects questionCount subset and unshuffled mode', () => {
    const parsed = parseQuestionsFromText(SAMPLE_EXAM_TEXT);
    const variants = generateMixedExams(parsed.questions, {
      examCodes: ['201', '202'],
      shuffleQuestions: false,
      shuffleOptions: false,
      keepCompoundOptionAtEnd: true,
      questionCount: 4,
      seed: 123,
    });

    expect(variants).toHaveLength(2);
    expect(variants[0].questions).toHaveLength(4);
    expect(variants[0].questions.map((q) => q.sourceQuestionId)).toEqual(
      parsed.questions.slice(0, 4).map((q) => q.id)
    );
    expect(variants[0].answerKey).toEqual({ 1: 'A', 2: 'C', 3: 'D', 4: 'D' });
  });

  it('recalculates question numbers and answerKey after dragging blocks & options and syncs across variants', () => {
    const parsed = parseQuestionsFromText(SAMPLE_EXAM_TEXT);
    const rawVariants = generateMixedExams(parsed.questions, {
      examCodes: ['101', '102'],
      shuffleQuestions: false,
      shuffleOptions: false,
      keepCompoundOptionAtEnd: true,
      questionCount: 3,
      seed: 42,
    });

    const variants = rawVariants.map((v) => ({
      ...v,
      blocks: buildDefaultPaperBlocks(v.questions, DEFAULT_EXAM_METADATA),
    }));

    // Trong blocks ban đầu: [0]=header, [1]=student_info, [2]=Câu 1 (đáp án A), [3]=Câu 2 (đáp án C), [4]=Câu 3 (đáp án D), [5]=footer
    // Kéo Câu 2 lên vị trí Câu 1 (index 3 -> index 2) và chèn thêm khối tiêu đề phần
    const moved = reorderItems(variants[0].blocks, 3, 2);
    const customSection: ExamPaperBlock = {
      id: 'sec-1',
      type: 'section_text',
      contentHtml: '<b style="color:#C8102E">PHẦN I: TRẮC NGHIỆM</b>',
      style: { textAlign: 'center' },
    };
    moved.splice(2, 0, customSection);

    // Đảo phương án C (đáp án đúng của câu đầu mới) lên vị trí A (index 2 -> index 0)
    const firstQBlock = moved[3];
    if (firstQBlock.type === 'question') {
      firstQBlock.question.options = reorderItems(firstQBlock.question.options, 2, 0);
      firstQBlock.question.promptHtml = '<b>Giao thức</b> mã hóa bảo mật?';
    }

    const recalculated = recalculateVariantFromBlocks(variants[0], moved);
    expect(recalculated.questions[0].number).toBe(1);
    expect(recalculated.questions[0].correctLetter).toBe('A');
    expect(recalculated.answerKey[1]).toBe('A');
    expect(recalculated.answerKey[2]).toBe('A');
    expect(recalculated.answerKey[3]).toBe('D');

    // Đồng bộ câu vừa sửa sang cả Mã 102
    const synced = syncQuestionContentAcrossVariants(
      [recalculated, variants[1]],
      DEFAULT_EXAM_METADATA,
      recalculated.questions[0]
    );
    expect(synced[1].questions[1].prompt).toBe('Giao thức mã hóa bảo mật?');
    expect(synced[1].questions[1].promptHtml).toContain('<b>Giao thức</b>');

    // Kiểm tra HTML xuất Word chứa khối tiêu đề phần và theme tùy chỉnh
    const html = buildExamPrintHtml(DEFAULT_EXAM_METADATA, [recalculated], {
      theme: { ...DEFAULT_EXAM_PAPER_THEME, fontFamily: 'Arial', accentColor: '#C8102E' },
    });
    expect(html).toContain('PHẦN I: TRẮC NGHIỆM');
    expect(html).toContain('"Arial"');
    expect(html).toContain('#C8102E');
  });

  it('automatically syncs header edits, added/moved/deleted blocks, and question edits across all exam codes', () => {
    const parsed = parseQuestionsFromText(SAMPLE_EXAM_TEXT);
    const rawVariants = generateMixedExams(parsed.questions, {
      examCodes: ['101', '102', '103'],
      shuffleQuestions: true,
      shuffleOptions: true,
      keepCompoundOptionAtEnd: true,
      questionCount: 4,
      seed: 99,
    });

    let allVariants: MixedExamVariant[] = rawVariants.map((v) => ({
      ...v,
      blocks: buildDefaultPaperBlocks(v.questions, DEFAULT_EXAM_METADATA),
    }));

    // 1. Sửa tiêu đề trường + bật chữ ký + chèn 1 khối tiêu đề phần trên Mã 101
    const v101Blocks = [...(allVariants[0].blocks ?? [])];
    if (v101Blocks[0].type === 'header') {
      v101Blocks[0] = {
        ...v101Blocks[0],
        examTitleHtml: '<b style="color:#C8102E">ĐỀ THI GIỮA KỲ</b>',
      };
    }
    const addedSec: ExamPaperBlock = {
      id: 'blk-sec-sync',
      type: 'section_text',
      contentHtml: '<b>PHẦN I: CÂU HỎI CƠ BẢN</b>',
      style: { textAlign: 'center' },
    };
    v101Blocks.splice(2, 0, addedSec);
    const lastIdx = v101Blocks.length - 1;
    if (v101Blocks[lastIdx].type === 'footer') {
      v101Blocks[lastIdx] = { ...v101Blocks[lastIdx], showSignatures: true };
    }

    allVariants = applyVariantEditToAll(
      allVariants,
      recalculateVariantFromBlocks(allVariants[0], v101Blocks),
      DEFAULT_EXAM_METADATA
    );

    // Kiểm tra Mã 102 và 103 đều nhận được tiêu đề mới, khối phần thi mới và chữ ký
    for (const v of allVariants) {
      expect(v.blocks?.[0].type === 'header' && v.blocks[0].examTitleHtml).toContain(
        'ĐỀ THI GIỮA KỲ'
      );
      expect(v.blocks?.some((b) => b.id === 'blk-sec-sync')).toBe(true);
      const ftr = v.blocks?.[v.blocks.length - 1];
      expect(ftr?.type === 'footer' && ftr.showSignatures).toBe(true);
    }

    // 2. Xóa 1 câu hỏi trên Mã 101 -> các mã 102, 103 cũng xóa đúng câu đó và cập nhật còn 3 câu
    const removedQBlock = allVariants[0].blocks!.find((b) => b.type === 'question');
    const removedSourceId =
      removedQBlock?.type === 'question' ? removedQBlock.question.sourceQuestionId : '';
    const afterDeleteBlocks = allVariants[0].blocks!.filter((b) => b.id !== removedQBlock?.id);
    allVariants = applyVariantEditToAll(
      allVariants,
      recalculateVariantFromBlocks(allVariants[0], afterDeleteBlocks),
      DEFAULT_EXAM_METADATA
    );

    for (const v of allVariants) {
      expect(v.questions).toHaveLength(3);
      expect(v.questions.some((q) => q.sourceQuestionId === removedSourceId)).toBe(false);
      expect(Object.keys(v.answerKey)).toHaveLength(3);
    }
  });

  it('parses real-world Word exam with header table, nbsp spaces, essay section, and trailing answer key table', () => {
    const realWordSample = `| PHÒNG GD & ĐT ... | Chữ kí GT1: ... |
ĐỀ KIỂM TRA GIỮA HỌC KÌ 1
TIN HỌC 12
I. TRẮC NGHIỆM 3 ĐIỂM
Câu 1:\u00A0Cần tiến hành cập nhật hồ sơ học sinh khi nào?
A. Học sinh mới chuyển đến.
B. Sắp xếp danh sách.
C. Tìm điểm cao nhất.
D. Tính tỉ lệ.
Câu 2:\u00A0Access là gì?
A. Phần mềm ứng dụng\u00A0\u00A0\u00A0\u00A0B. Hệ QTCSDL Microsoft
C. Phần cứng\u00A0\u00A0\u00A0\u00A0D. Cả A và B
Câu 3:\u00A0Các chức năng chính của Access?
A. Lập bảng    B. Tính toán
C. Lưu trữ    D. Ba câu trên đều đúng
Câu 4:\u00A0Khởi động Access bằng cách nào?
A. Nháy đúp biểu tượng
B. Nháy một lần
C. Start -> Access
D. A hoặc C
II. TỰ LUẬN 7 ĐIỂM
Câu 1. Em hãy nêu khái niệm CSDL? (3 điểm)
BÀI LÀM
..............
HƯỚNG DẪN CHẤM KIỂM TRA
| \`1 | 2 | 3 | 4 |
| A | D | D | D |
MA TRẬN ĐỀ KIỂM TRA
| Tên chủ đề | Nhận biết |`;

    const parsed = parseQuestionsFromText(realWordSample);
    expect(parsed.questions).toHaveLength(4);
    expect(parsed.autoMatchedAnswersCount).toBe(4);
    expect(parsed.essaySectionText).toContain('II. TỰ LUẬN');
    expect(parsed.essaySectionText).toContain('khái niệm CSDL');

    const check = validateQuestionBank(parsed.questions);
    expect(check.validCount).toBe(4);

    // Kiểm tra đáp án tự khớp từ bảng Hướng dẫn chấm: 1:A, 2:D, 3:D, 4:D
    expect(parsed.questions[0].options[0].isCorrect).toBe(true);
    expect(parsed.questions[1].options[3].isCorrect).toBe(true);
    expect(parsed.questions[2].options[3].isCorrect).toBe(true);
    expect(parsed.questions[3].options[3].isCorrect).toBe(true);

    // Kiểm tra nhận diện đáp án tổng hợp & tham chiếu chữ cái
    expect(hasExplicitLetterReference('Cả A và B')).toBe(true);
    expect(hasExplicitLetterReference('A hoặc C')).toBe(true);
    expect(isPinnedEndOption('Ba câu trên đều đúng')).toBe(true);

    // Kiểm tra hàm dán nhanh chuỗi đáp án rời
    expect(parseQuickAnswerKey('1B 2C 3A 4D').get(2)).toBe('C');
    const reapplied = applyQuickAnswerKeyToQuestions(parsed.questions, 'B C A D');
    expect(reapplied.matchedCount).toBe(4);
    expect(reapplied.questions[0].options[1].isCorrect).toBe(true);
  });

  it('keeps answerKey strictly synced across blank sheet, insert mixed questions, and sample structure', () => {
    const parsed = parseQuestionsFromText(SAMPLE_EXAM_TEXT);
    const rawVariants = generateMixedExams(parsed.questions, {
      examCodes: ['101', '102'],
      shuffleQuestions: true,
      shuffleOptions: true,
      keepCompoundOptionAtEnd: true,
      questionCount: 4,
      seed: 77,
    });

    // Bắt đầu từ trang A4 trắng: blocks = [], questions = [], answerKey = {}
    let variants = rawVariants.map((v) =>
      recalculateVariantFromBlocks({ ...v, sourceMixedQuestions: v.questions }, [])
    );
    expect(variants[0].questions).toHaveLength(0);
    expect(Object.keys(variants[0].answerKey)).toHaveLength(0);
    expect(variants[0].sourceMixedQuestions).toHaveLength(4);

    // Kéo thả "Toàn bộ câu hỏi đã trộn" vào trang trắng -> cả 2 mã đề nhận đủ 4 câu & 4 đáp án khớp nhau
    variants = insertMixedQuestionsAcrossVariants(variants, DEFAULT_EXAM_METADATA, 0);
    for (const v of variants) {
      expect(v.questions).toHaveLength(4);
      expect(Object.keys(v.answerKey)).toHaveLength(4);
      v.questions.forEach((q) => {
        const correctOpt = q.options.find((o) => o.isCorrect);
        expect(v.answerKey[q.number]).toBe(correctOpt?.letter);
      });
    }

    // Chèn khối Phần tự luận (essay_section) trên Mã 101 -> đồng bộ sang Mã 102, không làm lệch bảng đáp án trắc nghiệm và xuất Word đầy đủ
    const essayBlock: ExamPaperBlock = {
      id: 'blk-essay-sec-1',
      type: 'essay_section',
      titleHtml: '<b>PHẦN TỰ LUẬN:</b> (2 điểm)',
      showNote: true,
      noteHtml: '<i>Trình bày rõ ràng.</i>',
      items: [
        { id: 'eq-1', promptHtml: '<b>Câu 1:</b> Đây là cái gì?', lineCount: 5 },
        { id: 'eq-2', promptHtml: '<b>Câu 2:</b> Trình bày quy trình.', lineCount: 8 },
      ],
    };
    const nextV0 = recalculateVariantFromBlocks(variants[0], [
      ...(variants[0].blocks ?? []),
      essayBlock,
    ]);
    variants = applyVariantEditToAll(variants, nextV0, DEFAULT_EXAM_METADATA);
    for (const v of variants) {
      expect(v.questions).toHaveLength(4);
      expect(Object.keys(v.answerKey)).toHaveLength(4);
      expect(v.blocks?.some((b) => b.type === 'essay_section' && b.items.length === 2)).toBe(true);
    }

    const html = buildExamPrintHtml(DEFAULT_EXAM_METADATA, [variants[0]]);
    expect(html).toContain('PHẦN TỰ LUẬN:');
    expect(html).toContain('Đây là cái gì?');
    expect(html).toContain('Trình bày quy trình.');
  });

  it('connects Step 1 bank edits, Step 2 metadata edits, and Step 3 layout-preserving remix end-to-end', () => {
    const parsed = parseQuestionsFromText(SAMPLE_EXAM_TEXT);
    const bank = parsed.questions.slice(0, 4);
    const rawVariants = generateMixedExams(bank, {
      examCodes: ['101', '102'],
      shuffleQuestions: true,
      shuffleOptions: true,
      keepCompoundOptionAtEnd: true,
      questionCount: 4,
      seed: 123,
    });

    // Áp dụng bố cục mẫu + phần tự luận từ Bước 1
    const essayBlk = buildEssaySectionBlockFromText(
      'II. TỰ LUẬN (3 điểm)\nCâu 1: Nêu khái niệm CSDL.\nCâu 2: Kể tên 2 hệ QTCSDL.'
    );
    expect(essayBlk.type).toBe('essay_section');
    expect(essayBlk.items).toHaveLength(2);

    let variants: MixedExamVariant[] = rawVariants.map((v) =>
      recalculateVariantFromBlocks(
        { ...v, sourceMixedQuestions: v.questions },
        [...buildDefaultPaperBlocks(v.questions, DEFAULT_EXAM_METADATA), essayBlk]
      )
    );

    // 1. Sửa đáp án đúng & nội dung câu 0 ở Bước 1 -> tự đồng bộ sang cả 2 mã đề ở Bước 3
    const editedBank = bank.map((q, idx) =>
      idx === 0
        ? {
            ...q,
            prompt: 'Ngôn ngữ đánh dấu siêu văn bản là gì?',
            options: q.options.map((o, oi) => ({ ...o, isCorrect: oi === 1 })),
          }
        : q
    );
    variants = syncBankQuestionsToVariants(variants, editedBank, DEFAULT_EXAM_METADATA);
    for (const v of variants) {
      const targetQ = v.questions.find((q) => q.sourceQuestionId === bank[0].id);
      expect(targetQ?.prompt).toBe('Ngôn ngữ đánh dấu siêu văn bản là gì?');
      const correctOpt = targetQ?.options.find((o) => o.isCorrect);
      expect(v.answerKey[targetQ!.number]).toBe(correctOpt?.letter);
    }

    // 2. Sửa thông tin đầu đề ở Bước 2 -> tự đồng bộ sang khung header của cả 2 mã đề
    const updatedMeta = {
      ...DEFAULT_EXAM_METADATA,
      subject: 'Cơ sở dữ liệu nâng cao',
      durationMinutes: 60,
    };
    variants = syncMetadataToVariants(variants, updatedMeta);
    for (const v of variants) {
      const hdr = v.blocks?.find((b) => b.type === 'header');
      expect(hdr?.type === 'header' && hdr.subjectHtml).toContain('Cơ sở dữ liệu nâng cao');
      expect(hdr?.type === 'header' && hdr.durationHtml).toContain('60 phút');
    }

    // 3. Trộn lại mã mới -> giữ nguyên khối header, footer và essay_section đã thiết kế
    const remixedRaw = generateMixedExams(editedBank, {
      examCodes: ['201', '202', '203'],
      shuffleQuestions: true,
      shuffleOptions: true,
      keepCompoundOptionAtEnd: true,
      questionCount: 4,
      seed: 456,
    });
    const remixed = applyRemixPreservingLayout(remixedRaw, variants[0].blocks);
    expect(remixed).toHaveLength(3);
    for (const v of remixed) {
      expect(v.questions).toHaveLength(4);
      expect(v.blocks?.some((b) => b.type === 'header')).toBe(true);
      expect(v.blocks?.some((b) => b.type === 'essay_section')).toBe(true);
      expect(v.blocks?.some((b) => b.type === 'footer')).toBe(true);
    }
  });
});


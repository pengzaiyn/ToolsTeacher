import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  KeyRound,
  ListChecks,
  Lock,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings2,
  Shuffle,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  applyQuickAnswerKeyToQuestions,
  applyRemixPreservingLayout,
  applyVariantEditToAll,
  buildDefaultPaperBlocks,
  buildEssaySectionBlockFromText,
  buildSequentialExamCodes,
  createExamId,
  DEFAULT_EXAM_METADATA,
  DEFAULT_EXAM_PAPER_THEME,
  generateMixedExams,
  hasExplicitLetterReference,
  insertMixedQuestionsAcrossVariants,
  isPinnedEndOption,
  OPTION_LETTERS,
  parseExamCodes,
  parseQuestionsFromText,
  recalculateVariantFromBlocks,
  SAMPLE_EXAM_TEXT,
  syncBankQuestionsToVariants,
  syncMetadataToVariants,
  validateQuestionBank,
  type ExamMetadata,
  type ExamOption,
  type ExamPaperBlock,
  type ExamPaperTheme,
  type ExamQuestion,
  type MixedExamVariant,
} from '@/lib/examMixer';
import { suggestExamAnswersWithAI } from '@/lib/examMixerAI';
import {
  downloadExamBankTemplate,
  exportAnswerKeysToExcel,
  parseQuestionsFromWorkbook,
} from '@/lib/examMixerExcel';
import { downloadExamsAsWord, printExamsInNewWindow } from '@/lib/examMixerExport';
import { ExamPaperEditor } from '@/components/exam-mixer/ExamPaperEditor';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

type WorkspaceStep = 'bank' | 'config' | 'result';
type InputSourceTab = 'text' | 'excel';
type ResultViewMode = 'exam' | 'matrix';
type BankFilter = 'all' | 'valid' | 'invalid';

interface StoredDraft {
  questions: ExamQuestion[];
  essaySectionText?: string;
  metadata: ExamMetadata;
  paperTheme?: ExamPaperTheme;
  examCodesRaw: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  keepCompoundOptionAtEnd: boolean;
  questionCountRaw: string;
}

const DRAFT_STORAGE_KEY = 'avc_exam_mixer_draft_v1';

interface MatrixRow {
  questionNumber: number;
  answers: Record<string, string>;
}

function loadDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (!Array.isArray(parsed.questions)) return null;
    return {
      questions: parsed.questions,
      essaySectionText: typeof parsed.essaySectionText === 'string' ? parsed.essaySectionText : '',
      metadata: { ...DEFAULT_EXAM_METADATA, ...(parsed.metadata ?? {}) },
      paperTheme: { ...DEFAULT_EXAM_PAPER_THEME, ...(parsed.paperTheme ?? {}) },
      examCodesRaw: typeof parsed.examCodesRaw === 'string' ? parsed.examCodesRaw : '101, 102, 103, 104',
      shuffleQuestions: parsed.shuffleQuestions ?? true,
      shuffleOptions: parsed.shuffleOptions ?? true,
      keepCompoundOptionAtEnd: parsed.keepCompoundOptionAtEnd ?? true,
      questionCountRaw: typeof parsed.questionCountRaw === 'string' ? parsed.questionCountRaw : '',
    };
  } catch {
    return null;
  }
}

export function TeacherExamMixer() {
  const { profile } = useAuth();
  const toast = useToast();

  const initialDraft = useMemo(() => loadDraft(), []);

  const [step, setStep] = useState<WorkspaceStep>('bank');
  const [inputTab, setInputTab] = useState<InputSourceTab>('text');

  // Ngân hàng câu hỏi
  const [questions, setQuestions] = useState<ExamQuestion[]>(() => initialDraft?.questions ?? []);
  const [pasteText, setPasteText] = useState('');
  const [essaySectionText, setEssaySectionText] = useState(
    () => initialDraft?.essaySectionText ?? ''
  );
  const [quickAnswerKeyRaw, setQuickAnswerKeyRaw] = useState('');
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestedIds, setAiSuggestedIds] = useState<Set<string>>(() => new Set());
  const [aiOverridesByQuestionId, setAiOverridesByQuestionId] = useState<
    Record<string, { previousOptionId: string; aiOptionId: string }>
  >({});
  const [parsingExcel, setParsingExcel] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankFilter, setBankFilter] = useState<BankFilter>('all');

  // Chỉnh sửa / thêm câu hỏi thủ công
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editOptions, setEditOptions] = useState<ExamOption[]>([]);

  // Xác nhận xóa
  const [deleteTarget, setDeleteTarget] = useState<ExamQuestion | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);

  // Cấu hình đề & trộn
  const [metadata, setMetadata] = useState<ExamMetadata>(() => ({
    ...(initialDraft?.metadata ?? DEFAULT_EXAM_METADATA),
    subject: initialDraft?.metadata.subject || profile?.subject || '',
  }));
  const [examCodesRaw, setExamCodesRaw] = useState(
    () => initialDraft?.examCodesRaw ?? '101, 102, 103, 104'
  );
  const [shuffleQuestions, setShuffleQuestions] = useState(
    () => initialDraft?.shuffleQuestions ?? true
  );
  const [shuffleOptions, setShuffleOptions] = useState(() => initialDraft?.shuffleOptions ?? true);
  const [keepCompoundOptionAtEnd, setKeepCompoundOptionAtEnd] = useState(
    () => initialDraft?.keepCompoundOptionAtEnd ?? true
  );
  const [questionCountRaw, setQuestionCountRaw] = useState(
    () => initialDraft?.questionCountRaw ?? ''
  );

  // Kết quả trộn & kiểu tờ đề
  const [paperTheme, setPaperTheme] = useState<ExamPaperTheme>(
    () => initialDraft?.paperTheme ?? DEFAULT_EXAM_PAPER_THEME
  );
  const [variants, setVariants] = useState<MixedExamVariant[]>([]);
  const [variantsHistory, setVariantsHistory] = useState<{
    past: MixedExamVariant[][];
    future: MixedExamVariant[][];
  }>({ past: [], future: [] });
  const [resultView, setResultView] = useState<ResultViewMode>('exam');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [showAnswersPreview, setShowAnswersPreview] = useState(true);
  const [includeAnswerKeyInWord, setIncludeAnswerKeyInWord] = useState(true);
  const [mixing, setMixing] = useState(false);
  const [lastMixedSignature, setLastMixedSignature] = useState('');

  // Lưu nháp tự động vào localStorage
  useEffect(() => {
    try {
      const payload: StoredDraft = {
        questions,
        essaySectionText,
        metadata,
        paperTheme,
        examCodesRaw,
        shuffleQuestions,
        shuffleOptions,
        keepCompoundOptionAtEnd,
        questionCountRaw,
      };
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Bỏ qua nếu bộ nhớ trình duyệt đầy
    }
  }, [
    questions,
    essaySectionText,
    metadata,
    paperTheme,
    examCodesRaw,
    shuffleQuestions,
    shuffleOptions,
    keepCompoundOptionAtEnd,
    questionCountRaw,
  ]);

  const bankValidation = useMemo(() => validateQuestionBank(questions), [questions]);
  const parsedCodes = useMemo(() => parseExamCodes(examCodesRaw, 4), [examCodesRaw]);

  const mixConfigSignature = useMemo(
    () =>
      JSON.stringify({
        validIds: bankValidation.validQuestions.map((q) => q.id),
        codes: parsedCodes,
        questionCountRaw: questionCountRaw.trim(),
        shuffleQuestions,
        shuffleOptions,
        keepCompoundOptionAtEnd,
      }),
    [
      bankValidation.validQuestions,
      parsedCodes,
      questionCountRaw,
      shuffleQuestions,
      shuffleOptions,
      keepCompoundOptionAtEnd,
    ]
  );

  const needsRemix =
    variants.length > 0 && lastMixedSignature !== '' && lastMixedSignature !== mixConfigSignature;

  // Đồng bộ tự động Bước 1 (sửa nội dung/đáp án câu hỏi) -> Bước 3 (các mã đề đang xem)
  useEffect(() => {
    setVariants((prev) =>
      prev.length > 0 ? syncBankQuestionsToVariants(prev, questions, metadata) : prev
    );
  }, [questions, metadata]);

  // Đồng bộ tự động Bước 2 (thông tin đầu đề) -> Bước 3 (khung tiêu đề & thông tin thí sinh)
  useEffect(() => {
    setVariants((prev) => (prev.length > 0 ? syncMetadataToVariants(prev, metadata) : prev));
  }, [metadata]);

  const filteredQuestions = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    return questions.filter((item) => {
      const val = bankValidation.byId.get(item.id);
      if (bankFilter === 'valid' && !val?.valid) return false;
      if (bankFilter === 'invalid' && val?.valid) return false;
      if (!q) return true;
      return (
        item.prompt.toLowerCase().includes(q) ||
        (item.group ?? '').toLowerCase().includes(q) ||
        item.options.some((o) => o.text.toLowerCase().includes(q))
      );
    });
  }, [questions, bankValidation, bankSearch, bankFilter]);

  const activeVariant = useMemo(() => {
    if (variants.length === 0) return null;
    return variants.find((v) => v.code === selectedCode) ?? variants[0];
  }, [variants, selectedCode]);

  const matrixRows = useMemo<MatrixRow[]>(() => {
    if (variants.length === 0) return [];
    const maxQ = Math.max(...variants.map((v) => v.questions.length));
    const rows: MatrixRow[] = [];
    for (let i = 1; i <= maxQ; i += 1) {
      const answers: Record<string, string> = {};
      for (const v of variants) {
        answers[v.code] = v.answerKey[i] ?? '—';
      }
      rows.push({ questionNumber: i, answers });
    }
    return rows;
  }, [variants]);

  const matrixColumns = useMemo<TableColumn<MatrixRow>[]>(() => {
    return [
      {
        key: 'q',
        header: 'Câu',
        className: 'w-20',
        render: (row) => <span className="font-bold text-brand-navy">Câu {row.questionNumber}</span>,
      },
      ...variants.map((v) => ({
        key: `code-${v.code}`,
        header: `Mã ${v.code}`,
        className: 'text-center',
        render: (row: MatrixRow) => (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-navySoft font-bold text-brand-navy">
            {row.answers[v.code]}
          </span>
        ),
      })),
    ];
  }, [variants]);

  function handleParseText(mode: 'append' | 'replace') {
    if (!pasteText.trim()) {
      toast.error('Vui lòng dán nội dung câu hỏi trước khi phân tích');
      return;
    }
    const result = parseQuestionsFromText(pasteText);
    if (result.questions.length === 0) {
      toast.error(result.warnings[0] ?? 'Không nhận diện được câu hỏi nào');
      return;
    }

    setQuestions((prev) => (mode === 'replace' ? result.questions : [...prev, ...result.questions]));
    if (mode === 'replace') {
      setAiSuggestedIds(new Set());
      setAiOverridesByQuestionId({});
    }
    if (result.essaySectionText) {
      setEssaySectionText(result.essaySectionText);
    }
    setPasteText('');
    const check = validateQuestionBank(result.questions);
    const extraParts: string[] = [];
    if (result.autoMatchedAnswersCount && result.autoMatchedAnswersCount > 0) {
      extraParts.push(`tự khớp ${result.autoMatchedAnswersCount} đáp án từ bảng chấm`);
    }
    if (result.essaySectionText) {
      extraParts.push('đã tách sẵn phần Tự luận để giữ cuối đề');
    }
    const suffix = extraParts.length > 0 ? ` (${extraParts.join(', ')})` : '';

    if (check.invalidCount > 0) {
      toast.info(
        `Đã nạp ${result.questions.length} câu hỏi (${check.validCount} hợp lệ, ${check.invalidCount} câu chưa có đáp án đúng — bấm trực tiếp vào A/B/C/D hoặc dùng AI gợi ý)${suffix}`
      );
    } else {
      toast.success(`Đã nạp thành công ${result.questions.length} câu hỏi hợp lệ${suffix}`);
    }
  }

  function handleSelectCorrectOptionDirect(questionId: string, optionId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((o) => ({ ...o, isCorrect: o.id === optionId })),
            }
          : q
      )
    );
    setAiSuggestedIds((prev) => {
      if (!prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
    setAiOverridesByQuestionId((prev) => {
      if (!(questionId in prev)) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function handleApplyQuickAnswerKey() {
    if (!quickAnswerKeyRaw.trim()) {
      toast.error('Vui lòng dán chuỗi hoặc bảng đáp án (VD: A D C D... hoặc 1A 2D 3C...)');
      return;
    }
    const applied = applyQuickAnswerKeyToQuestions(questions, quickAnswerKeyRaw);
    if (applied.matchedCount === 0) {
      toast.error('Không nhận diện được đáp án hợp lệ (thử dạng "1A 2D 3C..." hoặc "A D C D...")');
      return;
    }
    setQuestions(applied.questions);
    setAiOverridesByQuestionId({});
    setQuickAnswerKeyRaw('');
    toast.success(`Đã áp dụng đáp án đúng cho ${applied.matchedCount} câu hỏi`);
  }

  async function handleAISuggestAnswers() {
    if (questions.length === 0) return;
    const missingAnswers = questions.filter(
      (q) => q.options.length >= 2 && !q.options.some((o) => o.isCorrect)
    );
    const targets =
      missingAnswers.length > 0
        ? missingAnswers
        : questions.filter((q) => q.options.length >= 2);

    if (targets.length === 0) {
      toast.error('Chưa có câu hỏi nào đủ phương án để AI gợi ý đáp án');
      return;
    }

    setAiSuggesting(true);
    try {
      const suggestions = await suggestExamAnswersWithAI(targets, metadata.subject);
      if (suggestions.size === 0) {
        toast.error('AI chưa xác định được đáp án cho các câu này. Bạn hãy bấm chọn trực tiếp A/B/C/D.');
        return;
      }

      const detectedOverrides: Record<string, { previousOptionId: string; aiOptionId: string }> = {};
      const clearedOverrideIds: string[] = [];

      questions.forEach((q) => {
        const letter = suggestions.get(q.id);
        if (!letter) return;
        const idx = OPTION_LETTERS.indexOf(letter);
        if (idx < 0 || idx >= q.options.length) return;
        const aiOpt = q.options[idx];
        const prevCorrect = q.options.find((o) => o.isCorrect);
        if (prevCorrect && prevCorrect.id !== aiOpt.id) {
          detectedOverrides[q.id] = {
            previousOptionId: prevCorrect.id,
            aiOptionId: aiOpt.id,
          };
        } else {
          clearedOverrideIds.push(q.id);
        }
      });

      setQuestions((prev) =>
        prev.map((q) => {
          const letter = suggestions.get(q.id);
          if (!letter) return q;
          const idx = OPTION_LETTERS.indexOf(letter);
          if (idx < 0 || idx >= q.options.length) return q;
          return {
            ...q,
            options: q.options.map((o, oIdx) => ({ ...o, isCorrect: oIdx === idx })),
          };
        })
      );
      setAiSuggestedIds((prev) => {
        const next = new Set(prev);
        suggestions.forEach((_, qId) => next.add(qId));
        return next;
      });
      setAiOverridesByQuestionId((prev) => {
        const next = { ...prev, ...detectedOverrides };
        clearedOverrideIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      const changedCount = Object.keys(detectedOverrides).length;
      toast.success(
        changedCount > 0
          ? `AI đã gợi ý đáp án cho ${suggestions.size} câu hỏi (${changedCount} câu khác với lựa chọn trước đó của bạn — được đánh dấu viền đỏ/xanh để bạn đối chiếu).`
          : `AI đã gợi ý đáp án cho ${suggestions.size} câu hỏi. Bạn có thể bấm trực tiếp vào A/B/C/D để sửa lại nếu cần.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không gọi được AI gợi ý đáp án');
    } finally {
      setAiSuggesting(false);
    }
  }

  function handleLoadSampleBank() {
    const parsed = parseQuestionsFromText(SAMPLE_EXAM_TEXT);
    setQuestions(parsed.questions);
    setAiSuggestedIds(new Set());
    setAiOverridesByQuestionId({});
    if (!metadata.subject) {
      setMetadata((prev) => ({ ...prev, subject: 'Tin học đại cương' }));
    }
    toast.success(`Đã nạp ${parsed.questions.length} câu hỏi mẫu để dùng thử`);
  }

  async function processExcelFile(file: File) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
      return;
    }
    setParsingExcel(true);
    try {
      const res = await parseQuestionsFromWorkbook(file);
      setQuestions((prev) => [...prev, ...res.questions]);
      const check = validateQuestionBank(res.questions);
      toast.success(
        `Đã nhập ${res.questions.length} câu từ sheet "${res.sheetName}" (${check.validCount} hợp lệ)`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đọc được file Excel');
    } finally {
      setParsingExcel(false);
    }
  }

  function openCreateQuestionModal() {
    setEditingId(null);
    setEditPrompt('');
    setEditGroup('');
    setEditExplanation('');
    setEditOptions([
      { id: createExamId('opt'), text: '', isCorrect: true },
      { id: createExamId('opt'), text: '', isCorrect: false },
      { id: createExamId('opt'), text: '', isCorrect: false },
      { id: createExamId('opt'), text: '', isCorrect: false },
    ]);
    setEditorOpen(true);
  }

  function openEditQuestionModal(item: ExamQuestion) {
    setEditingId(item.id);
    setEditPrompt(item.prompt);
    setEditGroup(item.group ?? '');
    setEditExplanation(item.explanation ?? '');
    const copied =
      item.options.length >= 2
        ? item.options.map((o) => ({ ...o }))
        : [
            ...item.options.map((o) => ({ ...o })),
            { id: createExamId('opt'), text: '', isCorrect: false },
            { id: createExamId('opt'), text: '', isCorrect: false },
          ].slice(0, 4);
    setEditOptions(copied);
    setEditorOpen(true);
  }

  function handleSaveQuestionModal() {
    const cleanPrompt = editPrompt.trim();
    const cleanedOpts = editOptions
      .map((o) => ({ ...o, text: o.text.trim() }))
      .filter((o) => o.text.length > 0);

    if (!cleanPrompt) {
      toast.error('Vui lòng nhập nội dung câu hỏi');
      return;
    }
    if (cleanedOpts.length < 2) {
      toast.error('Cần ít nhất 2 phương án có nội dung');
      return;
    }
    if (!cleanedOpts.some((o) => o.isCorrect)) {
      toast.error('Vui lòng chọn 1 đáp án đúng');
      return;
    }

    const saved: ExamQuestion = {
      id: editingId ?? createExamId('q'),
      prompt: cleanPrompt,
      options: cleanedOpts,
      group: editGroup.trim() || undefined,
      explanation: editExplanation.trim() || undefined,
    };

    if (editingId) {
      setQuestions((prev) => prev.map((q) => (q.id === editingId ? saved : q)));
      toast.success('Đã cập nhật câu hỏi');
    } else {
      setQuestions((prev) => [...prev, saved]);
      toast.success('Đã thêm câu hỏi mới vào ngân hàng');
    }
    setEditorOpen(false);
  }

  function handleConfirmDeleteQuestion() {
    if (!deleteTarget) return;
    setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('Đã xóa câu hỏi khỏi ngân hàng');
  }

  function handleConfirmClearAll() {
    setQuestions([]);
    setEssaySectionText('');
    setAiSuggestedIds(new Set());
    setAiOverridesByQuestionId({});
    setVariants([]);
    setLastMixedSignature('');
    setSelectedCode('');
    setClearAllOpen(false);
    setStep('bank');
    toast.success('Đã xóa toàn bộ ngân hàng câu hỏi');
  }

  function handleRunMix(preserveLayout = false) {
    if (bankValidation.validCount === 0) {
      toast.error('Cần ít nhất 1 câu hỏi hợp lệ ở Bước 1 trước khi trộn đề');
      setStep('bank');
      return;
    }
    if (parsedCodes.length === 0) {
      toast.error('Vui lòng nhập ít nhất 1 mã đề ở Bước 2');
      setStep('config');
      return;
    }

    const requestedCount = Number(questionCountRaw);
    const questionCount =
      Number.isFinite(requestedCount) && requestedCount > 0
        ? Math.min(Math.floor(requestedCount), bankValidation.validCount)
        : bankValidation.validCount;

    setMixing(true);
    try {
      const rawVariants = generateMixedExams(bankValidation.validQuestions, {
        examCodes: parsedCodes,
        shuffleQuestions,
        shuffleOptions,
        keepCompoundOptionAtEnd,
        questionCount,
      });

      const templateBlocks = preserveLayout ? activeVariant?.blocks : undefined;
      const nextVariants = applyRemixPreservingLayout(rawVariants, templateBlocks);

      setVariants(nextVariants);
      setLastMixedSignature(mixConfigSignature);
      setVariantsHistory({ past: [], future: [] });
      setSelectedCode(nextVariants[0]?.code ?? '');
      setResultView('exam');
      setStep('result');
      toast.success(
        preserveLayout && templateBlocks && templateBlocks.length > 0
          ? `Đã cập nhật & trộn lại ${nextVariants.length} mã đề (${questionCount} câu/đề), giữ nguyên bố cục tờ A4 đã thiết kế.`
          : `Đã trộn thành công ${nextVariants.length} mã đề (${questionCount} câu/đề). Kéo thả khung bên trái hoặc bấm "Cấu trúc đề thi mẫu".`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể trộn đề');
    } finally {
      setMixing(false);
    }
  }

  function handleGoToStep(target: WorkspaceStep) {
    if (target === 'bank') {
      setStep('bank');
      return;
    }
    if (bankValidation.validCount === 0) {
      toast.error(
        'Vui lòng hoàn thành Bước 1 (cần ít nhất 1 câu hỏi hợp lệ đã chọn đáp án đúng) trước khi chuyển bước.'
      );
      setStep('bank');
      return;
    }
    if (target === 'config') {
      setStep('config');
      return;
    }
    // target === 'result'
    if (variants.length === 0) {
      handleRunMix(false);
      return;
    }
    setStep('result');
  }

  function handleUpdateVariant(nextVariant: MixedExamVariant, recordHistory = false) {
    if (recordHistory) {
      setVariantsHistory((hist) => ({
        past: [...hist.past, variants].slice(-30),
        future: [],
      }));
    }
    setVariants((prev) => applyVariantEditToAll(prev, nextVariant, metadata));

    // Đồng bộ ngược chỉnh sửa nội dung & đáp án câu hỏi trên tờ A4 (Bước 3) về Bước 1 (Ngân hàng)
    const editedBySourceId = new Map<string, MixedExamVariant['questions'][number]>();
    nextVariant.questions.forEach((mq) => {
      editedBySourceId.set(mq.sourceQuestionId, mq);
    });
    setQuestions((prevBank) => {
      let bankTouched = false;
      const nextBank = prevBank.map((bq) => {
        const edited = editedBySourceId.get(bq.id);
        if (!edited) return bq;
        const editedOptById = new Map(
          edited.options
            .filter((o) => Boolean(o.sourceOptionId))
            .map((o) => [o.sourceOptionId!, o])
        );
        let optChanged = false;
        const nextOpts = bq.options.map((bo) => {
          const matched = editedOptById.get(bo.id);
          if (!matched) return bo;
          if (bo.text !== matched.text || bo.isCorrect !== matched.isCorrect) {
            optChanged = true;
            return { ...bo, text: matched.text, isCorrect: matched.isCorrect };
          }
          return bo;
        });
        const promptChanged = bq.prompt !== edited.prompt;
        if (!promptChanged && !optChanged) return bq;
        bankTouched = true;
        return { ...bq, prompt: edited.prompt, options: nextOpts };
      });
      return bankTouched ? nextBank : prevBank;
    });
  }

  function handleInsertMixedQuestionsAt(targetIndex: number) {
    const currentSnapshot = variants;
    setVariantsHistory((hist) => ({
      past: [...hist.past, currentSnapshot].slice(-30),
      future: [],
    }));
    setVariants((prev) => insertMixedQuestionsAcrossVariants(prev, metadata, targetIndex));
    toast.success(`Đã chèn toàn bộ câu hỏi đã trộn vào cả ${variants.length} mã đề`);
  }

  function handleApplySampleStructure() {
    const currentSnapshot = variants;
    setVariantsHistory((hist) => ({
      past: [...hist.past, currentSnapshot].slice(-30),
      future: [],
    }));
    setVariants((prev) =>
      prev.map((v) => {
        const pool = v.sourceMixedQuestions ?? v.questions;
        const baseBlocks = buildDefaultPaperBlocks(pool, metadata);
        if (essaySectionText.trim()) {
          const essayBlock: ExamPaperBlock = buildEssaySectionBlockFromText(essaySectionText);
          const footerIdx = baseBlocks.findIndex((b) => b.type === 'footer');
          if (footerIdx >= 0) {
            baseBlocks.splice(footerIdx, 0, essayBlock);
          } else {
            baseBlocks.push(essayBlock);
          }
        }
        return recalculateVariantFromBlocks(
          {
            ...v,
            sourceMixedQuestions: pool,
          },
          baseBlocks
        );
      })
    );
    toast.success(`Đã áp dụng Cấu trúc đề thi mẫu cho toàn bộ ${variants.length} mã đề`);
  }

  function handleClearToBlankSheet() {
    const currentSnapshot = variants;
    setVariantsHistory((hist) => ({
      past: [...hist.past, currentSnapshot].slice(-30),
      future: [],
    }));
    setVariants((prev) =>
      prev.map((v) => recalculateVariantFromBlocks(v, []))
    );
    toast.info('Đã đưa tờ đề về trang A4 trắng để tự thiết kế');
  }

  function handleUndoVariants() {
    if (variantsHistory.past.length === 0) return;
    const previous = variantsHistory.past[variantsHistory.past.length - 1];
    const currentSnapshot = variants;
    setVariantsHistory((hist) => ({
      past: hist.past.slice(0, -1),
      future: [currentSnapshot, ...hist.future].slice(0, 30),
    }));
    setVariants(previous);
  }

  function handleRedoVariants() {
    if (variantsHistory.future.length === 0) return;
    const next = variantsHistory.future[0];
    const currentSnapshot = variants;
    setVariantsHistory((hist) => ({
      past: [...hist.past, currentSnapshot].slice(-30),
      future: hist.future.slice(1),
    }));
    setVariants(next);
  }

  function handlePrintVariants(targetVariants: MixedExamVariant[], answerKeyOnly = false) {
    const ok = printExamsInNewWindow(metadata, targetVariants, {
      showAnswersInExam: showAnswersPreview,
      includeAnswerKeyPage: !answerKeyOnly && includeAnswerKeyInWord,
      answerKeyOnly,
      theme: paperTheme,
    });
    if (!ok) {
      toast.error('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép mở popup hoặc tải file Word.');
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <section className="rounded-2xl border border-line bg-surface-card p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/teacher/tools"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary hover:text-brand-navy"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Công cụ giảng dạy</span>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListChecks className="h-6 w-6 text-brand-red" aria-hidden="true" />
                <h1 className="text-2xl font-bold text-brand-navy">Trộn đề thi trắc nghiệm</h1>
                <Badge tone="navy">{bankValidation.validCount} câu hợp lệ</Badge>
                {bankValidation.invalidCount > 0 && (
                  <Badge tone="warning">{bankValidation.invalidCount} câu cần sửa</Badge>
                )}
                {variants.length > 0 && (
                  <Badge tone="success">{variants.length} mã đề đã tạo</Badge>
                )}
              </div>
              <p className="text-sm font-normal text-ink-secondary">
                Nhập câu hỏi từ văn bản hoặc Excel, đảo thứ tự câu hỏi và đáp án tự động, xuất Word
                (.doc) chuẩn A4 và Excel bảng đáp án chấm nhanh.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={handleLoadSampleBank}>
                <Sparkles className="h-4 w-4 text-brand-red" aria-hidden="true" />
                <span>Nạp đề mẫu</span>
              </Button>
              {questions.length > 0 && (
                <Button variant="secondary" onClick={() => setClearAllOpen(true)}>
                  <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  <span>Xóa tất cả</span>
                </Button>
              )}
            </div>
          </div>

          {/* 3 Bước điều hướng kết nối A-Z */}
          <div
            role="tablist"
            aria-label="Các bước trộn đề thi"
            className="mt-6 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-3"
          >
            <button
              type="button"
              role="tab"
              aria-selected={step === 'bank'}
              onClick={() => handleGoToStep('bank')}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                step === 'bank'
                  ? 'border-brand-navy bg-brand-navy text-white'
                  : 'border-line bg-surface-page text-ink-primary hover:border-brand-navy'
              }`}
            >
              <div className="flex items-center gap-2">
                {bankValidation.validCount > 0 ? (
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      step === 'bank' ? 'text-white' : 'text-status-successText'
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm font-semibold">1. Ngân hàng câu hỏi</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  step === 'bank' ? 'bg-white/20 text-white' : 'bg-surface-card text-ink-secondary'
                }`}
              >
                {bankValidation.validCount}/{questions.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={step === 'config'}
              aria-disabled={bankValidation.validCount === 0}
              onClick={() => handleGoToStep('config')}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                step === 'config'
                  ? 'border-brand-navy bg-brand-navy text-white'
                  : bankValidation.validCount === 0
                    ? 'cursor-not-allowed border-line bg-surface-page/60 text-ink-muted'
                    : 'border-line bg-surface-page text-ink-primary hover:border-brand-navy'
              }`}
            >
              <div className="flex items-center gap-2">
                {bankValidation.validCount === 0 ? (
                  <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm font-semibold">2. Cấu hình & Trộn đề</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  step === 'config' ? 'bg-white/20 text-white' : 'bg-surface-card text-ink-secondary'
                }`}
              >
                {parsedCodes.length} mã
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={step === 'result'}
              aria-disabled={bankValidation.validCount === 0}
              onClick={() => handleGoToStep('result')}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                step === 'result'
                  ? 'border-brand-red bg-brand-red text-white'
                  : bankValidation.validCount === 0
                    ? 'cursor-not-allowed border-line bg-surface-page/60 text-ink-muted'
                    : 'border-line bg-surface-page text-ink-primary hover:border-brand-red'
              }`}
            >
              <div className="flex items-center gap-2">
                {bankValidation.validCount === 0 ? (
                  <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm font-semibold">3. Xem trước & Xuất file</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  needsRemix
                    ? step === 'result'
                      ? 'bg-white text-brand-red'
                      : 'bg-status-warningBg text-status-warningText'
                    : step === 'result'
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-card text-ink-secondary'
                }`}
              >
                {needsRemix ? 'Cần trộn lại' : variants.length > 0 ? `${variants.length} mã` : 'Chưa trộn'}
              </span>
            </button>
          </div>
        </section>

        {/* BƯỚC 1: NHẬP & QUẢN LÝ NGÂN HÀNG CÂU HỎI */}
        {step === 'bank' && (
          <div className="flex flex-col gap-6">
            <section className="rounded-xl border border-line bg-surface-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
                <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Nguồn nhập câu hỏi">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputTab === 'text'}
                    onClick={() => setInputTab('text')}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      inputTab === 'text'
                        ? 'bg-brand-navy text-white'
                        : 'bg-surface-page text-ink-secondary hover:text-ink-primary'
                    }`}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>Dán văn bản (Word / Text)</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputTab === 'excel'}
                    onClick={() => setInputTab('excel')}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      inputTab === 'excel'
                        ? 'bg-brand-navy text-white'
                        : 'bg-surface-page text-ink-secondary hover:text-ink-primary'
                    }`}
                  >
                    <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                    <span>Nhập từ file Excel</span>
                  </button>
                </div>

                <Button variant="secondary" onClick={openCreateQuestionModal}>
                  <Plus className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                  <span>Thêm câu hỏi thủ công</span>
                </Button>
              </div>

              {inputTab === 'text' ? (
                <div className="mt-4 flex flex-col gap-4">
                  <div className="rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
                    <p className="font-semibold text-ink-primary">
                      Định dạng hỗ trợ tự động nhận diện:
                    </p>
                    <p className="mt-1">
                      Bắt đầu mỗi câu bằng <strong className="text-brand-navy">Câu 1:</strong> hoặc{' '}
                      <strong className="text-brand-navy">1.</strong> • Các phương án{' '}
                      <strong className="text-brand-navy">A. B. C. D.</strong> (viết từng dòng hoặc
                      chung một dòng đều được) • Đánh dấu đáp án đúng bằng dấu sao{' '}
                      <strong className="text-brand-red">*A.</strong> hoặc thêm dòng{' '}
                      <strong className="text-brand-red">Đáp án: A</strong>.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="exam-paste-textarea"
                      className="mb-2 block text-sm font-semibold text-ink-primary"
                    >
                      Nội dung câu hỏi dán từ Word / văn bản
                    </label>
                    <textarea
                      id="exam-paste-textarea"
                      rows={8}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={`Ví dụ:\nCâu 1: Thủ đô của Việt Nam là thành phố nào?\n*A. Hà Nội\nB. Đà Nẵng\nC. Cần Thơ\nD. Hải Phòng`}
                      className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPasteText(SAMPLE_EXAM_TEXT)}
                      className="text-xs font-semibold text-brand-navy hover:underline"
                    >
                      Điền nhanh văn bản mẫu vào ô trên
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {questions.length > 0 && (
                        <Button
                          variant="secondary"
                          onClick={() => handleParseText('replace')}
                          disabled={!pasteText.trim()}
                        >
                          Phân tích & thay thế toàn bộ
                        </Button>
                      )}
                      <Button
                        variant="navy"
                        onClick={() => handleParseText('append')}
                        disabled={!pasteText.trim()}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span>Phân tích & thêm vào ngân hàng</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-page p-4">
                    <div className="text-xs font-normal text-ink-secondary">
                      <p className="font-semibold text-ink-primary">
                        Nhập nhanh danh sách câu hỏi từ file Excel (.xlsx, .xls)
                      </p>
                      <p className="mt-1">
                        File cần có các cột: <strong>Câu hỏi</strong>, <strong>Đáp án A</strong>,{' '}
                        <strong>Đáp án B</strong> (tới F) và <strong>Đáp án đúng</strong> (A/B/C/D).
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={downloadExamBankTemplate}>
                      <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                      <span>Tải file Excel mẫu</span>
                    </Button>
                  </div>

                  <FileDropzone
                    accept=".xlsx,.xls"
                    hint="Hỗ trợ định dạng .xlsx và .xls"
                    disabled={parsingExcel}
                    onFileSelect={(file) => void processExcelFile(file)}
                  />
                </div>
              )}
            </section>

            {/* Danh sách câu hỏi đã nạp */}
            <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-brand-navy">
                    Danh sách câu hỏi ({questions.length})
                  </h2>
                  {bankValidation.validCount > 0 && (
                    <Badge tone="success">{bankValidation.validCount} hợp lệ</Badge>
                  )}
                  {bankValidation.invalidCount > 0 && (
                    <Badge tone="danger">{bankValidation.invalidCount} cần sửa</Badge>
                  )}
                </div>

                {bankValidation.validCount > 0 && (
                  <Button variant="primary" onClick={() => setStep('config')}>
                    <Shuffle className="h-4 w-4" aria-hidden="true" />
                    <span>Tiếp tục: Cấu hình & Trộn đề</span>
                  </Button>
                )}
              </div>

              {questions.length > 0 && (
                <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-page p-4">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                    <div className="flex flex-1 flex-col gap-2">
                      <label
                        htmlFor="quick-answer-key-input"
                        className="flex items-center gap-2 text-xs font-semibold text-ink-primary"
                      >
                        <KeyRound className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                        <span>Chọn nhanh đáp án đúng (bấm trực tiếp A/B/C/D bên dưới, dán bảng đáp án, hoặc để AI gợi ý)</span>
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          id="quick-answer-key-input"
                          type="text"
                          value={quickAnswerKeyRaw}
                          onChange={(e) => setQuickAnswerKeyRaw(e.target.value)}
                          placeholder="Dán chuỗi đáp án: A D C D D D C... hoặc 1A 2D 3C 4D..."
                          className="h-10 flex-1 rounded-lg border border-line-strong bg-surface-card px-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                        />
                        <Button
                          variant="secondary"
                          onClick={handleApplyQuickAnswerKey}
                          disabled={!quickAnswerKeyRaw.trim()}
                        >
                          Áp dụng đáp án
                        </Button>
                      </div>
                    </div>

                    <Button
                      variant="navy"
                      loading={aiSuggesting}
                      onClick={handleAISuggestAnswers}
                    >
                      <Wand2 className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {bankValidation.invalidCount > 0
                          ? `AI gợi ý đáp án (${bankValidation.invalidCount} câu chưa chọn)`
                          : 'AI kiểm tra & gợi ý đáp án'}
                      </span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 border-t border-line pt-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label
                        htmlFor="bank-search-input"
                        className="mb-2 block text-xs font-semibold text-ink-secondary"
                      >
                        Tìm trong ngân hàng câu hỏi
                      </label>
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                          aria-hidden="true"
                        />
                        <input
                          id="bank-search-input"
                          type="search"
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Tìm theo nội dung câu hỏi, đáp án, chương/nhóm..."
                          className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                        />
                      </div>
                    </div>
                    <Select
                      label="Trạng thái câu hỏi"
                      value={bankFilter}
                      onChange={(e) => setBankFilter(e.target.value as BankFilter)}
                      options={[
                        { value: 'all', label: `Tất cả (${questions.length})` },
                        { value: 'valid', label: `Hợp lệ (${bankValidation.validCount})` },
                        { value: 'invalid', label: `Cần sửa (${bankValidation.invalidCount})` },
                      ]}
                    />
                  </div>
                </div>
              )}

              {questions.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="Chưa có câu hỏi nào trong ngân hàng"
                  description="Dán danh sách câu hỏi từ Word, tải lên file Excel hoặc bấm 'Nạp đề mẫu' ở góc trên để thử ngay."
                  action={
                    <Button variant="navy" onClick={handleLoadSampleBank}>
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      <span>Nạp 6 câu hỏi mẫu ngay</span>
                    </Button>
                  }
                />
              ) : filteredQuestions.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Không tìm thấy câu hỏi phù hợp"
                  description="Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc 'Tất cả'."
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredQuestions.map((item) => {
                    const realIdx = questions.findIndex((q) => q.id === item.id) + 1;
                    const val = bankValidation.byId.get(item.id);
                    const hasRef = item.options.some((o) => hasExplicitLetterReference(o.text));
                    const hasPinned = item.options.some((o) => isPinnedEndOption(o.text));
                    const aiOverride = aiOverridesByQuestionId[item.id];

                    return (
                      <article
                        key={item.id}
                        className={`rounded-xl border p-4 ${
                          val?.valid
                            ? 'border-line bg-surface-page/50'
                            : 'border-status-dangerBorder bg-status-dangerBg/30'
                        }`}
                      >
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-brand-navy">Câu {realIdx}</span>
                            {item.group && <Badge tone="navy">{item.group}</Badge>}
                            {val?.valid ? (
                              <Badge tone="success">Hợp lệ</Badge>
                            ) : (
                              <Badge tone="danger">Chưa chọn đáp án</Badge>
                            )}
                            {aiSuggestedIds.has(item.id) && (
                              <Badge tone="navy">
                                <Wand2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
                                AI gợi ý
                              </Badge>
                            )}
                            {hasRef && (
                              <Badge tone="warning">
                                <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />
                                Giữ nguyên thứ tự A/B/C/D
                              </Badge>
                            )}
                            {!hasRef && hasPinned && (
                              <Badge tone="neutral">Ghim đáp án tổng hợp ở cuối</Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditQuestionModal(item)}
                            >
                              <Pencil className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                              <span>Sửa</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                              <span>Xóa</span>
                            </Button>
                          </div>
                        </div>

                        <p className="mt-2 whitespace-pre-line text-sm font-semibold text-ink-primary">
                          {item.prompt || '(Chưa có nội dung câu hỏi)'}
                        </p>

                        {!val?.valid && val?.errors && (
                          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-status-dangerText">
                            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{val.errors.join(' • ')}</span>
                          </div>
                        )}

                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {item.options.map((opt, oIdx) => {
                            const letter = OPTION_LETTERS[oIdx] ?? String(oIdx + 1);
                            const isAiUpdatedOption = Boolean(
                              aiOverride && opt.id === aiOverride.aiOptionId && opt.isCorrect
                            );
                            const isTeacherPrevOption = Boolean(
                              aiOverride && opt.id === aiOverride.previousOptionId && !opt.isCorrect
                            );

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleSelectCorrectOptionDirect(item.id, opt.id)}
                                title={
                                  isTeacherPrevOption
                                    ? 'Bấm để chọn lại đáp án trước đó của bạn'
                                    : 'Bấm để chọn đây là đáp án đúng'
                                }
                                className={`flex items-start gap-2 rounded-lg px-4 py-2 text-left text-xs transition-colors ${
                                  isAiUpdatedOption
                                    ? 'border-2 border-status-successBorder bg-status-successBg font-semibold text-status-successText'
                                    : opt.isCorrect
                                      ? 'border border-status-successBorder bg-status-successBg font-semibold text-status-successText'
                                      : isTeacherPrevOption
                                        ? 'border-2 border-brand-red bg-brand-redSoft/40 font-semibold text-brand-red hover:bg-brand-redSoft/70'
                                        : 'border border-line bg-surface-card font-normal text-ink-secondary hover:border-brand-navy hover:bg-brand-navySoft/40 hover:text-ink-primary'
                                }`}
                              >
                                <span className="font-bold">{letter}.</span>
                                <span className="flex-1">{opt.text || '(Trống)'}</span>
                                {isTeacherPrevOption && (
                                  <span className="shrink-0 rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-semibold text-white">
                                    Câu trả lời của bạn
                                  </span>
                                )}
                                {isAiUpdatedOption && (
                                  <span className="shrink-0 rounded-full bg-status-successText/15 px-2 py-0.5 text-[11px] font-semibold text-status-successText">
                                    AI gợi ý
                                  </span>
                                )}
                                {opt.isCorrect && (
                                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {aiOverride && (
                          <div className="mt-3 flex flex-col justify-between gap-2 rounded-lg border border-status-successBorder bg-status-successBg/50 px-3 py-2 text-xs text-ink-primary sm:flex-row sm:items-center">
                            <div className="flex items-start gap-2">
                              <Wand2
                                className="mt-0.5 h-4 w-4 shrink-0 text-status-successText"
                                aria-hidden="true"
                              />
                              <p className="font-normal">
                                AI đã gợi ý bạn chọn đáp án này, nếu bạn thấy câu trả lời của tôi
                                chưa đúng bạn có thể tích lại đáp án của bạn.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectCorrectOptionDirect(item.id, aiOverride.previousOptionId)
                              }
                              className="shrink-0 self-start rounded-lg border border-brand-red bg-surface-card px-2.5 py-1 text-xs font-semibold text-brand-red transition-colors hover:bg-brand-redSoft sm:self-center"
                            >
                              Chọn lại đáp án của bạn
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}

              {questions.length > 0 && (
                <div className="mt-6 flex flex-col justify-between gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
                  <div className="text-xs text-ink-secondary">
                    {bankValidation.invalidCount > 0 ? (
                      <span className="font-semibold text-status-warningText">
                        Đang có {bankValidation.validCount} câu hợp lệ ({bankValidation.invalidCount}{' '}
                        câu chưa chọn đáp án đúng sẽ không đưa vào đề trộn).
                      </span>
                    ) : (
                      <span className="font-semibold text-status-successText">
                        Toàn bộ {bankValidation.validCount} câu hỏi đều đã hợp lệ và sẵn sàng trộn đề.
                      </span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    disabled={bankValidation.validCount === 0}
                    onClick={() => handleGoToStep('config')}
                  >
                    <span>Tiếp tục Bước 2: Cấu hình & Trộn đề</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}

        {/* BƯỚC 2: CẤU HÌNH ĐẦU ĐỀ & TRỘN ĐỀ */}
        {step === 'config' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6 lg:col-span-2">
              <h2 className="text-lg font-bold text-brand-navy">Thông tin đầu đề thi</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Tên trường / Đơn vị"
                  value={metadata.schoolName}
                  onChange={(e) => setMetadata((m) => ({ ...m, schoolName: e.target.value }))}
                  placeholder="TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI"
                />
                <Input
                  label="Khoa / Bộ môn"
                  value={metadata.department}
                  onChange={(e) => setMetadata((m) => ({ ...m, department: e.target.value }))}
                  placeholder="KHOA CÔNG NGHỆ THÔNG TIN"
                />
                <Input
                  label="Tiêu đề kỳ thi"
                  value={metadata.examTitle}
                  onChange={(e) => setMetadata((m) => ({ ...m, examTitle: e.target.value }))}
                  placeholder="ĐỀ THI KẾT THÚC HỌC PHẦN"
                />
                <Input
                  label="Môn học / Học phần"
                  value={metadata.subject}
                  onChange={(e) => setMetadata((m) => ({ ...m, subject: e.target.value }))}
                  placeholder="VD: Tin học cơ sở, Tiếng Anh 1..."
                />
                <Input
                  label="Thời gian làm bài (phút)"
                  type="number"
                  min={5}
                  max={240}
                  value={String(metadata.durationMinutes)}
                  onChange={(e) =>
                    setMetadata((m) => ({
                      ...m,
                      durationMinutes: Math.max(1, Number(e.target.value) || 45),
                    }))
                  }
                />
                <Input
                  label="Học kỳ / Năm học"
                  value={metadata.semester}
                  onChange={(e) => setMetadata((m) => ({ ...m, semester: e.target.value }))}
                  placeholder="Học kỳ I - Năm học 2026 - 2027"
                />
              </div>

              <Input
                label="Ghi chú cho thí sinh"
                value={metadata.notes}
                onChange={(e) => setMetadata((m) => ({ ...m, notes: e.target.value }))}
                placeholder="VD: Thí sinh không được sử dụng tài liệu."
              />
            </section>

            <section className="flex flex-col justify-between gap-6 rounded-xl border border-line bg-surface-card p-6">
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-bold text-brand-navy">Thiết lập trộn đề</h2>

                <div>
                  <span className="mb-2 block text-xs font-semibold text-ink-secondary">
                    Chọn nhanh số mã đề
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[2, 4, 6, 8].map((count) => (
                      <Button
                        key={count}
                        size="sm"
                        variant={parsedCodes.length === count ? 'navy' : 'secondary'}
                        onClick={() =>
                          setExamCodesRaw(buildSequentialExamCodes(count, 101).join(', '))
                        }
                      >
                        {count} mã đề
                      </Button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Danh sách mã đề"
                  value={examCodesRaw}
                  onChange={(e) => setExamCodesRaw(e.target.value)}
                  placeholder="101, 102, 103, 104"
                  hint={`Sẽ tạo ${parsedCodes.length} mã đề: ${parsedCodes.join(', ')}`}
                />

                <Input
                  label={`Số câu mỗi đề (tối đa ${bankValidation.validCount})`}
                  type="number"
                  min={1}
                  max={Math.max(1, bankValidation.validCount)}
                  value={questionCountRaw}
                  onChange={(e) => setQuestionCountRaw(e.target.value)}
                  placeholder={`Mặc định toàn bộ (${bankValidation.validCount} câu)`}
                  hint="Để trống để lấy toàn bộ câu hỏi hợp lệ, hoặc nhập số nhỏ hơn để rút ngẫu nhiên."
                />

                <div className="flex flex-col gap-3 rounded-lg bg-surface-page p-4">
                  <label className="flex cursor-pointer items-center gap-3 text-sm font-normal text-ink-primary">
                    <input
                      id="opt-shuffle-questions"
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="h-4 w-4 rounded border-line-strong text-brand-navy focus:ring-brand-navy"
                    />
                    <span>Đảo thứ tự câu hỏi giữa các mã đề</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-3 text-sm font-normal text-ink-primary">
                    <input
                      id="opt-shuffle-options"
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="h-4 w-4 rounded border-line-strong text-brand-navy focus:ring-brand-navy"
                    />
                    <span>Đảo thứ tự các phương án A / B / C / D</span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 text-sm font-normal text-ink-primary">
                    <input
                      id="opt-keep-compound"
                      type="checkbox"
                      checked={keepCompoundOptionAtEnd}
                      onChange={(e) => setKeepCompoundOptionAtEnd(e.target.checked)}
                      disabled={!shuffleOptions}
                      className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand-navy focus:ring-brand-navy disabled:opacity-50"
                    />
                    <span>
                      Giữ nguyên phương án tổng hợp ở cuối (&ldquo;Tất cả đều đúng&rdquo;,
                      &ldquo;Cả A và B&rdquo;...)
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-line pt-4">
                {bankValidation.validCount === 0 && (
                  <p className="text-xs font-semibold text-status-dangerText">
                    Bạn chưa có câu hỏi hợp lệ nào. Hãy quay lại Bước 1 để nhập câu hỏi.
                  </p>
                )}
                <Button
                  variant="primary"
                  loading={mixing}
                  disabled={bankValidation.validCount === 0}
                  onClick={() => handleRunMix(variants.length > 0)}
                  className="w-full py-3"
                >
                  <Shuffle className="h-5 w-5" aria-hidden="true" />
                  <span>
                    {variants.length > 0
                      ? `Cập nhật & Trộn lại ${parsedCodes.length} mã đề`
                      : `Trộn ${parsedCodes.length} mã đề & Sang Bước 3`}
                  </span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleGoToStep('bank')}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Quay lại Bước 1: Ngân hàng câu hỏi</span>
                </Button>
              </div>
            </section>
          </div>
        )}

        {/* BƯỚC 3: XEM TRƯỚC & XUẤT FILE */}
        {step === 'result' && (
          <div className="flex flex-col gap-6">
            {variants.length === 0 ? (
              <EmptyState
                icon={Shuffle}
                title="Chưa có mã đề nào được trộn"
                description="Hãy hoàn tất cấu hình ở Bước 2 và nhấn 'Trộn đề ngay' để tạo bộ đề và bảng đáp án."
                action={
                  <Button variant="primary" onClick={() => setStep('config')}>
                    Đi tới Cấu hình & Trộn đề
                  </Button>
                }
              />
            ) : (
              <>
                {needsRemix && (
                  <div className="flex flex-col justify-between gap-3 rounded-xl border border-status-warningBorder bg-status-warningBg px-4 py-3 text-sm text-status-warningText sm:flex-row sm:items-center">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <div>
                        <p className="font-semibold">
                          Ngân hàng câu hỏi hoặc cấu hình trộn ở Bước 1–2 đã thay đổi
                        </p>
                        <p className="text-xs font-normal">
                          Các thay đổi về nội dung/đáp án và đầu đề đã tự đồng bộ; hãy trộn lại để
                          cập nhật danh sách câu mới thêm/xóa, số mã đề hoặc thứ tự đảo (vẫn giữ
                          nguyên bố cục A4 đã thiết kế).
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={mixing}
                      onClick={() => handleRunMix(true)}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      <span>Cập nhật & Trộn lại ngay</span>
                    </Button>
                  </div>
                )}

                {/* Thanh công cụ xuất file */}
                <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        onClick={() => {
                          downloadExamsAsWord(metadata, variants, {
                            showAnswersInExam: false,
                            includeAnswerKeyPage: includeAnswerKeyInWord,
                            theme: paperTheme,
                          });
                          toast.success(`Đã tải file Word gồm ${variants.length} mã đề`);
                        }}
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span>Tải Word tất cả ({variants.length} mã đề)</span>
                      </Button>

                      <Button
                        variant="navy"
                        onClick={() => {
                          exportAnswerKeysToExcel(metadata, variants);
                          toast.success('Đã xuất file Excel bảng đáp án tổng hợp');
                        }}
                      >
                        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                        <span>Xuất Excel bảng đáp án</span>
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() =>
                          handlePrintVariants(
                            resultView === 'matrix'
                              ? variants
                              : activeVariant
                                ? [activeVariant]
                                : variants,
                            resultView === 'matrix'
                          )
                        }
                      >
                        <Printer className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                        <span>
                          {resultView === 'matrix'
                            ? 'In bảng đáp án'
                            : `In / Lưu PDF mã ${activeVariant?.code ?? ''}`}
                        </span>
                      </Button>

                      <Button variant="secondary" onClick={() => handleRunMix(true)}>
                        <RefreshCw className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                        <span>Trộn lại mã mới</span>
                      </Button>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-secondary">
                      <input
                        id="opt-include-key-word"
                        type="checkbox"
                        checked={includeAnswerKeyInWord}
                        onChange={(e) => setIncludeAnswerKeyInWord(e.target.checked)}
                        className="h-4 w-4 rounded border-line-strong text-brand-navy focus:ring-brand-navy"
                      />
                      <span>Kèm bảng đáp án ở cuối file Word</span>
                    </label>
                  </div>

                  {/* Chuyển chế độ xem */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setResultView('exam')}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                          resultView === 'exam'
                            ? 'bg-brand-navy text-white'
                            : 'bg-surface-page text-ink-secondary hover:text-ink-primary'
                        }`}
                      >
                        Xem từng mã đề
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultView('matrix')}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                          resultView === 'matrix'
                            ? 'bg-brand-navy text-white'
                            : 'bg-surface-page text-ink-secondary hover:text-ink-primary'
                        }`}
                      >
                        Bảng đáp án tổng hợp
                      </button>
                    </div>

                    {resultView === 'exam' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowAnswersPreview((v) => !v)}
                      >
                        {showAnswersPreview ? (
                          <EyeOff className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                        )}
                        <span>
                          {showAnswersPreview ? 'Ẩn đáp án đúng' : 'Hiện đáp án đúng'}
                        </span>
                      </Button>
                    )}
                  </div>
                </section>

                {resultView === 'exam' && activeVariant ? (
                  <section className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {variants.map((v) => (
                          <button
                            key={v.code}
                            type="button"
                            onClick={() => setSelectedCode(v.code)}
                            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                              activeVariant.code === v.code
                                ? 'border-brand-red bg-brand-red text-white'
                                : 'border-line bg-surface-card text-ink-primary hover:border-brand-navy'
                            }`}
                          >
                            Mã đề {v.code}
                          </button>
                        ))}
                      </div>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          downloadExamsAsWord(metadata, [activeVariant], {
                            showAnswersInExam: false,
                            includeAnswerKeyPage: false,
                            theme: paperTheme,
                          });
                          toast.success(`Đã tải file Word riêng Mã đề ${activeVariant.code}`);
                        }}
                      >
                        <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                        <span>Tải Word riêng Mã {activeVariant.code}</span>
                      </Button>
                    </div>

                    {/* Trình thiết kế tờ đề trực quan (kéo thả, sửa trực tiếp, định dạng chữ) */}
                    <ExamPaperEditor
                      variant={activeVariant}
                      metadata={metadata}
                      paperTheme={paperTheme}
                      showAnswersPreview={showAnswersPreview}
                      totalVariantsCount={variants.length}
                      canUndo={variantsHistory.past.length > 0}
                      canRedo={variantsHistory.future.length > 0}
                      onUndo={handleUndoVariants}
                      onRedo={handleRedoVariants}
                      onUpdateVariant={handleUpdateVariant}
                      onUpdatePaperTheme={(patch) =>
                        setPaperTheme((prev) => ({ ...prev, ...patch }))
                      }
                      onInsertMixedQuestionsAt={handleInsertMixedQuestionsAt}
                      onApplySampleStructure={handleApplySampleStructure}
                      onClearToBlankSheet={handleClearToBlankSheet}
                    />
                  </section>
                ) : (
                  <section className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-brand-navy">
                        Bảng đáp án tổng hợp ({variants.length} mã đề • {matrixRows.length} câu)
                      </h2>
                      {matrixRows.length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            downloadExamsAsWord(metadata, variants, {
                              answerKeyOnly: true,
                              theme: paperTheme,
                            });
                            toast.success('Đã tải file Word bảng đáp án tổng hợp');
                          }}
                        >
                          <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                          <span>Tải Word bảng đáp án</span>
                        </Button>
                      )}
                    </div>
                    {matrixRows.length === 0 ? (
                      <EmptyState
                        icon={ListChecks}
                        title="Tờ đề hiện chưa có câu hỏi nào"
                        description="Bảng đáp án luôn đồng bộ trực tiếp theo các câu hỏi đang có trên tờ đề A4. Hãy kéo 'Toàn bộ câu hỏi đã trộn' vào tờ đề hoặc bấm 'Cấu trúc đề thi mẫu'."
                        action={
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button
                              variant="primary"
                              onClick={() => {
                                handleApplySampleStructure();
                                setResultView('matrix');
                              }}
                            >
                              Áp dụng Cấu trúc đề thi mẫu
                            </Button>
                            <Button variant="secondary" onClick={() => setResultView('exam')}>
                              Quay lại thiết kế tờ đề
                            </Button>
                          </div>
                        }
                      />
                    ) : (
                      <Table
                        columns={matrixColumns}
                        data={matrixRows}
                        rowKey={(row) => String(row.questionNumber)}
                        caption="Bảng đáp án tổng hợp các mã đề"
                      />
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal thêm / sửa câu hỏi */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSaveQuestionModal}>
              {editingId ? 'Lưu câu hỏi' : 'Thêm vào ngân hàng'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="edit-question-prompt"
              className="mb-2 block text-sm font-semibold text-ink-primary"
            >
              Nội dung câu hỏi <span className="text-brand-red">*</span>
            </label>
            <textarea
              id="edit-question-prompt"
              rows={3}
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="Nhập đề bài câu hỏi..."
              className="w-full rounded-lg border border-line-strong bg-surface-card p-3 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-primary">
                Các phương án (chọn chấm tròn để đánh dấu đáp án đúng)
              </span>
              {editOptions.length < OPTION_LETTERS.length && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setEditOptions((prev) => [
                      ...prev,
                      { id: createExamId('opt'), text: '', isCorrect: false },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Thêm phương án</span>
                </Button>
              )}
            </div>

            {editOptions.map((opt, idx) => {
              const letter = OPTION_LETTERS[idx] ?? String(idx + 1);
              return (
                <div key={opt.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option-radio"
                    checked={opt.isCorrect}
                    onChange={() =>
                      setEditOptions((prev) =>
                        prev.map((o, i) => ({ ...o, isCorrect: i === idx }))
                      )
                    }
                    aria-label={`Chọn đáp án ${letter} là đáp án đúng`}
                    className="h-4 w-4 shrink-0 text-brand-red focus:ring-brand-red"
                  />
                  <span className="w-6 shrink-0 text-sm font-bold text-brand-navy">{letter}.</span>
                  <input
                    id={`edit-opt-${opt.id}`}
                    type="text"
                    value={opt.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditOptions((prev) =>
                        prev.map((o, i) => (i === idx ? { ...o, text: val } : o))
                      );
                    }}
                    placeholder={`Nội dung đáp án ${letter}...`}
                    aria-label={`Nội dung đáp án ${letter}`}
                    className="h-10 flex-1 rounded-lg border border-line-strong bg-surface-card px-3 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  />
                  {editOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditOptions((prev) => {
                          const next = prev.filter((_, i) => i !== idx);
                          if (next.length > 0 && !next.some((o) => o.isCorrect)) {
                            next[0] = { ...next[0], isCorrect: true };
                          }
                          return next;
                        })
                      }
                      aria-label={`Xóa phương án ${letter}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-brand-red hover:bg-brand-redSoft"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Nhóm / Chương (tùy chọn)"
              value={editGroup}
              onChange={(e) => setEditGroup(e.target.value)}
              placeholder="VD: Chương 1, Nhận biết..."
            />
            <Input
              label="Giải thích đáp án (tùy chọn)"
              value={editExplanation}
              onChange={(e) => setEditExplanation(e.target.value)}
              placeholder="Ghi chú ngắn cho giáo viên..."
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteQuestion}
        confirmVariant="danger"
        confirmLabel="Xóa câu hỏi"
        title="Xác nhận xóa câu hỏi"
        message={
          deleteTarget
            ? `Bạn chắc chắn muốn xóa câu hỏi "${deleteTarget.prompt.slice(0, 80)}${
                deleteTarget.prompt.length > 80 ? '...' : ''
              }" khỏi ngân hàng?`
            : ''
        }
      />

      <ConfirmDialog
        open={clearAllOpen}
        onClose={() => setClearAllOpen(false)}
        onConfirm={handleConfirmClearAll}
        confirmVariant="danger"
        confirmLabel="Xóa toàn bộ"
        title="Xác nhận xóa toàn bộ ngân hàng câu hỏi"
        message={`Bạn chắc chắn muốn xóa toàn bộ ${questions.length} câu hỏi và các mã đề đã trộn? Thao tác này không thể hoàn tác.`}
      />
    </Layout>
  );
}

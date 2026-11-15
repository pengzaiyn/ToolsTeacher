import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  GraduationCap,
  Layers,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Pause,
  Play,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Star,
  Timer,
  Trophy,
  UserX,
  Users,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import {
  DEFAULT_HOPE_STAR_ODDS,
  DEFAULT_UNO_ODDS,
  HOPE_STAR_CARDS,
  OUTCOME_META,
  UNO_CARDS,
  canActivateHopeStar,
  exportRecitationToExcel,
  formatCountdown,
  generateHopeStarDeck,
  generateUnoDeck,
  getTotalQuestionCount,
  hasHopeStarBonus,
  parseQuestionLines,
  pickRandomStudent,
  playCardFlip,
  playRevealFanfare,
  playTimerBeep,
  playUnoEffectSound,
  playWheelTick,
  shuffleList,
  unlockClassroomAudio,
  type HopeStarOddsConfig,
  type KitStudent,
  type RecitationOutcome,
  type RecitationRecord,
  type UnoCardKind,
  type UnoOddsConfig,
} from '@/lib/classroomKit';
import {
  MysteryCardsStage,
  SpinWheelStage,
} from '@/components/classroom-kit/RecitationGameStages';
import { RecitationQuestionBox } from '@/components/classroom-kit/RecitationQuestionBox';
import { RecitationResultModal } from '@/components/classroom-kit/RecitationResultModal';
import { HopeStarCardBoard, UnoSixCardBoard } from '@/components/classroom-kit/UnoCardVisual';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

interface RandomPickerTabProps {
  students: KitStudent[];
  sourceLabel: string;
  sourceSignature: string;
}

const TIMER_OPTIONS = [
  { value: 0, label: 'Không giờ' },
  { value: 30, label: '30 giây' },
  { value: 60, label: '60 giây' },
  { value: 90, label: '90 giây' },
];

function buildWheelSlots(available: readonly KitStudent[], _winner?: KitStudent): KitStudent[] {
  return [...available];
}

function formatTimeNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function RandomPickerTab({
  students,
  sourceLabel,
  sourceSignature,
}: RandomPickerTabProps) {
  const toast = useToast();

  const [gameMode, setGameMode] = useState<'wheel' | 'cards'>('wheel');
  const [noRepeat, setNoRepeat] = useState(true);
  const [enableUno, setEnableUno] = useState(true);
  const [unoOdds, setUnoOdds] = useState<UnoOddsConfig>(DEFAULT_UNO_ODDS);
  const [hopeStarOdds, setHopeStarOdds] = useState<HopeStarOddsConfig>(DEFAULT_HOPE_STAR_ODDS);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [quickTimerSec, setQuickTimerSec] = useState(60);
  const [projectorOpen, setProjectorOpen] = useState(false);

  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [questionsText, setQuestionsText] = useState('');

  const [records, setRecords] = useState<RecitationRecord[]>([]);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const recordsRef = useRef<RecitationRecord[]>(records);
  recordsRef.current = records;

  // State cho Vòng quay SVG
  const [wheelSlots, setWheelSlots] = useState<KitStudent[]>([]);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotationRef = useRef(0);
  const wheelFrameRef = useRef<number | null>(null);

  // State cho Lật thẻ bí ẩn
  const [cardDeck, setCardDeck] = useState<KitStudent[]>([]);
  const [highlightedCardIdx, setHighlightedCardIdx] = useState<number | null>(null);
  const [drawingCard, setDrawingCard] = useState(false);
  const [shufflingCards, setShufflingCards] = useState(false);
  const cardIntervalRef = useRef<number | null>(null);
  const cardTimeoutRef = useRef<number | null>(null);
  const shuffleTimersRef = useRef<number[]>([]);

  // State cho bàn rút 6 lá UNO & Ngôi sao hy vọng
  const [scanningUnoIdx, setScanningUnoIdx] = useState<number | null>(null);
  const [pickingUno, setPickingUno] = useState(false);
  const [scanningHopeStarIdx, setScanningHopeStarIdx] = useState<number | null>(null);
  const [pickingHopeStar, setPickingHopeStar] = useState(false);
  const [noticeState, setNoticeState] = useState<{
    recordId: string;
    type: 'uno' | 'hope-star';
  } | null>(null);
  const unoIntervalRef = useRef<number | null>(null);
  const unoTimeoutRef = useRef<number | null>(null);
  const unoNoticeTimeoutRef = useRef<number | null>(null);

  // Đồng hồ đếm ngược cho sinh viên đang lên trả bài
  const [answerLeftSec, setAnswerLeftSec] = useState(60);
  const [answerTimerRunning, setAnswerTimerRunning] = useState(false);
  const answerEndMsRef = useRef<number | null>(null);

  const usedQuestionIndicesRef = useRef<Set<number>>(new Set());
  const quickTimerSecRef = useRef(quickTimerSec);
  quickTimerSecRef.current = quickTimerSec;

  const clearCardScanTimers = useCallback(() => {
    if (unoIntervalRef.current !== null) {
      window.clearInterval(unoIntervalRef.current);
      unoIntervalRef.current = null;
    }
    if (unoTimeoutRef.current !== null) {
      window.clearTimeout(unoTimeoutRef.current);
      unoTimeoutRef.current = null;
    }
    if (unoNoticeTimeoutRef.current !== null) {
      window.clearTimeout(unoNoticeTimeoutRef.current);
      unoNoticeTimeoutRef.current = null;
    }
  }, []);

  const clearAllAnimations = useCallback(() => {
    if (wheelFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
    }
    if (cardIntervalRef.current !== null) {
      window.clearInterval(cardIntervalRef.current);
      cardIntervalRef.current = null;
    }
    if (cardTimeoutRef.current !== null) {
      window.clearTimeout(cardTimeoutRef.current);
      cardTimeoutRef.current = null;
    }
    clearCardScanTimers();
    shuffleTimersRef.current.forEach((id) => window.clearTimeout(id));
    shuffleTimersRef.current = [];
  }, [clearCardScanTimers]);

  useEffect(() => clearAllAnimations, [clearAllAnimations]);

  useEffect(() => {
    if (!projectorOpen || noticeState) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjectorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [projectorOpen, noticeState]);

  // Khởi tạo lại phiên khi đổi danh sách lớp/sinh viên
  useEffect(() => {
    clearAllAnimations();
    setSpinning(false);
    setDrawingCard(false);
    setShufflingCards(false);
    setPickingUno(false);
    setScanningUnoIdx(null);
    setPickingHopeStar(false);
    setScanningHopeStarIdx(null);
    setNoticeState(null);
    setHighlightedCardIdx(null);
    setRecords([]);
    setActiveRecordId(null);
    setWheelSlots(buildWheelSlots(students));
    setCardDeck(shuffleList(students).slice(0, 16));
    setAnswerTimerRunning(false);
    answerEndMsRef.current = null;
    setAnswerLeftSec(quickTimerSecRef.current);
    usedQuestionIndicesRef.current = new Set();
  }, [sourceSignature, students, clearAllAnimations]);

  // Đồng hồ trả bài tại bảng
  useEffect(() => {
    if (!answerTimerRunning) return;
    if (answerEndMsRef.current === null) {
      answerEndMsRef.current = Date.now() + answerLeftSec * 1000;
    }

    const timerId = window.setInterval(() => {
      if (answerEndMsRef.current === null) return;
      const next = Math.max(0, Math.ceil((answerEndMsRef.current - Date.now()) / 1000));
      setAnswerLeftSec(next);
      if (next === 0) {
        answerEndMsRef.current = null;
        setAnswerTimerRunning(false);
        if (soundEnabled) playTimerBeep();
        toast.info('Hết thời gian trả bài');
      }
    }, 200);

    return () => window.clearInterval(timerId);
  }, [answerTimerRunning, answerLeftSec, soundEnabled, toast]);

  const absentStudentIds = useMemo(
    () => new Set(records.filter((r) => r.outcome === 'absent').map((r) => r.student.id)),
    [records]
  );

  const calledIdSet = useMemo(() => new Set(records.map((r) => r.student.id)), [records]);

  // Loại ngay các sinh viên đã đánh dấu Vắng khỏi phần chọn random trong phiên hiện tại
  const eligibleStudents = useMemo(
    () => students.filter((s) => !absentStudentIds.has(s.id)),
    [students, absentStudentIds]
  );

  const availableStudents = useMemo(() => {
    if (!noRepeat) return eligibleStudents;
    return eligibleStudents.filter((s) => !calledIdSet.has(s.id));
  }, [eligibleStudents, noRepeat, calledIdSet]);

  const questionList = useMemo(() => parseQuestionLines(questionsText), [questionsText]);

  const activeRecord = useMemo(
    () => records.find((r) => r.id === activeRecordId) ?? null,
    [records, activeRecordId]
  );

  // Mỗi lượt chỉ chọn 1 sinh viên: khóa chọn thêm SV mới khi đang còn lượt chưa hoàn tất
  const pendingTurnRecord = useMemo(
    () => records.find((r) => r.outcome === 'pending') ?? null,
    [records]
  );

  const cardsAvailableInDeck = useMemo(() => {
    const presentOnDesk = cardDeck.filter((s) => !absentStudentIds.has(s.id));
    if (!noRepeat) return presentOnDesk;
    return presentOnDesk.filter(
      (s) => s.id === pendingTurnRecord?.student.id || !calledIdSet.has(s.id)
    );
  }, [cardDeck, absentStudentIds, noRepeat, pendingTurnRecord, calledIdSet]);

  // Tự chia lượt thẻ mới khi bàn hiện tại không còn thẻ nào nhưng vẫn còn SV hợp lệ
  useEffect(() => {
    if (pendingTurnRecord || drawingCard || shufflingCards) return;
    if (cardsAvailableInDeck.length === 0 && availableStudents.length > 0) {
      setCardDeck(shuffleList(availableStudents).slice(0, 16));
    }
  }, [
    pendingTurnRecord,
    drawingCard,
    shufflingCards,
    cardsAvailableInDeck.length,
    availableStudents,
  ]);

  const stats = useMemo(() => {
    let bonus = 0;
    let passed = 0;
    let failed = 0;
    let absent = 0;
    let skipped = 0;
    let reversed = 0;
    let hopeStarWon = 0;
    records.forEach((r) => {
      if (r.outcome === 'bonus') bonus += 1;
      else if (r.outcome === 'passed') passed += 1;
      else if (r.outcome === 'failed') failed += 1;
      else if (r.outcome === 'absent') absent += 1;
      else if (r.outcome === 'skipped') skipped += 1;
      else if (r.outcome === 'reversed') reversed += 1;
      if (hasHopeStarBonus(r)) hopeStarWon += 1;
    });
    return { bonus, passed, failed, absent, skipped, reversed, hopeStarWon };
  }, [records]);

  function drawQuestions(count: number, excludedTexts: ReadonlySet<string> = new Set()): string[] {
    if (questionList.length === 0 || count <= 0) return [];
    const picked: string[] = [];
    const chosenTexts = new Set(excludedTexts);

    for (let i = 0; i < count; i++) {
      const eligible = questionList
        .map((q, idx) => ({ q, idx }))
        .filter((item) => !chosenTexts.has(item.q));
      if (eligible.length === 0) break;

      let pool = eligible.filter((item) => !usedQuestionIndicesRef.current.has(item.idx));
      if (pool.length === 0) {
        usedQuestionIndicesRef.current = new Set();
        pool = eligible;
      }

      const chosen = pool[Math.floor(Math.random() * pool.length)];
      if (!chosen) break;
      usedQuestionIndicesRef.current.add(chosen.idx);
      chosenTexts.add(chosen.q);
      picked.push(chosen.q);
    }
    return picked;
  }

  function finalizeSelection(chosen: KitStudent) {
    const newRecord: RecitationRecord = {
      id: `${chosen.id}-${Date.now()}`,
      student: chosen,
      outcome: 'pending',
      unoKind: null,
      unoDeck: enableUno ? generateUnoDeck(unoOdds, 6, Date.now()) : null,
      pickedSlotIndex: null,
      hopeStarStatus: 'none',
      hopeStarKind: null,
      hopeStarDeck: null,
      hopeStarPickedSlotIndex: null,
      baseQuestionCount: enableUno ? 0 : 1,
      questions: enableUno ? [] : drawQuestions(1),
      extraQuestionCount: 0,
      pickedAt: formatTimeNow(),
    };
    setRecords((prev) => [newRecord, ...prev]);
    setActiveRecordId(newRecord.id);
    setNoticeState(null);
    setPickingUno(false);
    setScanningUnoIdx(null);
    setPickingHopeStar(false);
    setScanningHopeStarIdx(null);
    answerEndMsRef.current = null;
    setAnswerTimerRunning(false);
    setAnswerLeftSec(quickTimerSec);
    if (soundEnabled) playRevealFanfare();
  }

  function scheduleNoticeModal(recordId: string, type: 'uno' | 'hope-star') {
    if (unoNoticeTimeoutRef.current !== null) {
      window.clearTimeout(unoNoticeTimeoutRef.current);
    }
    unoNoticeTimeoutRef.current = window.setTimeout(() => {
      unoNoticeTimeoutRef.current = null;
      setNoticeState({ recordId, type });
    }, 900);
  }

  function runSixCardAutoPick(
    deckLen: number,
    setScanningIdx: (idx: number | null) => void,
    setPicking: (busy: boolean) => void,
    onPicked: (chosenSlot: number) => void
  ) {
    clearCardScanTimers();
    const chosenSlot = Math.floor(Math.random() * deckLen);
    setPicking(true);
    let step = 0;

    unoIntervalRef.current = window.setInterval(() => {
      setScanningIdx(step % deckLen);
      if (soundEnabled) playWheelTick();
      step += 1;
    }, 75);

    unoTimeoutRef.current = window.setTimeout(() => {
      if (unoIntervalRef.current !== null) {
        window.clearInterval(unoIntervalRef.current);
        unoIntervalRef.current = null;
      }
      unoTimeoutRef.current = null;
      setScanningIdx(null);
      setPicking(false);
      onPicked(chosenSlot);
    }, 640);
  }

  function applyUnoSlotSelection(recordId: string, slotIndex: number, forcedKind?: UnoCardKind) {
    const target = recordsRef.current.find((r) => r.id === recordId);
    if (!target || !target.unoDeck || target.pickedSlotIndex !== null) return;
    const slot = target.unoDeck[slotIndex];
    if (!slot) return;

    const kind = forcedKind ?? slot.kind;
    if (soundEnabled) {
      playCardFlip();
      playUnoEffectSound(kind);
    }

    const nextQuestions =
      kind === 'skip'
        ? []
        : kind === 'plus2'
          ? drawQuestions(3)
          : drawQuestions(1);

    const nextOutcome: RecitationOutcome =
      kind === 'skip' ? 'skipped' : kind === 'reverse' ? 'reversed' : 'pending';

    setRecords((prev) =>
      prev.map((item) =>
        item.id === recordId
          ? {
              ...item,
              unoKind: kind,
              pickedSlotIndex: slotIndex,
              baseQuestionCount: UNO_CARDS[kind].questionCount,
              questions: nextQuestions,
              extraQuestionCount: kind === 'plus2' ? 2 : 0,
              outcome: nextOutcome,
            }
          : item
      )
    );

    scheduleNoticeModal(recordId, 'uno');

    if (kind === 'skip') {
      answerEndMsRef.current = null;
      setAnswerTimerRunning(false);
    }
  }

  function handleAutoPickUnoCard(recordId: string) {
    if (pickingUno || pickingHopeStar) return;
    const target = recordsRef.current.find((r) => r.id === recordId);
    if (!target || !target.unoDeck || target.pickedSlotIndex !== null) return;

    runSixCardAutoPick(target.unoDeck.length, setScanningUnoIdx, setPickingUno, (chosenSlot) => {
      applyUnoSlotSelection(recordId, chosenSlot);
    });
  }

  function handleActivateHopeStar(recordId: string) {
    const target = recordsRef.current.find((r) => r.id === recordId);
    if (!target || !canActivateHopeStar(target)) return;

    clearCardScanTimers();
    setNoticeState(null);
    answerEndMsRef.current = null;
    setAnswerTimerRunning(false);
    setPickingHopeStar(false);
    setScanningHopeStarIdx(null);

    const nextDeck = generateHopeStarDeck(hopeStarOdds, 6, Date.now());
    setRecords((prev) =>
      prev.map((item) =>
        item.id === recordId
          ? {
              ...item,
              hopeStarStatus: 'picking',
              hopeStarDeck: nextDeck,
              hopeStarKind: null,
              hopeStarPickedSlotIndex: null,
            }
          : item
      )
    );
    if (soundEnabled) playRevealFanfare();
  }

  function handleDeclineHopeStar(recordId: string) {
    const target = recordsRef.current.find((r) => r.id === recordId);
    if (!target || !canActivateHopeStar(target)) return;
    setRecords((prev) =>
      prev.map((item) => (item.id === recordId ? { ...item, hopeStarStatus: 'declined' } : item))
    );
  }

  function handleCancelHopeStarBeforePick(recordId: string) {
    if (pickingHopeStar) return;
    const target = recordsRef.current.find((r) => r.id === recordId);
    if (!target || target.hopeStarStatus !== 'picking' || target.hopeStarPickedSlotIndex !== null) {
      return;
    }
    clearCardScanTimers();
    setScanningHopeStarIdx(null);
    setRecords((prev) =>
      prev.map((item) =>
        item.id === recordId
          ? { ...item, hopeStarStatus: 'none', hopeStarDeck: null }
          : item
      )
    );
  }

  function applyHopeStarSlotSelection(recordId: string, slotIndex: number) {
    const target = recordsRef.current.find((r) => r.id === recordId);
    if (
      !target ||
      target.hopeStarStatus !== 'picking' ||
      !target.hopeStarDeck ||
      target.hopeStarPickedSlotIndex !== null
    ) {
      return;
    }
    const slot = target.hopeStarDeck[slotIndex];
    if (!slot) return;

    const kind = slot.kind;
    if (soundEnabled) {
      playCardFlip();
      playUnoEffectSound(kind);
    }

    if (kind === 'skip') {
      answerEndMsRef.current = null;
      setAnswerTimerRunning(false);
      setRecords((prev) =>
        prev.map((item) =>
          item.id === recordId
            ? {
                ...item,
                hopeStarStatus: 'resolved',
                hopeStarKind: 'skip',
                hopeStarPickedSlotIndex: slotIndex,
                outcome: 'skipped',
                questions: [],
              }
            : item
        )
      );
    } else {
      const addedCount = HOPE_STAR_CARDS[kind].addedQuestionCount;
      const addedQuestions = drawQuestions(addedCount, new Set(target.questions));
      setRecords((prev) =>
        prev.map((item) =>
          item.id === recordId
            ? {
                ...item,
                hopeStarStatus: 'resolved',
                hopeStarKind: kind,
                hopeStarPickedSlotIndex: slotIndex,
                questions: [...item.questions, ...addedQuestions],
                extraQuestionCount: item.extraQuestionCount + addedCount,
              }
            : item
        )
      );
    }

    scheduleNoticeModal(recordId, 'hope-star');
  }

  function handleAutoPickHopeStarCard(recordId: string) {
    if (pickingUno || pickingHopeStar) return;
    const target = recordsRef.current.find((r) => r.id === recordId);
    if (
      !target ||
      target.hopeStarStatus !== 'picking' ||
      !target.hopeStarDeck ||
      target.hopeStarPickedSlotIndex !== null
    ) {
      return;
    }

    runSixCardAutoPick(
      target.hopeStarDeck.length,
      setScanningHopeStarIdx,
      setPickingHopeStar,
      (chosenSlot) => {
        applyHopeStarSlotSelection(recordId, chosenSlot);
      }
    );
  }

  function handleChangeUnoOdds(nextOdds: UnoOddsConfig) {
    setUnoOdds(nextOdds);
    if (activeRecord && activeRecord.unoDeck && activeRecord.pickedSlotIndex === null) {
      const updatedDeck = generateUnoDeck(nextOdds, 6, Date.now());
      setRecords((prev) =>
        prev.map((item) => (item.id === activeRecord.id ? { ...item, unoDeck: updatedDeck } : item))
      );
    }
  }

  function handleChangeHopeStarOdds(nextOdds: HopeStarOddsConfig) {
    setHopeStarOdds(nextOdds);
    if (
      activeRecord &&
      activeRecord.hopeStarStatus === 'picking' &&
      activeRecord.hopeStarDeck &&
      activeRecord.hopeStarPickedSlotIndex === null
    ) {
      const updatedDeck = generateHopeStarDeck(nextOdds, 6, Date.now());
      setRecords((prev) =>
        prev.map((item) =>
          item.id === activeRecord.id ? { ...item, hopeStarDeck: updatedDeck } : item
        )
      );
    }
  }

  function handlePickNextStudent() {
    if (pendingTurnRecord) {
      toast.info(
        `Vui lòng hoàn tất lượt trả bài của ${pendingTurnRecord.student.name} trước khi chọn sinh viên khác.`
      );
      return;
    }
    if (availableStudents.length === 0) {
      toast.info('Tất cả sinh viên đã được gọi trong phiên này');
      return;
    }
    if (gameMode === 'wheel') {
      handleSpinWheel();
    } else {
      handleAutoPickCard();
    }
  }

  function handleResetSession() {
    clearAllAnimations();
    setSpinning(false);
    setDrawingCard(false);
    setShufflingCards(false);
    setPickingUno(false);
    setScanningUnoIdx(null);
    setPickingHopeStar(false);
    setScanningHopeStarIdx(null);
    setNoticeState(null);
    setHighlightedCardIdx(null);
    setRecords([]);
    setActiveRecordId(null);
    setWheelSlots(buildWheelSlots(students));
    setCardDeck(shuffleList(students).slice(0, 16));
    answerEndMsRef.current = null;
    setAnswerTimerRunning(false);
    setAnswerLeftSec(quickTimerSec);
    usedQuestionIndicesRef.current = new Set();
    toast.info('Đã làm mới phiên mini game trả bài');
  }

  function handleSpinWheel() {
    if (spinning || drawingCard || shufflingCards) return;
    if (pendingTurnRecord) {
      toast.info(
        `Vui lòng hoàn tất lượt trả bài của ${pendingTurnRecord.student.name} trước khi chọn sinh viên khác.`
      );
      return;
    }
    if (availableStudents.length === 0) {
      toast.info('Tất cả sinh viên đã lên trả bài trong phiên này');
      return;
    }

    const winner = pickRandomStudent(availableStudents, new Set<string>());
    if (!winner) return;

    clearAllAnimations();
    const slots = buildWheelSlots(availableStudents, winner);
    setWheelSlots(slots);

    const visualCount = slots.length === 1 ? 2 : slots.length;
    const targetIdx = slots.findIndex((s) => s.id === winner.id);
    const sliceAngle = 360 / visualCount;
    const centerDeg = (targetIdx + 0.5) * sliceAngle;
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.55;
    const targetAngleOnWheel = (centerDeg + jitter + 360) % 360;
    const desiredMod = (360 - targetAngleOnWheel + 360) % 360;

    const startRot = rotationRef.current;
    const currentMod = ((startRot % 360) + 360) % 360;
    const deltaToTarget = (desiredMod - currentMod + 360) % 360;
    const extraTurns = (5 + Math.floor(Math.random() * 2)) * 360;
    const finalRot = startRot + extraTurns + deltaToTarget;

    setSpinning(true);
    setActiveRecordId(null);
    setAnswerTimerRunning(false);

    const durationMs = 3400;
    const startTime = performance.now();
    let lastTickBucket = Math.floor(startRot / sliceAngle);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 4);
      const nextRot = startRot + (finalRot - startRot) * eased;

      rotationRef.current = nextRot;
      setRotationDeg(nextRot);

      const bucket = Math.floor(nextRot / sliceAngle);
      if (bucket !== lastTickBucket) {
        lastTickBucket = bucket;
        if (soundEnabled) playWheelTick();
      }

      if (t < 1) {
        wheelFrameRef.current = window.requestAnimationFrame(step);
      } else {
        wheelFrameRef.current = null;
        setSpinning(false);
        finalizeSelection(winner);
      }
    };

    wheelFrameRef.current = window.requestAnimationFrame(step);
  }

  function forceDifferentOrder(items: readonly KitStudent[]): KitStudent[] {
    if (items.length <= 1) return [...items];
    if (items.length === 2) return [items[1], items[0]];
    for (let attempt = 0; attempt < 6; attempt++) {
      const candidate = shuffleList(items);
      const changedCount = candidate.filter((s, idx) => s.id !== items[idx]?.id).length;
      if (changedCount >= 2) return candidate;
    }
    return [...items.slice(1), items[0]];
  }

  function handleReshuffleCards() {
    if (spinning || drawingCard || shufflingCards || pendingTurnRecord) return;
    if (availableStudents.length <= 1) return;

    clearAllAnimations();
    setHighlightedCardIdx(null);
    setActiveRecordId(null);
    setShufflingCards(true);

    // Nhịp 1: đảo vị trí ngay lập tức các thẻ đang hiện để thấy bay qua lại rõ ràng
    setCardDeck((prev) => {
      const visible = prev.filter(
        (s) => !absentStudentIds.has(s.id) && (!noRepeat || !calledIdSet.has(s.id))
      );
      const base = visible.length > 1 ? visible : availableStudents.slice(0, 16);
      return forceDifferentOrder(base);
    });
    if (soundEnabled) playWheelTick();

    // Nhịp 2: tráo tiếp lần 2
    const t2 = window.setTimeout(() => {
      setCardDeck((prev) => forceDifferentOrder(prev));
      if (soundEnabled) playWheelTick();
    }, 280);

    // Nhịp 3: chốt vị trí cuối cùng
    const t3 = window.setTimeout(() => {
      setCardDeck((prev) =>
        availableStudents.length > 16
          ? shuffleList(availableStudents).slice(0, 16)
          : forceDifferentOrder(prev)
      );
      if (soundEnabled) playWheelTick();
    }, 560);

    // Kết thúc animation sau khi nhịp 3 lướt xong
    const tEnd = window.setTimeout(() => {
      shuffleTimersRef.current = [];
      setShufflingCards(false);
    }, 860);

    shuffleTimersRef.current = [t2, t3, tEnd];
  }

  function handlePickCardDirect(student: KitStudent) {
    if (spinning || drawingCard || shufflingCards) return;
    if (pendingTurnRecord) {
      toast.info(
        `Vui lòng hoàn tất lượt trả bài của ${pendingTurnRecord.student.name} trước khi chọn sinh viên khác.`
      );
      return;
    }
    if (absentStudentIds.has(student.id)) return;
    if (noRepeat && calledIdSet.has(student.id)) return;
    finalizeSelection(student);
  }

  function handleAutoPickCard() {
    if (spinning || drawingCard || shufflingCards) return;
    if (pendingTurnRecord) {
      toast.info(
        `Vui lòng hoàn tất lượt trả bài của ${pendingTurnRecord.student.name} trước khi chọn sinh viên khác.`
      );
      return;
    }
    if (availableStudents.length === 0) {
      toast.info('Tất cả sinh viên đã lên trả bài trong phiên này');
      return;
    }

    clearAllAnimations();
    const freshDeck = shuffleList(availableStudents).slice(0, 16);
    setCardDeck(freshDeck);
    setActiveRecordId(null);
    setDrawingCard(true);

    const chosenIdx = Math.floor(Math.random() * freshDeck.length);
    const chosenStudent = freshDeck[chosenIdx];
    let stepCount = 0;

    cardIntervalRef.current = window.setInterval(() => {
      setHighlightedCardIdx(stepCount % freshDeck.length);
      if (soundEnabled) playWheelTick();
      stepCount += 1;
    }, 85);

    cardTimeoutRef.current = window.setTimeout(() => {
      clearAllAnimations();
      setHighlightedCardIdx(null);
      setDrawingCard(false);
      finalizeSelection(chosenStudent);
    }, 760);
  }

  function handleMarkOutcome(recordId: string, outcome: RecitationOutcome) {
    answerEndMsRef.current = null;
    setAnswerTimerRunning(false);
    if (outcome !== 'pending') {
      clearCardScanTimers();
      setPickingUno(false);
      setScanningUnoIdx(null);
      setPickingHopeStar(false);
      setScanningHopeStarIdx(null);
      setNoticeState((prev) => (prev?.recordId === recordId ? null : prev));
    }

    const target = recordsRef.current.find((r) => r.id === recordId);
    setRecords((prev) =>
      prev.map((item) => (item.id === recordId ? { ...item, outcome } : item))
    );

    if (!target) return;

    if (outcome === 'absent') {
      const absentId = target.student.id;
      const nextAvailable = availableStudents.filter((s) => s.id !== absentId);

      setWheelSlots((prev) => {
        const remainingOnWheel = prev.filter((s) => s.id !== absentId);
        if (nextAvailable.length === 0) return [];
        if (remainingOnWheel.length < Math.min(12, nextAvailable.length)) {
          return buildWheelSlots(nextAvailable);
        }
        return remainingOnWheel;
      });
      setCardDeck((prev) => prev.filter((s) => s.id !== absentId));

      if (activeRecordId === recordId) {
        setActiveRecordId(null);
      }
      toast.info(`Đã đánh dấu ${target.student.name} vắng và xóa khỏi phần chọn random`);
      return;
    }

    if (target.outcome === 'absent' && !noRepeat) {
      const restoredPool = eligibleStudents.some((s) => s.id === target.student.id)
        ? eligibleStudents
        : [...eligibleStudents, target.student];
      setWheelSlots((prev) =>
        prev.some((s) => s.id === target.student.id) ? prev : buildWheelSlots(restoredPool)
      );
      setCardDeck((prev) =>
        prev.some((s) => s.id === target.student.id) || prev.length >= 16
          ? prev
          : [...prev, target.student]
      );
    }

    toast.success(`Đã ghi nhận: ${target.student.name} — ${OUTCOME_META[outcome].label}`);
  }

  function handleStartRecitationFromNotice() {
    setNoticeState(null);
    if (quickTimerSec > 0) {
      const startSec = answerLeftSec > 0 ? answerLeftSec : quickTimerSec;
      setAnswerLeftSec(startSec);
      answerEndMsRef.current = Date.now() + startSec * 1000;
      setAnswerTimerRunning(true);
    }
  }

  function handleToggleAnswerTimer() {
    if (quickTimerSec <= 0) return;
    if (answerLeftSec <= 0) {
      answerEndMsRef.current = Date.now() + quickTimerSec * 1000;
      setAnswerLeftSec(quickTimerSec);
      setAnswerTimerRunning(true);
      return;
    }
    if (answerTimerRunning) {
      answerEndMsRef.current = null;
      setAnswerTimerRunning(false);
    } else {
      answerEndMsRef.current = Date.now() + answerLeftSec * 1000;
      setAnswerTimerRunning(true);
    }
  }

  function handleChangeQuickTimer(seconds: number) {
    setQuickTimerSec(seconds);
    answerEndMsRef.current = null;
    setAnswerTimerRunning(false);
    setAnswerLeftSec(seconds);
  }

  function handleExportRecords() {
    if (records.length === 0) return;
    exportRecitationToExcel(records, sourceLabel || 'lop-hoc');
    toast.success('Đã tải xuống file Excel kết quả trả bài');
  }

  if (students.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Chưa có sinh viên tham gia"
        description="Chọn lớp học hoặc nhập danh sách sinh viên ở phía trên để bắt đầu mini game trả bài."
      />
    );
  }

  const canStartPick =
    !spinning &&
    !drawingCard &&
    !shufflingCards &&
    !pendingTurnRecord &&
    availableStudents.length > 0;
  const turnLockedMessage = pendingTurnRecord
    ? `Đang trong lượt trả bài của ${pendingTurnRecord.student.name}. Hoàn tất lượt này để chọn sinh viên tiếp theo.`
    : null;

  function renderMainGameArea(isProjector: boolean) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={gameMode === 'wheel' ? 'navy' : 'secondary'}
              onClick={() => setGameMode('wheel')}
              disabled={spinning || drawingCard || shufflingCards}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Vòng quay Trả bài</span>
            </Button>
            <Button
              size="sm"
              variant={gameMode === 'cards' ? 'navy' : 'secondary'}
              onClick={() => setGameMode('cards')}
              disabled={spinning || drawingCard || shufflingCards}
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              <span>Lật thẻ Bí ẩn</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={availableStudents.length > 0 ? 'navy' : 'warning'}>
              Còn lại {availableStudents.length} / {eligibleStudents.length} SV
            </Badge>
            {absentStudentIds.size > 0 && (
              <Badge tone="danger">Vắng: {absentStudentIds.size}</Badge>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!soundEnabled) unlockClassroomAudio();
                setSoundEnabled((v) => !v);
              }}
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4 text-ink-muted" aria-hidden="true" />
              )}
              <span>{soundEnabled ? 'Âm: Bật' : 'Âm: Tắt'}</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setProjectorOpen((v) => !v)}>
              {isProjector ? (
                <>
                  <Minimize2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                  <span>Thu gọn</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                  <span>Chiếu lớp</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Cài đặt nhanh phiên chơi */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-page px-4 py-2">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-primary">
              <input
                type="checkbox"
                checked={noRepeat}
                onChange={(e) => setNoRepeat(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong accent-brand-navy"
              />
              <span>Không lặp lại SV</span>
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-primary">
              <input
                type="checkbox"
                checked={enableUno}
                onChange={(e) => setEnableUno(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong accent-brand-navy"
              />
              <span>Luật bài UNO (6 lá)</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={isProjector ? 'recitation-timer-proj' : 'recitation-timer'}
              className="inline-flex items-center gap-2 text-xs font-semibold text-ink-secondary"
            >
              <Timer className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              <span>Hẹn giờ:</span>
              <select
                id={isProjector ? 'recitation-timer-proj' : 'recitation-timer'}
                value={quickTimerSec}
                onChange={(e) => handleChangeQuickTimer(Number(e.target.value))}
                className="rounded-lg border border-line-strong bg-surface-card px-2 py-2 text-xs font-semibold text-ink-primary focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              >
                {TIMER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <Button
              size="sm"
              variant={questionsOpen || questionList.length > 0 ? 'navy' : 'secondary'}
              onClick={() => setQuestionsOpen((v) => !v)}
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              <span>
                Câu hỏi{questionList.length > 0 ? ` (${questionList.length})` : ''}
              </span>
            </Button>
          </div>
        </div>

        {questionsOpen && (
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-page p-4">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={isProjector ? 'recitation-questions-proj' : 'recitation-questions'}
                className="text-xs font-semibold text-ink-primary"
              >
                Danh sách câu hỏi trả bài (mỗi dòng 1 câu — tự bốc ngẫu nhiên khi chọn trúng SV)
              </label>
              <Button size="sm" variant="ghost" onClick={() => setQuestionsOpen(false)}>
                <span>Thu gọn</span>
              </Button>
            </div>
            <textarea
              id={isProjector ? 'recitation-questions-proj' : 'recitation-questions'}
              rows={2}
              value={questionsText}
              onChange={(e) => setQuestionsText(e.target.value)}
              placeholder="Nhập câu hỏi theo từng dòng (tùy chọn)..."
              className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* Sân khấu Vòng quay hoặc Thẻ bí ẩn */}
          <div className="flex flex-col justify-center rounded-xl border border-line bg-surface-page p-4 sm:p-6">
            {gameMode === 'wheel' ? (
              <SpinWheelStage
                totalAvailable={availableStudents.length}
                displaySlots={
                  wheelSlots.filter((s) => !absentStudentIds.has(s.id)).length > 0
                    ? wheelSlots.filter((s) => !absentStudentIds.has(s.id))
                    : buildWheelSlots(availableStudents)
                }
                rotationDeg={rotationDeg}
                spinning={spinning}
                canSpin={canStartPick}
                onSpin={handleSpinWheel}
                disabledLabel={
                  pendingTurnRecord
                    ? 'Hoàn tất lượt hiện tại trước'
                    : eligibleStudents.length === 0
                      ? 'Không còn sinh viên khả dụng'
                      : 'Đã gọi hết danh sách'
                }
              />
            ) : (
              <MysteryCardsStage
                cards={cardsAvailableInDeck}
                totalAvailable={availableStudents.length}
                activeStudentId={activeRecord?.student.id ?? null}
                calledStudentIds={calledIdSet}
                noRepeat={noRepeat}
                highlightedIndex={highlightedCardIdx}
                drawing={drawingCard}
                shuffling={shufflingCards}
                canPick={canStartPick}
                turnLockedMessage={turnLockedMessage}
                onPickCard={handlePickCardDirect}
                onAutoPick={handleAutoPickCard}
                onReshuffle={handleReshuffleCards}
              />
            )}
          </div>

          {/* Thẻ mời lên bảng trả bài & bốc 6 lá UNO / Ngôi sao hy vọng */}
          <div>
            {activeRecord ? (
              <div className="overflow-hidden rounded-xl border border-brand-navy/20 bg-surface-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-navy px-4 py-2 text-white">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                    <Sparkles className="h-4 w-4 text-brand-redSoft" aria-hidden="true" />
                    <span>Mời lên trả bài</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeRecord.unoKind && (
                      <Badge tone={UNO_CARDS[activeRecord.unoKind].badgeTone}>
                        {UNO_CARDS[activeRecord.unoKind].title}
                      </Badge>
                    )}
                    {activeRecord.hopeStarStatus === 'resolved' && activeRecord.hopeStarKind && (
                      <Badge tone={HOPE_STAR_CARDS[activeRecord.hopeStarKind].badgeTone}>
                        Ngôi sao: {HOPE_STAR_CARDS[activeRecord.hopeStarKind].title}
                      </Badge>
                    )}
                    {hasHopeStarBonus(activeRecord) && (
                      <Badge tone="warning" className="gap-1">
                        <Star className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Vượt Ngôi sao hy vọng</span>
                      </Badge>
                    )}
                    <Badge tone={OUTCOME_META[activeRecord.outcome].badgeTone}>
                      {OUTCOME_META[activeRecord.outcome].label}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-4 p-4 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-col gap-2">
                      <p className="text-2xl font-bold text-brand-navy sm:text-3xl">
                        {activeRecord.student.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeRecord.student.code && (
                          <Badge tone="red">MSV: {activeRecord.student.code}</Badge>
                        )}
                        {activeRecord.student.className && (
                          <Badge tone="neutral">{activeRecord.student.className}</Badge>
                        )}
                      </div>
                    </div>

                    {(activeRecord.outcome === 'pending' ||
                      (quickTimerSec > 0 &&
                        activeRecord.unoKind !== 'skip' &&
                        activeRecord.hopeStarKind !== 'skip' &&
                        (!activeRecord.unoDeck || activeRecord.pickedSlotIndex !== null))) && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {activeRecord.outcome === 'pending' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="border-line text-status-dangerText hover:bg-status-dangerBg"
                            onClick={() => handleMarkOutcome(activeRecord.id, 'absent')}
                            title="Đánh dấu vắng và xóa khỏi danh sách chọn random"
                          >
                            <UserX className="h-4 w-4" aria-hidden="true" />
                            <span>Vắng</span>
                          </Button>
                        )}

                        {quickTimerSec > 0 &&
                          activeRecord.unoKind !== 'skip' &&
                          activeRecord.hopeStarKind !== 'skip' &&
                          (!activeRecord.unoDeck || activeRecord.pickedSlotIndex !== null) && (
                            <div className="flex shrink-0 items-center justify-between gap-4 rounded-xl border border-line bg-surface-page px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Timer
                              className={`h-5 w-5 ${
                                answerLeftSec <= 10 ? 'text-brand-red' : 'text-brand-navy'
                              }`}
                              aria-hidden="true"
                            />
                            <span
                              className={`text-2xl font-bold tabular-nums ${
                                answerLeftSec <= 10 ? 'text-brand-red' : 'text-brand-navy'
                              }`}
                            >
                              {formatCountdown(answerLeftSec)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant={answerTimerRunning ? 'navy' : 'primary'}
                              onClick={handleToggleAnswerTimer}
                            >
                              {answerTimerRunning ? (
                                <>
                                  <Pause className="h-4 w-4" aria-hidden="true" />
                                  <span>Tạm dừng</span>
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4" aria-hidden="true" />
                                  <span>{answerLeftSec === 0 ? 'Chạy lại' : 'Bắt đầu'}</span>
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label="Đặt lại đồng hồ"
                              onClick={() => handleChangeQuickTimer(quickTimerSec)}
                            >
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                          )}
                      </div>
                    )}
                  </div>

                  {/* Bàn rút 6 lá bài UNO */}
                  {activeRecord.unoDeck && (
                    <UnoSixCardBoard
                      studentName={activeRecord.student.name}
                      deck={activeRecord.unoDeck}
                      pickedSlotIndex={activeRecord.pickedSlotIndex}
                      odds={unoOdds}
                      scanningIndex={scanningUnoIdx}
                      isPicking={pickingUno}
                      soundEnabled={soundEnabled}
                      onPickCard={(slotIdx) => applyUnoSlotSelection(activeRecord.id, slotIdx)}
                      onAutoPickCard={() => handleAutoPickUnoCard(activeRecord.id)}
                      onChangeOdds={handleChangeUnoOdds}
                    />
                  )}

                  {/* Khối mời chọn Ngôi sao hy vọng khi sinh viên đang có thẻ trả lời câu hỏi */}
                  {canActivateHopeStar(activeRecord) && (
                    <div className="flex flex-col justify-between gap-4 rounded-xl border border-status-warningBorder bg-status-warningBg p-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-2">
                        <Star
                          className="h-5 w-5 shrink-0 text-status-warningText"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-bold text-status-warningText">
                            Ngôi sao hy vọng (tối đa 1 lần / lượt)
                          </span>
                          <p className="text-xs font-normal text-status-warningText">
                            Rút thêm 1 trong 6 lá Ngôi sao: nếu trúng Bỏ qua (Skip) sẽ được miễn toàn bộ lượt; nếu dính +1 hoặc +2 sẽ tích vào thẻ hiện tại và gắn thưởng Ngôi sao hy vọng khi đạt.
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="navy"
                          onClick={() => handleActivateHopeStar(activeRecord.id)}
                        >
                          <Star className="h-4 w-4" aria-hidden="true" />
                          <span>Dùng Ngôi sao hy vọng</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDeclineHopeStar(activeRecord.id)}
                        >
                          <span>Bỏ qua (Trả bài luôn)</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Bàn 6 lá Ngôi sao hy vọng */}
                  {activeRecord.hopeStarDeck &&
                    (activeRecord.hopeStarStatus === 'picking' ||
                      activeRecord.hopeStarStatus === 'resolved') && (
                      <HopeStarCardBoard
                        studentName={activeRecord.student.name}
                        baseCardTitle={
                          activeRecord.unoKind
                            ? UNO_CARDS[activeRecord.unoKind].title
                            : 'Thẻ ban đầu'
                        }
                        deck={activeRecord.hopeStarDeck}
                        pickedSlotIndex={activeRecord.hopeStarPickedSlotIndex}
                        odds={hopeStarOdds}
                        scanningIndex={scanningHopeStarIdx}
                        isPicking={pickingHopeStar}
                        soundEnabled={soundEnabled}
                        onPickCard={(slotIdx) =>
                          applyHopeStarSlotSelection(activeRecord.id, slotIdx)
                        }
                        onAutoPickCard={() => handleAutoPickHopeStarCard(activeRecord.id)}
                        onChangeOdds={handleChangeHopeStarOdds}
                        onCancelBeforePick={() =>
                          handleCancelHopeStarBeforePick(activeRecord.id)
                        }
                      />
                    )}

                  {/* Banner giải thích kết quả lá bài */}
                  {activeRecord.hopeStarStatus === 'resolved' && activeRecord.hopeStarKind ? (
                    activeRecord.hopeStarKind === 'skip' ? (
                      <div className="flex flex-col justify-between gap-4 rounded-xl border border-brand-red/30 bg-brand-redSoft p-4 sm:flex-row sm:items-center">
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-bold text-brand-red">
                            Ngôi sao hy vọng: Bỏ qua (Skip ⊘) — Miễn toàn bộ lượt!
                          </span>
                          <p className="text-xs font-normal text-ink-secondary">
                            {activeRecord.student.name} bốc trúng thẻ Bỏ qua ở Ngôi sao hy vọng, miễn toàn bộ câu hỏi của thẻ ban đầu. Thầy cô có thể chọn ngay sinh viên khác.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          disabled={availableStudents.length === 0 || spinning || drawingCard}
                          onClick={handlePickNextStudent}
                        >
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          <span>Chọn sinh viên khác</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 rounded-xl border border-status-warningBorder bg-status-warningBg p-4">
                        <Star
                          className="h-5 w-5 shrink-0 text-status-warningText"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-bold text-status-warningText">
                            Ngôi sao hy vọng: {HOPE_STAR_CARDS[activeRecord.hopeStarKind].title} — Tổng{' '}
                            {getTotalQuestionCount(activeRecord)} câu hỏi!
                          </span>
                          <p className="text-xs font-normal text-status-warningText">
                            Giữ nguyên thẻ{' '}
                            {activeRecord.unoKind
                              ? UNO_CARDS[activeRecord.unoKind].title
                              : 'ban đầu'}{' '}
                            và tích thêm +
                            {HOPE_STAR_CARDS[activeRecord.hopeStarKind].addedQuestionCount} câu hỏi từ Ngôi sao hy vọng cho{' '}
                            {activeRecord.student.name}.
                          </p>
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      {activeRecord.unoKind === 'skip' && (
                        <div className="flex flex-col justify-between gap-4 rounded-xl border border-brand-red/30 bg-brand-redSoft p-4 sm:flex-row sm:items-center">
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-bold text-brand-red">
                              Thẻ Cấm lượt (Skip ⊘) — Miễn trả lời!
                            </span>
                            <p className="text-xs font-normal text-ink-secondary">
                              {activeRecord.student.name} không phải trả lời câu hỏi lượt này. Thầy cô có thể chuyển ngay sang chọn sinh viên khác.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="primary"
                            disabled={availableStudents.length === 0 || spinning || drawingCard}
                            onClick={handlePickNextStudent}
                          >
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            <span>Chọn sinh viên khác</span>
                          </Button>
                        </div>
                      )}

                      {activeRecord.unoKind === 'reverse' && (
                        <div className="flex flex-col justify-between gap-4 rounded-xl border border-status-warningBorder bg-status-warningBg p-4 sm:flex-row sm:items-center">
                          <div className="flex items-start gap-2">
                            <GraduationCap
                              className="h-5 w-5 shrink-0 text-status-warningText"
                              aria-hidden="true"
                            />
                            <div className="flex flex-col gap-2">
                              <span className="text-sm font-bold text-status-warningText">
                                Thẻ Đảo chiều (Reverse ⇄) — Giáo viên trả lời!
                              </span>
                              <p className="text-xs font-normal text-status-warningText">
                                Lượt này đổi vai: giảng viên sẽ là người giải đáp câu hỏi trước lớp thay cho{' '}
                                {activeRecord.student.name}.
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="navy"
                            disabled={availableStudents.length === 0 || spinning || drawingCard}
                            onClick={handlePickNextStudent}
                          >
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            <span>Chọn SV tiếp theo</span>
                          </Button>
                        </div>
                      )}

                      {activeRecord.unoKind === 'plus2' && (
                        <div className="flex items-start gap-2 rounded-xl border border-brand-navy/25 bg-brand-navySoft p-4">
                          <PlusCircle
                            className="h-5 w-5 shrink-0 text-brand-navy"
                            aria-hidden="true"
                          />
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-bold text-brand-navy">
                              Thẻ Cộng hai (+2) — Trả lời thêm 2 câu hỏi!
                            </span>
                            <p className="text-xs font-normal text-ink-secondary">
                              {activeRecord.student.name} cần trả lời câu hỏi chính cộng thêm 2 câu hỏi (tổng 3 câu) ở phía dưới.
                            </p>
                          </div>
                        </div>
                      )}

                      {activeRecord.unoKind === 'normal' && (
                        <div className="flex items-start gap-2 rounded-xl border border-status-successBorder bg-status-successBg p-4">
                          <CheckCircle2
                            className="h-5 w-5 shrink-0 text-status-successText"
                            aria-hidden="true"
                          />
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-bold text-status-successText">
                              Thẻ Trả bài chuẩn (1) — Trả lời 1 câu hỏi
                            </span>
                            <p className="text-xs font-normal text-status-successText">
                              {activeRecord.student.name} thực hiện trả lời 1 câu hỏi từ giảng viên theo lượt thông thường.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Khung câu hỏi trả bài */}
                  <RecitationQuestionBox record={activeRecord} />

                  {/* Cho phép kết thúc nhanh nếu sinh viên vắng mặt khi đang chờ bốc lá bài */}
                  {activeRecord.outcome === 'pending' &&
                    ((activeRecord.unoDeck && activeRecord.pickedSlotIndex === null) ||
                      (activeRecord.hopeStarStatus === 'picking' &&
                        activeRecord.hopeStarPickedSlotIndex === null)) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                        <span className="text-xs font-normal text-ink-muted">
                          Sinh viên không có mặt để bốc thẻ?
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="border-line text-status-dangerText hover:bg-status-dangerBg"
                          onClick={() => handleMarkOutcome(activeRecord.id, 'absent')}
                        >
                          <UserX className="h-4 w-4" aria-hidden="true" />
                          <span>Đánh dấu vắng · Xóa khỏi random</span>
                        </Button>
                      </div>
                    )}

                  {/* Thanh chấm kết quả */}
                  {activeRecord.unoKind !== 'skip' &&
                    activeRecord.unoKind !== 'reverse' &&
                    activeRecord.hopeStarKind !== 'skip' &&
                    (!activeRecord.unoDeck || activeRecord.pickedSlotIndex !== null) &&
                    activeRecord.hopeStarStatus !== 'picking' && (
                      <div className="flex flex-col justify-between gap-2 border-t border-line pt-4 sm:flex-row sm:items-center">
                        <span className="text-xs font-semibold text-ink-secondary">
                          Chấm nhanh kết quả:
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            className={
                              activeRecord.outcome === 'bonus' ? 'ring-2 ring-brand-red/30' : ''
                            }
                            onClick={() => handleMarkOutcome(activeRecord.id, 'bonus')}
                          >
                            <Trophy className="h-4 w-4" aria-hidden="true" />
                            <span>Xuất sắc</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="navy"
                            className={
                              activeRecord.outcome === 'passed' ? 'ring-2 ring-brand-navy/30' : ''
                            }
                            onClick={() => handleMarkOutcome(activeRecord.id, 'passed')}
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            <span>Đạt</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className={
                              activeRecord.outcome === 'failed' ? 'ring-2 ring-brand-navy/30' : ''
                            }
                            onClick={() => handleMarkOutcome(activeRecord.id, 'failed')}
                          >
                            <XCircle className="h-4 w-4 text-status-warningText" aria-hidden="true" />
                            <span>Chưa đạt</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className={
                              activeRecord.outcome === 'absent'
                                ? 'border-line bg-status-dangerBg text-status-dangerText ring-2 ring-brand-red/30'
                                : 'border-line text-status-dangerText hover:bg-status-dangerBg'
                            }
                            onClick={() => handleMarkOutcome(activeRecord.id, 'absent')}
                          >
                            <UserX className="h-4 w-4" aria-hidden="true" />
                            <span>Vắng</span>
                          </Button>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface-page p-4 ${
                  isProjector ? 'flex-col justify-center p-6 text-center' : ''
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navySoft text-brand-navy">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="flex flex-col">
                  <p className="text-sm font-bold text-brand-navy">
                    {spinning || drawingCard
                      ? 'Đang chọn sinh viên lên bảng...'
                      : 'Sẵn sàng gọi sinh viên trả bài'}
                  </p>
                  <p className="text-xs font-normal text-ink-secondary">
                    {gameMode === 'wheel'
                      ? 'Nhấn "Quay chọn người trả bài" để bắt đầu lượt mới.'
                      : 'Chọn một thẻ trên bàn hoặc bấm "Rút ngẫu nhiên".'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const noticeRecord = noticeState
    ? records.find((r) => r.id === noticeState.recordId) ?? null
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="rounded-xl border border-line bg-surface-card p-6 lg:col-span-2">
        {renderMainGameArea(false)}
      </section>

      <aside className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand-red" aria-hidden="true" />
            <h3 className="text-base font-bold text-ink-primary">Bảng kết quả trả bài</h3>
          </div>
          <Badge tone="neutral">{records.length}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-brand-redSoft p-2 text-center">
            <p className="text-xs font-normal text-ink-secondary">Xuất sắc</p>
            <p className="text-lg font-bold text-brand-red">{stats.bonus}</p>
          </div>
          <div className="rounded-lg bg-status-successBg p-2 text-center">
            <p className="text-xs font-normal text-status-successText">Đạt</p>
            <p className="text-lg font-bold text-status-successText">{stats.passed}</p>
          </div>
          <div className="rounded-lg bg-status-warningBg p-2 text-center">
            <p className="text-xs font-normal text-status-warningText">Chưa đạt</p>
            <p className="text-lg font-bold text-status-warningText">{stats.failed}</p>
          </div>
          <div className="rounded-lg bg-status-dangerBg p-2 text-center">
            <p className="text-xs font-normal text-status-dangerText">Vắng</p>
            <p className="text-lg font-bold text-status-dangerText">{stats.absent}</p>
          </div>
        </div>

        {(stats.skipped > 0 || stats.reversed > 0 || stats.hopeStarWon > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-page px-4 py-2 text-xs text-ink-secondary">
            <span>Miễn (Skip): {stats.skipped}</span>
            <span>Đảo chiều (GV): {stats.reversed}</span>
            {stats.hopeStarWon > 0 && (
              <span className="font-semibold text-status-warningText">
                Vượt Ngôi sao: {stats.hopeStarWon}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportRecords}
            disabled={records.length === 0}
          >
            <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Xuất Excel</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleResetSession}
            disabled={spinning || drawingCard || records.length === 0}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Làm mới phiên</span>
          </Button>
        </div>

        {records.length === 0 ? (
          <p className="text-sm font-normal text-ink-muted">
            Chưa có sinh viên nào được chọn trả bài trong phiên này.
          </p>
        ) : (
          <ol className="flex max-h-[380px] flex-col gap-2 overflow-y-auto">
            {records.map((item, idx) => {
              const turnNumber = records.length - idx;
              const isSelected = item.id === activeRecordId;
              return (
                <li
                  key={item.id}
                  className={`flex flex-col gap-2 rounded-lg border p-2 ${
                    isSelected
                      ? 'border-brand-navy bg-brand-navySoft'
                      : 'border-line bg-surface-page'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveRecordId(item.id)}
                      title="Bấm để xem hoặc sửa kết quả trả bài của lượt này"
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-card text-xs font-bold text-brand-navy">
                        {turnNumber}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ink-primary">
                          {item.student.name}
                        </span>
                        <span className="text-xs font-normal text-ink-muted">
                          {item.pickedAt}
                          {item.student.code ? ` • ${item.student.code}` : ''}
                        </span>
                      </div>
                    </button>
                    <Badge tone={OUTCOME_META[item.outcome].badgeTone}>
                      {OUTCOME_META[item.outcome].label}
                    </Badge>
                  </div>

                  {item.unoKind && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-brand-navy">
                        Thẻ: {UNO_CARDS[item.unoKind].title}
                      </span>
                      {item.hopeStarStatus === 'resolved' && item.hopeStarKind && (
                        <span className="text-xs font-semibold text-status-warningText">
                          · Ngôi sao: {HOPE_STAR_CARDS[item.hopeStarKind].title}
                        </span>
                      )}
                      {hasHopeStarBonus(item) && (
                        <Badge tone="warning" className="gap-1">
                          <Star className="h-3 w-3" aria-hidden="true" />
                          <span>Ngôi sao hy vọng</span>
                        </Badge>
                      )}
                    </div>
                  )}

                  {item.questions.length > 0 && (
                    <p className="text-xs font-normal text-ink-secondary">
                      {item.questions.map((q, qIdx) => (item.questions.length > 1 ? `${qIdx + 1}. ${q}` : q)).join(' · ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </aside>

      {projectorOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-surface-page p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Chế độ chiếu Mini game trả bài"
        >
          <div className="mx-auto max-w-6xl rounded-2xl border border-line bg-surface-card p-6 shadow-xl">
            {renderMainGameArea(true)}
          </div>
        </div>
      )}

      <RecitationResultModal
        record={noticeRecord}
        noticeType={noticeState?.type ?? null}
        hasAvailableNextStudent={availableStudents.length > 0}
        onClose={() => setNoticeState(null)}
        onStartRecitation={handleStartRecitationFromNotice}
        onPickNextStudent={handlePickNextStudent}
        onActivateHopeStar={handleActivateHopeStar}
      />
    </div>
  );
}

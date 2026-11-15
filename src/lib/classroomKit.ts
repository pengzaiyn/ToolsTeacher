import * as XLSX from 'xlsx';
import { slug } from '@/lib/email';

export interface KitStudent {
  id: string;
  name: string;
  code?: string | null;
  className?: string | null;
}

export interface KitTeam {
  index: number;
  name: string;
  members: KitStudent[];
}

function isStudentCodeToken(value: string): boolean {
  const trimmed = value.trim();
  return /^\d{5,12}$/.test(trimmed) || (/^[A-Za-z0-9]{5,12}$/.test(trimmed) && /\d/.test(trimmed));
}

/** Phân tích danh sách sinh viên dán thủ công (hỗ trợ: "Họ tên" hoặc "MSV - Họ tên" / tab Excel) */
export function parseManualStudentList(rawText: string): KitStudent[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const parts = line
      .split(/\t|\s+[-–|]\s+|,\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      const firstIsCode = isStudentCodeToken(parts[0]);
      const lastIsCode = isStudentCodeToken(parts[parts.length - 1]);
      if (firstIsCode) {
        return {
          id: `manual-${index}`,
          code: parts[0],
          name: parts.slice(1).join(' '),
        };
      }
      if (lastIsCode) {
        return {
          id: `manual-${index}`,
          code: parts[parts.length - 1],
          name: parts.slice(0, -1).join(' '),
        };
      }
    }

    return {
      id: `manual-${index}`,
      name: line,
    };
  });
}

export function shuffleList<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/** Chọn ngẫu nhiên một sinh viên chưa nằm trong danh sách loại trừ */
export function pickRandomStudent(
  students: readonly KitStudent[],
  excludedIds: ReadonlySet<string>
): KitStudent | null {
  const available = students.filter((s) => !excludedIds.has(s.id));
  if (available.length === 0) return null;
  const idx = Math.floor(Math.random() * available.length);
  return available[idx] ?? null;
}

/** Chia đều danh sách sinh viên ngẫu nhiên theo số nhóm hoặc theo sĩ số tối đa mỗi nhóm */
export function splitIntoTeams(
  students: readonly KitStudent[],
  mode: 'by_count' | 'by_size',
  value: number
): KitTeam[] {
  if (students.length === 0) return [];
  const safeValue = Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
  const teamCount =
    mode === 'by_count'
      ? Math.min(students.length, safeValue)
      : Math.ceil(students.length / safeValue);

  const buckets: KitStudent[][] = Array.from({ length: teamCount }, () => []);
  const shuffled = shuffleList(students);
  shuffled.forEach((student, index) => {
    buckets[index % teamCount].push(student);
  });

  return buckets.map((members, index) => ({
    index: index + 1,
    name: `Nhóm ${index + 1}`,
    members,
  }));
}

export function formatTeamsAsText(teams: readonly KitTeam[]): string {
  return teams
    .map((team) => {
      const lines = team.members.map(
        (m, idx) => `  ${idx + 1}. ${m.name}${m.code ? ` (${m.code})` : ''}`
      );
      return `${team.name} (${team.members.length} SV):\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

export function exportTeamsToExcel(teams: readonly KitTeam[], sourceLabel: string): void {
  const rows: Record<string, string | number>[] = [];
  teams.forEach((team) => {
    team.members.forEach((member, idx) => {
      rows.push({
        Nhóm: team.name,
        STT: idx + 1,
        'Họ và tên': member.name,
        'Mã sinh viên': member.code ?? '',
        Lớp: member.className ?? sourceLabel,
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, // Nhóm
    { wch: 6 },  // STT
    { wch: 26 }, // Họ và tên
    { wch: 16 }, // Mã sinh viên
    { wch: 16 }, // Lớp
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'ChiaNhom');

  const safeName = slug(sourceLabel) || 'lop-hoc';
  XLSX.writeFile(wb, `chia-nhom-${safeName}.xlsx`);
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export type RecitationOutcome =
  | 'pending'
  | 'bonus'
  | 'passed'
  | 'failed'
  | 'absent'
  | 'skipped'
  | 'reversed';

export type UnoCardKind = 'skip' | 'reverse' | 'plus2' | 'normal';
export type HopeStarCardKind = 'skip' | 'normal' | 'plus2';
export type HopeStarStatus = 'none' | 'declined' | 'picking' | 'resolved';

export interface UnoCardMeta {
  kind: UnoCardKind;
  shortSymbol: string;
  title: string;
  subtitle: string;
  description: string;
  badgeTone: 'navy' | 'red' | 'success' | 'warning';
  questionCount: number;
}

export interface HopeStarCardMeta {
  kind: HopeStarCardKind;
  shortSymbol: string;
  title: string;
  subtitle: string;
  description: string;
  badgeTone: 'navy' | 'red' | 'success' | 'warning';
  addedQuestionCount: number;
}

export interface UnoDeckSlot<K extends UnoCardKind = UnoCardKind> {
  slotId: string;
  kind: K;
}

export type UnoOddsConfig = Record<UnoCardKind, number>;
export type HopeStarOddsConfig = Record<HopeStarCardKind, number>;

export interface RecitationRecord {
  id: string;
  student: KitStudent;
  outcome: RecitationOutcome;
  unoKind: UnoCardKind | null;
  unoDeck: UnoDeckSlot<UnoCardKind>[] | null;
  pickedSlotIndex: number | null;
  hopeStarStatus: HopeStarStatus;
  hopeStarKind: HopeStarCardKind | null;
  hopeStarDeck: UnoDeckSlot<HopeStarCardKind>[] | null;
  hopeStarPickedSlotIndex: number | null;
  baseQuestionCount: number;
  questions: string[];
  extraQuestionCount: number;
  pickedAt: string;
}

export const OUTCOME_META: Record<
  RecitationOutcome,
  { label: string; badgeTone: 'neutral' | 'red' | 'success' | 'warning' | 'navy' | 'danger' }
> = {
  pending: { label: 'Đang trả bài', badgeTone: 'neutral' },
  bonus: { label: 'Xuất sắc (+điểm)', badgeTone: 'red' },
  passed: { label: 'Đạt', badgeTone: 'success' },
  failed: { label: 'Chưa đạt', badgeTone: 'warning' },
  absent: { label: 'Vắng', badgeTone: 'danger' },
  skipped: { label: 'Miễn (Skip)', badgeTone: 'warning' },
  reversed: { label: 'GV trả lời (Đảo chiều)', badgeTone: 'navy' },
};

export const UNO_CARDS: Record<UnoCardKind, UnoCardMeta> = {
  skip: {
    kind: 'skip',
    shortSymbol: '⊘',
    title: 'Cấm lượt (Skip)',
    subtitle: 'Miễn trả lời · Chuyển SV khác',
    description: 'Sinh viên không cần trả lời câu hỏi và hệ thống chuyển sang lượt quay sinh viên khác.',
    badgeTone: 'red',
    questionCount: 0,
  },
  reverse: {
    kind: 'reverse',
    shortSymbol: '⇄',
    title: 'Đảo chiều (Reverse)',
    subtitle: 'Giáo viên trả lời',
    description: 'Đảo chiều lượt chơi: giáo viên sẽ trực tiếp trả lời câu hỏi thay cho sinh viên.',
    badgeTone: 'warning',
    questionCount: 1,
  },
  plus2: {
    kind: 'plus2',
    shortSymbol: '+2',
    title: 'Cộng hai (+2)',
    subtitle: 'Trả lời +2 câu hỏi',
    description: 'Sinh viên trả lời câu hỏi chính và cộng thêm 2 câu hỏi dựa trên lá bài cộng thêm.',
    badgeTone: 'navy',
    questionCount: 3,
  },
  normal: {
    kind: 'normal',
    shortSymbol: '1',
    title: 'Trả bài chuẩn (1)',
    subtitle: 'Trả lời 1 câu hỏi',
    description: 'Sinh viên thực hiện trả lời 1 câu hỏi theo lượt thông thường.',
    badgeTone: 'success',
    questionCount: 1,
  },
};

export const HOPE_STAR_CARDS: Record<HopeStarCardKind, HopeStarCardMeta> = {
  skip: {
    kind: 'skip',
    shortSymbol: '⊘',
    title: 'Bỏ qua (Skip)',
    subtitle: 'Miễn toàn bộ lượt trả bài',
    description:
      'May mắn! Bốc trúng thẻ Bỏ qua (Skip) ở Ngôi sao hy vọng — miễn toàn bộ câu hỏi (kể cả thẻ ban đầu) và chuyển sang sinh viên khác.',
    badgeTone: 'red',
    addedQuestionCount: 0,
  },
  normal: {
    kind: 'normal',
    shortSymbol: '+1',
    title: 'Cộng 1 câu (+1)',
    subtitle: 'Tích thêm +1 câu hỏi',
    description:
      'Thẻ ban đầu vẫn được giữ nguyên và tích thêm +1 câu hỏi ở Ngôi sao hy vọng. Hoàn thành Đạt/Xuất sắc sẽ được gắn danh hiệu Ngôi sao hy vọng!',
    badgeTone: 'success',
    addedQuestionCount: 1,
  },
  plus2: {
    kind: 'plus2',
    shortSymbol: '+2',
    title: 'Cộng hai (+2)',
    subtitle: 'Tích thêm +2 câu hỏi',
    description:
      'Thẻ ban đầu vẫn được giữ nguyên và tích thêm +2 câu hỏi ở Ngôi sao hy vọng. Hoàn thành Đạt/Xuất sắc sẽ được gắn danh hiệu Ngôi sao hy vọng!',
    badgeTone: 'navy',
    addedQuestionCount: 2,
  },
};

export const DEFAULT_UNO_ODDS: UnoOddsConfig = {
  normal: 40,
  skip: 20,
  reverse: 20,
  plus2: 20,
};

export const DEFAULT_HOPE_STAR_ODDS: HopeStarOddsConfig = {
  skip: 40,
  normal: 40,
  plus2: 20,
};

export const UNO_ODDS_PRESETS: { id: string; label: string; odds: UnoOddsConfig }[] = [
  {
    id: 'balanced',
    label: 'Cân bằng (40% thường / 60% UNO)',
    odds: { normal: 40, skip: 20, reverse: 20, plus2: 20 },
  },
  {
    id: 'pure-uno',
    label: 'Thuần 3 thẻ UNO (34% / 33% / 33%)',
    odds: { normal: 0, skip: 34, reverse: 33, plus2: 33 },
  },
  {
    id: 'challenge',
    label: 'Tăng kịch tính (+2 nhiều hơn)',
    odds: { normal: 25, skip: 20, reverse: 15, plus2: 40 },
  },
];

export const HOPE_STAR_ODDS_PRESETS: {
  id: string;
  label: string;
  odds: HopeStarOddsConfig;
}[] = [
  {
    id: 'balanced-star',
    label: 'Cân bằng (40% / 40% / 20%)',
    odds: { skip: 40, normal: 40, plus2: 20 },
  },
  {
    id: 'lucky-star',
    label: 'May mắn cao (50% Skip)',
    odds: { skip: 50, normal: 30, plus2: 20 },
  },
  {
    id: 'high-risk-star',
    label: 'Thử thách (30% Skip / 35% +2)',
    odds: { skip: 30, normal: 35, plus2: 35 },
  },
];

const UNO_KEYS: readonly UnoCardKind[] = ['skip', 'reverse', 'plus2', 'normal'];
const HOPE_STAR_KEYS: readonly HopeStarCardKind[] = ['skip', 'normal', 'plus2'];

function normalizeWeightedOdds<K extends string>(
  odds: Record<K, number>,
  keys: readonly K[],
  fallback: Record<K, number>
): Record<K, number> {
  const safe = {} as Record<K, number>;
  let total = 0;
  for (const key of keys) {
    const raw = odds[key];
    const clean = Math.max(0, Number.isFinite(raw) ? raw : 0);
    safe[key] = clean;
    total += clean;
  }
  if (total <= 0) return { ...fallback };
  const result = {} as Record<K, number>;
  for (const key of keys) {
    result[key] = Math.round((safe[key] / total) * 100);
  }
  return result;
}

function pickWeightedKind<K extends string>(
  odds: Record<K, number>,
  keys: readonly K[],
  fallback: Record<K, number>
): K {
  const entries = keys.map((key) => [key, Math.max(0, Number.isFinite(odds[key]) ? odds[key] : 0)] as [K, number]);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) {
    return pickWeightedKind(fallback, keys, fallback);
  }
  let roll = Math.random() * total;
  for (const [kind, weight] of entries) {
    if (weight <= 0) continue;
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return entries.find(([, weight]) => weight > 0)?.[0] ?? keys[0];
}

export function normalizeUnoPercentages(odds: UnoOddsConfig): UnoOddsConfig {
  return normalizeWeightedOdds(odds, UNO_KEYS, DEFAULT_UNO_ODDS);
}

export function normalizeHopeStarPercentages(odds: HopeStarOddsConfig): HopeStarOddsConfig {
  return normalizeWeightedOdds(odds, HOPE_STAR_KEYS, DEFAULT_HOPE_STAR_ODDS);
}

export function pickWeightedUnoKind(odds: UnoOddsConfig): UnoCardKind {
  return pickWeightedKind(odds, UNO_KEYS, DEFAULT_UNO_ODDS);
}

export function generateUnoDeck(
  odds: UnoOddsConfig,
  count = 6,
  seedKey = Date.now()
): UnoDeckSlot<UnoCardKind>[] {
  return Array.from({ length: count }, (_, idx) => ({
    slotId: `uno-${seedKey}-${idx}`,
    kind: pickWeightedKind(odds, UNO_KEYS, DEFAULT_UNO_ODDS),
  }));
}

export function generateHopeStarDeck(
  odds: HopeStarOddsConfig,
  count = 6,
  seedKey = Date.now()
): UnoDeckSlot<HopeStarCardKind>[] {
  return Array.from({ length: count }, (_, idx) => ({
    slotId: `star-${seedKey}-${idx}`,
    kind: pickWeightedKind(odds, HOPE_STAR_KEYS, DEFAULT_HOPE_STAR_ODDS),
  }));
}

export function canActivateHopeStar(record: RecitationRecord): boolean {
  return (
    record.outcome === 'pending' &&
    record.pickedSlotIndex !== null &&
    (record.unoKind === 'normal' || record.unoKind === 'plus2') &&
    record.hopeStarStatus === 'none'
  );
}

export function hasHopeStarBonus(record: RecitationRecord): boolean {
  return (
    record.hopeStarStatus === 'resolved' &&
    record.hopeStarKind !== null &&
    record.hopeStarKind !== 'skip' &&
    (record.outcome === 'bonus' || record.outcome === 'passed')
  );
}

export function getTotalQuestionCount(record: RecitationRecord): number {
  if (record.outcome === 'skipped' || record.unoKind === 'skip' || record.hopeStarKind === 'skip') {
    return 0;
  }
  const base =
    record.unoKind !== null
      ? UNO_CARDS[record.unoKind].questionCount
      : Math.max(0, record.baseQuestionCount);
  const added =
    record.hopeStarStatus === 'resolved' && record.hopeStarKind !== null
      ? HOPE_STAR_CARDS[record.hopeStarKind].addedQuestionCount
      : 0;
  return base + added;
}

export function getRecitationQuestionTags(record: RecitationRecord): string[] {
  const total = getTotalQuestionCount(record);
  if (total <= 0) return [];
  const tags: string[] = [];
  const baseCount =
    record.unoKind !== null
      ? UNO_CARDS[record.unoKind].questionCount
      : Math.max(0, record.baseQuestionCount);

  if (baseCount >= 1) {
    tags.push('Câu chính');
  }
  for (let i = 1; i < baseCount; i += 1) {
    tags.push(`Cộng thêm +${i}`);
  }
  const hopeAdded =
    record.hopeStarStatus === 'resolved' && record.hopeStarKind !== null
      ? HOPE_STAR_CARDS[record.hopeStarKind].addedQuestionCount
      : 0;
  for (let i = 1; i <= hopeAdded; i += 1) {
    tags.push(`Ngôi sao +${i}`);
  }
  return tags;
}

export function parseQuestionLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatHopeStarExcelLabel(item: RecitationRecord): string {
  if (item.hopeStarStatus === 'resolved' && item.hopeStarKind) {
    if (item.hopeStarKind === 'skip') {
      return 'Dùng · Trúng Bỏ qua (Skip)';
    }
    const baseText = `${HOPE_STAR_CARDS[item.hopeStarKind].title} (Tổng ${getTotalQuestionCount(item)} câu)`;
    return hasHopeStarBonus(item) ? `${baseText} · Đạt Ngôi sao hy vọng` : baseText;
  }
  if (item.hopeStarStatus === 'declined') return 'Bỏ qua không dùng';
  if (item.hopeStarStatus === 'picking') return 'Đang chọn thẻ Ngôi sao';
  return '';
}

export function exportRecitationToExcel(
  records: readonly RecitationRecord[],
  sourceLabel: string
): void {
  const ordered = [...records].reverse();
  const rows = ordered.map((item, idx) => {
    const totalQuestions = getTotalQuestionCount(item);
    return {
      Lượt: idx + 1,
      'Họ và tên': item.student.name,
      'Mã sinh viên': item.student.code ?? '',
      Lớp: item.student.className ?? sourceLabel,
      'Thẻ UNO': item.unoKind ? UNO_CARDS[item.unoKind].title : '',
      'Ngôi sao hy vọng': formatHopeStarExcelLabel(item),
      'Kết quả': OUTCOME_META[item.outcome].label,
      'Câu hỏi':
        item.questions.length > 0
          ? item.questions.map((q, qIdx) => `${qIdx + 1}. ${q}`).join(' | ')
          : totalQuestions > 1
            ? `Tổng ${totalQuestions} câu hỏi (GV nêu tại lớp)`
            : '',
      'Thời điểm': item.pickedAt,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },  // Lượt
    { wch: 26 }, // Họ và tên
    { wch: 15 }, // Mã sinh viên
    { wch: 14 }, // Lớp
    { wch: 22 }, // Thẻ UNO
    { wch: 36 }, // Ngôi sao hy vọng
    { wch: 22 }, // Kết quả
    { wch: 40 }, // Câu hỏi
    { wch: 10 }, // Thời điểm
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'KetQuaTraBai');

  const safeName = slug(sourceLabel) || 'lop-hoc';
  XLSX.writeFile(wb, `tra-bai-${safeName}.xlsx`);
}

let sharedAudioCtx: AudioContext | null = null;
let cachedNoiseCtx: AudioContext | null = null;
let cachedNoiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/** Đánh thức AudioContext sau thao tác người dùng để hiệu ứng âm thanh phát ngay */
export function unlockClassroomAudio(): void {
  void getAudioContext();
}

function getHoverNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoiseCtx === ctx && cachedNoiseBuffer) {
    return cachedNoiseBuffer;
  }
  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.032));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const fade = 1 - i / length;
    channel[i] = (Math.random() * 2 - 1) * fade;
  }
  cachedNoiseCtx = ctx;
  cachedNoiseBuffer = buffer;
  return buffer;
}

const CARD_HOVER_SCALE_HZ = [523.25, 587.33, 659.25, 783.99, 880, 1046.5] as const;

function playAudioSequence(
  notes: { freq: number; delay: number; duration: number; gainPeak: number; type?: OscillatorType }[]
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = ctx.currentTime + note.delay;

      osc.type = note.type ?? 'sine';
      osc.frequency.setValueAtTime(note.freq, startAt);

      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(note.gainPeak, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + note.duration + 0.01);
    });
  } catch {
    // Bỏ qua nếu trình duyệt chặn phát âm thanh
  }
}

/** Phát âm thanh vuốt nhẹ & nốt nhạc theo vị trí khi lướt qua từng thẻ UNO */
export function playUnoCardHover(cardIndex: number, mode: 'uno' | 'hope-star' = 'uno'): void {
  const ctx = getAudioContext();
  // Tránh dồn nốt khi trình duyệt chưa cấp quyền phát qua thao tác click
  if (!ctx || ctx.state !== 'running') return;

  try {
    const safeIdx = Math.abs(cardIndex) % CARD_HOVER_SCALE_HZ.length;
    const baseFreq = CARD_HOVER_SCALE_HZ[safeIdx];
    const now = ctx.currentTime;

    // 1. Tiếng sột nhẹ mô phỏng mép lá bài lướt qua tay
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = getHoverNoiseBuffer(ctx);
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(2200 + safeIdx * 240, now);
    bandpass.Q.setValueAtTime(1.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.055, now + 0.005);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

    noiseSrc.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.03);

    // 2. Âm nảy êm tai theo thang ngũ cung 6 lá bài
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 1.06, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.016);

    oscGain.gain.setValueAtTime(0.001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.068, now + 0.008);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.105);

    // 3. Điểm thêm hài âm cao lấp lánh cho bộ Ngôi sao hy vọng
    if (mode === 'hope-star') {
      const shimmerOsc = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmerOsc.type = 'sine';
      shimmerOsc.frequency.setValueAtTime(baseFreq * 2, now + 0.006);

      shimmerGain.gain.setValueAtTime(0.001, now + 0.006);
      shimmerGain.gain.exponentialRampToValueAtTime(0.024, now + 0.018);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      shimmerOsc.connect(shimmerGain);
      shimmerGain.connect(ctx.destination);
      shimmerOsc.start(now + 0.006);
      shimmerOsc.stop(now + 0.12);
    }
  } catch {
    // Bỏ qua nếu trình duyệt chặn phát âm thanh
  }
}

/** Phát âm thanh gõ nhẹ khi vòng quay đi qua từng múi */
export function playWheelTick(): void {
  playAudioSequence([{ freq: 620, delay: 0, duration: 0.035, gainPeak: 0.07, type: 'triangle' }]);
}

/** Phát chuỗi nốt vui tai khi chọn xong sinh viên trả bài */
export function playRevealFanfare(): void {
  playAudioSequence([
    { freq: 523.25, delay: 0, duration: 0.14, gainPeak: 0.14 },
    { freq: 659.25, delay: 0.1, duration: 0.14, gainPeak: 0.14 },
    { freq: 783.99, delay: 0.2, duration: 0.26, gainPeak: 0.16 },
  ]);
}

/** Phát âm thanh vút nhẹ khi lật thẻ UNO */
export function playCardFlip(): void {
  playAudioSequence([
    { freq: 360, delay: 0, duration: 0.06, gainPeak: 0.08, type: 'triangle' },
    { freq: 540, delay: 0.05, duration: 0.08, gainPeak: 0.08, type: 'triangle' },
  ]);
}

/** Phát âm hiệu ứng riêng cho từng loại lá bài UNO */
export function playUnoEffectSound(kind: UnoCardKind): void {
  if (kind === 'skip') {
    playAudioSequence([
      { freq: 659.25, delay: 0.08, duration: 0.11, gainPeak: 0.13 },
      { freq: 880, delay: 0.18, duration: 0.2, gainPeak: 0.15 },
    ]);
    return;
  }
  if (kind === 'reverse') {
    playAudioSequence([
      { freq: 587.33, delay: 0.08, duration: 0.1, gainPeak: 0.12 },
      { freq: 783.99, delay: 0.17, duration: 0.1, gainPeak: 0.12 },
      { freq: 587.33, delay: 0.26, duration: 0.18, gainPeak: 0.14 },
    ]);
    return;
  }
  if (kind === 'plus2') {
    playAudioSequence([
      { freq: 440, delay: 0.08, duration: 0.12, gainPeak: 0.14, type: 'triangle' },
      { freq: 415.3, delay: 0.2, duration: 0.12, gainPeak: 0.14, type: 'triangle' },
      { freq: 392, delay: 0.32, duration: 0.24, gainPeak: 0.16, type: 'triangle' },
    ]);
    return;
  }
  playAudioSequence([
    { freq: 523.25, delay: 0.08, duration: 0.12, gainPeak: 0.12 },
    { freq: 659.25, delay: 0.18, duration: 0.2, gainPeak: 0.13 },
  ]);
}

/** Phát âm báo nhẹ khi đồng hồ hết giờ bằng Web Audio API */
export function playTimerBeep(): void {
  playAudioSequence([
    { freq: 880, delay: 0, duration: 0.24, gainPeak: 0.18 },
    { freq: 988, delay: 0.18, duration: 0.24, gainPeak: 0.18 },
    { freq: 1175, delay: 0.36, duration: 0.26, gainPeak: 0.18 },
  ]);
}

export interface StudentWorkbookParseResult {
  linesText: string;
  count: number;
  sheetName: string;
  error?: string;
}

const FULL_NAME_HEADERS = new Set([
  'ho va ten',
  'ho ten',
  'ho ten sv',
  'ho ten sinh vien',
  'ten sinh vien',
  'sinh vien',
  'ho ten hoc vien',
  'ten hoc vien',
  'full name',
  'fullname',
  'name',
]);
const LAST_NAME_HEADERS = new Set(['ho', 'ho dem', 'ho lot', 'ho va ten dem', 'last name', 'lastname']);
const FIRST_NAME_HEADERS = new Set(['ten', 'ten goi', 'first name', 'firstname']);
const CODE_HEADERS = new Set([
  'ma sinh vien',
  'ma sv',
  'msv',
  'ma so sinh vien',
  'mssv',
  'ma hoc vien',
  'student code',
  'student id',
  'ma',
]);
const STT_HEADERS = new Set(['stt', 'tt', 'so thu tu', 'no']);
const SKIP_FOOTER_PREFIXES = ['tong cong', 'tong so', 'nguoi lap', 'giang vien', 'ky ten', 'ghi chu'];

function normalizeExcelCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value).trim() : '';
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeHeaderKey(value: unknown): string {
  return normalizeExcelCellText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function detectStudentColumns(row: unknown[]) {
  let fullNameIdx = -1;
  let lastNameIdx = -1;
  let firstNameIdx = -1;
  let codeIdx = -1;

  row.forEach((cell, idx) => {
    const key = normalizeHeaderKey(cell);
    if (!key) return;
    if (fullNameIdx < 0 && FULL_NAME_HEADERS.has(key)) {
      fullNameIdx = idx;
    } else if (lastNameIdx < 0 && LAST_NAME_HEADERS.has(key)) {
      lastNameIdx = idx;
    } else if (firstNameIdx < 0 && FIRST_NAME_HEADERS.has(key)) {
      firstNameIdx = idx;
    } else if (codeIdx < 0 && CODE_HEADERS.has(key)) {
      codeIdx = idx;
    }
  });

  // Nếu sheet chỉ có cột "Tên" mà không có cột "Họ/Họ đệm" thì dùng luôn cột "Tên" làm họ tên
  if (fullNameIdx < 0 && firstNameIdx >= 0 && lastNameIdx < 0) {
    fullNameIdx = firstNameIdx;
    firstNameIdx = -1;
  }

  const hasValidNameColumns = fullNameIdx >= 0 || (lastNameIdx >= 0 && firstNameIdx >= 0);
  return hasValidNameColumns ? { fullNameIdx, lastNameIdx, firstNameIdx, codeIdx } : null;
}

function isLikelyFooterRow(name: string, code: string): boolean {
  if (code) return false;
  const normalized = normalizeHeaderKey(name);
  return SKIP_FOOTER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function extractStudentsFromSheetRows(rawRows: unknown[][]): { lines: string[]; error?: string } {
  const nonEmptyIndexedRows = rawRows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ row }) => row.some((cell) => normalizeExcelCellText(cell) !== ''));

  if (nonEmptyIndexedRows.length === 0) {
    return { lines: [] };
  }

  // Quét tối đa 15 dòng không rỗng đầu tiên để tìm hàng tiêu đề
  let headerMatch: { rowIndex: number; cols: NonNullable<ReturnType<typeof detectStudentColumns>> } | null = null;
  for (const candidate of nonEmptyIndexedRows.slice(0, 15)) {
    const cols = detectStudentColumns(candidate.row);
    if (cols) {
      headerMatch = { rowIndex: candidate.rowIndex, cols };
      break;
    }
  }

  const lines: string[] = [];
  const maxRows = 1000;

  if (headerMatch) {
    const { fullNameIdx, lastNameIdx, firstNameIdx, codeIdx } = headerMatch.cols;
    for (let r = headerMatch.rowIndex + 1; r < rawRows.length && lines.length < maxRows; r++) {
      const row = rawRows[r] ?? [];
      const name =
        fullNameIdx >= 0
          ? normalizeExcelCellText(row[fullNameIdx])
          : [normalizeExcelCellText(row[lastNameIdx]), normalizeExcelCellText(row[firstNameIdx])]
              .filter(Boolean)
              .join(' ');
      const code = codeIdx >= 0 ? normalizeExcelCellText(row[codeIdx]) : '';

      if (!name || isLikelyFooterRow(name, code)) continue;
      lines.push(code ? `${code} - ${name}` : name);
    }
    return { lines };
  }

  // Fallback: file không có tiêu đề (ví dụ chỉ gồm cột Họ tên, hoặc [STT | MSV | Họ tên])
  for (const { row } of nonEmptyIndexedRows) {
    if (lines.length >= maxRows) break;
    const cells = row.map(normalizeExcelCellText).filter(Boolean);
    if (cells.length === 0) continue;

    // Bỏ qua nếu dòng đầu tình cờ chỉ ghi nhãn tiêu đề chung hoặc STT
    if (cells.length === 1 && STT_HEADERS.has(normalizeHeaderKey(cells[0]))) continue;

    const rest =
      cells.length > 1 && /^\d{1,4}$/.test(cells[0])
        ? cells.slice(1)
        : cells;

    let code = '';
    const textParts: string[] = [];
    for (const item of rest) {
      if (!code && isStudentCodeToken(item) && rest.length > 1) {
        code = item;
      } else {
        textParts.push(item);
      }
    }

    const name = textParts[0] ?? '';
    if (!name || /^\d+$/.test(name) || isLikelyFooterRow(name, code)) continue;
    lines.push(code ? `${code} - ${name}` : name);
  }

  return { lines };
}

/** Đọc danh sách sinh viên từ file Excel (.xlsx, .xls, .csv) trả về các dòng chuẩn cho ô chỉnh tay */
export function parseStudentWorkbook(buffer: ArrayBuffer): StudentWorkbookParseResult {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    if (wb.SheetNames.length === 0) {
      return {
        linesText: '',
        count: 0,
        sheetName: '',
        error: 'File Excel không có trang tính nào.',
      };
    }

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      const { lines } = extractStudentsFromSheetRows(rawRows);
      if (lines.length > 0) {
        return {
          linesText: lines.join('\n'),
          count: lines.length,
          sheetName,
        };
      }
    }

    return {
      linesText: '',
      count: 0,
      sheetName: wb.SheetNames[0] ?? '',
      error: 'Không tìm thấy danh sách sinh viên hợp lệ. Hãy kiểm tra cột "Họ và tên" hoặc tải file mẫu.',
    };
  } catch {
    return {
      linesText: '',
      count: 0,
      sheetName: '',
      error: 'Không đọc được file Excel. Vui lòng dùng định dạng .xlsx, .xls hoặc .csv hợp lệ.',
    };
  }
}

/** Tải file Excel mẫu để giảng viên điền hoặc đối chiếu cột khi nhập danh sách sinh viên */
export function downloadStudentListTemplate(): void {
  const sampleRows = [
    { STT: 1, 'Mã sinh viên': '61112600001', 'Họ và tên': 'Nguyễn Văn An' },
    { STT: 2, 'Mã sinh viên': '61112600002', 'Họ và tên': 'Trần Thị Bình' },
    { STT: 3, 'Mã sinh viên': '61112600003', 'Họ và tên': 'Lê Minh Châu' },
  ];

  const guideRows = [
    { 'Quy ước': 'Cột bắt buộc', 'Chi tiết': 'Họ và tên (hoặc tách thành 2 cột Họ đệm + Tên)' },
    { 'Quy ước': 'Cột tùy chọn', 'Chi tiết': 'Mã sinh viên (MSV / Mã SV) và STT' },
    { 'Quy ước': 'Định dạng hỗ trợ', 'Chi tiết': 'File .xlsx, .xls, .csv (có dòng tiêu đề hoặc chỉ cột tên)' },
    { 'Quy ước': 'Số lượng tối đa', 'Chi tiết': 'Tối đa 1.000 sinh viên mỗi lần nạp' },
  ];

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sampleRows);
  wsData['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'DanhSachSinhVien');

  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'HuongDan');

  XLSX.writeFile(wb, 'danh-sach-sinh-vien-mau.xlsx');
}


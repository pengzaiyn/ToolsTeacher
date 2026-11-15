import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Shuffle, SlidersHorizontal, Star } from 'lucide-react';
import {
  HOPE_STAR_CARDS,
  HOPE_STAR_ODDS_PRESETS,
  normalizeHopeStarPercentages,
  normalizeUnoPercentages,
  playUnoCardHover,
  UNO_CARDS,
  UNO_ODDS_PRESETS,
  type HopeStarCardKind,
  type HopeStarOddsConfig,
  type UnoCardKind,
  type UnoDeckSlot,
  type UnoOddsConfig,
} from '@/lib/classroomKit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const FAN_TILT_CLASSES = [
  'md:-rotate-3',
  'md:-rotate-2',
  'md:-rotate-1',
  'md:rotate-1',
  'md:rotate-2',
  'md:rotate-3',
];

function UnoCardBackSvg({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 140 208"
      className="h-full w-full drop-shadow-sm"
      role="img"
      aria-label={`Thẻ UNO úp số ${index + 1}`}
    >
      <rect
        x="2"
        y="2"
        width="136"
        height="204"
        rx="14"
        className="fill-surface-bright stroke-line-strong"
        strokeWidth="2"
      />
      <rect x="9" y="9" width="122" height="190" rx="10" className="fill-ink-card" />
      <ellipse
        cx="70"
        cy="104"
        rx="52"
        ry="76"
        transform="rotate(-24 70 104)"
        className="fill-brand-red"
      />
      <ellipse
        cx="70"
        cy="104"
        rx="48"
        ry="72"
        transform="rotate(-24 70 104)"
        fill="none"
        className="stroke-white/80"
        strokeWidth="2.5"
      />
      {/* Chữ UNO nghiêng nổi bật trên mặt úp */}
      <g transform="rotate(-18 70 104)">
        <text
          x="70"
          y="108"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="34"
          fontWeight="800"
          letterSpacing="1"
          className="fill-amber-300 stroke-ink-card"
          strokeWidth="3"
          paintOrder="stroke"
        >
          UNO
        </text>
      </g>
      <text x="19" y="29" fontSize="13" fontWeight="700" className="fill-white/90">
        #{index + 1}
      </text>
      <text
        x="121"
        y="181"
        textAnchor="end"
        fontSize="13"
        fontWeight="700"
        className="fill-white/90"
      >
        #{index + 1}
      </text>
    </svg>
  );
}

function HopeStarCardBackSvg({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 140 208"
      className="h-full w-full drop-shadow-sm"
      role="img"
      aria-label={`Thẻ Ngôi sao hy vọng úp số ${index + 1}`}
    >
      <rect
        x="2"
        y="2"
        width="136"
        height="204"
        rx="14"
        className="fill-surface-bright stroke-amber-400"
        strokeWidth="2.5"
      />
      <rect x="9" y="9" width="122" height="190" rx="10" className="fill-brand-navy" />
      <ellipse
        cx="70"
        cy="102"
        rx="50"
        ry="74"
        transform="rotate(-24 70 102)"
        className="fill-brand-navyHover stroke-amber-300/80"
        strokeWidth="2.5"
      />
      {/* Ngôi sao 5 cánh vàng ở tâm lá bài */}
      <polygon
        points="70,56 79,82 106,82 84,98 92,124 70,108 48,124 56,98 34,82 61,82"
        className="fill-amber-400 stroke-surface-bright"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="24" y="138" width="92" height="20" rx="6" className="fill-amber-300" />
      <text
        x="70"
        y="151"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        className="fill-ink-card"
      >
        NGÔI SAO
      </text>
      <text x="19" y="29" fontSize="13" fontWeight="700" className="fill-amber-300">
        #{index + 1}
      </text>
      <text
        x="121"
        y="181"
        textAnchor="end"
        fontSize="13"
        fontWeight="700"
        className="fill-amber-300"
      >
        #{index + 1}
      </text>
    </svg>
  );
}

export function UnoCardFrontSvg({
  kind,
  mode = 'uno',
}: {
  kind: UnoCardKind;
  mode?: 'uno' | 'hope-star';
}) {
  const cardBgClass =
    kind === 'skip'
      ? 'fill-brand-red'
      : kind === 'reverse'
        ? 'fill-amber-400'
        : kind === 'plus2'
          ? 'fill-sky-600'
          : 'fill-emerald-600';

  const symbolFillClass =
    kind === 'skip'
      ? 'fill-brand-red'
      : kind === 'reverse'
        ? 'fill-amber-500'
        : kind === 'plus2'
          ? 'fill-sky-600'
          : 'fill-emerald-600';

  const cornerText =
    kind === 'skip'
      ? '⊘'
      : kind === 'reverse'
        ? '⇄'
        : kind === 'plus2'
          ? '+2'
          : mode === 'hope-star'
            ? '+1'
            : '1';

  const labelUnder =
    mode === 'hope-star'
      ? kind === 'skip'
        ? 'BỎ QUA'
        : kind === 'plus2'
          ? '+2 CÂU HỎI'
          : '+1 CÂU HỎI'
      : kind === 'skip'
        ? 'MIỄN LƯỢT'
        : kind === 'reverse'
          ? 'GV TRẢ LỜI'
          : kind === 'plus2'
            ? '+2 CÂU HỎI'
            : '1 CÂU HỎI';

  const ariaLabel =
    mode === 'hope-star' && kind !== 'reverse'
      ? HOPE_STAR_CARDS[kind].title
      : UNO_CARDS[kind].title;

  return (
    <svg
      viewBox="0 0 140 208"
      className="h-full w-full drop-shadow-sm"
      role="img"
      aria-label={ariaLabel}
    >
      <rect
        x="2"
        y="2"
        width="136"
        height="204"
        rx="14"
        className="fill-surface-bright stroke-line-strong"
        strokeWidth="2"
      />
      <rect x="9" y="9" width="122" height="190" rx="10" className={cardBgClass} />

      {/* Elip trắng nghiêng đặc trưng bài UNO */}
      <ellipse
        cx="70"
        cy="102"
        rx="48"
        ry="70"
        transform="rotate(-24 70 102)"
        className="fill-white"
      />

      {/* Ký hiệu 2 góc */}
      <text
        x="18"
        y="31"
        fontSize={kind === 'plus2' ? '18' : '19'}
        fontWeight="800"
        className="fill-white stroke-ink-card/40"
        strokeWidth="1.5"
        paintOrder="stroke"
      >
        {cornerText}
      </text>
      <text
        x="122"
        y="179"
        textAnchor="end"
        fontSize={kind === 'plus2' ? '18' : '19'}
        fontWeight="800"
        className="fill-white stroke-ink-card/40"
        strokeWidth="1.5"
        paintOrder="stroke"
      >
        {cornerText}
      </text>

      {/* Biểu tượng chính giữa lá bài */}
      {kind === 'skip' && (
        <g transform="translate(70 100)">
          <circle
            cx="0"
            cy="0"
            r="30"
            fill="none"
            className="stroke-brand-red"
            strokeWidth="10"
          />
          <line
            x1="-20"
            y1="20"
            x2="20"
            y2="-20"
            className="stroke-brand-red"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </g>
      )}

      {kind === 'reverse' && (
        <g transform="translate(70 100) rotate(-32)">
          {/* Mũi tên phải trên */}
          <path
            d="M -22 -14 L 8 -14 L 8 -24 L 28 -8 L 8 8 L 8 -2 L -22 -2 Z"
            className="fill-amber-400 stroke-ink-card"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Mũi tên trái dưới */}
          <path
            d="M 22 14 L -8 14 L -8 24 L -28 8 L -8 -8 L -8 2 L 22 2 Z"
            className="fill-amber-400 stroke-ink-card"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </g>
      )}

      {kind === 'plus2' && (
        <g transform="translate(70 100)">
          <rect
            x="-22"
            y="-14"
            width="28"
            height="42"
            rx="5"
            transform="rotate(-10)"
            className="fill-sky-600 stroke-ink-card"
            strokeWidth="2.5"
          />
          <rect
            x="-4"
            y="-28"
            width="28"
            height="42"
            rx="5"
            transform="rotate(8)"
            className="fill-sky-500 stroke-ink-card"
            strokeWidth="2.5"
          />
        </g>
      )}

      {kind === 'normal' && (
        <text
          x="70"
          y="102"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={mode === 'hope-star' ? '48' : '58'}
          fontWeight="800"
          className={`${symbolFillClass} stroke-ink-card`}
          strokeWidth="2.5"
          paintOrder="stroke"
        >
          {mode === 'hope-star' ? '+1' : '1'}
        </text>
      )}

      {/* Nhãn tiếng Việt ngắn gọn phía dưới để cả lớp đọc từ xa */}
      <rect x="20" y="176" width="100" height="17" rx="5" className="fill-ink-card/80" />
      <text
        x="70"
        y="187"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        className="fill-white"
      >
        {labelUnder}
      </text>
    </svg>
  );
}

interface OddsFieldOption<K extends UnoCardKind> {
  key: K;
  label: string;
}

interface SharedSixCardBoardProps<K extends UnoCardKind> {
  mode: 'uno' | 'hope-star';
  title: string;
  subtitle: string;
  containerClassName: string;
  titleClassName: string;
  showStarIcon?: boolean;
  deck: UnoDeckSlot<K>[];
  pickedSlotIndex: number | null;
  odds: Record<K, number>;
  oddsFields: OddsFieldOption<K>[];
  oddsPresets: { id: string; label: string; odds: Record<K, number> }[];
  scanningIndex: number | null;
  isPicking: boolean;
  soundEnabled?: boolean;
  onPickCard: (index: number) => void;
  onAutoPickCard: () => void;
  onChangeOdds: (nextOdds: Record<K, number>) => void;
  onCancelBeforePick?: () => void;
}

function SharedSixCardBoard<K extends UnoCardKind>({
  mode,
  title,
  subtitle,
  containerClassName,
  titleClassName,
  showStarIcon = false,
  deck,
  pickedSlotIndex,
  odds,
  oddsFields,
  oddsPresets,
  scanningIndex,
  isPicking,
  soundEnabled = true,
  onPickCard,
  onAutoPickCard,
  onChangeOdds,
  onCancelBeforePick,
}: SharedSixCardBoardProps<K>) {
  const [showOddsConfig, setShowOddsConfig] = useState(false);
  const [revealOthers, setRevealOthers] = useState(false);
  const lastHoverSoundRef = useRef<{ index: number; atMs: number }>({ index: -1, atMs: 0 });

  const hasPicked = pickedSlotIndex !== null;

  useEffect(() => {
    if (!hasPicked) {
      setRevealOthers(false);
      lastHoverSoundRef.current = { index: -1, atMs: 0 };
      return;
    }
    // Lật lá đã chọn ngay lập tức, sau 450ms bắt đầu hiệu ứng lật nối tiếp 5 lá còn lại
    const timer = window.setTimeout(() => {
      setRevealOthers(true);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [hasPicked, pickedSlotIndex, deck]);

  function triggerCardHoverSound(idx: number) {
    if (!soundEnabled || hasPicked || isPicking) return;
    const now = performance.now();
    const prev = lastHoverSoundRef.current;
    // Chống dội âm khi con trỏ rung nhẹ trên cùng một thẻ bài
    if (prev.index === idx && now - prev.atMs < 140) return;
    if (now - prev.atMs < 35) return;
    lastHoverSoundRef.current = { index: idx, atMs: now };
    playUnoCardHover(idx, mode);
  }

  function isFocusVisibleTarget(el: HTMLButtonElement): boolean {
    try {
      return el.matches(':focus-visible');
    } catch {
      return false;
    }
  }

  let nonPickedSeq = 0;

  return (
    <div className={`flex flex-col gap-4 rounded-xl border p-4 ${containerClassName}`}>
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2">
          <p className={`inline-flex items-center gap-2 text-sm font-bold ${titleClassName}`}>
            {showStarIcon && <Star className="h-4 w-4 shrink-0" aria-hidden="true" />}
            <span>{title}</span>
          </p>
          <p className="text-xs font-normal text-ink-secondary">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hasPicked && onCancelBeforePick && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPicking}
              onClick={onCancelBeforePick}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Quay lại thẻ đầu</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={showOddsConfig ? 'navy' : 'secondary'}
            onClick={() => setShowOddsConfig((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>Tỉ lệ %</span>
          </Button>
          {!hasPicked && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={isPicking}
              onClick={onAutoPickCard}
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              <span>Bốc ngẫu nhiên</span>
            </Button>
          )}
        </div>
      </div>

      {showOddsConfig && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-primary">
              Tùy chỉnh trọng số (%) xuất hiện cho bộ 6 lá:
            </span>
            <div className="flex flex-wrap gap-2">
              {oddsPresets.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onChangeOdds(preset.odds)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div
            className={`grid grid-cols-2 gap-2 ${
              oddsFields.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'
            }`}
          >
            {oddsFields.map((item) => (
              <label
                key={item.key}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface-page p-2 text-xs font-semibold text-ink-secondary"
              >
                <span>{item.label} (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={odds[item.key]}
                  onChange={(e) => {
                    const nextVal = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    onChangeOdds({ ...odds, [item.key]: nextVal });
                  }}
                  className="w-full rounded-lg border border-line-strong bg-surface-card px-2 py-2 text-sm font-bold text-ink-primary focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Hàng 6 lá bài 3D */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-6">
        {deck.map((slot, idx) => {
          const isPicked = pickedSlotIndex === idx;
          const isOtherRevealed = hasPicked && !isPicked && revealOthers;
          const isFlipped = isPicked || isOtherRevealed;
          const isScanned = !hasPicked && scanningIndex === idx;

          const otherWaveRank = !isPicked ? nonPickedSeq++ : 0;
          const flipDelayMs = !isPicked && isOtherRevealed ? otherWaveRank * 110 : 0;
          const tiltClass = !hasPicked ? FAN_TILT_CLASSES[idx % FAN_TILT_CLASSES.length] : '';

          const cardTitle =
            mode === 'hope-star' && slot.kind !== 'reverse'
              ? HOPE_STAR_CARDS[slot.kind as HopeStarCardKind].title
              : UNO_CARDS[slot.kind].title;

          return (
            <div
              key={slot.slotId}
              style={{ animationDelay: `${idx * 65}ms` }}
              className="uno-deal-in flex flex-col items-center gap-2"
            >
              <button
                type="button"
                disabled={hasPicked || isPicking}
                onClick={() => onPickCard(idx)}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'touch') {
                    triggerCardHoverSound(idx);
                  }
                }}
                onFocus={(e) => {
                  if (isFocusVisibleTarget(e.currentTarget)) {
                    triggerCardHoverSound(idx);
                  }
                }}
                aria-label={
                  isFlipped
                    ? `Lá #${idx + 1}: ${cardTitle}`
                    : `Chọn lá bài ${mode === 'hope-star' ? 'Ngôi sao hy vọng' : 'UNO'} số ${idx + 1}`
                }
                className={`group relative aspect-[2/3] w-full max-w-[124px] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy ${
                  isPicked ? 'z-10' : !hasPicked && !isPicking ? 'cursor-pointer hover:z-10' : ''
                }`}
              >
                <div
                  className={`uno-perspective h-full w-full rounded-xl transition-all duration-300 ${tiltClass} ${
                    !hasPicked
                      ? isScanned
                        ? '-translate-y-2 scale-105 rotate-0 ring-4 ring-brand-red/40'
                        : 'group-hover:-translate-y-2 group-hover:scale-105 group-hover:rotate-0 group-hover:ring-2 group-hover:ring-brand-red/35'
                      : isPicked
                        ? '-translate-y-2 scale-105 rotate-0 ring-4 ring-brand-red/35 uno-chosen-glow'
                        : isOtherRevealed
                          ? 'scale-95 rotate-0 opacity-75'
                          : 'opacity-80'
                  }`}
                >
                  <div
                    style={{ transitionDelay: `${flipDelayMs}ms` }}
                    className={`uno-card-inner h-full w-full ${isFlipped ? 'is-flipped' : ''}`}
                  >
                    {/* Mặt úp */}
                    <div className="uno-card-face absolute inset-0 h-full w-full overflow-hidden rounded-xl">
                      {mode === 'hope-star' ? (
                        <HopeStarCardBackSvg index={idx} />
                      ) : (
                        <UnoCardBackSvg index={idx} />
                      )}
                    </div>

                    {/* Mặt ngửa */}
                    <div className="uno-card-face uno-card-face-front absolute inset-0 h-full w-full overflow-hidden rounded-xl">
                      <UnoCardFrontSvg kind={slot.kind} mode={mode} />
                    </div>
                  </div>
                </div>
              </button>

              {isPicked && <Badge tone={mode === 'hope-star' ? 'warning' : 'red'}>Đã chọn</Badge>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface UnoSixCardBoardProps {
  studentName: string;
  deck: UnoDeckSlot<UnoCardKind>[];
  pickedSlotIndex: number | null;
  odds: UnoOddsConfig;
  scanningIndex: number | null;
  isPicking: boolean;
  soundEnabled?: boolean;
  onPickCard: (index: number) => void;
  onAutoPickCard: () => void;
  onChangeOdds: (nextOdds: UnoOddsConfig) => void;
}

export function UnoSixCardBoard({
  studentName,
  deck,
  pickedSlotIndex,
  odds,
  scanningIndex,
  isPicking,
  soundEnabled = true,
  onPickCard,
  onAutoPickCard,
  onChangeOdds,
}: UnoSixCardBoardProps) {
  const hasPicked = pickedSlotIndex !== null;
  const normalized = normalizeUnoPercentages(odds);

  return (
    <SharedSixCardBoard
      mode="uno"
      title={
        hasPicked
          ? `Kết quả bốc 6 lá UNO của ${studentName}`
          : `Mời ${studentName} chọn 1 trong 6 lá bài UNO úp`
      }
      subtitle={
        hasPicked
          ? 'Lá bạn chọn được đánh dấu nổi bật; 5 lá còn lại tự động lật mở để cả lớp cùng xem.'
          : `Xác suất: Thường ${normalized.normal}% · Skip ${normalized.skip}% · Đảo chiều ${normalized.reverse}% · +2 ${normalized.plus2}%`
      }
      containerClassName="border-line bg-surface-page"
      titleClassName="text-brand-navy"
      deck={deck}
      pickedSlotIndex={pickedSlotIndex}
      odds={odds}
      oddsFields={[
        { key: 'normal', label: 'Trả bài (1 câu)' },
        { key: 'skip', label: 'Cấm lượt (Skip)' },
        { key: 'reverse', label: 'Đảo chiều (GV)' },
        { key: 'plus2', label: 'Cộng hai (+2)' },
      ]}
      oddsPresets={UNO_ODDS_PRESETS}
      scanningIndex={scanningIndex}
      isPicking={isPicking}
      soundEnabled={soundEnabled}
      onPickCard={onPickCard}
      onAutoPickCard={onAutoPickCard}
      onChangeOdds={onChangeOdds}
    />
  );
}

interface HopeStarCardBoardProps {
  studentName: string;
  baseCardTitle: string;
  deck: UnoDeckSlot<HopeStarCardKind>[];
  pickedSlotIndex: number | null;
  odds: HopeStarOddsConfig;
  scanningIndex: number | null;
  isPicking: boolean;
  soundEnabled?: boolean;
  onPickCard: (index: number) => void;
  onAutoPickCard: () => void;
  onChangeOdds: (nextOdds: HopeStarOddsConfig) => void;
  onCancelBeforePick: () => void;
}

export function HopeStarCardBoard({
  studentName,
  baseCardTitle,
  deck,
  pickedSlotIndex,
  odds,
  scanningIndex,
  isPicking,
  soundEnabled = true,
  onPickCard,
  onAutoPickCard,
  onChangeOdds,
  onCancelBeforePick,
}: HopeStarCardBoardProps) {
  const hasPicked = pickedSlotIndex !== null;
  const normalized = normalizeHopeStarPercentages(odds);

  return (
    <SharedSixCardBoard
      mode="hope-star"
      showStarIcon
      title={
        hasPicked
          ? `Kết quả Ngôi sao hy vọng của ${studentName}`
          : `Ngôi sao hy vọng · Mời ${studentName} chọn 1 trong 6 lá bài`
      }
      subtitle={
        hasPicked
          ? `Đã lật xong vòng Ngôi sao hy vọng (ghép cùng lá ban đầu: ${baseCardTitle}).`
          : `Đang giữ lá "${baseCardTitle}". Xác suất: Bỏ qua (Skip) ${normalized.skip}% · +1 câu ${normalized.normal}% · +2 câu ${normalized.plus2}%`
      }
      containerClassName="border-status-warningBorder bg-status-warningBg/50"
      titleClassName="text-status-warningText"
      deck={deck}
      pickedSlotIndex={pickedSlotIndex}
      odds={odds}
      oddsFields={[
        { key: 'skip', label: 'Bỏ qua (Skip)' },
        { key: 'normal', label: 'Cộng thêm +1 câu' },
        { key: 'plus2', label: 'Cộng thêm +2 câu' },
      ]}
      oddsPresets={HOPE_STAR_ODDS_PRESETS}
      scanningIndex={scanningIndex}
      isPicking={isPicking}
      soundEnabled={soundEnabled}
      onPickCard={onPickCard}
      onAutoPickCard={onAutoPickCard}
      onChangeOdds={onChangeOdds}
      onCancelBeforePick={onCancelBeforePick}
    />
  );
}


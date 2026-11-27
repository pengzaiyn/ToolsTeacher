import { useLayoutEffect, useRef } from 'react';
import { RotateCw, Shuffle, Sparkles } from 'lucide-react';
import type { KitStudent } from '@/lib/classroomKit';
import { Button } from '@/components/ui/Button';

function MysteryCardBackSvg({
  number,
  highlighted,
}: {
  number: number;
  highlighted: boolean;
}) {
  const padded = number < 10 ? `0${number}` : String(number);
  return (
    <svg
      viewBox="0 0 160 228"
      className="h-full w-full select-none drop-shadow-sm"
      role="img"
      aria-label={`Thẻ bí ẩn số ${number}`}
    >
      {/* Viền ngoài lá bài */}
      <rect
        x="2"
        y="2"
        width="156"
        height="224"
        rx="14"
        className={
          highlighted
            ? 'fill-amber-200 stroke-brand-red'
            : 'fill-surface-card stroke-amber-300/90'
        }
        strokeWidth="2.5"
      />

      {/* Nền chính huyền bí */}
      <rect
        x="8"
        y="8"
        width="144"
        height="212"
        rx="10"
        className={highlighted ? 'fill-brand-red' : 'fill-brand-navy'}
      />

      {/* Khung chỉ vàng kép bên trong */}
      <rect
        x="15"
        y="15"
        width="130"
        height="198"
        rx="7"
        fill="none"
        className="stroke-amber-300/55"
        strokeWidth="1.2"
      />
      <rect
        x="20"
        y="20"
        width="120"
        height="188"
        rx="5"
        fill="none"
        strokeDasharray="3 3"
        className="stroke-amber-200/35"
        strokeWidth="1"
      />

      {/* Họa tiết thoi chiêm tinh & tia chéo mờ */}
      <line x1="22" y1="22" x2="138" y2="206" className="stroke-white/10" strokeWidth="1" />
      <line x1="138" y1="22" x2="22" y2="206" className="stroke-white/10" strokeWidth="1" />
      <polygon
        points="80,28 134,114 80,200 26,114"
        className="fill-white/5 stroke-amber-300/40"
        strokeWidth="1.2"
      />

      {/* Dấu sao 4 góc khung trong */}
      <circle cx="24" cy="24" r="2" className="fill-amber-300/75" />
      <circle cx="136" cy="24" r="2" className="fill-amber-300/75" />
      <circle cx="24" cy="204" r="2" className="fill-amber-300/75" />
      <circle cx="136" cy="204" r="2" className="fill-amber-300/75" />

      {/* Biểu tượng trăng khuyết / sao đỉnh và đáy thoi */}
      <polygon
        points="80,38 83,45 90,48 83,51 80,58 77,51 70,48 77,45"
        className="fill-amber-300/85"
      />
      <polygon
        points="80,170 83,177 90,180 83,183 80,190 77,183 70,180 77,177"
        className="fill-amber-300/85"
      />

      {/* Vòng cổ ngữ đồng tâm ở tâm lá bài */}
      <circle
        cx="80"
        cy="114"
        r="46"
        fill="none"
        strokeDasharray="5 3"
        className="stroke-amber-300/75"
        strokeWidth="1.5"
      />
      <circle
        cx="80"
        cy="114"
        r="39"
        fill="none"
        className="stroke-white/25"
        strokeWidth="1"
      />

      {/* Ngôi sao la bàn 8 cánh bao quanh ấn số */}
      <polygon
        points="80,62 88,96 122,84 96,108 132,114 96,120 122,144 88,132 80,166 72,132 38,144 64,120 28,114 64,108 38,84 72,96"
        className="fill-amber-300/80"
      />

      {/* Huy hiệu tròn trung tâm in số thứ tự */}
      <circle
        cx="80"
        cy="114"
        r="27"
        className={
          highlighted
            ? 'fill-brand-navy stroke-amber-300'
            : 'fill-brand-red stroke-amber-300'
        }
        strokeWidth="2.5"
      />
      <circle
        cx="80"
        cy="114"
        r="22"
        fill="none"
        className="stroke-white/40"
        strokeWidth="1"
      />
      <text
        x="80"
        y="115"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={number >= 100 ? '19' : '24'}
        fontWeight="800"
        letterSpacing="0.5"
        className="fill-white"
      >
        {padded}
      </text>

      {/* Số chỉ mục ở 2 góc chéo giống bộ bài thật */}
      <text
        x="24"
        y="38"
        fontSize="13"
        fontWeight="800"
        className="fill-amber-300"
      >
        #{number}
      </text>
      <text
        x="136"
        y="198"
        textAnchor="end"
        fontSize="13"
        fontWeight="800"
        className="fill-amber-300"
      >
        #{number}
      </text>
    </svg>
  );
}

function formatWheelLabel(fullName: string, total: number): string {
  const clean = fullName.trim().replace(/\s+/g, ' ');
  const maxLen = total > 32 ? 10 : total > 18 ? 12 : 13;
  if (clean.length <= maxLen) return clean;
  const parts = clean.split(' ');
  if (parts.length >= 2) {
    if (total > 24) {
      const compactDots = `${parts
        .slice(0, -1)
        .map((w) => `${w[0]}.`)
        .join('')}${parts[parts.length - 1]}`;
      if (compactDots.length <= maxLen) return compactDots;
    }
    if (parts.length >= 3) {
      const compact = `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
      if (compact.length <= maxLen) return compact;
      const shortMid = `${parts
        .slice(0, -1)
        .map((w) => `${w[0]}.`)
        .join(' ')} ${parts[parts.length - 1]}`;
      if (shortMid.length <= maxLen) return shortMid;
    }
  }
  return `${clean.slice(0, Math.max(4, maxLen - 1))}…`;
}

function getWheelFontSize(total: number): number {
  if (total <= 12) return 11;
  if (total <= 20) return 9;
  if (total <= 32) return 7.5;
  if (total <= 45) return 6;
  return 5;
}

function getSliceStyle(index: number, total: number) {
  const palette = [
    { path: 'fill-brand-navy', text: 'fill-white' },
    { path: 'fill-brand-red', text: 'fill-white' },
    { path: 'fill-brand-navySoft', text: 'fill-brand-navyText' },
    { path: 'fill-brand-redSoft', text: 'fill-brand-redText' },
  ];
  if (index === total - 1 && total > 2 && total % 4 === 1) {
    return { path: 'fill-surface-subtle', text: 'fill-brand-navyText' };
  }
  return palette[index % palette.length];
}

function describeSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

interface SpinWheelStageProps {
  totalAvailable: number;
  displaySlots: KitStudent[];
  rotationDeg: number;
  spinning: boolean;
  canSpin: boolean;
  onSpin: () => void;
  disabledLabel?: string;
}

export function SpinWheelStage({
  totalAvailable,
  displaySlots,
  rotationDeg,
  spinning,
  canSpin,
  onSpin,
  disabledLabel,
}: SpinWheelStageProps) {
  const slots = displaySlots.length === 1 ? [displaySlots[0], displaySlots[0]] : displaySlots;
  const count = slots.length;
  const sliceAngle = count > 0 ? 360 / count : 360;
  const fontSize = getWheelFontSize(count);
  const labelRadius = count > 18 ? 108 : 102;
  const sliceStrokeWidth = count > 30 ? 0.8 : count > 18 ? 1.2 : 2;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`relative flex w-full items-center justify-center ${
          count > 16 ? 'max-w-[340px] sm:max-w-[420px]' : 'max-w-[320px] sm:max-w-[340px]'
        }`}
      >
        {/* Kim chỉ cố định ở đỉnh 12 giờ */}
        <svg
          viewBox="0 0 360 360"
          className="h-auto w-full drop-shadow-sm"
          role="img"
          aria-label="Vòng quay trả bài"
        >
          <circle cx={180} cy={180} r={170} className="fill-surface-card stroke-line-strong stroke-2" />
          {count === 0 ? (
            <circle cx={180} cy={180} r={162} className="fill-surface-subtle stroke-line stroke-2" />
          ) : (
            <g transform={`rotate(${rotationDeg} 180 180)`}>
              {slots.map((student, idx) => {
                const startDeg = idx * sliceAngle;
                const endDeg = (idx + 1) * sliceAngle;
                const centerDeg = (idx + 0.5) * sliceAngle;
                const style = getSliceStyle(idx, count);
                return (
                  <g key={`${student.id}-${idx}`}>
                    <path
                      d={describeSlicePath(180, 180, 162, startDeg, endDeg)}
                      strokeWidth={sliceStrokeWidth}
                      className={`${style.path} stroke-surface-card`}
                    />
                    <text
                      x={180 + labelRadius}
                      y={180}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      transform={`rotate(${centerDeg - 90} 180 180)`}
                      className={`${style.text} select-none font-bold`}
                    >
                      {formatWheelLabel(student.name, count)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Trục tâm vòng quay */}
          <circle
            cx={180}
            cy={180}
            r={28}
            strokeWidth={4}
            className="fill-surface-card stroke-brand-navy"
          />
          <circle cx={180} cy={180} r={10} className="fill-brand-red" />

          {/* Kim chỉ trên cùng */}
          <polygon
            points="180,34 166,4 194,4"
            className="fill-brand-red stroke-surface-card stroke-2"
          />
        </svg>
      </div>

      {totalAvailable === 0 && (
        <p className="text-center text-xs font-normal text-ink-muted">
          Không còn sinh viên nào trong danh sách chọn random. Bấm &quot;Làm mới phiên&quot; để nạp lại.
        </p>
      )}

      {totalAvailable > 0 && (
        <p className="text-center text-xs font-normal text-ink-muted">
          Đang hiển thị toàn bộ {totalAvailable} sinh viên hợp lệ trên vòng quay.
        </p>
      )}

      <Button
        variant="primary"
        onClick={onSpin}
        loading={spinning}
        disabled={!canSpin}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span>
          {spinning
            ? 'Đang quay chọn...'
            : !canSpin
              ? disabledLabel ?? 'Đã hết sinh viên'
              : 'Quay chọn người trả bài'}
        </span>
      </Button>
    </div>
  );
}

interface MysteryCardsStageProps {
  cards: KitStudent[];
  totalAvailable: number;
  activeStudentId: string | null;
  calledStudentIds: ReadonlySet<string>;
  noRepeat: boolean;
  highlightedIndex: number | null;
  drawing: boolean;
  shuffling: boolean;
  canPick: boolean;
  turnLockedMessage?: string | null;
  onPickCard: (student: KitStudent) => void;
  onAutoPick: () => void;
  onReshuffle: () => void;
}

export function MysteryCardsStage({
  cards,
  totalAvailable,
  activeStudentId,
  calledStudentIds,
  noRepeat,
  highlightedIndex,
  drawing,
  shuffling,
  canPick,
  turnLockedMessage,
  onPickCard,
  onAutoPick,
  onReshuffle,
}: MysteryCardsStageProps) {
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const oldRects = prevRectsRef.current;
    const nextRects = new Map<string, DOMRect>();
    const elementsToAnimate: { el: HTMLButtonElement; dx: number; dy: number; isUpperLayer: boolean }[] = [];

    // Đưa về vị trí gốc trước khi đo tọa độ đích để tránh lệch khi đang chạy animation trước đó
    cards.forEach((student) => {
      const el = cardRefs.current.get(student.id);
      if (!el) return;
      el.style.transition = 'none';
      el.style.transform = '';
      el.style.zIndex = '';
    });

    cards.forEach((student, idx) => {
      const el = cardRefs.current.get(student.id);
      if (!el) return;
      const newRect = el.getBoundingClientRect();
      nextRects.set(student.id, newRect);

      if (shuffling && oldRects.size > 0) {
        const oldRect = oldRects.get(student.id);
        if (oldRect) {
          const dx = oldRect.left - newRect.left;
          const dy = oldRect.top - newRect.top;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            elementsToAnimate.push({ el, dx, dy, isUpperLayer: idx % 2 === 0 });
          }
        }
      }
    });

    prevRectsRef.current = nextRects;

    if (elementsToAnimate.length === 0) return;

    // Invert: đặt thẻ ngay tại tọa độ cũ (kèm độ lệch scale nhẹ để 2 thẻ lướt qua nhau có chiều sâu)
    elementsToAnimate.forEach(({ el, dx, dy, isUpperLayer }) => {
      el.style.transition = 'none';
      el.style.zIndex = isUpperLayer ? '20' : '10';
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${isUpperLayer ? 1.04 : 0.95})`;
    });

    // Force reflow rồi Play về vị trí mới
    if (elementsToAnimate[0]) {
      elementsToAnimate[0].el.getBoundingClientRect();
    }

    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      elementsToAnimate.forEach(({ el }) => {
        el.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = '';
      });
    });

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [cards, shuffling]);

  const isDense = cards.length > 30;
  const isCompact = cards.length > 16;

  const gridColsClass =
    cards.length === 1
      ? 'mx-auto w-full max-w-[180px] grid-cols-1'
      : cards.length === 2
        ? 'mx-auto w-full max-w-[376px] grid-cols-2'
        : cards.length === 3
          ? 'mx-auto w-full max-w-[560px] grid-cols-3'
          : cards.length <= 8
            ? 'mx-auto w-full max-w-3xl grid-cols-2 sm:grid-cols-4'
            : isDense
              ? 'grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9'
              : isCompact
                ? 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7'
                : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-xs font-normal text-ink-secondary">
          Chọn trực tiếp 1 thẻ bất kỳ để lật tên hoặc bấm rút ngẫu nhiên.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onReshuffle}
            disabled={!canPick || drawing || shuffling || totalAvailable <= 1}
          >
            <RotateCw
              className={`h-4 w-4 text-brand-navy ${shuffling ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{shuffling ? 'Đang xào...' : 'Xào thẻ'}</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onAutoPick}
            loading={drawing}
            disabled={!canPick || shuffling}
          >
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            <span>Rút ngẫu nhiên</span>
          </Button>
        </div>
      </div>

      {turnLockedMessage && (
        <div className="rounded-lg border border-brand-navy/20 bg-brand-navySoft px-4 py-2 text-xs font-semibold text-brand-navy">
          {turnLockedMessage}
        </div>
      )}

      {cards.length > 0 && (
        <p className="text-xs font-normal text-ink-muted">
          Đang bày toàn bộ {cards.length} thẻ ({totalAvailable} SV chưa gọi). Bấm &quot;Xào thẻ&quot; để tráo lại vị trí.
        </p>
      )}

      {cards.length === 0 ? (
        <p className="py-6 text-center text-sm font-normal text-ink-muted">
          Không còn sinh viên nào trong lượt chọn ngẫu nhiên. Bấm &quot;Làm mới phiên&quot; để nạp lại danh sách.
        </p>
      ) : (
        <div
          className={`grid ${isDense ? 'max-h-[520px] gap-2.5 overflow-y-auto pr-1' : isCompact ? 'gap-3' : 'gap-4'} ${gridColsClass}`}
        >
          {cards.map((student, idx) => {
            const isCurrent = activeStudentId === student.id;
            const isDone = noRepeat && !isCurrent && calledStudentIds.has(student.id);
            const isRevealed = isCurrent || isDone;
            const isHighlighted = highlightedIndex === idx;
            return (
              <button
                key={student.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(student.id, node);
                  else cardRefs.current.delete(student.id);
                }}
                type="button"
                disabled={!canPick || drawing || shuffling || isRevealed}
                onClick={() => onPickCard(student)}
                className={`group relative aspect-[5/7] w-full min-w-0 overflow-hidden rounded-xl text-center ${
                  shuffling ? 'shadow-md' : 'transition-transform duration-200'
                } ${
                  isRevealed
                    ? isCurrent
                      ? 'flex flex-col items-center justify-center gap-1.5 border-2 border-brand-red bg-brand-redSoft p-2.5 text-brand-navy shadow-sm'
                      : 'flex flex-col items-center justify-center gap-1 border border-line bg-surface-subtle p-2 text-ink-secondary'
                    : isHighlighted
                      ? '-translate-y-1 scale-[1.03] shadow-lg ring-2 ring-brand-red'
                      : 'hover:-translate-y-1 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-80'
                }`}
              >
                {isRevealed ? (
                  <>
                    <span
                      className={`whitespace-nowrap font-bold uppercase ${
                        isDense ? 'text-[10px]' : 'text-xs'
                      } ${
                        isCurrent ? 'text-brand-red' : 'text-ink-muted'
                      }`}
                    >
                      {isCurrent ? `#${idx + 1} · Đang gọi` : `#${idx + 1} · Đã gọi`}
                    </span>
                    <span
                      className={`line-clamp-3 break-words font-bold leading-snug ${
                        isDense ? 'text-[11px]' : 'text-sm'
                      } ${
                        isCurrent ? 'text-brand-navy' : 'text-ink-secondary'
                      }`}
                    >
                      {student.name}
                    </span>
                    {student.code && !isDense && (
                      <span className="max-w-full truncate text-[11px] font-normal tabular-nums text-ink-muted">
                        {student.code}
                      </span>
                    )}
                  </>
                ) : (
                  <MysteryCardBackSvg number={idx + 1} highlighted={isHighlighted} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

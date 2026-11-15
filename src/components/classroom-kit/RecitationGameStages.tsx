import { useLayoutEffect, useRef } from 'react';
import { HelpCircle, RotateCw, Shuffle, Sparkles } from 'lucide-react';
import type { KitStudent } from '@/lib/classroomKit';
import { Button } from '@/components/ui/Button';

function formatWheelLabel(fullName: string): string {
  const clean = fullName.trim().replace(/\s+/g, ' ');
  if (clean.length <= 13) return clean;
  const parts = clean.split(' ');
  if (parts.length >= 3) {
    const compact = `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
    if (compact.length <= 13) return compact;
    const shortMid = `${parts
      .slice(0, -1)
      .map((w) => `${w[0]}.`)
      .join(' ')} ${parts[parts.length - 1]}`;
    if (shortMid.length <= 13) return shortMid;
  }
  return `${clean.slice(0, 12)}…`;
}

function getSliceStyle(index: number, total: number) {
  const palette = [
    { path: 'fill-brand-navy', text: 'fill-white' },
    { path: 'fill-brand-red', text: 'fill-white' },
    { path: 'fill-brand-navySoft', text: 'fill-brand-navy' },
    { path: 'fill-brand-redSoft', text: 'fill-brand-red' },
  ];
  if (index === total - 1 && total > 2 && total % 4 === 1) {
    return { path: 'fill-surface-subtle', text: 'fill-brand-navy' };
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

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex w-full max-w-[320px] items-center justify-center sm:max-w-[340px]">
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
                      className={`${style.path} stroke-surface-card stroke-2`}
                    />
                    <text
                      x={180 + 102}
                      y={180}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      transform={`rotate(${centerDeg - 90} 180 180)`}
                      className={`${style.text} select-none font-bold`}
                    >
                      {formatWheelLabel(student.name)}
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

      {totalAvailable > 12 && (
        <p className="text-center text-xs font-normal text-ink-muted">
          Vòng quay hiển thị đại diện 12 ô để dễ đọc; kết quả quay vẫn chọn công bằng từ toàn bộ{' '}
          {totalAvailable} sinh viên còn lại.
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

  const gridColsClass =
    cards.length === 1
      ? 'mx-auto w-full max-w-xs grid-cols-1'
      : cards.length === 2
        ? 'mx-auto w-full max-w-lg grid-cols-2'
        : cards.length === 3
          ? 'grid-cols-2 sm:grid-cols-3'
          : 'grid-cols-2 sm:grid-cols-4';

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

      {totalAvailable > cards.length && cards.length > 0 && (
        <p className="text-xs font-normal text-ink-muted">
          Đang bày ngẫu nhiên {cards.length} thẻ (còn {totalAvailable} SV chưa gọi). Bấm &quot;Xào thẻ&quot; để đổi bộ thẻ khác.
        </p>
      )}

      {cards.length === 0 ? (
        <p className="py-6 text-center text-sm font-normal text-ink-muted">
          Không còn sinh viên nào trong lượt chọn ngẫu nhiên. Bấm &quot;Làm mới phiên&quot; để nạp lại danh sách.
        </p>
      ) : (
        <div className={`grid gap-4 ${gridColsClass}`}>
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
                className={`relative flex min-h-[112px] min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border p-4 text-center ${
                  shuffling ? 'shadow-md' : 'transition-all'
                } ${
                  isCurrent
                    ? 'border-2 border-brand-red bg-brand-redSoft text-brand-navy shadow-sm'
                    : isDone
                      ? 'border-line bg-surface-subtle text-ink-secondary'
                      : isHighlighted
                        ? 'border-2 border-brand-red bg-brand-red text-white shadow-md'
                        : 'border-brand-navy/20 bg-brand-navy text-white hover:-translate-y-0.5 hover:bg-brand-navyHover disabled:cursor-not-allowed disabled:opacity-80'
                }`}
              >
                {isRevealed ? (
                  <>
                    <span
                      className={`whitespace-nowrap text-xs font-bold uppercase ${
                        isCurrent ? 'text-brand-red' : 'text-ink-muted'
                      }`}
                    >
                      {isCurrent ? `Thẻ #${idx + 1} · Đang gọi` : `Thẻ #${idx + 1} · Đã gọi`}
                    </span>
                    <span
                      className={`line-clamp-2 break-words text-sm font-bold leading-snug ${
                        isCurrent ? 'text-brand-navy' : 'text-ink-secondary'
                      }`}
                    >
                      {student.name}
                    </span>
                    {student.code && (
                      <span className="max-w-full truncate text-xs font-normal tabular-nums text-ink-muted">
                        {student.code}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                      <HelpCircle className="h-4 w-4 text-white" aria-hidden="true" />
                    </div>
                    <span className="whitespace-nowrap text-base font-bold">Thẻ #{idx + 1}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

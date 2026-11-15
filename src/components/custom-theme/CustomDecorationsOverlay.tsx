import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Cookie,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Heart,
  Maximize2,
  Moon,
  RotateCcw,
  RotateCw,
  Sun,
  Trash2,
} from 'lucide-react';
import { useCustomTheme } from '@/context/CustomThemeContext';
import {
  PET_CATALOG,
  type PetSize,
  type PlacedSticker,
  type StickerSize,
} from '@/lib/customTheme';
import { PetArtwork, type PetMood } from '@/components/custom-theme/PetArtwork';
import { StickerArtwork } from '@/components/custom-theme/StickerArtwork';

const STICKER_SIZE_CLASSES: Record<StickerSize, string> = {
  sm: 'h-14 w-14',
  md: 'h-20 w-20',
  lg: 'h-28 w-28',
};

const STICKER_SIZE_CYCLE: Record<StickerSize, StickerSize> = {
  sm: 'md',
  md: 'lg',
  lg: 'sm',
};

const PET_SIZE_CLASSES: Record<PetSize, string> = {
  sm: 'h-16 w-16',
  md: 'h-[84px] w-[84px]',
  lg: 'h-28 w-28',
};

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function CustomDecorationsOverlay() {
  const {
    customTheme,
    updateSticker,
    removeSticker,
    updatePetSettings,
    toggleDecorationsHidden,
  } = useCustomTheme();

  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [draggingSticker, setDraggingSticker] = useState<{
    instanceId: string;
    xPct: number;
    yPct: number;
  } | null>(null);

  const dragStartRef = useRef<{
    instanceId: string;
    startClientX: number;
    startClientY: number;
    origXPct: number;
    origYPct: number;
    moved: boolean;
  } | null>(null);

  // Trạng thái & chuyển động của Pet
  const [petMood, setPetMood] = useState<PetMood>('idle');
  const [petManualSleep, setPetManualSleep] = useState(false);
  const [petFacingLeft, setPetFacingLeft] = useState(false);
  const [petPos, setPetPos] = useState<{ xPct: number; yPct: number }>({
    xPct: customTheme.pet.xPct,
    yPct: customTheme.pet.yPct,
  });
  const [speechText, setSpeechText] = useState<string | null>(null);
  const [petMenuOpen, setPetMenuOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const petPosRef = useRef(petPos);
  petPosRef.current = petPos;

  const petDraggingRef = useRef<{
    startClientX: number;
    startClientY: number;
    origXPct: number;
    origYPct: number;
    moved: boolean;
  } | null>(null);

  const moodTimerRef = useRef<number | null>(null);
  const speechTimerRef = useRef<number | null>(null);
  const quoteIndexRef = useRef(0);

  const petMeta = useMemo(
    () => PET_CATALOG.find((item) => item.id === customTheme.pet.id) ?? null,
    [customTheme.pet.id]
  );

  // Theo dõi prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Phím tắt Alt + Shift + H ẩn/hiện nhanh trang trí
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'h') {
        if (
          customTheme.enabled &&
          (customTheme.stickers.length > 0 || customTheme.pet.id !== 'none')
        ) {
          event.preventDefault();
          toggleDecorationsHidden();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    customTheme.enabled,
    customTheme.stickers.length,
    customTheme.pet.id,
    toggleDecorationsHidden,
  ]);

  // Đồng bộ vị trí khi đổi cài đặt pet từ Settings
  useEffect(() => {
    setPetPos({ xPct: customTheme.pet.xPct, yPct: customTheme.pet.yPct });
  }, [customTheme.pet.xPct, customTheme.pet.yPct, customTheme.pet.id]);

  // Đóng toolbar sticker khi bấm ngoài
  useEffect(() => {
    if (!selectedStickerId) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-custom-sticker]')) {
        setSelectedStickerId(null);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [selectedStickerId]);

  useEffect(() => {
    return () => {
      if (moodTimerRef.current) window.clearTimeout(moodTimerRef.current);
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    };
  }, []);

  // Hành vi đi dạo (roam) hoặc đi theo con trỏ (follow)
  useEffect(() => {
    if (
      !customTheme.enabled ||
      customTheme.decorationsHidden ||
      customTheme.pet.id === 'none' ||
      reducedMotion ||
      petManualSleep
    ) {
      return;
    }

    const behavior = customTheme.pet.behavior;
    if (behavior === 'perch') {
      if (petMood === 'walk') setPetMood('idle');
      return;
    }

    if (behavior === 'roam') {
      let rafId = 0;
      let targetX = petPosRef.current.xPct;
      let targetY = 85;
      let mode: 'walking' | 'resting' = 'resting';
      let nextSwitchAt = performance.now() + 1800;
      let lastTime = performance.now();

      const step = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        if (!petDraggingRef.current && petMood !== 'happy' && petMood !== 'eat') {
          if (now >= nextSwitchAt) {
            if (mode === 'resting') {
              mode = 'walking';
              const minX = window.innerWidth >= 768 ? 22 : 8;
              targetX = minX + Math.random() * (90 - minX);
              targetY = 82 + Math.random() * 6;
              setPetMood('walk');
              nextSwitchAt = now + 4500 + Math.random() * 3500;
            } else {
              mode = 'resting';
              setPetMood(Math.random() < 0.35 ? 'sleep' : 'idle');
              nextSwitchAt = now + 2600 + Math.random() * 3000;
            }
          }

          if (mode === 'walking') {
            const cur = petPosRef.current;
            const dx = targetX - cur.xPct;
            const dy = targetY - cur.yPct;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.6) {
              mode = 'resting';
              setPetMood('idle');
              nextSwitchAt = now + 2400 + Math.random() * 2400;
            } else {
              const speedPctPerSec = 5.5;
              const move = Math.min(dist, speedPctPerSec * dt);
              setPetFacingLeft(dx < -0.2);
              setPetPos({
                xPct: clamp(cur.xPct + (dx / dist) * move, 6, 92),
                yPct: clamp(cur.yPct + (dy / dist) * move, 12, 90),
              });
            }
          }
        }
        rafId = window.requestAnimationFrame(step);
      };

      rafId = window.requestAnimationFrame(step);
      return () => window.cancelAnimationFrame(rafId);
    }

    if (behavior === 'follow') {
      let targetXPct = petPosRef.current.xPct;
      let targetYPct = petPosRef.current.yPct;
      let rafId = 0;
      let lastTime = performance.now();

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return;
        const vw = Math.max(window.innerWidth, 1);
        const vh = Math.max(window.innerHeight, 1);
        targetXPct = clamp(((event.clientX + 54) / vw) * 100, 6, 92);
        targetYPct = clamp(((event.clientY + 42) / vh) * 100, 10, 90);
      };

      const step = (now: number) => {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        if (!petDraggingRef.current && petMood !== 'happy' && petMood !== 'eat') {
          const cur = petPosRef.current;
          const dx = targetXPct - cur.xPct;
          const dy = targetYPct - cur.yPct;
          const dist = Math.hypot(dx, dy);

          if (dist > 1.4) {
            const followSpeed = Math.min(28, dist * 2.2);
            const move = Math.min(dist, followSpeed * dt);
            if (Math.abs(dx) > 0.4) setPetFacingLeft(dx < 0);
            setPetMood('walk');
            setPetPos({
              xPct: clamp(cur.xPct + (dx / dist) * move, 6, 92),
              yPct: clamp(cur.yPct + (dy / dist) * move, 10, 90),
            });
          } else if (petMood === 'walk') {
            setPetMood('idle');
          }
        }
        rafId = window.requestAnimationFrame(step);
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      rafId = window.requestAnimationFrame(step);
      return () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.cancelAnimationFrame(rafId);
      };
    }
  }, [
    customTheme.enabled,
    customTheme.decorationsHidden,
    customTheme.pet.id,
    customTheme.pet.behavior,
    reducedMotion,
    petManualSleep,
    petMood,
  ]);

  if (!customTheme.enabled) {
    return null;
  }

  const hasStickers = customTheme.stickers.length > 0;
  const hasPet = customTheme.pet.id !== 'none' && petMeta !== null;
  if (!hasStickers && !hasPet) {
    return null;
  }

  /* ------------------ Kéo thả Sticker ------------------ */
  const handleStickerPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    sticker: PlacedSticker
  ) => {
    if (customTheme.stickersLocked) return;
    if ((event.target as HTMLElement).closest('button')) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      instanceId: sticker.instanceId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      origXPct: sticker.xPct,
      origYPct: sticker.yPct,
      moved: false,
    };
  };

  const handleStickerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;

    const vw = Math.max(window.innerWidth, 1);
    const vh = Math.max(window.innerHeight, 1);
    const nextX = clamp(drag.origXPct + (dx / vw) * 100, 2, 92);
    const nextY = clamp(drag.origYPct + (dy / vh) * 100, 4, 88);
    setDraggingSticker({ instanceId: drag.instanceId, xPct: nextX, yPct: nextY });
  };

  const handleStickerPointerUp = (sticker: PlacedSticker) => {
    const drag = dragStartRef.current;
    dragStartRef.current = null;
    if (!drag) return;

    if (drag.moved && draggingSticker?.instanceId === sticker.instanceId) {
      updateSticker(sticker.instanceId, {
        xPct: Math.round(draggingSticker.xPct * 10) / 10,
        yPct: Math.round(draggingSticker.yPct * 10) / 10,
      });
    } else {
      setSelectedStickerId((prev) =>
        prev === sticker.instanceId ? null : sticker.instanceId
      );
    }
    setDraggingSticker(null);
  };

  /* ------------------ Tương tác Pet ------------------ */
  const triggerPetReaction = (nextMood: 'happy' | 'eat', customQuote?: string) => {
    setPetManualSleep(false);
    setPetMood(nextMood);
    if (moodTimerRef.current) window.clearTimeout(moodTimerRef.current);
    moodTimerRef.current = window.setTimeout(() => {
      setPetMood('idle');
    }, 2200);

    if (customTheme.pet.showSpeech && petMeta) {
      let line = customQuote;
      if (!line) {
        line = petMeta.quotes[quoteIndexRef.current % petMeta.quotes.length];
        quoteIndexRef.current += 1;
      }
      setSpeechText(line);
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = window.setTimeout(() => {
        setSpeechText(null);
      }, 3800);
    }
  };

  const handlePetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    petDraggingRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      origXPct: petPos.xPct,
      origYPct: petPos.yPct,
      moved: false,
    };
  };

  const handlePetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = petDraggingRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(dx, dy) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;

    const vw = Math.max(window.innerWidth, 1);
    const vh = Math.max(window.innerHeight, 1);
    if (Math.abs(dx) > 3) setPetFacingLeft(dx < 0);
    setPetPos({
      xPct: clamp(drag.origXPct + (dx / vw) * 100, 4, 92),
      yPct: clamp(drag.origYPct + (dy / vh) * 100, 8, 90),
    });
  };

  const handlePetPointerUp = () => {
    const drag = petDraggingRef.current;
    petDraggingRef.current = null;
    if (!drag) return;

    if (drag.moved) {
      updatePetSettings({
        xPct: Math.round(petPos.xPct * 10) / 10,
        yPct: Math.round(petPos.yPct * 10) / 10,
      });
    } else {
      setPetMenuOpen((prev) => !prev);
      triggerPetReaction('happy');
    }
  };

  const effectivePetMood: PetMood = petManualSleep ? 'sleep' : petMood;
  const petDisplayName = customTheme.pet.name.trim() || petMeta?.label || 'Thú cưng';

  return (
    <>
      {!customTheme.decorationsHidden && (
        <div className="pointer-events-none fixed inset-0 z-[38] overflow-hidden print:hidden">
          {/* Lớp Sticker */}
          {customTheme.stickers.map((sticker) => {
            const isDragging = draggingSticker?.instanceId === sticker.instanceId;
            const xPct = isDragging ? draggingSticker.xPct : sticker.xPct;
            const yPct = isDragging ? draggingSticker.yPct : sticker.yPct;
            const isSelected = selectedStickerId === sticker.instanceId && !customTheme.stickersLocked;

            return (
              <div
                key={sticker.instanceId}
                data-custom-sticker
                onPointerDown={(e) => handleStickerPointerDown(e, sticker)}
                onPointerMove={handleStickerPointerMove}
                onPointerUp={() => handleStickerPointerUp(sticker)}
                style={{
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                }}
                title={
                  customTheme.stickersLocked
                    ? undefined
                    : 'Kéo để di chuyển · Bấm để chỉnh kích thước/xoay'
                }
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform ${
                  customTheme.stickersLocked
                    ? 'pointer-events-none'
                    : 'pointer-events-auto cursor-grab touch-none select-none hover:scale-105 active:cursor-grabbing'
                }`}
              >
                <div
                  className={`${STICKER_SIZE_CLASSES[sticker.size]} ${
                    isSelected ? 'rounded-xl ring-2 ring-brand-red/70 ring-offset-2' : ''
                  }`}
                  style={{
                    transform: `rotate(${sticker.rotation}deg) scaleX(${sticker.flipX ? -1 : 1})`,
                  }}
                >
                  <StickerArtwork stickerId={sticker.stickerId} />
                </div>

                {isSelected && (
                  <div className="absolute -bottom-12 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface-card p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() =>
                        updateSticker(sticker.instanceId, {
                          size: STICKER_SIZE_CYCLE[sticker.size],
                        })
                      }
                      aria-label="Đổi kích thước sticker"
                      title="Đổi kích thước"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSticker(sticker.instanceId, {
                          rotation: clamp(sticker.rotation - 10, -35, 35),
                        })
                      }
                      aria-label="Xoay trái"
                      title="Xoay trái"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSticker(sticker.instanceId, {
                          rotation: clamp(sticker.rotation + 10, -35, 35),
                        })
                      }
                      aria-label="Xoay phải"
                      title="Xoay phải"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    >
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSticker(sticker.instanceId, { flipX: !sticker.flipX })
                      }
                      aria-label="Lật ngang"
                      title="Lật ngang"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                    >
                      <FlipHorizontal2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStickerId(null);
                        removeSticker(sticker.instanceId);
                      }}
                      aria-label="Gỡ sticker"
                      title="Gỡ sticker"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-brand-red hover:bg-brand-redSoft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Lớp Pet đồng hành */}
          {hasPet && petMeta && (
            <div
              onPointerDown={handlePetPointerDown}
              onPointerMove={handlePetPointerMove}
              onPointerUp={handlePetPointerUp}
              style={{
                left: `${petPos.xPct}%`,
                top: `${petPos.yPct}%`,
              }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none active:cursor-grabbing"
              title={`${petDisplayName} · Bấm để tương tác hoặc kéo di chuyển`}
            >
              {/* Bong bóng lời chúc / nhắc nhở */}
              {speechText && (
                <div className="absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded-xl border border-line bg-surface-card p-2 text-center text-xs font-semibold leading-snug text-ink-primary shadow-md">
                  <span className="block text-xs font-bold text-brand-red">
                    {petDisplayName}
                  </span>
                  <span>{speechText}</span>
                </div>
              )}

              <div className={PET_SIZE_CLASSES[customTheme.pet.size]}>
                <PetArtwork
                  petId={petMeta.id}
                  mood={effectivePetMood}
                  facingLeft={petFacingLeft}
                />
              </div>

              {/* Thanh tương tác nhỏ khi bấm vào Pet */}
              {petMenuOpen && (
                <div className="absolute left-1/2 top-full mt-2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface-card p-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => triggerPetReaction('happy')}
                    aria-label="Vuốt ve thú cưng"
                    title="Vuốt ve"
                    className="flex h-8 items-center gap-2 rounded-full px-2 text-xs font-semibold text-brand-red hover:bg-brand-redSoft"
                  >
                    <Heart className="h-4 w-4" />
                    <span className="hidden sm:inline">Vuốt ve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerPetReaction(
                        'eat',
                        `Măm măm ${petMeta.treatName.toLowerCase()} ngon tuyệt!`
                      )
                    }
                    aria-label="Cho thú cưng ăn"
                    title={`Cho ăn ${petMeta.treatName}`}
                    className="flex h-8 items-center gap-2 rounded-full px-2 text-xs font-semibold text-brand-navy hover:bg-brand-navySoft"
                  >
                    <Cookie className="h-4 w-4" />
                    <span className="hidden sm:inline">Cho ăn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPetManualSleep((prev) => !prev)}
                    aria-label={petManualSleep ? 'Đánh thức thú cưng' : 'Cho thú cưng ngủ'}
                    title={petManualSleep ? 'Đánh thức' : 'Ngủ một lát'}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
                  >
                    {petManualSleep ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nút ẩn/hiện nhanh trang trí để không che bảng thời khóa biểu khi cần tập trung */}
      <button
        type="button"
        onClick={toggleDecorationsHidden}
        aria-pressed={customTheme.decorationsHidden}
        title="Ẩn hoặc hiện nhanh Sticker và Thú cưng (Alt + Shift + H)"
        className="fixed bottom-4 left-4 z-[39] inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface-card/90 px-4 text-xs font-semibold text-ink-secondary shadow-md backdrop-blur-md transition-all hover:border-line-strong hover:text-ink-primary md:left-[272px] print:hidden"
      >
        {customTheme.decorationsHidden ? (
          <>
            <Eye className="h-4 w-4 text-brand-red" aria-hidden="true" />
            <span>Hiện trang trí</span>
          </>
        ) : (
          <>
            <EyeOff className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Ẩn trang trí</span>
          </>
        )}
      </button>
    </>
  );
}

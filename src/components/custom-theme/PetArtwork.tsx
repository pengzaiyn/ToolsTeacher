import type { PetId } from '@/lib/customTheme';

export type PetMood = 'idle' | 'walk' | 'sleep' | 'happy' | 'eat';

interface PetArtworkProps {
  petId: PetId;
  mood?: PetMood;
  facingLeft?: boolean;
  className?: string;
}

function PetEyes({
  mood,
  leftX = 42,
  rightX = 58,
  y = 44,
}: {
  mood: PetMood;
  leftX?: number;
  rightX?: number;
  y?: number;
}) {
  if (mood === 'sleep') {
    return (
      <g>
        <path
          d={`M${leftX - 3.5} ${y} Q${leftX} ${y + 3.5} ${leftX + 3.5} ${y}`}
          fill="none"
          stroke="#1E293B"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d={`M${rightX - 3.5} ${y} Q${rightX} ${y + 3.5} ${rightX + 3.5} ${y}`}
          fill="none"
          stroke="#1E293B"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (mood === 'happy' || mood === 'eat') {
    return (
      <g>
        <path
          d={`M${leftX - 3.5} ${y + 1} Q${leftX} ${y - 4} ${leftX + 3.5} ${y + 1}`}
          fill="none"
          stroke="#1E293B"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d={`M${rightX - 3.5} ${y + 1} Q${rightX} ${y - 4} ${rightX + 3.5} ${y + 1}`}
          fill="none"
          stroke="#1E293B"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
    );
  }
  return (
    <g className="pet-blink">
      <circle cx={leftX} cy={y} r="2.7" fill="#1E293B" />
      <circle cx={rightX} cy={y} r="2.7" fill="#1E293B" />
      <circle cx={leftX - 0.8} cy={y - 0.8} r="0.9" fill="#FFFFFF" />
      <circle cx={rightX - 0.8} cy={y - 0.8} r="0.9" fill="#FFFFFF" />
    </g>
  );
}

/**
 * Thú cưng vector đa bộ phận có hoạt ảnh CSS riêng cho từng trạng thái (nghỉ, đi dạo, ngủ, vui, ăn).
 */
export function PetArtwork({
  petId,
  mood = 'idle',
  facingLeft = false,
  className = 'h-full w-full',
}: PetArtworkProps) {
  const bodyAnimClass =
    mood === 'walk'
      ? 'pet-walk-body'
      : mood === 'happy'
        ? 'pet-hop-body'
        : mood === 'sleep'
          ? 'pet-sleep-body'
          : 'pet-idle-body';

  const renderCreature = () => {
    switch (petId) {
      case 'cat-orange':
        return (
          <g>
            {/* Đuôi cong vẫy */}
            <path
              d="M66 74 Q85 68 82 50 Q80 42 74 47"
              fill="none"
              stroke="#EA580C"
              strokeWidth="8"
              strokeLinecap="round"
              className="pet-tail-wag"
            />
            <path
              d="M66 74 Q85 68 82 50 Q80 42 74 47"
              fill="none"
              stroke="#1E293B"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="pet-tail-wag"
              opacity="0.25"
            />
            {/* Thân mèo tròn */}
            <ellipse cx="50" cy="68" rx="22" ry="18" fill="#FB923C" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="50" cy="70" rx="13" ry="12" fill="#FFF7ED" />
            {/* Tai & đầu */}
            <polygon points="30,42 30,22 44,33" fill="#FB923C" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="70,42 70,22 56,33" fill="#FB923C" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="33,39 33,27 41,34" fill="#FDA4AF" />
            <polygon points="67,39 67,27 59,34" fill="#FDA4AF" />
            <ellipse cx="50" cy="45" rx="22" ry="18" fill="#FB923C" stroke="#1E293B" strokeWidth="2.5" />
            {/* Vằn trán */}
            <line x1="50" y1="28" x2="50" y2="34" stroke="#C2410C" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="44" y1="29" x2="46" y2="34" stroke="#C2410C" strokeWidth="2.3" strokeLinecap="round" />
            <line x1="56" y1="29" x2="54" y2="34" stroke="#C2410C" strokeWidth="2.3" strokeLinecap="round" />
            <PetEyes mood={mood} leftX={41} rightX={59} y={45} />
            <ellipse cx="35" cy="49" rx="3.8" ry="2" fill="#FB7185" opacity="0.65" />
            <ellipse cx="65" cy="49" rx="3.8" ry="2" fill="#FB7185" opacity="0.65" />
            <polygon points="48,49 52,49 50,51.5" fill="#FB7185" />
            <path d="M45 53 Q50 56 55 53" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            {/* Chân trước */}
            <ellipse cx="40" cy="83" rx="6" ry="4.5" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-left' : ''} />
            <ellipse cx="60" cy="83" rx="6" ry="4.5" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-right' : ''} />
          </g>
        );

      case 'dog-corgi':
        return (
          <g>
            {/* Đuôi bông nhỏ */}
            <circle cx="71" cy="69" r="6" fill="#FDE68A" stroke="#1E293B" strokeWidth="2.2" className="pet-tail-wag" />
            {/* Thân Corgi */}
            <ellipse cx="50" cy="67" rx="23" ry="17" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="50" cy="70" rx="14" ry="12" fill="#FFFBEB" />
            {/* Tai to dựng */}
            <ellipse cx="32" cy="27" rx="8" ry="13" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" transform="rotate(-16 32 27)" />
            <ellipse cx="68" cy="27" rx="8" ry="13" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" transform="rotate(16 68 27)" />
            <ellipse cx="32" cy="28" rx="4.5" ry="8" fill="#FDA4AF" transform="rotate(-16 32 28)" />
            <ellipse cx="68" cy="28" rx="4.5" ry="8" fill="#FDA4AF" transform="rotate(16 68 28)" />
            {/* Đầu */}
            <ellipse cx="50" cy="45" rx="22" ry="18" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M31 49 C31 41 42 42 50 45 C58 42 69 41 69 49 C69 58 60 63 50 63 C40 63 31 58 31 49 Z" fill="#FFFBEB" />
            <PetEyes mood={mood} leftX={41} rightX={59} y={42} />
            <ellipse cx="50" cy="49" rx="4" ry="2.8" fill="#1E293B" />
            <path d="M46 53 Q50 57 54 53" fill="none" stroke="#1E293B" strokeWidth="2.1" strokeLinecap="round" />
            {/* Lưỡi hồng khi vui/đi dạo */}
            {(mood === 'happy' || mood === 'walk') && (
              <path d="M47 55 Q50 61 53 55 Z" fill="#FB7185" />
            )}
            <ellipse cx="39" cy="83" rx="6" ry="4.5" fill="#FFFBEB" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-left' : ''} />
            <ellipse cx="61" cy="83" rx="6" ry="4.5" fill="#FFFBEB" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-right' : ''} />
          </g>
        );

      case 'panda-sleepy':
        return (
          <g>
            {/* Cành trúc bên cạnh */}
            <line x1="77" y1="36" x2="77" y2="83" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" />
            <path d="M77 48 Q87 42 89 49 Q82 53 77 48 Z" fill="#22C55E" />
            {/* Thân gấu trúc */}
            <ellipse cx="50" cy="68" rx="23" ry="17" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M29 61 Q50 67 71 61 L69 72 Q50 77 31 72 Z" fill="#1E293B" />
            {/* Tai đen */}
            <circle cx="31" cy="28" r="8" fill="#1E293B" />
            <circle cx="69" cy="28" r="8" fill="#1E293B" />
            {/* Đầu */}
            <ellipse cx="50" cy="45" rx="22" ry="18" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
            {/* Quầng mắt gấu trúc */}
            <ellipse cx="40" cy="44" rx="6.5" ry="7.5" fill="#1E293B" transform="rotate(-14 40 44)" />
            <ellipse cx="60" cy="44" rx="6.5" ry="7.5" fill="#1E293B" transform="rotate(14 60 44)" />
            {mood === 'sleep' ? (
              <>
                <path d="M37 44 Q40 47 43 44" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                <path d="M57 44 Q60 47 63 44" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="40" cy="43" r="2.2" fill="#FFFFFF" />
                <circle cx="60" cy="43" r="2.2" fill="#FFFFFF" />
              </>
            )}
            <ellipse cx="33" cy="50" rx="3.5" ry="2" fill="#FB7185" opacity="0.7" />
            <ellipse cx="67" cy="50" rx="3.5" ry="2" fill="#FB7185" opacity="0.7" />
            <ellipse cx="50" cy="49" rx="3.5" ry="2.4" fill="#1E293B" />
            <path d="M46 53 Q50 56 54 53" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="39" cy="83" rx="6.5" ry="4.5" fill="#1E293B" className={mood === 'walk' ? 'pet-paw-left' : ''} />
            <ellipse cx="61" cy="83" rx="6.5" ry="4.5" fill="#1E293B" className={mood === 'walk' ? 'pet-paw-right' : ''} />
          </g>
        );

      case 'fox-clever':
        return (
          <g>
            {/* Đuôi xù chóp trắng */}
            <path d="M64 73 Q88 67 84 48 Q79 41 69 52 Z" fill="#EA580C" stroke="#1E293B" strokeWidth="2.4" strokeLinejoin="round" className="pet-tail-wag" />
            <circle cx="81" cy="49" r="5" fill="#FFFBEB" className="pet-tail-wag" />
            {/* Thân cáo */}
            <ellipse cx="48" cy="68" rx="20" ry="17" fill="#EA580C" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="48" cy="70" rx="12" ry="12" fill="#FFFBEB" />
            {/* Tai nhọn lớn */}
            <polygon points="27,41 25,18 43,31" fill="#EA580C" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="69,41 71,18 53,31" fill="#EA580C" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="30,37 29,23 40,32" fill="#1E293B" />
            <polygon points="66,37 67,23 56,32" fill="#1E293B" />
            {/* Đầu */}
            <ellipse cx="48" cy="45" rx="22" ry="17" fill="#EA580C" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M27 47 Q38 45 48 53 Q58 45 69 47 Q66 61 48 62 Q30 61 27 47 Z" fill="#FFFBEB" />
            <PetEyes mood={mood} leftX={39} rightX={57} y={43} />
            <polygon points="46,50 50,50 48,53" fill="#1E293B" />
            <path d="M44 55 Q48 58 52 55" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="38" cy="83" rx="5.5" ry="4" fill="#1E293B" className={mood === 'walk' ? 'pet-paw-left' : ''} />
            <ellipse cx="58" cy="83" rx="5.5" ry="4" fill="#1E293B" className={mood === 'walk' ? 'pet-paw-right' : ''} />
          </g>
        );

      case 'duck-cheerful':
        return (
          <g>
            {/* Thân vịt */}
            <ellipse cx="50" cy="68" rx="22" ry="17" fill="#FDE047" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="34" cy="67" rx="7" ry="11" fill="#FACC15" stroke="#1E293B" strokeWidth="2.2" transform="rotate(15 34 67)" />
            <ellipse cx="66" cy="67" rx="7" ry="11" fill="#FACC15" stroke="#1E293B" strokeWidth="2.2" transform="rotate(-15 66 67)" />
            {/* Khăn quàng đỏ Việt Mỹ */}
            <path d="M34 55 Q50 61 66 55 L64 62 Q50 67 36 62 Z" fill="#C8102E" stroke="#1E293B" strokeWidth="2" />
            <polygon points="56,59 64,60 66,72 57,70" fill="#C8102E" stroke="#1E293B" strokeWidth="2" strokeLinejoin="round" />
            {/* Đầu & chỏm lông */}
            <path d="M48 25 Q46 16 53 20 Q56 16 57 25" fill="#FDE047" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="50" cy="42" r="19" fill="#FDE047" stroke="#1E293B" strokeWidth="2.5" />
            <PetEyes mood={mood} leftX={41} rightX={59} y={40} />
            <ellipse cx="34" cy="45" rx="3.5" ry="2" fill="#FB7185" opacity="0.7" />
            <ellipse cx="66" cy="45" rx="3.5" ry="2" fill="#FB7185" opacity="0.7" />
            {/* Mỏ cam */}
            <ellipse cx="50" cy="47" rx="8.5" ry="4.5" fill="#F97316" stroke="#1E293B" strokeWidth="2.2" />
            {/* Chân vịt */}
            <ellipse cx="41" cy="84" rx="7" ry="3.8" fill="#F97316" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-left' : ''} />
            <ellipse cx="59" cy="84" rx="7" ry="3.8" fill="#F97316" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-right' : ''} />
          </g>
        );

      case 'bunny-mocha':
        return (
          <g>
            {/* Đuôi bông */}
            <circle cx="71" cy="72" r="6" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.2" />
            {/* Thân */}
            <ellipse cx="50" cy="69" rx="20" ry="16" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="50" cy="71" rx="12" ry="11" fill="#FFFFFF" />
            {/* Tai dài */}
            <ellipse cx="38" cy="23" rx="6.5" ry="15" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.5" transform="rotate(-12 38 23)" />
            <ellipse cx="62" cy="23" rx="6.5" ry="15" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.5" transform="rotate(12 62 23)" />
            <ellipse cx="38" cy="24" rx="3.2" ry="10" fill="#FDA4AF" transform="rotate(-12 38 24)" />
            <ellipse cx="62" cy="24" rx="3.2" ry="10" fill="#FDA4AF" transform="rotate(12 62 24)" />
            {/* Đầu */}
            <ellipse cx="50" cy="47" rx="21" ry="17" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.5" />
            <PetEyes mood={mood} leftX={41} rightX={59} y={46} />
            <ellipse cx="34" cy="51" rx="4" ry="2.2" fill="#FDA4AF" />
            <ellipse cx="66" cy="51" rx="4" ry="2.2" fill="#FDA4AF" />
            <polygon points="48,49 52,49 50,51.5" fill="#FB7185" />
            <path d="M46 53 Q50 56 54 53" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="40" cy="83" rx="6" ry="4" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-left' : ''} />
            <ellipse cx="60" cy="83" rx="6" ry="4" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-right' : ''} />
          </g>
        );

      case 'penguin-chubby':
        return (
          <g>
            {/* Cánh */}
            <ellipse cx="26" cy="63" rx="7" ry="14" fill="#1E293B" transform="rotate(20 26 63)" className="pet-tail-wag" />
            <ellipse cx="74" cy="63" rx="7" ry="14" fill="#1E293B" transform="rotate(-20 74 63)" className="pet-tail-wag" />
            {/* Thân chim cánh cụt */}
            <ellipse cx="50" cy="58" rx="24" ry="27" fill="#1E293B" stroke="#0F172A" strokeWidth="2.5" />
            <ellipse cx="50" cy="63" rx="18" ry="20" fill="#FFFFFF" />
            <circle cx="42" cy="46" r="8" fill="#FFFFFF" />
            <circle cx="58" cy="46" r="8" fill="#FFFFFF" />
            <PetEyes mood={mood} leftX={42} rightX={58} y={45} />
            <ellipse cx="34" cy="51" rx="3.8" ry="2.2" fill="#FB7185" opacity="0.7" />
            <ellipse cx="66" cy="51" rx="3.8" ry="2.2" fill="#FB7185" opacity="0.7" />
            {/* Mỏ vàng */}
            <polygon points="44,49 56,49 50,56" fill="#F59E0B" stroke="#1E293B" strokeWidth="2" strokeLinejoin="round" />
            {/* Chân cam */}
            <ellipse cx="40" cy="84" rx="7" ry="4" fill="#F97316" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-left' : ''} />
            <ellipse cx="60" cy="84" rx="7" ry="4" fill="#F97316" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-right' : ''} />
          </g>
        );

      case 'dragon-mini':
        return (
          <g>
            {/* Cánh rồng */}
            <path d="M29 58 L14 44 L19 61 L28 65 Z" fill="#818CF8" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" className="pet-tail-wag" />
            <path d="M71 58 L86 44 L81 61 L72 65 Z" fill="#818CF8" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" className="pet-tail-wag" />
            {/* Đuôi có ngọn lửa xanh */}
            <path d="M68 74 Q84 72 82 59" fill="none" stroke="#4F46E5" strokeWidth="6" strokeLinecap="round" className="pet-tail-wag" />
            <circle cx="82" cy="57" r="4.5" fill="#38BDF8" />
            {/* Thân */}
            <ellipse cx="50" cy="68" rx="21" ry="17" fill="#6366F1" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="50" cy="70" rx="13" ry="12" fill="#C7D2FE" />
            {/* Sừng nhỏ */}
            <polygon points="35,31 31,19 42,27" fill="#FACC15" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" />
            <polygon points="65,31 69,19 58,27" fill="#FACC15" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" />
            {/* Đầu */}
            <ellipse cx="50" cy="45" rx="22" ry="17" fill="#6366F1" stroke="#1E293B" strokeWidth="2.5" />
            <PetEyes mood={mood} leftX={41} rightX={59} y={44} />
            <ellipse cx="35" cy="49" rx="3.5" ry="2" fill="#FDA4AF" opacity="0.7" />
            <ellipse cx="65" cy="49" rx="3.5" ry="2" fill="#FDA4AF" opacity="0.7" />
            <path d="M46 51 Q50 55 54 51" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="40" cy="83" rx="6" ry="4" fill="#4F46E5" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-left' : ''} />
            <ellipse cx="60" cy="83" rx="6" ry="4" fill="#4F46E5" stroke="#1E293B" strokeWidth="2.2" className={mood === 'walk' ? 'pet-paw-right' : ''} />
          </g>
        );
    }
  };

  return (
    <div className={`relative select-none ${className}`}>
      {/* Bóng đổ dưới chân */}
      <div className="pointer-events-none absolute bottom-1 left-1/2 h-3 w-3/5 -translate-x-1/2 rounded-full bg-ink-card/20 blur-[2px]" />

      {/* Hạt tương tác: tim bay / chữ Z ngủ / snack */}
      {mood === 'happy' && (
        <svg
          viewBox="0 0 40 40"
          className="pet-float-up pointer-events-none absolute -top-5 left-1/2 h-8 w-8 -translate-x-1/2"
          aria-hidden="true"
        >
          <path
            d="M20 32 C8 24 8 14 14 11 C17 9.5 20 12 20 14 C20 12 23 9.5 26 11 C32 14 32 24 20 32 Z"
            fill="#F43F5E"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        </svg>
      )}
      {mood === 'sleep' && (
        <div
          aria-hidden="true"
          className="pet-float-up pointer-events-none absolute -right-1 -top-3 text-xs font-bold text-brand-navyText"
        >
          Zzz
        </div>
      )}
      {mood === 'eat' && (
        <svg
          viewBox="0 0 32 32"
          className="pet-float-up pointer-events-none absolute -top-4 left-1/2 h-7 w-7 -translate-x-1/2"
          aria-hidden="true"
        >
          <circle cx="16" cy="16" r="10" fill="#FDE047" stroke="#1E293B" strokeWidth="2" />
          <path d="M16 10 L18 14 L22 15 L19 18 L20 22 L16 20 L12 22 L13 18 L10 15 L14 14 Z" fill="#F97316" />
        </svg>
      )}

      <svg
        viewBox="0 0 100 94"
        className={`h-full w-full overflow-visible ${bodyAnimClass}`}
        style={{
          transform: facingLeft ? 'scaleX(-1)' : undefined,
          filter: 'drop-shadow(0 4px 8px rgba(15, 23, 42, 0.22))',
        }}
        aria-hidden="true"
      >
        {renderCreature()}
      </svg>
    </div>
  );
}

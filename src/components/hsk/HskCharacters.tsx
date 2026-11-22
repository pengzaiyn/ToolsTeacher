import type { HskAvatarId } from '@/lib/hsk1Vocabulary';

interface HskCharacterAvatarProps {
  avatarId: HskAvatarId | string;
  size?: number;
  mood?: 'idle' | 'happy' | 'clapping' | 'winner';
  className?: string;
}

const PALETTE: Record<
  HskAvatarId,
  { face: string; ear: string; accent: string; cheek: string; outfit: string }
> = {
  panda: {
    face: '#FFFFFF',
    ear: '#1E293B',
    accent: '#1E293B',
    cheek: '#FDA4AF',
    outfit: '#C8102E',
  },
  cat: {
    face: '#FFFBEB',
    ear: '#F59E0B',
    accent: '#D97706',
    cheek: '#FB7185',
    outfit: '#DC2626',
  },
  dragon: {
    face: '#DCFCE7',
    ear: '#16A34A',
    accent: '#15803D',
    cheek: '#FCA5A5',
    outfit: '#1A365D',
  },
  tiger: {
    face: '#FFEDD5',
    ear: '#EA580C',
    accent: '#9A3412',
    cheek: '#FDA4AF',
    outfit: '#B91C1C',
  },
  rabbit: {
    face: '#FCE7F3',
    ear: '#F472B6',
    accent: '#BE185D',
    cheek: '#F9A8D4',
    outfit: '#1A365D',
  },
};

export function HskCharacterAvatar({
  avatarId,
  size = 56,
  mood = 'idle',
  className = '',
}: HskCharacterAvatarProps) {
  const key = (avatarId in PALETTE ? avatarId : 'panda') as HskAvatarId;
  const p = PALETTE[key];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${mood === 'winner' ? 'animate-bounce' : ''} ${className}`}
      aria-hidden="true"
    >
      {/* Vương miện cho người thắng */}
      {mood === 'winner' && (
        <path
          d="M24 14L30 22L40 10L50 22L56 14L53 26H27L24 14Z"
          fill="#FACC15"
          stroke="#CA8A04"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {/* Tai nhân vật */}
      {key === 'rabbit' ? (
        <>
          <ellipse cx="29" cy="18" rx="6" ry="13" fill={p.face} stroke={p.ear} strokeWidth="2.5" />
          <ellipse cx="51" cy="18" rx="6" ry="13" fill={p.face} stroke={p.ear} strokeWidth="2.5" />
        </>
      ) : key === 'cat' || key === 'dragon' ? (
        <>
          <path d="M20 32L24 14L35 25Z" fill={p.ear} />
          <path d="M60 32L56 14L45 25Z" fill={p.ear} />
        </>
      ) : (
        <>
          <circle cx="24" cy="24" r="8" fill={p.ear} />
          <circle cx="56" cy="24" r="8" fill={p.ear} />
        </>
      )}

      {/* Thân áo kiểu Trung Hoa */}
      <rect x="24" y="54" width="32" height="20" rx="10" fill={p.outfit} />
      <path d="M40 55V72" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="61" r="1.5" fill="#FDE047" />
      <circle cx="40" cy="67" r="1.5" fill="#FDE047" />

      {/* Đầu nhân vật */}
      <circle cx="40" cy="39" r="20" fill={p.face} stroke="#1E293B" strokeWidth="2" />

      {/* Quầng mắt gấu trúc hoặc vằn hổ */}
      {key === 'panda' && (
        <>
          <ellipse cx="32" cy="38" rx="5.5" ry="4.5" fill="#1E293B" />
          <ellipse cx="48" cy="38" rx="5.5" ry="4.5" fill="#1E293B" />
        </>
      )}
      {key === 'tiger' && (
        <>
          <path d="M35 22L40 27L45 22" stroke={p.accent} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M22 36H27M53 36H58" stroke={p.accent} strokeWidth="2" strokeLinecap="round" />
        </>
      )}

      {/* Mắt */}
      {mood === 'happy' || mood === 'winner' ? (
        <>
          <path
            d="M29 38C30.5 35.5 33.5 35.5 35 38"
            stroke={key === 'panda' ? '#FFFFFF' : '#1E293B'}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M45 38C46.5 35.5 49.5 35.5 51 38"
            stroke={key === 'panda' ? '#FFFFFF' : '#1E293B'}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="32" cy="38" r="2.6" fill={key === 'panda' ? '#FFFFFF' : '#1E293B'} />
          <circle cx="48" cy="38" r="2.6" fill={key === 'panda' ? '#FFFFFF' : '#1E293B'} />
        </>
      )}

      {/* Má hồng */}
      <circle cx="27" cy="44" r="3" fill={p.cheek} opacity="0.7" />
      <circle cx="53" cy="44" r="3" fill={p.cheek} opacity="0.7" />

      {/* Miệng */}
      <path
        d={mood === 'happy' || mood === 'winner' ? 'M35 45Q40 51 45 45' : 'M36 46Q40 49 44 46'}
        stroke="#1E293B"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Tay vỗ tay cổ vũ cho Top 4 & Top 5 */}
      {mood === 'clapping' && (
        <>
          <circle cx="33" cy="62" r="5" fill={p.face} stroke="#1E293B" strokeWidth="1.8" />
          <circle cx="47" cy="62" r="5" fill={p.face} stroke="#1E293B" strokeWidth="1.8" />
          <path
            d="M40 53V49M35 55L32 52M45 55L48 52"
            stroke="#F59E0B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

import { useId } from 'react';
import type { StickerId } from '@/lib/customTheme';

interface StickerArtworkProps {
  stickerId: StickerId;
  className?: string;
}

/**
 * Kho 24 sticker minh họa vector sắc nét phong cách vinyl die-cut (viền trắng nổi khối).
 * Dùng SVG chuẩn độ nét cao trên mọi màn hình và nền sáng/tối.
 */
export function StickerArtwork({ stickerId, className = 'h-full w-full' }: StickerArtworkProps) {
  const uid = useId().replace(/:/g, '');

  const renderGraphic = () => {
    switch (stickerId) {
      case 'study-coffee':
        return (
          <g>
            {/* Đĩa lót & ly cà phê đá */}
            <ellipse cx="50" cy="84" rx="28" ry="6" fill="#E2E8F0" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M28 40 L33 80 C34 84 66 84 67 80 L72 40 Z" fill={`url(#${uid}-coffee)`} stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Đá viên & bọt sữa */}
            <path d="M28 40 Q50 47 72 40 L70 50 Q50 56 30 50 Z" fill="#FDE68A" opacity="0.9" />
            <rect x="37" y="42" width="10" height="9" rx="2" fill="#FFFFFF" opacity="0.7" transform="rotate(-12 42 46)" />
            <rect x="52" y="44" width="10" height="9" rx="2" fill="#FFFFFF" opacity="0.7" transform="rotate(14 57 48)" />
            {/* Nắp vòm & ống hút */}
            <path d="M26 40 C26 24 74 24 74 40 Z" fill="#F8FAFC" fillOpacity="0.88" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M56 31 L65 11 L71 13 L61 32" fill="#EF4444" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" />
            {/* Mặt cười dễ thương */}
            <circle cx="43" cy="61" r="2.3" fill="#1E293B" />
            <circle cx="57" cy="61" r="2.3" fill="#1E293B" />
            <path d="M46 65 Q50 69 54 65" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse cx="38" cy="64" rx="3" ry="1.8" fill="#FB7185" opacity="0.7" />
            <ellipse cx="62" cy="64" rx="3" ry="1.8" fill="#FB7185" opacity="0.7" />
            <rect x="32" y="71" width="36" height="8" rx="4" fill="#DC2626" />
            <text x="50" y="77" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#FFFFFF">DEADLINE</text>
          </g>
        );

      case 'study-book-stack':
        return (
          <g>
            {/* Chồng sách 3 cuốn */}
            <rect x="18" y="64" width="64" height="16" rx="4" fill="#1D4ED8" stroke="#1E293B" strokeWidth="2.5" />
            <rect x="24" y="68" width="52" height="8" rx="2" fill="#EFF6FF" />
            <rect x="22" y="48" width="58" height="16" rx="4" fill="#DC2626" stroke="#1E293B" strokeWidth="2.5" />
            <rect x="28" y="52" width="46" height="8" rx="2" fill="#FEF2F2" />
            <rect x="25" y="33" width="52" height="15" rx="4" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" />
            <rect x="31" y="37" width="40" height="7" rx="2" fill="#FFFBEB" />
            {/* Quả táo đỏ trên đỉnh */}
            <path d="M50 33 C40 33 37 22 44 17 C47 15 50 18 50 18 C50 18 53 15 56 17 C63 22 60 33 50 33 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="2.4" />
            <path d="M50 18 Q52 12 58 11 Q56 17 50 18 Z" fill="#22C55E" stroke="#1E293B" strokeWidth="1.8" />
            <circle cx="45" cy="24" r="1.5" fill="#FFFFFF" opacity="0.7" />
          </g>
        );

      case 'study-laptop':
        return (
          <g>
            <rect x="20" y="24" width="60" height="42" rx="6" fill="#1E293B" stroke="#0F172A" strokeWidth="2.5" />
            <rect x="25" y="29" width="50" height="32" rx="3" fill={`url(#${uid}-sky)`} />
            {/* Đường code/slide trên màn hình */}
            <rect x="30" y="35" width="22" height="4" rx="2" fill="#FFFFFF" opacity="0.9" />
            <rect x="30" y="43" width="36" height="3" rx="1.5" fill="#BAE6FD" />
            <rect x="30" y="49" width="28" height="3" rx="1.5" fill="#FDE68A" />
            {/* Ngôi sao góc */}
            <path d="M64 33 L66 37 L70 38 L67 41 L68 45 L64 43 L60 45 L61 41 L58 38 L62 37 Z" fill="#FACC15" />
            {/* Thân máy */}
            <path d="M12 67 L88 67 L82 77 L18 77 Z" fill="#CBD5E1" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="42" y="70" width="16" height="3" rx="1.5" fill="#64748B" />
          </g>
        );

      case 'study-a-plus':
        return (
          <g>
            {/* Huy hiệu sao vàng */}
            <circle cx="50" cy="50" r="32" fill="#FEF08A" stroke="#1E293B" strokeWidth="2.8" />
            <circle cx="50" cy="50" r="26" fill="#FACC15" stroke="#CA8A04" strokeWidth="2" strokeDasharray="4 3" />
            <text x="45" y="59" textAnchor="middle" fontSize="29" fontWeight="800" fill="#B91C1C" stroke="#FFFFFF" strokeWidth="1">A</text>
            <text x="64" y="45" textAnchor="middle" fontSize="20" fontWeight="800" fill="#B91C1C">+</text>
            {/* Lấp lánh */}
            <path d="M22 24 L24 29 L29 31 L24 33 L22 38 L20 33 L15 31 L20 29 Z" fill="#F97316" />
            <path d="M79 65 L81 69 L85 71 L81 73 L79 77 L77 73 L73 71 L77 69 Z" fill="#F97316" />
          </g>
        );

      case 'study-alarm':
        return (
          <g>
            {/* Chân & tai chuông */}
            <line x1="33" y1="74" x2="27" y2="83" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="67" y1="74" x2="73" y2="83" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M22 31 A11 11 0 0 1 38 20" fill="#FACC15" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M78 31 A11 11 0 0 0 62 20" fill="#FACC15" stroke="#1E293B" strokeWidth="2.5" />
            {/* Mặt đồng hồ */}
            <circle cx="50" cy="51" r="27" fill="#EF4444" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="50" cy="51" r="21" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
            <line x1="50" y1="51" x2="50" y2="37" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
            <line x1="50" y1="51" x2="61" y2="55" stroke="#EF4444" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="50" cy="51" r="3" fill="#1E293B" />
            {/* Tia rung */}
            <path d="M14 23 Q10 18 15 13" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M86 23 Q90 18 85 13" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );

      case 'study-graduation':
        return (
          <g>
            {/* Mũ cử nhân */}
            <path d="M31 49 L31 66 C31 74 69 74 69 66 L69 49 Z" fill="#1E3A8A" stroke="#0F172A" strokeWidth="2.5" />
            <polygon points="50,24 88,41 50,58 12,41" fill="#1D4ED8" stroke="#0F172A" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="50" cy="41" r="3.5" fill="#FACC15" />
            <path d="M50 41 L74 52 L74 69" fill="none" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
            <circle cx="74" cy="71" r="4" fill="#F59E0B" stroke="#0F172A" strokeWidth="1.5" />
            {/* Sao nhỏ */}
            <path d="M23 22 L25 26 L29 28 L25 30 L23 34 L21 30 L17 28 L21 26 Z" fill="#FACC15" />
            <path d="M80 20 L81.5 23.5 L85 25 L81.5 26.5 L80 30 L78.5 26.5 L75 25 L78.5 23.5 Z" fill="#FB7185" />
          </g>
        );

      case 'cute-cat-paw':
        return (
          <g>
            <path d="M26 58 C22 44 35 38 50 38 C65 38 78 44 74 58 C71 74 63 82 50 82 C37 82 29 74 26 58 Z" fill="#FFF1F2" stroke="#1E293B" strokeWidth="2.6" />
            <ellipse cx="27" cy="36" rx="7" ry="9" fill="#FFF1F2" stroke="#1E293B" strokeWidth="2.5" transform="rotate(-18 27 36)" />
            <ellipse cx="42" cy="25" rx="7" ry="9.5" fill="#FFF1F2" stroke="#1E293B" strokeWidth="2.5" transform="rotate(-6 42 25)" />
            <ellipse cx="58" cy="25" rx="7" ry="9.5" fill="#FFF1F2" stroke="#1E293B" strokeWidth="2.5" transform="rotate(6 58 25)" />
            <ellipse cx="73" cy="36" rx="7" ry="9" fill="#FFF1F2" stroke="#1E293B" strokeWidth="2.5" transform="rotate(18 73 36)" />
            {/* Đệm thịt hồng */}
            <path d="M37 61 C36 53 45 50 50 50 C55 50 64 53 63 61 C62 69 57 73 50 73 C43 73 38 69 37 61 Z" fill="#FDA4AF" />
            <ellipse cx="27" cy="36" rx="3.8" ry="5" fill="#FDA4AF" transform="rotate(-18 27 36)" />
            <ellipse cx="42" cy="25" rx="3.8" ry="5.2" fill="#FDA4AF" transform="rotate(-6 42 25)" />
            <ellipse cx="58" cy="25" rx="3.8" ry="5.2" fill="#FDA4AF" transform="rotate(6 58 25)" />
            <ellipse cx="73" cy="36" rx="3.8" ry="5" fill="#FDA4AF" transform="rotate(18 73 36)" />
          </g>
        );

      case 'cute-shiba':
        return (
          <g>
            {/* Tai nhọn */}
            <polygon points="24,42 26,18 44,32" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="76,42 74,18 56,32" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="28,38 29,24 40,33" fill="#FDE68A" />
            <polygon points="72,38 71,24 60,33" fill="#FDE68A" />
            {/* Đầu tròn mũm mĩm */}
            <ellipse cx="50" cy="54" rx="30" ry="26" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M23 58 C23 48 36 47 50 52 C64 47 77 48 77 58 C77 72 64 80 50 80 C36 80 23 72 23 58 Z" fill="#FFFBEB" />
            {/* Mắt cười híp & má hồng */}
            <path d="M34 50 Q38 45 42 50" fill="none" stroke="#1E293B" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M58 50 Q62 45 66 50" fill="none" stroke="#1E293B" strokeWidth="2.6" strokeLinecap="round" />
            <ellipse cx="32" cy="57" rx="4.5" ry="2.6" fill="#FB7185" opacity="0.7" />
            <ellipse cx="68" cy="57" rx="4.5" ry="2.6" fill="#FB7185" opacity="0.7" />
            <ellipse cx="50" cy="57" rx="4" ry="3" fill="#1E293B" />
            <path d="M44 63 Q50 68 56 63" fill="none" stroke="#1E293B" strokeWidth="2.3" strokeLinecap="round" />
            {/* Lá xanh trên đầu */}
            <path d="M50 28 Q54 17 65 20 Q60 29 50 28 Z" fill="#22C55E" stroke="#1E293B" strokeWidth="2" />
          </g>
        );

      case 'cute-froggy':
        return (
          <g>
            {/* Vương miện vàng */}
            <polygon points="39,27 42,16 50,22 58,16 61,27" fill="#FACC15" stroke="#1E293B" strokeWidth="2" strokeLinejoin="round" />
            {/* Mắt ếch */}
            <circle cx="34" cy="36" r="11" fill="#4ADE80" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="66" cy="36" r="11" fill="#4ADE80" stroke="#1E293B" strokeWidth="2.5" />
            {/* Mặt ếch */}
            <ellipse cx="50" cy="56" rx="30" ry="22" fill="#4ADE80" stroke="#1E293B" strokeWidth="2.5" />
            <ellipse cx="50" cy="64" rx="22" ry="12" fill="#DCFCE7" />
            <circle cx="34" cy="36" r="6" fill="#FFFFFF" />
            <circle cx="66" cy="36" r="6" fill="#FFFFFF" />
            <circle cx="35" cy="36" r="3.4" fill="#1E293B" />
            <circle cx="65" cy="36" r="3.4" fill="#1E293B" />
            <ellipse cx="30" cy="53" rx="4.5" ry="2.5" fill="#FB7185" opacity="0.75" />
            <ellipse cx="70" cy="53" rx="4.5" ry="2.5" fill="#FB7185" opacity="0.75" />
            <path d="M42 54 Q50 61 58 54" fill="none" stroke="#1E293B" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        );

      case 'cute-bunny-heart':
        return (
          <g>
            <ellipse cx="37" cy="26" rx="8" ry="16" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.5" transform="rotate(-10 37 26)" />
            <ellipse cx="63" cy="26" rx="8" ry="16" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.5" transform="rotate(10 63 26)" />
            <ellipse cx="37" cy="27" rx="4" ry="10" fill="#FDA4AF" transform="rotate(-10 37 27)" />
            <ellipse cx="63" cy="27" rx="4" ry="10" fill="#FDA4AF" transform="rotate(10 63 27)" />
            <ellipse cx="50" cy="56" rx="26" ry="22" fill="#FFF7ED" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="40" cy="51" r="2.6" fill="#1E293B" />
            <circle cx="60" cy="51" r="2.6" fill="#1E293B" />
            <ellipse cx="34" cy="56" rx="4" ry="2.2" fill="#FDA4AF" />
            <ellipse cx="66" cy="56" rx="4" ry="2.2" fill="#FDA4AF" />
            {/* Trái tim ôm trước ngực */}
            <path d="M50 82 C34 72 34 61 42 58 C46 56 50 60 50 62 C50 60 54 56 58 58 C66 61 66 72 50 82 Z" fill="#FB7185" stroke="#1E293B" strokeWidth="2.2" />
          </g>
        );

      case 'cute-sleepy-cloud':
        return (
          <g>
            <path d="M26 68 C16 68 12 58 18 50 C17 38 28 31 38 35 C44 24 62 25 66 37 C78 36 86 45 83 56 C86 63 80 68 72 68 Z" fill="#E0F2FE" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M36 52 Q40 56 44 52" fill="none" stroke="#1E293B" strokeWidth="2.3" strokeLinecap="round" />
            <path d="M56 52 Q60 56 64 52" fill="none" stroke="#1E293B" strokeWidth="2.3" strokeLinecap="round" />
            <ellipse cx="34" cy="56" rx="3.5" ry="2" fill="#FDA4AF" />
            <ellipse cx="66" cy="56" rx="3.5" ry="2" fill="#FDA4AF" />
            <circle cx="50" cy="58" r="2" fill="#FB7185" />
            <text x="74" y="29" fontSize="11" fontWeight="700" fill="#3B82F6">Z</text>
            <text x="82" y="21" fontSize="8" fontWeight="700" fill="#60A5FA">z</text>
          </g>
        );

      case 'cute-duck-sparkle':
        return (
          <g>
            <circle cx="50" cy="54" r="27" fill="#FDE047" stroke="#1E293B" strokeWidth="2.5" />
            {/* Chỏm tóc */}
            <path d="M48 27 Q45 17 53 20 Q56 15 58 26" fill="#FDE047" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
            {/* Kính râm */}
            <rect x="27" y="42" width="19" height="12" rx="4" fill="#0F172A" stroke="#1E293B" strokeWidth="2" />
            <rect x="54" y="42" width="19" height="12" rx="4" fill="#0F172A" stroke="#1E293B" strokeWidth="2" />
            <line x1="46" y1="47" x2="54" y2="47" stroke="#0F172A" strokeWidth="3" />
            <line x1="31" y1="45" x2="36" y2="51" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <line x1="58" y1="45" x2="63" y2="51" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            {/* Mỏ vịt */}
            <ellipse cx="50" cy="60" rx="10" ry="5.5" fill="#F97316" stroke="#1E293B" strokeWidth="2.2" />
            <ellipse cx="30" cy="59" rx="4" ry="2.2" fill="#FB7185" opacity="0.65" />
            <ellipse cx="70" cy="59" rx="4" ry="2.2" fill="#FB7185" opacity="0.65" />
          </g>
        );

      case 'food-boba':
        return (
          <g>
            <path d="M56 32 L63 12 L70 14 L62 32" fill="#EC4899" stroke="#1E293B" strokeWidth="2.3" strokeLinejoin="round" />
            <path d="M31 35 L35 80 C36 84 64 84 65 80 L69 35 Z" fill="#FDE68A" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Bọt kem sữa trên cùng */}
            <path d="M31 35 L69 35 L68 46 Q59 49 50 45 Q41 49 32 46 Z" fill="#FFFBEB" />
            {/* Trân châu dưới đáy */}
            <circle cx="40" cy="74" r="3.6" fill="#1E293B" />
            <circle cx="49" cy="76" r="3.6" fill="#1E293B" />
            <circle cx="58" cy="74" r="3.6" fill="#1E293B" />
            <circle cx="44" cy="68" r="3.2" fill="#334155" />
            <circle cx="54" cy="68" r="3.2" fill="#334155" />
            {/* Nắp ly */}
            <rect x="28" y="31" width="44" height="7" rx="3.5" fill="#F472B6" stroke="#1E293B" strokeWidth="2.3" />
            <circle cx="44" cy="56" r="2.2" fill="#1E293B" />
            <circle cx="56" cy="56" r="2.2" fill="#1E293B" />
            <path d="M47 60 Q50 63 53 60" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
          </g>
        );

      case 'food-matcha':
        return (
          <g>
            <path d="M55 30 L61 12 L67 14 L60 30" fill="#16A34A" stroke="#1E293B" strokeWidth="2.2" />
            <path d="M30 35 L34 80 C35 84 65 84 66 80 L70 35 Z" fill="#4ADE80" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M31 35 L69 35 L68 50 Q55 56 44 50 Q36 53 32 49 Z" fill="#ECFDF5" />
            <rect x="37" y="40" width="9" height="8" rx="2" fill="#FFFFFF" opacity="0.85" transform="rotate(-10 41 44)" />
            <rect x="52" y="41" width="9" height="8" rx="2" fill="#FFFFFF" opacity="0.85" transform="rotate(14 56 45)" />
            <path d="M27 35 C27 23 73 23 73 35 Z" fill="#F8FAFC" fillOpacity="0.85" stroke="#1E293B" strokeWidth="2.3" />
            <circle cx="43" cy="64" r="2.2" fill="#1E293B" />
            <circle cx="57" cy="64" r="2.2" fill="#1E293B" />
            <path d="M47 68 Q50 71 53 68" fill="none" stroke="#1E293B" strokeWidth="2.1" strokeLinecap="round" />
          </g>
        );

      case 'food-croissant':
        return (
          <g>
            <path d="M18 58 C18 42 32 32 50 32 C68 32 82 42 82 58 C82 67 74 71 67 66 C61 62 56 64 50 64 C44 64 39 62 33 66 C26 71 18 67 18 58 Z" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M38 34 Q42 50 38 64" fill="none" stroke="#92400E" strokeWidth="2.3" strokeLinecap="round" />
            <path d="M62 34 Q58 50 62 64" fill="none" stroke="#92400E" strokeWidth="2.3" strokeLinecap="round" />
            <circle cx="44" cy="48" r="2.2" fill="#1E293B" />
            <circle cx="56" cy="48" r="2.2" fill="#1E293B" />
            <path d="M47 52 Q50 55 53 52" fill="none" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
          </g>
        );

      case 'food-ramen':
        return (
          <g>
            {/* Hơi nóng & đũa */}
            <path d="M38 24 Q35 18 39 14" fill="none" stroke="#94A3B8" strokeWidth="2.3" strokeLinecap="round" />
            <path d="M52 22 Q49 16 53 12" fill="none" stroke="#94A3B8" strokeWidth="2.3" strokeLinecap="round" />
            <line x1="60" y1="22" x2="86" y2="33" stroke="#92400E" strokeWidth="3.2" strokeLinecap="round" />
            <line x1="60" y1="28" x2="85" y2="39" stroke="#B45309" strokeWidth="3.2" strokeLinecap="round" />
            {/* Mì & trứng */}
            <ellipse cx="50" cy="44" rx="28" ry="11" fill="#FDE047" stroke="#1E293B" strokeWidth="2.3" />
            <circle cx="38" cy="42" r="7" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.8" />
            <circle cx="38" cy="42" r="3.5" fill="#F97316" />
            <rect x="52" y="36" width="12" height="10" rx="2" fill="#1E293B" />
            {/* Tô sứ đỏ */}
            <path d="M20 45 C20 69 32 77 50 77 C68 77 80 69 80 45 Z" fill="#DC2626" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="38" y="76" width="24" height="6" rx="2" fill="#991B1B" stroke="#1E293B" strokeWidth="2" />
            <path d="M35 55 Q50 61 65 55" fill="none" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        );

      case 'food-strawberry-cake':
        return (
          <g>
            {/* Đĩa & lát bánh */}
            <ellipse cx="50" cy="79" rx="33" ry="6" fill="#E2E8F0" stroke="#1E293B" strokeWidth="2.2" />
            <path d="M23 50 L77 45 L77 73 L23 73 Z" fill="#FDE68A" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="24" y="59" width="52" height="5" fill="#FDA4AF" />
            {/* Lớp kem phủ trên */}
            <path d="M21 50 C25 41 72 38 78 46 C78 51 71 53 67 49 C63 46 58 53 53 49 C48 46 42 54 37 49 C32 45 25 53 21 50 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.3" strokeLinejoin="round" />
            {/* Quả dâu trên đỉnh */}
            <path d="M50 43 C42 43 40 31 46 27 C49 25 51 25 54 27 C60 31 58 43 50 43 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="2.2" />
            <path d="M45 27 L50 22 L55 27 Z" fill="#22C55E" stroke="#1E293B" strokeWidth="1.5" />
          </g>
        );

      case 'food-onigiri':
        return (
          <g>
            <path d="M50 22 C63 22 80 56 77 69 C75 78 25 78 23 69 C20 56 37 22 50 22 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.6" strokeLinejoin="round" />
            <rect x="37" y="59" width="26" height="17" rx="3" fill="#1E293B" />
            <circle cx="41" cy="48" r="2.4" fill="#1E293B" />
            <circle cx="59" cy="48" r="2.4" fill="#1E293B" />
            <ellipse cx="35" cy="53" rx="4" ry="2.2" fill="#FDA4AF" />
            <ellipse cx="65" cy="53" rx="4" ry="2.2" fill="#FDA4AF" />
            <path d="M46 52 Q50 56 54 52" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );

      case 'mood-fire':
        return (
          <g>
            <path d="M51 16 C64 28 76 42 74 59 C72 74 61 82 50 82 C35 82 24 71 25 56 C26 45 34 38 38 30 C41 37 45 40 45 40 C43 29 46 21 51 16 Z" fill="#F97316" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M50 38 C59 46 65 55 63 66 C61 74 56 79 50 79 C41 79 35 72 36 62 C37 54 43 49 50 38 Z" fill="#FACC15" />
            <circle cx="44" cy="61" r="2.3" fill="#1E293B" />
            <circle cx="56" cy="61" r="2.3" fill="#1E293B" />
            <path d="M46 66 Q50 70 54 66" fill="none" stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );

      case 'mood-rainbow':
        return (
          <g>
            <path d="M22 65 A28 28 0 0 1 78 65" fill="none" stroke="#FB7185" strokeWidth="7" strokeLinecap="round" />
            <path d="M28 65 A22 22 0 0 1 72 65" fill="none" stroke="#FBBF24" strokeWidth="6.5" strokeLinecap="round" />
            <path d="M34 65 A16 16 0 0 1 66 65" fill="none" stroke="#34D399" strokeWidth="6" strokeLinecap="round" />
            <path d="M40 65 A10 10 0 0 1 60 65" fill="none" stroke="#60A5FA" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M16 69 C12 69 10 63 14 59 C14 53 22 51 27 55 C32 53 38 58 36 65 C37 68 34 69 30 69 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.2" />
            <path d="M64 69 C60 69 58 63 62 59 C62 53 70 51 75 55 C80 53 86 58 84 65 C85 68 82 69 78 69 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.2" />
          </g>
        );

      case 'mood-sparkle-ribbon':
        return (
          <g>
            <path d="M47 52 L28 77 L39 74 L47 82 L50 56 Z" fill="#F43F5E" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M53 52 L72 77 L61 74 L53 82 L50 56 Z" fill="#F43F5E" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M47 47 C27 28 14 38 19 52 C23 64 38 60 47 51 Z" fill="#FB7185" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M53 47 C73 28 86 38 81 52 C77 64 62 60 53 51 Z" fill="#FB7185" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="50" cy="49" r="7.5" fill="#F43F5E" stroke="#1E293B" strokeWidth="2.5" />
            <path d="M50 20 L52 25 L57 27 L52 29 L50 34 L48 29 L43 27 L48 25 Z" fill="#FACC15" />
          </g>
        );

      case 'mood-moon-stars':
        return (
          <g>
            <path d="M62 24 C42 26 32 45 40 62 C47 75 63 80 76 74 C60 84 36 78 27 60 C18 41 28 20 50 18 C54 18 58 20 62 24 Z" fill="#FDE047" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M68 30 L70 36 L76 38 L70 40 L68 46 L66 40 L60 38 L66 36 Z" fill="#A855F7" />
            <path d="M77 52 L78.5 56 L83 57.5 L78.5 59 L77 63 L75.5 59 L71 57.5 L75.5 56 Z" fill="#38BDF8" />
          </g>
        );

      case 'mood-100':
        return (
          <g>
            <rect x="14" y="25" width="72" height="46" rx="14" fill="#DC2626" stroke="#1E293B" strokeWidth="2.5" transform="rotate(-6 50 48)" />
            <text x="50" y="55" textAnchor="middle" fontSize="24" fontWeight="800" fill="#FFFFFF" transform="rotate(-6 50 48)">100%</text>
            <line x1="25" y1="67" x2="73" y2="62" stroke="#FDE047" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="28" y1="73" x2="71" y2="68" stroke="#FDE047" strokeWidth="3" strokeLinecap="round" />
          </g>
        );

      case 'mood-avc-shield':
        return (
          <g>
            <path d="M50 16 L80 27 V49 C80 68 65 80 50 85 C35 80 20 68 20 49 V27 Z" fill="#1A365D" stroke="#0F172A" strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M50 23 L73 31 V49 C73 63 62 73 50 77 C38 73 27 63 27 49 V31 Z" fill="#C8102E" />
            <path d="M50 32 L54 43 L66 43 L56 50 L60 61 L50 54 L40 61 L44 50 L34 43 L46 43 Z" fill="#FDE047" />
          </g>
        );
    }
  };

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      style={{
        filter:
          'drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 0 1.5px #ffffff) drop-shadow(0 4px 6px rgba(15, 23, 42, 0.22))',
      }}
    >
      <defs>
        <linearGradient id={`${uid}-coffee`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B45309" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      {renderGraphic()}
    </svg>
  );
}

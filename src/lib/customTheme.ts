export type AccentPresetId =
  | 'default'
  | 'sakura'
  | 'matcha'
  | 'ocean'
  | 'lavender'
  | 'sunset'
  | 'cyber'
  | 'custom';

export type CustomWallpaperKind = 'none' | 'illustration' | 'pattern' | 'upload';

export type StickerCategory = 'study' | 'cute' | 'food' | 'mood';

export type StickerId =
  | 'study-coffee'
  | 'study-book-stack'
  | 'study-laptop'
  | 'study-a-plus'
  | 'study-alarm'
  | 'study-graduation'
  | 'cute-cat-paw'
  | 'cute-shiba'
  | 'cute-froggy'
  | 'cute-bunny-heart'
  | 'cute-sleepy-cloud'
  | 'cute-duck-sparkle'
  | 'food-boba'
  | 'food-matcha'
  | 'food-croissant'
  | 'food-ramen'
  | 'food-strawberry-cake'
  | 'food-onigiri'
  | 'mood-fire'
  | 'mood-rainbow'
  | 'mood-sparkle-ribbon'
  | 'mood-moon-stars'
  | 'mood-100'
  | 'mood-avc-shield';

export type StickerSize = 'sm' | 'md' | 'lg';

export interface PlacedSticker {
  instanceId: string;
  stickerId: StickerId;
  xPct: number;
  yPct: number;
  size: StickerSize;
  rotation: number;
  flipX: boolean;
}

export type PetId =
  | 'cat-orange'
  | 'dog-corgi'
  | 'panda-sleepy'
  | 'fox-clever'
  | 'duck-cheerful'
  | 'bunny-mocha'
  | 'penguin-chubby'
  | 'dragon-mini';

export type PetBehavior = 'roam' | 'perch' | 'follow';
export type PetSize = 'sm' | 'md' | 'lg';

export interface PetSettings {
  id: PetId | 'none';
  name: string;
  behavior: PetBehavior;
  size: PetSize;
  xPct: number;
  yPct: number;
  showSpeech: boolean;
}

export interface CustomThemeSettings {
  enabled: boolean;
  activePackId: string | null;
  accentPreset: AccentPresetId;
  customPrimaryHex: string;
  customSecondaryHex: string;
  wallpaperKind: CustomWallpaperKind;
  wallpaperId: string;
  wallpaperDim: number;
  wallpaperBlur: number;
  decorationsHidden: boolean;
  stickersLocked: boolean;
  stickers: PlacedSticker[];
  pet: PetSettings;
}

export const CUSTOM_THEME_STORAGE_KEY = 'avc_custom_theme_v1';
export const MAX_PLACED_STICKERS = 14;

export const DEFAULT_PET_SETTINGS: PetSettings = {
  id: 'none',
  name: '',
  behavior: 'roam',
  size: 'md',
  xPct: 86,
  yPct: 82,
  showSpeech: true,
};

export const DEFAULT_CUSTOM_THEME_SETTINGS: CustomThemeSettings = {
  enabled: false,
  activePackId: null,
  accentPreset: 'default',
  customPrimaryHex: '#C8102E',
  customSecondaryHex: '#1A365D',
  wallpaperKind: 'none',
  wallpaperId: 'none',
  wallpaperDim: 45,
  wallpaperBlur: 2,
  decorationsHidden: false,
  stickersLocked: false,
  stickers: [],
  pet: { ...DEFAULT_PET_SETTINGS },
};

export interface AccentPresetMeta {
  id: AccentPresetId;
  label: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
}

export const ACCENT_PRESETS: AccentPresetMeta[] = [
  {
    id: 'default',
    label: 'Chuẩn Việt Mỹ',
    description: 'Đỏ #C8102E & Navy #1A365D chuẩn nhận diện nhà trường.',
    primaryHex: '#C8102E',
    secondaryHex: '#1A365D',
  },
  {
    id: 'sakura',
    label: 'Anh Đào Pastel',
    description: 'Hồng cánh đào dịu dàng kết hợp tím mận hiện đại.',
    primaryHex: '#DB2777',
    secondaryHex: '#6D28D9',
  },
  {
    id: 'matcha',
    label: 'Trà Xanh Matcha',
    description: 'Xanh lá tự nhiên dịu mắt, tạo cảm giác tập trung thư thái.',
    primaryHex: '#16A34A',
    secondaryHex: '#1E4D3B',
  },
  {
    id: 'ocean',
    label: 'Đại Dương Ngọc',
    description: 'Xanh ngọc lam mát mẻ cùng xanh biển sâu thanh lịch.',
    primaryHex: '#0284C7',
    secondaryHex: '#0F4C81',
  },
  {
    id: 'lavender',
    label: 'Oải Hương Đêm',
    description: 'Sắc tím oải hương mơ màng hợp với chủ đề ban đêm.',
    primaryHex: '#9333EA',
    secondaryHex: '#3B2F7F',
  },
  {
    id: 'sunset',
    label: 'Hoàng Hôn Lo-fi',
    description: 'Cam san hô ấm áp và nâu trầm phong cách góc học tập.',
    primaryHex: '#EA580C',
    secondaryHex: '#7C2D12',
  },
  {
    id: 'cyber',
    label: 'Đêm Neon Cyber',
    description: 'Hồng điện tử nổi bật trên nền xanh chàm tương lai.',
    primaryHex: '#EC4899',
    secondaryHex: '#4338CA',
  },
  {
    id: 'custom',
    label: 'Tự pha màu riêng',
    description: 'Chọn bất kỳ hai tông màu yêu thích để cá nhân hóa toàn trang.',
    primaryHex: '#C8102E',
    secondaryHex: '#1A365D',
  },
];

export interface WallpaperOption {
  id: string;
  kind: 'illustration' | 'pattern';
  label: string;
  description: string;
  src?: string;
  recommendedTheme: 'light' | 'dark' | 'both';
  previewGradient: string;
}

export const ILLUSTRATED_WALLPAPERS: WallpaperOption[] = [
  {
    id: 'lofi-study',
    kind: 'illustration',
    label: 'Góc học tập Lo-fi',
    description: 'Bàn học gỗ ấm áp bên cửa sổ chiều mưa, ánh đèn vàng dịu mắt.',
    src: '/assets/wallpapers/lofi-study.jpg',
    recommendedTheme: 'dark',
    previewGradient: 'from-amber-900 via-slate-800 to-indigo-950',
  },
  {
    id: 'pastel-clouds',
    kind: 'illustration',
    label: 'Bầu trời mây Pastel',
    description: 'Đám mây hồng phấn bồng bềnh trên nền trời hoàng hôn nhẹ nhàng.',
    src: '/assets/wallpapers/pastel-clouds.jpg',
    recommendedTheme: 'light',
    previewGradient: 'from-pink-200 via-rose-100 to-sky-200',
  },
  {
    id: 'aurora-night',
    kind: 'illustration',
    label: 'Đêm cực quang',
    description: 'Dải cực quang xanh ngọc lung linh phản chiếu trên mặt hồ tĩnh lặng.',
    src: '/assets/wallpapers/aurora-night.jpg',
    recommendedTheme: 'dark',
    previewGradient: 'from-slate-950 via-emerald-900 to-cyan-950',
  },
  {
    id: 'sakura-campus',
    kind: 'illustration',
    label: 'Mùa hoa Anh đào',
    description: 'Nhánh hoa anh đào rực rỡ dưới nắng mai cùng bầu trời xanh trong.',
    src: '/assets/wallpapers/sakura-campus.svg',
    recommendedTheme: 'light',
    previewGradient: 'from-pink-200 via-sky-200 to-blue-100',
  },
  {
    id: 'matcha-botanical',
    kind: 'illustration',
    label: 'Nắng lá Matcha',
    description: 'Bóng nắng qua tán lá xanh dịu trên nền tường kem tối giản.',
    src: '/assets/wallpapers/matcha-botanical.svg',
    recommendedTheme: 'light',
    previewGradient: 'from-stone-100 via-emerald-100 to-teal-200',
  },
  {
    id: 'cyber-grid',
    kind: 'illustration',
    label: 'Chân trời Cyber Đêm',
    description: 'Đường chân trời lưới ánh sáng xanh tím hiện đại phong cách synthwave.',
    src: '/assets/wallpapers/cyber-grid.svg',
    recommendedTheme: 'dark',
    previewGradient: 'from-indigo-950 via-fuchsia-900 to-cyan-900',
  },
  {
    id: 'ocean-breeze',
    kind: 'illustration',
    label: 'Gió biển sớm mai',
    description: 'Mặt biển ngọc lam bình yên đón ánh nắng nhẹ buổi sáng.',
    src: '/assets/wallpapers/ocean-breeze.svg',
    recommendedTheme: 'light',
    previewGradient: 'from-cyan-100 via-teal-200 to-sky-300',
  },
  {
    id: 'starry-library',
    kind: 'illustration',
    label: 'Thư viện đêm đầy sao',
    description: 'Khung cửa sổ thư viện nhìn ra bầu trời trăng sao tím thẫm.',
    src: '/assets/wallpapers/starry-library.svg',
    recommendedTheme: 'dark',
    previewGradient: 'from-violet-950 via-indigo-900 to-amber-900',
  },
  {
    id: 'golden-sunset',
    kind: 'illustration',
    label: 'Hoàng hôn phố thị',
    description: 'Ánh hoàng hôn cam tím ấm áp trên đường chân trời thành phố.',
    src: '/assets/wallpapers/golden-sunset.svg',
    recommendedTheme: 'dark',
    previewGradient: 'from-indigo-900 via-rose-700 to-amber-400',
  },
  {
    id: 'rainy-cafe',
    kind: 'illustration',
    label: 'Kính mưa Bokeh dịu mắt',
    description: 'Ánh đèn bokeh mờ ảo qua ô kính ngày mưa giúp tập trung làm việc.',
    src: '/assets/wallpapers/rainy-cafe.svg',
    recommendedTheme: 'dark',
    previewGradient: 'from-slate-900 via-teal-900 to-amber-900',
  },
  {
    id: 'bamboo-mist',
    kind: 'illustration',
    label: 'Rừng trúc sương sớm',
    description: 'Sương mai xanh mát dịu mắt và nhẹ nhàng như buổi sáng yên tĩnh.',
    src: '/assets/wallpapers/bamboo-mist.svg',
    recommendedTheme: 'light',
    previewGradient: 'from-emerald-50 via-teal-100 to-emerald-200',
  },
  {
    id: 'galaxy-violet',
    kind: 'illustration',
    label: 'Ngân hà tím đêm',
    description: 'Dải tinh vân tím hồng huyền ảo cùng hành tinh nhỏ góc trời.',
    src: '/assets/wallpapers/galaxy-violet.svg',
    recommendedTheme: 'dark',
    previewGradient: 'from-slate-950 via-purple-900 to-fuchsia-950',
  },
];

export const PATTERN_WALLPAPERS: WallpaperOption[] = [
  {
    id: 'pattern-avc-waves',
    kind: 'pattern',
    label: 'Sóng nhận diện Việt Mỹ',
    description: 'Các dải sóng lụa Đỏ & Navy mềm mại đúng tinh thần nhà trường.',
    recommendedTheme: 'both',
    previewGradient: 'from-rose-100 via-slate-100 to-blue-100',
  },
  {
    id: 'pattern-grid-notebook',
    kind: 'pattern',
    label: 'Trang vở kẻ ô học tập',
    description: 'Lưới ô vuông tinh tế gợi cảm giác ghi chú gọn gàng, sạch sẽ.',
    recommendedTheme: 'both',
    previewGradient: 'from-slate-50 via-slate-100 to-slate-200',
  },
  {
    id: 'pattern-mesh-aurora',
    kind: 'pattern',
    label: 'Dải lụa Mesh chuyển sắc',
    description: 'Chuyển sắc đa tầng êm ái, tôn nổi hiệu ứng kính mờ iOS.',
    recommendedTheme: 'both',
    previewGradient: 'from-fuchsia-200 via-sky-200 to-emerald-200',
  },
  {
    id: 'pattern-starfield',
    kind: 'pattern',
    label: 'Bầu trời sao lấp lánh',
    description: 'Các chòm sao mảnh dịu nhẹ trôi chậm trên nền trời sâu.',
    recommendedTheme: 'dark',
    previewGradient: 'from-slate-900 via-indigo-950 to-slate-900',
  },
  {
    id: 'pattern-sakura-petals',
    kind: 'pattern',
    label: 'Cánh hoa nhẹ bay',
    description: 'Họa tiết cánh hoa đào pastel rải thưa nhẹ nhàng không rối mắt.',
    recommendedTheme: 'light',
    previewGradient: 'from-pink-50 via-rose-100 to-pink-100',
  },
  {
    id: 'pattern-pixel-dots',
    kind: 'pattern',
    label: 'Lưới chấm tối giản',
    description: 'Chấm bi siêu mảnh tạo chiều sâu kỹ thuật hiện đại.',
    recommendedTheme: 'both',
    previewGradient: 'from-zinc-100 via-slate-100 to-zinc-200',
  },
];

export const ALL_WALLPAPERS: WallpaperOption[] = [
  ...ILLUSTRATED_WALLPAPERS,
  ...PATTERN_WALLPAPERS,
];

export interface StickerMeta {
  id: StickerId;
  label: string;
  category: StickerCategory;
  caption?: string;
}

export const STICKER_CATEGORIES: { id: 'all' | StickerCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'study', label: 'Học tập & Deadline' },
  { id: 'cute', label: 'Thú cưng dễ thương' },
  { id: 'food', label: 'Đồ uống & Ăn vặt' },
  { id: 'mood', label: 'Cổ vũ & Trang trí' },
];

export const STICKER_CATALOG: StickerMeta[] = [
  { id: 'study-coffee', label: 'Cà phê chạy deadline', category: 'study' },
  { id: 'study-book-stack', label: 'Chồng sách chăm chỉ', category: 'study' },
  { id: 'study-laptop', label: 'Laptop học tập', category: 'study' },
  { id: 'study-a-plus', label: 'Huy hiệu điểm A+', category: 'study' },
  { id: 'study-alarm', label: 'Chuông nhắc giờ học', category: 'study' },
  { id: 'study-graduation', label: 'Mũ cử nhân rực rỡ', category: 'study' },

  { id: 'cute-cat-paw', label: 'Bàn chân mèo hồng', category: 'cute' },
  { id: 'cute-shiba', label: 'Bé Shiba cười tít', category: 'cute' },
  { id: 'cute-froggy', label: 'Ếch con vương miện', category: 'cute' },
  { id: 'cute-bunny-heart', label: 'Thỏ trắng ôm tim', category: 'cute' },
  { id: 'cute-sleepy-cloud', label: 'Mây ngủ ngon giấc', category: 'cute' },
  { id: 'cute-duck-sparkle', label: 'Vịt kính râm siêu ngầu', category: 'cute' },

  { id: 'food-boba', label: 'Trà sữa trân châu', category: 'food' },
  { id: 'food-matcha', label: 'Matcha latte đá', category: 'food' },
  { id: 'food-croissant', label: 'Bánh sừng bò giòn', category: 'food' },
  { id: 'food-ramen', label: 'Tô mì nóng cứu đói', category: 'food' },
  { id: 'food-strawberry-cake', label: 'Bánh kem dâu tây', category: 'food' },
  { id: 'food-onigiri', label: 'Cơm nắm mặt cười', category: 'food' },

  { id: 'mood-fire', label: 'Ngọn lửa quyết tâm', category: 'mood' },
  { id: 'mood-rainbow', label: 'Cầu vồng Pastel', category: 'mood' },
  { id: 'mood-sparkle-ribbon', label: 'Nơ hồng lấp lánh', category: 'mood' },
  { id: 'mood-moon-stars', label: 'Trăng sao dịu êm', category: 'mood' },
  { id: 'mood-100', label: '100% Năng lượng', category: 'mood' },
  { id: 'mood-avc-shield', label: 'Tự hào Việt Mỹ', category: 'mood' },
];

export interface PetMeta {
  id: PetId;
  label: string;
  speciesTag: string;
  description: string;
  treatName: string;
  accentColor: string;
  quotes: string[];
}

export const PET_CATALOG: PetMeta[] = [
  {
    id: 'cat-orange',
    label: 'Mèo Mướp Cam',
    speciesTag: 'Siêu lười đáng yêu',
    description: 'Thích cuộn tròn ngủ gật, vẫy đuôi nhẹ và nhắc bạn uống nước.',
    treatName: 'Cá hồi tươi',
    accentColor: '#F97316',
    quotes: [
      'Meo~ Kiểm tra thời khóa biểu tuần này chưa đó?',
      'Nghỉ mắt 20 giây rồi học tiếp nha sen!',
      'Cố lên, sắp tới giờ ra chơi rồi meo!',
      'Hôm nay bạn chăm chỉ tuyệt vời luôn!',
    ],
  },
  {
    id: 'dog-corgi',
    label: 'Cún Corgi Mông Tròn',
    speciesTag: 'Năng lượng 200%',
    description: 'Chạy lon ton đầy năng lượng, vẫy tai cổ vũ mỗi khi bạn bấm vào.',
    treatName: 'Xương bánh quy',
    accentColor: '#D97706',
    quotes: [
      'Gâu! Hôm nay tinh thần học tập lên cao nào!',
      'Sắp xong bài rồi, cố thêm chút nữa nhé!',
      'Đừng quên nộp bài tập đúng hạn nha!',
      'Bấm vuốt ve mình thêm cái nữa đi nào!',
    ],
  },
  {
    id: 'panda-sleepy',
    label: 'Gấu Trúc Ngái Ngủ',
    speciesTag: 'Bình tĩnh vượt deadline',
    description: 'Ôm cành trúc gật gù bình yên, giúp hạ nhiệt căng thẳng mùa thi.',
    treatName: 'Măng trúc non',
    accentColor: '#16A34A',
    quotes: [
      'Hít thở sâu một hơi, việc gì cũng xong thôi~',
      'Ngủ đủ giấc tối nay để mai lên lớp tỉnh táo nha.',
      'Chậm mà chắc, từng bài một là qua hết!',
      'Ăn miếng trúc rồi làm tiếp nhé!',
    ],
  },
  {
    id: 'fox-clever',
    label: 'Cáo Đỏ Tinh Nghịch',
    speciesTag: 'Thông minh nhanh nhẹn',
    description: 'Đuôi bông xù mềm mại, đồng hành cùng những buổi tối ôn bài.',
    treatName: 'Dâu tây chín',
    accentColor: '#DC2626',
    quotes: [
      'Ghi chú lại ý chính bài giảng hôm nay chưa?',
      'Nhanh nhẹn như cáo, xử lý gọn đống bài tập nào!',
      'Tối nay thời tiết đẹp để đọc thêm tài liệu đấy!',
      'Bạn đang tiến bộ từng ngày luôn đó!',
    ],
  },
  {
    id: 'duck-cheerful',
    label: 'Vịt Vàng Khăn Đỏ',
    speciesTag: 'Linh vật Việt Mỹ',
    description: 'Đeo chiếc khăn quàng đỏ thương hiệu, lạch bạch cổ vũ cả lớp.',
    treatName: 'Hạt ngô ngọt',
    accentColor: '#EAB308',
    quotes: [
      'Cạp cạp! Tự hào sinh viên Cao đẳng Việt Mỹ!',
      'Đi học đúng giờ để không lỡ điểm danh nha!',
      'Chúc cả lớp một tiết học thật nhiều niềm vui!',
      'Năng lượng tích cực lan tỏa khắp phòng học!',
    ],
  },
  {
    id: 'bunny-mocha',
    label: 'Thỏ Kem Tai Dài',
    speciesTag: 'Dịu dàng Pastel',
    description: 'Đôi tai cụp nhún nhảy nhẹ nhàng, siêu hợp chủ đề sáng nhẹ.',
    treatName: 'Cà rốt giòn',
    accentColor: '#EC4899',
    quotes: [
      'Uống một ngụm nước mát cho tươi tỉnh nhé!',
      'Chúc bạn có một ngày thật dịu dàng và hiệu quả!',
      'Đọc kỹ đề bài trước khi nộp nhé bạn ơi!',
      'Nhảy một cái lấy may cho bài kiểm tra nào!',
    ],
  },
  {
    id: 'penguin-chubby',
    label: 'Chim Cánh Cụt Béo',
    speciesTag: 'Mát lạnh cực Bắc',
    description: 'Lắc lư hai cánh tròn ủng, hợp với nền đêm cực quang mát mắt.',
    treatName: 'Cá trích nhỏ',
    accentColor: '#0284C7',
    quotes: [
      'Giữ cái đầu lạnh để giải quyết mọi deadline!',
      'Lạch bạch tiến bước, không bỏ buổi học nào!',
      'Mát mẻ, bình tĩnh và tự tin làm bài nhé!',
      'Trượt một đường băng về đích nào!',
    ],
  },
  {
    id: 'dragon-mini',
    label: 'Rồng Nhỏ Lửa Xanh',
    speciesTag: 'Linh thú may mắn',
    description: 'Cánh nhỏ vỗ nhịp nhàng, tiếp thêm lửa nhiệt huyết khi học đêm.',
    treatName: 'Kẹo sao sáng',
    accentColor: '#6366F1',
    quotes: [
      'Thổi bùng ngọn lửa sáng tạo trong bài thuyết trình!',
      'Không có bài tập nào làm khó được bạn đâu!',
      'Chúc bạn gặt hái thật nhiều điểm A+ kỳ này!',
      'Sức mạnh tập trung đang được kích hoạt!',
    ],
  },
];

export interface ThemePackMeta {
  id: string;
  label: string;
  tagline: string;
  recommendedThemeMode?: 'light' | 'dark';
  recommendedGlass?: 'none' | 'frosted' | 'liquid';
  settings: Partial<CustomThemeSettings>;
}

export const THEME_PACKS: ThemePackMeta[] = [
  {
    id: 'pack-default',
    label: 'Mặc định Việt Mỹ',
    tagline: 'Gọn gàng, chuẩn nhận diện trường học, tắt ảnh nền và trang trí.',
    recommendedGlass: 'none',
    settings: {
      enabled: false,
      accentPreset: 'default',
      wallpaperKind: 'none',
      wallpaperId: 'none',
      stickers: [],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'none' },
    },
  },
  {
    id: 'pack-lofi',
    label: 'Góc Học Tập Lo-fi',
    tagline: 'Bàn học chiều mưa ấm áp, Mèo Mướp Cam & sticker cà phê.',
    recommendedThemeMode: 'dark',
    recommendedGlass: 'frosted',
    settings: {
      enabled: true,
      accentPreset: 'sunset',
      wallpaperKind: 'illustration',
      wallpaperId: 'lofi-study',
      wallpaperDim: 48,
      wallpaperBlur: 2,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-lofi-1', stickerId: 'study-coffee', xPct: 86, yPct: 16, size: 'md', rotation: 8, flipX: false },
        { instanceId: 'pack-lofi-2', stickerId: 'study-laptop', xPct: 79, yPct: 12, size: 'sm', rotation: -9, flipX: false },
        { instanceId: 'pack-lofi-3', stickerId: 'mood-moon-stars', xPct: 19, yPct: 78, size: 'sm', rotation: -6, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'cat-orange', name: 'Cam Ú', behavior: 'roam', size: 'md' },
    },
  },
  {
    id: 'pack-pastel',
    label: 'Bầu Trời Mây Pastel',
    tagline: 'Mây hồng bồng bềnh, Thỏ Kem Tai Dài & trà sữa cầu vồng.',
    recommendedThemeMode: 'light',
    recommendedGlass: 'liquid',
    settings: {
      enabled: true,
      accentPreset: 'sakura',
      wallpaperKind: 'illustration',
      wallpaperId: 'pastel-clouds',
      wallpaperDim: 38,
      wallpaperBlur: 2,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-pastel-1', stickerId: 'mood-rainbow', xPct: 86, yPct: 15, size: 'md', rotation: 6, flipX: false },
        { instanceId: 'pack-pastel-2', stickerId: 'food-boba', xPct: 79, yPct: 18, size: 'sm', rotation: -8, flipX: false },
        { instanceId: 'pack-pastel-3', stickerId: 'cute-sleepy-cloud', xPct: 20, yPct: 79, size: 'md', rotation: -5, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'bunny-mocha', name: 'Mochi', behavior: 'roam', size: 'md' },
    },
  },
  {
    id: 'pack-aurora',
    label: 'Đêm Cực Quang',
    tagline: 'Bầu trời cực quang xanh ngọc sâu lắng & Chim Cánh Cụt Béo.',
    recommendedThemeMode: 'dark',
    recommendedGlass: 'liquid',
    settings: {
      enabled: true,
      accentPreset: 'ocean',
      wallpaperKind: 'illustration',
      wallpaperId: 'aurora-night',
      wallpaperDim: 42,
      wallpaperBlur: 1,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-aurora-1', stickerId: 'mood-moon-stars', xPct: 86, yPct: 14, size: 'md', rotation: 5, flipX: false },
        { instanceId: 'pack-aurora-2', stickerId: 'study-a-plus', xPct: 80, yPct: 18, size: 'sm', rotation: -10, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'penguin-chubby', name: 'Bông Tuyết', behavior: 'roam', size: 'md' },
    },
  },
  {
    id: 'pack-sakura',
    label: 'Sân Trường Hoa Đào',
    tagline: 'Nắng xuân rực rỡ cùng Cún Corgi năng động & mũ cử nhân.',
    recommendedThemeMode: 'light',
    recommendedGlass: 'frosted',
    settings: {
      enabled: true,
      accentPreset: 'sakura',
      wallpaperKind: 'illustration',
      wallpaperId: 'sakura-campus',
      wallpaperDim: 42,
      wallpaperBlur: 2,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-sakura-1', stickerId: 'mood-sparkle-ribbon', xPct: 86, yPct: 15, size: 'md', rotation: 9, flipX: false },
        { instanceId: 'pack-sakura-2', stickerId: 'study-graduation', xPct: 79, yPct: 14, size: 'sm', rotation: -8, flipX: false },
        { instanceId: 'pack-sakura-3', stickerId: 'food-strawberry-cake', xPct: 20, yPct: 78, size: 'sm', rotation: 5, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'dog-corgi', name: 'Bơ', behavior: 'roam', size: 'md' },
    },
  },
  {
    id: 'pack-matcha',
    label: 'Rừng Matcha Thanh Mát',
    tagline: 'Nắng lá xanh dịu mắt, Gấu Trúc Ngủ Gật & ly Matcha mát lạnh.',
    recommendedThemeMode: 'light',
    recommendedGlass: 'frosted',
    settings: {
      enabled: true,
      accentPreset: 'matcha',
      wallpaperKind: 'illustration',
      wallpaperId: 'matcha-botanical',
      wallpaperDim: 40,
      wallpaperBlur: 1,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-matcha-1', stickerId: 'food-matcha', xPct: 86, yPct: 15, size: 'md', rotation: 7, flipX: false },
        { instanceId: 'pack-matcha-2', stickerId: 'study-book-stack', xPct: 79, yPct: 17, size: 'sm', rotation: -6, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'panda-sleepy', name: 'Trúc Trúc', behavior: 'perch', size: 'md', xPct: 88, yPct: 82 },
    },
  },
  {
    id: 'pack-cyber',
    label: 'Chân Trời Cyber Đêm',
    tagline: 'Tông neon hồng chàm sắc nét cùng Rồng Nhỏ Lửa Xanh.',
    recommendedThemeMode: 'dark',
    recommendedGlass: 'liquid',
    settings: {
      enabled: true,
      accentPreset: 'cyber',
      wallpaperKind: 'illustration',
      wallpaperId: 'cyber-grid',
      wallpaperDim: 46,
      wallpaperBlur: 1,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-cyber-1', stickerId: 'study-laptop', xPct: 86, yPct: 15, size: 'md', rotation: -7, flipX: false },
        { instanceId: 'pack-cyber-2', stickerId: 'mood-fire', xPct: 80, yPct: 17, size: 'sm', rotation: 8, flipX: false },
        { instanceId: 'pack-cyber-3', stickerId: 'mood-100', xPct: 20, yPct: 78, size: 'sm', rotation: -6, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'dragon-mini', name: 'Draco', behavior: 'follow', size: 'md' },
    },
  },
  {
    id: 'pack-library',
    label: 'Thư Viện Đêm Đầy Sao',
    tagline: 'Khung cửa trăng sao yên tĩnh cùng Cáo Đỏ Tinh Nghịch.',
    recommendedThemeMode: 'dark',
    recommendedGlass: 'frosted',
    settings: {
      enabled: true,
      accentPreset: 'lavender',
      wallpaperKind: 'illustration',
      wallpaperId: 'starry-library',
      wallpaperDim: 45,
      wallpaperBlur: 2,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-lib-1', stickerId: 'study-book-stack', xPct: 86, yPct: 15, size: 'md', rotation: 6, flipX: false },
        { instanceId: 'pack-lib-2', stickerId: 'mood-moon-stars', xPct: 79, yPct: 14, size: 'sm', rotation: -8, flipX: false },
        { instanceId: 'pack-lib-3', stickerId: 'food-ramen', xPct: 20, yPct: 79, size: 'sm', rotation: 4, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'fox-clever', name: 'Hồ Ly', behavior: 'roam', size: 'md' },
    },
  },
  {
    id: 'pack-sunset',
    label: 'Hoàng Hôn Phố Thị',
    tagline: 'Chân trời cam tím rực rỡ cùng Vịt Vàng Khăn Đỏ Việt Mỹ.',
    recommendedThemeMode: 'dark',
    recommendedGlass: 'frosted',
    settings: {
      enabled: true,
      accentPreset: 'sunset',
      wallpaperKind: 'illustration',
      wallpaperId: 'golden-sunset',
      wallpaperDim: 45,
      wallpaperBlur: 2,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-sun-1', stickerId: 'mood-avc-shield', xPct: 86, yPct: 15, size: 'md', rotation: 6, flipX: false },
        { instanceId: 'pack-sun-2', stickerId: 'cute-duck-sparkle', xPct: 79, yPct: 17, size: 'sm', rotation: -8, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'duck-cheerful', name: 'Vịt Đỏ', behavior: 'roam', size: 'md' },
    },
  },
  {
    id: 'pack-galaxy',
    label: 'Ngân Hà Mộng Mơ',
    tagline: 'Tinh vân tím dịu mắt, Bé Shiba & bánh dâu cổ vũ ôn thi.',
    recommendedThemeMode: 'dark',
    recommendedGlass: 'liquid',
    settings: {
      enabled: true,
      accentPreset: 'lavender',
      wallpaperKind: 'illustration',
      wallpaperId: 'galaxy-violet',
      wallpaperDim: 44,
      wallpaperBlur: 1,
      decorationsHidden: false,
      stickers: [
        { instanceId: 'pack-gal-1', stickerId: 'cute-shiba', xPct: 86, yPct: 15, size: 'md', rotation: 7, flipX: false },
        { instanceId: 'pack-gal-2', stickerId: 'food-croissant', xPct: 20, yPct: 78, size: 'sm', rotation: -6, flipX: false },
      ],
      pet: { ...DEFAULT_PET_SETTINGS, id: 'cat-orange', name: 'Mây Tím', behavior: 'follow', size: 'md' },
    },
  },
];

const VALID_ACCENTS = new Set<AccentPresetId>(ACCENT_PRESETS.map((p) => p.id));
const VALID_WALLPAPER_KINDS = new Set<CustomWallpaperKind>(['none', 'illustration', 'pattern', 'upload']);
const VALID_STICKER_IDS = new Set<StickerId>(STICKER_CATALOG.map((s) => s.id));
const VALID_STICKER_SIZES = new Set<StickerSize>(['sm', 'md', 'lg']);
const VALID_PET_IDS = new Set<PetId | 'none'>(['none', ...PET_CATALOG.map((p) => p.id)]);
const VALID_PET_BEHAVIORS = new Set<PetBehavior>(['roam', 'perch', 'follow']);
const VALID_PET_SIZES = new Set<PetSize>(['sm', 'md', 'lg']);

export function sanitizeHexColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  return fallback;
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

export function sanitizePlacedStickers(raw: unknown): PlacedSticker[] {
  if (!Array.isArray(raw)) return [];
  const list: PlacedSticker[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<PlacedSticker>;
    if (!rec.stickerId || !VALID_STICKER_IDS.has(rec.stickerId)) continue;
    list.push({
      instanceId:
        typeof rec.instanceId === 'string' && rec.instanceId.trim()
          ? rec.instanceId
          : `st-${list.length}-${Date.now()}`,
      stickerId: rec.stickerId,
      xPct: clampNumber(rec.xPct, 2, 92, 82),
      yPct: clampNumber(rec.yPct, 4, 88, 20),
      size: rec.size && VALID_STICKER_SIZES.has(rec.size) ? rec.size : 'md',
      rotation: clampNumber(rec.rotation, -35, 35, 0),
      flipX: Boolean(rec.flipX),
    });
    if (list.length >= MAX_PLACED_STICKERS) break;
  }
  return list;
}

export function sanitizePetSettings(raw: unknown): PetSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PET_SETTINGS };
  const obj = raw as Partial<PetSettings>;
  return {
    id: obj.id && VALID_PET_IDS.has(obj.id) ? obj.id : DEFAULT_PET_SETTINGS.id,
    name: typeof obj.name === 'string' ? obj.name.slice(0, 24) : '',
    behavior:
      obj.behavior && VALID_PET_BEHAVIORS.has(obj.behavior)
        ? obj.behavior
        : DEFAULT_PET_SETTINGS.behavior,
    size: obj.size && VALID_PET_SIZES.has(obj.size) ? obj.size : DEFAULT_PET_SETTINGS.size,
    xPct: clampNumber(obj.xPct, 4, 92, DEFAULT_PET_SETTINGS.xPct),
    yPct: clampNumber(obj.yPct, 8, 90, DEFAULT_PET_SETTINGS.yPct),
    showSpeech: typeof obj.showSpeech === 'boolean' ? obj.showSpeech : DEFAULT_PET_SETTINGS.showSpeech,
  };
}

export function sanitizeCustomThemeSettings(raw: unknown): CustomThemeSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CUSTOM_THEME_SETTINGS };
  const obj = raw as Partial<CustomThemeSettings>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_CUSTOM_THEME_SETTINGS.enabled,
    activePackId: typeof obj.activePackId === 'string' ? obj.activePackId : null,
    accentPreset:
      obj.accentPreset && VALID_ACCENTS.has(obj.accentPreset)
        ? obj.accentPreset
        : DEFAULT_CUSTOM_THEME_SETTINGS.accentPreset,
    customPrimaryHex: sanitizeHexColor(
      obj.customPrimaryHex,
      DEFAULT_CUSTOM_THEME_SETTINGS.customPrimaryHex
    ),
    customSecondaryHex: sanitizeHexColor(
      obj.customSecondaryHex,
      DEFAULT_CUSTOM_THEME_SETTINGS.customSecondaryHex
    ),
    wallpaperKind:
      obj.wallpaperKind && VALID_WALLPAPER_KINDS.has(obj.wallpaperKind)
        ? obj.wallpaperKind
        : DEFAULT_CUSTOM_THEME_SETTINGS.wallpaperKind,
    wallpaperId: typeof obj.wallpaperId === 'string' ? obj.wallpaperId : 'none',
    wallpaperDim: clampNumber(obj.wallpaperDim, 0, 85, DEFAULT_CUSTOM_THEME_SETTINGS.wallpaperDim),
    wallpaperBlur: clampNumber(
      obj.wallpaperBlur,
      0,
      20,
      DEFAULT_CUSTOM_THEME_SETTINGS.wallpaperBlur
    ),
    decorationsHidden:
      typeof obj.decorationsHidden === 'boolean'
        ? obj.decorationsHidden
        : DEFAULT_CUSTOM_THEME_SETTINGS.decorationsHidden,
    stickersLocked:
      typeof obj.stickersLocked === 'boolean'
        ? obj.stickersLocked
        : DEFAULT_CUSTOM_THEME_SETTINGS.stickersLocked,
    stickers: sanitizePlacedStickers(obj.stickers),
    pet: sanitizePetSettings(obj.pet),
  };
}

export function loadCustomThemeSettings(): CustomThemeSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_CUSTOM_THEME_SETTINGS };
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CUSTOM_THEME_SETTINGS };
    return sanitizeCustomThemeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CUSTOM_THEME_SETTINGS };
  }
}

export function saveCustomThemeSettings(settings: CustomThemeSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage
  }
}

/* ------------------ Tính toán biến màu CSS an toàn tương phản ------------------ */

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [200, 16, 46];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function toCssRgb(rgb: Rgb): string {
  return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

function buildRoleTokens(hex: string, isDark: boolean) {
  const base = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(base);

  if (!isDark) {
    // Giữ độ đậm đủ để chữ trắng trên nút luôn đọc rõ trên nền sáng
    const solidL = Math.min(l, 0.46);
    const solid = hslToRgb([h, s, solidL]);
    const hover = hslToRgb([h, s, Math.max(0.14, solidL - 0.08)]);
    const soft = mixRgb([255, 255, 255], solid, 0.1);
    const accent = hslToRgb([h, s, Math.min(l, 0.42)]);
    return { solid, hover, soft, accent };
  }

  const solidL = Math.min(Math.max(l, 0.34), 0.5);
  const solid = hslToRgb([h, Math.min(1, s * 1.05), solidL]);
  const hover = hslToRgb([h, Math.min(1, s * 1.05), Math.min(0.62, solidL + 0.08)]);
  const soft = mixRgb([16, 25, 43], solid, 0.28);
  const accent = hslToRgb([h, Math.max(0.55, Math.min(0.92, s)), 0.76]);
  return { solid, hover, soft, accent };
}

const BRAND_CSS_PROPS = [
  '--color-brand-red',
  '--color-brand-red-hover',
  '--color-brand-red-soft',
  '--color-brand-red-accent',
  '--color-brand-navy',
  '--color-brand-navy-hover',
  '--color-brand-navy-soft',
  '--color-brand-navy-accent',
] as const;

export function getEffectiveAccentColors(settings: CustomThemeSettings): {
  primaryHex: string;
  secondaryHex: string;
} {
  if (!settings.enabled || settings.accentPreset === 'default') {
    return { primaryHex: '#C8102E', secondaryHex: '#1A365D' };
  }
  if (settings.accentPreset === 'custom') {
    return {
      primaryHex: settings.customPrimaryHex,
      secondaryHex: settings.customSecondaryHex,
    };
  }
  const found = ACCENT_PRESETS.find((item) => item.id === settings.accentPreset);
  return {
    primaryHex: found?.primaryHex ?? '#C8102E',
    secondaryHex: found?.secondaryHex ?? '#1A365D',
  };
}

export function applyCustomAccentVariables(
  root: HTMLElement,
  settings: CustomThemeSettings,
  isDark: boolean
): void {
  if (!settings.enabled || settings.accentPreset === 'default') {
    for (const prop of BRAND_CSS_PROPS) {
      root.style.removeProperty(prop);
    }
    root.classList.remove('custom-accent-active');
    return;
  }

  const { primaryHex, secondaryHex } = getEffectiveAccentColors(settings);
  const primary = buildRoleTokens(primaryHex, isDark);
  const secondary = buildRoleTokens(secondaryHex, isDark);

  root.style.setProperty('--color-brand-red', toCssRgb(primary.solid));
  root.style.setProperty('--color-brand-red-hover', toCssRgb(primary.hover));
  root.style.setProperty('--color-brand-red-soft', toCssRgb(primary.soft));
  root.style.setProperty('--color-brand-red-accent', toCssRgb(primary.accent));

  root.style.setProperty('--color-brand-navy', toCssRgb(secondary.solid));
  root.style.setProperty('--color-brand-navy-hover', toCssRgb(secondary.hover));
  root.style.setProperty('--color-brand-navy-soft', toCssRgb(secondary.soft));
  root.style.setProperty('--color-brand-navy-accent', toCssRgb(secondary.accent));
  root.classList.add('custom-accent-active');
}

/**
 * Chọn tọa độ gợi ý dọc 4 góc/biên thoáng để sticker mới không đè ngay chính giữa nội dung.
 */
export function pickSmartStickerPosition(existingCount: number): {
  xPct: number;
  yPct: number;
  rotation: number;
} {
  const slots = [
    { xPct: 86, yPct: 14, rotation: 7 },
    { xPct: 79, yPct: 16, rotation: -8 },
    { xPct: 20, yPct: 78, rotation: -6 },
    { xPct: 87, yPct: 75, rotation: 9 },
    { xPct: 21, yPct: 14, rotation: -7 },
    { xPct: 74, yPct: 80, rotation: 6 },
    { xPct: 89, yPct: 45, rotation: -9 },
    { xPct: 19, yPct: 46, rotation: 8 },
  ];
  const slot = slots[existingCount % slots.length];
  const jitter = ((existingCount * 7) % 5) - 2;
  return {
    xPct: Math.min(91, Math.max(4, slot.xPct + jitter)),
    yPct: Math.min(86, Math.max(6, slot.yPct + jitter)),
    rotation: slot.rotation,
  };
}

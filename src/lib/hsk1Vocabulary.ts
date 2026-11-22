export type HskInputMode = 'pinyin' | 'hanzi';
export type HskTowerTheme = 'lantern' | 'bamboo' | 'great_wall';
export type HskAvatarId = 'panda' | 'cat' | 'dragon' | 'tiger' | 'rabbit';

export type HskTopicId =
  | 'all'
  | 'v3_new'
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'pronoun'
  | 'number_measure'
  | 'adverb_particle';

export interface HskWord {
  stt: number;
  hanzi: string;
  pinyin: string;
  partOfSpeech: string;
  meaning: string;
  topic: Exclude<HskTopicId, 'all' | 'v3_new'>;
  isNewV3?: boolean;
}

export const HSK_TOPIC_LABELS: Record<HskTopicId, string> = {
  all: 'Toàn bộ HSK 1 ver 3.0 (298 từ)',
  v3_new: 'Từ vựng mới HSK ver 3.0',
  noun: 'Danh từ (Đồ vật, Thời gian, Địa điểm...)',
  verb: 'Động từ (Hành động, Giao tiếp...)',
  adjective: 'Tính từ (Miêu tả, Trạng thái...)',
  pronoun: 'Đại từ (Xưng hô, Chỉ định, Nghi vấn)',
  number_measure: 'Số từ & Lượng từ',
  adverb_particle: 'Phó từ, Trợ từ & Liên từ',
};

export const HSK_THEME_INFO: Record<
  HskTowerTheme,
  { label: string; description: string }
> = {
  lantern: {
    label: 'Tháp Đèn Lồng',
    description: 'Bậc thang tháp đỏ – vàng rực rỡ không khí lễ hội Trung Hoa',
  },
  bamboo: {
    label: 'Cột Tre Trúc',
    description: 'Leo từng đốt tre xanh mát trong rừng trúc thanh bình',
  },
  great_wall: {
    label: 'Vạn Lý Trường Thành',
    description: 'Chinh phục bậc đá cổ kính tiến lên đài phong hỏa',
  },
};

export const HSK_AVATARS: { id: HskAvatarId; name: string }[] = [
  { id: 'panda', name: 'Gấu Trúc' },
  { id: 'cat', name: 'Mèo Thần Tài' },
  { id: 'dragon', name: 'Rồng Con' },
  { id: 'tiger', name: 'Hổ Con' },
  { id: 'rabbit', name: 'Thỏ Ngọc' },
];

type RawHskRow = [
  stt: number,
  hanzi: string,
  pinyin: string,
  partOfSpeech: string,
  meaning: string,
  isNewV3?: 1,
];

// Toàn bộ từ vựng HSK 1 ver 3.0 (biên soạn theo chuẩn mới nhất, đã loại 2 dòng trùng 94/95)
const RAW_HSK1_V3_ROWS: RawHskRow[] = [
  [1, '爱', 'ài', 'Động từ', 'Yêu'],
  [2, '吧', 'ba', 'Trợ từ', 'Nhé, đi; chắc hẳn, chứ (suy đoán)', 1],
  [3, '八', 'bā', 'Số từ', 'Số 8'],
  [4, '爸爸', 'bàba', 'Danh từ', 'Bố, ba'],
  [5, '百', 'bǎi', 'Số từ', 'Trăm, một trăm', 1],
  [6, '白天', 'báitiān', 'Danh từ', 'Ban ngày', 1],
  [7, '半', 'bàn', 'Số từ', 'Một nửa, rưỡi', 1],
  [8, '包子', 'bāozi', 'Danh từ', 'Bánh bao', 1],
  [9, '北京', 'Běijīng', 'Danh từ', 'Bắc Kinh'],
  [10, '杯子', 'bēizi', 'Danh từ', 'Cái cốc'],
  [11, '本', 'běn', 'Lượng từ', 'Cuốn, quyển'],
  [12, '边', 'biān', 'Danh từ / Hậu tố', 'Ven, bờ, lề; bên, đằng, phía', 1],
  [13, '病', 'bìng', 'Danh từ / Động từ', 'Bệnh, bệnh tật; Bị ốm, bị bệnh', 1],
  [14, '不', 'bù', 'Phó từ', 'Không'],
  [15, '不客气', 'bú kèqi', 'Cụm giao tiếp', 'Đừng khách khí, đừng ngại'],
  [16, '不要', 'búyào', 'Phó từ', 'Không, đừng', 1],
  [17, '菜', 'cài', 'Danh từ', 'Món ăn, thức ăn'],
  [18, '茶', 'chá', 'Danh từ', 'Trà'],
  [19, '唱', 'chàng', 'Động từ', 'Hát', 1],
  [20, '超市', 'chāoshì', 'Danh từ', 'Siêu thị', 1],
  [21, '车', 'chē', 'Danh từ', 'Xe', 1],
  [22, '吃', 'chī', 'Động từ', 'Ăn'],
  [23, '穿', 'chuān', 'Động từ', 'Mặc, mang, đeo', 1],
  [24, '出租车', 'chūzūchē', 'Danh từ', 'Xe taxi'],
  [25, '大', 'dà', 'Tính từ', 'To, lớn'],
  [26, '打电话', 'dǎ diànhuà', 'Động từ', 'Gọi điện thoại'],
  [27, '大家', 'dàjiā', 'Đại từ', 'Mọi người, cả nhà', 1],
  [28, '到', 'dào', 'Động từ', 'Đi, đến, đi đến', 1],
  [29, '大学', 'dàxué', 'Danh từ', 'Đại học', 1],
  [30, '大学生', 'dàxuéshēng', 'Danh từ', 'Sinh viên, sinh viên đại học', 1],
  [31, '的', 'de', 'Trợ từ', 'Của'],
  [32, '第', 'dì', 'Tiền tố', 'Thứ, thứ tự, thứ hạng', 1],
  [33, '店', 'diàn', 'Danh từ', 'Tiệm, cửa hàng, cửa hiệu', 1],
  [34, '点', 'diǎn', 'Danh từ', 'Giờ'],
  [35, '电话', 'diànhuà', 'Danh từ', 'Điện thoại', 1],
  [36, '电脑', 'diànnǎo', 'Danh từ', 'Máy tính'],
  [37, '电视', 'diànshì', 'Danh từ', 'Ti vi'],
  [38, '电影', 'diànyǐng', 'Danh từ', 'Phim điện ảnh'],
  [39, '电影院', 'diànyǐngyuàn', 'Danh từ', 'Rạp chiếu phim', 1],
  [40, '弟弟', 'dìdi', 'Danh từ', 'Em trai', 1],
  [41, '东西', 'dōngxi', 'Danh từ', 'Đồ vật'],
  [42, '都', 'dōu', 'Phó từ', 'Đều'],
  [43, '读', 'dú', 'Động từ', 'Đọc'],
  [44, '对', 'duì', 'Tính từ / Giới từ', 'Đúng, chính xác; về, với, đối với', 1],
  [45, '对不起', 'duìbuqǐ', 'Động từ', 'Xin lỗi'],
  [46, '多', 'duō', 'Tính từ', 'Nhiều'],
  [47, '多少', 'duōshao', 'Đại từ', 'Bao nhiêu'],
  [48, '读书', 'dúshū', 'Động từ', 'Đọc sách, học bài, đi học', 1],
  [49, '二', 'èr', 'Số từ', 'Số 2'],
  [50, '儿子', 'érzi', 'Danh từ', 'Con trai'],
  [51, '饭', 'fàn', 'Danh từ', 'Cơm', 1],
  [52, '饭店', 'fàndiàn', 'Danh từ', 'Nhà hàng, quán ăn'],
  [53, '房间', 'fángjiān', 'Danh từ', 'Phòng, căn phòng', 1],
  [54, '非常', 'fēicháng', 'Phó từ', 'Rất, vô cùng, cực kỳ', 1],
  [55, '飞机', 'fēijī', 'Danh từ', 'Máy bay'],
  [56, '分', 'fēn', 'Lượng từ', 'Phút (thời gian), xu (đơn vị tiền tệ)', 1],
  [57, '分钟', 'fēnzhōng', 'Lượng từ', 'Phút'],
  [58, '高兴', 'gāoxìng', 'Tính từ / Động từ', 'Vui vẻ, hào hứng'],
  [59, '个', 'gè', 'Lượng từ', 'Cái'],
  [60, '歌', 'gē', 'Danh từ', 'Bài hát', 1],
  [61, '哥哥', 'gēge', 'Danh từ', 'Anh trai', 1],
  [62, '给', 'gěi', 'Động từ', 'Cho, đưa cho, trao cho', 1],
  [63, '公司', 'gōngsī', 'Danh từ', 'Công ty', 1],
  [64, '工作', 'gōngzuò', 'Danh từ / Động từ', 'Công việc, Làm việc'],
  [65, '狗', 'gǒu', 'Danh từ', 'Con chó'],
  [66, '贵', 'guì', 'Tính từ', 'Đắt', 1],
  [67, '国', 'guó', 'Danh từ', 'Nước, quốc gia', 1],
  [68, '还', 'hái', 'Phó từ', 'Vẫn, còn', 1],
  [69, '孩子', 'háizi', 'Danh từ', 'Trẻ em, bọn trẻ, đứa bé, con cái', 1],
  [70, '汉语', 'Hànyǔ', 'Danh từ', 'Tiếng Trung'],
  [71, '汉字', 'Hànzì', 'Danh từ', 'Chữ Hán, Hán tự', 1],
  [72, '号', 'hào', 'Danh từ', 'Ngày'],
  [73, '好', 'hǎo', 'Tính từ', 'Tốt, ổn, khỏe, được'],
  [74, '好吃', 'hǎochī', 'Tính từ', 'Ngon, ngon miệng', 1],
  [75, '好看', 'hǎokàn', 'Tính từ', 'Đẹp, xinh; hay, thú vị', 1],
  [76, '好听', 'hǎotīng', 'Tính từ', 'Hay, dễ nghe (âm thanh)', 1],
  [77, '好玩儿', 'hǎowánr', 'Tính từ', 'Hay, thú vị, thích thú', 1],
  [78, '和', 'hé', 'Liên từ', 'Và'],
  [79, '喝', 'hē', 'Động từ', 'Uống'],
  [80, '很', 'hěn', 'Phó từ', 'Rất'],
  [81, '后', 'hòu', 'Danh từ', 'Sau, phía sau', 1],
  [82, '后面', 'hòumiàn', 'Danh từ', 'Phía sau'],
  [83, '回', 'huí', 'Động từ', 'Quay lại, trở về'],
  [84, '会', 'huì', 'Trợ động từ', 'Sẽ / Biết'],
  [85, '火车', 'huǒchē', 'Danh từ', 'Xe lửa, tàu hỏa', 1],
  [86, '几', 'jǐ', 'Số từ', 'Mấy, vài'],
  [87, '家', 'jiā', 'Danh từ', 'Nhà, Gia đình'],
  [88, '见', 'jiàn', 'Động từ', 'Thấy, trông thấy, nhìn thấy', 1],
  [89, '件', 'jiàn', 'Lượng từ', 'Chiếc, kiện, cái, bộ', 1],
  [90, '叫', 'jiào', 'Động từ', 'Gọi'],
  [91, '饺子', 'jiǎozi', 'Danh từ', 'Bánh chẻo, sủi cảo, há cảo', 1],
  [92, '家人', 'jiārén', 'Danh từ', 'Gia đình, người nhà, thành viên trong gia đình', 1],
  [93, '鸡蛋', 'jīdàn', 'Danh từ', 'Trứng gà', 1],
  [96, '今天', 'jīntiān', 'Danh từ', 'Hôm nay'],
  [97, '九', 'jiǔ', 'Số từ', 'Số 9'],
  [98, '觉得', 'juéde', 'Động từ', 'Thấy, cảm thấy, cho rằng, nghĩ rằng', 1],
  [99, '开', 'kāi', 'Động từ', 'Mở'],
  [100, '开车', 'kāichē', 'Động từ', 'Lái xe, chạy xe, điều khiển xe', 1],
  [101, '看', 'kàn', 'Động từ', 'Xem, Nhìn'],
  [102, '看见', 'kàn jiàn', 'Động từ', 'Nhìn thấy'],
  [103, '看病', 'kànbìng', 'Động từ', 'Khám bệnh, đi khám bệnh', 1],
  [104, '课', 'kè', 'Danh từ', 'Giờ học, giờ lên lớp; tiết học', 1],
  [105, '可以', 'kěyǐ', 'Động từ / Tính từ', 'Có thể; Tốt, được, ổn', 1],
  [106, '口', 'kǒu', 'Danh từ / Lượng từ', 'Miệng; Nhân khẩu (thành viên gia đình)', 1],
  [107, '块', 'kuài', 'Lượng từ', 'Đồng (tiền); Miếng'],
  [108, '来', 'lái', 'Động từ', 'Đến, tới'],
  [109, '老师', 'lǎoshī', 'Danh từ', 'Giáo viên, thầy cô'],
  [110, '了', 'le', 'Trợ từ', 'Đã, rồi (biểu thị hoàn thành hành động)'],
  [111, '冷', 'lěng', 'Tính từ', 'Lạnh'],
  [112, '里', 'li', 'Danh từ', 'Phía trong, bên trong'],
  [113, '两', 'liǎng', 'Số từ', 'Hai', 1],
  [114, '零', 'líng', 'Số từ', 'Số 0', 1],
  [115, '六', 'liù', 'Số từ', 'Số 6'],
  [116, '吗', 'ma', 'Trợ từ', 'Không, ư, à (dùng cuối câu hỏi)'],
  [117, '卖', 'mài', 'Động từ', 'Bán', 1],
  [118, '买', 'mǎi', 'Động từ', 'Mua'],
  [119, '妈妈', 'māma', 'Danh từ', 'Mẹ, má'],
  [120, '忙', 'máng', 'Tính từ', 'Bận, bận rộn', 1],
  [121, '猫', 'māo', 'Danh từ', 'Con mèo'],
  [122, '没（有）', 'méi(yǒu)', 'Động từ / Phó từ', 'Không có (sở hữu); Không, chưa (làm gì)'],
  [123, '没关系', 'méi guānxi', 'Cụm giao tiếp', 'Không sao'],
  [124, '妹妹', 'mèimei', 'Danh từ', 'Em gái', 1],
  [125, '没事', 'méishì', 'Động từ', 'Ổn, không sao', 1],
  [126, '们', 'men', 'Hậu tố', 'Chúng, các, bọn (chỉ số nhiều)', 1],
  [127, '面包', 'miànbāo', 'Danh từ', 'Bánh mì', 1],
  [128, '面条儿', 'miàntiáor', 'Danh từ', 'Mì, mì sợi', 1],
  [129, '米饭', 'mǐfàn', 'Danh từ', 'Cơm'],
  [130, '明年', 'míngnián', 'Danh từ', 'Năm sau', 1],
  [131, '明天', 'míngtiān', 'Danh từ', 'Ngày mai'],
  [132, '名字', 'míngzi', 'Danh từ', 'Tên'],
  [133, '那', 'nà', 'Đại từ', 'Đó, kia'],
  [134, '哪', 'nǎ', 'Đại từ', 'Nào (dùng trong câu hỏi)'],
  [135, '那边', 'nàbiān', 'Đại từ', 'Đằng kia, bên đó', 1],
  [136, '那个', 'nàge', 'Đại từ', 'Cái kia, cái đó', 1],
  [137, '哪个', 'nǎge', 'Đại từ', 'Cái nào (dùng trong câu hỏi)', 1],
  [138, '那里', 'nàlǐ', 'Đại từ', 'Chỗ đó, nơi đó, nơi ấy, chỗ kia', 1],
  [139, '哪里', 'nǎlǐ', 'Đại từ', 'Chỗ nào, nơi nào, đâu', 1],
  [140, '男', 'nán', 'Tính từ', 'Nam (giới tính)', 1],
  [141, '男朋友', 'nánpéngyou', 'Danh từ', 'Bạn trai', 1],
  [142, '那儿', 'nàr', 'Đại từ', 'Chỗ đó, nơi đó, nơi ấy, chỗ kia', 1],
  [143, '哪儿', 'nǎr', 'Đại từ', 'Chỗ nào, nơi nào, đâu'],
  [144, '那些', 'nàxiē', 'Đại từ', 'Những... ấy; những... đó; những... kia', 1],
  [145, '哪些', 'nǎxiē', 'Đại từ', 'Những cái nào, người nào (câu hỏi)', 1],
  [146, '呢', 'ne', 'Trợ từ', 'Nhé, nhỉ, cơ, đấy; ...thì sao?; đâu?'],
  [147, '能', 'néng', 'Trợ động từ', 'Có thể'],
  [148, '你', 'nǐ', 'Đại từ', 'Bạn, cậu, anh, chị (đối phương)'],
  [149, '你好', 'nǐ hǎo', 'Cụm giao tiếp', 'Xin chào', 1],
  [150, '年', 'nián', 'Danh từ', 'Năm'],
  [151, '你们', 'nǐmen', 'Đại từ', 'Các bạn, các anh, các chị...', 1],
  [152, '您', 'nín', 'Đại từ', 'Ngài, ông, bà (kính trọng, lịch sự)', 1],
  [153, '牛奶', 'niúnǎi', 'Danh từ', 'Sữa bò', 1],
  [154, '女', 'nǚ', 'Tính từ', 'Nữ (giới tính)', 1],
  [155, '女儿', 'nǚér', 'Danh từ', 'Con gái'],
  [156, '女朋友', 'nǚpéngyou', 'Danh từ', 'Bạn gái', 1],
  [157, '女士', 'nǚshì', 'Danh từ', 'Quý bà, quý cô (tôn trọng, lịch sự)', 1],
  [158, '朋友', 'péngyou', 'Danh từ', 'Bạn, bạn bè'],
  [159, '便宜', 'piányi', 'Tính từ', 'Rẻ', 1],
  [160, '漂亮', 'piàoliang', 'Tính từ', 'Xinh đẹp'],
  [161, '苹果', 'píngguǒ', 'Danh từ', 'Quả táo'],
  [162, '七', 'qī', 'Số từ', 'Số 7'],
  [163, '钱', 'qián', 'Danh từ', 'Tiền'],
  [164, '前', 'qián', 'Danh từ', 'Trước, phía trước; Trước khi', 1],
  [165, '前面', 'qiánmiàn', 'Danh từ', 'Phía trước'],
  [166, '起床', 'qǐchuáng', 'Động từ', 'Thức dậy', 1],
  [167, '请', 'qǐng', 'Động từ', 'Xin, xin hãy, mời (lịch sự)'],
  [168, '请问', 'qǐngwèn', 'Động từ', 'Xin hỏi, cho hỏi', 1],
  [169, '去', 'qù', 'Động từ', 'Đi'],
  [170, '去年', 'qùnián', 'Danh từ', 'Năm ngoái', 1],
  [171, '热', 'rè', 'Tính từ', 'Nóng'],
  [172, '人', 'rén', 'Danh từ', 'Người'],
  [173, '认识', 'rènshi', 'Động từ', 'Quen, biết'],
  [174, '三', 'sān', 'Số từ', 'Số 3'],
  [175, '上', 'shàng', 'Danh từ / Động từ', 'Trên, phía trên; Lên, đi lên'],
  [176, '上班', 'shàngbān', 'Động từ', 'Đi làm', 1],
  [177, '商店', 'shāngdiàn', 'Danh từ', 'Cửa hàng, tiệm'],
  [178, '上课', 'shàngkè', 'Động từ', 'Lên lớp, vào học, đi học', 1],
  [179, '上午', 'shàngwǔ', 'Danh từ', 'Buổi sáng'],
  [180, '上学', 'shàngxué', 'Động từ', 'Đi học', 1],
  [181, '少', 'shǎo', 'Động từ / Tính từ', 'Ít; Thiếu'],
  [182, '谁', 'shéi / shúi', 'Đại từ', 'Ai'],
  [183, '生病', 'shēngbìng', 'Động từ', 'Bị ốm, bị bệnh', 1],
  [184, '什么', 'shénme', 'Đại từ', 'Cái gì?'],
  [185, '十', 'shí', 'Số từ', 'Số 10'],
  [186, '是', 'shì', 'Động từ', 'Là'],
  [187, '事', 'shì', 'Danh từ', 'Việc, sự việc, chuyện', 1],
  [188, '时候', 'shíhou', 'Danh từ', 'Lúc, khi'],
  [189, '时间', 'shíjiān', 'Danh từ', 'Thời gian', 1],
  [190, '手机', 'shǒujī', 'Danh từ', 'Điện thoại di động', 1],
  [191, '书', 'shū', 'Danh từ', 'Sách'],
  [192, '书店', 'shūdiàn', 'Danh từ', 'Nhà sách, hiệu sách', 1],
  [193, '睡', 'shuì', 'Động từ', 'Ngủ', 1],
  [194, '水', 'shuǐ', 'Danh từ', 'Nước'],
  [195, '水果', 'shuǐguǒ', 'Danh từ', 'Hoa quả'],
  [196, '睡觉', 'shuìjiào', 'Động từ', 'Ngủ'],
  [197, '说', 'shuō', 'Động từ', 'Nói'],
  [198, '四', 'sì', 'Số từ', 'Số 4'],
  [199, '岁', 'suì', 'Lượng từ', 'Tuổi'],
  [200, '他', 'tā', 'Đại từ', 'Cậu ấy, anh ấy, ông ấy...'],
  [201, '她', 'tā', 'Đại từ', 'Cô ấy, chị ấy, bà ấy...'],
  [202, '它', 'tā', 'Đại từ', 'Nó (chỉ sự vật, con vật)', 1],
  [203, '太', 'tài', 'Phó từ', 'Quá, lắm'],
  [204, '他们', 'tāmen', 'Đại từ', 'Họ, bọn họ', 1],
  [205, '它们', 'tāmen', 'Đại từ', 'Chúng, chúng nó', 1],
  [206, '她们', 'tāmen', 'Đại từ', 'Họ, các chị ấy, các cô ấy (nữ giới)', 1],
  [207, '天', 'tiān', 'Danh từ / Lượng từ', 'Trời, bầu trời; Ngày', 1],
  [208, '天气', 'tiānqì', 'Danh từ', 'Thời tiết'],
  [209, '听', 'tīng', 'Động từ', 'Nghe'],
  [210, '听见', 'tīngjiàn', 'Động từ', 'Nghe thấy', 1],
  [211, '同学', 'tóngxué', 'Danh từ', 'Bạn học'],
  [212, '外', 'wài', 'Danh từ', 'Bên ngoài', 1],
  [213, '外边', 'wàibian', 'Danh từ', 'Ngoài, bên ngoài, mặt ngoài', 1],
  [214, '玩', 'wán', 'Động từ', 'Chơi, chơi đùa', 1],
  [215, '晚', 'wǎn', 'Tính từ', 'Muộn', 1],
  [216, '晚饭', 'wǎnfàn', 'Danh từ', 'Cơm tối, bữa tối', 1],
  [217, '晚上', 'wǎnshang', 'Danh từ', 'Buổi tối', 1],
  [218, '喂', 'wèi', 'Thán từ', 'Alo, Này'],
  [219, '问', 'wèn', 'Động từ', 'Hỏi', 1],
  [220, '问题', 'wèntí', 'Danh từ', 'Vấn đề, câu hỏi', 1],
  [221, '我', 'wǒ', 'Đại từ', 'Tôi'],
  [222, '我们', 'wǒmen', 'Đại từ', 'Chúng tôi, chúng ta'],
  [223, '五', 'wǔ', 'Số từ', 'Số 5'],
  [224, '午饭', 'wǔfàn', 'Danh từ', 'Bữa trưa, cơm trưa', 1],
  [225, '下', 'xià', 'Danh từ / Động từ', 'Bên dưới, phía dưới; Xuống, hạ'],
  [226, '下雨', 'xià yǔ', 'Động từ', 'Mưa'],
  [227, '下班', 'xiàbān', 'Động từ', 'Tan ca, tan làm, hết giờ làm', 1],
  [228, '下课', 'xiàkè', 'Động từ', 'Tan học, hết giờ học', 1],
  [229, '想', 'xiǎng', 'Động từ', 'Muốn, nhớ, nghĩ'],
  [230, '先生', 'xiānsheng', 'Danh từ', 'Ông, ngài'],
  [231, '现在', 'xiànzài', 'Danh từ', 'Hiện tại, bây giờ, hiện nay'],
  [232, '小', 'xiǎo', 'Tính từ', 'Bé, nhỏ'],
  [233, '小姐', 'xiǎojiě', 'Danh từ', 'Quý cô, Tiểu thư'],
  [234, '小朋友', 'xiǎopéngyǒu', 'Danh từ', 'Trẻ em, bạn nhỏ', 1],
  [235, '小时', 'xiǎoshí', 'Danh từ', 'Tiếng / giờ (đồng hồ)', 1],
  [236, '小学', 'xiǎoxué', 'Danh từ', 'Tiểu học, bậc tiểu học', 1],
  [237, '小学生', 'xiǎoxuéshēng', 'Danh từ', 'Học sinh tiểu học', 1],
  [238, '下午', 'xiàwǔ', 'Danh từ', 'Buổi chiều'],
  [239, '写', 'xiě', 'Động từ', 'Viết'],
  [240, '些', 'xiē', 'Lượng từ', 'Một ít, vài'],
  [241, '谢谢', 'xièxie', 'Động từ', 'Cảm ơn'],
  [242, '喜欢', 'xǐhuan', 'Động từ', 'Thích'],
  [243, '新', 'xīn', 'Tính từ', 'Mới', 1],
  [244, '星期', 'xīngqī', 'Danh từ', 'Thứ, Tuần'],
  [245, '星期日', 'xīngqīrì', 'Danh từ', 'Chủ nhật', 1],
  [246, '星期天', 'xīngqītiān', 'Danh từ', 'Chủ nhật', 1],
  [247, '休息', 'xiūxi', 'Động từ', 'Nghỉ ngơi', 1],
  [248, '学', 'xué', 'Động từ', 'Học', 1],
  [249, '雪', 'xuě', 'Danh từ', 'Tuyết', 1],
  [250, '学生', 'xuéshēng', 'Danh từ', 'Học sinh'],
  [251, '学习', 'xuéxí', 'Động từ', 'Học tập'],
  [252, '学校', 'xuéxiào', 'Danh từ', 'Trường học'],
  [253, '要', 'yào', 'Động từ', 'Muốn, cần, phải', 1],
  [254, '也', 'yě', 'Phó từ', 'Cũng', 1],
  [255, '一', 'yī', 'Số từ', 'Số 1'],
  [256, '一半', 'yíbàn', 'Số từ', 'Một nửa', 1],
  [257, '一点儿', 'yìdiǎnr', 'Số lượng từ', 'Một ít, một chút'],
  [258, '衣服', 'yīfu', 'Danh từ', 'Quần áo'],
  [259, '医生', 'yīshēng', 'Danh từ', 'Bác sĩ'],
  [260, '一下', 'yíxià', 'Số lượng từ', 'Một tý, một lúc, thử xem, một cái', 1],
  [261, '一些', 'yìxiē', 'Số lượng từ', 'Một vài, một số, một phần', 1],
  [262, '医院', 'yīyuàn', 'Danh từ', 'Bệnh viện'],
  [263, '椅子', 'yǐzi', 'Danh từ', 'Cái ghế'],
  [264, '有', 'yǒu', 'Động từ', 'Có'],
  [265, '有（一）点儿', 'yǒu(yì)diǎnr', 'Phó từ', 'Hơi, một chút', 1],
  [266, '有的', 'yǒude', 'Đại từ', 'Có cái, có những', 1],
  [267, '有些', 'yǒuxiē', 'Đại từ', 'Một chút, một vài, một số', 1],
  [268, '雨', 'yǔ', 'Danh từ', 'Mưa', 1],
  [269, '元', 'yuán', 'Lượng từ', '(Đơn vị tiền tệ) đồng', 1],
  [270, '月', 'yuè', 'Danh từ', 'Tháng'],
  [271, '在', 'zài', 'Động từ / Giới từ / Phó từ', 'Sinh sống, tồn tại; ở, vào; đang'],
  [272, '再', 'zài', 'Phó từ', 'Lại, lần nữa, hãy, sẽ, hẵng', 1],
  [273, '再见', 'zàijiàn', 'Động từ', 'Tạm biệt, hẹn gặp lại'],
  [274, '早饭', 'zǎofàn', 'Danh từ', 'Bữa sáng', 1],
  [275, '早上', 'zǎoshang', 'Danh từ', 'Buổi sáng sớm', 1],
  [276, '怎么', 'zěnme', 'Đại từ', 'Sao, làm sao, thế nào'],
  [277, '怎么样', 'zěnmeyàng', 'Đại từ', 'Thế nào, như thế nào'],
  [278, '找', 'zhǎo', 'Động từ', 'Tìm', 1],
  [279, '这', 'zhè', 'Đại từ', 'Đây, này'],
  [280, '这边', 'zhèbiān', 'Đại từ', 'Ở đây, bên này, chỗ này, phía này', 1],
  [281, '这个', 'zhège', 'Đại từ', 'Cái này, vật này, việc này', 1],
  [282, '这里', 'zhèlǐ', 'Đại từ', 'Ở đây, nơi này, tại đây', 1],
  [283, '真', 'zhēn', 'Phó từ', 'Thật, quả là', 1],
  [284, '正在', 'zhèngzài', 'Phó từ', 'Đang', 1],
  [285, '这儿', 'zhèr', 'Đại từ', 'Chỗ này, ở đây', 1],
  [286, '这些', 'zhèxiē', 'Đại từ', 'Những thứ này, những điều này', 1],
  [287, '只', 'zhī', 'Lượng từ', '(Dùng cho động vật) con', 1],
  [288, '知道', 'zhīdào', 'Động từ', 'Biết', 1],
  [289, '中国', 'Zhōngguó', 'Danh từ', 'Trung Quốc'],
  [290, '中文', 'Zhōngwén', 'Danh từ', 'Tiếng Trung Quốc', 1],
  [291, '中午', 'zhōngwǔ', 'Danh từ', 'Buổi trưa'],
  [292, '中学', 'zhōngxué', 'Danh từ', 'Trung học', 1],
  [293, '中学生', 'zhōngxuéshēng', 'Danh từ', 'Học sinh trung học', 1],
  [294, '住', 'zhù', 'Động từ', 'Ở tại, sống tại'],
  [295, '桌子', 'zhuōzi', 'Danh từ', 'Cái bàn'],
  [296, '字', 'zì', 'Danh từ', 'Chữ'],
  [297, '坐', 'zuò', 'Động từ', 'Ngồi'],
  [298, '做', 'zuò', 'Động từ', 'Làm'],
  [299, '做饭', 'zuòfàn', 'Động từ', 'Nấu cơm, nấu ăn', 1],
  [300, '昨天', 'zuótiān', 'Danh từ', 'Hôm qua'],
];

function classifyPartOfSpeech(pos: string): Exclude<HskTopicId, 'all' | 'v3_new'> {
  const lower = pos.toLowerCase();
  if (lower.includes('đại từ')) return 'pronoun';
  if (lower.includes('số từ') || lower.includes('lượng từ')) return 'number_measure';
  if (lower.includes('tính từ')) return 'adjective';
  if (lower.includes('động từ') && !lower.startsWith('danh từ')) return 'verb';
  if (lower.includes('danh từ')) return 'noun';
  return 'adverb_particle';
}

export const HSK1_WORDS: HskWord[] = RAW_HSK1_V3_ROWS.map(
  ([stt, hanzi, pinyin, partOfSpeech, meaning, isNew]) => ({
    stt,
    hanzi,
    pinyin,
    partOfSpeech,
    meaning,
    topic: classifyPartOfSpeech(partOfSpeech),
    isNewV3: isNew === 1,
  })
);

/**
 * Chuẩn hóa Pinyin để so khớp linh hoạt: chấp nhận cả có dấu thanh điệu (nǐ hǎo),
 * không dấu (ni hao) hoặc viết liền (nihao), kể cả ü -> u/v.
 */
export function normalizePinyin(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ü/g, 'u')
    .replace(/v/g, 'u')
    .replace(/[^a-z]/g, '');
}

export function normalizeHanzi(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

/**
 * Mở rộng các dạng viết hợp lệ khi từ có dấu ngoặc tùy chọn (VD: 没（有） -> 没 | 没有)
 * hoặc có nhiều cách đọc phân tách bởi dấu '/' (VD: shéi / shúi).
 */
function expandAcceptedVariants(raw: string): string[] {
  const alternatives = raw.split('/').map((s) => s.trim()).filter(Boolean);
  const out = new Set<string>();
  for (const alt of alternatives) {
    // Dạng bỏ hẳn phần trong ngoặc () / （）
    const withoutOpt = alt.replace(/[（(][^）)]*[）)]/g, '').trim();
    // Dạng giữ nội dung trong ngoặc, bỏ dấu ngoặc
    const withOpt = alt.replace(/[（()）]/g, '').trim();
    if (withoutOpt) out.add(withoutOpt);
    if (withOpt) out.add(withOpt);
  }
  return [...out];
}

export function checkHskAnswer(
  word: Pick<HskWord, 'hanzi' | 'pinyin'>,
  userInput: string,
  mode: HskInputMode
): boolean {
  const clean = userInput.trim();
  if (!clean) return false;
  if (mode === 'hanzi') {
    const userNorm = normalizeHanzi(clean);
    return expandAcceptedVariants(word.hanzi).some(
      (variant) => normalizeHanzi(variant) === userNorm
    );
  }
  const userNorm = normalizePinyin(clean);
  return expandAcceptedVariants(word.pinyin).some(
    (variant) => normalizePinyin(variant) === userNorm
  );
}

export function pickShuffledHskWords(topic: HskTopicId, count: number): HskWord[] {
  const pool =
    topic === 'all'
      ? [...HSK1_WORDS]
      : topic === 'v3_new'
        ? HSK1_WORDS.filter((w) => w.isNewV3)
        : HSK1_WORDS.filter((w) => w.topic === topic);
  const source = pool.length > 0 ? pool : [...HSK1_WORDS];

  // Fisher-Yates shuffle
  for (let i = source.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = source[i];
    source[i] = source[j];
    source[j] = tmp;
  }

  const out: HskWord[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(source[i % source.length]);
  }
  return out;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

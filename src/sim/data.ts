export type SkillId =
  | 'stealth'
  | 'scavenging'
  | 'cooking'
  | 'construction'
  | 'crafting'
  | 'medical'
  | 'mechanics'
  | 'melee'
  | 'ranged'
  | 'fitness'
  | 'farming'
  | 'husbandry';

export const SKILLS: Record<SkillId, string> = {
  stealth: 'Lén lút',
  scavenging: 'Lục soát',
  cooking: 'Nấu ăn',
  construction: 'Xây dựng',
  crafting: 'Chế tạo',
  medical: 'Y tế',
  mechanics: 'Cơ khí',
  melee: 'Cận chiến',
  ranged: 'Bắn súng',
  fitness: 'Thể lực',
  farming: 'Trồng trọt',
  husbandry: 'Chăn nuôi',
};

export type Role = 'idle' | 'builder' | 'cook' | 'water' | 'farmer' | 'guard' | 'medic' | 'sanitation' | 'gatherer';

export const ROLES: Record<Role, { label: string; skill?: SkillId; desc: string }> = {
  idle: { label: 'Tự do', desc: 'Nghỉ ngơi, đọc sách, phụ việc lặt vặt.' },
  builder: { label: 'Thợ xây', skill: 'construction', desc: 'Làm các hạng mục xây dựng, gia cố.' },
  cook: { label: 'Đầu bếp', skill: 'cooking', desc: 'Nấu bữa ăn từ đồ sống, đun nước.' },
  water: { label: 'Nước', skill: 'crafting', desc: 'Kéo nước giếng, lọc/đun nước bẩn thành nước sạch.' },
  farmer: { label: 'Nông dân', skill: 'farming', desc: 'Gieo, chăm, thu hoạch vườn.' },
  guard: { label: 'Gác đêm', skill: 'melee', desc: 'Canh gác ban đêm, ngủ ban ngày.' },
  medic: { label: 'Y tá', skill: 'medical', desc: 'Băng bó, chữa bệnh, kiểm tra vết cắn.' },
  sanitation: { label: 'Vệ sinh', skill: 'fitness', desc: 'Dọn rác, xử lý xác, giữ base sạch.' },
  gatherer: { label: 'Kiếm củi', skill: 'fitness', desc: 'Tháo đồ gỗ, sắt vụn quanh base. Ồn!' },
};

export type TraitId = 'hardy' | 'light_sleeper' | 'glutton' | 'brave' | 'coward' | 'handy' | 'optimist' | 'quiet';

export const TRAITS: Record<TraitId, { label: string; desc: string }> = {
  hardy: { label: 'Khoẻ mạnh', desc: '−40% nguy cơ bệnh' },
  light_sleeper: { label: 'Ngủ ít', desc: '−20% mệt mỏi' },
  glutton: { label: 'Ăn khoẻ', desc: '+20% kcal tiêu hao' },
  brave: { label: 'Gan dạ', desc: '+25% sát thương, tinh thần vững' },
  coward: { label: 'Nhát gan', desc: '+10% né, −5 tinh thần' },
  handy: { label: 'Khéo tay', desc: '+20% tốc độ xây/chế' },
  optimist: { label: 'Lạc quan', desc: '+8 tinh thần' },
  quiet: { label: 'Lặng lẽ', desc: '+2 cấp Lén lút hiệu dụng' },
};

export const BACKGROUNDS: { label: string; skills: Partial<Record<SkillId, number>> }[] = [
  { label: 'Bác sĩ', skills: { medical: 5, crafting: 1 } },
  { label: 'Thợ săn', skills: { ranged: 5, melee: 1 } },
  { label: 'Người chăn nuôi', skills: { husbandry: 5, farming: 1 } },
  { label: 'Y tá', skills: { medical: 3, cooking: 1 } },
  { label: 'Thợ hồ', skills: { construction: 5, fitness: 2 } },
  { label: 'Thợ mộc', skills: { construction: 3, crafting: 3 } },
  { label: 'Đầu bếp', skills: { cooking: 5 } },
  { label: 'Thợ máy', skills: { mechanics: 5, crafting: 2 } },
  { label: 'Nông dân', skills: { farming: 5, fitness: 2 } },
  { label: 'Bộ đội xuất ngũ', skills: { melee: 4, stealth: 3, fitness: 3 } },
  { label: 'Bảo vệ', skills: { melee: 3, fitness: 2 } },
  { label: 'Shipper', skills: { scavenging: 3, stealth: 2, fitness: 2 } },
  { label: 'Sinh viên', skills: { crafting: 1, medical: 1 } },
  { label: 'Công nhân', skills: { fitness: 3, construction: 1, crafting: 1 } },
  { label: 'Tiểu thương', skills: { scavenging: 2, cooking: 2 } },
  { label: 'Kỹ sư điện', skills: { crafting: 4, mechanics: 2 } },
];

export const FAMILY = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
export const GIVEN = [
  'An', 'Bình', 'Cường', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Hiếu', 'Hoa', 'Hùng', 'Hương', 'Khang', 'Khánh',
  'Lan', 'Linh', 'Long', 'Mai', 'Minh', 'My', 'Nam', 'Ngọc', 'Nhung', 'Phong', 'Phúc', 'Quân', 'Quỳnh', 'Sơn',
  'Tâm', 'Thảo', 'Thành', 'Thu', 'Trang', 'Trung', 'Tuấn', 'Tú', 'Uyên', 'Việt', 'Vy', 'Yến',
];

export type Intensity = 'sleep' | 'rest' | 'light' | 'moderate' | 'heavy';

// Multipliers from design doc §5.
export const INTENSITY: Record<Intensity, { kcal: number; water: number; fatigue: number }> = {
  sleep: { kcal: 0.85, water: 0.7, fatigue: 0 },
  rest: { kcal: 1, water: 1, fatigue: 0.8 },
  light: { kcal: 1.5, water: 1.4, fatigue: 1 },
  moderate: { kcal: 2.2, water: 2.2, fatigue: 1.4 },
  heavy: { kcal: 3.5, water: 4, fatigue: 2.2 },
};

export const KCAL_PER_HOUR = 70;
export const WATER_ML_PER_HOUR = 100;
export const FATIGUE_PER_HOUR = 5.5;
export const SLEEP_BED_PER_HOUR = 14.3;
export const SLEEP_FLOOR_PER_HOUR = 9;
export const HYGIENE_L_PER_DAY = 10; // Sphere: ~15 L total incl. drinking & cooking
export const PEOPLE_PER_LATRINE = 20;

export type CropId = 'rau' | 'khoai' | 'thuoc';
export const CROPS: Record<CropId, { label: string; days: number; kcalPerM2: number }> = {
  // Năng suất THẬT (không còn 78 kcal/m²/ngày):
  //  rau muống: ~0,3 kg/m² mỗi lứa 25 ngày ≈ 90 kcal/m² → 3,6 kcal/m²/ngày
  //  khoai lang: ~2 kg/m² mỗi vụ 100 ngày ≈ 1.200 kcal/m² → 12 kcal/m²/ngày (cây lương thực)
  // 0,4 kg/m² mỗi lứa 25 ngày ≈ 120 kcal/m² (rau là cây bổ sung, khoai là cây calo).
  rau: { label: 'Rau muống', days: 25, kcalPerM2: 120 },
  khoai: { label: 'Khoai lang', days: 90, kcalPerM2: 1080 },
  thuoc: { label: 'Dược liệu', days: 40, kcalPerM2: 0 },
};
// ~6 h of hand labour keeps ~2000 m² of vegetables going (smallholder scale).
// 0.005 made a 3 400 m² field need 17 h/day; the untended floor then stalled crops
// at 1%/day and the farm ran at 5% capacity.
export const TEND_H_PER_M2_DAY = 0.003;

export type ZombieType = 'walker' | 'runner' | 'screamer' | 'bloater' | 'brute' | 'stalker';
export interface ZombieDef {
  label: string;
  /** Sát thương mỗi đòn khi nó áp sát được. */
  dmg: number;
  /** Xác suất cắn mỗi lần chạm. */
  bite: number;
  /** Tỷ trọng quần thể ngày 1 → ngày 61. */
  w0: number;
  w1: number;
  /** Máu: số "đòn chuẩn" (dmg 3) cần để hạ. */
  hp: number;
  /** Giáp tự nhiên: giảm sát thương theo `pierce` của vũ khí. */
  armor: number;
  /** Phần giáp của người chơi bị vô hiệu (0..1). */
  bypass: number;
  /** Nhanh: lao vào sát, nên vũ khí dài (`biteMult`) mất lợi thế. */
  fast?: boolean;
  /** Bị hạ lặng lẽ thì không kêu gọi bầy (+heat). */
  screams?: boolean;
}

export const ZOMBIES: Record<ZombieType, ZombieDef> = {
  // Đông, dai vừa, gần như không giáp — sát thương đều + độ bền vũ khí quyết định.
  walker: { label: 'Walker', dmg: 8, bite: 0.05, w0: 80, w1: 40, hp: 3.0, armor: 0.05, bypass: 0 },
  // Nhanh: khoảng cách không cứu được, phải hạ nhanh.
  runner: { label: 'Runner', dmg: 11, bite: 0.08, w0: 6, w1: 20, hp: 2.4, armor: 0, bypass: 0.1, fast: true },
  // Kêu gọi bầy: giết nhanh thì bớt ồn, để nó hét thì +8 heat.
  screamer: { label: 'Screamer', dmg: 6, bite: 0.04, w0: 4, w1: 12, hp: 2.0, armor: 0, bypass: 0, screams: true },
  // Mỡ dày: cần xuyên giáp; mật phun bỏ qua giáp mềm trừ khi có mặt nạ.
  bloater: { label: 'Bloater', dmg: 14, bite: 0.06, w0: 3, w1: 11, hp: 4.0, armor: 0.35, bypass: 0.7 },
  // Giáp dày: vũ khí nặng/xuyên mới ăn; đập bỏ qua giáp mềm, cần tấm thép.
  brute: { label: 'Brute', dmg: 32, bite: 0.12, w0: 0.5, w1: 8, hp: 6.5, armor: 0.5, bypass: 0.6 },
  // Đêm, nhanh và lì: ồn là kẻ thù, khoảng cách mất tác dụng.
  stalker: { label: 'Stalker', dmg: 16, bite: 0.1, w0: 0, w1: 6, hp: 3.4, armor: 0.15, bypass: 0.2, fast: true },
};

export interface Laws {
  rations: 'normal' | 'reduced' | 'work';
  bitten: 'quarantine' | 'exile' | 'execute';
  strangers: 'accept' | 'screen' | 'reject';
  curfew: boolean;
  noise: boolean;
  corpses: 'burn' | 'bury';
}

export type LawId = keyof Laws;

export const LAW_DEFS: { id: LawId; label: string; options: { value: Laws[LawId]; label: string; desc: string }[] }[] = [
  {
    id: 'rations',
    label: 'Khẩu phần',
    options: [
      { value: 'normal', label: 'Đầy đủ', desc: 'Ai cũng ăn no.' },
      { value: 'reduced', label: 'Cắt giảm', desc: '−25% khẩu phần. Tinh thần −8.' },
      { value: 'work', label: 'Theo công việc', desc: 'Người làm nặng ăn đủ, người tự do ăn 70%. Tinh thần −4.' },
    ],
  },
  {
    id: 'bitten',
    label: 'Người bị cắn',
    options: [
      { value: 'quarantine', label: 'Cách ly', desc: 'Nhốt riêng tới khi rõ. Tốn khẩu phần.' },
      { value: 'exile', label: 'Trục xuất', desc: 'Đuổi đi ngay. Tinh thần −4.' },
      { value: 'execute', label: 'Xử lý', desc: 'Kết liễu ngay. Tinh thần −12 cả nhóm.' },
    ],
  },
  {
    id: 'strangers',
    label: 'Người lạ',
    options: [
      { value: 'accept', label: 'Nhận tất cả', desc: 'Đông người nhanh. Có thể mang theo vết cắn.' },
      { value: 'screen', label: 'Kiểm tra 2 ngày', desc: 'Cách ly 2 ngày, phát hiện người nhiễm.' },
      { value: 'reject', label: 'Từ chối', desc: 'An toàn. Tinh thần −2.' },
    ],
  },
  {
    id: 'curfew',
    label: 'Giới nghiêm',
    options: [
      { value: false, label: 'Không', desc: '' },
      { value: true, label: 'Có', desc: 'Không viễn chinh ban đêm, gác +20%. Tinh thần −3.' },
    ],
  },
  {
    id: 'noise',
    label: 'Kỷ luật tiếng ồn',
    options: [
      { value: false, label: 'Không', desc: '' },
      { value: true, label: 'Có', desc: 'Heat tại base −40%, tốc độ làm việc −15%.' },
    ],
  },
  {
    id: 'corpses',
    label: 'Xử lý xác',
    options: [
      { value: 'burn', label: 'Đốt', desc: 'Nhanh, tốn 1 kg củi/xác. Tinh thần −1.' },
      { value: 'bury', label: 'Chôn', desc: 'Chậm gấp đôi. Tinh thần +2.' },
    ],
  },
];

export const LAW_COOLDOWN_DAYS = 3;

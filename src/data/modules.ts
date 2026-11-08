import type { Stock } from './items';

export type ModuleId =
  | 'bedroom'
  | 'kitchen'
  | 'storage'
  | 'workshop'
  | 'infirmary'
  | 'latrine'
  | 'water_tank'
  | 'filter'
  | 'garden'
  | 'herb_garden'
  | 'well'
  | 'watchtower'
  | 'rec_room'
  | 'bookshelf'
  | 'garage'
  | 'generator'
  | 'shelter'
  | 'forge'
  | 'carpentry'
  | 'kiln'
  | 'tailor'
  | 'smokehouse'
  | 'crock'
  | 'cellar'
  | 'coop'
  | 'pond';

export type Placement = 'indoor' | 'outdoor' | 'ground' | 'top_or_outdoor' | 'any';

/** One upgrade step. levels[0] takes the station from 1 to 2, levels[1] from 2 to 3. */
export interface ModuleLevel {
  cost: Partial<Stock>;
  workSec: number;
  /** What the new level unlocks — recipes pin `level` to this. */
  note: string;
}

export interface ModuleDef {
  label: string;
  icon: string;
  color: string;
  placement: Placement;
  minArea: number;
  /** Giới hạn số công trình mỗi điểm (đếm cả project đang chờ). Không đặt = xếp chồng tự do. */
  maxPerSite?: number;
  needsWorkshop?: boolean;
  workSec: (area: number) => number;
  cost: (area: number) => Partial<Stock>;
  desc: string;
  /** Upgrade ladder. Absent = the module is built once and never improves. */
  levels?: ModuleLevel[];
}

const H = 3600;

export const MODULES: Record<ModuleId, ModuleDef> = {
  bedroom: {
    label: 'Phòng ngủ',
    icon: '▭',
    color: '#5b6fa8',
    placement: 'indoor',
    minArea: 5,
    workSec: (a) => 0.5 * H + Math.floor(a / 5) * 0.4 * H,
    cost: (a) => ({ wood: 4 * Math.max(1, Math.floor(a / 5)), cloth: 2 * Math.max(1, Math.floor(a / 5)) }),
    desc: '1 giường / 5 m². Ngủ giường hồi mệt 14.3/h, ngủ sàn chỉ 9/h và giảm tinh thần.',
    levels: [
      { cost: { wood: 12, cloth: 8, rope: 3 }, workSec: 3 * H, note: 'Cấp 2: giường tầng — 1 giường / 4 m², ngủ hồi nhanh hơn' },
      { cost: { plank: 12, cloth: 10, thread: 8 }, workSec: 5 * H, note: 'Cấp 3: đệm và chăn — hồi mệt +20%' },
    ],
  },
  kitchen: {
    label: 'Bếp củi',
    icon: '♨',
    color: '#c0703a',
    placement: 'any',
    minArea: 6,
    maxPerSite: 1,
    workSec: () => 1.5 * H,
    cost: () => ({ wood: 10, scrap: 6 }),
    desc: 'Nấu gạo/khoai thành bữa ăn, đun sôi nước bẩn (tốn củi). Không có bếp, đồ sống chỉ ăn được một nửa năng lượng.',
    levels: [
      { cost: { scrap: 10, brick: 8, wood: 10 }, workSec: 4 * H, note: 'Cấp 2: nấu mẻ lớn bằng than' },
      { cost: { brick: 20, plate: 2, wood: 8 }, workSec: 7 * H, note: 'Cấp 3: bếp cho cả điểm, đỡ tốn củi' },
    ],
  },
  storage: {
    label: 'Kho có khoá',
    icon: '▦',
    color: '#8a7a50',
    placement: 'indoor',
    minArea: 6,
    maxPerSite: 1,
    workSec: () => 2 * H,
    cost: () => ({ wood: 8, scrap: 10 }),
    desc: 'Giảm chuột/ẩm làm hao gạo, giảm vật tư mất khi bị tập kích.',
    levels: [
      { cost: { wood: 16, scrap: 10, cloth: 4 }, workSec: 4 * H, note: 'Cấp 2: mất khi tập kích 5%' },
      { cost: { plate: 3, hinge: 6, gear: 1 }, workSec: 7 * H, note: 'Cấp 3: mất 2%, hàng khô lâu hỏng' },
    ],
  },
  workshop: {
    label: 'Bàn thợ',
    icon: '⚒',
    color: '#9a8a7a',
    placement: 'indoor',
    minArea: 8,
    maxPerSite: 1,
    workSec: () => 3 * H,
    cost: () => ({ wood: 20, scrap: 15, tools: 1 }),
    desc: 'Cổng công nghệ: cần để làm bộ lọc nước, giếng, tháp canh, gia cố cấp 2+.',
    levels: [
      { cost: { scrap: 25, tools: 2, gear: 1 }, workSec: 6 * H, note: 'Cấp 2: mở ắc quy, đèn dầu, sửa đồ cơ khí' },
      { cost: { plate: 4, gear: 4, wire: 10 }, workSec: 10 * H, note: 'Cấp 3: mở pin mặt trời, tời, bơm' },
    ],
  },
  infirmary: {
    label: 'Phòng y tế',
    icon: '✚',
    color: '#4fa77a',
    placement: 'indoor',
    minArea: 8,
    maxPerSite: 1,
    workSec: () => 2.5 * H,
    cost: () => ({ wood: 10, cloth: 10 }),
    desc: 'Người bệnh/bị thương hồi nhanh hơn. Dùng để cách ly người bị cắn.',
    levels: [
      { cost: { cloth: 12, wood: 8, medicine: 2 }, workSec: 5 * H, note: 'Cấp 2: hồi HP ×3,0' },
      { cost: { plank: 8, plate: 1, medicine: 4 }, workSec: 8 * H, note: 'Cấp 3: hồi HP ×3,5, chữa bệnh chắc hơn' },
    ],
  },
  latrine: {
    label: 'Nhà vệ sinh',
    icon: '◌',
    color: '#6a6a50',
    placement: 'ground',
    minArea: 2,
    workSec: () => 1.5 * H,
    cost: () => ({ wood: 6, scrap: 2 }),
    desc: 'Chuẩn Sphere: 1 nhà vệ sinh / 20 người. Thiếu → bẩn → dịch bệnh.',
    levels: [
      { cost: { wood: 6, clay: 10, stone: 6 }, workSec: 2 * H, note: 'Cấp 2: 25 người/nhà' },
      { cost: { brick: 8, lime: 6 }, workSec: 4 * H, note: 'Cấp 3: 30 người/nhà, đỡ mùi' },
    ],
  },
  water_tank: {
    label: 'Bể hứng mưa',
    icon: '◍',
    color: '#3f7fbf',
    placement: 'top_or_outdoor',
    minArea: 4,
    workSec: () => 2.5 * H,
    cost: () => ({ wood: 8, scrap: 12 }),
    desc: 'Hứng nước mưa từ toàn bộ mái (diện tích thật của toà nhà). Mỗi bể chứa 1000 L.',
    levels: [
      { cost: { scrap: 12, wood: 10 }, workSec: 3 * H, note: 'Cấp 2: +40% sức chứa' },
      { cost: { plate: 2, scrap: 10, lime: 4 }, workSec: 6 * H, note: 'Cấp 3: +80% sức chứa' },
    ],
  },
  filter: {
    label: 'Trạm lọc nước',
    icon: '⧖',
    color: '#5aa0d0',
    placement: 'ground',
    minArea: 4,
    maxPerSite: 1,
    needsWorkshop: true,
    workSec: () => 2 * H,
    cost: () => ({ scrap: 8, cloth: 6, wood: 4 }),
    desc: 'Lọc nước bẩn → sạch 12 L/giờ, không tốn củi.',
    levels: [
      { cost: { scrap: 14, cloth: 6, wood: 8 }, workSec: 4 * H, note: 'Cấp 2: 18 L/giờ' },
      { cost: { plate: 2, charcoal: 4, cloth: 6 }, workSec: 7 * H, note: 'Cấp 3: 24 L/giờ' },
    ],
  },
  garden: {
    label: 'Vườn rau',
    icon: '❦',
    color: '#5f9a3a',
    placement: 'top_or_outdoor',
    minArea: 6,
    workSec: (a) => 1 * H + a * 20,
    cost: (a) => ({ wood: Math.ceil(a / 20), seeds: 1 }),
    desc: 'Trồng rau muống (30 ngày) hoặc khoai lang (110 ngày). Vườn trên mái cũng được.',
    levels: [
      { cost: { wood: 10, rope: 4, clay: 8 }, workSec: 3 * H, note: 'Cấp 2: +10% năng suất' },
      { cost: { plank: 8, lime: 6, seeds: 2 }, workSec: 5 * H, note: 'Cấp 3: +20% năng suất' },
    ],
  },
  herb_garden: {
    label: 'Vườn thuốc',
    icon: '✥',
    color: '#4fa77a',
    placement: 'top_or_outdoor',
    minArea: 4,
    workSec: (a) => 1 * H + a * 20,
    cost: (a) => ({ wood: Math.ceil(a / 10), cloth: Math.ceil(a / 20) }),
    desc: 'Trồng dược liệu, chu kỳ 40 ngày. Thu hoạch: thuốc và băng gạc (cần vải khi thu băng). Farmer chăm như vườn thường.',
    levels: [
      { cost: { wood: 10, rope: 4, cloth: 6 }, workSec: 3 * H, note: 'Cấp 2: +25% dược liệu' },
      { cost: { plank: 8, lime: 4, cloth: 6 }, workSec: 5 * H, note: 'Cấp 3: +50% dược liệu và băng gạc' },
    ],
  },
  well: {
    label: 'Giếng khoan tay',
    icon: '◎',
    color: '#2f6fa0',
    placement: 'outdoor',
    minArea: 4,
    maxPerSite: 1,
    needsWorkshop: true,
    workSec: () => 8 * H,
    cost: () => ({ scrap: 12, wood: 10, tools: 1 }),
    desc: 'Nguồn nước bẩn ổn định ~1500 L/ngày. Phải cách nhà vệ sinh tối thiểu 10 m.',
    levels: [
      { cost: { scrap: 18, rope: 6, wood: 10 }, workSec: 6 * H, note: 'Cấp 2: 2000 L/ngày' },
      { cost: { plate: 3, gear: 1, brick: 8 }, workSec: 9 * H, note: 'Cấp 3: 2500 L/ngày, bơm tay' },
    ],
  },
  watchtower: {
    label: 'Tháp canh',
    icon: '⌂',
    color: '#a05a5a',
    placement: 'top_or_outdoor',
    minArea: 4,
    maxPerSite: 2,
    needsWorkshop: true,
    workSec: () => 4 * H,
    cost: () => ({ wood: 25, scrap: 10 }),
    desc: '+12 phòng thủ và phát hiện tập kích sớm.',
    levels: [
      { cost: { wood: 14, scrap: 6, rope: 4 }, workSec: 4 * H, note: 'Cấp 2: +16 phòng thủ' },
      { cost: { plate: 2, wire: 6, plank: 10 }, workSec: 7 * H, note: 'Cấp 3: +20 phòng thủ, thấy trước bầy' },
    ],
  },
  rec_room: {
    label: 'Phòng sinh hoạt',
    icon: '♪',
    color: '#9a6ab0',
    placement: 'indoor',
    minArea: 8,
    workSec: () => 1.5 * H,
    cost: () => ({ wood: 8, cloth: 6 }),
    desc: 'Bữa ăn chung, kể chuyện. Tinh thần +8 cho cả nhóm.',
    levels: [
      { cost: { wood: 12, cloth: 8, books: 1 }, workSec: 3 * H, note: 'Cấp 2: +12 tinh thần' },
      { cost: { plank: 12, cloth: 10, books: 2 }, workSec: 5 * H, note: 'Cấp 3: +16 tinh thần' },
    ],
  },
  bookshelf: {
    label: 'Kệ sách',
    icon: '▤',
    color: '#b09060',
    placement: 'indoor',
    minArea: 4,
    maxPerSite: 1,
    workSec: () => 1 * H,
    cost: () => ({ wood: 4, cloth: 2 }),
    desc: 'Mở "Tự học" trong tab Người: người được gán kỹ năng sẽ đọc dẫn đúng cập kỹ năng đó thay vì ngẫu nhiên.',
    levels: [
      { cost: { wood: 10, books: 3, cloth: 4 }, workSec: 2 * H, note: 'Cấp 2: đọc nhanh hơn 30%' },
      { cost: { plank: 10, books: 6, cloth: 4 }, workSec: 4 * H, note: 'Cấp 3: đọc nhanh hơn 60%, tự học hiệu quả hơn' },
    ],
  },
  garage: {
    label: 'Chòi xe',
    icon: '⌷',
    color: '#8a8a80',
    placement: 'outdoor',
    minArea: 12,
    maxPerSite: 2,
    workSec: () => 4 * H,
    cost: () => ({ wood: 10, scrap: 20, parts: 1 }),
    desc: 'Xe xuất phát từ điểm có chòi: tốn 0.08 L/km (thay vì 0.1) và thêm 80 kg sức chở.',
    levels: [
      { cost: { wood: 14, scrap: 14, parts: 1 }, workSec: 4 * H, note: 'Cấp 2: 0,07 L/km, +100 kg sức chở' },
      { cost: { plate: 2, gear: 2, parts: 2 }, workSec: 7 * H, note: 'Cấp 3: 0,06 L/km, +140 kg, sửa xe tại chỗ' },
    ],
  },
  generator: {
    label: 'Máy phát điện',
    icon: '⚡',
    color: '#c0a83a',
    placement: 'ground',
    minArea: 2,
    maxPerSite: 1,
    needsWorkshop: true,
    workSec: () => 3 * H,
    cost: () => ({ scrap: 15, parts: 2, wood: 4 }),
    desc: 'Cần Bàn thợ. Nếu đủ xăng: đốt 24 L/đêm để đêm đó làm việc không còn chậm 25%. Ồn: heat +6 mỗi đêm chạy.',
    levels: [
      { cost: { scrap: 16, wood: 6, cloth: 4 }, workSec: 4 * H, note: 'Cấp 2: 20 L/đêm' },
      { cost: { plate: 2, gear: 2, wire: 10 }, workSec: 7 * H, note: 'Cấp 3: 16 L/đêm' },
    ],
  },
  // ---- crafting stations: each one owns a rung of the material ladder ---------
  forge: {
    label: 'Lò rèn',
    icon: '⚒',
    color: '#8a5a3a',
    placement: 'outdoor',
    minArea: 4,
    maxPerSite: 1,
    needsWorkshop: true,
    workSec: () => 3 * H,
    cost: () => ({ wood: 12, scrap: 14, stone: 10 }),
    desc: 'Rèn lưỡi, đầu dụng cụ, đinh, bản lề. Cần than và Bàn thợ trước.',
    levels: [
      { cost: { scrap: 24, wood: 12, stone: 10 }, workSec: 5 * H, note: 'Cấp 2: mở lưỡi thép, tấm thép, sửa vũ khí hỏng' },
      { cost: { plate: 6, gear: 2, brick: 20 }, workSec: 9 * H, note: 'Cấp 3: mở thép tôi, nhanh gấp đôi' },
    ],
  },
  carpentry: {
    label: 'Xưởng mộc',
    icon: '⌗',
    color: '#a0763c',
    placement: 'indoor',
    minArea: 6,
    maxPerSite: 1,
    workSec: () => 2.5 * H,
    cost: () => ({ wood: 18, scrap: 6, tools: 1 }),
    desc: 'Xẻ ván, vót cán, đóng khiên và đồ gỗ. Nhẹ và nhanh hơn lò rèn nhưng không làm được sắt.',
    levels: [
      { cost: { wood: 40, scrap: 10, rope: 6 }, workSec: 5 * H, note: 'Cấp 2: mở cán dài, khiên ghép, tủ khoá' },
      { cost: { plank: 20, hinge: 8, gear: 1 }, workSec: 8 * H, note: 'Cấp 3: mở khung ba lô, xe kéo tay' },
    ],
  },
  kiln: {
    label: 'Lò nung',
    icon: '△',
    color: '#b0603c',
    placement: 'outdoor',
    minArea: 6,
    maxPerSite: 1,
    workSec: () => 3 * H,
    cost: () => ({ stone: 20, clay: 14, wood: 8 }),
    desc: 'Nung than, vôi, gạch. Sinh khói — heat tăng khi chạy.',
    levels: [
      { cost: { stone: 30, clay: 16, wood: 10 }, workSec: 6 * H, note: 'Cấp 2: thêm gạch chịu lửa, nung gốm' },
      { cost: { brick: 40, plate: 2 }, workSec: 10 * H, note: 'Cấp 3: nung cả đêm, sản lượng ×2' },
    ],
  },
  tailor: {
    label: 'Xưởng may',
    icon: '✂',
    color: '#7a6a9a',
    placement: 'indoor',
    minArea: 4,
    maxPerSite: 1,
    workSec: () => 1.5 * H,
    cost: () => ({ wood: 4, cloth: 8, scrap: 2 }),
    desc: 'Kéo chỉ, may giáp vải, ba lô, khiên vải. Băng gạc cũng tốt hơn.',
    levels: [
      { cost: { cloth: 24, wood: 8, scrap: 6 }, workSec: 4 * H, note: 'Cấp 2: mở giáp nhồi, túi đeo, ba lô khung' },
      { cost: { cloth: 40, thread: 30, plate: 1 }, workSec: 7 * H, note: 'Cấp 3: mở giáp tấm, dù may, quần áo chống rét' },
    ],
  },
  smokehouse: {
    label: 'Bếp hun khói',
    icon: '≈',
    color: '#9a6a4a',
    placement: 'outdoor',
    minArea: 4,
    maxPerSite: 1,
    workSec: () => 2 * H,
    cost: () => ({ wood: 10, stone: 6, rope: 2 }),
    desc: 'Hun cá/thịt bằng khói củi. Đồ hun để được hàng chục ngày.',
    levels: [
      { cost: { wood: 16, stone: 12, rope: 4 }, workSec: 4 * H, note: 'Cấp 2: hun nhanh hơn, đỡ tốn củi' },
      { cost: { brick: 24, plate: 1 }, workSec: 6 * H, note: 'Cấp 3: hun cả mẻ lớn mỗi ngày' },
    ],
  },
  coop: {
    label: 'Chuồng gà',
    icon: '⌂',
    color: '#c0a060',
    placement: 'outdoor',
    minArea: 6,
    maxPerSite: 2,
    workSec: () => 3 * H,
    cost: () => ({ wood: 12, cloth: 3, rope: 2 }),
    desc: 'Nuôi gà: mỗi ngày đẻ trứng, thỉnh thoảng có thịt. Cần cho ăn bằng gạo/ngô. Ồn — heat +0.6/ngày.',
    levels: [
      { cost: { wood: 26, rope: 8, cloth: 4 }, workSec: 5 * H, note: 'Cấp 2: nhiều gà hơn, trứng ×1.6' },
      { cost: { plank: 12, hinge: 4, gear: 1 }, workSec: 8 * H, note: 'Cấp 3: chuồng kín, gà không bị mất ban đêm' },
    ],
  },
  pond: {
    label: 'Ao cá',
    icon: '≈',
    color: '#4a7a8a',
    placement: 'outdoor',
    minArea: 12,
    maxPerSite: 2,
    workSec: () => 6 * H,
    cost: () => ({ wood: 8, rope: 4, lime: 4 }),
    desc: 'Ao thả cá: bắt được cá mỗi vài ngày. Cần nước, cá chết nếu ao bẩn quá.',
    levels: [
      { cost: { wood: 18, stone: 10, rope: 6 }, workSec: 6 * H, note: 'Cấp 2: vớt được nhiều hơn' },
      { cost: { lime: 16, brick: 12 }, workSec: 10 * H, note: 'Cấp 3: ao sạch quanh năm, sản lượng ×1.5' },
    ],
  },
  cellar: {
    label: 'Hầm lạnh',
    icon: '▤',
    color: '#5a6a7a',
    placement: 'ground',
    minArea: 6,
    maxPerSite: 1,
    workSec: () => 6 * H,
    cost: () => ({ clay: 18, stone: 12, wood: 8 }),
    desc: 'Hầm đất dưới tầng trệt: mọi thức ăn hỏng chậm hơn một nửa.',
    levels: [
      { cost: { clay: 24, stone: 16, wood: 10 }, workSec: 8 * H, note: 'Cấp 2: hỏng chỉ còn 35% tốc độ thường' },
      { cost: { brick: 30, plate: 2 }, workSec: 12 * H, note: 'Cấp 3: hầm sâu, 25% tốc độ thường' },
    ],
  },
  crock: {
    label: 'Chum ủ',
    icon: '◍',
    color: '#6a8a6a',
    placement: 'indoor',
    minArea: 2,
    maxPerSite: 2,
    workSec: () => 1 * H,
    cost: () => ({ clay: 10, wood: 2, salt: 1 }),
    desc: 'Muối chua rau củ, ủ mắm. Không cần nhiệt, nhưng cần muối.',
    levels: [
      { cost: { clay: 12, wood: 4, salt: 3 }, workSec: 2 * H, note: 'Cấp 2: ủ được thịt cá, thêm chum' },
      { cost: { brick: 16, salt: 6 }, workSec: 3 * H, note: 'Cấp 3: ủ mắm lâu năm, tinh thần cao' },
    ],
  },
  shelter: {
    label: 'Lán trại',
    icon: '⛺',
    color: '#6a7a50',
    placement: 'outdoor',
    minArea: 8,
    workSec: (a) => 1 * H + Math.floor(a / 6) * 0.3 * H,
    cost: (a) => ({ wood: 5 * Math.max(1, Math.floor(a / 6)), cloth: 3 * Math.max(1, Math.floor(a / 6)) }),
    desc: 'Chỗ ngủ ngoài trời cho ruộng/tiền đồn: 1 chỗ / 6 m². Bão xoé 50% số lán mỗi trận.',
    levels: [
      { cost: { wood: 12, rope: 6, cloth: 8 }, workSec: 3 * H, note: 'Cấp 2: chỗ ngủ / 5 m², bão chỉ xoá 32%' },
      { cost: { plank: 12, hinge: 4, rope: 6 }, workSec: 5 * H, note: 'Cấp 3: chỗ ngủ / 4 m², bão chỉ xoá 15%' },
    ],
  },
};

/** Fortification cost scales with the real perimeter of the chosen building. */
export function fortifyCost(level: number, perimeter: number): { workSec: number; cost: Partial<Stock> } {
  return {
    workSec: Math.round(level * perimeter * 240),
    cost: { wood: Math.ceil(level * perimeter * 0.5), scrap: Math.ceil(level * perimeter * 0.2) },
  };
}

export const FORTIFY_DEFENSE_PER_LEVEL = 22;
export const FENCE_DEFENSE_PER_LEVEL = 14;

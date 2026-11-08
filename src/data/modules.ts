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
  | 'shelter';

export type Placement = 'indoor' | 'outdoor' | 'ground' | 'top_or_outdoor' | 'any';

export interface ModuleDef {
  label: string;
  icon: string;
  color: string;
  placement: Placement;
  minArea: number;
  needsWorkshop?: boolean;
  workSec: (area: number) => number;
  cost: (area: number) => Partial<Stock>;
  desc: string;
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
  },
  kitchen: {
    label: 'Bếp củi',
    icon: '♨',
    color: '#c0703a',
    placement: 'any',
    minArea: 6,
    workSec: () => 1.5 * H,
    cost: () => ({ wood: 10, scrap: 6 }),
    desc: 'Nấu gạo/khoai thành bữa ăn, đun sôi nước bẩn (tốn củi). Không có bếp, đồ sống chỉ ăn được một nửa năng lượng.',
  },
  storage: {
    label: 'Kho có khoá',
    icon: '▦',
    color: '#8a7a50',
    placement: 'indoor',
    minArea: 6,
    workSec: () => 2 * H,
    cost: () => ({ wood: 8, scrap: 10 }),
    desc: 'Giảm chuột/ẩm làm hao gạo, giảm vật tư mất khi bị tập kích.',
  },
  workshop: {
    label: 'Bàn thợ',
    icon: '⚒',
    color: '#9a8a7a',
    placement: 'indoor',
    minArea: 8,
    workSec: () => 3 * H,
    cost: () => ({ wood: 20, scrap: 15, tools: 1 }),
    desc: 'Cổng công nghệ: cần để làm bộ lọc nước, giếng, tháp canh, gia cố cấp 2+.',
  },
  infirmary: {
    label: 'Phòng y tế',
    icon: '✚',
    color: '#4fa77a',
    placement: 'indoor',
    minArea: 8,
    workSec: () => 2.5 * H,
    cost: () => ({ wood: 10, cloth: 10 }),
    desc: 'Người bệnh/bị thương hồi nhanh hơn. Dùng để cách ly người bị cắn.',
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
  },
  filter: {
    label: 'Trạm lọc nước',
    icon: '⧖',
    color: '#5aa0d0',
    placement: 'ground',
    minArea: 4,
    needsWorkshop: true,
    workSec: () => 2 * H,
    cost: () => ({ scrap: 8, cloth: 6, wood: 4 }),
    desc: 'Lọc nước bẩn → sạch 12 L/giờ, không tốn củi.',
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
  },
  well: {
    label: 'Giếng khoan tay',
    icon: '◎',
    color: '#2f6fa0',
    placement: 'outdoor',
    minArea: 4,
    needsWorkshop: true,
    workSec: () => 8 * H,
    cost: () => ({ scrap: 12, wood: 10, tools: 1 }),
    desc: 'Nguồn nước bẩn ổn định ~1500 L/ngày. Phải cách nhà vệ sinh tối thiểu 10 m.',
  },
  watchtower: {
    label: 'Tháp canh',
    icon: '⌂',
    color: '#a05a5a',
    placement: 'top_or_outdoor',
    minArea: 4,
    needsWorkshop: true,
    workSec: () => 4 * H,
    cost: () => ({ wood: 25, scrap: 10 }),
    desc: '+12 phòng thủ và phát hiện tập kích sớm.',
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
  },
  bookshelf: {
    label: 'Kệ sách',
    icon: '▤',
    color: '#b09060',
    placement: 'indoor',
    minArea: 4,
    workSec: () => 1 * H,
    cost: () => ({ wood: 4, cloth: 2 }),
    desc: 'Mở "Tự học" trong tab Người: người được gán kỹ năng sẽ đọc dẫn đúng cập kỹ năng đó thay vì ngẫu nhiên.',
  },
  garage: {
    label: 'Chòi xe',
    icon: '⌷',
    color: '#8a8a80',
    placement: 'outdoor',
    minArea: 12,
    workSec: () => 4 * H,
    cost: () => ({ wood: 10, scrap: 20, parts: 1 }),
    desc: 'Xe xuất phát từ điểm có chòi: tốn 0.08 L/km (thay vì 0.1) và thêm 80 kg sức chở.',
  },
  generator: {
    label: 'Máy phát điện',
    icon: '⚡',
    color: '#c0a83a',
    placement: 'ground',
    minArea: 2,
    needsWorkshop: true,
    workSec: () => 3 * H,
    cost: () => ({ scrap: 15, parts: 2, wood: 4 }),
    desc: 'Cần Bàn thợ. Nếu đủ xăng: đốt 24 L/đêm để đêm đó làm việc không còn chậm 25%. Ồn: heat +6 mỗi đêm chạy.',
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

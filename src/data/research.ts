/**
 * Nghiên cứu — "biết làm" khác với "xây to hơn".
 *
 * Module nâng cấp là **năng lực của căn cứ**: bỏ vật tư, trạm lên cấp 2-3, cùng một
 * thứ nhưng to/nhanh hơn. Nghiên cứu là **kiến thức của nhóm người**: tốn ngày công
 * của một người biết đọc + sách nhặt được, và mở ra thứ mà không lượng vật tư nào
 * mua được. Vì vậy hai hệ không thay thế nhau:
 *
 * - Có 200 tấm thép nhưng chưa ai đọc về luyện kim → vẫn không rèn được tấm giáp.
 * - Có kệ sách nhưng không có sách → không nghiên cứu được gì (phải đi lục).
 * - Mỗi nhánh tốn người và ngày, nên **không thể có hết** trong một ván: phải chọn.
 */
export type TechBranch = 'farm' | 'med' | 'eng';

export interface TechDef {
  id: string;
  label: string;
  branch: TechBranch;
  /** Ngày công của một người có kỹ năng Chế tạo trung bình. */
  days: number;
  /** Sách tiêu tốn khi bắt đầu (nhặt trong nhà, không chế được). */
  books: number;
  req?: string;
  desc: string;
  /** Công thức mở khoá. */
  unlocks: string[];
  /** Hiệu ứng thụ động, ghi để UI hiển thị; mã xử lý ở sim/research.ts. */
  passive?: { kind: 'yield' | 'rot' | 'infection' | 'sepsis'; label: string };
}

export const TECH_BRANCH_LABEL: Record<TechBranch, string> = {
  farm: 'Nông nghiệp',
  med: 'Y tế',
  eng: 'Kỹ thuật',
};

export const TECHS: TechDef[] = [
  {
    id: 't_mill',
    label: 'Xay xát',
    branch: 'farm',
    days: 4,
    books: 2,
    desc: 'Xay hạt thành bột, ép hạt thành dầu — hai thứ trước đây chỉ nhặt được.',
    unlocks: ['r_bot', 'r_dau_an'],
  },
  {
    id: 't_preserve',
    label: 'Bảo quản',
    branch: 'farm',
    days: 5,
    books: 3,
    req: 't_mill',
    desc: 'Hun khói và phơi khô đúng cách: thịt cá để được hàng tháng thay vì vài ngày.',
    unlocks: ['rd_thit_phoi', 'rd_ca_phoi', 'rd_thit_hun', 'rd_sua_len_men'],
    passive: { kind: 'rot', label: 'Đồ ăn trong kho ôi chậm 30%' },
  },
  {
    id: 't_breed',
    label: 'Chọn giống',
    branch: 'farm',
    days: 7,
    books: 4,
    req: 't_mill',
    desc: 'Giữ giống tốt, ghép đôi đúng lứa: năng suất vườn và sức sinh sản của bầy tăng.',
    unlocks: [],
    passive: { kind: 'yield', label: 'Sản lượng vườn +12%, bầy hao hụt −30%' },
  },
  {
    id: 't_firstaid',
    label: 'Sơ cứu',
    branch: 'med',
    days: 3,
    books: 2,
    desc: 'Rửa vết thương, khâu, băng đúng cách — giảm mạnh nguy cơ nhiễm trùng.',
    unlocks: ['r_mask-m40', 'r_mask-cm-3', 'r_mask-pmk-3'],
    passive: { kind: 'infection', label: 'Vết thương nhiễm trùng −30%' },
  },
  {
    id: 't_pharma',
    label: 'Bào chế',
    branch: 'med',
    days: 6,
    books: 4,
    req: 't_firstaid',
    desc: 'Lên men sữa và làm phô mai: giữ được đạm từ sữa mà không cần lạnh.',
    unlocks: ['r_pho_mai', 'rd_pho_mai_nuong', 'rd_banh_pho_mai'],
  },
  {
    id: 't_surgery',
    label: 'Ngoại khoa',
    branch: 'med',
    days: 9,
    books: 5,
    req: 't_pharma',
    desc: 'Mổ, cắt lọc, truyền dịch. Cứu được người đã nhiễm trùng nặng mà trước đây phải bỏ.',
    unlocks: [],
    passive: { kind: 'sepsis', label: 'Cửa sổ cứu nhiễm trùng +50%' },
  },
  {
    id: 't_metalwork',
    label: 'Luyện kim',
    branch: 'eng',
    days: 5,
    books: 3,
    desc: 'Nấu và cán thép, rèn lưỡi rìu nặng — mở phần nặng của xưởng.',
    unlocks: ['r_wpn-axe'],
  },
  {
    id: 't_smith',
    label: 'Rèn vũ khí nặng',
    branch: 'eng',
    days: 6,
    books: 4,
    req: 't_metalwork',
    desc: 'Rèn lưỡi dài: chặt được Brute thay vì chỉ đẩy lùi.',
    unlocks: ['r_wpn-sword', 'r_wpn-berdysh', 'r_wpn-kukri'],
  },
  {
    id: 't_electric',
    label: 'Điện',
    branch: 'eng',
    days: 8,
    books: 5,
    req: 't_metalwork',
    desc: 'Quấn dây, ghép pin, hàn tấm mặt trời — có điện thì đèn, tủ lạnh và bơm mới chạy.',
    unlocks: ['r_battery', 'r_solar_panel'],
  },
  {
    id: 't_armour',
    label: 'Giáp tấm',
    branch: 'eng',
    days: 9,
    books: 6,
    req: 't_smith',
    desc: 'Cắt uốn tấm giáp theo thân người và may áo chịu lực.',
    unlocks: [
      'r_plate-ppi-mtv',
      'r_plate-crye-avs',
      'r_plate-6b45-ratnik',
      'r_plate-hrm-tactical',
      'r_vest-alice',
      'r_vest-bvd-84',
      'r_vest-ana-alpha',
      'r_vest-sso-smersh',
    ],
  },
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

/** Công thức nào bị khoá sau nghiên cứu (để test và UI tra ngược). */
export const TECH_FOR_RECIPE: Record<string, string> = Object.fromEntries(
  TECHS.flatMap((t) => t.unlocks.map((r) => [r, t.id] as const)),
);

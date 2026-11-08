# Design — Vá mạch chết + 4 module building (Approach B)

Ngày: 2026-11-08 · Trạng thái: chốt (user chọn B, tự làm hết, báo cáo từng cụm)

## Vì sao

Balance server: baseline bot 3 seed chết ngày **84 / 85 / 92 — đều chết đói**. Nhân lực game
hoạt động nhưng kinh tế tiến về cuối game không có npc mới. Đồng thời code có **mạch chết**
(xác minh bằng grep):

| Mạch chết | Bằng chứng |
|---|---|
| `parts` (phụ tùng) chỉ looted, không bao giờ bị tiêu | `categories.ts` chỉ liệt kê loot; không dòng `take(… 'parts')` tiêu |
| Skill `crafting` không có vai trò nào tiêu vào sản xuất | `tasks.ts`: crafting chỉ +XP phụ ở lọc/đun nước |
| Sách cho XP **ngẫu nhiên**, người chơi không kiểm soát; đọc không tiêu sách | `tasks.ts:155-160, 377` |
| Xăng chỉ tiêu cho xe; đi đêm chậm 25% không có cách khắc phục | `expedition.ts`, `tasks.ts:17` |

## Phạm vi

**Làm:** 4 module mới, mỗi module lấp đúng 1 mạch chết, không thêm cơ chế mới ngoài "điện đêm".

**Không làm (anti-goals):** cây nâng cấp module (lvl 1→3), hệ thống sản xuất dây chuyền,
điện toàn màn hình (chỉ dùng cho đi đêm), vật phẩm mới ngoài nhánh y tế sản xuất được,
UI tab mới. Bot vẫn tự phân việc như cũ, chỉ thêm vài quy tắc ưu tiên.

## 4 module (`src/data/modules.ts`)

| ModuleId | Tên | Vị trí | MinArea | Chi phí | Công | Tác dụng |
|---|---|---|---|---|---|---|
| `herb_garden` | Vườn thuốc | top_or_outdoor | 4 m² | gỗ ⌈a/10⌉, vải ⌈a/20⌉ | 1h + 20s/m² | Trồng chu kỳ 40 ngày: thu `a/12` liều thuốc + `a/6` băng gạc (yield tròn hoá, tái dùng máy `plot` của vườn). Farmer chăm như vườn thường |
| `generator` | Máy phát điện | ground (sân) | 2 m² | 15 sắt, 2 phụ tùng, 4 gỗ | 3h | Cần Bàn thợ. Nếu còn xăng: đốt **24 L/đêm** (2 L/h × 12 h đêm) → đêm hôm đó **không còn ×0.75**, heat cộng **+6**/đêm |
| `garage` | Chòi xe | outdoor (sân) | 12 m² | 10 gỗ, 20 sắt, 1 phụ tùng | 4h | Viễn chinh **xe xuất phát từ điểm có chòi**: fuel 0.1 → **0.08 L/km**, sức chở +80 kg (250→330) |
| `bookshelf` | Kệ sách | indoor | 4 m² | 4 gỗ, 2 vải | 1h | Mở "Tự học" trong tab Người: gán `study` cho từng người → đọc sách cho XP vào đúng skill đó (mặc định không gán = giữ random như cũ) |

Không cần vai trò mới: farmer chăm cả vườn thường và vườn thuốc; `generator`
chạy tự động theo đêm; `garage` chỉ là thành điểm xuất phát.

## Phần còn lại cho builder

- `BaseStats` thêm `herbPlots: number`, `generator/garage/bookshelf: boolean`; `icons.tsx` cần
  4 mapping tạm từ bộ innawoods để typecheck qua (Record<ModuleId, string>).
- Tending vườn thuốc tách `tendedToday` per-room (đã có sẵn machine cho `garden`).
- Người chết vì thuốc thiếu… không đổi. `study: SkillId | null` thêm vào Survivor + `migrate()` mặc định null.
- Balance: chạy `npx vite-node scripts/sim.ts -- 120 1/2/3` trước/sau; **không** cố kéo sống
  thêm bao nhiêu ngày — chết đói là vấn đề khác (đã ghi nhận), ở đây chỉ đảm bảo không làm kinh tế
  suy sụp nhanh hơn và mạch mới được dùng trong mô phỏng.

## Đồ họa/player-facing

Bộ icon tactical (bài toán đang treo) sẽ phủ 4 module này ở giai đoạn icon; giai đoạn này icon
chỉ cần tồn tại để không lỗi build.

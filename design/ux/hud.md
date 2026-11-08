# HUD Design

> **Status**: Draft for review
> **Author**: user + Cindy (UX pass — chạy không có `.claude/agents`)
> **Last Updated**: 2026-11-08
> **Platform Targets**: Web. Chuột + bàn phím + cảm ứng (responsive; mobile 390 px, desktop ≥1280 px)
> **Template**: HUD Design
>
> **Ghi chú môi trường**: chạy ở chế độ "không studio" (phương án B). Không có
> `project.yaml`, `.claude/{agents,docs,hooks,scripts,skills}`, `design/gdd/*`,
> player journey, art bible, pattern library, `design/accessibility-requirements.md`.
> Yêu cầu UI của các hệ được gom từ `docs/GAMEPLAY.md` §1–§18 và đối chiếu với các
> trường thật trong `src/sim/types.ts` (`GameState`, `Site`, `Weather`, `Survivor`).
> Spec liên quan: `design/ux/base.md` (dải trạng thái Z1 của màn Căn cứ chính là HUD
> này, nên hai file phải khớp nhau).
> Giá trị do người dùng chốt: collaborative · standard · balanced.
> Các mục B2 (phân loại) trở đi là **đề xuất của tôi**, chờ review.

---

## HUD Philosophy

**Đề xuất:** *Adaptive theo tốc độ thời gian.*

> HUD dày khi người chơi đang **lập kế hoạch** (thời gian dừng), và mỏng đi khi
> người chơi đang **xem** (thời gian chạy). Người chơi không bao giờ phải đọc để
> phát hiện mình sắp chết; chỉ phải đọc khi họ đã quyết định can thiệp.

Lý do chọn triết lý này thay vì ba lựa chọn kia:

| Triết lý | Vì sao không hợp |
|---|---|
| Gần như không HUD | Game này thắng/thua bằng số ẩn (ngày lương, độ ồn, giường) — không có tín hiệu diegetic nào thay được |
| Tối giản cố định | Người chơi cần 35 tín hiệu khi lập kế hoạch; ẩn hết thì phải mở menu liên tục |
| Dày đặc cố định | Đây chính là bản hiện tại: 50 nút, 3.004 ký tự, không phân biệt trạng thái nào |

**Ràng buộc rút ra:** mọi quyết định dưới đây phải trả lời được câu
"tín hiệu này hiện ở tốc độ nào?" Nếu một tín hiệu muốn hiện ở mọi tốc độ, nó phải
nằm trong danh sách Must Show, và danh sách đó bị giới hạn cứng (Section F).

---

## Information Architecture

### Full Information Inventory

35 tín hiệu, gom từ mọi hệ. Cột "Nguồn" là trường thật trong code.

| # | Tín hiệu | Nguồn | Hệ |
|---|---|---|---|
| 1 | Ngày + giờ trong ngày | `GameState.t` | §3 thời gian |
| 2 | Thời tiết: nhãn, °C, mm mưa | `GameState.weather` | §3 |
| 3 | Bão đang xảy ra | `weather.storm` | §3 |
| 4 | Bầy zombie đang đi qua | `hordeUntilDay` | §7 |
| 5 | Số người còn sống | `survivors[].status` | §4 |
| 6 | Số người đang ở điểm này | `present(site)` | §4 |
| 7 | Giường so với số người | `baseStats.beds` | §9 |
| 8 | Tinh thần trung bình | `Survivor.morale` | §4.4 |
| 9 | Số người đang bệnh | `sickDays > 0` | §6.4 |
| 10 | Số người đang chảy máu | `bleed > 0` | §13 |
| 11 | Số người bị nhiễm + % cao nhất | `infected`, `infection` | §13 |
| 12 | Số người đang đi viễn chinh | `location === 'expedition'` | §8 |
| 13 | Người bị cắn chưa xử lý | `biteKnown` | §10 |
| 14 | Độ ồn của điểm | `site.heat` | §7.3 |
| 15 | Độ bẩn của điểm | `site.filth` | §6.4 |
| 16 | Xác chưa xử lý | `site.corpses` | §6.4 |
| 17 | Gia cố: cấp + HP | `site.fortify` | §9.2 |
| 18 | Rào: cấp + HP | `site.fence` | §9.2 |
| 19 | Phòng thủ tĩnh | `baseStats.defenseStatic` | §7.4 |
| 20 | Điện: kW đang chạy / tổng | `site.powerOn` | §15 |
| 21 | Ắc quy còn bao nhiêu kWh | `site.batteryKwh` | §15.1 |
| 22 | Sưởi đang chạy | `site.warmthActive` | §16 |
| 23 | Lương thực còn bao nhiêu ngày | `stock` / nhu cầu | §6.1 |
| 24 | Nước uống còn bao nhiêu ngày | `stock` / nhu cầu | §6.2 |
| 25 | Nước bẩn / sức chứa bể | `stock.dirtyWater` | §6.2 |
| 26 | Hàng đợi xây: số mục, mục chưa trả vật tư | `site.projects` | §9.2 |
| 27 | Tồn kho chi tiết (700+ món) | `site.stock` | §12.1 |
| 28 | Số đội đang ngoài + pha | `expeditions` | §8 |
| 29 | Khẩu phần còn lại của từng đội | `expedition.rations` | §12.11 |
| 30 | Nguy hiểm + độ sạch ô hiện tại | `cellHeat`, `cellClear` | §7.1, §8.4 |
| 31 | Số trận tập kích thắng/thua | `stats.raidsRepelled/Lost` | §7.4 |
| 32 | Cảnh báo mức `bad` / `warn` | `alerts`, `log` | log |
| 33 | Nhật ký sự kiện | `log` | — |
| 34 | 6 luật đang bật | `laws` | §10 |
| 35 | Tín hiệu cầu cứu x/7 đêm | `rescueDays` | §17 (**đang tắt**) |

### Categorization

**Đề xuất phân loại.** Cột "Khi chạy nhanh" là hành vi riêng của game này: ở 60–240×
HUD phải co lại, vì người chơi đang xem chứ không đang đọc.

| Nhóm | Tín hiệu | Khi chạy nhanh (≥60×) |
|---|---|---|
| **Must Show** (luôn hiện) | 23 lương thực ngày · 24 nước ngày · 5+6 người sống/ở đây · 19 phòng thủ · 1 ngày+giờ | giữ nguyên (đây là 5 ô, đã là giới hạn cứng) |
| **Contextual** (hiện khi có điều kiện) | 32 cảnh báo · 2 thời tiết · 3 bão · 4 bầy · 10 chảy máu · 11 nhiễm · 9 bệnh · 20 mất điện · 22 sưởi · 26 hàng đợi kẹt · 29 khẩu phần sắp hết | giữ, nhưng gộp thành **1 dòng cảnh báo** thay vì nhiều chip |
| **On Demand** (chỉ khi dừng / mở) | 7 giường · 8 tinh thần · 12 người đang đi · 14 ồn · 15 bẩn · 16 xác · 17 gia cố · 18 rào · 21 kWh · 25 nước bẩn · 27 kho · 28 số đội · 30 nguy hiểm ô · 31 thống kê trận · 34 luật | ẩn hẳn |
| **Hidden** (không bao giờ trên HUD) | 13 bị cắn chưa xử lý → thuộc tab Người · 33 nhật ký → panel riêng · 35 cầu cứu → cờ đang tắt | ẩn |

**Kiểm tra xung đột** (skill yêu cầu): triết lý "mỏng khi chạy" và danh sách Must Show
5 ô là nhất quán. Con số 5 là **giới hạn cứng**, không phải điểm khởi đầu — muốn thêm
ô thứ 6 phải bỏ một ô hiện có.

**Cross-check với `base.md`**: dải Z1 ở `base.md` từng ghi 6 ô (thêm giường, tinh thần,
điện). Spec HUD này giới hạn cứng 5 ô, nên `base.md` đã được sửa cho khớp: giường,
tinh thần và điện chuyển thành On Demand (bấm ô để xem), không còn là ô thường trực.

**Ba chỗ tôi muốn bạn soi lại khi review:**

1. **Tinh thần (8) bị đẩy xuống On Demand.** Nó ảnh hưởng trực tiếp đến bỏ trốn (dưới
   15) và tốc độ làm việc (dưới 25), nhưng không giết người trong đêm. Nếu bạn thấy
   nó quan trọng hơn phòng thủ, đổi chỗ 8 ↔ 19.
2. **Chảy máu/nhiễm (10, 11) là Contextual chứ không phải Must Show.** Người chảy máu
   mất 1,2 HP/giờ mỗi bậc — chết trong khoảng một ngày, không phải một giờ. Nếu bạn
   muốn nó luôn hiện, phải bỏ ô phòng thủ.
3. **Bị cắn chưa xử lý (13) bị ẩn khỏi HUD.** Đây là thông tin quyết định sống/chết
   (65% nhiễm, 3,5 ngày thành zombie). Tôi ẩn vì nó chỉ hiện khi đã có sự kiện; nếu
   bạn muốn nó thành cảnh báo đỏ trên HUD thì nó thuộc Contextual, không phải Hidden.

---

## Layout Zones

Ba cách xếp, dựa trên phân loại ở trên:

| Cách | Bố cục | Ưu | Nhược | Chọn |
|---|---|---|---|---|
| **A. Dải ngang trên cùng** | 5 ô Must Show + cảnh báo bên dưới | không chiếm chỗ canvas; mắt quét từ trên xuống | trên mobile chiếm 2 hàng ~96 px | **Có** |
| **B. Dải dọc bên trái** | cột 5 ô dọc mép trái | không chiếm chiều cao | cạnh tranh chỗ với canvas ở màn hẹp; đọc số dọc chậm | Không |
| **C. Góc trên + góc dưới** | Must Show góc trên trái, cảnh báo góc dưới trái | canvas tự do tối đa | mắt phải nhảy hai nơi; cảnh báo dễ bị bỏ qua | Không |

**Chọn A.** Zone chi tiết:

| Zone | Nội dung | Kích thước mục tiêu |
|---|---|---|
| **H1 Dải Must Show** | 5 ô: lương · nước · người · phòng thủ · ngày/giờ | cao 44 px (mobile) / 36 px (desktop) |
| **H2 Dòng cảnh báo** | 1 dòng, tối đa 1 câu + số đếm; mở rộng khi bấm | chỉ hiện khi có cảnh báo |
| **H3 Thanh thời gian** | tốc độ + thời tiết + lưu | gộp vào H1 trên desktop |
| **H4 Khu thông báo** | toast sự kiện (dưới H2, trên cùng bên phải) | tối đa 1 toast cùng lúc |

Trên desktop, H1 gộp chung một hàng với H3 (như wireframe trong `base.md`). Trên
mobile, H3 xuống hàng thứ hai — vẫn trong ngân sách ≤96 px.

---

## HUD Element Specifications

| # | Element | Nhóm | Nội dung | Dạng | Cập nhật | Ngưỡng / hành vi |
|---|---|---|---|---|---|---|
| E1 | Lương thực | Must | `X,X ngày` | số + bar mảnh | mỗi tick | <3 ngày: đỏ + nháy 1 lần/ngày; <6: hổ phách |
| E2 | Nước uống | Must | `X,X ngày` | số + bar | mỗi tick | <2 ngày: đỏ; <4: hổ phách |
| E3 | Người | Must | `sống / ở đây` | số + số | khi đổi | thiếu giường: hổ phách |
| E4 | Phòng thủ | Must | số nguyên | số | khi đổi | `0` khi đêm có tập kích: đỏ |
| E5 | Ngày giờ | Must | `Ngày N · HH:MM` | text | mỗi tick | — |
| E6 | Cảnh báo | Contextual | `⚠ <câu>` + `+N` | dòng chữ | khi có sự kiện | bấm → nhảy tới chỗ sửa (R1 trong `base.md`) |
| E7 | Thời tiết | Contextual | `Bão` / `12mm` / `6°C` | chip | mỗi ngày | bão: đỏ; rét <18°C và không sưởi: hổ phách |
| E8 | Bầy | Contextual | `Bầy 2 ngày` | chip | theo `hordeUntilDay` | đỏ, không nháy |
| E9 | Y tế | Contextual | `2 chảy máu · 1 nhiễm` | chip | khi đổi | chảy máu: đỏ; nhiễm: đỏ đậm |
| E10 | Điện | Contextual | `1,8/4,8 kW` | chip | mỗi tối | thiếu tải: hổ phách |
| E11 | Hàng đợi kẹt | Contextual | `1 mục chờ vật tư` | chip | khi đổi | hổ phách |

Cả 11 element dùng chung pattern `status-cell` / `alert-row` đã khai báo trong
`design/ux/base.md` (Component Inventory) — không tạo pattern mới.

---

## HUD States by Gameplay Context

Game này không có đối thoại/cutscene. Trạng thái tương đương là **lớp phủ đang mở**
(bottom sheet, picker, title). Vẫn phải định nghĩa đủ 4, theo yêu cầu của skill:

| State | Kích hoạt | HUD thay đổi thế nào |
|---|---|---|
| **Exploration / planning** (0×) | người chơi dừng thời gian | đầy đủ H1 + H2; On Demand mở được bằng cách bấm ô |
| **Running** (1×–240×) | thời gian chạy | H1 giữ 5 ô; H2 gộp mọi cảnh báo thành 1 dòng; On Demand ẩn hẳn |
| **Combat** (tập kích đêm) | `raidEvent` | E4 phòng thủ nhấp nháy 1 lần rồi đứng yên; E6 luôn hiện; các chip khác mờ 60% |
| **Dialogue / cutscene tương đương** | bottom sheet / picker / title mở | HUD ẩn hoàn toàn (sheet che 70%, picker là màn riêng) |
| **Paused (menu)** | người chơi mở tab khác | H1 vẫn hiện; H2 ẩn (đang ở màn khác) |
| Low resource | ăn <3 hoặc uống <2 ngày | E1/E2 đỏ + bar; nháy **1 lần** khi vừa vượt ngưỡng, không lặp |
| Empty / no data | điểm không có người | E3 hiện `0 / 0`; E1/E2 hiện `—` (không chia cho 0) |
| Storm | `weather.storm` | E7 đỏ; E6 thêm dòng "không ra ngoài được" |
| No power | `powerOn` rỗng | E10 hiện `0/tổng` màu hổ phách |
| Game over | `gameOver` | H1 đóng băng ở giá trị cuối; H2 đổi thành "KẾT THÚC · N ngày" |
| Mobile | <720 px | H1 còn 5 ô thu nhỏ (chữ 11 px, cao 44 px); H2 một dòng, bấm mở rộng |
| Desktop | ≥1280 px | H1 + H3 chung một hàng; không đổi nội dung |

---

## Information Hierarchy

| Tier | Element | Vì sao | Khi bị ẩn, cái gì gánh thông tin |
|---|---|---|---|
| **MUST KEEP** | E1 lương, E2 nước, E3 người, E4 phòng thủ, E5 ngày giờ | thiếu chúng là chết mà không biết vì sao | không ẩn — đây là lý do tồn tại của HUD |
| **SHOULD KEEP** | E6 cảnh báo, E9 y tế | quyết định nước đi tiếp theo | nhật ký; cảnh báo `bad` vẫn tự dừng thời gian |
| **CAN HIDE** | E7 thời tiết, E8 bầy, E10 điện, E11 hàng đợi | quan trọng nhưng theo mùa/tình huống | log + panel tương ứng khi mở |
| **ALWAYS HIDE** | tinh thần, giường, ồn/bẩn/xác, kho, luật, thống kê | tra cứu, không phải phản xạ | bấm ô tương ứng mở sheet; tab chuyên biệt |

---

## Visual Budget

| Giới hạn | Giá trị | Cách đo |
|---|---|---|
| Số element đồng thời | **tối đa 7** (5 Must Show + H2 + 1 toast) | đếm node trong H1/H2/H4 |
| Phần trăm màn hình | **≤12%** ở desktop, **≤18%** ở mobile | chiều cao H1+H2+H4 ÷ chiều cao viewport |
| Chiều cao tuyệt đối | **≤96 px** mobile, **≤72 px** desktop | `getBoundingClientRect` |
| Ký tự trong H1 | **≤40** ký tự tổng | đếm `innerText` |

**Thứ tự cắt khi vượt ngân sách** (dùng đúng thứ tự tier):
1. Toast cũ (H4) — huỷ trước
2. E11 hàng đợi → E10 điện → E8 bầy → E7 thời tiết
3. E6 cảnh báo gộp còn 1 câu ngắn nhất
4. Không bao giờ cắt 5 ô Must Show; nếu vẫn vượt thì giảm cỡ chữ, không bỏ ô

---

## Feedback & Notification Systems

| Loại | Hệ phát | Vị trí | Thời lượng | Tối đa | Ưu tiên | Hàng đợi |
|---|---|---|---|---|---|---|
| Cảnh báo `bad` (chết, bị cắn, tập kích) | `alerts` | H2 + toast H4 | 6 giây (hiện tại) | 1 | 1 (cao nhất) | **chen ngay**, đẩy toast cũ ra; việc cũ vẫn nằm trong log |
| Cảnh báo `warn` (thiếu vật tư, mùa đông) | `alerts` | H2 | 6 giây | 1 | 2 | hàng đợi 1, hiện sau `bad` |
| Tin tốt (`good`: xong công trình, lên cấp) | `log` | chỉ log | — | — | 3 | **không toast** (đã có log), tránh làm phiền |
| Tổng kết ngày | `log` | log + H2 lúc 06:00 | đến khi người chơi bấm | 1 | 2 | thay dòng H2 hiện tại |
| Thông tin thường (`info`) | `log` | chỉ log | — | — | 4 | không bao giờ toast |

Quy tắc chung: **một toast cùng lúc**, và toast `bad` không bao giờ bị thay bởi `good`.

---

## Platform Adaptation

| Yếu tố | Desktop | Mobile |
|---|---|---|
| Số ô H1 | 5 ô, mỗi ô ≥120 px rộng | 5 ô, mỗi ô ≥70 px, chữ 11 px |
| Vùng chạm | ≥32 px | **≥44 px** (hiện tại 38/38 nút dưới 44 px — phải sửa) |
| H3 thanh thời gian | gộp cùng hàng H1 | xuống hàng riêng, vẫn trong 96 px |
| Safe area | không | phải cộng `env(safe-area-inset-top)` — hiện chưa xử lý |
| Toast | góc trên phải | giữa trên, cách mép 12 px + safe area |
| On Demand | bấm ô mở popover | bấm ô mở bottom sheet toàn rộng |

---

## Accessibility

Chưa có `design/accessibility-requirements.md` → tier chưa định nghĩa; đề xuất
**WCAG 2.2 AA**. Số đo thật:

| Kiểm tra | Kết quả hiện tại | Yêu cầu cho HUD |
|---|---|---|
| Tương phản chữ chính | 16,41:1 ✅ | giữ |
| Tương phản chữ phụ `--dim` | 6,08:1 ✅ | giữ |
| **Nhãn mờ `--faint`** | **2,85:1 ❌** | **không dùng cho số liệu HUD**; chỉ dùng cho nội dung không cần đọc |
| Đỏ cảnh báo | 5,30:1 ✅ | được dùng làm màu chữ |
| Màu không phải kênh duy nhất | — | mỗi ô phải có **nhãn chữ** (`ĂN`, `NƯỚC`) + **số**, màu chỉ là phụ |
| Vùng chạm | 38/38 nút <44 px ❌ | ô H1 bấm được phải ≥44×44 |
| Giảm chuyển động | chưa xử lý ❌ | `prefers-reduced-motion` → bỏ mọi nháy, chỉ đổi màu |
| Nháy | — | **không nháy quá 1 lần** khi vượt ngưỡng (tránh tiền sử động kinh) |
| Screen reader | — | H1 là `aria-live="polite"`, chỉ đọc khi giá trị đổi, gộp 1 câu |

---

## Tuning Knobs

| Thiết lập | Giá trị | Mặc định | Ghi chú |
|---|---|---|---|
| Mật độ HUD | Gọn / Đầy đủ / Tắt | Đầy đủ | "Gọn" chỉ giữ 3 ô: lương, nước, người |
| Cỡ HUD | 80% / 100% / 120% | 100% | scale toàn bộ H1+H2 |
| Hiện số hay chỉ thanh | Số + thanh / Chỉ thanh | Số + thanh | "Chỉ thanh" cho người thích không khí |
| Nháy khi nguy hiểm | Bật / Tắt | Bật | tắt = chỉ đổi màu |
| Nội dung toast | Tất cả / Chỉ `bad` / Không | Tất cả | lưu vào `localStorage` |

Năm thiết lập này đều là UI thuần, không đụng `GameState` — nên không ảnh hưởng save.

---

## Measured After Implementation (2026-11-08)

Đợt 1 + 2 đã làm; số đo lại trên app thật:

| Tiêu chí | Mục tiêu | Trước | Sau |
|---|---|---|---|
| Ô trong H1 | 5 | 6 nhóm văn xuôi | **5 ô số** |
| Ký tự trong H1 | ≤40 (số liệu) | 291 | **61** (gồm cả 5 nhãn) |
| Node chữ trong H1 | ≤7 element | 30 | **10** (5 nhãn + 5 số) |
| Chiều cao H1 (mobile) | ≤96 px | 96 px | **56 px** |
| H1+H2 phần trăm màn (mobile) | ≤18% | — | **14,1%** (119/844) |
| Có danh sách "Cần quyết định" | có | ❌ | **✅ tối đa 3 dòng** |
| Bấm cảnh báo → nhảy tới chỗ sửa (R1) | có | ❌ | **✅ kiểm bằng click chuột thật** |
| Nút điều khiển (desktop) | ≤25 | 50 | **24** (13 HUD + 6 segmented + 5 công cụ) ✅ |
| Vùng chạm mobile <44 px | 0 | 38/38 | **0/55** ✅ |

Tổng số nút trên màn: 41 khi nghỉ, 55 khi chọn phòng — nhưng chỉ **24 là nút điều
khiển**; phần còn lại là nội dung của đúng ngăn đang mở (danh sách module, món ăn,
công thức). Mục tiêu "≤25 tổng" ban đầu là không khả thi cho một màn xây dựng và đã
được thay bằng "≤25 nút điều khiển" cộng với ràng buộc "một ngăn mở tại một thời điểm".

---

## Acceptance Criteria

- [ ] H1 chiếm **≤96 px** chiều cao ở 390×844 và **≤72 px** ở 1280×800, đo bằng
      `getBoundingClientRect`.
- [ ] H1+H2+H4 chiếm **≤18%** diện tích màn mobile và **≤12%** desktop.
- [ ] Ở 0× (dừng), bấm ô bất kỳ trong H1 mở đúng panel tương ứng.
- [ ] Ở 60× trở lên, các mục On Demand **không** hiển thị.
- [ ] Khi có tập kích đêm, E4 đổi màu và **không nháy quá 1 lần**.
- [ ] Khi ăn <3 ngày, E1 đỏ; khi ăn ≥3 ngày, E1 trở lại màu thường trong ≤1 tick.
- [ ] Chỉ **một toast** tồn tại cùng lúc; toast `bad` không bị thay bởi `good`.
- [ ] Mỗi ô H1 có nhãn chữ và số — trạng thái **không** chỉ truyền đạt bằng màu.
- [ ] Ở 390 px, mọi ô bấm được trong H1 có vùng chạm **≥44×44 px**.
- [ ] Bật `prefers-reduced-motion: reduce` thì không còn animation nháy nào.
- [ ] Điểm có 0 người: E1/E2 hiện `—`, không hiện `NaN` hay `Infinity`.

---

## Open Questions

1. **Accessibility tier chưa định nghĩa** — đề xuất WCAG 2.2 AA.
2. **`--faint` 2,85:1** — cần quyết: nâng màu hay cấm dùng trong HUD.
3. **Ba chỗ phân loại tôi muốn bạn soi** (đã nêu ở Section B): tinh thần có nên lên
   Must Show; chảy máu/nhiễm có nên luôn hiện; "bị cắn chưa xử lý" có nên thành cảnh
   báo đỏ thay vì ẩn.
4. **Player journey map chưa có** — triết lý "dày khi dừng, mỏng khi chạy" là suy ra
   từ cơ chế tốc độ thời gian, chưa đối chiếu được với journey chính thức.
5. **Pattern library chưa có** — HUD dùng lại `status-cell` / `alert-row` khai báo ở
   `base.md`; khi làm catalog phải gộp cả hai file.
6. **Safe-area inset** cho mobile: hiện chưa xử lý `env(safe-area-inset-*)`.
7. **`aria-live`** cho H1: chưa có; cần tránh đọc lại mỗi tick (chỉ đọc khi đổi).
8. **Ngưỡng "chạy nhanh"**: tôi chọn ≥60×. Nếu bạn thấy 10× đã là "đang xem" thì
   ngưỡng phải hạ, và HUD sẽ mỏng sớm hơn.
9. **HUD trên tab khác** (Người, Bản đồ, Luật): spec này giả định H1 vẫn hiện ở mọi
   tab. Cần xác nhận, vì nó chiếm chỗ của bảng dữ liệu.

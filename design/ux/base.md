# UX Spec: Căn cứ (Base)

> **Status**: Draft for review
> **Author**: user + Cindy (UX pass — chạy không có `.claude/agents`, xem ghi chú đầu file)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown — không có `design/player-journey.md` (xem Open Questions)
> **Platform Target**: Web. Input: chuột + bàn phím + cảm ứng (responsive, có mobile)
> **Template**: UX Spec
>
> **Ghi chú môi trường**: chạy ở chế độ "không studio" (phương án B). Không có
> `project.yaml`, `.claude/{agents,docs,hooks,scripts,skills}`, `design/gdd/*`,
> `design/player-journey.md`, art bible, pattern library,
> `design/accessibility-requirements.md`. Yêu cầu hệ thống thay bằng
> `docs/GAMEPLAY.md` §9 / §12 / §13 / §14 / §18. Bằng chứng: `docs/ux/UI-AUDIT.md`
> (số đo thật) và `docs/ux/ui-proposal.html` (prototype bấm được).
> Giá trị mặc định do người dùng chốt: collaborative · standard · balanced.
> **Spec liên quan**: `design/ux/hud.md` — dải Z1 của màn này chính là HUD H1 (5 ô),
> nên hai file phải khớp. Đã cross-check ngày 2026-11-08.
> Người dùng đã duyệt A, B, B2, B3, và yêu cầu viết nốt phần còn lại để review sau —
> các mục từ Section C trở đi là **draft chưa được duyệt từng section**.

---

## Purpose & Player Need

**Màn này là gì.** Nơi duy nhất vật chất của căn cứ tồn tại: phòng, trạm, công trình
ngoài sân, hàng đợi xây, và các thiết bị tiêu điện. Mọi hệ khác — bệnh tật, điện,
thức ăn — chỉ *xuất hiện* ở đây khi chúng cần được sửa bằng tay: nấu ăn, sửa vũ khí
mòn, nâng cấp trạm, bật máy sưởi.

**Câu hoàn chỉnh.** "Người chơi đến màn Căn cứ với ý muốn **biết ngay mình đang
thiếu gì để sống sót qua đêm nay**."

**Ba ý định, theo thứ tự người dùng chốt.**

1. Biết đang thiếu gì — *mục đích chính*
2. Chọn công trình tiếp theo cần xây
3. Sửa/dọn thứ đang hỏng trước khi nó giết người

**Nếu màn này khó dùng.** Đo trên app thật (`docs/ux/UI-AUDIT.md`): 50 nút bấm và
3.004 ký tự trên một màn; sidebar cần 2.125 px cuộn trong khung 904 px (2,4 màn).

| Vấn đề đo được | Hệ quả gameplay |
|---|---|
| Không có màn trả lời "đang thiếu gì" | Bỏ sót hành động **duy nhất** quan trọng (nấu trước khi hết lương, sửa rào trước đêm) → mất thuộc địa vì một cảnh báo bị che |
| Cấp trạm nằm trong danh sách module | Không hiểu **vì sao** không chế được đồ, vì công thức khoá theo `station` + `level` (§12) |
| Công dụng món ăn chỉ hiện khi hover | Cháo (+8 HP, −1 ngày bệnh) và dưa muối không được dùng → chết vì bệnh lẽ ra chữa được (§13) |

**Yêu cầu hệ thống phải phục vụ** — thay cho GDD UI Requirements, lấy từ
`docs/GAMEPLAY.md`:

| Nguồn | Yêu cầu |
|---|---|
| §9 Căn cứ & xây dựng | chọn ô, vẽ phòng, đặt module, hàng đợi có ưu tiên ▲▼ |
| §12 Chế tạo | 93 công thức, mỗi công thức khoá theo trạm + cấp |
| §13 Y tế | vết thương / chảy máu / nhiễm trùng cần hành động rõ ràng |
| §14 Cấp module | nâng cấp có giá + thời gian; cấp mở khoá công thức |
| §18 Bảng UI | giữ nguyên chức năng của các bảng đã có |

**Căn chỉnh journey.** Không có `design/player-journey.md` → không xác định được
phase. Ghi vào Open Questions.

**Giả định đã xác nhận với người dùng.** Đây là màn được mở thường xuyên nhất
trong một ván, nên chi phí thao tác ở đây nhân với tần suất cao nhất.

---

## Player Context on Arrival

**Lần đầu gặp.** Ngay sau "Bắt đầu" ở màn chọn căn cứ — `src/ui/Game.tsx` khởi tạo
`useState<Tab>('base')`, nên Căn cứ là tab mặc định. Đây là màn đầu tiên của mọi
ván: ngày 1, 06:00, 5 người, kho khởi đầu (GAMEPLAY §1).

**Ngay trước đó họ làm gì.** Ba đường vào khác nhau về bản chất:

| Đường vào | Ngay trước đó | Hệ quả thiết kế |
|---|---|---|
| Chủ động | đang ở tab Người / Bản đồ / Luật / Nhật ký và quay về vì có việc | người chơi đã biết mình muốn gì; cần đường tắt tới đúng mục |
| **Bị game gọi** | `if (bad) setSpeed(0)` — cảnh báo mức `bad` tự dừng thời gian và bật toast 6 giây | người chơi **giật mình**, thời gian đang dừng, cần biết *chuyện gì vừa xảy ra* |
| Nhịp ngày | vừa tua qua đêm, đọc dòng tổng kết buổi sáng | thói quen kiểm tra; cần so sánh "hôm qua với hôm nay" |

**Trạng thái cảm xúc phải giả định.**

| Chế độ | Cảm xúc | Màn phải trả lời |
|---|---|---|
| **Khẩn** (bị game gọi) | hoảng, thời gian đang dừng | "chuyện gì vừa xảy ra, và tôi bấm gì bây giờ" — trong ≤2 giây |
| **Điềm tĩnh** (chủ động / nhịp ngày) | tính toán, đang lên kế hoạch | "tôi có những gì, nên xây gì tiếp" — cần đọc số và so sánh |

**Tự nguyện hay bị gọi.** Cả hai. Đây là ràng buộc thiết kế quan trọng nhất của màn:
**một màn phải phục vụ đồng thời người đang hoảng và người đang tính toán.** Bản
hiện tại chỉ phục vụ người thứ hai — 2.125 px sidebar để đọc và so sánh.

**Giả định đã xác nhận.** Cảnh báo mức `bad` là lý do phổ biến nhất khiến người chơi
mở màn này giữa lúc đang tua nhanh. Mọi thiết kế sau đây phải giữ được đường
"vừa bị gọi → hiểu ngay → hành động" mà không cần đọc sidebar.

---

## Navigation Position

`[Phiên chơi] → [Thanh điểm] → [Tab Căn cứ]`

Căn cứ là **đích cấp 1 trong phiên chơi**, không phải màn của menu. Nó là một trong
năm tab ngang hàng (Căn cứ · Người · Bản đồ · Luật · Nhật ký) và **có tham số**:
cùng một tab nhưng nội dung phụ thuộc điểm đang chọn ở thanh điểm
(`<BaseView key={site.id}>`). Có ba đường vào: tab (mặc định), thanh điểm (đổi điểm,
vẫn ở tab), và bị game đẩy sang khi có cảnh báo mức `bad`.

Hệ quả: **không có "màn Căn cứ" số ít** — có *Căn cứ của điểm X*. Mọi yêu cầu trong
tài liệu này áp dụng cho điểm đang chọn, không phải cho một màn hình toàn cục.

---

## Entry & Exit Points

| Vào từ | Kích hoạt | Mang theo ngữ cảnh |
|---|---|---|
| Bắt đầu ván | sau khi chọn căn cứ ở màn Picker | ngày 1, 5 người, tab mặc định = Căn cứ |
| Tab bar | bấm "Căn cứ" từ tab khác | điểm đang chọn giữ nguyên |
| Thanh điểm | bấm điểm khác khi đang ở tab Căn cứ | **`key={site.id}` → remount: mất phòng đang chọn, mất bảng đang mở** |
| Cảnh báo `bad` | game tự `setSpeed(0)` + toast 6 giây | **không tự chuyển tab** — người chơi phải tự bấm |

| Ra tới | Kích hoạt | Ghi chú |
|---|---|---|
| Tab khác | bấm tab | trạng thái mở/đóng panel không được lưu; quay lại là mặc định |
| Thanh điểm | chọn điểm khác | vẫn trong màn, nhưng reset lựa chọn hiện tại |
| Lưu / Thoát | nút trong drawer Kho | thoát về title |
| Kết thúc ván | `gameOver` | không thoát được, chỉ còn xem |

**Yêu cầu rút ra (người dùng xác nhận):**

- **R1 — Cảnh báo phải dẫn thẳng tới chỗ sửa.** Bấm một cảnh báo phải mở đúng ngăn
  chứa hành động sửa nó (hết lương → ngăn Bếp; rào hỏng → ngăn Phòng thủ; người bị
  thương → tab Người với người đó được chọn). Hiện tại cảnh báo chỉ là toast biến mất.
- **R2 — Đổi điểm không được xoá việc đang làm.** Đang chọn phòng ở điểm A, đổi sang
  B rồi quay lại A phải còn phòng đó, hoặc ít nhất không mất ngăn đang mở.

---

## Layout Specification

### ASCII Wireframe

**Mobile 390×844** (đa số thời gian sử dụng theo giả định ở Section A):

```
┌──────────────────────────────────────┐
│ ĂN     UỐNG   GIƯỜNG  TT    THỦ  ĐIỆN│
│ 2.1n   3.4n   18/22   38    77   1.8kW│
├──────────────────────────────────────┤
│ Ngày 34 · 21:12 · Mưa  ❚❚ 1× 10× 60× │
├──────────────────────────────────────┤
│ ⚠ CẦN QUYẾT ĐỊNH (3)                 │
│ ● Lương thực còn 2,1 ngày   [Xử lý]  │
│ ● Lò sưởi hết củi — 6°C     [Xem]    │
│ ● Hun khói xong 4.000 kcal  [Nhận]   │
├──────────────────────────────────────┤
│ [Mặt bằng][Chế tạo][Bếp][Trang bị]…  │
├──────────────────────────────────────┤
│  ◱ canvas mặt bằng (kéo / pan / zoom)│
├──────────────────────────────────────┤
│ Tìm công thức, món, vũ khí…          │
│ [Nấu được ngay][Thiếu NL][Khoá cấp]  │
│ ▸ Thịt kho   1.035kcal +10TT  [Nấu]  │
│ ▸ Cháo        500kcal  +6TT   [Nấu]  │
├──────────────────────────────────────┤
│ ◱Tổng quan ▤Căn cứ ☺Người ⌖Bản đồ    │
└──────────────────────────────────────┘
```

**Desktop ≥1280** — hai cột, canvas giữ ưu thế:

```
┌───────────────────────────────────────────────────────────────┐
│ ĂN 2.1n │ UỐNG 3.4n │ GIƯỜNG 18/22 │ TT 38 │ THỦ 77 │ ĐIỆN 1.8kW│
│ Ngày 34 · 21:12 · Mưa 12mm       ❚❚ 1× 10× 60× 240×     [Lưu] │
├──────────────────────────────────────┬────────────────────────┤
│ ◱ canvas mặt bằng (≈62%)             │ CẦN QUYẾT ĐỊNH (3)     │
│                                      │ ● lương thực 2,1 ngày  │
│                                      │   [Xử lý]              │
│                                      │ ────────────────────── │
│                                      │ [Mặt bằng][Chế tạo]    │
│                                      │ [Bếp][Trang bị][Điện]  │
│                                      │ ▸ …danh sách theo ngăn │
├──────────────────────────────────────┴────────────────────────┤
│ nhật ký gập: 3 dòng gần nhất                          [mở rộng]│
└───────────────────────────────────────────────────────────────┘
```

### Layout Zones

Ba cách xếp đã cân nhắc:

| Cách | Ưu | Nhược | Chọn |
|---|---|---|---|
| **A. Dashboard-first** — cảnh báo chiếm nửa trên, canvas thu nhỏ | trả lời "thiếu gì" tức thì | canvas — thứ trực quan nhất — bị đẩy xuống dưới màn mobile | Không |
| **B. Segmented inspector** — canvas giữ nguyên, phần còn lại trong ngăn có tab | canvas không bị giành chỗ; mỗi ngăn một nghề | thêm một tầng bấm | **Có (desktop)** |
| **C. Full-screen sheets** — mỗi nghề một tấm toàn màn | mỗi việc có không gian riêng | mất ngữ cảnh mặt bằng khi đang nấu/sửa | **Có (mobile)** |

| Zone | Nội dung | Hiển thị |
|---|---|---|
| **Z1 Dải trạng thái** | 5 ô (định nghĩa ở `design/ux/hud.md` H1): lương · nước · người · phòng thủ · ngày giờ. Giường / tinh thần / điện là **On Demand** (bấm ô để xem) | luôn hiện, mọi tab |
| **Z2 Thanh thời gian** | ngày, giờ, thời tiết, tốc độ, lưu | luôn hiện |
| **Z3 Cần quyết định** | tối đa 3 cảnh báo sống còn, mỗi cái 1 nút | luôn hiện — thay sidebar 2.125 px |
| **Z4 Ngăn nghề** | segmented: Mặt bằng · Chế tạo · Bếp · Trang bị · Điện | một ngăn mở tại một thời điểm |
| **Z5 Canvas** | mặt bằng điểm đang chọn | ≥60% diện tích desktop |
| **Z6 Nhật ký** | 3 dòng gần nhất, gập được | đáy màn |

Bỏ hẳn: sidebar cuộn 7 mục, bảng kho 16 dòng luôn hiện, danh sách module 22 nút luôn hiện.

### Component Inventory

| Zone | Component | Loại | Nội dung | Tương tác | Pattern |
|---|---|---|---|---|---|
| Z1 | Ô trạng thái | stat cell | số + đơn vị + màu theo ngưỡng | bấm → nhảy tới ngăn liên quan | **MỚI** `status-cell` |
| Z2 | Thanh thời gian | toolbar | ngày/giờ/thời tiết + 4 nút tốc độ | bấm, phím Space/1–4 | đã có, giữ |
| Z3 | Danh sách cảnh báo | alert list | tối đa 3 dòng: mức + câu + 1 nút | bấm dòng hoặc nút | **MỚI** `alert-row` |
| Z4 | Segmented nghề | tab strip | 5 ngăn + số mục | bấm, phím ←/→ | **MỚI** `segment` |
| Z4 | Ô tìm kiếm | input | lọc theo tên | gõ | **MỚI** `filter-input` |
| Z4 | Chip lọc | toggle chip | "Nấu được ngay" / "Thiếu NL" / "Khoá cấp" | bấm bật/tắt | **MỚI** `filter-chip` |
| Z4 | Dòng hành động | list row | tên + 2–3 số + 1 nút | bấm → bottom sheet | **MỚI** `action-row` |
| Z4 | Bottom sheet | overlay panel | tiêu đề + 3–4 cặp số + 2 nút | bấm, Esc, vuốt xuống | **MỚI** `bottom-sheet` |
| Z5 | Canvas mặt bằng | canvas | lưới, tường, người, công trình | kéo chọn, pan, zoom | đã có, giữ |
| Z6 | Nhật ký gập | log strip | 3 dòng + nút mở rộng | bấm mở rộng | **MỚI** `log-strip` |

Sáu pattern mới được đánh dấu để đưa vào pattern library sau (hiện chưa có
`design/ux/interaction-patterns.md`).

### Information Hierarchy

| Hạng | Thông tin | Vì sao hạng này |
|---|---|---|
| 1 | **Thiếu gì để sống qua đêm nay** (ăn, uống, phòng thủ, người bị thương) | trả lời trực tiếp câu hỏi của người chơi; bỏ sót = mất thuộc địa |
| 2 | Trạng thái điểm (ồn, bẩn, xác, điện, sưởi) | quyết định *nguyên nhân* của hạng 1 |
| 3 | Hành động sửa được (nấu, sửa, nâng cấp, điều trị) | biến hiểu biết thành nước đi |
| 4 | Kho và công thức (tra cứu) | cần khi đã biết mình muốn gì |
| 5 | Mặt bằng / vị trí phòng | định vị, không phải quyết định |

Hệ quả: hạng 1 **luôn hiện** (Z3), hạng 4–5 **sau một lần bấm** (Z4/Z5). Bản hiện tại
đảo ngược: hạng 4–5 hiện hết, hạng 1 nằm rải trong 7 block chữ.

---

## States & Variants

| State / Variant | Kích hoạt | Màn thay đổi thế nào |
|---|---|---|
| Default | tải bình thường | dải trạng thái + Z3 + ngăn "Mặt bằng" |
| **Ván mới (empty)** | ngày 1, chưa có công trình | Z3 thay bằng gợi ý khởi đầu: "dựng bếp trước — đồ sống chỉ ăn được nửa năng lượng" |
| **Khẩn (bị game gọi)** | cảnh báo `bad`, game tự dừng | Z3 mở rộng, dòng vừa xảy ra lên đầu, viền đỏ nháy 1 lần, nút "Sửa ngay" |
| Thiếu vật tư | bấm hành động mà kho không đủ | bottom sheet nêu đúng thiếu gì **và cách bù** (đi lục / chế trung gian) |
| Khoá theo cấp | công thức có `level` > cấp trạm | dòng khoá hiện `cần <trạm> cấp N (đang cấp M)`, không chỉ mờ đi |
| Mất điện | `powerOn` rỗng | ô ĐIỆN đỏ; ngăn Điện liệt kê thiết bị bị cắt theo thứ tự ưu tiên |
| Ban đêm | 18:30–06:00 | canvas tối; nhắc "không có đèn thì làm chậm 25%" |
| Không có ai ở điểm | chọn điểm không người | Z3 hiện "0 người — không thể làm gì ở đây"; Z4 khoá |
| Game over | `gameOver` | toàn màn chế độ xem, chỉ còn nhật ký |
| **Mobile** | <720 px | Z5 thành một ngăn trong Z4; Z3 gập còn 1 dòng |
| Desktop | ≥1280 px | Z5 và Z4 cạnh nhau như wireframe |

---

## Interaction Map

Input đã chốt ở Phase 2h: **chuột + bàn phím + cảm ứng**. Không có gamepad.

| # | Hành động | Chuột | Bàn phím | Cảm ứng | Phản hồi ngay | Kết quả |
|---|---|---|---|---|---|---|
| 1 | Đổi ngăn nghề | click | ←/→ khi focus vào strip | chạm | gạch chân đỏ dưới ngăn | đổi nội dung Z4 |
| 2 | Mở chi tiết một dòng | click | Enter khi dòng được focus | chạm | bottom sheet trượt lên 180 ms | mở sheet |
| 3 | Nấu / chế / sửa | click nút trong dòng hoặc sheet | Enter | chạm | nút chuyển "đang xếp…", số tồn kho cập nhật | thêm project vào hàng đợi |
| 4 | Đóng sheet | click nền | Esc | vuốt xuống / chạm nền | trượt xuống 140 ms | về trạng thái trước |
| 5 | Bấm cảnh báo (R1) | click | Enter | chạm | sheet mở đúng ngăn | nhảy tới hành động sửa |
| 6 | Lọc theo tên | gõ | gõ | gõ | danh sách lọc ngay theo từng ký tự | Z4 chỉ còn dòng khớp |
| 7 | Bật/tắt chip lọc | click | Space | chạm | chip đổi viền đỏ | lọc lại danh sách |
| 8 | Chọn phòng trên canvas | click | — | chạm | phòng viền đỏ + crosshair | mở sheet phòng |
| 9 | Kéo chọn vùng xây | giữ + kéo | — | kéo 1 ngón | vùng preview có gạch chéo | hiện chi phí trước khi áp dụng |
| 10 | Pan / zoom canvas | kéo / lăn chuột | Space+drag / +/- | kéo 2 ngón / pinch | canvas di chuyển mượt | đổi khung nhìn |
| 11 | Đổi tốc độ thời gian | click | Space, 1–4 | chạm | nút sáng đỏ | `SPEEDS[i]` |
| 12 | Đổi điểm | click thanh điểm | Tab tới, Enter | chạm | toàn bộ Z4/Z5 nạp lại điểm mới | remount màn (xem R2) |

Phụ thuộc spec: hành động 5 cần tab Người (`people.md`) và ngăn Bếp/Phòng thủ —
chưa có spec riêng, ghi vào Open Questions.

---

## Events Fired

Dự án **không có hệ analytics**. "Event" ở đây là thay đổi trạng thái mô phỏng.

| Hành động | Event / thay đổi | Ghi vào save? |
|---|---|---|
| Nấu / chế | `queueCraft` → thêm project `kind:'craft'` | **Có** |
| Nâng cấp module | `upgradeModule` → project `level+1` | **Có** |
| Sửa vũ khí | `queueRepair` → project `kind:'repair'` | **Có** |
| Điều trị tay | `treatNow` → tiêu vật tư, đổi `bleed/infection/sickDays` | **Có** |
| Đổi tốc độ | `setSpeed` (UI) | Không |
| Đổi tab / mở sheet | state React | Không |
| Đổi điểm đang xem | `setSiteId` (UI) | Không |

Bốn hành động đầu ghi vào save → cần kiểm khi save cũ được load (đã có
`normalizeStock` trong `migrate`, xem `docs/GAMEPLAY.md` §12.1).

---

## Transitions & Animations

| Việc | Thời lượng | Cách | Ghi chú |
|---|---|---|---|
| Sheet mở | 180 ms | `translateY` + `ease-out` | không dùng `scale`, tránh cảm giác phóng to |
| Sheet đóng | 140 ms | `translateY` + `ease-in` | nhanh hơn mở |
| Nhảy ngăn (R1) | 120 ms | đổi nội dung + nháy viền trái 1 lần | nháy để người chơi biết *đã nhảy* |
| Cảnh báo khẩn | 1 lần, 600 ms | viền đỏ mờ dần | **không lặp** để tránh gây loạn |
| Cập nhật số tồn kho | 0 ms | đổi ngay | số phải tức thời, không đếm lên |

**Giảm chuyển động**: nếu `prefers-reduced-motion: reduce` thì bỏ mọi `translateY`,
đổi sang hiện/ẩn tức thời và bỏ nháy. Hiện code **chưa** xử lý — ghi vào Open Questions.

---

## Data Requirements

| Dữ liệu | Nguồn (hệ sở hữu) | Đọc/Ghi | Ghi chú |
|---|---|---|---|
| ăn / uống còn bao nhiêu ngày | `sim/state.ts` `baseStats` + `stock` | Đọc | tính mỗi lần render; không cache |
| tinh thần TB | `Survivor.morale` của người ở điểm | Đọc | — |
| phòng thủ tĩnh | `baseStats.defenseStatic` | Đọc | — |
| điện kW đang chạy / tổng | `sim/power.ts` → `site.powerOn` | Đọc | phụ thuộc pin mặt trời + máy phát |
| danh sách công thức khả dụng | `data/recipes.ts` + `stationLevel` | Đọc | 93 mục, phải lọc trước khi render |
| tồn kho | `site.stock` (700+ khoá) | Đọc | **không render hết** — chỉ nhóm đang xem |
| hàng đợi | `site.projects` | Đọc + **Ghi** | ghi khi nấu/chế/nâng cấp/sửa |
| vết thương, nhiễm | `Survivor.bleed/infection` | Đọc + **Ghi** | ghi khi điều trị tay |
| cấp module | `Room.moduleLevel` | Đọc | quyết định khoá công thức |

Không có dữ liệu real-time cần poll: toàn bộ đọc từ state đã tính lại theo tick.

---

## Input Method Completeness Checklist

Áp dụng cho 3 input đã chốt. Chỉ tick khi Interaction Map ở trên đã nói rõ.

**Bàn phím**
- [x] Tab tới được mọi phần tử tương tác (Tab/Shift+Tab) — *12 hành động đều là button/input*
- [x] Có focus nhìn thấy — *đo được: `outline: solid 1px #ff2a2a`*
- [ ] Thứ tự tab đúng thứ tự đọc — **chưa xác định**, cần kiểm trên DOM thật
- [ ] Focus trap khi sheet mở — **chưa có**, ghi Open Questions
- [x] Esc đóng lớp phủ — *hành động 4*
- [ ] Thông báo trạng thái cho screen reader (`aria-live`) khi số đổi — **chưa có**

**Cảm ứng**
- [x] Mọi thao tác có đường chạm tương đương chuột — *hành động 1–12 đều có cột chạm*
- [ ] Vùng chạm ≥44×44 px — **trượt**: 38/38 nút hiện tại dưới 44 px (nhỏ nhất 24 px)
- [x] Vuốt để đóng sheet — *hành động 4*
- [x] Không phụ thuộc hover — *mọi hành động đều bấm được, hover chỉ là tooltip phụ*

**Chuột**
- [x] Hover có phản hồi (`title`, nền sáng) — *đã có*
- [x] Chuột phải không bắt buộc cho việc gì — *không có menu chuột phải*

Ba ô chưa tick nằm trong Open Questions, đúng quy ước của skill.

---

## Accessibility

Chưa có `design/accessibility-requirements.md` → **tier chưa định nghĩa**. Đề xuất
lấy **WCAG 2.2 AA** làm chuẩn tối thiểu. Số đo thật trên palette hiện tại:

| Màu | Trên nền `#0a0a0a` | AA (4.5:1) | Ghi chú |
|---|---|---|---|
| `--fg` #eaeae6 | 16,41:1 | ✅ | chữ chính |
| `--dim` #8f8f88 | 6,08:1 | ✅ | chữ phụ |
| **`--faint` #5a5a52** | **2,85:1** | ❌ | dùng cho nhãn phụ, số mờ — **phải nâng** |
| `--red` #ff2a2a | 5,30:1 | ✅ | dùng cho cảnh báo |
| `--amber` #e0a030 | 8,71:1 | ✅ | |
| `--ok` #7fbf6a | 9,02:1 | ✅ | |

Các điểm khác:

- **Màu không phải kênh duy nhất**: mỗi trạng thái phải có tag chữ (`thiếu garo`,
  `cần Bếp cấp 2`), không chỉ đổi màu. Bản đề xuất đã làm vậy.
- **Vùng chạm**: 38/38 nút hiện tại < 44 px. Ở màn Căn cứ phải ≥44×44 trên mobile
  (WCAG 2.5.8 chỉ cần 24 px, nhưng đây là game chơi bằng tay).
- **Canvas không đọc được bằng screen reader** → hạn chế cố ý. Bù bằng: mọi thông
  tin canvas đều có bản chữ trong Z3/Z4 (danh sách phòng, hàng đợi). Ghi vào
  "Known Limitations" của accessibility requirements khi có.
- **Giảm chuyển động**: chưa xử lý `prefers-reduced-motion` (xem Transitions).
- **Focus**: có viền 1 px; nên tăng lên 2 px cho dễ thấy trên nền tối.

---

## Localization Considerations

| Yếu tố | Rủi ro | Mức |
|---|---|---|
| Tên nghề trong segmented (`Mặt bằng`, `Chế tạo`, `Trang bị`) | tiếng Việt đã dài; dịch sang tiếng khác có thể +40% | **CAO** — strip cuộn ngang, đừng cố nhồi 5 mục vào 390 px |
| Tên món ăn + công dụng trong một dòng | câu công dụng dài nhất: "hồi 8 HP · đỡ 15 mệt · +200 ml nước · mau khỏi 1 ngày" | **CAO** — phải cho xuống 2 dòng |
| Nhãn ô trạng thái (`LƯƠNG`, `NƯỚC`, `NGƯỜI`, `THỦ`, `NGÀY`) | đã viết tắt cho vừa 5 ô; dịch ra không ngắn được như vậy | **CAO** — cần cho phép giãn hoặc dùng icon |
| Số liệu | `toLocaleString('vi')` đã dùng ở log; phải giữ cho mọi số | Trung bình |
| Chữ trong nút (`Nấu`, `Sửa`, `Xử lý`) | ngắn, an toàn | Thấp |

Nguyên tắc: **không đặt nhãn nào trong vùng rộng cố định < 3× độ dài hiện tại.**

---

## Acceptance Criteria

- [ ] Màn Căn cứ mở từ lúc bấm "Bắt đầu" tới khi canvas vẽ xong **< 1.500 ms** trên
      máy tầm trung (đo bằng Performance panel).
- [ ] Từ lúc mở màn, **trong ≤2 giây** người chơi thấy được cảnh báo sống còn đầu tiên
      (hết lương / hết nước / thiếu phòng thủ) mà không cần cuộn.
- [ ] Bấm một cảnh báo mở đúng ngăn chứa hành động sửa nó (**R1**).
- [ ] Tổng số nút bấm hiển thị đồng thời trên màn Căn cứ **≤ 25** (hiện tại 50).
- [ ] Cuộn dọc để thấy hết nội dung màn (không tính canvas) **≤ 1 màn** ở 390×844
      (hiện tại 2,4 màn).
- [ ] Công thức bị khoá hiện **lý do cụ thể** (`cần Lò rèn cấp 2 (đang cấp 1)`), không
      chỉ mờ đi.
- [ ] Mọi phần tử tương tác có vùng chạm **≥44×44 px** ở viewport 390 px.
- [ ] Không thông tin nào chỉ truyền đạt bằng màu — mỗi trạng thái có tag chữ.
- [ ] Đổi điểm rồi quay lại giữ nguyên ngăn đang mở và phòng đang chọn (**R2**).
- [ ] Ở 390 px không có cuộn ngang (đã đúng hiện tại, phải giữ).

---

## Open Questions

1. **Player journey map chưa có.** Không xác định được phase/emotional arc chính thức;
   Section A/B đang dựa trên quan sát code + xác nhận của người dùng. Cần
   `design/player-journey.md` để đối chiếu.
2. **Accessibility tier chưa định nghĩa.** Đề xuất WCAG 2.2 AA. Chưa có file
   `design/accessibility-requirements.md` để ràng buộc.
3. **Pattern library chưa có.** 6 pattern mới (`status-cell`, `alert-row`, `segment`,
   `filter-input`, `filter-chip`, `action-row`, `bottom-sheet`, `log-strip`) cần được
   ghi thành mục catalog khi làm `interaction-patterns.md`.
4. **Art bible chưa có.** Màu và typography hiện lấy từ `src/ui/styles.css`; nếu có art
   bible thì phải đối chiếu lại.
5. **`--faint` (#5a5a52) chỉ đạt 2,85:1.** Cần nâng lên tối thiểu 4,5:1 hoặc chỉ dùng
   cho nội dung không quan trọng.
6. **Focus trap cho bottom sheet**: chưa có; Tab có thể thoát ra ngoài sheet.
7. **`aria-live`** cho số liệu thay đổi: chưa có, screen reader không biết số vừa đổi.
8. **`prefers-reduced-motion`**: chưa xử lý.
9. **Thứ tự tab (Tab order)**: chưa kiểm trên DOM thật; canvas chèn vào giữa có thể
   làm thứ tự nhảy.
10. **Spec phụ thuộc**: ngăn Bếp cần `design/ux/kitchen.md`? Ngăn Trang bị cần
    `design/ux/gear.md`? Hiện gộp trong spec này; cân nhắc tách khi làm HUD.

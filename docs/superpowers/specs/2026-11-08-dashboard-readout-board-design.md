# Dashboard readout board — design

Ngày: 2026-11-08 · Cỡ: thay đổi nhỏ (1 màn hình) · Trạng thái: chờ duyệt

## Ý định

Dashboard hiện tại bắt người chơi *đọc câu* ("12 người / 8 ở đây / 6 giường", "Ăn 4.2 ngày").
Mục tiêu: nhìn là hiểu — thay câu bằng readout (icon + số + bar), trong đúng ngôn ngữ
"Tactical Telemetry" đang có (mono, hazard red, pixel icon, không bo góc, không gradient).
Không mất thông tin nào đang hiển thị; không đổi sim.

## Mục tiêu

1. Topbar → dãy readout: Ăn (ngày), Uống (ngày), Giường (ở đây/giường), Tinh thần (TB %),
   Phòng thủ (số). Mỗi ô: icon + số + bar mảnh, màu theo ngưỡng (đỏ/hổ phách/ok).
   Câu đầy đủ cũ chuyển vào tooltip của ô.
2. Thời tiết + bầy zombie → badge icon (nắng/mưa/bão + °C); bầy = chip đỏ cảnh báo, hết câu chữ.
3. Nhiệt/Bẩn/Xác (điểm hiện tại) → 3 chip icon + số, đổi màu khi vượt ngưỡng (heat > 45, filth > 40).
4. Kho: bảng 16 dòng → lưới icon pixel (dùng `ITEM_ICONS` sẵn có), số lớn trong ô, đơn vị nhỏ,
   hover hiện tên đầy đủ; ô = 0 thì mờ đi. Không mất dòng dữ liệu nào.
5. Block "Đủ dùng" bị xóa (đã lên thanh readout); block "Điểm này" (nhà vệ sinh/gia cố/rào/viễn chinh)
   → 4 chip icon + số nhỏ dưới lưới kho.
6. Feed nhật ký: rút từ 60 dòng → 6 dòng gần nhất + nút mở tab "Nhật ký". Toast giữ nguyên.
7. Sitesbar: giữ nút điểm, người = số trong chip, chấm "!" đỏ cảnh báo thiếu ăn/nước giữ nguyên.

## Không làm

- Không sửa logic sim, save format, `docs/GAMEPLAY.md`.
- Không redesign nội dung các tab Căn cứ / Người / Bản đồ / Luật / Nhật ký.
- Không đổi theme: giữ dark mono, hazard red, `border-radius: 0`, không gradient/shadow mềm.
- Không thêm dependency mới; icon trạng thái vẽ inline SVG kiểu flat-geometric trong `icons.tsx`.
- Không giấu số liệu sau hover — mọi con số phải thấy được khi chơi.

## Các cách đã cân nhắc

| Cách | Được | Mất | Chọn? |
|---|---|---|---|
| A. Polish chữ→icon trong layout cũ | Nhanh, rủi ro thấp | Chữ vẫn dày, bảng kho vẫn là bảng | Không |
| **B. Đảo dashboard thành readout board** | Nhìn là hiểu, giữ được phong cách, ~1–2 ngày | Sửa `Game.tsx` + `styles.css` nhiều | **Có** |
| C. Redesign toàn bộ thành "sảnh cộng đồng" | Đẹp nhất | Dự án mới, ngược tinh thần "không focus" | Không |

Chọn B vì tận dụng thẳng icon pack pixel sẵn có + icon flat mới vẽ, chữ giảm ~70% mà
mọi số liệu vẫn hiện trên màn hình.

## Ràng buộc kỹ thuật

- Repo đang có thay đổi chưa commit (`Game.tsx`, `styles.css`, `BaseView.tsx`, `daily.ts`, `build.ts`, `modules.ts`, `MAPVIEW`) — xây tiếp trên trạng thái working tree hiện tại, không hoàn nguyên.
- `npm run typecheck` và `npm test` phải xanh sau khi làm.
- Ngưỡng cảnh báo dùng lại hằng số đang có trong code (heat > 45, filth > 40, ăn/uống < 3/< 2 ngày, thiếu giường), không đặt mới trừ khi lệch màu.

## Để lại cho người xây

Kích thước ô lưới kho ở màn hẹp, cách wrap topbar dưới 1200px, tooltip dùng `title=` hay
popover tự vẽ (khuyến nghị `title=` cho vòng đầu).

# Map-first redesign — Căn cứ & Bản đồ — Design

Ngày: 2026-11-08 · Cỡ: **dự án (~3–5 ngày)** · Trạng thái: bản nháp — chờ builder check rồi mời duyệt

## Ý định & vì sao

Hai tab **Căn cứ** (`BaseView`) và **Bản đồ** (`MapView`) hiện là "panel + bản đồ bị chèn": canvas/map chỉ chiếm `1fr` cạnh panel 340px, legend nằm dưới, `BaseView` không có zoom, `MapView` thiếu nút +/−, mobile chỉ xếp dọc tạm. Người chơi muốn 2 màn này **bản đồ-first**: stage (canvas/map) làm chủ toàn màn, mọi điều khiển thành overlay, zoom/pan mượt, chạy tốt trên mobile.

## Mục tiêu

1. **Stage full-bleed** — canvas/map chiếm tối đa không gian, không bị panel chèn.
2. **Legend + lớp** (Nguy hiểm/Nhiệt) lên **thanh trên**; nút zoom +/− thấy rõ.
3. **Zoom + pan cả 2**: `BaseView` canvas (cuộn + pinch + nút) và `MapView` (maplibre + NavigationControl).
4. **Panel → overlay**: nội dung panel hiện tại chuyển thành bottom-sheet (mobile) / drawer (desktop):
   - Căn cứ: sửa phòng (đổi tên, module, plot), vẽ/chọn công cụ, phòng thủ, hàng đợi xây (Hạng mục), chỉ số.
   - Bản đồ: đội viễn chinh, tuyến định kỳ, mục tiêu + hành động (claim/tuần), mở rộng bản đồ.
5. **Mobile-first**: chạm dễ (≥44px), pinch-zoom, bottom-sheet ngón cái với được.

## Không làm

- Không đổi sim / save / logic.
- Không redesign tab Người / Luật / Nhật ký (chỉ đồng bộ visual).
- Không 3D, không xoay bản đồ.
- Không mất bất kỳ chức năng tương tác nào đang có (vẽ phòng, gộp/tách, đặt module, phòng thủ, claim, tuần, tuyến…).

## Anti-goal

- Không để nút to tới mức ăn hết bản đồ trên mobile.
- Không giấu hành động quan trọng sau quá nhiều lần chạm.
- Không đòi kéo-thả chính xác trên touch — phải có phương án chạm thay thế.

## Các hướng đã cân nhắc

| Hướng | Tóm tắt | Chọn? |
|---|---|---|
| A. Cân bằng layout + zoom cơ bản | nhẹ, panel vẫn chèn map | Không |
| B. Panel thu gọn + map làm chủ | map to, drawer | Không |
| **C. Map-first redesign** | stage full-bleed + overlay + mobile-first | **Có** |

Chọn **C** vì người chơi muốn map-first thật sự + mobile tốt, chấp nhận là dự án mới.

## Cách làm (các quyết định thiết kế)

### Khung layout (tràn toàn màn — đã chốt theo lựa chọn B)

Trong **Căn cứ / Bản đồ**, stage (canvas/map) **tràn toàn màn hình**, lấy cả vùng topbar + Kho + tabs trước đây. Mọi điều khiển thành **overlay** gạt mở được:

- **Top strip** (mỏng, nổi trên stage): ngày · tài nguyên · tốc độ + nút mở **Kho** + công tắc tab.
- **Legend + zoom +/−**: thanh nổi trên stage (legend theo yêu cầu để ở trên).
- **Context sheet**: bottom-sheet (mobile) / drawer cạnh (desktop) chứa nội dung panel, kéo lên khi cần.
- **Kho (inventory)**: drawer kéo ra từ nút trên top strip.

**Phạm vi shell (call của ta — xin soát):** dùng **overlay shell nhất quán cho mọi tab**. Top strip + Kho drawer + thanh tab là khung dùng chung; Căn cứ/Bản đồ render stage full-screen sau chrome đó, các tab khác (Người/Luật/Nhật ký) render nội dung trong cùng vùng. Nội dung + tương tác các tab khác giữ nguyên, chỉ đổi khung vỏ (topbar/Kho từ dock → overlay) để không có cú nhảy layout khi đổi tab, và mobile dùng chung một kiểu. Rủi ro được chứa vì logic sim + nội dung các tab không đổi.

### Căn cứ (`BaseView`)
- Canvas đặt trong transform `{scale, tx, ty}`. Wheel zoom (neo theo con trỏ), pinch zoom 2 ngón, kéo = pan khi ở chế độ **Xem**; khi đang chọn công cụ (vẽ phòng/…) thì kéo = vẽ.
- **Chế độ chạm (mobile):** công tắc **Xem / Sửa** để phân biệt pan vs vẽ (tránh vẽ nhầm khi muốn pan).
- Bấm phòng/sân → mở context sheet (đổi tên, module, plot).
- Công cụ vẽ + phòng thủ + Hạng mục + chỉ số → sheet/drawer (tab "Xây" / "Nâng cấp").
- Legend → top bar.

### Bản đồ (`MapView`)
- maplibre full stage (đã hỗ trợ). Thêm `NavigationControl` (+/−, compass).
- Đội viễn chinh / tuyến / mục tiêu → context sheet. Bấm mục tiêu → sheet có claim/tuần.
- Lớp (Nguy hiểm/Nhiệt) + legend → top bar. Mở rộng bản đồ → trong sheet hoặc top action.
- Zoom/pan: native maplibre (cuộn/pinch).

### Mobile-first
- Touch target ≥44px. Pinch-zoom + pan cả 2. Bottom-sheet cho panel. Top bar gọn, icon + tooltip.
- Màn rộng: drawer cạnh. Màn hẹp: bottom-sheet.

### Zoom/pan cho canvas căn cứ (kỹ thuật)
- State `{scale, tx, ty}` ở component. Khuyến nghị: **CSS transform** cho canvas (nhẹ) + **inverse-transform** cho hit-test (mouse→ô). Nút +/−/fit, wheel + pinch.

## Ràng buộc

- Giữ theme Tactical Telemetry (dark mono, hazard red, `radius 0`, không gradient/shadow mềm).
- Không thêm dependency nặng (maplibre sẵn có; zoom canvas tự viết).
- Giữ toàn bộ chức năng tương tác hiện có.
- `npm run typecheck`, `npm test`, `npm run build` xanh.

## Để lại cho người xây

Chi tiết hit-test transform nghịch đảo, ngưỡng snap; gesture handling cụ thể (phân biệt pan/pinch/vẽ); animation của bottom-sheet/drawer; cách bố trí icon trong top bar; cách 2 mức của bottom-sheet trên mobile.

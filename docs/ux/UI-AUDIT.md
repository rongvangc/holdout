# UI audit & proposal — HOLDOUT

Đo trên app thật (`npm run dev`, Edge headless), không phải cảm nhận.

## Số đo hiện tại

| | Desktop 1600×1000 | Mobile 390×844 |
|---|---|---|
| Nút bấm cùng lúc | **50** | 50 |
| Chữ trong một màn | **3.004** ký tự | 3.004 |
| Sidebar (mở hết mục) | **2.125 px** trong khung 904 px → **2,4 màn cuộn** | **2.327 px**, canvas bị đẩy khỏi màn |
| Tràn ngang | không | không (tốt) |

Cấu trúc hiện tại: **một sidebar gánh 7 việc** — Phòng thủ · Chế tạo (93 công thức) · Bếp (12 món) · Trang bị (mọi vũ khí) · Điện & sưởi · Chỉ số · Hàng đợi — cộng danh sách module (~22 nút) và canvas mặt bằng.

## Bốn vấn đề UX cụ thể

1. **Không có màn trả lời "tôi sắp chết vì gì".** Người chơi phải tự quét 7 khối chữ để biết lương thực còn 2 ngày.
2. **Hiển thị hết mọi thứ, cùng trọng lượng.** 93 công thức và 3 khối chỉ số trông giống nhau; không có mức ưu tiên.
3. **Một sidebar cho nhiều nghề khác nhau.** Xây phòng, nấu ăn, sửa vũ khí, bật thiết bị điện nằm chung một cột cuộn.
4. **Hành động mở rộng tại chỗ.** Mở "Chế tạo" làm cả cột dài thêm 1.000 px thay vì mở một tấm riêng.

## Đề xuất (bản bấm được: `ui-proposal.html`)

| Nguyên tắc | Cụ thể |
|---|---|
| **Trạng thái trước, hành động sau** | Màn "Tổng quan" = dải 6 ô (ăn/uống/giường/tinh thần/thủ/điện) + danh sách "Cần quyết định" (tối đa 3), mỗi dòng kèm **đúng một** nút |
| **Tách theo nghề, không theo dữ liệu** | Tab Căn cứ có segmented control: Mặt bằng · Chế tạo · Bếp · Trang bị · Điện |
| **Mặc định là tập nhỏ nhất** | Lọc sẵn "Nấu được ngay"; 93 công thức chỉ hiện khi người chơi mở rộng hoặc tìm kiếm |
| **Bottom sheet cho hành động** | Bấm dòng nào cũng mở tấm 70% có tiêu đề + 3–4 dòng số + 2 nút; đóng bằng bấm nền |
| **Mỗi dòng một quyết định** | Tên + 2–3 số + 1 nút. Bỏ bộ ▲▼✕ cạnh nhau |
| **Màu là thông tin** | đỏ/vàng/xanh + tag ngắn (`thiếu garo`, `cần Bếp cấp 2`) thay cho câu giải thích |

Kết quả đo trên bản đề xuất (cùng viewport 390):

| | Hiện tại | Đề xuất |
|---|---|---|
| Nút bấm | 50 | **23** |
| Chữ | 3.004 | **1.190** |
| Cuộn dọc | 2.327 px | **vừa 1 màn** |
| Tràn ngang | không | không |

## Lộ trình nếu chuyển thành code thật

| Đợt | Việc | Rủi ro |
|---|---|---|
| 1 | Dải trạng thái 6 ô (thay 6 block chữ trong TopStrip) | thấp — chỉ đổi cách hiển thị số đã có |
| 2 | Tách sidebar thành 5 mục segmented + lọc mặc định | vừa — `BaseView` 888 dòng phải chia |
| 3 | Bottom sheet dùng chung cho hành động (chế/nấu/sửa/điều trị) | vừa — cần state chung, không đụng sim |
| 4 | Màn "Tổng quan" + "Cần quyết định" (gộp cảnh báo từ log) | vừa — cần hàm tổng hợp cảnh báo từ `GameState` |
| 5 | Mobile: canvas ưu tiên, các bảng thành sheet toàn màn | thấp |

Đợt 1 và 5 làm được ngay mà không đụng logic mô phỏng.

# Real sim: vật liệu · công trình · chế tạo · món ăn

Ngày 2026-11-08 · Trạng thái: đề xuất, chờ cắt gọt
Nền: `docs/GAMEPLAY.md` (những gì code đang chạy) + audit `src/data/items.ts`, `modules.ts`, `structures.ts`.

## 0. Điểm xuất phát (số thật)

| | Hiện có |
|---|---|
| Item | 16 (3 cái gần như không có đường dùng: `tools`, `parts`, `books`) |
| Module trong nhà/sân | 17 |
| Công trình ngoài trời | 5 (tường, chướng ngại, bẫy chông, cổng, chòi gác) |
| Cây trồng | 3 (rau muống, khoai lang, dược liệu) |
| Kỹ năng | 10 (Chế tạo chỉ dùng cho đun/lọc nước) |
| Chuỗi biến đổi | **2**: `rawFood → meals`, `dirtyWater → water` |
| Bảo quản | **0** (bữa nấu mất 60%/ngày, đồ sống 2%/ngày) |
| Vũ khí / giáp | **0** (trận đánh chỉ giảm sát thương bằng kỹ năng Cận chiến) |

Ba lỗ hổng lớn nhất, xếp theo mức ảnh hưởng sống còn:

1. **Không có vũ khí** → trận đánh là "ai đó mất HP", người chơi không có nước đi nào.
2. **Không có bảo quản** → nấu trước vô nghĩa, mùa mưa/bão là chết đói dù có gạo.
3. **Không có chuỗi vật liệu** → sắt vụn và gỗ chỉ để xây, không có lý do lục soát chuyên biệt.

## 1. Nguyên tắc (để không thành game chế đồ trang trí)

- **Mỗi item phải có ≥ 2 đường dùng và ≥ 1 đường tiêu hao.** Không có item "chỉ để đó".
- **Kg là tiền tệ thật.** Sức chở viễn chinh đã có (22 + 2×Thể lực kg/người, xe +250 kg) → mọi item mới đều có kg, nên mang gì đi là quyết định thật.
- **Kỹ năng = thời gian, không phải xác suất.** Đã có sẵn `1/(1 − 0.05×cấp)` cho Xây/Chế tạo → chỉ cần nhân vào `workSec`.
- **Mỗi trạm phải chặn một thứ mà không trạm nào khác làm được.** 17 module hiện tại đã gần chạm ngưỡng "trạm nào cũng same same".
- **Không có công thức nào tự sinh nguyên liệu từ hư không.** Mọi thứ truy về: lục soát, đốn củi, trồng, hoặc săn.

## 2. Vật liệu: 4 lớp

### L0 — Thô (lục soát / phá nhà / đốn / đào)

| Item | Nguồn | Kg | Ghi chú |
|---|---|---|---|
| Gỗ `wood` ✓ | Kiếm củi, phá nội thất | 1 | có |
| Sắt vụn `scrap` ✓ | Kiếm củi, gara, nhà xưởng | 1 | có |
| Vải `cloth` ✓ | Lục soát | 1 | có |
| Đá `stone` | Mới: đống gạch vụn, công trường | 3 | nặng → phải chở bằng xe |
| Đất sét `clay` | Mới: gần sông/hồ (đào) | 2 | làm gạch, nồi |
| Dây `rope` | Mới: từ vải (0.5 vải → 1 dây) hoặc lục soát | 0.5 | bẫy, giáo, ròng rọc |
| Cao su `rubber` | Mới: lốp xe ở gara | 2 | ná, đế giày, chèn |
| Muối `salt` | **Chỉ lục soát** (chợ, siêu thị, quán ăn) | 1 | **nút cổ chai của bảo quản** |
| Dầu mỡ `oil` | Lục soát (quán ăn, nhà dân) | 0.9 | nấu, đèn dầu |

Muối là mặt hàng khan hiếm có chủ đích: muốn bảo quản thịt cá cho mùa đông thì phải lục soát chợ trước. Rất thật, và tạo ra mục tiêu viễn chinh rõ ràng.

### L1 — Sơ chế (ở trạm, tốn công + nhiên liệu)

| Ra | Từ | Trạm | Công | Ghi chú |
|---|---|---|---|---|
| Ván `plank` | 3 gỗ | Xưởng mộc | 20 phút | thay gỗ trong đồ gỗ tinh |
| Đinh `nail` | 1 sắt | Lò rèn | 15 phút / 10 đinh | giảm chi phí sắt của tường/rào |
| Than `charcoal` | 4 gỗ | Lò nung | 2 giờ | nhiên liệu nóng hơn: nấu, rèn |
| Vôi `lime` | 3 đá | Lò nung | 3 giờ | vữa xây, khử trùng chuồng trại |
| Gạch `brick` | 2 đất sét + 1 than | Lò nung | 3 giờ / 10 viên | tường gạch thay tôn |
| Chỉ `thread` | 1 vải | Xưởng may | 20 phút / 5 cuộn | giáp vải, khâu vá |
| Băng gạc `bandage` ✓ | 0.25 vải | Xưởng may / Y tế | có | đã có |

### L2 — Linh kiện

| Ra | Từ | Trạm | Công |
|---|---|---|---|
| Lưỡi `blade` | 2 sắt + 1 than | Lò rèn | 1.5 giờ |
| Đầu dụng cụ `tool_head` | 1.5 sắt + 1 than | Lò rèn | 1 giờ |
| Cán `handle` | 1 ván | Xưởng mộc | 20 phút |
| Bản lề `hinge` | 0.5 sắt | Lò rèn | 15 phút |
| Bánh răng `gear` | 1 sắt + 1 phụ tùng | Bàn thợ | 1 giờ |
| Dây điện `wire` | 1 sắt | Bàn thợ | 30 phút |
| Lõi lọc `filter_core` | 1 than + 1 vải + 0.5 cát | Bàn thợ | 1 giờ |
| Ắc quy `battery` | 6 sắt + 2 phụ tùng | Bàn thợ | 4 giờ |

### L3 — Thành phẩm

Vũ khí (10) · giáp (5) · dụng cụ (6) · món ăn (16) · đồ bảo quản (5) · thuốc (5) · nước (4) · ánh sáng (2). Tổng **~53 item mới**, cộng 16 cũ = **~69**.

## 3. Trạm mới (module)

Giữ nguyên tắc "mỗi trạm một việc riêng":

| Trạm | Vị trí | Mở khoá | Vì sao cần trạm riêng |
|---|---|---|---|
| **Lò rèn** | Sân/trệt, 4 m² | lưỡi, đầu dụng cụ, đinh, bản lề | cần than + nhiệt; không thể làm trong nhà |
| **Xưởng mộc** | Trong nhà, 6 m² | ván, cán, khiên, đồ gỗ | tách khỏi Bàn thợ (Bàn thợ lo cơ khí) |
| **Lò nung** | Sân, 6 m² | than, vôi, gạch | nguồn nhiệt lớn, sinh khói (heat +) |
| **Xưởng may** | Trong nhà, 4 m² | giáp vải, chỉ, băng gạc tốt | cần bàn + kim; băng gạc hiện đang làm ở Y tế |
| **Bếp hun khói** | Sân, 4 m² | cá/thịt hun khói | bảo quản bằng khói, tốn củi |
| **Chum ủ** | Trong nhà, 2 m² | dưa muối, mắm | lên men, không cần nhiệt |
| **Hầm lạnh** | Trệt, 6 m² (dưới đất) | giảm 50% tốc độ hỏng mọi đồ ăn | "tủ lạnh" của tận thế |
| **Hố ủ phân** | Sân, 2 m² | phân bón → +25% năng suất vườn | biến rác thành lương |
| **Chuồng gà** | Sân, 6 m² | trứng + thịt, ồn | nguồn đạm tái tạo, đổi lại heat |
| **Ao cá** | Sân, 12 m² | cá, 2 ngày/lần | cần nước, dễ bị ô nhiễm |
| **Phòng mổ** | Trong nhà, 8 m² | kháng sinh, khâu vết thương | nâng cấp của Phòng y tế |

Bếp củi hiện tại giữ nguyên; công thức nấu chuyển sang data mới.

## 4. Vũ khí

Cận chiến — ghép từ L3 (`blade` + `handle`):

| Vũ khí | Nguyên liệu | Sát thương giảm | Cắn × | Kg | Bền | Phụ |
|---|---|---|---|---|---|---|
| Gậy gộc | 2 gỗ | 8% | 1.0 | 1.5 | 20 trận | rẻ, làm được ngay ngày 1 |
| Dao phay | 1 lưỡi + 1 cán | 15% | 0.95 | 1.2 | 60 | lục soát +5% (mở thùng) |
| Mã tấu | 2 lưỡi + 1 cán | 22% | 0.9 | 1.8 | 90 | dọn khu nhanh hơn |
| Rựa | 1 lưỡi + 1 cán | 20% | 0.95 | 1.6 | 80 | kiếm củi +30% |
| Giáo tre | 2 dây + 1 mũi sắt | 18% | **0.5** | 2.2 | 50 | tầm xa, gần như không bị cắn |
| Xà beng | 3 sắt | 20% | 0.9 | 3.5 | 200 | mở cửa/thùng, +10% loot |
| Búa tạ | 4 sắt + 1 cán | 28% | 1.0 | 6 | 150 | −10% tốc độ đi, phá tường nhanh |
| Rìu | 1 lưỡi + 1 cán | 22% | 0.95 | 2.5 | 120 | kiếm củi +50% |

Tầm xa:

| Vũ khí | Nguyên liệu | Sát thương giảm | Ồn | Đạn | Kg |
|---|---|---|---|---|---|
| Ná cao su | 1 cao su + 1 cán | 12% | ×0.8 | bi sắt (rèn) | 1.2 |
| Cung tự chế | 1 dây + 2 gỗ + 1 lưỡi | 18% | ×0.7 | mũi tên (mộc) | 1.8 |
| Súng săn | **chỉ lục soát** (đồn CA, nhà dân hiếm) | 40% | **heat +15/trận** | 3–6 viên/khẩu | 4 |

Ràng buộc sim đã có để cắm vào:

- Trận đánh: `dmg = def.dmg × (1 − 0.04×Cận chiến) × ...` → nhân thêm `(1 − weaponMitigate) × (1 − armorMitigate)` (kẹp tổng ≤ 45%).
- Bị cắn: `bite = zombie.bite / √n` → nhân `weapon.biteMult × armor.biteMult`.
- Gặp zombie trên đường: `encounterRate` → nhân `weapon.quiet`.
- Tập kích đêm: trong công thức phòng thủ, số hạng người gác `(8 + 2×Cận chiến)` → `(8 + 2×Cận chiến + weaponDef)`.
- Bền: mỗi trận −1 (súng −3), hỏng thì mất; sửa ở Lò rèn = 40% chi phí.

Giáp (mặc được cùng lúc: 1 giáp thân + 1 mũ + 1 giáp chân + 1 khiên):

| Giáp | Từ | Giảm | Cắn × | Kg |
|---|---|---|---|---|
| Áo vải dày | 3 vải + 2 chỉ | 4% | 1.0 | 1 |
| Giáp vải nhồi | 6 vải + 4 chỉ | 10% | 0.95 | 3 |
| Giáp ống chân | 3 vải + 1 sắt | 6% | 1.0 | 2 |
| Mũ bảo hộ | lục soát | 5% | 0.9 | 1 |
| Khiên ván | 2 ván + 1 sắt | 12% | 0.85 | 4 (−20 kg sức chở) |

## 5. Món ăn

Đồ nấu hiện tại (`meals`) chỉ là "kcal đã nấu". Thay bằng **món cụ thể**, mỗi món có kcal + tinh thần + tốc độ hỏng. Bữa ăn chọn theo món có sẵn, ưu tiên món tinh thần cao khi tinh thần thấp.

Nguyên liệu sinh ra từ: vườn (rau, khoai), lục soát (gạo, mì, bột, sữa), chăn nuôi (trứng, thịt), ao (cá), chợ (muối, dầu).

| Món | Từ | Kcal | Tinh thần | Hỏng/ngày | Ghi chú |
|---|---|---|---|---|---|
| Cơm trắng | 1 gạo + nước + củi | 2250 | 0 | 40% | món nền |
| Cơm + rau | gạo + rau | 2400 | +4 | 40% | cần vườn |
| Cháo | gạo + nhiều nước | 1500 | +6 | 30% | cho người bệnh, dễ ăn |
| Khoai luộc | khoai | 1800 | 0 | 15% | giữ được 6 ngày |
| Canh rau | rau + nước + muối | 600 | +3 | 35% | bù vitamin |
| Rau xào | rau + dầu | 900 | +4 | 30% | |
| Cá kho | cá + muối + củi (nấu lâu) | 2000 | +8 | 25% | món ngon nhất thường ngày |
| Thịt kho | thịt + muối + củi | 2600 | +10 | 25% | |
| Trứng chiên | trứng + dầu | 800 | +6 | 20% | từ chuồng gà |
| Đậu hũ | đậu nành + muối | 900 | +3 | 30% | |
| Bánh mì | bột + nước (lò nung) | 1200 | +2 | 20% | |
| Mì gói | lục soát | 700 | −2 | 5% | ăn nhanh, ăn hoài chán |
| Sữa bột | lục soát | 500 | +5 | 5% | cho người bệnh/trẻ |

Bảo quản (biến món tươi thành đồ để dành):

| Cách | Cần | Thời gian | Hỏng/ngày | Đổi lại |
|---|---|---|---|---|
| Phơi khô | nắng, giàn | 2 ngày | 10% | mất 20% kcal |
| Muối | 1 muối / 2 kg | 1 ngày | 5% | mất 10% kcal, +khát |
| Hun khói | Bếp hun khói + củi | 6 giờ | 15% | +2 tinh thần |
| Ủ chua | Chum + muối | 3 ngày | 10% | +vitamin, +mùi vị |
| Đóng hộp | lọ + củi | 4 giờ | 2% | tốn kém nhất |

Ba cơ chế mới đi kèm:

1. **Nhàm món.** Ăn cùng một món ≥ 3 ngày liên tiếp → −3 tinh thần/ngày. Đổi món reset. Cắm thẳng vào công thức `mục tiêu tinh thần` đã có.
2. **Thiếu vitamin.** Không có rau/quả/món ủ trong 20 ngày → scorbut: −0.5 HP/ngày, ăn rau là hết. Có thật, và biến vườn rau từ "thêm kcal" thành "bắt buộc".
3. **Nước cho nấu.** Món nấu cần nước sạch, nên nhà thiếu nước thì ăn đồ khô.

## 6. Nước

| Cách | Cần | Tốc độ | Hiệu quả |
|---|---|---|---|
| Đun sôi ✓ | củi/than | 8–12 L/giờ/người | 100%, tốn nhiên liệu |
| Lọc cát than | 1 than + cát, xây 1 lần | 4 L/giờ | 90% (10% còn bệnh) |
| Lọc sứ | lõi lọc (thay mỗi 30 ngày) | 12 L/giờ | 99% |
| Viên Clo | lục soát | tức thì | 100%, có hạn |
| Hứng sương | mái + vải | 2–5 L/đêm | miễn phí, ít |

Hiện Trạm lọc đã có (12 L/h, không tốn củi) → đổi thành "cần lõi lọc thay định kỳ" để có chi phí vận hành thật.

## 7. Năng lượng

| Nguồn | Dùng cho | Ghi chú |
|---|---|---|
| Củi ✓ | nấu, sưởi, hun khói | rẻ, ồn, chậm |
| Than | rèn, nung, nấu nhanh | từ lò nung, đắt hơn củi |
| Dầu diesel ✓ | máy phát, xe | biến chất sau 180 ngày (đã có) |
| **Tấm pin mặt trời** | sạc ắc quy | lục soát hiếm; +ắc quy = hết hình phạt ban đêm, không tốn xăng |
| Đèn dầu | chiếu sáng, +tinh thần ban đêm | 0.1 L/đêm |

Pin mặt trời là **mục tiêu giữa game** đúng nghĩa: hiếm, nặng, cần ắc quy (6 sắt + 2 phụ tùng), và thay đổi hẳn nhịp chơi (đêm không còn −25%).

## 8. Xây dựng thêm (ngoài 5 công trình cũ)

| Công trình | Công | Chi phí | Tác dụng |
|---|---|---|---|
| Hào | 2 giờ/ô | — | −0.8 sức tập kích/ô, nhưng đào lâu và ồn |
| Bẫy sập | 1 giờ | 2 gỗ + 1 sắt | giết 1 zombie/đêm, phải thay |
| Bẫy dây | 30 phút | 1 dây | 20%/đêm bắt được thú → thịt |
| Hàng rào thép gai | 1 giờ/ô | 1 sắt | +1.2 phòng thủ/ô (thay tường) |
| Hầm trú ẩn | 8 giờ | 6 gỗ + 6 sắt | tập kích thất bại: người không bị thương, nhưng mất 1 ngày lao động |
| Cầu thang mái + lối thoát | 4 giờ | 8 gỗ | thất bại nặng: không ai chết, mất đồ |
| Bể nước ngầm | 10 giờ | 4 gạch + 4 vôi | +3000 L chứa, không bốc hơi |

## 9. Cắt bỏ (để không phình)

Không làm, có lý do:

- **Chăn nuôi lớn** (bò, heo): cần đồng cỏ, thời gian dài, không hợp nhịp game 30–60 ngày.
- **Buôn bán / NPC trader**: hệ thống riêng, đụng AI, ngoài phạm vi.
- **Cây kỹ năng**: 10 kỹ năng tuyến tính đã đủ.
- **Điện lưới**: pin mặt trời là đủ để có "điện".
- **Vũ khí năng lượng / bom xăng**: mở đường cho phá game; nếu muốn thì chỉ 1 món cuối.
- **Chế xe**: chỉ sửa xe (đã có), không chế mới.

## 10. Lộ trình (mỗi đợt tự chạy được)

| Đợt | Nội dung | Vì sao trước |
|---|---|---|
| **1. Nền dữ liệu** | `Stock` thưa, registry item theo nhóm, `normalizeStock()` trong migrate, save cũ load được | Không có nó thì mọi đợt sau phá save |
| **2. Chuỗi vật liệu** | 8 L0 + 7 L1 + 8 L2, 3 trạm (rèn/mộc/nung), recipe + `project.kind='craft'` | Là xương sống; vũ khí và món ăn đều trỏ vào đây |
| **3. Vũ khí + giáp** | 10 vũ khí, 5 giáp, slot theo người, độ bền, sửa | Trận đánh có nước đi ngay, không đợi nội dung |
| **4. Món ăn** | 13 món, 5 cách bảo quản, nhàm món, vitamin | Cứu mùa bão, cho vườn rau lý do tồn tại |
| **5. Trạm thực phẩm** | Hun khói, chum ủ, hầm lạnh, chuồng gà, ao cá | Chỉ thêm sau khi món ăn đã có |
| **6. Nước + năng lượng** | Lọc sứ, lõi lọc, pin mặt trời, ắc quy, đèn dầu | Mục tiêu giữa game |

## 11. Ba câu hỏi cần chốt trước khi code

1. **Pin mặt trời có tồn tại không?** Nếu có, nhịp đêm thay đổi lớn (bỏ −25%). Nếu không, đêm mãi là bất lợi cố định.
2. **Súng săn**: có (hiếm, ồn, 3–6 viên) hay bỏ hẳn? Có súng thì phải xử lý "tại sao không dùng súng suốt" — cách xử lý là đạn khan + heat.
3. **Vitamin/scorbut**: thêm hay cắt? Nó là cơ chế "thật" nhất trong danh sách nhưng cũng dễ gây bực vì phạt ngầm.

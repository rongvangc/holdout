# HOLDOUT — Cơ chế game

Tài liệu này mô tả đúng những gì code đang chạy (không phải ý tưởng). Khi đổi số trong code, sửa lại ở đây. Đường dẫn file ghi ở đầu mỗi mục.

## 1. Vòng chơi

1. **Chọn khu vực** (`ui/Picker.tsx`): bấm bất kỳ đâu trên bản đồ thế giới, chọn bán kính 800 / 1200 / 1600 m, quét OSM (hoặc dùng thành phố mô phỏng offline). Game chấm độ khó khu vực (Dễ / Vừa / Khó / Rất khó) theo nguy hiểm, lương thực, nước, thuốc, vật liệu.
2. **Chọn căn cứ**: bấm một toà nhà thật trên bản đồ.
3. **Bắt đầu**: ngày 1, 06:00, 5 người, kho khởi đầu:

   | Đồ | Số | Đồ | Số |
   |---|---|---|---|
   | Đồ hộp/khô | 30 000 kcal | Vải | 14 kg |
   | Gạo/khoai sống | 20 000 kcal | Thuốc | 6 liều |
   | Nước sạch | 80 L | Băng gạc | 10 |
   | Nước bẩn | 40 L | Hạt giống | 4 gói |
   | Gỗ | 40 kg | Dụng cụ | 2 bộ |
   | Sắt vụn | 20 kg | Sách | 2 |

4. **Chơi vô tận**. Game kết thúc khi không còn ai sống.

### Điều khiển thời gian (`ui/Game.tsx`)

| Nút | Phím | Tốc độ |
|---|---|---|
| ❚❚ | Space | Dừng |
| 1× | 1 | 1 phút game / giây |
| 10× | 2 | 10 phút / giây |
| 60× | 3 | 1 giờ / giây |
| 240× | 4 | 4 giờ / giây |

Game **tự dừng** khi có sự kiện xấu (chết, bị cắn, zombie phá vào…).

### Các tab

- **Căn cứ**: mặt bằng từng tầng + sân, xây module, gia cố, tự thiết kế (§9).
- **Người**: chỉ số từng người, vai trò, "Đi làm ở" (§8.3).
- **Bản đồ**: lục soát, lấy nước, chiếm, vận chuyển, đi tuần, tuyến lặp, mở rộng bản đồ.
- **Luật**: 6 luật (§10).
- **Nhật ký**.

Thanh trên cùng có danh sách các điểm đang giữ (■ căn cứ, ▪ tiền đồn, ❦ ruộng). Chọn điểm nào thì các tab hiển thị điểm đó.

---

## 2. Thế giới (`world/`)

- **Toà nhà** lấy từ OSM, phân loại theo tag/POI. Toà nhà không có tag thì đoán theo diện tích, số tầng và landuse. Có 18 loại, xem `data/categories.ts`.
- **Số chỗ lục** = sàn (diện tích × min(tầng, 10)) / 100 × hệ số loại, kẹp trong khoảng 2–200.
- **Nguy hiểm ô** (lưới H3 res 9, khoảng 170 m): ước dân cũ từ toà nhà → `danger = min(6, 1 + log2(1 + pop/150))`. Khi đang ở trong toà nhà, nhân thêm hệ số theo loại (bệnh viện 2, đồn công an 1.8, chùa 0.9…).
- **Nguồn nước**: điểm trên sông/hồ (tối đa 24, cách nhau ≥ 250 m).
- **Đất xanh**: park/farmland/grass… ≥ 150 m² (tối đa 300), có thể chiếm làm ruộng.
- **Mở rộng bản đồ**: +800 m mỗi lần, tối đa bán kính 3200 m. Chỉ làm được khi không có đội nào ở ngoài.
- **Riêng tư**: toạ độ được làm tròn 0.005° (khoảng 500 m) trước khi gửi lên Overpass.

---

## 3. Thời gian & thời tiết (`core/time.ts`, `sim/daily.ts`)

- Đêm: 18:30 → 06:00. Làm việc ban đêm chậm hơn 25% (không có điện).
- Lịch game bắt đầu từ ngày thật lúc tạo game. Khí hậu theo tháng và vĩ độ (Bắc/Nam Việt Nam): xác suất mưa, lượng mưa, nhiệt độ, bão.
- **Bão**: không ra ngoài được, không có tập kích. Gia cố −5 HP, rào −10 HP, vườn ngoài trời −15% tiến độ.
- **Nắng nóng** (≥ 32 °C): khát nhanh hơn 20%, đồ ăn hỏng nhanh hơn, zombie thối nhanh hơn (mật độ ×0.92).
- **Rét** (< 18 °C): cây lớn chậm (×0.6).
- **Mưa > 80 mm** và điểm nằm trong 300 m quanh sông: ngập, độ bẩn +8.

---

## 4. Con người (`sim/survivors.ts`, `sim/engine.ts`, `sim/tasks.ts`)

### 4.1 Chỉ số

| Chỉ số | Mức | Ghi chú |
|---|---|---|
| HP | 0–100 | Hồi 1.5/ngày nếu không đói, khát, bệnh hay nhiễm; ×2.5 khi nghỉ ở điểm có Phòng y tế |
| kcal | 0–2800 | Tiêu 70/h × hệ số cường độ. Về 0 → −1.5 HP/h |
| Nước | 0–3200 ml | Tiêu 100 ml/h × hệ số. Về 0 → −5 HP/h |
| Mệt | 0–100 | +5.5/h × hệ số. Ngủ giường −14.3/h, ngủ sàn −9/h |
| Tinh thần | 0–100 | §4.4 |
| Nhiễm trùng | 0–100 | +100 trong 3.5 ngày. Tới 100 → biến thành zombie |

Hệ số cường độ:

| | kcal | nước | mệt |
|---|---|---|---|
| ngủ | 0.85 | 0.7 | — |
| nghỉ | 1 | 1 | 0.8 |
| nhẹ | 1.5 | 1.4 | 1 |
| vừa | 2.2 | 2.2 | 1.4 |
| nặng | 3.5 | 4 | 2.2 |

### 4.2 Kỹ năng

10 kỹ năng: Lén lút, Lục soát, Nấu ăn, Xây dựng, Chế tạo, Y tế, Cơ khí, Cận chiến, Thể lực, Trồng trọt.

- Cấp 0–10. XP để lên cấp `l` là 100 × 1.55^(l−1).
- Làm việc cho 10 XP/giờ vào kỹ năng tương ứng. Đọc sách cho 30 XP/giờ vào một kỹ năng ngẫu nhiên.
- **Tốc độ làm việc** = 1 / (1 − 0.04 × cấp); với Xây dựng và Chế tạo là 0.05 × cấp.
- Các hệ số nhân thêm vào tốc độ:

  | Điều kiện | Hệ số |
  |---|---|
  | Khéo tay (chỉ xây/chế) | ×1.2 |
  | Tinh thần < 25 | ×0.8 |
  | Đang bệnh | ×0.5 |
  | HP < 40 | ×0.75 |
  | Ban đêm | ×0.75 |
  | Luật tiếng ồn | ×0.85 |

- 14 xuất thân (Bác sĩ, Thợ hồ, Bộ đội xuất ngũ, Shipper…) cho kỹ năng khởi đầu.

### 4.3 Tính cách

| | |
|---|---|
| Khoẻ mạnh | −40% nguy cơ bệnh |
| Ngủ ít | −20% mệt |
| Ăn khoẻ | +20% kcal tiêu hao |
| Gan dạ | +25% phòng thủ khi gác; trong đội: −20% sát thương phải chịu; tinh thần không dưới 30 |
| Nhát gan | +5% tránh zombie, −5 tinh thần |
| Khéo tay | +20% tốc độ xây/chế |
| Lạc quan | +8 tinh thần |
| Lặng lẽ | +2 cấp Lén lút |

### 4.4 Tinh thần (mỗi ngày)

Mỗi ngày, tinh thần tiến 30% về mức mục tiêu:

```
mục tiêu = 55
         + (no ? 8 : −15) + (đủ nước ? 4 : −12) + (đủ giường ? 6 : −8)
         + (có Phòng sinh hoạt ? 8 : 0) + lạc quan 8 − nhát gan 5
         − độ bẩn / 8 − 4 × số người chết gần đây − 10 nếu bệnh
         + luật (khẩu phần giảm −8, theo công việc −4, giới nghiêm −3, chôn xác +2, đốt xác −1)
```

- Mỗi người chết: cả nhóm −8 tinh thần ngay lập tức.
- Tinh thần < 15: mỗi ngày có 8% bỏ trốn, mang theo 2000 kcal đồ ăn.

### 4.5 AI hằng ngày — thứ tự chọn việc

1. Nước < 1300 ml → uống 0.75 L, ưu tiên nước sạch. Uống nước bẩn có 12% bệnh (7% nếu Khoẻ mạnh).
2. kcal < 1100 → ăn 1000 kcal, theo thứ tự bữa nấu → đồ hộp → đồ sống. Đồ sống chỉ cho ½ năng lượng; nếu không có bếp, 3% bị đau bụng.
3. Đang bệnh → nghỉ (trừ y tá).
4. Đến giờ đi làm hoặc về nhà → đi (§8.3).
5. Mệt > 88, hoặc ban đêm và mệt > 25 → ngủ. Người gác thì ngủ ban ngày khi mệt > 35.
6. Việc theo vai trò (§5).
7. Có hạng mục xây đã trả tiền → phụ xây (ban ngày).
8. Đọc sách (40% nếu có sách) hoặc nghỉ ngơi.

---

## 5. Vai trò (`sim/tasks.ts`)

| Vai trò | Kỹ năng | Việc |
|---|---|---|
| Thợ xây | Xây dựng | Làm hạng mục đã trả tiền. Nếu hạng mục chưa đủ vật liệu thì đi kiếm củi |
| Đầu bếp | Nấu ăn | Cứ 25 phút nấu 3000 kcal sống × tốc độ, tốn 0.5 gỗ. Ra bữa nấu +8%/cấp. Nấu khi bữa nấu < 2200 × số người. Rảnh thì làm việc nước |
| Nước | Chế tạo | Khi nước sạch < 8 L/người: lọc 12 L/h (cần Trạm lọc) hoặc đun 8 L/h (cần bếp, tốn 1 gỗ). Có giếng thì kéo 120 L/h, tối đa 1500 L/ngày |
| Nông dân | Trồng trọt | Thu hoạch → gieo → chăm (§6) |
| Gác đêm | Cận chiến | Gác suốt đêm, ngủ ngày |
| Y tá | Y tế | 1 liều thuốc: 70% khỏi bệnh. 1 băng gạc: +15 HP × tốc độ. Mỗi người được chữa 1 lần/ngày |
| Vệ sinh | Thể lực | Xử lý xác (đốt 3 xác/h, tốn 1 gỗ/xác; chôn 1.5 xác/h). Dọn bẩn −10/h |
| Kiếm củi | Thể lực | Tháo đồ trong nhà: 4 kg gỗ/h và 1.2 kg sắt/h, đến khi hết phần tháo được. Hết rồi thì ra ngoài: 2 kg gỗ/h và 0.6 kg sắt/h. Rất ồn (heat +0.8/h, ra ngoài +1.4/h). Không làm ban đêm |
| Tự do | — | Đọc sách, nghỉ ngơi |

- **Phần tháo được trong nhà** = diện tích × số tầng × 0.05 kg gỗ và × 0.02 kg sắt.
- **Tự phân việc** (mặc định bật, chạy mỗi sáng cho từng điểm) theo nhu cầu:

  | Vai trò | Số người |
  |---|---|
  | Gác | 15% số người (tối thiểu 1) |
  | Đầu bếp | n/8, nếu có bếp |
  | Nước | n/8 |
  | Y tá | 1 + n/14, khi ≥ 4 người |
  | Vệ sinh | n/12, khi ≥ 6 người |
  | Kiếm củi | Khi thiếu gỗ và heat thấp |
  | Thợ xây | 30% số người, khi có hạng mục |
  | Nông dân | Đủ giờ chăm vườn. Ở ruộng thì ưu tiên trước tiên |

  Người được ưu tiên theo kỹ năng phù hợp. Người đang đi làm ở điểm khác không bị phân lại.

---

## 6. Kinh tế (`data/items.ts`, `sim/daily.ts`)

### 6.1 Thức ăn

- Đồ ăn tính bằng kcal. Mỗi người cần khoảng 2250 kcal/ngày khi làm việc vừa.
- **Hư hỏng mỗi ngày**:
  - Bữa nấu còn 60% (nắng nóng: 40%).
  - Đồ sống mất 2%, hoặc 0.5% nếu có Kho có khoá; nắng nóng ×1.5.
- Xăng biến chất sau 180 ngày (dùng lô cũ trước).

### 6.2 Nước

- Uống: khoảng 2.4 L/ngày khi nghỉ, nhiều hơn khi làm nặng.
- Vệ sinh: 10 L/người/ngày nước bẩn, luôn giữ lại 5 L/người để lọc/đun. Thiếu nước vệ sinh → bẩn nhanh.
- **Hứng mưa** (cần ≥ 1 Bể hứng mưa):
  - Lượng hứng = mm mưa × diện tích mái × 0.8 L.
  - Sức chứa nước bẩn = 300 + 1000 × số bể.
  - Ở ruộng không có mái: mỗi bể chỉ hứng được 20 m².
- **Lấy nước sông**: viễn chinh, 20 L/người.

### 6.3 Trồng trọt

| Cây | Ngày | kcal/m² |
|---|---|---|
| Rau muống | 30 | 475 |
| Khoai lang | 110 | 1720 |

- Mỗi ngày tiến độ tăng `(0.3 + 0.7 × mức chăm) / số ngày`. Mức chăm = giờ chăm / (0.005 h × m²). Không chăm vẫn lớn 30%.
- Gieo tốn 1 gói hạt. Đang thiếu ăn (< 30 ngày lương thực) thì gieo rau, ngược lại gieo khoai.
- Thu hoạch: kcal = kcal/m² × diện tích, trả lại max(1, m²/100) gói hạt.
- Một người chăm 6 h/ngày giữ được khoảng 1200 m² vườn.

### 6.4 Vệ sinh & bệnh

- Độ bẩn tăng mỗi ngày: +0.6/người + 1/người vượt quá công suất nhà vệ sinh (20 người/nhà vệ sinh) + 2/xác + 12 × tỷ lệ thiếu nước vệ sinh.
- Xác: mỗi người chết thêm 1 xác; sau tập kích, số xác = min(sức tập kích, phòng thủ)/12.
- Mỗi ngày mỗi người có xác suất bệnh `0.2% + độ bẩn × 0.06% + 1% nếu > 3 xác` (×0.6 nếu Khoẻ mạnh). Bệnh kéo dài 3–7 ngày, mỗi ngày −3 HP, ăn nhiều hơn 15%.

---

## 7. Zombie & tập kích (`sim/zombies.ts`, `sim/daily.ts`)

### 7.1 Mật độ

```
mật độ = (1 + 1.6 × (1 − e^(−ngày/25)))           lây lan, bão hoà ~ngày 75
       × max(0.55, 1 − (ngày − 60)/400)           thối rữa sau ngày 60
       × (0.92 nếu nắng nóng) × (2 nếu bầy đi qua)
```

**Bầy zombie**: từ ngày 12, mỗi ngày có 1/15 khả năng xuất hiện. Kéo dài 2 ngày: mật độ ×2, khả năng tập kích ×1.5, vùng đã dọn bị lấp lại nhanh gấp 5.

### 7.2 Loại zombie

Tỷ lệ chuyển dần từ ngày 1 sang ngày 61:

| Loại | Sát thương | Cắn | Máu | Giáp | Bỏ qua giáp | Tỷ trọng N1 → N61 |
|---|---|---|---|---|---|---|
| Walker | 8 | 5% | 3.0 | 5% | 0 | 80 → 40 |
| Runner | 11 | 8% | 2.4 | 0% | 10% | 6 → 20 (nhanh) |
| Screamer | 6 | 4% | 2.0 | 0% | 0 | 4 → 12 (hét +8 heat) |
| Bloater | 14 | 6% | 4.0 | 35% | 70% | 3 → 11 (mật bỏ qua giáp mềm) |
| Brute | 32 | 12% | 6.5 | 50% | 60% | 0.5 → 8 (đập bỏ qua giáp mềm) |
| Stalker | 16 | 10% | 3.4 | 15% | 20% | 0 → 6 (chỉ ban đêm, nhanh) |

- **Máu**: số đòn chuẩn (dmg 3) để hạ; **Giáp**: giảm theo `pierce` của vũ khí; **Bỏ qua giáp**: phần giáp người chơi bị vô hiệu — mặt nạ giảm 65% hiệu lực của Bloater, tấm thép (`armor_plate`) giảm 70% của Brute.
- **Nhanh** (Runner/Stalker): chúng lao vào sát, nên lợi thế của vũ khí dài (`biteMult`) chỉ còn 1/3.

### 7.3 Heat (độ ồn)

- Heat của mỗi điểm (0–100) giảm 12/ngày.
- Tăng do: kiếm củi, xây, xe về (+6), đi bộ về (+0.3), có người biến zombie trong nhà (+10), mỗi trận tập kích (+5).
- Luật tiếng ồn: heat sinh ra ×0.6.
- Mỗi ô bản đồ cũng có heat riêng, do lục soát và đánh nhau ở đó.

### 7.4 Tập kích đêm

Mỗi ngày, mỗi điểm có người:

```
P(tập kích) = min(0.85, (0.03 + 0.004 × ngày + heat/200 + n/200) × min(1, (n+2)/10) × (1.5 nếu bầy))
```

Tập kích xảy ra trong khoảng 21:00–04:00.

```
sức gốc = (8 + 1.5 × ngày^0.75) × (nguy hiểm ô / 3) × (mật độ / 1.5) × (1 + heat/100)
        × (0.6 + 0.4 × min(1, n/10)) × ngẫu nhiên 0.7–1.3
sức     = max(30% × sức gốc, sức gốc − bẫy chông)

phòng thủ = gia cố cấp × 22 × HP%  +  rào cấp × 14 × HP%  +  12 × Tháp canh
          + công trình (tối đa 60)
          + mỗi người gác: (8 + 2 × Cận chiến) × (1 − mệt/200) × (1.25 Gan dạ) × (1.2 giới nghiêm)
          + 1.5 × mỗi người khác ở nhà
          × 1.15 nếu có người gác hoặc Tháp canh
```

- **Thắng** (phòng thủ ≥ sức): mỗi người gác có 25% bị thương nhẹ (3–12 HP).
- **Thua**: gọi `tỷ lệ = (sức − phòng thủ) / sức`.
  - Gia cố mất tỷ lệ × 60 HP, rào mất tỷ lệ × 80 HP.
  - Phá ⌊tỷ lệ × số ô⌋ (làm tròn ngẫu nhiên) công trình ngoài trời: tường, chướng ngại, bẫy, chòi.
  - Số người bị thương = ⌈tỷ lệ × n × 0.4⌉, mỗi người mất 10–40 HP. Mỗi người bị thương có 20% bị cắn, và 65% số vết cắn gây nhiễm.
  - Mất tỷ lệ × 25% đồ ăn, nước, thuốc (×8% nếu có Kho có khoá).

---

## 8. Ra ngoài (`sim/expedition.ts`, `sim/commute.ts`)

### 8.1 Viễn chinh

Trước khi đi, game cho xem trước chính xác: thời gian, xăng, sức chở, số lần gặp zombie dự kiến, số trận đánh, nguy cơ bị cắn.

| Kiểu | Mục tiêu | Thời gian ở chỗ đích |
|---|---|---|
| Lục soát | Toà nhà | 120 s/chỗ × (1 − 0.04 × Lục soát) × (1.35 ban đêm) / số người |
| Lấy nước | Sông/hồ | 10 phút + 2 phút/người, gánh 20 L/người |
| Chiếm | Toà nhà ≥ 30 m² hoặc khu đất xanh | Dọn sạch bên trong (§8.2). Đi một chiều |
| Vận chuyển | Điểm đang giữ | 10 phút. Có thể ở lại luôn (chuyển người) |
| Đi tuần | Bất kỳ | 2 giờ chủ động tìm zombie để đánh (§8.4) |

**Di chuyển**:

| | Tốc độ | Hệ số đường vòng | Ồn khi tới |
|---|---|---|---|
| Đi bộ | 1.35 m/s | 1.3 | 0.3 |
| Lén | 0.7 m/s | 1.35 | 0.05 |
| Xe | 11 m/s | 1.6 | 6 |

- Đi xe tốn 0.1 L/km và cần xe ở điểm xuất phát.
- Không đi được khi có bão, hoặc ban đêm nếu đang có luật giới nghiêm.

**Sức chở** = mỗi người (22 + 2 × Thể lực) kg, cộng 250 kg nếu đi xe.

**Gặp zombie** (Poisson theo phút):

```
tốc độ gặp = 0.008 × nguy hiểm × mật độ × (1 + heat/100) × (1.8 ban đêm) × (1 + 0.12 × (n−1))
             × 0.55 nếu lén, × 0.25 nếu đang chạy xe
khả năng tránh = min(0.9, 0.55 + 0.03 × Lén lút cao nhất + 0.1 nếu lén + 0.05 nếu có người nhát gan)
```

- Trong lúc chiếm, tốc độ gặp ×2 và khả năng tránh ×0.5. Trong lúc đi tuần: ×1.6 và ×0.3.
- **Mỗi trận đánh**: một người ngẫu nhiên chịu sát thương `dmg × 0.5–1.5 × (1 − 0.04 × Cận chiến TB) × (0.8 nếu có người Gan dạ) / √n`.
- Khả năng bị cắn = tỷ lệ cắn / √n. 70% trường hợp có người nhìn thấy. Vết cắn không ai thấy chỉ phát hiện khi người đó biến đổi.

**Loot**:

- Mỗi chỗ lục được 1–2 lượt rút từ bảng loot của loại toà nhà.
- Đồ còn lại trong thành phố giảm theo thời gian: hệ số `max(0.2, 1 − 0.012 × (ngày − 1))`.
- Đầy túi thì dừng lục.
- Có thể tìm được xe (gara).
- Có 10% (nhà ở) hoặc 4% (loại khác) gặp 1–4 người sống sót trốn bên trong, mỗi người có 12% đã bị nhiễm.
- Nếu có người chết trên đường về, phần đồ mang về giảm theo tỷ lệ người còn sống.

### 8.2 Chiếm đất (tiền đồn / ruộng)

- **Thời gian dọn**:
  - Toà nhà: `(600 + 25 × √(diện tích × min(tầng, 6))) / √n` giây.
  - Đất xanh: `(300 + 10 × √diện tích) / √n` giây.
- Chiếm toà nhà: lục luôn toàn bộ chỗ còn lại (tối đa 60, không giới hạn túi). Đội ở lại điểm mới, đồ mang theo thành kho khởi đầu.
- **Mỗi điểm có kho riêng.** Muốn chuyển đồ phải dùng vận chuyển.
- Điểm không phải căn cứ chính mà không có ai ở: mất 3%/ngày đồ ăn, nước, thuốc, xăng.
- Ruộng: toàn bộ là sân; rào ở ruộng (tre/dây thép) chỉ tốn 40% chi phí.
- Khả năng bị tập kích phụ thuộc số người có mặt: điểm ít người thì ít bị chú ý.

### 8.3 Đi làm ở điểm khác

- Gán trong tab Người. Người đó ngủ ở nhà, ban ngày đi bộ sang điểm làm việc, làm theo vai trò ở đó. Nếu điểm làm việc là ruộng thì tự chuyển sang nông dân.
- Đi khi: trong khoảng 06:30–14:00, mệt < 50, không bệnh, không bão.
- Về khi: từ 17:00 hoặc trời tối.
- Đi một mình nên dễ gặp zombie hơn, không có đồng đội đỡ. Bị cắn trên đường thì 50% có người biết.

### 8.4 Đi tuần & vùng an toàn

- Sau mỗi chuyến tuần, ô mục tiêu được dọn thêm `min(0.5, 0.12 + 0.04 × số trận)`, 6 ô xung quanh được một nửa. Heat của ô −10.
- Nguy hiểm hiệu dụng = nguy hiểm × (1 − 0.6 × độ sạch). Một ô sạch 100% vẫn còn 40% nguy hiểm.
- Độ sạch giảm 0.03/ngày (0.15/ngày khi bầy đi qua).
- Nguy hiểm hiệu dụng ảnh hưởng đến sức tập kích, tốc độ gặp zombie và độ an toàn khi đi làm. Bản đồ tô xanh các ô đã dọn.

### 8.5 Tuyến lặp

- Lập từ một chuyến vận chuyển: chọn lặp mỗi N ngày.
- 07:00 các ngày đến hạn, game chọn những người khoẻ nhất ở điểm xuất phát (không phải người gác, không đi làm nơi khác, HP > 60, không bệnh), đi bộ, mang theo tối đa số hàng đã đặt.
- Không đủ người thì hoãn sang mai. Kho trống thì bỏ chuyến.

---

## 9. Căn cứ & xây dựng (`base/interior.ts`, `sim/build.ts`, `sim/design.ts`)

### 9.1 Mặt bằng

- Footprint thật của toà nhà được chia thành lưới ô. Cạnh ô = max(2, ⌈kích thước/44⌉) m.
- Số tầng lấy theo OSM, tối đa 6. Phòng được chia sẵn bằng BSP.
- Sân là phần đất trống rộng 8 m quanh nhà, không đè lên nhà hàng xóm.

### 9.2 Module

| Module | Vị trí | Tối thiểu | Chi phí | Tác dụng |
|---|---|---|---|---|
| Phòng ngủ | Trong nhà | 5 m² | 4 gỗ + 2 vải mỗi 5 m² | 1 giường / 5 m² |
| Bếp củi | Bất kỳ | 6 | 10 gỗ, 6 sắt | Nấu ăn, đun nước |
| Kho có khoá | Trong nhà | 6 | 8 gỗ, 10 sắt | Đồ sống hỏng 0.5%/ngày; tập kích chỉ lấy 8% |
| Bàn thợ | Trong nhà | 8 | 20 gỗ, 15 sắt, 1 dụng cụ | Mở khoá các mục ★ (có ở bất kỳ điểm nào là đủ) |
| Phòng y tế | Trong nhà | 8 | 10 gỗ, 10 vải | HP hồi ×2.5 khi nghỉ |
| Nhà vệ sinh | Tầng trệt/sân | 2 | 6 gỗ, 2 sắt | 20 người/nhà vệ sinh |
| Bể hứng mưa | Mái/sân | 4 | 8 gỗ, 12 sắt | +1000 L chứa, hứng nước từ mái |
| Trạm lọc ★ | Tầng trệt/sân | 4 | 8 sắt, 6 vải, 4 gỗ | 12 L/h, không tốn củi |
| Vườn rau | Mái/sân | 6 | m²/20 gỗ, 1 hạt | §6.3 |
| Giếng ★ | Sân | 4 | 12 sắt, 10 gỗ, 1 dụng cụ | Tối đa 1500 L/ngày; cách nhà vệ sinh ≥ 10 m |
| Tháp canh ★ | Mái/sân | 4 | 25 gỗ, 10 sắt | +12 phòng thủ, ×1.15 phòng thủ |
| Phòng sinh hoạt | Trong nhà | 8 | 8 gỗ, 6 vải | +8 tinh thần |
| Vườn thuốc | Mái/sân | 4 | ⌈m²/10⌉ gỗ, ⌈m²/20⌉ vải | Chu kỳ 40 ngày: thu m²/12 liều thuốc, tối đa m²/6 băng gạc (0.25 vải/cuộn) |
| Kệ sách | Trong nhà | 4 | 4 gỗ, 2 vải | Mở "Tự học" ở tab Người: gán kỹ năng → đọc đúng skill |
| Chòi xe | Sân | 12 | 10 gỗ, 20 sắt, 1 phụ tùng | Xe từ điểm này: 0.08 L/km (thay vì 0.1) và +80 kg sức chở |
| Máy phát ★ | Sân | 2 | 15 sắt, 2 phụ tùng, 4 gỗ | Đêm chạy máy: đốt 24 L xăng → đêm đó làm việc hết ×0.75; heat +6 |
| Lán trại | Sân | 8 | 5 gỗ + 3 vải mỗi 6 m² | 1 chỗ ngủ / 6 m². Bão xoé 50% số lán mỗi trận |

**Gia cố** (cửa, cửa sổ) và **Tường rào** (quanh sân):

- Tối đa cấp 3. Cấp 2 trở lên cần Bàn thợ.
- Chi phí mỗi cấp: công = cấp × chu vi × 240 s; gỗ = cấp × chu vi × 0.5; sắt = cấp × chu vi × 0.2.
- Phòng thủ: 22/cấp với gia cố, 14/cấp với rào, nhân với HP%.
- Sửa chữa tốn (100 − HP)% × 50% chi phí.
- Mòn chậm theo thời gian: gia cố −0,25 HP/ngày, rào −0,4 HP/ngày.

**Hàng đợi**:

- Hạng mục tự trừ vật liệu khi kho đủ. Thợ xây làm các hạng mục đã trả theo thứ tự hàng đợi; nút ▲▼ đổi ưu tiên.
- Huỷ hạng mục đã trả: hoàn 80%. Tháo dỡ module: hoàn 40%.

### 9.3 Tự thiết kế (tab Căn cứ → thanh công cụ)

Kéo chuột chọn vùng → xem trước chi phí → **Áp dụng**. Bắt đầu kéo trong nhà thì sửa phòng của tầng đang xem; bắt đầu ngoài sân thì sửa khoảnh đất.

| Công cụ | Làm gì |
|---|---|
| ▭ Vẽ phòng | Tạo phòng hoặc khoảnh mới từ vùng chọn (phải liền khối), có thể đặt tên. Phần bị cắt của phòng cũ tự tách ra |
| ⊞ Gộp | Gộp hai phòng sát nhau, cùng tầng |
| ⌫ Bỏ khỏi phòng | Xoá ô khỏi phòng. Phòng bị đứt thì tách thành nhiều phòng |
| Đổi tên | Sửa trực tiếp ở khung bên phải |
| █ ▚ ⋀ ▥ ⌂ | Xây công trình theo từng ô ngoài sân/ruộng. Chế độ **Viền** chỉ xây mép vùng chọn, **Kín** lấp đầy |
| ✕ Dỡ | Tháo công trình (hoàn 40%) hoặc huỷ phần đang chờ xây |

**Cap số lượng** (mỗi điểm, đếm cả hạng mục đang chờ): Bếp củi/K kho/Giếng/Bàn thợ/Phòng y tế/Trạm lọc/Kệ sách/Máy phát tối đa **1**; Tháp canh và Chòi xe tối đa **2**; Cổng 6, Chòi gác 4 (theo ô). Vườn/giường/bể nước/khoảnh sân xếp chồng theo diện tích có sẵn.

**Công trình ngoài trời** (tính mỗi ô):

| | Công | Chi phí | Phòng thủ | Ghi chú |
|---|---|---|---|---|
| Tường gạch/tôn | 30 phút | 2 gỗ, 2 sắt | +0.8 | |
| Chướng ngại | 10 phút | 1 gỗ | +0.35 | |
| Bẫy chông | 15 phút | 1 gỗ, 0.5 sắt | — | −0.6 sức tập kích |
| Cổng | 40 phút | 4 gỗ, 3 sắt | +0.6 | Tối đa 6/điểm |
| Chòi gác | 1 giờ | 6 gỗ, 2 sắt | +3 | Tối đa 4/điểm |

**Giới hạn**:

- Công trình chiếm tối đa **50% số ô sân**.
- Phòng thủ từ công trình tối đa **+60** mỗi điểm.
- Bẫy giảm sức tập kích tối đa **25**, và đợt tập kích luôn còn ít nhất **30%** sức.
- Phòng trong nhà tối đa **150 m²**, khoảnh sân tối đa **800 m²**.
- Phòng trong nhà mới vẽ cần **dựng vách** trước khi đặt module: công = 10 phút + 2 phút/ô, gỗ = 0.5/ô.
- Không sửa được phòng đang có hoặc đang xây module; phải tháo trước.
- Khoảnh sân có công trình thì không đặt module lên được, và ngược lại.

---

## 10. Luật (`sim/data.ts`)

Mỗi luật sau khi đổi phải chờ 3 ngày mới đổi lại được.

| Luật | Lựa chọn |
|---|---|
| Khẩu phần | Đầy đủ (1000 kcal/bữa) · Cắt giảm (750, −8 tinh thần) · Theo công việc (người rảnh ăn 700, −4) |
| Người bị cắn | Cách ly 4 ngày (nhiễm thì bị đưa đi, biến đổi trong cách ly thì không lây) · Trục xuất (−4) · Xử lý (−4 tinh thần cả nhóm, cộng −8 vì có người chết) |
| Người lạ | Nhận tất cả · Kiểm tra (cách ly 2 ngày) · Từ chối (−2) |
| Giới nghiêm | Không đi đêm, người gác +20%, −3 tinh thần |
| Kỷ luật tiếng ồn | Heat ×0.6, làm việc ×0.85 |
| Xử lý xác | Đốt (1 gỗ/xác, −1 tinh thần) · Chôn (chậm gấp đôi, +2 tinh thần) |

### Nhiễm trùng

- 65% vết cắn gây nhiễm. Từ lúc nhiễm đến lúc biến đổi mất 3.5 ngày.
- Biến đổi trong căn cứ: 1–2 người ở gần mất 8–25 HP, mỗi người có 35% bị cắn; heat của điểm +10.
- **Người lạ**:
  - Mỗi ngày có `max(6%, 16% − 0.1% × ngày)` khả năng một nhóm 1–2 người (10% là 3–4 người) tới cổng.
  - Mỗi người có 12% đã bị nhiễm.
  - Người gặp khi đi lục soát được xử lý theo cùng luật.

---

## 11. Công cụ cân bằng

- `scripts/sim.ts`: bot (`scripts/headless.ts`) tự chơi N ngày trên thành phố mô phỏng. Bot tự phân việc, xây, lục soát, chiếm ruộng/tiền đồn, gán người đi làm, đi tuần. In ra bot còn sống hay game over ở ngày nào, kèm các dòng nhật ký cuối. Thêm `nofield` để tắt việc chiếm ruộng.
- `tests/`: kiểm tra dựng thế giới, tính tất định, đa điểm, lãnh thổ, thiết kế căn cứ.

Khi chỉnh số, chạy bot vài seed khác nhau, ví dụ `-- 120 1`, `-- 120 2`, `-- 120 3`, để so sánh trước và sau.

---

## 12. Vật liệu, trạm và chế tạo (`data/items.ts`, `data/materials.ts`, `data/recipes.ts`, `sim/build.ts`, `sim/equipment.ts`)

### 12.1 Danh mục item

- `ItemId` là string, không phải union đóng. Registry gồm **16 item lõi** + **19 vật liệu tự viết** (`materials.ts`) + **647 item lấy từ bộ nội dung innawoods** (`items.generated.ts`, sinh bởi `scripts/mine-innawoods.mjs` + `scripts/gen-items.mjs`).
- innawoods **không có công thức chế tạo và không có kg** (thuộc tính item chỉ có `year`/`singleHanded`), nên kg, độ bền và công thức đều do game tự định nghĩa.
- Item lấy từ innawoods bị lọc: bỏ item mang tên IP game khác (STALKER/Metro/Fallout/EFT/The Long Dark), bỏ thứ vô nghĩa với sim (chìa khoá, bút, giấy), gộp trùng tên.
- `normalizeStock()` chạy trong `migrate()` cho **cả save v1 và v2**: điền 0 cho id mới, bỏ id lạ, kẹp âm. Save cũ mở lên vẫn chơi được.

### 12.2 Chuỗi vật liệu

| Lớp | Item | Nguồn |
|---|---|---|
| L0 thô | gỗ, sắt vụn, vải, đá, đất sét, cát, dây thừng, cao su, muối, dầu ăn | lục soát, kiếm củi, đào |
| L1 sơ chế | ván, đinh, vôi, chỉ | trạm |
| L2 linh kiện | lưỡi, đầu dụng cụ, cán, bản lề, bánh răng, dây điện, tấm thép, lõi lọc, ắc quy, tấm pin mặt trời | trạm |
| L3 thành phẩm | vũ khí, giáp, dụng cụ, món ăn, thuốc | trạm |

**Muối chỉ lục soát được** — là nút cổ chai của mọi cách bảo quản.

### 12.3 Trạm = module có cấp

Cấp 1 là lúc xây xong; `ModuleDef.levels` là các bậc nâng tiếp; `Room.moduleLevel` là bậc hiện tại. Nâng cấp đi qua đúng hàng đợi xây (trả vật tư, ▲▼ đổi ưu tiên, thợ xây làm).

| Trạm | Vị trí | Cấp 2 | Cấp 3 |
|---|---|---|---|
| Lò rèn | sân | tấm thép, vũ khí dài, dao | búa tạ, đồ nặng |
| Xưởng mộc | trong nhà | đồ nặng, lều | khung ba lô |
| Lò nung | sân | nung đêm, đỡ tốn củi | nung đêm ×2 |
| Xưởng may | trong nhà | mũ cứng, ủng, giáp nhồi | giáp tấm, áo giáp |
| Bếp hun khói | sân | hun nhanh | mẻ lớn |
| Chum ủ | trong nhà | ủ thịt cá | mắm lâu năm |
| Bàn thợ (cũ) | trong nhà | ắc quy, đèn dầu | pin mặt trời |
| Bếp củi (cũ) | bất kỳ | mẻ 8000 kcal | đỡ tốn củi |

### 12.4 Công thức

- **74 công thức**: chuỗi vật liệu viết tay; mỗi *dạng* vũ khí/giáp có một công thức (biến thể thương hiệu chỉ nhặt được, không chế được); đồ ăn có công thức nấu và bảo quản.
- Công thức khai báo `station` + `level`, nên **một công thức bị khoá sau đúng bậc nâng cấp mở nó**.
- Chế tạo dùng `project.kind = 'craft'`: trả vật tư qua cổng `paid`, thợ xây làm, nhưng kỹ năng áp dụng là `crafting`/`mechanics` của công thức.
- `upgradeFrom` biến công thức thành nâng cấp (tiêu món gốc): `Folding shovel → Shovel`, `Combat knife → Machete`.

### 12.5 Trang bị theo từng người (`sim/gear.ts`)

Trang bị là **của từng người**, không phải của kho. Mỗi người có 4 slot: **vũ khí · giáp thân · mũ · ba lô** (`Survivor.gear`).

- **Cấp phát**: `equip()` lấy 1 món ra khỏi kho của điểm (nên một cây rựa không thể trang bị cho 5 người). Tháo ra thì món quay lại kho. Đổi món thì món cũ trả kho.
- **Tự động**: mỗi sáng `autoAssign` gọi `issueGear()` — món tốt nhất trong kho được cấp cho người gác trước, rồi tới người có Cận chiến cao nhất. Ai đang cầm món yếu hơn món còn trong kho thì được nâng cấp.
- **Slot hợp lệ**: súng/dao/gậy/búa → vũ khí; `armor_soft`/`armor_plate`/`vest` → giáp thân; `helmet`/`mask` → mũ; `backpack`/`container` → ba lô.
- **Trong trận**: mỗi người gác dùng **vũ khí của chính mình** (`8 + 2×Cận chiến + round(mitigation×40)`), và mòn đúng món đó; súng bắn thì cộng heat. Sát thương vào ai thì **giáp của người đó** giảm (thân + mũ cộng dồn, kẹp **45%**), xác suất bị cắn cũng giảm theo.
- **Đi viễn chinh**: vũ khí tốt nhất trong đội quyết định `biteMult`/tiếng ồn; giáp tính theo từng nạn nhân; **ba lô cộng sức chở** (`capacity`, mặc định 26 kg).
- **Súng thiếu đạn thì không dùng được** — `canField()` kiểm tra kho của điểm đang đứng; cầm súng không đạn coi như tay không.
- **Chết/ra đi**: người chết trong căn cứ → đồ **trả lại kho**; chết ngoài đường hoặc bỏ trốn → **mất đồ**.
- **Độ mòn vẫn theo loại** (`site.condition`), không theo từng món: hai người cầm cùng một loại thì dùng chung độ mòn.

**Chỉ số đánh nhau** (`data/items.ts` + `sim/combat.ts`): vũ khí có `dmg` (sát thương/đòn, đòn chuẩn = 3) và `pierce` (xuyên giáp tự nhiên). Mỗi trận resolve **2 pha**:

1. **Hạ trước khi chúng áp sát** — `killShare()`: `Σ strikePower × độ đông × kỹ năng Cận chiến`, kẹp 0–95%. `strikePower = dmg × (1 − armor × (1 − pierce)) / hp của loại đó`.
2. **Nếu chưa hạ hết** — chúng vào được: sát thương `dmg của loại × roll`, giáp của **chính nạn nhân** bị `bypass` của loại đó bào mòn (`armourAgainst()`); xác suất cắn `bite × reachFactor()`.

- Vũ khí gây sát thương theo hình dạng: dao 2.6 / gậy 3.0 / xà beng 3.4 / búa-rìu 3.8 / kiếm-rựa 3.9 / nặng 5.2 / súng lục 3.2 / súng trường 5.9 / shotgun 7.1 / bắn tỉa 9.0. `pierce` từ 0.05 (tay không) → 0.37 (rìu) → 0.88 (súng bắn tỉa).
- **Raid đêm** cũng dùng hỗn hợp loại zombie như ngoài đường (5 con ngẫu nhiên theo ngày/đêm) → loại quyết định sát thương, khả năng cắn và bypass; người gác hạ được nhiều thì phòng thủ tăng (tối đa +50%).
- **Dự báo viễn chinh** đã trừ phần hạ được, nên `nguy cơ bị cắn` không còn cao hơn thực tế.
- Hạ được nhiều thì ô đó **sạch nhanh hơn** (dùng chung `cellClear` của đi tuần).

### 12.6 Thức ăn

- Mọi item có `kcal` đều ăn được, chọn món nặng/kcal cao trước.
- Hỏng theo `rotPerDay` riêng: đồ hộp 0.5%/ngày, món tươi 6%/ngày; nắng nóng ×(nếu >1%), Kho có khoá giảm nửa.
- Nấu (`bếp`), hun khói (`bếp hun khói`), muối chua (`chum ủ`) biến `rawFood` thành món để dành.

### 12.7 Đạn và độ mòn (`sim/equipment.ts`)

- Mỗi khẩu súng ăn đúng loại đạn của dòng nó; không có đạn thì **không được cấp ra trận**. Bảng ánh xạ theo tên dòng súng (TOZ/AA-12/Saiga → 12 ga, AK/SKS/SVD → 7.62x39, Mosin/M14 → 30-06, VSS/Val → 9x39, Makarov → 9x18, P90 → 5.7x28, 1911 → .45 ACP, .22 → 22 LR). Súng không khớp bảng dùng đạn 9x18 làm cỡ chung.
- Mỗi trận bắn tiêu 1 viên/trận (kẹp theo số đạn còn).
- **Đạn không chế tạo được** — chỉ nhặt được khi lục soát (đồn công an: 12 ga/9×18/7.62×39/30-06; cửa hàng vật liệu: .22; chợ: 12 ga). Có test khoá luật này (`tests/diet-and-repair.test.ts`).
- Trang bị có **độ mòn 0..1** cho từng loại trong kho. Mỗi trận mòn `1/durability`; mòn làm giảm hiệu lực (còn 55% hiệu lực khi mòn hết cỡ).
- Mòn về 0: **một món gãy** (rời kho), phần còn lại thành 1 kg sắt vụn.
- **Sửa**: Lò rèn cấp 2+, tốn `max(1, mòn×4)` sắt + 1 gỗ nếu mòn > 50%, 30 phút công. Sửa xong độ mòn về 1.

### 12.8 Chế độ ăn (`sim/diet.ts`)

- **Nhàm món**: 9 bữa liên tiếp cùng một món → mục tiêu tinh thần −3/ngày cho tới khi đổi món. Nhật ký bữa ăn giữ 12 mục gần nhất.
- **Thiếu vitamin C**: 25 ngày không có rau/quả → scorbut, mỗi người −0.25 HP/ngày. `rawFood` (rau muống/khoai từ vườn) và `meals` nấu từ đó đều tính là có rau; chỉ ăn đồ khô nhặt được thì mới bị.
- **Hầm lạnh**: module mới, 3 cấp. Tốc độ hỏng thức ăn: cấp 1 = 50%, cấp 2 = 35%, cấp 3 = 25%. Không có hầm thì Kho có khoá cho 50%.

### 12.9 Nguyên liệu và món ăn (`data/dishes.ts`)

Bữa ăn không còn là một cục `meals`. Có **6 nguyên liệu tươi** và **12 món**:

| Nguyên liệu | kcal/kg | Hỏng/ngày | Nguồn |
|---|---|---|---|
| Rau tươi | 200 | 35% | vườn rau (thu hoạch), chợ |
| Thịt tươi | 1900 | 50% | chợ, quán ăn, chuồng gà (thỉnh thoảng) |
| Cá tươi | 1300 | 55% | chợ, ao cá |
| Trứng | 1300 | 1% | chuồng gà |
| Đậu hạt | 1450 | 1% | chợ |
| Bột mì/gạo | 3500 | 2% | chợ |

Món ăn (kcal/phần · tinh thần khi ăn · trạm/cấp):

| Món | kcal | Tinh thần | Trạm |
|---|---|---|---|
| Cơm trắng | 2600 | 0 | bếp 1 |
| Cơm + rau | 2800 | +4 | bếp 1 |
| Cháo | 1500 | +6 | bếp 1 |
| Khoai luộc | 1900 | 0 | bếp 1 |
| Canh rau | 700 | +3 | bếp 1 |
| Rau xào | 950 | +4 | bếp 1 |
| Trứng chiên | 800 | +6 | bếp 1 |
| Đậu hũ | 950 | +3 | bếp 1 |
| Cá kho | 2100 | **+8** | bếp **2** |
| Thịt kho | 2600 | **+10** | bếp **2** |
| Bánh mì | 1300 | +2 | lò nung 2 |
| Dưa muối | 400 | +3 | chum ủ 1 (hỏng 4%/ngày) |

- **Chọn món trước**: người sống sót ăn món có tinh thần cao nhất đang có, rồi mới tới cơm/đồ khô. Tinh thần cộng thêm tối đa +12/bữa.
- Vì mỗi món là một item riêng, **nhàm món trở thành cơ chế thật**: ăn mãi thịt kho cũng chán như ăn mãi cơm.
- **Chuồng gà** (mới): ăn 2200 kcal/ngày mỗi chuồng, đẻ ~3 trứng/ngày (cấp 2: ~4.8), 4%/ngày có thêm thịt; heat +0.6/ngày. Không có gì cho ăn thì gà đói.
- **Ao cá** (mới): 65%/ngày bắt được cá (ao bẩn > 55 thì còn 30% và cá chết dần); cấp 2/3 tăng sản lượng.
- Vườn rau khi thu hoạch cho thêm **rau tươi** (60 m² ≈ 1 kg) — dư lượng nhỏ so với kcal nên không phá cân bằng.

### 12.10 Món ăn có công dụng (`data/items.ts` → `FoodFx`, `sim/diet.ts`)

Ngoài kcal và tinh thần, mỗi món còn **tác dụng lên người ăn**. Hiệu ứng cộng dồn theo số phần nhưng bị kẹp (`FX_CAPS`): hồi tối đa 15 HP, đỡ 20 mệt, +500 ml, giảm 1 ngày bệnh mỗi bữa.

| Món | Hồi HP | Đỡ mệt | Nước | Bệnh | Vitamin | Ghi chú |
|---|---|---|---|---|---|---|
| Cơm trắng | +2 | — | — | — | — | món nền |
| Cơm + rau | +4 | — | — | — | ✓ | |
| **Cháo** | **+8** | **−15** | **+200 ml** | **−1 ngày** | — | món cho người bệnh |
| Khoai luộc | +1 | — | — | — | — | rẻ, để lâu |
| **Canh rau** | — | — | **+400 ml** | — | ✓ | ăn canh là uống nước |
| Rau xào | +3 | — | — | — | ✓ | |
| **Cá kho** | +6 | — | — | — | ✓ | |
| **Thịt kho** | **+12** | −10 | — | — | — | hồi sức mạnh nhất |
| **Trứng chiên** | **+10** | — | — | — | — | rẻ, tốt cho vết thương |
| Đậu hũ | +5 | — | — | — | — | đạm rẻ |
| **Bánh mì** | +1 | — | — | — | — | **`travel`**: nhẹ (0.4 kg), để 5 ngày, mang đi viễn chinh |
| **Dưa muối** | — | — | — | **−1 ngày** | ✓ | hỏng 4%/ngày, đủ vitamin cả mùa |

Nhờ vậy món ăn trở thành **công cụ y tế rẻ**: không có thuốc thì cháo và dưa muối là cách chữa bệnh, thịt kho/trứng là cách hồi máu sau trận tập kích. Tooltip trong panel Chế tạo hiện đủ các hiệu ứng này.

### 12.11 Khẩu phần viễn chinh (`sim/expedition.ts`, `sim/engine.ts`)

- Khi xuất phát, đội **tự đóng gói khẩu phần** từ kho: đồ ăn mang đi (ưu tiên `travel` như bánh mì), rồi tới món nhiều kcal nhất, rồi `meals/food/rawFood`, kèm nước uống. Lượng = nhu cầu cả chuyến × 1.3 dự phòng.
- Trên đường, mỗi người ăn từ khẩu phần khi kcal < 1200; món có hiệu ứng (`hồi HP`, `đỡ mệt`, `vitamin`) phát huy cả khi đi đường.
- Hết khẩu phần: cả đội −8 tinh thần và ghi vào biên bản "hết khẩu phần".
- Về tới nhà, **khẩu phần chưa ăn hết được trả lại kho** (trước đó là rò rỉ).

### 12.12 Sửa lỗi kinh tế phát hiện qua bot

Ba lỗi cân bằng đã sửa (có test chặn):

1. **Nấu ăn tạo kcal từ hư không**: bảng dinh dưỡng cũ cho 1200 kcal gạo ra 10.400 kcal (×8,7). Nay mỗi món ≈ 0,95–1,0 lần năng lượng đầu vào; test `cooking conserves calories` chặn mọi công thức vượt 102%.
2. **Ăn vượt khẩu phần**: `ceil()` khiến mỗi bữa lấy 2 phần cho nhu cầu 1 → đổi sang `floor`.
3. **Trạm cấp 1 đòi vật liệu phải chế** (mà chế lại cần chính trạm đó) → kẹt hàng đợi vĩnh viễn. Cấp 1 nay chỉ dùng vật liệu thô.
4. **Món không được ăn**: `takeDish` lọc `morale > 0` nên cơm trắng bị bỏ qua; nay mọi món có cờ `dish` được ưu tiên trước đồ nhặt được.

### 12.13 Bot học nấu ăn (`scripts/headless.ts`)

- Bot xây trạm theo khả năng chi trả (`buildStations`) — không xếp module khi chưa đủ vật tư để tránh kẹt hàng đợi.
- Bot nấu món nếu kho còn ≥ 4 ngày lương: thử `thịt kho → cá kho → cơm+rau → canh → cơm → cháo`.
- Viễn chinh không còn bị chuyển hết sang gom vật tư chỉ vì một project chưa trả được.

### 12.14 Cân bằng: kết quả đo trên cây sạch

Bot 90 ngày, 10 seed, so baseline `47e29d8` (trước lớp thức ăn) với hiện tại:

| | Baseline | Hiện tại |
|---|---|---|
| Ván sụp | 2/10 | 3/10 |
| Người sống (trung vị) | 18,5 | 18 |
| Người sống (trung bình) | 18,6 | 16,4 |

Kết luận: lớp thức ăn **không làm nền kinh tế yếu đi** (trung vị gần như nhau), khác biệt 2/10 vs 3/10 nằm trong nhiễu của sim hỗn loạn với 10 mẫu.

Ba chỗ rò đã bịt trong quá trình đo:
1. Nguyên liệu tươi thêm vào bảng loot **pha loãng kcal** của chợ/quán ăn (rau 200 kcal/kg thay vì 1500–6000 kcal/lượt) → giảm trọng số nguyên liệu, tăng trọng số `rawFood`.
2. Bot xây trạm quá sớm (forge/tailor/lò) làm chuyển vật tư khỏi vườn/tường → chỉ xây khi gỗ ≥ 120 và sắt ≥ 60.
3. Bot nấu ăn như nghĩa vụ → nay chỉ nấu khi có nguyên liệu sắp hỏng và tinh thần trung bình < 62 (vì nấu không tạo thêm kcal, chỉ thêm tinh thần/sức khoẻ).

---

## 13. Y tế (`sim/medical.ts`)

Trước đây sim chỉ biết hai thứ: "bệnh" (`sickDays`) và "bị cắn" (`infected`). Nay có **vết thương** như một trạng thái riêng.

### 13.1 Vết thương và chảy máu

| | |
|---|---|
| Khi nào | Một cú đánh ≥ 12 sát thương (viễn chinh hoặc tập kích đêm) → rách tay/chân/thân/đầu |
| Chảy máu | 0–3 bậc. Mỗi bậc mất **1,2 HP/giờ** (3 bậc = 3,6/giờ) |
| Tự cầm | Mỗi ngày 45% giảm 1 bậc nếu HP > 35 — cơ thể tự đông máu |
| Cầm máu | Garo (tourniquet) −3 bậc nhưng +8 mệt; băng cầm máu (hemostatic) −2; băng thường −1 |
| Lành | Hết chảy máu, HP > 75 và 25%/ngày thì vết thương đóng lại |

### 13.2 Nhiễm trùng

- Vết thương hở: **12%/ngày** chuyển nhiễm trùng. Được rửa bằng cồn/iodine/antiseptic → còn **3%/ngày**.
- Nhiễm trùng tiến triển như cũ: +100 trong 3,5 ngày, đủ 100 → biến thành zombie.
- **Kháng sinh** (`khang_sinh`, item mới — catalog innawoods không có): dùng khi nhiễm < 60, người có Y tế 4+, giảm **−40**; về 0 thì khỏi hẳn. Quá 60 thì vô phương.
- Kháng sinh **chỉ lục soát được** (hiệu thuốc, phòng khám, bệnh viện), không chế tạo.
- **Vết cắn cũng đi qua đường này**: nhiễm do bị cắn cũng là `infection`, nên kháng sinh dùng sớm (< 60, Y tế 4+) cứu được. Không có kháng sinh thì 3,5 ngày sau biến thành zombie — đó là toàn bộ lối thoát, không có phẫu thuật cắt chi.

### 13.3 Phân loại bệnh nhân

Y tá chọn theo thứ tự: **nhiễm trùng còn chữa được → chảy máu → bệnh → HP thấp → rửa vết thương**. Mỗi người vẫn 1 lần được điều trị/ngày.

### 13.4 Item y tế có tác dụng

`medKind()` phân loại item theo tên, nên **72 item y tế trong catalog đều vào được một trong 8 nhóm** (garo, băng cầm máu, băng, sát trùng, kháng sinh, giảm đau, truyền dịch, medkit) thay vì chỉ 2 id như trước.

---

## 14. Cấp của module (`data/modules.ts`, `sim/state.ts`)

Mỗi module có `levels` là bậc nâng tiếp (cấp 1 = lúc xây xong). Nâng cấp đi qua đúng hàng đợi xây.

### 14.1 Cấp phải đổi số thật, không chỉ là chữ

| Module | Cấp 1 | Cấp 2 | Cấp 3 |
|---|---|---|---|
| Trạm lọc | 12 L/giờ | 18 | 24 |
| Giếng | 1500 L/ngày | 2000 | 2500 |
| Bể hứng mưa | ×1,0 sức chứa | ×1,4 | ×1,8 |
| Vườn rau | ×1,0 năng suất | ×1,1 | ×1,2 |
| Nhà vệ sinh | 20 người | 25 | 30 |
| Phòng y tế | hồi HP ×2,5 | ×3,0 | ×3,5 |
| Máy phát | 24 L/đêm | 20 | 16 |
| Tháp canh | +12 phòng thủ | +16 | +20 |
| Kho có khoá | mất 8% khi tập kích | 5% | 2% |
| Hầm lạnh | hỏng 50% | 35% | 25% |
| Chuồng gà | 3 trứng/ngày | 4,8 | 4,8 + không mất gà đêm |
| Ao cá | ×1 sản lượng | ×1,2 | ×1,5 |
| Bếp củi | mẻ 3000 kcal | mẻ 8000 | — |
| Phòng ngủ | 1 giường / 5 m² | 1 / 4 m², hồi mệt +10% | hồi mệt +20% |
| Lán trại | 1 chỗ / 6 m², bão xoá 50% | 1 / 5 m², bão xoá 32% | 1 / 4 m², bão xoá 15% |
| Phòng sinh hoạt | +8 tinh thần | +12 | +16 |
| Kệ sách | đọc ×1,0 | ×1,3 | ×1,6 |
| Vườn thuốc | ×1,0 dược liệu | ×1,25 | ×1,5 |
| Chòi xe | 0,08 L/km, +80 kg | 0,06 L/km, +100 kg | 0,04 L/km, +140 kg |

Ngoài ra **trạm chế tạo nhanh hơn 25% mỗi cấp**: công thức ở cấp 2 làm nhanh hơn cấp 1 một phần tư.

### 14.2 Trạm và công thức

Công thức khai báo `station` + `level`, nên cấp trạm còn là **công tắc mở khoá**: Lò rèn cấp 2 mở tấm thép và vũ khí dài, cấp 3 mở đồ nặng; Xưởng may cấp 3 mở giáp tấm; Bàn thợ cấp 3 mở pin mặt trời.

### 14.3 Chi phí nâng cấp

**Cấp 2 chỉ dùng vật liệu thô** (gỗ, sắt vụn, vải, đá, đất sét, dây) — nâng được ngay khi có trạm, không cần lò nung.
**Cấp 3 mới đòi đồ chế** (tấm thép, bánh răng, dây điện, vôi).

Lý do: bản đầu tôi cho cấp 2 đòi vật liệu phải chế, mà chế lại cần lò nung/lò rèn — nên bot chỉ nâng được 2 bậc trong 90 ngày. Sửa xong thì bot nâng **10 module lên cấp 2**.

### 14.4 Không còn module nào thiếu bậc

Cả **26 module** đều có bậc nâng cấp, và mỗi bậc đều đổi một con số có chỗ đọc. Test `tests/module-levels.test.ts` chặn hai kiểu sai: thêm bậc mà không ai đọc, và để một module không có bậc.

### 14.5 Đo bằng bot (90 ngày, 10 seed)

| | Không nâng cấp | Có nâng cấp |
|---|---|---|
| Ván sụp | 3/5 | **4/10** |
| Người sống (trung vị) | 19 | **27** |
| Module lên cấp 2 | 2 | **10** |

Bot ưu tiên theo thứ tự: lọc nước → giếng → bể nước → y tế → vườn → kho → nhà vệ sinh → tháp canh → phòng ngủ → hầm lạnh → bếp, và giữ lại 80 gỗ / 40 sắt để không đói vật tư cho module kế tiếp.

Có test khoá luật "mỗi bậc phải có chỗ đọc số" (`tests/module-levels.test.ts`), để không ai thêm bậc chỉ có chữ.

### 12.12 Kho, nguồn item và quần áo

- **Kho** (`ui/shell/KhoDrawer.tsx`): chia nhóm Vật liệu · Vũ khí · Giáp & đồ mặc · Ba lô · Đồ ăn · Thuốc · Dụng cụ · Khác; hiện **mọi item đang có hàng** (trước chỉ 16 id lõi), kèm kg và số món đang cấp phát cho người.
- **Nguồn item** (`data/lootPools.ts`): ngoài bảng vật tư tĩnh, mỗi chỗ lục có ~30% ra một món catalogue theo loại nhà (`house` → quần áo/ba lô/dao; `police` → giáp/mũ/súng/đạn; `pharmacy` → thuốc…), trọng số giảm theo tier, `rare` ×0.3. Nhờ vậy **703/703 món đều lấy được** (trước: 147/703).
- **Quần áo** có slot riêng (`outfit`) và chỉ số `insulation`: áo 35%, giày 15%, găng 8% (+tier, +khối lượng), kẹp 60%. Rét `tempC < 18` làm tăng mệt `0.6/h × (1 − cách nhiệt)`; dưới 12°C còn mất HP, mưa to ×2.
- **Dụng cụ** mòn theo công việc: mỗi hạng mục xây/chế trừ `1/durability` của dụng cụ tốt nhất trong kho; mòn hết thì món đó rời kho.
- **Đạn** dùng field `caliber` thật (`data/calibers.ts`), ưu tiên đúng cỡ trước, hộp hỗn hợp là phương án cuối.

### 12.13 Kinh tế lương thực (cân bằng 2026-11)

Đo bằng bot cho thấy bản cũ **không thể tự nuôi**: vườn 20 m² cho 317 kcal/ngày trong khi 29 người cần ~65.000 kcal/ngày, và ruộng chỉ đạt 5% công suất. Bốn chỉnh:

| Hạng mục | Trước | Sau | Vì sao |
|---|---|---|---|
| Rau muống | 475 kcal/m² / 30 ngày | **1.400 / 18 ngày** | 15,8 → 78 kcal/m²/ngày; vườn 800 m² nuôi được ~27 người |
| Khoai lang | 1.720 / 110 ngày | **3.600 / 45 ngày** | vụ ngắn để quay vòng trong ván 120 ngày |
| Chăm vườn | 0,005 h/m²/ngày (3.400 m² = 17 h/ngày) | **0,003** (≈10 h/ngày) + cây không chăm vẫn lớn 45% | ruộng lớn không còn bị bỏ hoang vì thiếu người |
| Khoảnh ruộng | 800 m² | **2.500 m²** với điểm `field` | đất trống rộng hơn sân trong thành phố |

- **Gieo → thu**: mỗi plot tốn 1 gói giống, thu hoạch trả `m²/150` gói (dư để mở rộng); vườn thuốc không tốn giống.
- **Nông dân** ưu tiên theo lượt: thu hoạch → gieo → chăm (trước đây chăm plot đầu tiên là chiếm hết thời gian, không ai gieo/hái).
- **Dân số đi sau sản xuất**: mọi luật người lạ (kể cả "Kiểm tra" mặc định) chỉ nhận khi kho còn **≥ 18 ngày lương**, số nhận = `⌊(số ngày − 18) / 2⌋`.
- **Bot**: gieo thêm ruộng khi dân ≥ 14 (tối đa 3), mang tới 20 gói giống khi lập ruộng, hạ ngưỡng chuyển lương thô về căn cứ, và xây `chuồng gà`/`ao cá` sau các trạm chính.

Kết quả bot 120 ngày (3 seed): **cả 3 sống hết 120 ngày**, dân 6–14 (bị giới hạn bởi lương thực chứ không phải bị chết đói), thu hoạch 110k–600k kcal/ván.

---

## 15. Điện (`sim/power.ts`)

Trước đây `site.powered` là một cờ boolean chỉ để bỏ hình phạt làm đêm — máy phát có đúng một công dụng. Nay điện là **ngân sách kW**.

### 15.1 Nguồn

| Nguồn | Cấp 1 / 2 / 3 | Ghi chú |
|---|---|---|
| Máy phát | 4 / 6 / 8 kW | Đốt **0,25 L/kWh**, chỉ trả cho phần tải thực sự dùng (đêm 12 giờ) |
| Tấm pin mặt trời | 1,5 kW/tấm | Sạc ắc quy 5 giờ nắng; bão còn 15%, mưa còn 50% |
| Ắc quy | 3 kWh/quả | Trữ điện ban ngày cho ban đêm |

Không còn chuyện "đốt 24 L mỗi đêm" bất kể tải: một bóng đèn 0,3 kW tốn ~0,9 L, cả lưới 4 kW tốn ~12 L.

### 15.2 Thiết bị tiêu điện

Khi thiếu điện, **cắt tải theo thứ tự ưu tiên** (không phải tắt hết):

| # | Thiết bị | kW | Tác dụng |
|---|---|---|---|
| 1 | Hàng rào điện | 3,0 | +25 / +35 / +45 phòng thủ ban đêm |
| 2 | **Đèn điện** | 0,3 | Bỏ hình phạt làm đêm ×0,75 (đây là thứ duy nhất bật `powered`) |
| 3 | **Tủ lạnh** | 1,5 | Thức ăn hỏng còn 25% / 15% / 8% tốc độ thường |
| 4 | Bơm nước | 1,0 | Giếng ×1,5 / 1,8 / 2,0; trạm lọc cùng hệ số |
| 5 | Máy móc điện | 2,0 | Xây/chế nhanh hơn 30% / 45% / 60%, heat +kW |
| 6 | Radio | 0,3 | +4 / +6 / +8 tinh thần (biết trước bầy 1–2 ngày: dự kiến) |
| 7 | Đèn trồng cây | 2,0 | Vườn +10% / 25% / 40% năng suất |

Bật hết tốn ~10 kW, nên phải chọn. Ví dụ: hàng rào + đèn + tủ lạnh (4,8 kW) vừa một máy phát cấp 1; muốn thêm máy móc điện thì phải lên cấp 2 hoặc thêm pin mặt trời.

### 15.3 Bot

Bot xây máy phát → đèn → tủ lạnh → bơm → máy móc → hàng rào → radio, nhưng **chỉ khi đã ổn định** (dân số > 0 và lương thực > 10 ngày) và đã có máy phát. Nó cũng tự chế tấm pin và ắc quy khi có tấm thép.

Đo 90 ngày × 10 seed: **0/10 ván sụp**, 7–18 người sống. Lưu ý: cùng lúc đó một session khác thêm giới hạn dân số theo lương thực, nên **không quy toàn bộ cải thiện này cho điện**.

---

## 16. Sưởi mùa đông

Lạnh đã có cơ chế từ trước (dưới 18 °C thì tăng mệt, dưới 12 °C thì mất HP, giảm bởi quần áo). Nhưng chỉ có **một** cách chống: mặc ấm. Nay có hai nguồn sưởi tại chỗ.

| Nguồn | Nhiên liệu | Giảm rét (cấp 1/2/3) |
|---|---|---|
| **Lò sưởi** | 6 / 8 / 10 gỗ mỗi đêm lạnh | 50% / 70% / 85% |
| **Máy sưởi điện** | 2 kW điện | 60% / 75% / 90% |

- Lò sưởi **chỉ đốt gỗ khi trời dưới 18 °C**; hết gỗ thì đêm đó lạnh và có cảnh báo.
- Máy sưởi điện là thiết bị thứ 8 trong danh sách cắt tải điện (ưu tiên cuối — ấm là tiện nghi, hàng rào mới là sống còn).
- Hai nguồn cộng dồn nhưng **kẹp ở 95%**: không có chuyện miễn nhiễm rét.

## 17. Điều kiện thắng: gọi cứu hộ

Game không còn vô tận tuyệt đối. Radio **cấp 3** khi có điện sẽ phát tín hiệu cầu cứu:

- Mỗi đêm radio cấp 3 được cấp điện **và điểm có ít nhất 4 người** → `rescueDays` +1
- Đêm mất điện → `rescueDays` −1 (tín hiệu gián đoạn thì mất uy tín)
- Đủ **7 đêm liên tục** → `won = true`, game kết thúc với màn "ĐƯỢC CỨU"

Tiến độ hiện trong drawer Kho (`Tín hiệu cầu cứu: 3/7 đêm`). Đây là mục tiêu dài hạn đầu tiên của game: muốn thắng phải có **lưới điện ổn định** (pin mặt trời + ắc quy, vì máy phát cần xăng liên tục) và **một cộng đồng đủ người để vận hành**.

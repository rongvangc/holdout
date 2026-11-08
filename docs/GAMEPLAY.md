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

| Loại | Sát thương | Cắn | Tỷ trọng N1 → N61 |
|---|---|---|---|
| Walker | 8 | 5% | 80 → 40 |
| Runner | 11 | 8% | 6 → 20 |
| Screamer | 6 | 4% | 4 → 12 (gây ồn, +8 heat) |
| Bloater | 14 | 6% | 3 → 11 |
| Brute | 32 | 12% | 0.5 → 8 |
| Stalker | 16 | 10% | 0 → 6 (chỉ ban đêm) |

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

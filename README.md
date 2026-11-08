# HOLDOUT

Game quản lý sinh tồn zombie dạng text/bản đồ, chạy trên trình duyệt. Thế giới dựng từ dữ liệu OpenStreetMap thật quanh vị trí người chơi chọn. Người chơi là người quản lý một cộng đồng (5 → 20+ người): phân việc, xây căn cứ, lục soát, chiếm thêm đất, đặt luật. Chơi vô tận — sống càng lâu càng tốt.

Cơ chế chi tiết: [docs/GAMEPLAY.md](docs/GAMEPLAY.md).

## Chạy

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc + vite build → dist/
npm test             # vitest
npm run typecheck
```

Công cụ dòng lệnh (không cần trình duyệt):

```bash
# Mô phỏng N ngày bằng bot tự chơi trên thành phố mô phỏng
npx vite-node scripts/sim.ts -- <days> <seed> [logLines] [nofield]

# Kiểm tra dữ liệu OSM thật tại một điểm
npx vite-node scripts/osm-check.ts -- <lat> <lon> <radius>
```

## Công nghệ

- TypeScript, React 19, Vite
- maplibre-gl (bản đồ nền OpenFreeMap, fallback positron → style trống)
- Overpass API (dữ liệu OSM), chạy trong Web Worker
- h3-js (lưới lục giác res 9 cho mật độ/nguy hiểm)
- idb-keyval (IndexedDB: cache thế giới + save game)
- vitest, vite-node

Không có backend. Mọi thứ chạy và lưu trên máy người chơi.

## Cấu trúc

```
src/
  core/       rng (mulberry32, seed được), time, eventQueue (min-heap)
  world/      tải OSM → World: toà nhà, đường (A*), nguồn nước, đất xanh, ô H3
    overpass.ts   truy vấn + làm tròn toạ độ 0.005° trước khi gửi (riêng tư)
    synthetic.ts  thành phố mô phỏng offline (id ổn định khi mở rộng)
    generate.ts   phân loại toà nhà, số "chỗ lục", mật độ dân → nguy hiểm
    loader.ts     cache IndexedDB theo key v2:{osm|syn}:{lat},{lon}:{radius}
  data/       bảng số: vật phẩm, loại toà nhà + loot, module, công trình
  base/       interior.ts: chia phòng (BSP) trong footprint thật + sân
  sim/        lõi mô phỏng (thuần, không phụ thuộc UI)
    engine.ts     advanceTo(): tích phân chỉ số giữa các sự kiện
    tasks.ts      AI từng người: chọn việc theo nhu cầu → vai trò
    daily.ts      sự kiện mỗi ngày: thời tiết, hư hỏng, bệnh, tinh thần, tập kích
    expedition.ts lục soát / lấy nước / chiếm / vận chuyển / đi tuần / tuyến
    build.ts      hàng đợi xây, gia cố, rào
    design.ts     tự vẽ phòng, gộp/tách, công trình ngoài trời
    commute.ts    ngủ một nơi, làm việc nơi khác
    lifecycle.ts  chết, nhiễm, cách ly, người lạ, bỏ trốn
    state.ts      GameState, site, kho, baseStats, autoAssign, migrate
  ui/         React: Picker (chọn khu + căn cứ), Game, BaseView, PeopleView,
              MapView, LawsView, save.ts
scripts/      sim.ts, headless.ts (bot), osm-check.ts
tests/        world, sim, sites, territory, design
```

### Mô hình mô phỏng

- **Discrete-event**: hàng đợi sự kiện (`task`, `day`, `raid`, `strangers`, `routes`, `exp`). Giữa hai sự kiện, kcal/nước/mệt/HP/nhiễm trùng được tích phân liên tục, nên tua 240× vẫn cho kết quả giống 1×.
- **Tất định**: RNG có seed nằm trong state. Toàn bộ `GameState` serialize được JSON.
- **Save**: IndexedDB key `last30days:save` (giữ tên cũ để không mất save), tự lưu mỗi khi sang ngày mới, khi bấm Lưu/Thoát, khi mở rộng bản đồ. Save cũ (v1, một căn cứ) được `migrate()` lên v2 (nhiều điểm).
- **Thế giới không nằm trong save**: chỉ lưu `worldKey`, khi load sẽ lấy lại từ cache/Overpass. Site tham chiếu toà nhà/đất bằng id OSM ổn định, nên khi mở rộng bản đồ `rebindWorld()` gắn lại được.

## Dữ liệu & bản quyền

Dữ liệu bản đồ © OpenStreetMap contributors (ODbL). Bản đồ nền: OpenFreeMap.

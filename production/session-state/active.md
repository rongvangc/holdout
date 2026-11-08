# Session state

- **Task**: UX specs cho game — Căn cứ và HUD
- **Status**: Cả hai file đã có bản nháp đầy đủ, chờ review
- **Files**:
  - `design/ux/base.md` — 443 dòng, Section A→I + Open Questions
  - `design/ux/hud.md` — 305 dòng, 13 section theo skeleton HUD
- **Mode**: UX Spec + HUD Design · **Density**: balanced · **Automation**: collaborative
- **Input methods**: chuột + bàn phím + cảm ứng (web, responsive)
- **Bulk approval**: user approved A, B, B2, B3 of `base.md`, then asked to write
  everything remaining for review afterwards.
- **Cross-reference check (2026-11-08)**: chạy đủ 5 bước.
  - Mâu thuẫn phát hiện: `base.md` Z1 ghi 6 ô, `hud.md` H1 giới hạn 5 ô → đã sửa
    `base.md` cho khớp, và thêm ghi chú cross-link ở đầu cả hai file.
  - Thiếu: item 2 (thời tiết) chưa nằm trong bảng phân loại của `hud.md` → đã thêm.
- **Next**: `/ccgs-ux-review` không chạy được (không có `.claude/`). Gợi ý thay thế:
  review thủ công 3 điểm đã đánh dấu trong `hud.md` Open Questions, rồi mới code đợt 1
  của lộ trình trong `docs/ux/UI-AUDIT.md`.
- **Note**: chạy không studio — thiếu `.claude/`, `project.yaml`, `design/gdd/*`,
  player journey, art bible, pattern library, accessibility requirements.
  Yêu cầu thay bằng `docs/GAMEPLAY.md` §1–§18 + `src/sim/types.ts`.

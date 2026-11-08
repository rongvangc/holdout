/**
 * Temporary feature switches.
 *
 * These are deliberate off-switches, not dead code: the feature stays implemented
 * and tested, but does not run in a normal game until someone flips it back.
 */
export const FEATURES = {
  /**
   * Calling rescue with a level-3 radio and winning the run.
   * Off for now: the game is meant to be endless until the win path is balanced.
   */
  rescue: false,
  /**
   * Living hordes: bầy zombie trườn trên bản đồ + tập kích bầy theo giai đoạn.
   * Bật cho theo design 2026-11-08; tắt nếu cân bằng gãy bot 60 ngày.
   */
  hordes: true,
};

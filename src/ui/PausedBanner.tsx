/**
 * Why the clock stopped.
 *
 * The game pauses itself on a bad event — a raid, a death, a bite. That is right,
 * but the only sign was the toast, which clears after a few seconds, and the HUD
 * speed buttons going quiet. A soak test sat looking at a frozen screen for 100
 * seconds without noticing. This banner stays until the player resumes.
 */
export function PausedBanner({ reason, onResume }: { reason: string; onResume: () => void }) {
  return (
    <div className="paused-banner" role="status" aria-live="assertive">
      <span className="paused-dot" aria-hidden="true" />
      <span className="grow">
        <b>Tạm dừng.</b> {reason}
      </span>
      <button className="primary" onClick={onResume}>
        Chạy tiếp
      </button>
    </div>
  );
}

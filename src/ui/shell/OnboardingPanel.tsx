import { useState } from 'react';
import { firstDayGoals } from '../onboarding';
import type { GameState, Site } from '../../sim/types';

const KEY = 'holdout:onboarded';

/** Bảng mục tiêu 7 ngày đầu. Tự biến mất khi xong hoặc sau ngày 10. */
export function OnboardingPanel({ s, site }: { s: GameState; site: Site }) {
  const [open, setOpen] = useState(() => {
    try {
      return globalThis.localStorage?.getItem(KEY) !== '1';
    } catch {
      return true;
    }
  });
  // Trên điện thoại, cả danh sách chiếm 35% màn hình — chỉ hiện mục kế tiếp.
  const [expanded, setExpanded] = useState(false);
  const goals = firstDayGoals(s, site);
  const done = goals.filter((g) => g.done).length;
  const next = goals.find((g) => !g.done);
  if (!open || !goals.length) return null;
  const shown = expanded ? goals : next ? [next] : [];

  return (
    <div className="onboarding" role="note">
      <div className="onboarding-head">
        <span className="label">Bắt đầu · {done}/{goals.length}</span>
        <div className="grow" />
        <button className="mini" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Gọn' : 'Tất cả'}
        </button>
        <button
          className="mini"
          onClick={() => {
            setOpen(false);
            try {
              globalThis.localStorage?.setItem(KEY, '1');
            } catch {
              /* private mode */
            }
          }}
        >
          Ẩn
        </button>
      </div>
      <div className="onboarding-rows">
        {shown.map((g) => (
          <div key={g.id} className={`goal ${g.done ? 'done' : ''}`} title={g.why}>
            <i>{g.done ? '✔' : '□'}</i>
            <span className="goal-text">
              {g.text}
              <small>{g.why}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

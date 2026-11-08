import type { GameState, Site } from '../sim/types';
import { StatusIcon } from './icons';
import { readouts, siteChips } from './readout';

/** Thanh readout: 5 gauge (icon + số + bar) + 3 chip trạng thái điểm. */
export function ReadoutBar({ s, site }: { s: GameState; site: Site }) {
  return (
    <div className="readout">
      {readouts(s, site).map((r) => (
        <div key={r.id} className={`gauge tone-${r.tone}`} title={r.hint}>
          <StatusIcon name={r.icon} size={18} />
          <span className="rtext">{r.text}</span>
          {r.ratio !== null && (
            <div className="bar">
              <div className="fill" style={{ width: `${Math.round(r.ratio * 100)}%` }} />
            </div>
          )}
        </div>
      ))}
      <div className="chips">
        {siteChips(s, site).map((c) => (
          <div key={c.id} className={`chip tone-${c.tone}`} title={c.hint}>
            <StatusIcon name={c.icon} size={14} />
            <span>{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

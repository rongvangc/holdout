import { dayOf } from '../core/time';
import { LAW_COOLDOWN_DAYS, LAW_DEFS, type LawId, type Laws } from '../sim/data';
import { setLaw } from '../sim/engine';
import type { ViewProps } from './Game';
import { useState } from 'react';

export function LawsView({ s, refresh }: ViewProps) {
  const [err, setErr] = useState('');
  const day = dayOf(s.t);
  return (
    <div>
      <div style={{ padding: '16px 16px 0' }} className="dim">
        Luật là cách điều hành 20+ người mà không phải quản từng người. Mỗi luật chỉ đổi được {LAW_COOLDOWN_DAYS} ngày một lần.
        {err && <div className="red">{err}</div>}
      </div>
      <div className="laws">
        {LAW_DEFS.map((def) => {
          const last = s.lawChangedDay[def.id];
          const wait = last !== undefined ? Math.max(0, LAW_COOLDOWN_DAYS - (day - last)) : 0;
          return (
            <div key={def.id} className="card col">
              <div className="row">
                <b className="grow">{def.label}</b>
                {wait > 0 && <span className="faint">khoá {wait} ngày</span>}
              </div>
              {def.options.map((o) => {
                const on = s.laws[def.id] === o.value;
                return (
                  <button
                    key={String(o.value)}
                    className={on ? 'on' : ''}
                    disabled={!on && wait > 0}
                    style={{ textAlign: 'left' }}
                    onClick={() => {
                      setErr(setLaw(s, def.id as LawId, o.value as Laws[LawId]) ?? '');
                      refresh();
                    }}
                  >
                    {o.label}
                    {o.desc && <div className={on ? '' : 'faint'}>{o.desc}</div>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

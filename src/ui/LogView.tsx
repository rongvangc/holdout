import { useState } from 'react';
import { dayOf, fmtClock } from '../core/time';
import { ITEMS, type ItemId } from '../data/items';
import type { LogEntry, StockDelta } from '../sim/types';
import type { ViewProps } from './Game';
import { Icon, ITEM_ICONS } from './icons';

type Level = LogEntry['level'];
type Filter = Level | 'all';

const LEVEL_LABEL: Record<Level, string> = {
  info: 'Ghi chú',
  good: 'Tốt',
  warn: 'Cảnh báo',
  bad: 'Nguy cấp',
};

const FILTERS: [Filter, string][] = [
  ['all', 'Tất cả'],
  ['bad', 'Nguy cấp'],
  ['warn', 'Cảnh báo'],
  ['good', 'Tốt'],
  ['info', 'Ghi chú'],
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtAmt = (v: number) => (v >= 100 ? Math.round(v).toLocaleString('vi') : v.toFixed(1));

/** Icon chips for materials gained/lost with an entry. */
function ItemChips({ items }: { items: StockDelta }) {
  const list = Object.entries(items).filter(([, v]) => (v ?? 0) >= 0.5);
  if (!list.length) return null;
  return (
    <span className="logitems">
      {list.map(([k, v]) => {
        const id = k as ItemId;
        return (
          <span key={k} className="logitem" title={`${ITEMS[id].label} ${fmtAmt(v ?? 0)} ${ITEMS[id].unit}`}>
            <Icon src={ITEM_ICONS[id]} size={16} />
            <b>{fmtAmt(v ?? 0)}</b>
            <span className="faint">{ITEMS[id].unit}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Day roll-call line — becomes the day header instead of a plain entry. */
const isDayLine = (e: LogEntry) => e.msg.startsWith('— Ngày');

export function LogView({ s }: ViewProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const counts: Record<Filter, number> = { all: s.log.length, info: 0, good: 0, warn: 0, bad: 0 };
  for (const e of s.log) counts[e.level]++;

  const summary = new Map<number, string>();
  for (const e of s.log) {
    if (isDayLine(e)) summary.set(dayOf(e.t), e.msg.replace(/^— Ngày \d+ · /, '').replace(/ —$/, ''));
  }

  const groups: { day: number; entries: LogEntry[] }[] = [];
  for (let i = s.log.length - 1; i >= 0; i--) {
    const e = s.log[i];
    if (isDayLine(e)) continue;
    if (filter !== 'all' && e.level !== filter) continue;
    if (query && !e.msg.toLowerCase().includes(query)) continue;
    const day = dayOf(e.t);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.entries.push(e);
    else groups.push({ day, entries: [e] });
  }

  return (
    <div className="logview">
      <div className="logbar">
        <input className="grow" placeholder="Tìm trong nhật ký…" value={q} onChange={(e) => setQ(e.target.value)} />
        {FILTERS.map(([f, l]) => (
          <button key={f} className={`${filter === f ? 'on ' : ''}${f === 'all' ? '' : `lv-${f}`}`} onClick={() => setFilter(f)}>
            {l} · {counts[f]}
          </button>
        ))}
      </div>
      <div className="loglist">
        {!groups.length && (
          <div className="dim" style={{ padding: 16 }}>
            Không có mục nhật ký nào khớp bộ lọc.
          </div>
        )}
        {groups.map((g) => {
          const warns = g.entries.filter((e) => e.level === 'warn').length;
          const bads = g.entries.filter((e) => e.level === 'bad').length;
          return (
            <div key={g.day} className="logday">
              <div className="logday-head">
                <span className="ld">NGÀY {g.day}</span>
                {summary.get(g.day) && <span className="dim">{summary.get(g.day)}</span>}
                <span className="grow" />
                <span className="faint">{g.entries.length} mục</span>
                {warns > 0 && <span className="amber">{warns} cảnh báo</span>}
                {bads > 0 && <span className="red">{bads} nguy cấp</span>}
              </div>
              {g.entries.map((e, i) => (
                <div key={i} className={`logentry ${e.level}`} title={`Ngày ${dayOf(e.t)} · ${fmtClock(e.t)}:${pad2(Math.floor(e.t) % 60)}`}>
                  <span className="lt">{fmtClock(e.t)}</span>
                  <span className="ll">{LEVEL_LABEL[e.level]}</span>
                  <span className="lm">
                    {e.msg}
                    {e.items && <ItemChips items={e.items} />}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

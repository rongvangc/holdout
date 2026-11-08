import { ITEMS, type ItemId } from '../data/items';
import { fmtDuration } from '../core/time';
import { ammoFor, conditionOf } from '../sim/equipment';
import { queueRepair, repairableWeapons, stationLevel } from '../sim/build';
import type { PanelProps } from './KitchenPanel';
import { Icon, ITEM_ICONS, MODULE_ICONS } from './icons';

/**
 * Loadout board: what the community can actually put in someone's hands.
 * The sim auto-issues the best item from stock, so the question a player needs
 * answered is "do I have it, is it worn, and does the gun have cartridges" —
 * which used to mean reading the stock list and knowing the calibre rules.
 */
export function GearPanel({ s, site, refresh }: PanelProps) {
  const weapons = Object.entries(ITEMS)
    .filter(([id, d]) => (site.stock[id] ?? 0) >= 0.5 && (d.mechanic ?? '').startsWith('weapon_'))
    .sort(([, a], [, b]) => (b.mitigation ?? 0) - (a.mitigation ?? 0));

  const armour = Object.entries(ITEMS).filter(
    ([id, d]) => (site.stock[id] ?? 0) >= 0.5 && ['armor_soft', 'armor_plate', 'helmet', 'mask', 'vest'].includes(d.mechanic ?? ''),
  );
  const worn = repairableWeapons(site);
  void s;
  const forgeLvl = stationLevel(site, 'forge');

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="label">Vũ khí trong kho ({weapons.length})</div>
      {!weapons.length && <div className="faint">Chưa có vũ khí nào. Chế ở Lò rèn, hoặc nhặt khi lục soát.</div>}
      <div className="col" style={{ gap: 3 }}>
        {weapons.map(([id, def]) => {
          const n = site.stock[id] ?? 0;
          const cond = conditionOf(site, id);
          const ammo = def.mechanic === 'firearm' ? ammoFor(id) : null;
          const ammoN = ammo ? (site.stock[ammo] ?? 0) : null;
          return (
            <div key={id} className="row" style={{ gap: 6, alignItems: 'baseline' }}>
              <Icon src={ITEM_ICONS[id] ?? MODULE_ICONS.forge} size={18} />
              <span style={{ minWidth: 120 }}>{def.label}</span>
              <span className="faint" style={{ minWidth: 40 }}>×{Math.round(n)}</span>
              <span className="dim" style={{ minWidth: 84 }}>
                −{Math.round((def.mitigation ?? 0) * 100)}% sát thương
              </span>
              <span className={cond < 0.5 ? 'amber' : 'faint'} style={{ minWidth: 66 }}>
                bền {Math.round(cond * 100)}%
              </span>
              {def.mechanic === 'firearm' ? (
                <span className={ammoN && ammoN > 0 ? 'ok' : 'red'} style={{ minWidth: 108 }}>
                  {ammo ? `${ITEMS[ammo]?.label ?? ammo}: ${Math.round(ammoN ?? 0)}` : 'không rõ cỡ đạn'}
                </span>
              ) : (
                <span className="faint" style={{ minWidth: 108 }}>{def.biteMult && def.biteMult < 1 ? 'có tầm, khó bị cắn' : ''}</span>
              )}
              <span className="dim grow" style={{ flex: 1 }}>{def.desc ?? ''}</span>
            </div>
          );
        })}
      </div>

      <div className="label">Giáp đang có</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {!armour.length && <span className="faint">Không có giáp. Xưởng may làm được giáp vải.</span>}
        {armour.map(([id, def]) => (
          <span key={id} className="tag" title={`${def.label} · giảm ${Math.round((def.mitigation ?? 0) * 100)}%`}>
            {def.label} ×{Math.round(site.stock[id] ?? 0)}
          </span>
        ))}
      </div>

      {worn.length > 0 && (
        <>
          <div className="label">Cần sửa ({worn.length})</div>
          <div className="col" style={{ gap: 3 }}>
            {worn.map((w) => (
              <div key={w.id} className="row" style={{ gap: 6 }}>
                <span style={{ minWidth: 130 }}>{ITEMS[w.id]?.label ?? w.id}</span>
                <span className="amber">mòn {Math.round((1 - w.condition) * 100)}%</span>
                <button
                  disabled={forgeLvl < 2}
                  title={forgeLvl < 2 ? 'Cần Lò rèn cấp 2' : `Sửa ${fmtDuration(1800)}`}
                  onClick={() => {
                    queueRepair(s, site, w.id as ItemId);
                    refresh();
                  }}
                >
                  Sửa
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {!worn.length && <div className="faint">Không có món nào mòn đáng sửa.</div>}
    </div>
  );
}

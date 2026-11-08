import { DISHES, INGREDIENTS } from '../data/dishes';
import { MODULES } from '../data/modules';
import { RECIPES } from '../data/recipes';
import { fmtDuration } from '../core/time';
import { queueCraft, stationLevel } from '../sim/build';
import { foodFxLabel } from '../sim/diet';
import { canAfford } from '../sim/state';
import type { GameState, Site } from '../sim/types';
import { Icon, ITEM_ICONS } from './icons';

/**
 * The kitchen board: what the community can cook, what it does for the eater,
 * and what is already sitting in the pot. Without this the 12 dishes and their
 * effects were only visible by hovering a craft row.
 */
export interface PanelProps {
  s: GameState;
  site: Site;
  refresh: () => void;
}

export function KitchenPanel({ s, site, refresh }: PanelProps) {
  const dishes = Object.entries(DISHES).map(([id, def]) => {
    const recipe = RECIPES.find((r) => r.out === id);
    const stock = site.stock[id] ?? 0;
    const lvl = recipe ? stationLevel(site, recipe.station) : 0;
    const unlocked = !!recipe && lvl >= recipe.level;
    const afford = !!recipe && canAfford(site, Object.fromEntries(recipe.in));
    return { id, def, recipe, stock, unlocked, afford, level: recipe?.level ?? 1, station: recipe?.station };
  });

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="label">Nguyên liệu tươi</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {Object.entries(INGREDIENTS).map(([id, def]) => {
          const n = site.stock[id] ?? 0;
          return (
            <span key={id} className={`tag ${n < 0.5 ? 'faint' : ''}`} title={def.desc}>
              {def.label} {Math.round(n * 10) / 10} {def.unit}
            </span>
          );
        })}
      </div>

      <div className="label">Món ăn</div>
      <div className="col" style={{ gap: 3 }}>
        {dishes.map(({ id, def, recipe, stock, unlocked, afford, level }) => {
          const fx = foodFxLabel(def.fx);
          return (
            <div key={id} className="row" style={{ gap: 6, alignItems: 'baseline' }}>
              <Icon src={ITEM_ICONS[id] ?? ITEM_ICONS.meals} size={18} />
              <span style={{ minWidth: 110 }}>{def.label}</span>
              <span className="faint" style={{ minWidth: 78 }}>{Math.round(def.kcal ?? 0)} kcal</span>
              <span className={(def.morale ?? 0) > 0 ? 'ok' : 'faint'} style={{ minWidth: 52 }}>
                {(def.morale ?? 0) > 0 ? `+${def.morale} TT` : '—'}
              </span>
              <span className="dim grow" style={{ flex: 1 }}>{fx || def.desc}</span>
              <span className={stock > 0.5 ? '' : 'faint'} style={{ minWidth: 34 }}>
                {Math.round(stock)} phần
              </span>
              {recipe ? (
                <button
                  disabled={!unlocked || !afford}
                  title={
                    !unlocked
                      ? `Cần ${MODULES[recipe.station].label} cấp ${level} (đang cấp ${stationLevel(site, recipe.station)})`
                      : afford
                        ? `Nấu ${fmtDuration(recipe.workSec)}`
                        : 'Thiếu nguyên liệu'
                  }
                  onClick={() => {
                    queueCraft(s, site, recipe.id);
                    refresh();
                  }}
                >
                  {unlocked ? 'Nấu' : `Cần cấp ${level}`}
                </button>
              ) : (
                <span className="faint">—</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="faint">
        Món có tinh thần cao được ăn trước; ăn cùng một món 9 bữa liền thì cả điểm chán (−3 tinh thần/ngày).
      </div>
    </div>
  );
}

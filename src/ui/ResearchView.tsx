import { useState } from 'react';
import { TECH_BRANCH_LABEL, TECHS, type TechBranch } from '../data/research';
import { RECIPE_BY_ID } from '../data/recipes';
import { ITEMS } from '../data/items';
import { FACTION_BY_ID } from '../data/factions';
import { abandonResearch, canStart, isTechDone, researchView, startResearch } from '../sim/research';
import { acceptOffer, caravans, markupFor, sendAway } from '../sim/npc';
import { present } from '../sim/state';
import { dayOf } from '../core/time';
import type { ViewProps } from './Game';

/**
 * Nghiên cứu + đoàn buôn.
 *
 * Nghiên cứu là "biết làm", không phải "xây to hơn": mỗi đề tài tốn ngày công của
 * người vai Nghiên cứu và sách nhặt được, và mở ra công thức mà vật tư không mua được.
 * Panel này phải nói rõ ba thứ người chơi cần quyết: **còn thiếu gì** (sách, kệ, người),
 * **mở ra cái gì**, và **có nên làm không** (nhánh nào trước).
 */
const ORDER: TechBranch[] = ['farm', 'med', 'eng'];

export function ResearchView({ s, site, refresh }: ViewProps) {
  const view = researchView(s, site);
  const here = present(s, site).length;
  const books = (id: string) => ITEMS[id]?.label ?? id;
  const car = caravans(s);

  // Lỗi hiện ngay trong trang: hộp thoại của trình duyệt chặn cả game, không style
  // được, và trên điện thoại thì đẩy người chơi ra khỏi ngữ cảnh.
  const [err, setErr] = useState('');
  const act = (fn: () => string | null) => {
    setErr(fn() ?? '');
    refresh();
  };

  return (
    <div className="col" style={{ gap: 10, padding: 10, overflow: 'auto' }}>
      {err && (
        <div className="red" role="alert">
          {err}
        </div>
      )}
      <div className="card col" style={{ gap: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="label">Kệ sách &amp; sách</div>
          <div className="dim">
            sách trong kho: <b>{view.books}</b> · kệ sách cấp <b>{view.bookshelf}</b> · người đang đọc:{' '}
            <b className={view.workers ? 'ok' : 'red'}>{view.workers}</b>
          </div>
        </div>
        {view.tech ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                Đang làm: <b>{view.tech.label}</b> <span className="dim">— {view.tech.desc}</span>
              </div>
              <div className="dim">{Math.floor(view.progress * 100)}%</div>
            </div>
            <div className="progress">
              <div className="meter" style={{ width: `${Math.min(100, view.progress * 100)}%` }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button onClick={() => act(() => (abandonResearch(s), null))}>Bỏ đề tài</button>
              {view.workers === 0 && (
                <span className="red">
                  Chưa ai đọc: sang tab Người, gán một người vai <b>Nghiên cứu</b>.
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="dim">
            Chưa có đề tài nào. Chọn một đề tài bên dưới — cần 1 người vai Nghiên cứu mỗi ngày để có tiến độ.
          </div>
        )}
        {here === 0 && <div className="red">Không có ai ở điểm này.</div>}
      </div>

      {ORDER.map((branch) => (
        <div key={branch} className="col" style={{ gap: 4 }}>
          <div className="label">{TECH_BRANCH_LABEL[branch]}</div>
          {TECHS.filter((t) => t.branch === branch).map((t) => {
            const done = isTechDone(s, t.id);
            const current = s.research?.tech === t.id;
            const why = done || current ? null : canStart(s, site, t.id);
            return (
              <div
                key={t.id}
                className="card row"
                style={{ gap: 8, alignItems: 'flex-start', justifyContent: 'space-between', opacity: done ? 0.75 : 1 }}
              >
                <div className="col" style={{ gap: 2 }}>
                  <div>
                    <b>{t.label}</b>{' '}
                    <span className="dim">
                      {t.days} ngày · {t.books} sách
                      {t.req ? ` · sau "${TECHS.find((x) => x.id === t.req)?.label ?? t.req}"` : ''}
                    </span>
                  </div>
                  <div className="dim">{t.desc}</div>
                  {t.unlocks.length > 0 && (
                    <div className="dim">
                      Mở khoá: {t.unlocks.slice(0, 4).map((r) => RECIPE_BY_ID[r]?.out ? books(RECIPE_BY_ID[r]!.out) : r).join(', ')}
                      {t.unlocks.length > 4 ? ` +${t.unlocks.length - 4}` : ''}
                    </div>
                  )}
                  {t.passive && <div className="ok">{t.passive.label}</div>}
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  {done ? (
                    <span className="ok">✔ xong</span>
                  ) : current ? (
                    <span className="amber">đang làm</span>
                  ) : (
                    <button disabled={!!why || !!s.research} title={why ?? 'Bắt đầu'} onClick={() => act(() => startResearch(s, site, t.id))}>
                      Nghiên cứu
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="label">Đoàn buôn ở cổng</div>
      {car.length === 0 ? (
        <div className="dim">Không có ai. Các nhóm buôn ghé bất chợt — nghe tiếng còi ở cổng là biết.</div>
      ) : (
        car.map((c) => {
          const f = FACTION_BY_ID[c.faction];
          return (
            <div key={c.id} className="card col" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <b>{f?.label ?? c.faction}</b> <span className="dim">{f?.desc}</span>
                </div>
                <div className="dim">
                  ở tới hết ngày {c.leaveDay} (hôm nay {dayOf(s.t)}) · phụ phí ×{markupFor(s, c.faction).toFixed(2)}
                </div>
              </div>
              {c.offers.length === 0 && <div className="dim">Đã đổi hết hàng.</div>}
              {c.offers.map((o) => (
                <div key={o.id} className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span className="dim">Mình đưa</span>{' '}
                    {o.take.map(([id, n]) => `${books(id)} ×${n}`).join(' + ')}{' '}
                    <span className="dim">→ nhận</span>{' '}
                    <b>{o.give.map(([id, n]) => `${books(id)} ×${n}`).join(' + ')}</b>
                  </div>
                  <button onClick={() => act(() => acceptOffer(s, site, c.id, o.id))}>Đổi</button>
                </div>
              ))}
              <div>
                <button onClick={() => act(() => (sendAway(s, c.id), null))}>Đuổi về</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

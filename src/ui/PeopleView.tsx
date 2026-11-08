import { useState } from 'react';
import { fmtDuration } from '../core/time';
import { ROLES, SKILLS, TRAITS, type Role, type SkillId } from '../sim/data';
import { setRole, setStudy } from '../sim/engine';
import { setCommute } from '../sim/commute';
import { autoAssign, baseStats } from '../sim/state';
import { skill } from '../sim/survivors';
import type { Survivor, TaskKind } from '../sim/types';
import type { ViewProps } from './Game';

const TASK_LABEL: Record<TaskKind, string> = {
  sleep: 'Ngủ',
  eat: 'Ăn',
  drink: 'Uống',
  rest: 'Nghỉ',
  leisure: 'Nghỉ ngơi',
  read: 'Đọc sách',
  build: 'Xây',
  cook: 'Nấu ăn',
  boil: 'Đun nước',
  filter: 'Lọc nước',
  draw: 'Kéo nước giếng',
  plant: 'Gieo hạt',
  tend: 'Chăm vườn',
  harvest: 'Thu hoạch',
  guard: 'Gác',
  treat: 'Chữa trị',
  clean: 'Dọn dẹp',
  corpses: 'Xử lý xác',
  gather: 'Kiếm củi/sắt',
  expedition: 'Viễn chinh',
  quarantine: 'Cách ly',
  commute: 'Đang đi đường',
};

function Bar({ v, max = 100, color = '#e6e6e3', title }: { v: number; max?: number; color?: string; title: string }) {
  const p = Math.max(0, Math.min(1, v / max));
  return (
    <span className="bar" title={`${title}: ${Math.round(v)}`}>
      <i style={{ width: `${p * 100}%`, background: p < 0.25 ? '#ff2a2a' : color }} />
    </span>
  );
}

function topSkills(v: Survivor): [SkillId, number][] {
  return (Object.keys(SKILLS) as SkillId[])
    .map((k) => [k, skill(v, k)] as [SkillId, number])
    .filter(([, l]) => l > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
}

export function PeopleView({ s, world, site, refresh }: ViewProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [onlyHere, setOnlyHere] = useState(false);
  const people = s.survivors.filter((v) => v.status === 'alive' && (!onlyHere || v.siteId === site.id));
  const siteName = (id: string) => s.sites.find((x) => x.id === id)?.name ?? '?';
  const lost = s.survivors.filter((v) => v.status !== 'alive');
  const counts: Partial<Record<Role, number>> = {};
  for (const v of people) counts[v.role] = (counts[v.role] ?? 0) + 1;
  const v = people.find((x) => x.id === sel);

  return (
    <div style={{ padding: 12 }} className="col">
      <div className="row">
        <button
          className="primary"
          onClick={() => {
            autoAssign(s);
            refresh();
          }}
        >
          Tự động phân công
        </button>
        <label className="row" style={{ gap: 4 }}>
          <input
            type="checkbox"
            checked={s.autoRoles}
            onChange={(e) => {
              s.autoRoles = e.target.checked;
              refresh();
            }}
          />
          mỗi nửa đêm
        </label>
        <label className="row" style={{ gap: 4 }}>
          <input type="checkbox" checked={onlyHere} onChange={(e) => setOnlyHere(e.target.checked)} />
          chỉ {site.name}
        </label>
        {(Object.keys(ROLES) as Role[]).map((r) => (
          <span key={r} className="tag" title={ROLES[r].desc}>
            {ROLES[r].label} {counts[r] ?? 0}
          </span>
        ))}
      </div>
      <table className="grid">
        <thead>
          <tr className="label">
            <th>Tên</th>
            <th>Điểm</th>
            <th title="Ngủ ở nhà, ban ngày đi bộ sang điểm khác làm việc">Đi làm ở</th>
            <th title="Đọc sách đúng skill đã gán (cần Kệ sách)">Tự học</th>
            <th>Vai trò</th>
            <th>Đang làm</th>
            <th>HP</th>
            <th>Đói</th>
            <th>Khát</th>
            <th>Mệt</th>
            <th>Tinh thần</th>
            <th>Kỹ năng</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className={p.id === sel ? 'sel' : ''} onClick={() => setSel(p.id)}>
              <td>
                {p.name}
                <div className="faint">
                  {p.background}, {p.age}t
                </div>
              </td>
              <td className="dim">{siteName(p.siteId)}</td>
              <td>
                <select
                  value={p.commute?.work ?? ''}
                  disabled={p.location === 'expedition' || s.sites.length < 2}
                  onChange={(e) => {
                    setCommute(s, world, p.id, e.target.value || null);
                    refresh();
                  }}
                >
                  <option value="">— ở nhà —</option>
                  {s.sites
                    .filter((x) => x.id !== (p.commute?.home ?? p.siteId))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </td>
              <td>
                <select
                  value={p.study ?? ''}
                  disabled={p.location !== 'base' || !baseStats(s, site).bookshelf}
                  onChange={(e) => {
                    setStudy(s, p.id, e.target.value === '' ? null : (e.target.value as SkillId));
                    refresh();
                  }}
                >
                  <option value="">Ngẫu nhiên</option>
                  {(Object.keys(SKILLS) as SkillId[]).map((k) => (
                    <option key={k} value={k}>
                      {SKILLS[k]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={p.role}
                  disabled={p.location !== 'base'}
                  onChange={(e) => {
                    setRole(s, p.id, e.target.value as Role);
                    refresh();
                  }}
                >
                  {(Object.keys(ROLES) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r].label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {p.task ? TASK_LABEL[p.task.kind] : '—'}
                {p.task && p.task.kind !== 'expedition' && <span className="faint"> {fmtDuration(Math.max(0, p.task.end - s.t))}</span>}
              </td>
              <td>
                <Bar v={p.hp} title="HP" />
              </td>
              <td>
                <Bar v={p.kcal} max={2800} title="kcal" />
              </td>
              <td>
                <Bar v={p.water} max={3200} title="ml" color="#5a9ad0" />
              </td>
              <td>
                <Bar v={100 - p.fatigue} title="Tỉnh táo" />
              </td>
              <td>
                <Bar v={p.morale} title="Tinh thần" color="#e0a030" />
              </td>
              <td>
                {topSkills(p).map(([k, l]) => (
                  <span key={k} className="tag">
                    {SKILLS[k]} {l}
                  </span>
                ))}
              </td>
              <td>
                {p.location === 'expedition' && <span className="tag">Đang đi</span>}
                {p.location === 'quarantine' && <span className="tag red">Cách ly</span>}
                {p.sickDays > 0 && <span className="tag red">Bệnh {p.sickDays}n</span>}
                {p.biteKnown && <span className="tag red">Bị cắn</span>}
                {p.hp < 50 && <span className="tag red">Bị thương</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {v && (
        <div className="card col">
          <b>
            {v.name} — {v.background}, {v.age} tuổi
          </b>
          <div>
            {v.traits.map((t) => (
              <span key={t} className="tag" title={TRAITS[t].desc}>
                {TRAITS[t].label}
              </span>
            ))}
          </div>
          <div className="row">
            {(Object.keys(SKILLS) as SkillId[]).map((k) => (
              <span key={k} className="tag">
                {SKILLS[k]} {skill(v, k)}
              </span>
            ))}
          </div>
          <div className="dim">
            HP {Math.round(v.hp)} · {Math.round(v.kcal)} kcal · {Math.round(v.water)} ml · mệt {Math.round(v.fatigue)} · tinh thần {Math.round(v.morale)}
          </div>
          <div className="dim">{ROLES[v.role].desc}</div>
        </div>
      )}

      {lost.length > 0 && (
        <>
          <div className="label">Đã mất ({lost.length})</div>
          <div className="dim">{lost.map((x) => `${x.name} (${x.status === 'dead' ? 'chết' : 'rời đi'})`).join(' · ')}</div>
        </>
      )}
    </div>
  );
}

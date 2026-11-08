import { useEffect, useState } from 'react';
import { dayOf } from '../core/time';
import { hydrateSites, migrate } from '../sim/state';
import type { GameState } from '../sim/types';
import { getCachedWorld } from '../world/loader';
import type { World } from '../world/types';
import { Game } from './Game';
import { Picker } from './Picker';
import { loadGame } from './save';

type Screen = { k: 'title' } | { k: 'picker' } | { k: 'game'; state: GameState; world: World };

export function App() {
  const [screen, setScreen] = useState<Screen>({ k: 'title' });
  const [save, setSave] = useState<GameState | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    loadGame()
      .then((s) => setSave(s ? migrate(s) : null))
      .catch(() => setSave(null));
  }, [screen.k]);

  const resume = async () => {
    if (!save) return;
    const world = await getCachedWorld(save.worldKey).catch(() => undefined);
    if (!world) {
      setErr('Không tìm thấy bản đồ đã lưu cho save này (cache trình duyệt đã bị xoá).');
      return;
    }
    world.greens ??= []; // worlds cached before fields existed
    hydrateSites(save, world);
    setScreen({ k: 'game', state: save, world });
  };

  if (screen.k === 'picker') {
    return <Picker onStart={(state, world) => setScreen({ k: 'game', state, world })} onBack={() => setScreen({ k: 'title' })} />;
  }
  if (screen.k === 'game') {
    return <Game initial={screen.state} world={screen.world} onExit={() => setScreen({ k: 'title' })} />;
  }
  return (
    <div className="title-screen">
      <div className="hero">
        <div className="label">[ Sinh tồn · Xây căn cứ · Điều hành cộng đồng ]</div>
        <h1>
          Hold
          <br />
          <span>out</span>
        </h1>
        <p className="dim" style={{ maxWidth: 560 }}>
          Chọn bất kỳ đâu trên bản đồ thật. Chiếm một toà nhà thật. Dẫn dắt hai mươi con người sống sót lâu nhất có thể — mỗi giây ở ngoài trời là một lần nữa có người bị cắn.
        </p>
      </div>
      <div className="side">
        {save && (
          <button onClick={resume}>
            Tiếp tục — ngày {dayOf(save.t)}, {save.survivors.filter((v) => v.status === 'alive').length} người
          </button>
        )}
        <button className="primary" onClick={() => setScreen({ k: 'picker' })}>
          Ván mới
        </button>
        {err && <div className="red">{err}</div>}
        <hr />
        <div className="faint">
          Dữ liệu bản đồ © OpenStreetMap contributors (ODbL). Nền bản đồ OpenFreeMap. Vị trí bạn chọn được làm tròn ~500 m trước khi gửi đi.
        </div>
      </div>
    </div>
  );
}

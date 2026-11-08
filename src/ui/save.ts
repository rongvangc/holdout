import { del, get, set } from 'idb-keyval';
import type { GameState } from '../sim/types';

const KEY = 'last30days:save';

export const saveGame = (s: GameState) => set(KEY, JSON.parse(JSON.stringify(s)) as GameState);
export const loadGame = () => get<GameState>(KEY);
export const clearSave = () => del(KEY);

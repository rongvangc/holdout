import { useCallback, useReducer } from 'react';

export type SheetId = 'kho' | 'tools' | 'room' | 'projects' | 'stats' | 'expedition' | 'target';

type OverlayState = { khoOpen: boolean; sheet: SheetId | null };
type OverlayAction = { type: 'open'; id: SheetId } | { type: 'toggleKho' } | { type: 'close' };

export function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  if (action.type === 'open') return { khoOpen: action.id === 'kho', sheet: action.id };
  if (action.type === 'toggleKho') return state.sheet === 'kho' ? { khoOpen: false, sheet: null } : { khoOpen: true, sheet: 'kho' };
  return { khoOpen: false, sheet: null };
}

export function useOverlay() {
  const [state, dispatch] = useReducer(overlayReducer, { khoOpen: false, sheet: null });

  const toggleKho = useCallback(() => dispatch({ type: 'toggleKho' }), []);
  const openSheet = useCallback((id: SheetId) => dispatch({ type: 'open', id }), []);
  const closeSheet = useCallback(() => dispatch({ type: 'close' }), []);

  return { ...state, toggleKho, openSheet, closeSheet };
}

import { useCallback, useState } from 'react';

export type SheetId = 'kho' | 'tools' | 'room' | 'projects' | 'stats' | 'expedition' | 'target';

export function useOverlay() {
  const [khoOpen, setKhoOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetId | null>(null);

  const toggleKho = useCallback(() => {
    setKhoOpen((open) => !open);
    setSheet(null);
  }, []);
  const openSheet = useCallback((id: SheetId) => {
    if (id === 'kho') setKhoOpen(true);
    else {
      setKhoOpen(false);
      setSheet(id);
    }
  }, []);
  const closeSheet = useCallback(() => {
    setKhoOpen(false);
    setSheet(null);
  }, []);

  return { khoOpen, toggleKho, sheet, openSheet, closeSheet };
}

import { useCallback, useState } from 'react';
import { loadWlBu, saveWlBu, wlBuLabel, type WlBuCode } from '@/lib/wlBuState';

export function useWlBu(defaultBu: WlBuCode = 'LBD') {
  const [selectedBu, setSelectedBuState] = useState<WlBuCode>(() => loadWlBu() ?? defaultBu);

  const setSelectedBu = useCallback((bu: WlBuCode) => {
    setSelectedBuState(bu);
    saveWlBu(bu);
  }, []);

  return {
    selectedBu,
    setSelectedBu,
    buLabel: wlBuLabel(selectedBu),
  };
}

import { useCallback, useState } from 'react';
import { loadWlBu, saveWlBu, wlBuViewLabel, type WlBuView } from '@/lib/wlBuState';

export function useWlBu(defaultBu: WlBuView = 'LBD') {
  const [selectedBu, setSelectedBuState] = useState<WlBuView>(() => loadWlBu() ?? defaultBu);

  const setSelectedBu = useCallback((bu: WlBuView) => {
    setSelectedBuState(bu);
    saveWlBu(bu);
  }, []);

  return {
    selectedBu,
    setSelectedBu,
    buLabel: wlBuViewLabel(selectedBu),
  };
}

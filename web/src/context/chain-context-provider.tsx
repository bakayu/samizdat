import { useMemo } from 'react';

import { ChainContext, DEFAULT_CHAIN_CONFIG } from '@/context/chain-context';

export function ChainContextProvider({ children }: { children: React.ReactNode }) {
  const contextValue = useMemo(() => DEFAULT_CHAIN_CONFIG, []);

  return <ChainContext.Provider value={contextValue}>{children}</ChainContext.Provider>;
}

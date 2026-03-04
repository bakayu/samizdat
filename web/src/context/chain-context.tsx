import { createContext } from 'react';

import { devnet } from '@solana/kit';

import type { ClusterUrl } from '@solana/kit';

export type ChainContextType = Readonly<{
  chain: `solana:${string}`;
  displayName: string;
  solanaRpcSubscriptionsUrl: ClusterUrl;
  solanaRpcUrl: ClusterUrl;
}>;

export const DEFAULT_CHAIN_CONFIG: ChainContextType = {
  chain: 'solana:devnet',
  displayName: 'Devnet',
  solanaRpcSubscriptionsUrl: devnet('wss://api.devnet.solana.com'),
  solanaRpcUrl: devnet('https://api.devnet.solana.com'),
};

export const ChainContext = createContext<ChainContextType>(DEFAULT_CHAIN_CONFIG);

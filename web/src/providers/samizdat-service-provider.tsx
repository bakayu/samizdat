import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useWalletAccountTransactionSendingSigner } from '@solana/react';


import { ChainContext } from '@/context/chain-context';
import { ConnectionContext } from '@/context/connection-context';
import { SelectedWalletAccountContext } from '@/context/selected-wallet-account-context';
import { SamizdatBlockchainService } from '@/services/samizdat-service';
import type { WithAddress } from '@/types/samizdat';

import type {
  CampaignAccount,
  CreateCampaignInstructionDataArgs,
  NodeAccount,
  PlayRecord,
  PublisherAccount,
  RegisterNodeInstructionDataArgs,
  UpdateCampaignInstructionDataArgs,
  UpdateNodeMetadataInstructionDataArgs,
} from '@client/index';

// ============================================================================
// Samizdat Service — interface for blockchain interactions.
//
// Uses generated Codama types directly. All account data returned with
// `WithAddress<T>` so callers always have the on-chain PDA address.
// ============================================================================

export interface SamizdatService {
  // Publisher
  registerPublisher(): Promise<WithAddress<PublisherAccount>>;
  getPublisher(authority: string): Promise<WithAddress<PublisherAccount> | null>;

  // Campaigns
  createCampaign(args: CreateCampaignInstructionDataArgs): Promise<WithAddress<CampaignAccount>>;
  getCampaigns(): Promise<WithAddress<CampaignAccount>[]>;
  getCampaign(address: string): Promise<WithAddress<CampaignAccount> | null>;
  fundCampaign(campaignAddress: string, amount: number): Promise<void>;
  updateCampaign(
    campaignAddress: string,
    args: UpdateCampaignInstructionDataArgs,
  ): Promise<void>;
  addCidsToCampaign(campaignAddress: string, newCids: string[]): Promise<void>;
  closeCampaign(campaignAddress: string): Promise<void>;

  // Node Operator
  registerNode(args: RegisterNodeInstructionDataArgs): Promise<WithAddress<NodeAccount>>;
  getNode(authority: string): Promise<WithAddress<NodeAccount> | null>;
  updateNodeMetadata(
    nodeAddress: string,
    args: UpdateNodeMetadataInstructionDataArgs,
  ): Promise<void>;

  // Play Cycle
  claimCampaign(
    campaignAddress: string,
    nodeAddress: string,
    cidIndex: number,
  ): Promise<WithAddress<PlayRecord>>;
  confirmPlay(playRecordAddress: string): Promise<void>;
  timeoutPlay(playRecordAddress: string): Promise<void>;
  getPlayRecords(): Promise<WithAddress<PlayRecord>[]>;
}

const SamizdatServiceContext = createContext<SamizdatService | null>(null);

export function useSamizdatService(): SamizdatService {
  const ctx = useContext(SamizdatServiceContext);

  if (!ctx) {
    throw new Error('useSamizdatService must be used within a SamizdatServiceProvider');
  }

  return ctx;
}

interface SamizdatServiceProviderProps {
  children: ReactNode;
  service: SamizdatService;
}

export function SamizdatServiceProvider({
  children,
  service,
}: SamizdatServiceProviderProps) {
  return (
    <SamizdatServiceContext.Provider value={service}>
      {children}
    </SamizdatServiceContext.Provider>
  );
}

// ============================================================================
// Connected provider — instantiates the real service with wallet signer
// ============================================================================

/**
 * Wraps children with SamizdatServiceProvider when a wallet is connected.
 * When no wallet is connected, the service context is null (callers should
 * check via useSamizdatService which will throw if used without a wallet).
 */
export function SamizdatServiceProviderConnected({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  const { chain } = useContext(ChainContext);
  const { connection } = useContext(ConnectionContext);

  // Only create the signer + service when a wallet account is selected
  if (!selectedWalletAccount) {
    return (
      <SamizdatServiceContext.Provider value={null}>
        {children}
      </SamizdatServiceContext.Provider>
    );
  }

  return (
    <SamizdatServiceProviderInner
      chain={chain}
      connection={connection}
    >
      {children}
    </SamizdatServiceProviderInner>
  );
}

/**
 * Inner component that calls hooks unconditionally (hooks can't be conditional).
 */
function SamizdatServiceProviderInner({
  children,
  chain,
  connection,
}: {
  children: ReactNode;
  chain: `solana:${string}`;
  connection: import('solana-kite').Connection;
}) {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  // This hook must be called unconditionally — guarded by the parent check
  const transactionSendingSigner = useWalletAccountTransactionSendingSigner(
    selectedWalletAccount!,
    chain
  );

  const service = useMemo(
    () => new SamizdatBlockchainService(connection, transactionSendingSigner),
    [connection, transactionSendingSigner]
  );

  return (
    <SamizdatServiceContext.Provider value={service}>
      {children}
    </SamizdatServiceContext.Provider>
  );
}

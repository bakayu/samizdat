/**
 * Samizdat blockchain service — real implementation using Codama-generated
 * client and solana-kite for connection management.
 */
import {
  CAMPAIGN_ACCOUNT_DISCRIMINATOR,
  NODE_ACCOUNT_DISCRIMINATOR,
  PLAY_RECORD_DISCRIMINATOR,
  SAMIZDAT_PROGRAM_ADDRESS,
  fetchMaybeCampaignAccount,
  fetchMaybeNodeAccount,
  fetchMaybePlayRecord,
  fetchMaybePublisherAccount,
  getAddCidsToCampaignInstructionAsync,
  getCampaignAccountDecoder,
  getClaimCampaignInstructionAsync,
  getCloseCampaignInstructionAsync,
  getConfirmPlayInstruction,
  getCreateCampaignInstructionAsync,
  getFundCampaignInstructionAsync,
  getNodeAccountDecoder,
  getPlayRecordDecoder,
  getRegisterNodeInstructionAsync,
  getRegisterPublisherInstructionAsync,
  getTimeoutPlayInstruction,
  getUpdateCampaignInstructionAsync,
  getUpdateNodeMetadataInstruction,
} from '@client/index';
import {
  type Address,
  type TransactionSendingSigner,
  type TransactionSigner,
  address as toAddress,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
} from '@solana/kit';


import type { SamizdatService } from '@/providers/samizdat-service-provider';
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
import type { Connection } from 'solana-kite';

// ─── Service Implementation ─────────────────────────────────────────────────

export class SamizdatBlockchainService implements SamizdatService {
  constructor(
    private connection: Connection,
    private signer: TransactionSendingSigner,
  ) {}

  /** Widen to TransactionSigner for Codama instruction account metas. */
  private get authority(): TransactionSigner {
    return this.signer as TransactionSigner;
  }

  /** Build a v0 tx and let the wallet sign + send via TransactionSendingSigner. */
  private async sendIx(
    instructions: Parameters<Connection['sendTransactionFromInstructionsWithWalletApp']>[0]['instructions'],
  ) {
    const { value: latestBlockhash } = await this.connection.rpc.getLatestBlockhash().send();
    const txMsg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(this.signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    );
    await signAndSendTransactionMessageWithSigners(txMsg);
  }

  // ─── Publisher ──────────────────────────────────────────────────────────

  async registerPublisher(): Promise<WithAddress<PublisherAccount>> {
    const ix = await getRegisterPublisherInstructionAsync({ authority: this.authority });
    await this.sendIx([ix]);
    const { pda } = await this.connection.getPDAAndBump(
      SAMIZDAT_PROGRAM_ADDRESS,
      ['publisher', this.signer.address],
    );
    return this.fetchPublisher(pda);
  }

  async getPublisher(authority: string): Promise<WithAddress<PublisherAccount> | null> {
    const { pda } = await this.connection.getPDAAndBump(
      SAMIZDAT_PROGRAM_ADDRESS,
      ['publisher', authority],
    );
    try {
      return await this.fetchPublisher(pda);
    } catch {
      return null;
    }
  }

  private async fetchPublisher(addr: Address): Promise<WithAddress<PublisherAccount>> {
    const acct = await fetchMaybePublisherAccount(this.connection.rpc, addr);
    if (!acct.exists) throw new Error(`Publisher not found at ${addr}`);
    return { ...acct.data, address: String(addr) };
  }

  // ─── Campaigns ──────────────────────────────────────────────────────────

  async createCampaign(args: CreateCampaignInstructionDataArgs): Promise<WithAddress<CampaignAccount>> {
    const ix = await getCreateCampaignInstructionAsync({
      authority: this.authority,
      ...args,
    });
    await this.sendIx([ix]);

    const { pda: publisherPDA } = await this.connection.getPDAAndBump(
      SAMIZDAT_PROGRAM_ADDRESS,
      ['publisher', this.signer.address],
    );
    const { pda: campaignPDA } = await this.connection.getPDAAndBump(
      SAMIZDAT_PROGRAM_ADDRESS,
      ['campaign', publisherPDA, BigInt(args.campaignId)],
    );
    return this.fetchCampaign(campaignPDA);
  }

  async getCampaigns(): Promise<WithAddress<CampaignAccount>[]> {
    const getAll = this.connection.getAccountsFactory(
      SAMIZDAT_PROGRAM_ADDRESS,
      CAMPAIGN_ACCOUNT_DISCRIMINATOR,
      getCampaignAccountDecoder(),
    );
    const accounts = await getAll();
    return accounts
      .filter((a) => a.exists)
      .map((a) => ({ ...(a as { data: CampaignAccount }).data, address: String(a.address) }));
  }

  async getCampaign(addr: string): Promise<WithAddress<CampaignAccount> | null> {
    try {
      return await this.fetchCampaign(toAddress(addr));
    } catch {
      return null;
    }
  }

  async fundCampaign(campaignAddress: string, amount: number): Promise<void> {
    const ix = await getFundCampaignInstructionAsync({
      authority: this.authority,
      campaignAccount: toAddress(campaignAddress),
      amount: lamports(BigInt(amount)),
    });
    await this.sendIx([ix]);
  }

  async updateCampaign(
    campaignAddress: string,
    args: UpdateCampaignInstructionDataArgs,
  ): Promise<void> {
    const ix = await getUpdateCampaignInstructionAsync({
      authority: this.authority,
      campaignAccount: toAddress(campaignAddress),
      ...args,
    });
    await this.sendIx([ix]);
  }

  async addCidsToCampaign(campaignAddress: string, newCids: string[]): Promise<void> {
    const ix = await getAddCidsToCampaignInstructionAsync({
      authority: this.authority,
      campaignAccount: toAddress(campaignAddress),
      newCids,
    });
    await this.sendIx([ix]);
  }

  async closeCampaign(campaignAddress: string): Promise<void> {
    const ix = await getCloseCampaignInstructionAsync({
      authority: this.authority,
      campaignAccount: toAddress(campaignAddress),
    });
    await this.sendIx([ix]);
  }

  // ─── Node Operator ──────────────────────────────────────────────────────

  async registerNode(args: RegisterNodeInstructionDataArgs): Promise<WithAddress<NodeAccount>> {
    const ix = await getRegisterNodeInstructionAsync({ authority: this.authority, ...args });
    await this.sendIx([ix]);
    const { pda } = await this.connection.getPDAAndBump(
      SAMIZDAT_PROGRAM_ADDRESS,
      ['node_account', this.signer.address, BigInt(args.nodeId)],
    );
    return this.fetchNode(pda);
  }

  async getNode(authority: string): Promise<WithAddress<NodeAccount> | null> {
    const getAll = this.connection.getAccountsFactory(
      SAMIZDAT_PROGRAM_ADDRESS,
      NODE_ACCOUNT_DISCRIMINATOR,
      getNodeAccountDecoder(),
    );
    const accounts = await getAll();
    const match = accounts.find(
      (a) => a.exists && (a as { data: NodeAccount }).data.authority === authority,
    );
    if (!match || !match.exists) return null;
    return { ...(match as { data: NodeAccount }).data, address: String(match.address) };
  }

  async updateNodeMetadata(
    nodeAddress: string,
    args: UpdateNodeMetadataInstructionDataArgs,
  ): Promise<void> {
    const ix = getUpdateNodeMetadataInstruction({
      authority: this.authority,
      nodeAccount: toAddress(nodeAddress),
      ...args,
    });
    await this.sendIx([ix]);
  }

  // ─── Play Cycle ─────────────────────────────────────────────────────────

  async claimCampaign(
    campaignAddress: string,
    nodeAddress: string,
    cidIndex: number,
  ): Promise<WithAddress<PlayRecord>> {
    const claimNonce = BigInt(Date.now());
    const ix = await getClaimCampaignInstructionAsync({
      authority: this.authority,
      campaignAccount: toAddress(campaignAddress),
      nodeAccount: toAddress(nodeAddress),
      cidIndex,
      claimNonce,
    });
    await this.sendIx([ix]);

    const { pda } = await this.connection.getPDAAndBump(
      SAMIZDAT_PROGRAM_ADDRESS,
      ['play_record', campaignAddress, nodeAddress, claimNonce],
    );
    return this.fetchPlayRecord(pda);
  }

  async confirmPlay(playRecordAddress: string): Promise<void> {
    const record = await this.fetchPlayRecord(toAddress(playRecordAddress));
    const campaign = await this.fetchCampaign(record.campaignAccount);
    const ix = getConfirmPlayInstruction({
      authority: this.authority,
      playRecord: toAddress(playRecordAddress),
      campaignAccount: record.campaignAccount,
      publisherAccount: campaign.publisherAccount,
      nodeAccount: record.nodeAccount,
    });
    await this.sendIx([ix]);
  }

  async timeoutPlay(playRecordAddress: string): Promise<void> {
    const record = await this.fetchPlayRecord(toAddress(playRecordAddress));
    const ix = getTimeoutPlayInstruction({
      playRecord: toAddress(playRecordAddress),
      campaignAccount: record.campaignAccount,
    });
    await this.sendIx([ix]);
  }

  async getPlayRecords(): Promise<WithAddress<PlayRecord>[]> {
    const getAll = this.connection.getAccountsFactory(
      SAMIZDAT_PROGRAM_ADDRESS,
      PLAY_RECORD_DISCRIMINATOR,
      getPlayRecordDecoder(),
    );
    const accounts = await getAll();
    return accounts
      .filter((a) => a.exists)
      .map((a) => ({ ...(a as { data: PlayRecord }).data, address: String(a.address) }));
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private async fetchCampaign(addr: Address): Promise<WithAddress<CampaignAccount>> {
    const acct = await fetchMaybeCampaignAccount(this.connection.rpc, addr);
    if (!acct.exists) throw new Error(`Campaign not found at ${addr}`);
    return { ...acct.data, address: String(addr) };
  }

  private async fetchNode(addr: Address): Promise<WithAddress<NodeAccount>> {
    const acct = await fetchMaybeNodeAccount(this.connection.rpc, addr);
    if (!acct.exists) throw new Error(`Node not found at ${addr}`);
    return { ...acct.data, address: String(addr) };
  }

  private async fetchPlayRecord(addr: Address): Promise<WithAddress<PlayRecord>> {
    const acct = await fetchMaybePlayRecord(this.connection.rpc, addr);
    if (!acct.exists) throw new Error(`PlayRecord not found at ${addr}`);
    return { ...acct.data, address: String(addr) };
  }
}

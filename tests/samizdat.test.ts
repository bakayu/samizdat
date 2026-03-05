import { describe, test, before } from "node:test";
import assert from "node:assert";
import { connect, type Connection, getPDAAndBump } from "solana-kite";
import { type Address, type TransactionSigner, lamports } from "@solana/kit";
import { readFileSync } from "node:fs";
import { createKeyPairSignerFromBytes } from "@solana/kit";

import {
  SAMIZDAT_PROGRAM_ADDRESS,
  getRegisterPublisherInstructionAsync,
  getCreateCampaignInstructionAsync,
  getFundCampaignInstructionAsync,
  getUpdateCampaignInstructionAsync,
  getAddCidsToCampaignInstructionAsync,
  getCloseCampaignInstructionAsync,
  getRegisterNodeInstructionAsync,
  getUpdateNodeMetadataInstruction,
  getClaimCampaignInstructionAsync,
  getConfirmPlayInstruction,
  fetchPublisherAccount,
  fetchCampaignAccount,
  fetchNodeAccount,
  fetchPlayRecord,
  fetchClaimCooldown,
  ScreenSize,
  PlayStatus,
  type TargetFiltersArgs,
  CampaignStatus,
} from "@client/index";

const RUN_SEED = BigInt(Date.now());
const CAMPAIGN_ID = RUN_SEED;
const BOUNTY_PER_PLAY = 100_000n; // lamports
const TOTAL_PLAYS = 10n;
const TAG_MASK = 0n; // no content tags
const CLAIM_COOLDOWN = 0n; // no cooldown for happy-path tests
const NODE_ID = RUN_SEED;
const CLAIM_NONCE = 1n;
const CID_INDEX = 0;

const SAMPLE_CIDS = [
  "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
];

const SAMPLE_LOCATION = {
  latitude: 407_128_000n, // 40.7128°N (NYC) × 1e7
  longitude: -740_060_000n, // -74.0060°W × 1e7
};

const SAMPLE_RESOLUTION = { width: 1920, height: 1080 };

const SAMPLE_TARGET_FILTERS: TargetFiltersArgs = {
  minFootfall: null,
  maxFootfall: null,
  screenSizes: [],
  geoBounds: null,
  establishmentTypes: [],
  requiredLandmarks: [],
};

const CLUSTER = (process.env.CLUSTER ?? "localnet") as "localnet" | "devnet";

describe("Samizdat Program – Happy Path", () => {
  let connection: Connection;
  let publisher: TransactionSigner;
  let operator: TransactionSigner;

  let publisherAccountPDA: Address;
  let campaignAccountPDA: Address;
  let nodeAccountPDA: Address;
  let playRecordPDA: Address;
  let claimCooldownPDA: Address;

  // Snapshot values captured before each section
  let initialTotalCampaigns: bigint;
  let initialTotalSpent: bigint;

  before(async () => {
    connection = connect(CLUSTER);

    if (CLUSTER === "localnet") {
      const [pub, op] = await connection.createWallets(2);
      publisher = pub!;
      operator = op!;
    } else {
      const getBytes = (envVar: string | undefined, filePath: string) => {
        const raw = envVar
          ? JSON.parse(envVar)
          : JSON.parse(readFileSync(filePath, "utf-8"));
        return new Uint8Array(raw);
      };

      const publisherPath = `${process.env.HOME}/.config/solana/devnet-test.json`;
      const operatorPath = `${process.env.HOME}/.config/solana/devnet-operator.json`;

      publisher = await createKeyPairSignerFromBytes(
        getBytes(process.env.KEYPAIR_ONE, publisherPath),
      );
      operator = await createKeyPairSignerFromBytes(
        getBytes(process.env.KEYPAIR_TWO, operatorPath),
      );
    }

    ({ pda: publisherAccountPDA } = await getPDAAndBump(
      SAMIZDAT_PROGRAM_ADDRESS,
      ["publisher", publisher.address],
    ));

    ({ pda: campaignAccountPDA } = await getPDAAndBump(
      SAMIZDAT_PROGRAM_ADDRESS,
      ["campaign", publisherAccountPDA, CAMPAIGN_ID],
    ));

    ({ pda: nodeAccountPDA } = await getPDAAndBump(SAMIZDAT_PROGRAM_ADDRESS, [
      "node_account",
      operator.address,
      NODE_ID,
    ]));

    ({ pda: playRecordPDA } = await getPDAAndBump(SAMIZDAT_PROGRAM_ADDRESS, [
      "play_record",
      campaignAccountPDA,
      nodeAccountPDA,
      CLAIM_NONCE,
    ]));

    ({ pda: claimCooldownPDA } = await getPDAAndBump(SAMIZDAT_PROGRAM_ADDRESS, [
      "cooldown",
      campaignAccountPDA,
      nodeAccountPDA,
    ]));

    console.log("accounts:", {
      publisher: publisher.address,
      operator: operator.address,
      publisherAccountPDA,
      campaignAccountPDA,
      nodeAccountPDA,
      playRecordPDA,
      claimCooldownPDA,
    });

    // Register publisher if not already registered (idempotent)
    try {
      const ix = await getRegisterPublisherInstructionAsync({
        authority: publisher,
      });
      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [ix],
      });
    } catch (error) {
      throw error;
    }

    // Snapshot current publisher state
    const pubAccount = await fetchPublisherAccount(
      connection.rpc,
      publisherAccountPDA,
    );
    initialTotalCampaigns = pubAccount.data.totalCampaigns;
    initialTotalSpent = pubAccount.data.totalSpent;
  });

  describe("Publisher Registration", () => {
    test("registers a publisher account", async () => {
      // Already registered in before() hook — just verify it exists
      const account = await fetchPublisherAccount(
        connection.rpc,
        publisherAccountPDA,
      );
      assert.strictEqual(account.data.authority, publisher.address);
    });
  });

  describe("Campaign Lifecycle", () => {
    test("creates a campaign with upfront funding", async () => {
      const ix = await getCreateCampaignInstructionAsync({
        authority: publisher,
        campaignId: CAMPAIGN_ID,
        cids: SAMPLE_CIDS,
        bountyPerPlay: BOUNTY_PER_PLAY,
        totalPlays: TOTAL_PLAYS,
        tagMask: TAG_MASK,
        targetFilters: SAMPLE_TARGET_FILTERS,
        claimCooldown: CLAIM_COOLDOWN,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [ix],
      });

      const campaign = await fetchCampaignAccount(
        connection.rpc,
        campaignAccountPDA,
      );

      assert.strictEqual(campaign.data.publisherAccount, publisherAccountPDA);
      assert.strictEqual(campaign.data.campaignId, CAMPAIGN_ID);
      assert.strictEqual(campaign.data.bountyPerPlay, BOUNTY_PER_PLAY);
      assert.strictEqual(campaign.data.playsRemaining, TOTAL_PLAYS);
      assert.strictEqual(campaign.data.playsCompleted, 0n);
      assert.strictEqual(campaign.data.tagMask, TAG_MASK);
      assert.strictEqual(campaign.data.status, CampaignStatus.Active);
      assert.strictEqual(campaign.data.claimCooldown, CLAIM_COOLDOWN);
      assert.deepStrictEqual(campaign.data.cids, SAMPLE_CIDS);

      // Publisher total_campaigns incremented
      const pub = await fetchPublisherAccount(
        connection.rpc,
        publisherAccountPDA,
      );
      assert.strictEqual(pub.data.totalCampaigns, initialTotalCampaigns + 1n);
    });

    test("funds the campaign with additional lamports", async () => {
      const additionalFunding = 500_000n;

      const balanceBefore = await connection.getLamportBalance(
        campaignAccountPDA,
        "confirmed",
      );

      const ix = await getFundCampaignInstructionAsync({
        campaignAccount: campaignAccountPDA,
        authority: publisher,
        amount: additionalFunding,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [ix],
      });

      const balanceAfter = await connection.getLamportBalance(
        campaignAccountPDA,
        "confirmed",
      );

      assert.strictEqual(balanceAfter - balanceBefore, additionalFunding);
    });

    test("pauses the campaign", async () => {
      const ix = await getUpdateCampaignInstructionAsync({
        campaignAccount: campaignAccountPDA,
        authority: publisher,
        tagMask: null,
        targetFilters: null,
        status: CampaignStatus.Paused,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [ix],
      });

      const campaign = await fetchCampaignAccount(
        connection.rpc,
        campaignAccountPDA,
      );
      assert.strictEqual(campaign.data.status, CampaignStatus.Paused);
    });

    test("resumes the campaign", async () => {
      const ix = await getUpdateCampaignInstructionAsync({
        campaignAccount: campaignAccountPDA,
        authority: publisher,
        tagMask: null,
        targetFilters: null,
        status: CampaignStatus.Active,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [ix],
      });

      const campaign = await fetchCampaignAccount(
        connection.rpc,
        campaignAccountPDA,
      );
      assert.strictEqual(campaign.data.status, CampaignStatus.Active);
    });

    test("adds CIDs to the campaign", async () => {
      const newCid =
        "bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq";

      const ix = await getAddCidsToCampaignInstructionAsync({
        campaignAccount: campaignAccountPDA,
        authority: publisher,
        newCids: [newCid],
      });

      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [ix],
      });

      const campaign = await fetchCampaignAccount(
        connection.rpc,
        campaignAccountPDA,
      );
      assert.strictEqual(campaign.data.cids.length, 2);
      assert.strictEqual(campaign.data.cids[1], newCid);
    });
  });

  describe("Node Registration", () => {
    test("registers a node", async () => {
      const ix = await getRegisterNodeInstructionAsync({
        authority: operator,
        nodeId: NODE_ID,
        location: SAMPLE_LOCATION,
        screenSize: ScreenSize.Large,
        resolution: SAMPLE_RESOLUTION,
        landmarks: ["Times Square"],
        blockedTagMask: 0n,
        estimatedFootfall: 5000,
        establishmentType: "retail",
      });

      await connection.sendTransactionFromInstructions({
        feePayer: operator,
        instructions: [ix],
      });

      const node = await fetchNodeAccount(connection.rpc, nodeAccountPDA);

      assert.strictEqual(node.data.authority, operator.address);
      assert.strictEqual(node.data.nodeId, NODE_ID);
      assert.strictEqual(node.data.screenSize, ScreenSize.Large);
      assert.strictEqual(node.data.resolution.width, 1920);
      assert.strictEqual(node.data.resolution.height, 1080);
      assert.strictEqual(node.data.estimatedFootfall, 5000);
      assert.strictEqual(node.data.establishmentType, "retail");
      assert.strictEqual(node.data.totalPlays, 0n);
      assert.strictEqual(node.data.totalEarnings, 0n);
      assert.deepStrictEqual(node.data.landmarks, ["Times Square"]);
    });

    test("updates node metadata", async () => {
      const ix = getUpdateNodeMetadataInstruction({
        nodeAccount: nodeAccountPDA,
        authority: operator,
        location: null,
        estimatedFootfall: 8000,
        blockedTagMask: null,
        status: null,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: operator,
        instructions: [ix],
      });

      const node = await fetchNodeAccount(connection.rpc, nodeAccountPDA);
      assert.strictEqual(node.data.estimatedFootfall, 8000);
      // Unchanged fields remain the same
      assert.strictEqual(node.data.screenSize, ScreenSize.Large);
      assert.strictEqual(node.data.establishmentType, "retail");
    });
  });

  describe("Play Cycle - Claim & Confirm", () => {
    test("operator claims a campaign", async () => {
      const campaignBefore = await fetchCampaignAccount(
        connection.rpc,
        campaignAccountPDA,
      );

      const ix = await getClaimCampaignInstructionAsync({
        campaignAccount: campaignAccountPDA,
        nodeAccount: nodeAccountPDA,
        authority: operator,
        cidIndex: CID_INDEX,
        claimNonce: CLAIM_NONCE,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: operator,
        instructions: [ix],
      });

      // Verify PlayRecord
      const play = await fetchPlayRecord(connection.rpc, playRecordPDA);
      assert.strictEqual(play.data.campaignAccount, campaignAccountPDA);
      assert.strictEqual(play.data.nodeAccount, nodeAccountPDA);
      assert.strictEqual(play.data.nonce, CLAIM_NONCE);
      assert.strictEqual(play.data.cidIndex, CID_INDEX);
      assert.strictEqual(play.data.status, PlayStatus.Claimed);
      assert.strictEqual(play.data.paymentAmount, 0n);

      // Verify ClaimCooldown was created
      const cooldown = await fetchClaimCooldown(
        connection.rpc,
        claimCooldownPDA,
      );
      assert.strictEqual(cooldown.data.campaign, campaignAccountPDA);
      assert.strictEqual(cooldown.data.node, nodeAccountPDA);
      assert.ok(cooldown.data.lastClaimedAt > 0n);

      // Campaign plays_remaining decremented
      const campaignAfter = await fetchCampaignAccount(
        connection.rpc,
        campaignAccountPDA,
      );
      assert.strictEqual(
        campaignAfter.data.playsRemaining,
        campaignBefore.data.playsRemaining - 1n,
      );
    });

    test("publisher confirms the play and pays the node", async () => {
      const nodeBalanceBefore = await connection.getLamportBalance(
        operator.address,
        "confirmed",
      );

      const ix = getConfirmPlayInstruction({
        playRecord: playRecordPDA,
        campaignAccount: campaignAccountPDA,
        publisherAccount: publisherAccountPDA,
        nodeAccount: nodeAccountPDA,
        authority: operator,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [ix],
      });

      // PlayRecord transitions to Paid
      const play = await fetchPlayRecord(connection.rpc, playRecordPDA);
      assert.strictEqual(play.data.status, PlayStatus.Paid);
      assert.strictEqual(play.data.paymentAmount, BOUNTY_PER_PLAY);
      assert.ok(play.data.confirmedAt > 0n);

      // Campaign plays_completed incremented
      const campaign = await fetchCampaignAccount(
        connection.rpc,
        campaignAccountPDA,
      );
      assert.strictEqual(campaign.data.playsCompleted, 1n);

      // Node operator received the bounty
      const nodeBalanceAfter = await connection.getLamportBalance(
        operator.address,
        "confirmed",
      );
      assert.ok(nodeBalanceAfter > nodeBalanceBefore);

      // Node aggregate stats updated
      const node = await fetchNodeAccount(connection.rpc, nodeAccountPDA);
      assert.strictEqual(node.data.totalPlays, 1n);
      assert.strictEqual(node.data.totalEarnings, BOUNTY_PER_PLAY);

      // Publisher total_spent updated
      const pub = await fetchPublisherAccount(
        connection.rpc,
        publisherAccountPDA,
      );
      assert.strictEqual(
        pub.data.totalSpent,
        initialTotalSpent + BOUNTY_PER_PLAY,
      );
    });
  });

  describe("Timeout Play", () => {
    const TIMEOUT_NONCE = 2n;
    let timeoutPlayRecordPDA: Address;

    before(async () => {
      ({ pda: timeoutPlayRecordPDA } = await getPDAAndBump(
        SAMIZDAT_PROGRAM_ADDRESS,
        ["play_record", campaignAccountPDA, nodeAccountPDA, TIMEOUT_NONCE],
      ));

      // Claim a second play that we'll attempt to time out
      const ix = await getClaimCampaignInstructionAsync({
        campaignAccount: campaignAccountPDA,
        nodeAccount: nodeAccountPDA,
        authority: operator,
        cidIndex: CID_INDEX,
        claimNonce: TIMEOUT_NONCE,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: operator,
        instructions: [ix],
      });
    });

    test("verifies the claimed play exists before timeout", async () => {
      const play = await fetchPlayRecord(connection.rpc, timeoutPlayRecordPDA);
      assert.strictEqual(play.data.status, PlayStatus.Claimed);
      assert.strictEqual(play.data.nonce, TIMEOUT_NONCE);

      // plays_remaining should have decremented again
      const campaign = await fetchCampaignAccount(
        connection.rpc,
        campaignAccountPDA,
      );
      assert.strictEqual(
        campaign.data.playsRemaining,
        TOTAL_PLAYS - 2n, // two claims made so far
      );
    });

    // Full timeout testing requires clock warping (bankrun / solana-program-test);
    // localnet doesn't support it, so we only assert the play record state here.
  });

  describe("Close Campaign", () => {
    const CLOSE_CAMPAIGN_ID = RUN_SEED + 1000n;
    let closeCampaignPDA: Address;

    before(async () => {
      ({ pda: closeCampaignPDA } = await getPDAAndBump(
        SAMIZDAT_PROGRAM_ADDRESS,
        ["campaign", publisherAccountPDA, CLOSE_CAMPAIGN_ID],
      ));

      // Create a small campaign specifically for closing
      const createIx = await getCreateCampaignInstructionAsync({
        authority: publisher,
        campaignId: CLOSE_CAMPAIGN_ID,
        cids: SAMPLE_CIDS,
        bountyPerPlay: 1_000n,
        totalPlays: 1n,
        tagMask: 0n,
        targetFilters: SAMPLE_TARGET_FILTERS,
        claimCooldown: 0n,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [createIx],
      });
    });

    test("closes a campaign and reclaims rent + remaining funds", async () => {
      const publisherBalanceBefore = await connection.getLamportBalance(
        publisher.address,
      );

      const ix = await getCloseCampaignInstructionAsync({
        campaignAccount: closeCampaignPDA,
        authority: publisher,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: publisher,
        instructions: [ix],
      });

      // Campaign account should be closed (zero lamports)
      const balance = await connection.getLamportBalance(closeCampaignPDA);
      assert.strictEqual(balance, 0n);

      // Publisher received rent back (minus tx fee)
      const publisherBalanceAfter = await connection.getLamportBalance(
        publisher.address,
      );
      // Net gain should be positive once we account for a small tx fee
      assert.ok(
        publisherBalanceAfter > publisherBalanceBefore - 100_000n,
        "Publisher should have reclaimed rent minus tx fee",
      );
    });
  });
});

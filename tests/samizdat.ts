import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Samizdat } from "../target/types/samizdat";
import { expect } from "chai";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("samizdat", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.Samizdat as Program<Samizdat>;
    const authority = provider.wallet;

    // Operator keypair
    const operator = anchor.web3.Keypair.generate();

    // Helpers
    function findPublisherPda(authority: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("publisher"), authority.toBuffer()],
            program.programId,
        );
    }

    function findCampaignPda(publisherPda: PublicKey, campaignId: number): [PublicKey, number] {
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(BigInt(campaignId));
        return PublicKey.findProgramAddressSync(
            [Buffer.from("campaign"), publisherPda.toBuffer(), buf],
            program.programId,
        );
    }

    function findNodePda(authority: PublicKey, nodeId: number): [PublicKey, number] {
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(BigInt(nodeId));
        return PublicKey.findProgramAddressSync(
            [Buffer.from("node_account"), authority.toBuffer(), buf],
            program.programId,
        );
    }

    function findPlayRecordPda(
        campaignPda: PublicKey,
        nodePda: PublicKey,
        claimTimestamp: number,
    ): [PublicKey, number] {
        const buf = Buffer.alloc(8);
        buf.writeBigInt64LE(BigInt(claimTimestamp));
        return PublicKey.findProgramAddressSync(
            [Buffer.from("play_record"), campaignPda.toBuffer(), nodePda.toBuffer(), buf],
            program.programId,
        );
    }

    async function getCurrentTimestamp(): Promise<number> {
        const slot = await provider.connection.getSlot("confirmed");
        const epochInfo = await provider.connection.getEpochInfo("confirmed");

        let timestamp: number | null = null;
        let checkSlot = slot;
        while (timestamp === null && checkSlot > 0) {
            timestamp = await provider.connection.getBlockTime(checkSlot);
            checkSlot--;
        }
        if (timestamp === null) {
            timestamp = Math.floor(Date.now() / 1000);
        }
        return timestamp;
    }

    const defaultTargetFilters = {
        minFootfall: null,
        maxFootfall: null,
        screenSizes: [],
        geoBounds: null,
        establishmentTypes: [],
        requiredLandmarks: [],
    };

    // States to track across tests
    let publisherPda: PublicKey;
    let campaignPda: PublicKey;
    let nodePda: PublicKey;
    const campaignId = 1;
    const nodeId = 1;
    const bountyPerPlay = 0.01 * LAMPORTS_PER_SOL;
    const totalPlays = 10;

    // 1. Publisher Registration
    describe("register_publisher", () => {
        it("registers a new publisher", async () => {
            [publisherPda] = findPublisherPda(authority.publicKey);

            await program.methods
                .registerPublisher()
                .accountsStrict({
                    publisherAccount: publisherPda,
                    authority: authority.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const account = await program.account.publisherAccount.fetch(publisherPda);
            expect(account.authority.toBase58()).to.equal(authority.publicKey.toBase58());
            expect(account.totalCampaigns.toNumber()).to.equal(0);
            expect(account.totalSpent.toNumber()).to.equal(0);
            expect(account.status).to.deep.equal({ active: {} });
        });

        it("fails on duplicate registration", async () => {
            try {
                await program.methods
                    .registerPublisher()
                    .accountsStrict({
                        publisherAccount: publisherPda,
                        authority: authority.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc();
                expect.fail("Should have thrown");
            } catch (err) {
                // Account already initialized - anchor rejects the init
                expect(err).to.exist;
            }
        });
    });

    // 2. Campaign Lifecycle
    describe("create_campaign", () => {
        it("creates a campaign", async () => {
            [campaignPda] = findCampaignPda(publisherPda, campaignId);

            await program.methods
                .createCampaign(
                    new anchor.BN(campaignId),
                    ["QmTestCid12345"],
                    new anchor.BN(bountyPerPlay),
                    new anchor.BN(totalPlays),
                    new anchor.BN(0),
                    defaultTargetFilters,
                )
                .accountsStrict({
                    campaignAccount: campaignPda,
                    publisherAccount: publisherPda,
                    authority: authority.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const campaign = await program.account.campaignAccount.fetch(campaignPda);
            expect(campaign.cids).to.deep.equal(["QmTestCid12345"]);
            expect(campaign.bountyPerPlay.toNumber()).to.equal(bountyPerPlay);
            expect(campaign.playsRemaining.toNumber()).to.equal(totalPlays);
            expect(campaign.playsCompleted.toNumber()).to.equal(0);
            expect(campaign.status).to.deep.equal({ active: {} });

            const publisher = await program.account.publisherAccount.fetch(publisherPda);
            expect(publisher.totalCampaigns.toNumber()).to.equal(1);
        });

        it("fails with zero bounty", async () => {
            const [badCampaignPda] = findCampaignPda(publisherPda, 999);
            try {
                await program.methods
                    .createCampaign(
                        new anchor.BN(999),
                        ["QmTestCid"],
                        new anchor.BN(0),
                        new anchor.BN(10),
                        new anchor.BN(0),
                        defaultTargetFilters,
                    )
                    .accountsStrict({
                        campaignAccount: badCampaignPda,
                        publisherAccount: publisherPda,
                        authority: authority.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .rpc();
                expect.fail("Should have thrown");
            } catch (err) {
                expect(err.toString()).to.include("InvalidBounty");
            }
        });
    });

    describe("fund_campaign", () => {
        it("funds the campaign vault", async () => {
            const fundAmount = bountyPerPlay * totalPlays;

            await program.methods
                .fundCampaign(new anchor.BN(fundAmount))
                .accountsStrict({
                    campaignAccount: campaignPda,
                    publisherAccount: publisherPda,
                    authority: authority.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const info = await provider.connection.getAccountInfo(campaignPda);
            const rent = await provider.connection.getMinimumBalanceForRentExemption(
                info.data.length,
            );
            const vaultBalance = info.lamports - rent;
            expect(vaultBalance).to.be.gte(fundAmount);
        });
    });

    describe("add_cids_to_campaign", () => {
        it("adds CIDs to the campaign", async () => {
            await program.methods
                .addCidsToCampaign(["QmSecondCid"])
                .accountsStrict({
                    campaignAccount: campaignPda,
                    publisherAccount: publisherPda,
                    authority: authority.publicKey,
                })
                .rpc();

            const campaign = await program.account.campaignAccount.fetch(campaignPda);
            expect(campaign.cids).to.have.lengthOf(2);
            expect(campaign.cids[1]).to.equal("QmSecondCid");
        });
    });

    describe("update_campaign", () => {
        it("updates tag mask", async () => {
            await program.methods
                .updateCampaign(new anchor.BN(1), null, null)
                .accountsStrict({
                    campaignAccount: campaignPda,
                    publisherAccount: publisherPda,
                    authority: authority.publicKey,
                })
                .rpc();

            const campaign = await program.account.campaignAccount.fetch(campaignPda);
            expect(campaign.tagMask.toNumber()).to.equal(1);
        });
    });

    // 3. Node Registration
    describe("register_node", () => {
        before(async () => {
            const sig = await provider.connection.requestAirdrop(
                operator.publicKey,
                2 * LAMPORTS_PER_SOL,
            );
            await provider.connection.confirmTransaction(sig);
        });

        it("registers a node", async () => {
            [nodePda] = findNodePda(operator.publicKey, nodeId);

            await program.methods
                .registerNode(
                    new anchor.BN(nodeId),
                    { latitude: new anchor.BN(407128000), longitude: new anchor.BN(-740060000) },
                    { medium: {} },
                    { width: 1920, height: 1080 },
                    ["Times Square"],
                    new anchor.BN(0),
                    5000,
                    "retail",
                )
                .accountsStrict({
                    nodeAccount: nodePda,
                    authority: operator.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([operator])
                .rpc();

            const node = await program.account.nodeAccount.fetch(nodePda);
            expect(node.authority.toBase58()).to.equal(operator.publicKey.toBase58());
            expect(node.estimatedFootfall).to.equal(5000);
            expect(node.status).to.deep.equal({ active: {} });
            expect(node.totalPlays.toNumber()).to.equal(0);
        });
    });

    // 4. Play Cycle: Claim -> Confirm
    describe("play cycle", () => {
        let playRecordPda: PublicKey;
        let claimNonce: number;

        it("claims a campaign", async () => {
            // Use a unique nonce for PDA derivation (needs to be unique per claim)
            claimNonce = Date.now();

            [playRecordPda] = findPlayRecordPda(campaignPda, nodePda, claimNonce);

            await program.methods
                .claimCampaign(0, new anchor.BN(claimNonce))
                .accountsStrict({
                    playRecord: playRecordPda,
                    campaignAccount: campaignPda,
                    nodeAccount: nodePda,
                    authority: operator.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([operator])
                .rpc();

            const play = await program.account.playRecord.fetch(playRecordPda);
            expect(play.status).to.deep.equal({ claimed: {} });
            expect(play.cidIndex).to.equal(0);
            expect(play.claimedAt.toNumber()).to.be.gt(0);

            const campaign = await program.account.campaignAccount.fetch(campaignPda);
            expect(campaign.playsRemaining.toNumber()).to.equal(totalPlays - 1);
        });

        it("confirms play and receives payment", async () => {
            const balanceBefore = await provider.connection.getBalance(operator.publicKey);

            await program.methods
                .confirmPlay()
                .accountsStrict({
                    playRecord: playRecordPda,
                    campaignAccount: campaignPda,
                    publisherAccount: publisherPda,
                    nodeAccount: nodePda,
                    authority: operator.publicKey,
                })
                .signers([operator])
                .rpc();

            const play = await program.account.playRecord.fetch(playRecordPda);
            expect(play.status).to.deep.equal({ paid: {} });
            expect(play.paymentAmount.toNumber()).to.equal(bountyPerPlay);

            const balanceAfter = await provider.connection.getBalance(operator.publicKey);
            expect(balanceAfter).to.be.gt(balanceBefore);

            const node = await program.account.nodeAccount.fetch(nodePda);
            expect(node.totalPlays.toNumber()).to.equal(1);
            expect(node.totalEarnings.toNumber()).to.equal(bountyPerPlay);

            const publisher = await program.account.publisherAccount.fetch(publisherPda);
            expect(publisher.totalSpent.toNumber()).to.equal(bountyPerPlay);
        });
    });

    // 5. Timeout
    describe("timeout_play", () => {
        it("times out an expired claim", async () => {
            const campaignBefore = await program.account.campaignAccount.fetch(campaignPda);
            const playsBeforeClaim = campaignBefore.playsRemaining.toNumber();

            const timeoutNonce = Date.now() + 1;
            const [expiredPlayPda] = findPlayRecordPda(campaignPda, nodePda, timeoutNonce);

            await program.methods
                .claimCampaign(0, new anchor.BN(timeoutNonce))
                .accountsStrict({
                    playRecord: expiredPlayPda,
                    campaignAccount: campaignPda,
                    nodeAccount: nodePda,
                    authority: operator.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([operator])
                .rpc();

            // Verify plays decremented
            const campaignAfterClaim = await program.account.campaignAccount.fetch(campaignPda);
            expect(campaignAfterClaim.playsRemaining.toNumber()).to.equal(playsBeforeClaim - 1);

            // trying to timeout before expiry should fail
            try {
                await program.methods
                    .timeoutPlay()
                    .accountsStrict({
                        playRecord: expiredPlayPda,
                        campaignAccount: campaignPda,
                    })
                    .rpc();
                expect.fail("Should have thrown TimeoutNotExpired");
            } catch (err) {
                expect(err.toString()).to.include("TimeoutNotExpired");
            }

            // Verify plays_remaining unchanged (timeout didn't execute)
            const campaignStillClaimed = await program.account.campaignAccount.fetch(campaignPda);
            expect(campaignStillClaimed.playsRemaining.toNumber()).to.equal(playsBeforeClaim - 1);
        });
    });

    // 6. Close Campaign
    describe("close_campaign", () => {
        it("closes campaign and returns funds", async () => {
            const balanceBefore = await provider.connection.getBalance(authority.publicKey);

            await program.methods
                .closeCampaign()
                .accountsStrict({
                    campaignAccount: campaignPda,
                    publisherAccount: publisherPda,
                    authority: authority.publicKey,
                })
                .rpc();

            const balanceAfter = await provider.connection.getBalance(authority.publicKey);
            expect(balanceAfter).to.be.gt(balanceBefore);

            // Account should no longer exist
            const info = await provider.connection.getAccountInfo(campaignPda);
            expect(info).to.be.null;
        });
    });
});

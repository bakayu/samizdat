# Samizdat Protocol

**Decentralized Digital Signage Network (DePIN) on Solana**

Samizdat is a permissionless protocol connecting content publishers with display node operators. Content lives on decentralized storage (Arweave/IPFS), while Solana handles matching, payments, and proof-of-play verification.

## 🛣️ Roadmap

- [x] Core program architecture
- [x] Multi-CID ad campaigns
- [x] On-chain target filter matching
- [x] Per-node claim cooldown
- [x] Upfront campaign funding
- [ ] Screen reputation system
- [ ] Video content support

## Overview

**Publishers** upload content to decentralized storage and create campaigns specifying targeting criteria, bounty per play, and cooldown between claims. Campaigns are fully funded at creation.

**Operators** run display nodes (screens) that discover eligible campaigns, claim them, display content, and submit confirmation to receive bounty payments directly to their wallet.

The protocol ensures publishers only pay for confirmed displays while operators maintain full control over what appears on their hardware via `blocked_tag_mask`.

## Core Architecture

**PublisherAccount (PDA)**: Publisher identity with aggregate stats.

**CampaignAccount (PDA)**: Campaign state — CIDs, targeting filters, content tag bitmask, bounty rate, claim cooldown, and SOL vault.

**NodeAccount (PDA)**: Display node specs — location, screen size, blocked content tags, estimated footfall, and lifetime earnings.

**PlayRecord (PDA)**: Tracks individual display claims and confirmations with 5-minute timeout protection.

**ClaimCooldown (PDA)**: Per-(campaign, node) tracker preventing rapid re-claims by the same node.

### Flow

```
Publisher → Upload CID → Create Campaign (auto-funded) → Active
                              ↓
Operator → Query Campaigns → Claim (on-chain filter match) → Display → Confirm → Payment
                              ↓
                         Timeout Recovery (permissionless)
```

## Quick Start

### Prerequisites

- Rust 1.85+, Solana CLI 3.0+, Anchor 0.32+, Node.js 18+, Yarn

### Build and Test

```bash
git clone https://github.com/bakayu/samizdat

cd samizdat

yarn install

anchor build

anchor test
```

## Documentation

- [Architecture](./docs/README.md) — System design, state machines, and workflows
- [Account Structures](./docs/accounts.md) — All PDAs, fields, and derivation examples
- [Instructions Reference](./docs/instructions.md) — Every instruction with accounts, args, and validations
- [Error Codes](./docs/errors.md) — All error variants categorized by type

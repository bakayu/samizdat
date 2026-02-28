# Error Codes

All error variants emitted by the Samizdat program.

```rust
pub enum SamizdatError {
    InvalidCampaignId,        // "Invalid campaign ID"
    TooManyCids,              // "Too many CIDs (max 10)"
    InvalidBounty,            // "Bounty per play must be > 0"
    InvalidPlays,             // "Total plays must be > 0"
    NoPlaysRemaining,         // "Campaign has no plays remaining"
    InsufficientFunds,        // "Insufficient vault balance"
    TargetMismatch,           // "Node does not match target filters"
    ContentFilterViolation,   // "Content violates node filters"
    ExistingClaim,            // "Existing unclaimed play record"
    InvalidPlayStatus,        // "Play record not in claimed status"
    TimeoutNotExpired,        // "Confirmation timeout not yet expired"
    TimeoutExpired,           // "Confirmation timeout has expired"
    Unauthorized,             // "Unauthorized"
    CampaignNotActive,        // "Campaign is not active"
    NodeNotActive,            // "Node is not active"
    PublisherNotActive,       // "Publisher is not active"
    PublisherMismatch,        // "Publisher account does not match"
    InvalidCid,               // "Invalid CID: empty or exceeds max length"
    InvalidAmount,            // "Amount must be greater than zero"
    InvalidCidIndex,          // "Invalid CID index"
    InvalidStatusTransition,  // "Invalid status transition"
    CooldownNotExpired,       // "Node must wait for cooldown before claiming this campaign again"
    ArithmeticOverflow,       // "Arithmetic overflow"
}
```

---

## Error Categories

### Input Validation

| Error | Thrown by | Condition |
|---|---|---|
| `InvalidBounty` | `create_campaign` | `bounty_per_play == 0` |
| `InvalidPlays` | `create_campaign` | `total_plays == 0` |
| `InvalidAmount` | `fund_campaign`, `create_campaign` | `amount == 0` or `claim_cooldown < 0` |
| `TooManyCids` | `create_campaign`, `add_cids_to_campaign` | CID count exceeds 10 |
| `InvalidCid` | `create_campaign`, `add_cids_to_campaign` | CID empty or > 200 chars |
| `InvalidCidIndex` | `claim_campaign` | `cid_index >= campaign.cids.len()` |
| `ArithmeticOverflow` | `create_campaign` | `total_plays × bounty_per_play` overflows `u64` |

### Authorization

| Error | Thrown by | Condition |
|---|---|---|
| `Unauthorized` | Multiple | Signer doesn't match account authority |
| `PublisherMismatch` | `fund_campaign`, `update_campaign`, etc. | Campaign's publisher doesn't match |

### State Validation

| Error | Thrown by | Condition |
|---|---|---|
| `CampaignNotActive` | `claim_campaign`, `update_campaign`, etc. | Campaign in wrong status |
| `NodeNotActive` | `claim_campaign` | Node not Active |
| `PublisherNotActive` | `create_campaign` | Publisher not Active |
| `NoPlaysRemaining` | `claim_campaign` | `plays_remaining == 0` |
| `InvalidPlayStatus` | `confirm_play`, `timeout_play` | PlayRecord not in `Claimed` status |
| `InvalidStatusTransition` | `update_campaign` | Publisher tried to set `Closed` status |

### Matching & Filters

| Error | Thrown by | Condition |
|---|---|---|
| `TargetMismatch` | `claim_campaign` | Node fails campaign target filters |
| `ContentFilterViolation` | `claim_campaign` | Campaign tags overlap with node's blocked mask |
| `CooldownNotExpired` | `claim_campaign` | Node reclaiming before cooldown elapsed |
| `InsufficientFunds` | `claim_campaign` | Vault balance < `bounty_per_play` |

### Timing

| Error | Thrown by | Condition |
|---|---|---|
| `TimeoutExpired` | `confirm_play` | Confirmation after 5-minute window |
| `TimeoutNotExpired` | `timeout_play` | Timeout called before 5-minute window |

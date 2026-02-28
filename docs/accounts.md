# Account Structures

All on-chain state for Samizdat, including PDA seeds, field definitions, and derivation examples.

---

## PublisherAccount

**Seeds**: `["publisher", authority.key()]`

Represents a publisher entity. Required before creating campaigns.

```rust
pub struct PublisherAccount {
    pub authority: Pubkey,          // Publisher wallet
    pub total_campaigns: u64,       // Lifetime campaign count
    pub total_spent: u64,           // Total lamports spent across all campaigns
    pub registered_at: i64,         // Unix timestamp
    pub status: PublisherStatus,    // Active | Suspended
    pub bump: u8,
}
```

### PublisherStatus

| Status | Description |
|---|---|
| `Active` | Can create and manage campaigns |
| `Suspended` | Cannot create new campaigns |

---

## CampaignAccount

**Seeds**: `["campaign", publisher_account.key(), campaign_id.to_le_bytes()]`

Stores an individual campaign's content CIDs, targeting filters, bounty rates, cooldown, and acts as the payment vault (excess lamports above rent-exempt minimum).

```rust
pub struct CampaignAccount {
    pub publisher_account: Pubkey,  // Parent PublisherAccount
    pub campaign_id: u64,           // Unique within publisher scope
    pub cids: Vec<String>,          // Content IDs (max 10, each ≤200 chars)
    pub bounty_per_play: u64,       // Lamports per confirmed display
    pub plays_remaining: u64,       // Remaining display slots
    pub plays_completed: u64,       // Lifetime confirmed displays
    pub tag_mask: u64,              // Bitmask of content categories
    pub target_filters: TargetFilters,
    pub status: CampaignStatus,
    pub claim_cooldown: i64,        // Min seconds between claims by same node (≥0)
    pub created_at: i64,            // Unix timestamp
    pub bump: u8,
}
```

### CampaignStatus

| Status | Description | Transitions to |
|---|---|---|
| `Active` | Accepting claims | Paused, Depleted, Closed |
| `Paused` | Temporarily halted by publisher | Active, Depleted, Closed |
| `Depleted` | No plays remaining; auto-transitions to Paused on funding | Paused (via fund), Active, Closed |
| `Closed` | Permanently closed, funds returned | *(terminal)* |

> **Note**: Publishers can set status to Active, Paused, or Depleted via `update_campaign`. Closed is only set by `close_campaign`. Funding a Depleted campaign auto-transitions it to Paused.

### TargetFilters

```rust
pub struct TargetFilters {
    pub min_footfall: Option<u32>,
    pub max_footfall: Option<u32>,
    pub screen_sizes: Vec<ScreenSize>,      // max 4
    pub geo_bounds: Option<GeoBounds>,
    pub establishment_types: Vec<String>,    // max 5, each ≤32 chars
    pub required_landmarks: Vec<String>,     // max 5, each ≤32 chars
}
```

### GeoBounds

Fixed-point coordinates (degrees × 1e7).

```rust
pub struct GeoBounds {
    pub min_lat: i64,
    pub max_lat: i64,
    pub min_lon: i64,
    pub max_lon: i64,
}
```

### Content Tag Bitmask

Protocol-level content categories. Publishers SET bits on `tag_mask`; node operators BLOCK matching bits via `blocked_tag_mask`.

| Constant | Bit | Description |
|---|---|---|
| `TAG_NONE` | `0` | No tags |
| `TAG_CRYPTO` | `1 << 0` | Cryptocurrency |
| `TAG_BETTING` | `1 << 1` | Betting/gambling |
| `TAG_NSFW` | `1 << 2` | Adult content |
| `TAG_POLITICAL` | `1 << 3` | Political |
| `TAG_ALCOHOL` | `1 << 4` | Alcohol |

Bits 16–63 reserved for future protocol upgrades.

**Matching**: `campaign.tag_mask & node.blocked_tag_mask != 0` → node skips this campaign.

---

## NodeAccount

**Seeds**: `["node_account", authority.key(), node_id.to_le_bytes()]`

Stores display node specs, location, content filters, and lifetime earnings.

```rust
pub struct NodeAccount {
    pub authority: Pubkey,              // Node operator wallet
    pub node_id: u64,                   // Unique within operator scope
    pub location: GeoLocation,          // Fixed-point lat/lon
    pub screen_size: ScreenSize,        // Small | Medium | Large | XLarge
    pub resolution: Resolution,         // width × height pixels
    pub landmarks: Vec<String>,         // Nearby POIs (max 5, each ≤32 chars)
    pub blocked_tag_mask: u64,          // Bitmask of blocked content categories
    pub estimated_footfall: u32,        // Estimated daily foot traffic
    pub establishment_type: String,     // e.g. "cafe", "mall" (≤32 chars)
    pub total_plays: u64,               // Lifetime confirmed displays
    pub total_earnings: u64,            // Lifetime lamports earned
    pub registered_at: i64,             // Unix timestamp
    pub status: NodeStatus,             // Active | Offline | Suspended
    pub bump: u8,
}
```

### Supporting Types

```rust
pub struct GeoLocation {
    pub latitude: i64,   // degrees × 1e7 (e.g. 40.7128° → 407128000)
    pub longitude: i64,  // degrees × 1e7 (e.g. -74.006° → -740060000)
}

pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

pub enum ScreenSize {
    Small,   // < 32"
    Medium,  // 32–55"
    Large,   // 55–80"
    XLarge,  // > 80" (billboards)
}

pub enum NodeStatus {
    Active,
    Offline,
    Suspended,
}
```

---

## PlayRecord

**Seeds**: `["play_record", campaign_account.key(), node_account.key(), nonce.to_le_bytes()]`

Tracks a single display claim through its lifecycle.

```rust
pub struct PlayRecord {
    pub campaign_account: Pubkey,   // Associated campaign
    pub node_account: Pubkey,       // Associated node
    pub nonce: i64,                 // Caller-provided uniqueness nonce
    pub claimed_at: i64,            // Unix timestamp of claim
    pub confirmed_at: i64,          // Unix timestamp of confirmation (0 if pending)
    pub cid_index: u8,              // Index into campaign's CID list
    pub payment_amount: u64,        // Lamports paid (0 until confirmed)
    pub status: PlayStatus,         // Claimed | Paid | TimedOut
    pub bump: u8,
}
```

### PlayStatus

| Status | Description |
|---|---|
| `Claimed` | Node claimed, timeout window active |
| `Paid` | Bounty transferred to operator |
| `TimedOut` | Claim expired, play count restored |

---

## ClaimCooldown

**Seeds**: `["cooldown", campaign_account.key(), node_account.key()]`

Tracks the last time a specific node claimed a specific campaign, used to enforce the publisher's `claim_cooldown` setting.

```rust
pub struct ClaimCooldown {
    pub campaign: Pubkey,       // Associated campaign
    pub node: Pubkey,           // Associated node
    pub last_claimed_at: i64,   // Unix timestamp of last claim
    pub bump: u8,
}
```

Created automatically on first claim (via `init_if_needed`) and updated on each subsequent claim.

---

## Account Relationships

```
PublisherAccount (1) ──── (N) CampaignAccount ──┬── (N) PlayRecord ──── (N) NodeAccount (1)
                                                 │
                                                 └── (N) ClaimCooldown ─── (1) NodeAccount
```

- One PublisherAccount can own many CampaignAccounts
- One CampaignAccount can have many PlayRecords and ClaimCooldowns
- One NodeAccount can participate in many PlayRecords and ClaimCooldowns
- Each PlayRecord links exactly one CampaignAccount to one NodeAccount
- Campaign vault is the excess SOL in the CampaignAccount above rent-exempt minimum

---

## PDA Derivation Examples

```rust
// PublisherAccount
let (publisher_pda, _) = Pubkey::find_program_address(
    &[b"publisher", authority.key().as_ref()],
    program_id,
);

// CampaignAccount
let (campaign_pda, _) = Pubkey::find_program_address(
    &[b"campaign", publisher_account.key().as_ref(), &campaign_id.to_le_bytes()],
    program_id,
);

// NodeAccount
let (node_pda, _) = Pubkey::find_program_address(
    &[b"node_account", authority.key().as_ref(), &node_id.to_le_bytes()],
    program_id,
);

// PlayRecord
let (play_pda, _) = Pubkey::find_program_address(
    &[b"play_record", campaign.key().as_ref(), node.key().as_ref(), &nonce.to_le_bytes()],
    program_id,
);

// ClaimCooldown
let (cooldown_pda, _) = Pubkey::find_program_address(
    &[b"cooldown", campaign.key().as_ref(), node.key().as_ref()],
    program_id,
);
```

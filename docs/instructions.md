# Instructions Reference

All Samizdat program instructions, their accounts, arguments, validations, and side effects.

---

## Publisher Instructions

### register_publisher

Creates a `PublisherAccount` for a new publisher entity.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `publisher_account` | init, PDA | PublisherAccount to create |
| `authority` | signer, mut | Publisher wallet (pays rent) |
| `system_program` | program | System program |

**Args:** None

**Side Effects:**
- Initializes PublisherAccount with status `Active`

---

### create_campaign

Creates a new campaign with content CIDs, targeting criteria, and fully funds it upfront.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `campaign_account` | init, PDA | CampaignAccount to create |
| `publisher_account` | mut, PDA | Parent PublisherAccount |
| `authority` | signer, mut | Publisher wallet (pays rent + funding) |
| `system_program` | program | System program |

**Args:**

| Field | Type | Description |
|---|---|---|
| `campaign_id` | `u64` | Unique ID scoped to this publisher |
| `cids` | `Vec<String>` | Content IDs (1–10, each ≤200 chars) |
| `bounty_per_play` | `u64` | Lamports per confirmed display |
| `total_plays` | `u64` | Number of display slots |
| `tag_mask` | `u64` | Content category bitmask |
| `target_filters` | `TargetFilters` | Node targeting criteria |
| `claim_cooldown` | `i64` | Min seconds between claims by same node (≥0) |

**Validation:**
- Publisher must be `Active`
- 1 ≤ `cids.len()` ≤ 10; each CID non-empty and ≤200 chars
- `bounty_per_play > 0`
- `total_plays > 0`
- `claim_cooldown >= 0`
- Authority matches `publisher_account.authority`

**Funding:**
- Automatically transfers `total_plays × bounty_per_play` lamports from authority to campaign vault at creation

**Side Effects:**
- Increments `publisher_account.total_campaigns`
- Campaign starts in `Active` status

---

### fund_campaign

Adds additional SOL to campaign vault.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `campaign_account` | mut, PDA | CampaignAccount to fund |
| `publisher_account` | PDA | Parent PublisherAccount |
| `authority` | signer, mut | Publisher wallet |
| `system_program` | program | System program |

**Args:**

| Field | Type | Description |
|---|---|---|
| `amount` | `u64` | Lamports to transfer |

**Validation:**
- Campaign status is not `Closed`
- `amount > 0`

**Side Effects:**
- If campaign was `Depleted`, auto-transitions to `Paused` (publisher must manually reactivate)

---

### update_campaign

Updates campaign targeting, tag mask, or status.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `campaign_account` | mut, PDA | CampaignAccount to update |
| `publisher_account` | PDA | Parent PublisherAccount |
| `authority` | signer | Publisher wallet |

**Args:**

| Field | Type | Description |
|---|---|---|
| `tag_mask` | `Option<u64>` | New content tag bitmask |
| `target_filters` | `Option<TargetFilters>` | New targeting criteria |
| `status` | `Option<CampaignStatus>` | New status |

**Validation:**
- Campaign must not be `Closed`
- Status can only be set to `Active`, `Paused`, or `Depleted` (not `Closed`)

---

### add_cids_to_campaign

Appends additional content CIDs to an existing campaign.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `campaign_account` | mut, PDA | CampaignAccount to update |
| `publisher_account` | PDA | Parent PublisherAccount |
| `authority` | signer | Publisher wallet |

**Args:**

| Field | Type | Description |
|---|---|---|
| `new_cids` | `Vec<String>` | CIDs to add |

**Validation:**
- Campaign must be `Active`
- Total CIDs after addition ≤ 10
- Each new CID non-empty and ≤200 chars

---

### close_campaign

Closes campaign permanently and returns remaining vault funds to publisher.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `campaign_account` | mut, close, PDA | CampaignAccount to close |
| `publisher_account` | PDA | Parent PublisherAccount |
| `authority` | signer, mut | Receives remaining funds |

**Args:** None

**Side Effects:**
- Account zeroed and lamports returned to authority via Anchor's `close` constraint

---

## Operator Instructions

### register_node

Registers a new display node with physical specs and content filters.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `node_account` | init, PDA | NodeAccount to create |
| `authority` | signer, mut | Node operator wallet (pays rent) |
| `system_program` | program | System program |

**Args:**

| Field | Type | Description |
|---|---|---|
| `node_id` | `u64` | Unique ID scoped to this operator |
| `location` | `GeoLocation` | Fixed-point lat/lon (×1e7) |
| `screen_size` | `ScreenSize` | Small / Medium / Large / XLarge |
| `resolution` | `Resolution` | Width × height in pixels |
| `landmarks` | `Vec<String>` | Nearby POIs (max 5, each ≤32 chars) |
| `blocked_tag_mask` | `u64` | Content categories to block |
| `estimated_footfall` | `u32` | Estimated daily foot traffic |
| `establishment_type` | `String` | Location type (≤32 chars) |

---

### update_node_metadata

Updates node location, footfall, content filters, or status.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `node_account` | mut, PDA | NodeAccount to update |
| `authority` | signer | Node operator wallet |

**Args:**

| Field | Type | Description |
|---|---|---|
| `location` | `Option<GeoLocation>` | New location |
| `estimated_footfall` | `Option<u32>` | New footfall estimate |
| `blocked_tag_mask` | `Option<u64>` | New blocked tags |
| `status` | `Option<NodeStatus>` | New status |

---

## Play Cycle Instructions

### claim_campaign

Node claims a campaign for display, creating a PlayRecord and starting the timeout window.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `play_record` | init, PDA | PlayRecord to create |
| `claim_cooldown` | init_if_needed, PDA | ClaimCooldown tracker |
| `campaign_account` | mut, PDA | Campaign being claimed |
| `node_account` | mut, PDA | Claiming node |
| `authority` | signer, mut | Node operator wallet |
| `system_program` | program | System program |

**Args:**

| Field | Type | Description |
|---|---|---|
| `cid_index` | `u8` | Index into campaign's CID list |
| `claim_nonce` | `i64` | Caller-provided uniqueness nonce |

**Validation:**
- Campaign status is `Active`
- Node status is `Active`
- `plays_remaining > 0`
- `cid_index` within bounds of campaign's CID list
- Campaign `tag_mask` does not overlap with node's `blocked_tag_mask`
- Node passes all campaign `target_filters` (footfall, screen size, geo bounds, establishment type, landmarks)
- Campaign vault balance ≥ `bounty_per_play` (above rent-exempt minimum)
- Node respects campaign's `claim_cooldown` (time since last claim by this node)

**Side Effects:**
- Decrements `campaign_account.plays_remaining`
- Creates/updates `ClaimCooldown` with current timestamp
- Creates `PlayRecord` with status `Claimed`
- 5-minute (300s) timeout window begins

---

### confirm_play

Node confirms content was displayed, triggering bounty payment.

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `play_record` | mut, PDA | PlayRecord to confirm |
| `campaign_account` | mut, PDA | Source campaign (vault) |
| `publisher_account` | mut, PDA | Parent publisher (for stats) |
| `node_account` | mut, PDA | Destination node (for stats) |
| `authority` | signer, mut | Node operator wallet (receives payment) |

**Args:** None

**Validation:**
- `play_record.status == Claimed`
- Within 5-minute timeout window
- `publisher_account` matches `campaign_account.publisher_account`

**Side Effects:**
- Transfers `bounty_per_play` lamports from campaign vault to operator wallet
- Sets `play_record.status` to `Paid`, records timestamp and amount
- Increments `campaign_account.plays_completed`
- Increments `node_account.total_plays` and `total_earnings`
- Increments `publisher_account.total_spent`

---

### timeout_play

Recovers play count for expired claims. **Callable by anyone** (permissionless).

**Accounts:**

| Account | Type | Description |
|---|---|---|
| `play_record` | mut, PDA | Timed-out PlayRecord |
| `campaign_account` | mut, PDA | Associated campaign |

**Args:** None

**Validation:**
- `play_record.status == Claimed`
- Current time > `claimed_at + 300` (5-minute window expired)

**Side Effects:**
- Restores `campaign_account.plays_remaining` (+1)
- Sets `play_record.status` to `TimedOut`

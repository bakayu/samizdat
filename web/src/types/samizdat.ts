// ============================================================================
// Samizdat Protocol Types
// Mirrors the on-chain account structures from programs/samizdat/src/state/
// ============================================================================

// --- Enums ---

export enum CampaignStatus {
  Active = 'Active',
  Paused = 'Paused',
  Depleted = 'Depleted',
  Closed = 'Closed',
}

export enum NodeStatus {
  Active = 'Active',
  Offline = 'Offline',
  Suspended = 'Suspended',
}

export enum PublisherStatus {
  Active = 'Active',
  Suspended = 'Suspended',
}

export enum PlayStatus {
  Claimed = 'Claimed',
  Paid = 'Paid',
  TimedOut = 'TimedOut',
}

export enum ScreenSize {
  Small = 'Small',
  Medium = 'Medium',
  Large = 'Large',
  XLarge = 'XLarge',
}

// --- Content Tags (bitmask) ---

export const TAG_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Crypto',
  2: 'Betting',
  4: 'NSFW',
  8: 'Political',
  16: 'Alcohol',
};

export const TAG_BITS = [
  { bit: 1, label: 'Crypto' },
  { bit: 2, label: 'Betting' },
  { bit: 4, label: 'NSFW' },
  { bit: 8, label: 'Political' },
  { bit: 16, label: 'Alcohol' },
] as const;

// --- Structs ---

export interface GeoLocation {
  /** Latitude in fixed-point (degrees × 1e7) */
  latitude: number;
  /** Longitude in fixed-point (degrees × 1e7) */
  longitude: number;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface TargetFilters {
  minFootfall: number | null;
  maxFootfall: number | null;
  screenSizes: ScreenSize[];
  geoBounds: GeoBounds | null;
  establishmentTypes: string[];
  requiredLandmarks: string[];
}

// --- Account Types ---

export interface PublisherAccount {
  address: string;
  authority: string;
  totalCampaigns: number;
  totalSpent: number;
  registeredAt: number;
  status: PublisherStatus;
}

export interface CampaignAccount {
  address: string;
  publisherAccount: string;
  campaignId: number;
  cids: string[];
  bountyPerPlay: number;
  playsRemaining: number;
  playsCompleted: number;
  tagMask: number;
  targetFilters: TargetFilters;
  status: CampaignStatus;
  claimCooldown: number;
  createdAt: number;
}

export interface NodeAccount {
  address: string;
  authority: string;
  nodeId: number;
  location: GeoLocation;
  screenSize: ScreenSize;
  resolution: Resolution;
  landmarks: string[];
  blockedTagMask: number;
  estimatedFootfall: number;
  establishmentType: string;
  totalPlays: number;
  totalEarnings: number;
  registeredAt: number;
  status: NodeStatus;
}

export interface PlayRecord {
  address: string;
  campaignAccount: string;
  nodeAccount: string;
  nonce: number;
  claimedAt: number;
  confirmedAt: number;
  cidIndex: number;
  paymentAmount: number;
  status: PlayStatus;
}

export interface ClaimCooldown {
  campaign: string;
  node: string;
  lastClaimedAt: number;
}

// --- Helpers ---

/** Convert fixed-point i64 (× 1e7) to human-readable degrees */
export function geoToDecimal(fixedPoint: number): number {
  return fixedPoint / 1e7;
}

/** Convert lamports to SOL */
export function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

/** Extract tag labels from a bitmask */
export function tagsFromMask(mask: number): string[] {
  return TAG_BITS.filter(t => (mask & t.bit) !== 0).map(t => t.label);
}

/** Truncate a Solana address for display */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

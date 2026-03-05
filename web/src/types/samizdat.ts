/**
 * Samizdat Protocol — shared types and helpers.
 *
 * All account structs, enums and value types come directly from the
 * Codama-generated client (`@client/index`). This file re-exports
 * the ones the UI cares about and adds a thin display-helper layer.
 */

import {
  CampaignStatus,
  NodeStatus,
  PlayStatus,
  PublisherStatus,
  ScreenSize,
} from '@client/index';
import { isSome, type Option } from '@solana/kit';

// ─── Re-exports from generated client ───────────────────────────────────────

export { CampaignStatus, NodeStatus, PlayStatus, PublisherStatus, ScreenSize };

export type {
  CampaignAccount,
  NodeAccount,
  PlayRecord,
  PublisherAccount,
} from '@client/index';

export type {
  GeoLocation,
  GeoBounds,
  Resolution,
  TargetFilters,
  TargetFiltersArgs,
} from '@client/index';

// ─── Utility: attach a PDA address to an account data struct ────────────────

/** The generated account types don't carry their on-chain address.
 *  We pair them with the address from the `Account<T>` envelope. */
export type WithAddress<T> = T & { address: string };

// ─── bigint → number for display ────────────────────────────────────────────

/** Safely coerce bigint/number to JS number for display. */
export const num = (v: bigint | number): number => Number(v);

// ─── Option<T> unwrapping ───────────────────────────────────────────────────

/** Unwrap Option<T> → T | null (avoids importing isSome in every page). */
export function unwrap<T>(opt: Option<T>): T | null {
  return isSome(opt) ? opt.value : null;
}

// ─── ScreenSize display helpers ─────────────────────────────────────────────

/** The four enum members as a plain array (avoids Object.values quirks). */
export const SCREEN_SIZES = [
  ScreenSize.Small,
  ScreenSize.Medium,
  ScreenSize.Large,
  ScreenSize.XLarge,
] as const;

/** Numeric ScreenSize → human label.  Uses the enum's reverse mapping. */
export const screenSizeLabel = (s: ScreenSize): string => ScreenSize[s];

/** Form string → numeric enum lookup. */
export const parseScreenSize = (s: string): ScreenSize =>
  ScreenSize[s as keyof typeof ScreenSize];

// ─── CampaignStatus display helpers ─────────────────────────────────────────

/** The four statuses as a plain array. */
export const CAMPAIGN_STATUSES = [
  CampaignStatus.Active,
  CampaignStatus.Paused,
  CampaignStatus.Depleted,
  CampaignStatus.Closed,
] as const;

/** Numeric CampaignStatus → human label. */
export const campaignStatusLabel = (s: CampaignStatus): string => CampaignStatus[s];

// ─── Content-tag bitmask helpers ────────────────────────────────────────────

export const TAG_BITS = [
  { bit: 1n, label: 'Crypto' },
  { bit: 2n, label: 'Betting' },
  { bit: 4n, label: 'NSFW' },
  { bit: 8n, label: 'Political' },
  { bit: 16n, label: 'Alcohol' },
] as const;

/** Extract human-readable tag labels from a bitmask. */
export function tagsFromMask(mask: bigint | number): string[] {
  const m = BigInt(mask);
  return TAG_BITS.filter(t => (m & t.bit) !== 0n).map(t => t.label);
}

// ─── Display helpers ────────────────────────────────────────────────────────

/** Convert fixed-point i64 (degrees × 1e7) to decimal degrees. */
export function geoToDecimal(fixedPoint: bigint | number): number {
  return Number(BigInt(fixedPoint)) / 1e7;
}

/** Convert lamports (u64) to SOL. */
export function lamportsToSol(lamports: bigint | number): number {
  return Number(BigInt(lamports)) / 1e9;
}

/** Truncate a Solana address for display. */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

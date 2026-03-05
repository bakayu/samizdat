import { z } from 'zod';

// ============================================================================
// Zod Validation Schemas — form validation for Samizdat protocol interactions
// ============================================================================

// --- Create Campaign ---

export const createCampaignSchema = z.object({
  campaignId: z.coerce
    .number({ message: 'Required' })
    .int('Must be an integer')
    .positive('Must be positive'),
  cids: z
    .string()
    .min(1, 'At least one CID is required')
    .transform(val =>
      val
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
    )
    .refine(arr => arr.length <= 10, 'Max 10 CIDs')
    .refine(
      arr => arr.every(s => s.length >= 10),
      'Each CID must be at least 10 characters'
    ),
  bountyPerPlay: z.coerce.number({ message: 'Required' }).positive('Must be positive'),
  totalPlays: z.coerce
    .number({ message: 'Required' })
    .int('Must be an integer')
    .positive('Must be positive'),
  claimCooldown: z.coerce
    .number({ message: 'Required' })
    .int('Must be an integer')
    .positive('Must be positive'),
  tagMask: z.number().int().min(0).default(0),

  // Target filters — optional
  minFootfall: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
  maxFootfall: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
  screenSizes: z.array(z.string()).default([]),
  geoBoundsMinLat: z.union([z.coerce.number(), z.literal('')]).optional(),
  geoBoundsMaxLat: z.union([z.coerce.number(), z.literal('')]).optional(),
  geoBoundsMinLon: z.union([z.coerce.number(), z.literal('')]).optional(),
  geoBoundsMaxLon: z.union([z.coerce.number(), z.literal('')]).optional(),
  establishmentTypes: z.string().optional(),
  requiredLandmarks: z.string().optional(),
});

export type CreateCampaignForm = z.infer<typeof createCampaignSchema>;
export type CreateCampaignFormInput = z.input<typeof createCampaignSchema>;

// --- Register Node ---

export const registerNodeSchema = z.object({
  nodeId: z.coerce
    .number({ message: 'Required' })
    .int('Must be an integer')
    .positive('Must be positive'),
  latitude: z.coerce
    .number({ message: 'Required' })
    .min(-90, 'Min -90°')
    .max(90, 'Max 90°'),
  longitude: z.coerce
    .number({ message: 'Required' })
    .min(-180, 'Min -180°')
    .max(180, 'Max 180°'),
  screenSize: z.enum(['Small', 'Medium', 'Large', 'XLarge'], {
    message: 'Select a screen size',
  }),
  resolutionWidth: z.coerce
    .number({ message: 'Required' })
    .int()
    .positive('Must be positive'),
  resolutionHeight: z.coerce
    .number({ message: 'Required' })
    .int()
    .positive('Must be positive'),
  landmarks: z.string().optional(),
  blockedTagMask: z.bigint().min(0n).default(0n),
  estimatedFootfall: z.coerce
    .number({ message: 'Required' })
    .int()
    .min(0, 'Must be non-negative'),
  establishmentType: z.string().min(1, 'Required'),
});

export type RegisterNodeForm = z.infer<typeof registerNodeSchema>;

// --- Update Node Settings ---

export const updateNodeSettingsSchema = z.object({
  latitude: z.coerce
    .number({ message: 'Required' })
    .min(-90, 'Min -90°')
    .max(90, 'Max 90°'),
  longitude: z.coerce
    .number({ message: 'Required' })
    .min(-180, 'Min -180°')
    .max(180, 'Max 180°'),
  estimatedFootfall: z.coerce
    .number({ message: 'Required' })
    .int()
    .min(0, 'Must be non-negative'),
  blockedTagMask: z.bigint().min(0n).default(0n),
});

export type UpdateNodeSettingsForm = z.infer<typeof updateNodeSettingsSchema>;

// --- Fund Campaign ---

export const fundCampaignSchema = z.object({
  amount: z.coerce.number({ message: 'Required' }).positive('Must be positive'),
});

export type FundCampaignForm = z.infer<typeof fundCampaignSchema>;

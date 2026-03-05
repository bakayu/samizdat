import { useCallback, useContext, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CurrencyDollar,
  Eye,
  Loading01,
  PauseCircle,
  Plus,
  Send01,
  Trash01,
  XCircle,
  Zap,
} from '@untitledui/icons';
import { UiWalletAccount } from '@wallet-standard/react';
import { AnimatePresence, motion } from 'motion/react';
import { Controller, useForm } from 'react-hook-form';

import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { ProgressBar } from '@/components/base/progress-indicators/progress-indicators';
import { TextArea } from '@/components/base/textarea/textarea';
import { SelectedWalletAccountContext } from '@/context/selected-wallet-account-context';
import {
  useSamizdatService,
  type SamizdatService,
} from '@/providers/samizdat-service-provider';
import {
  CAMPAIGN_STATUSES,
  type CampaignAccount,
  CampaignStatus,
  type PublisherAccount,
  SCREEN_SIZES,
  TAG_BITS,
  type TargetFiltersArgs,
  type WithAddress,
  campaignStatusLabel,
  lamportsToSol,
  num,
  parseScreenSize,
  screenSizeLabel,
  shortenAddress,
  tagsFromMask,
  unwrap,
} from '@/types/samizdat';
import { pollUntilReady } from '@/utils/poll-until-ready';
import {
  type CreateCampaignForm,
  type CreateCampaignFormInput,
  createCampaignSchema,
} from '@/utils/schemas';

// ============================================================================
// Publisher Dashboard
// ============================================================================

function StatusBadge({ status }: { status: CampaignStatus }) {
  const config = {
    [CampaignStatus.Active]: { color: 'success' as const, label: 'Active' },
    [CampaignStatus.Paused]: { color: 'warning' as const, label: 'Paused' },
    [CampaignStatus.Depleted]: { color: 'error' as const, label: 'Depleted' },
    [CampaignStatus.Closed]: { color: 'gray' as const, label: 'Closed' },
  };

  const c = config[status];

  return (
    <BadgeWithDot color={c.color} type="pill-color" size="sm">
      {c.label}
    </BadgeWithDot>
  );
}

function CampaignRow({
  campaign,
  onSelect,
}: {
  campaign: WithAddress<CampaignAccount>;
  onSelect: (c: WithAddress<CampaignAccount>) => void;
}) {
  const total = num(campaign.playsRemaining) + num(campaign.playsCompleted);
  const pct = total > 0 ? (num(campaign.playsCompleted) / total) * 100 : 0;
  const tags = tagsFromMask(campaign.tagMask);

  return (
    <motion.tr
      className="cursor-pointer border-b border-secondary transition duration-100 hover:bg-primary_hover"
      onClick={() => onSelect(campaign)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-primary">
          #{String(campaign.campaignId)}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={campaign.status} />
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-brand-500">
          {lamportsToSol(campaign.bountyPerPlay)} SOL
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-xs text-tertiary">
              {num(campaign.playsCompleted)}/{total}
            </span>
            <span className="font-mono text-xs text-quaternary">{Math.round(pct)}%</span>
          </div>
          <ProgressBar value={pct} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {tags.length > 0 ? (
            tags.map(tag => (
              <Badge key={tag} color="brand" size="sm" type="pill-color">
                {tag}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-quaternary">None</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs text-tertiary">
          {new Date(num(campaign.createdAt) * 1000).toLocaleDateString()}
        </span>
      </td>
    </motion.tr>
  );
}

function CampaignDetail({
  campaign,
  service,
  onClose,
  onRefresh,
}: {
  campaign: WithAddress<CampaignAccount>;
  service: SamizdatService;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const total = num(campaign.playsRemaining) + num(campaign.playsCompleted);
  const pct = total > 0 ? (num(campaign.playsCompleted) / total) * 100 : 0;
  const tags = tagsFromMask(campaign.tagMask);
  const tf = campaign.targetFilters;

  const doAction = async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      onRefresh();
      onClose();
    } catch (err) {
      console.error(`${label} failed:`, err);
      alert(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl rounded-xl border border-secondary bg-primary p-6 shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-display-xs text-primary">
                Campaign #{String(campaign.campaignId)}
              </h2>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="mt-1 font-mono text-xs text-quaternary">{campaign.address}</p>
          </div>
          <Button size="sm" color="tertiary" onClick={onClose}>
            ✕
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-secondary bg-secondary p-4">
            <p className="text-xs text-tertiary">Bounty/Play</p>
            <p className="mt-1 font-mono text-lg font-semibold text-brand-500">
              {lamportsToSol(campaign.bountyPerPlay)} SOL
            </p>
          </div>
          <div className="rounded-lg border border-secondary bg-secondary p-4">
            <p className="text-xs text-tertiary">Plays</p>
            <p className="mt-1 font-mono text-lg font-semibold text-primary">
              {num(campaign.playsCompleted)}
              <span className="text-sm text-quaternary"> / {total}</span>
            </p>
          </div>
          <div className="rounded-lg border border-secondary bg-secondary p-4">
            <p className="text-xs text-tertiary">Total Spent</p>
            <p className="mt-1 font-mono text-lg font-semibold text-primary">
              {lamportsToSol(num(campaign.playsCompleted) * num(campaign.bountyPerPlay))}{' '}
              SOL
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-tertiary">Campaign Progress</span>
            <span className="font-mono text-quaternary">{Math.round(pct)}%</span>
          </div>
          <ProgressBar value={pct} />
        </div>

        {/* Details */}
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-quaternary">Tags</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.length > 0 ? (
                tags.map(tag => (
                  <Badge key={tag} color="brand" size="sm" type="pill-color">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-tertiary">None</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-quaternary">Screen Sizes</p>
            <p className="mt-1 text-primary">
              {tf.screenSizes.length > 0
                ? tf.screenSizes.map(screenSizeLabel).join(', ')
                : 'Any'}
            </p>
          </div>
          <div>
            <p className="text-xs text-quaternary">Establishment Types</p>
            <p className="mt-1 text-primary">
              {tf.establishmentTypes.length > 0
                ? tf.establishmentTypes.join(', ')
                : 'Any'}
            </p>
          </div>
          <div>
            <p className="text-xs text-quaternary">Footfall Range</p>
            <p className="mt-1 text-primary">
              {unwrap(tf.minFootfall) ?? '—'} – {unwrap(tf.maxFootfall) ?? '∞'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-quaternary">Content CIDs</p>
            <div className="mt-1 flex flex-col gap-1">
              {campaign.cids.map((cid, i) => (
                <code key={i} className="truncate font-mono text-xs text-tertiary">
                  {cid}
                </code>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 border-t border-secondary pt-4">
          {campaign.status === CampaignStatus.Active && (
            <Button
              size="sm"
              color="secondary"
              iconLeading={PauseCircle}
              isDisabled={busy}
              onClick={() =>
                doAction('Pause campaign', () =>
                  service.updateCampaign(campaign.address, {
                    tagMask: null,
                    targetFilters: null,
                    status: CampaignStatus.Paused,
                  })
                )
              }
            >
              Pause
            </Button>
          )}
          {campaign.status === CampaignStatus.Paused && (
            <Button
              size="sm"
              color="primary"
              iconLeading={Zap}
              isDisabled={busy}
              onClick={() =>
                doAction('Resume campaign', () =>
                  service.updateCampaign(campaign.address, {
                    tagMask: null,
                    targetFilters: null,
                    status: CampaignStatus.Active,
                  })
                )
              }
            >
              Resume
            </Button>
          )}
          {campaign.status !== CampaignStatus.Closed && (
            <Button
              size="sm"
              color="primary-destructive"
              iconLeading={Trash01}
              isDisabled={busy}
              onClick={() =>
                doAction('Close campaign', () => service.closeCampaign(campaign.address))
              }
            >
              Close
            </Button>
          )}
          {busy && (
            <span className="flex items-center gap-2 text-xs text-tertiary">
              <Loading01 className="size-3.5 animate-spin" />
              Processing...
            </span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreateCampaignModal({
  service,
  onClose,
  onCreated,
}: {
  service: SamizdatService;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  const { control, handleSubmit, watch, setValue } = useForm<
    CreateCampaignFormInput,
    unknown,
    CreateCampaignForm
  >({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      campaignId: undefined,
      cids: '',
      bountyPerPlay: undefined,
      totalPlays: undefined,
      claimCooldown: 300,
      tagMask: 0,
      minFootfall: '',
      maxFootfall: '',
      screenSizes: [],
      geoBoundsMinLat: '',
      geoBoundsMaxLat: '',
      geoBoundsMinLon: '',
      geoBoundsMaxLon: '',
      establishmentTypes: '',
      requiredLandmarks: '',
    },
  });

  const tagMask = watch('tagMask') ?? 0;
  const screenSizes = watch('screenSizes') ?? [];

  const toggleTag = (bit: number) => setValue('tagMask', tagMask ^ bit);
  const toggleScreenSize = (size: string) => {
    setValue(
      'screenSizes',
      screenSizes.includes(size)
        ? screenSizes.filter(s => s !== size)
        : [...screenSizes, size]
    );
  };

  const onSubmit = async (data: CreateCampaignForm) => {
    setSubmitting(true);
    try {
      const hasGeo =
        data.geoBoundsMinLat !== '' &&
        data.geoBoundsMaxLat !== '' &&
        data.geoBoundsMinLon !== '' &&
        data.geoBoundsMaxLon !== '';

      const targetFilters: TargetFiltersArgs = {
        minFootfall:
          data.minFootfall !== '' && data.minFootfall != null
            ? Number(data.minFootfall)
            : null,
        maxFootfall:
          data.maxFootfall !== '' && data.maxFootfall != null
            ? Number(data.maxFootfall)
            : null,
        screenSizes: data.screenSizes.map(parseScreenSize),
        geoBounds: hasGeo
          ? {
              minLat: Math.round(Number(data.geoBoundsMinLat) * 1e7),
              maxLat: Math.round(Number(data.geoBoundsMaxLat) * 1e7),
              minLon: Math.round(Number(data.geoBoundsMinLon) * 1e7),
              maxLon: Math.round(Number(data.geoBoundsMaxLon) * 1e7),
            }
          : null,
        establishmentTypes: data.establishmentTypes
          ? data.establishmentTypes
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [],
        requiredLandmarks: data.requiredLandmarks
          ? data.requiredLandmarks
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [],
      };

      await service.createCampaign({
        campaignId: data.campaignId,
        cids: data.cids,
        bountyPerPlay: Math.round(data.bountyPerPlay * 1e9),
        totalPlays: data.totalPlays,
        tagMask: data.tagMask,
        targetFilters,
        claimCooldown: data.claimCooldown,
      });

      // Poll until the campaign is queryable
      await pollUntilReady(
        async () => {
          const campaigns = await service.getCampaigns();
          const found = campaigns.find(c => Number(c.campaignId) === data.campaignId && c.publisherAccount === selectedWalletAccount?.address);
          if (!found) throw new Error('Campaign not found');
          return found;
        },
        { resourceName: 'Campaign account' }
      );

      onCreated();
      onClose();
    } catch (err) {
      console.error('Create campaign failed:', err);
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-secondary bg-primary p-6 shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-display-xs text-primary">Create Campaign</h2>
          <Button size="sm" color="tertiary" onClick={onClose}>
            ✕
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* Campaign ID */}
          <Controller
            name="campaignId"
            control={control}
            render={({ field, fieldState }) => (
              <Input
                label="Campaign ID"
                placeholder="1"
                hint={fieldState.error?.message ?? 'Unique numeric ID for this campaign'}
                type="number"
                value={field.value?.toString() ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
              />
            )}
          />

          {/* Content CIDs */}
          <Controller
            name="cids"
            control={control}
            render={({ field, fieldState }) => (
              <TextArea
                label="Content CIDs"
                placeholder="One CID per line (max 10)"
                hint={fieldState.error?.message ?? 'Arweave or IPFS content identifiers'}
                value={String(field.value ?? '')}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
              />
            )}
          />

          {/* Payment */}
          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="bountyPerPlay"
              control={control}
              render={({ field, fieldState }) => (
                <Input
                  label="Bounty per Play"
                  placeholder="0.05"
                  hint={fieldState.error?.message ?? 'SOL per confirmed play'}
                  type="number"
                  value={field.value?.toString() ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                />
              )}
            />
            <Controller
              name="totalPlays"
              control={control}
              render={({ field, fieldState }) => (
                <Input
                  label="Total Plays"
                  placeholder="1000"
                  hint={fieldState.error?.message ?? 'Total number of plays to fund'}
                  type="number"
                  value={field.value?.toString() ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                />
              )}
            />
          </div>

          <Controller
            name="claimCooldown"
            control={control}
            render={({ field, fieldState }) => (
              <Input
                label="Claim Cooldown"
                placeholder="300"
                hint={fieldState.error?.message ?? 'Seconds between consecutive claims'}
                type="number"
                value={field.value?.toString() ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
              />
            )}
          />

          {/* Tags */}
          <div>
            <p className="mb-2 text-sm font-medium text-secondary">Content Tags</p>
            <div className="flex flex-wrap gap-3">
              {TAG_BITS.map(({ bit, label }) => {
                const b = Number(bit);
                return (
                  <Checkbox
                    key={b}
                    label={label}
                    size="sm"
                    isSelected={(tagMask & b) !== 0}
                    onChange={() => toggleTag(b)}
                  />
                );
              })}
            </div>
          </div>

          {/* Target Filters */}
          <div className="rounded-lg border border-secondary bg-secondary p-4">
            <p className="mb-3 text-sm font-medium text-secondary">Target Filters</p>
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="minFootfall"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Min Footfall"
                    placeholder="0"
                    type="number"
                    size="sm"
                    value={field.value?.toString() ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="maxFootfall"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Max Footfall"
                    placeholder="∞"
                    type="number"
                    size="sm"
                    value={field.value?.toString() ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-tertiary">Screen Sizes</p>
              <div className="flex flex-wrap gap-3">
                {SCREEN_SIZES.map(size => {
                  const label = screenSizeLabel(size);
                  return (
                    <Checkbox
                      key={size}
                      label={label}
                      size="sm"
                      isSelected={screenSizes.includes(label)}
                      onChange={() => toggleScreenSize(label)}
                    />
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <Controller
                name="establishmentTypes"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Establishment Types"
                    placeholder="Mall, Transit Hub"
                    hint="Comma-separated"
                    size="sm"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="requiredLandmarks"
                control={control}
                render={({ field }) => (
                  <Input
                    label="Required Landmarks"
                    placeholder="Times Square"
                    hint="Comma-separated"
                    size="sm"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-tertiary">
                Geo Bounds (decimal degrees)
              </p>
              <div className="grid grid-cols-4 gap-2">
                <Controller
                  name="geoBoundsMinLat"
                  control={control}
                  render={({ field }) => (
                    <Input
                      placeholder="Min Lat"
                      size="sm"
                      type="number"
                      value={field.value?.toString() ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="geoBoundsMaxLat"
                  control={control}
                  render={({ field }) => (
                    <Input
                      placeholder="Max Lat"
                      size="sm"
                      type="number"
                      value={field.value?.toString() ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="geoBoundsMinLon"
                  control={control}
                  render={({ field }) => (
                    <Input
                      placeholder="Min Lon"
                      size="sm"
                      type="number"
                      value={field.value?.toString() ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="geoBoundsMaxLon"
                  control={control}
                  render={({ field }) => (
                    <Input
                      placeholder="Max Lon"
                      size="sm"
                      type="number"
                      value={field.value?.toString() ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 border-t border-secondary pt-4">
            <Button size="md" color="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button size="md" iconLeading={Send01} type="submit" isDisabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loading01 className="size-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Campaign'
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// --- Helper sub-components for empty states ---

function ConnectWalletPrompt() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Eye className="size-12 text-quaternary" />
      <h2 className="font-display text-display-xs text-primary">Connect Your Wallet</h2>
      <p className="max-w-sm text-center text-sm text-tertiary">
        Connect a Solana wallet to access the publisher dashboard, create campaigns, and
        manage your content distribution.
      </p>
    </div>
  );
}

function RegisterPublisherPrompt({
  service,
  wallet,
  onRegistered,
}: {
  service: SamizdatService;
  wallet: UiWalletAccount;
  onRegistered: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleRegister = async () => {
    setBusy(true);
    try {
      await service.registerPublisher();
      // Poll until the account is queryable
      await pollUntilReady(() => service.getPublisher(wallet.address), {
        resourceName: 'Publisher account',
      });
      onRegistered();
    } catch (err) {
      console.error('Register publisher failed:', err);
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Send01 className="size-12 text-quaternary" />
      <h2 className="font-display text-display-xs text-primary">Register as Publisher</h2>
      <p className="max-w-sm text-center text-sm text-tertiary">
        You need to register a publisher account before creating campaigns. This is a
        one-time on-chain registration.
      </p>
      <Button size="md" iconLeading={Plus} onClick={handleRegister} isDisabled={busy}>
        {busy ? (
          <span className="flex items-center gap-2">
            <Loading01 className="size-4 animate-spin" />
            Registering...
          </span>
        ) : (
          'Register Publisher'
        )}
      </Button>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function PublisherDashboardPage() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  if (!selectedWalletAccount) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <ConnectWalletPrompt />
      </div>
    );
  }

  return <PublisherDashboardContent selectedWallet={selectedWalletAccount} />;
}

function PublisherDashboardContent({
  selectedWallet,
}: {
  selectedWallet: UiWalletAccount;
}) {
  const service = useSamizdatService();

  const [publisher, setPublisher] = useState<WithAddress<PublisherAccount> | null>(null);
  const [campaigns, setCampaigns] = useState<WithAddress<CampaignAccount>[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedPublisher, setCheckedPublisher] = useState(false);

  const [selectedCampaign, setSelectedCampaign] =
    useState<WithAddress<CampaignAccount> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const pub = await service.getPublisher(selectedWallet.address);
      setPublisher(pub);
      setCheckedPublisher(true);
      if (pub) {
        const camps = await service.getCampaigns();
        const publisherCampaigns = camps.filter(
          campaign => campaign.publisherAccount === pub.address
        );

        setCampaigns(publisherCampaigns);
      }
    } catch (err) {
      console.error('Failed to fetch publisher data:', err);
      setCheckedPublisher(true);
    } finally {
      setLoading(false);
    }
  }, [service, selectedWallet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Loading ---
  if (loading && !checkedPublisher) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <Loading01 className="size-8 animate-spin text-brand-500" />
          <p className="font-mono text-sm text-tertiary">Loading on-chain data...</p>
        </div>
      </div>
    );
  }

  // --- No publisher account ---
  if (!publisher) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <RegisterPublisherPrompt
          service={service}
          wallet={selectedWallet!}
          onRegistered={fetchData}
        />
      </div>
    );
  }

  // --- Computed stats ---
  const filteredCampaigns =
    statusFilter === 'all' ? campaigns : campaigns.filter(c => c.status === statusFilter);

  const statusIcon = {
    [CampaignStatus.Active]: CheckCircle,
    [CampaignStatus.Paused]: PauseCircle,
    [CampaignStatus.Depleted]: AlertCircle,
    [CampaignStatus.Closed]: XCircle,
  };

  const activeCampaigns = campaigns.filter(
    c => c.status === CampaignStatus.Active
  ).length;
  const totalPlays = campaigns.reduce((s, c) => s + num(c.playsCompleted), 0);
  const totalSpent = campaigns.reduce(
    (s, c) => s + num(c.playsCompleted) * num(c.bountyPerPlay),
    0
  );

  return (
    <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-display-sm text-primary">
            Publisher Dashboard
          </h1>
          <p className="mt-1 font-mono text-xs text-quaternary">
            {shortenAddress(publisher.address, 8)}
          </p>
        </div>
        <Button size="md" iconLeading={Plus} onClick={() => setShowCreate(true)}>
          Create Campaign
        </Button>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-secondary bg-secondary p-5">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <Eye className="size-4" />
            Total Campaigns
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-primary">
            {campaigns.length}
          </p>
        </div>
        <div className="rounded-xl border border-secondary bg-secondary p-5">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <Zap className="size-4 text-success-500" />
            Active
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-success-500">
            {activeCampaigns}
          </p>
        </div>
        <div className="rounded-xl border border-secondary bg-secondary p-5">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <Clock className="size-4" />
            Total Plays
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-primary">
            {totalPlays.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-secondary bg-secondary p-5">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <CurrencyDollar className="size-4 text-brand-500" />
            Total Spent
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-brand-500">
            {lamportsToSol(totalSpent).toFixed(2)} SOL
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto">
        {(['all', ...CAMPAIGN_STATUSES] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition duration-100 ${
              statusFilter === status
                ? 'bg-active text-primary'
                : 'text-tertiary hover:text-secondary'
            }`}
          >
            {status !== 'all' &&
              (() => {
                const Icon = statusIcon[status];
                return <Icon className="size-3.5" />;
              })()}
            {status === 'all' ? 'All' : campaignStatusLabel(status)}
          </button>
        ))}
      </div>

      {/* Campaign Table */}
      <div className="overflow-x-auto rounded-xl border border-secondary">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-secondary bg-secondary text-xs text-tertiary">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Bounty</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Tags</th>
              <th className="px-4 py-3 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {filteredCampaigns.map(campaign => (
              <CampaignRow
                key={campaign.address}
                campaign={campaign}
                onSelect={setSelectedCampaign}
              />
            ))}
          </tbody>
        </table>

        {filteredCampaigns.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-tertiary">
            <Eye className="size-8" />
            <p className="text-sm">
              {campaigns.length === 0
                ? 'No campaigns yet — create your first one'
                : 'No campaigns match this filter'}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedCampaign && (
          <CampaignDetail
            campaign={selectedCampaign}
            service={service}
            onClose={() => setSelectedCampaign(null)}
            onRefresh={fetchData}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate && (
          <CreateCampaignModal
            service={service}
            onClose={() => setShowCreate(false)}
            onCreated={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

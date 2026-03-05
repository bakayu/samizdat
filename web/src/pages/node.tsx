import { useCallback, useContext, useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Activity,
  ArrowUp,
  Clock,
  CurrencyDollar,
  Edit05,
  FilterLines,
  Globe05,
  Loading01,
  Monitor04,
  Plus,
  Save01,
  Zap,
} from '@untitledui/icons';
import { UiWalletAccount } from '@wallet-standard/react';
import { AnimatePresence, motion } from 'motion/react';
import { Controller, useForm } from 'react-hook-form';

import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { SelectedWalletAccountContext } from '@/context/selected-wallet-account-context';
import {
  useSamizdatService,
  type SamizdatService,
} from '@/providers/samizdat-service-provider';
import {
  type CampaignAccount,
  CampaignStatus,
  type NodeAccount,
  NodeStatus,
  type PlayRecord,
  PlayStatus,
  SCREEN_SIZES,
  TAG_BITS,
  type WithAddress,
  geoToDecimal,
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
  type RegisterNodeForm,
  type UpdateNodeSettingsForm,
  registerNodeSchema,
  updateNodeSettingsSchema,
} from '@/utils/schemas';

// ============================================================================
// Node Operator Dashboard
// ============================================================================

function NodeStatusIndicator({ status }: { status: NodeStatus }) {
  const config = {
    [NodeStatus.Active]: {
      color: 'success' as const,
      label: 'Online',
      dotClass: 'bg-success-500',
    },
    [NodeStatus.Offline]: {
      color: 'gray' as const,
      label: 'Offline',
      dotClass: 'bg-gray-400',
    },
    [NodeStatus.Suspended]: {
      color: 'error' as const,
      label: 'Suspended',
      dotClass: 'bg-error-500',
    },
  };
  const c = config[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block size-2.5 pulse-dot rounded-full ${c.dotClass}`} />
      <BadgeWithDot color={c.color} type="modern" size="sm">
        {c.label}
      </BadgeWithDot>
    </div>
  );
}

function PlayStatusBadge({ status }: { status: PlayStatus }) {
  const config = {
    [PlayStatus.Claimed]: { color: 'warning' as const, label: 'Claimed' },
    [PlayStatus.Paid]: { color: 'success' as const, label: 'Paid' },
    [PlayStatus.TimedOut]: { color: 'error' as const, label: 'Timed Out' },
  };
  const c = config[status];

  return (
    <BadgeWithDot color={c.color} type="pill-color" size="sm">
      {c.label}
    </BadgeWithDot>
  );
}

function CampaignCard({
  campaign,
  onClaim,
  isClaiming = false,
}: {
  campaign: WithAddress<CampaignAccount>;
  onClaim: (c: WithAddress<CampaignAccount>) => void;
  isClaiming?: boolean;
}) {
  const tags = tagsFromMask(campaign.tagMask);
  const tf = campaign.targetFilters;
  const geoBounds = unwrap(tf.geoBounds);
  const total = num(campaign.playsRemaining) + num(campaign.playsCompleted);

  return (
    <motion.div
      className="flex flex-col gap-4 rounded-xl border border-secondary bg-secondary p-5 transition duration-100 hover:border-brand-500/30"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-primary">
            Campaign #{String(campaign.campaignId)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-quaternary">
            {String(campaign.publisherAccount).slice(0, 8)}...
          </p>
        </div>
        <span className="font-mono text-lg font-bold text-brand-500">
          {lamportsToSol(campaign.bountyPerPlay)} SOL
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-tertiary">
        <div>
          <span className="text-quaternary">Remaining</span>
          <p className="font-mono text-sm text-primary">
            {num(campaign.playsRemaining).toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-quaternary">Total</span>
          <p className="font-mono text-sm text-primary">{total.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-quaternary">Cooldown</span>
          <p className="font-mono text-sm text-primary">{num(campaign.claimCooldown)}s</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {tags.map(tag => (
          <Badge key={tag} color="brand" size="sm" type="pill-color">
            {tag}
          </Badge>
        ))}
        {tf.establishmentTypes.map(et => (
          <Badge key={et} color="gray" size="sm" type="pill-color">
            {et}
          </Badge>
        ))}
        {tf.screenSizes.map(sz => (
          <Badge key={sz} color="blue" size="sm" type="pill-color">
            {screenSizeLabel(sz)}
          </Badge>
        ))}
      </div>

      {/* Geo */}
      {geoBounds && (
        <p className="text-xs text-quaternary">
          <Globe05 className="mr-1 inline size-3" />
          Geo: {geoToDecimal(geoBounds.minLat).toFixed(2)}° -{' '}
          {geoToDecimal(geoBounds.maxLat).toFixed(2)}° N
        </p>
      )}

      {/* Claim */}
      <Button
        size="sm"
        iconLeading={Zap}
        onClick={() => onClaim(campaign)}
        isDisabled={isClaiming}
        className="mt-auto"
      >
        {isClaiming ? (
          <span className="flex items-center gap-2">
            <Loading01 className="size-3.5 animate-spin" />
            Claiming...
          </span>
        ) : (
          'Claim Campaign'
        )}
      </Button>
    </motion.div>
  );
}

function PlayHistoryTable({ records }: { records: WithAddress<PlayRecord>[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-secondary">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-secondary bg-secondary text-xs text-tertiary">
            <th className="px-4 py-3 font-medium">Campaign</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Payment</th>
            <th className="px-4 py-3 font-medium">Claimed</th>
            <th className="px-4 py-3 font-medium">Confirmed</th>
          </tr>
        </thead>
        <tbody>
          {records.map(record => (
            <tr
              key={record.address}
              className="border-b border-secondary transition duration-100 hover:bg-primary_hover"
            >
              <td className="px-4 py-3 font-mono text-sm text-primary">
                {String(record.campaignAccount).slice(0, 8)}...
              </td>
              <td className="px-4 py-3">
                <PlayStatusBadge status={record.status} />
              </td>
              <td className="px-4 py-3 font-mono text-sm text-brand-500">
                {lamportsToSol(record.paymentAmount)} SOL
              </td>
              <td className="px-4 py-3 text-xs text-tertiary">
                {new Date(num(record.claimedAt) * 1000).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-xs text-tertiary">
                {num(record.confirmedAt) > 0
                  ? new Date(num(record.confirmedAt) * 1000).toLocaleString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NodeSettingsPanel({
  node,
  service,
  onSaved,
}: {
  node: WithAddress<NodeAccount>;
  service: SamizdatService;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit, watch, setValue } = useForm<UpdateNodeSettingsForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(updateNodeSettingsSchema) as any,
    defaultValues: {
      latitude: geoToDecimal(node.location.latitude),
      longitude: geoToDecimal(node.location.longitude),
      estimatedFootfall: node.estimatedFootfall,
      blockedTagMask: node.blockedTagMask,
    },
  });

  const blockedTagMask = watch('blockedTagMask');
  const toggleTag = (bit: bigint) => setValue('blockedTagMask', blockedTagMask ^ bit);

  const onSubmit = async (data: UpdateNodeSettingsForm) => {
    setSaving(true);
    try {
      await service.updateNodeMetadata(node.address, {
        location: {
          latitude: Math.round(data.latitude * 1e7),
          longitude: Math.round(data.longitude * 1e7),
        },
        estimatedFootfall: data.estimatedFootfall,
        blockedTagMask: data.blockedTagMask,
        status: null,
      });
      onSaved();
    } catch (err) {
      console.error('Update node failed:', err);
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-secondary bg-secondary p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary">Node Settings</h3>
        <NodeStatusIndicator status={node.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          name="latitude"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              label="Latitude"
              value={field.value?.toString() ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              hint={fieldState.error?.message ?? 'Degrees (e.g. 40.7128)'}
              isInvalid={!!fieldState.error}
              size="sm"
            />
          )}
        />
        <Controller
          name="longitude"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              label="Longitude"
              value={field.value?.toString() ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              hint={fieldState.error?.message ?? 'Degrees (e.g. -74.0060)'}
              isInvalid={!!fieldState.error}
              size="sm"
            />
          )}
        />
        <Controller
          name="estimatedFootfall"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              label="Estimated Footfall"
              value={field.value?.toString() ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              hint={fieldState.error?.message ?? 'Daily foot traffic estimate'}
              isInvalid={!!fieldState.error}
              size="sm"
              type="number"
            />
          )}
        />
        <div>
          <p className="mb-1 text-sm font-medium text-secondary">Establishment Type</p>
          <span className="font-mono text-sm text-primary">{node.establishmentType}</span>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-secondary">Screen Size</p>
          <Badge color="brand" type="pill-color" size="md">
            {screenSizeLabel(node.screenSize)}
          </Badge>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-secondary">Resolution</p>
          <span className="font-mono text-sm text-primary">
            {node.resolution.width}×{node.resolution.height}
          </span>
        </div>
        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-medium text-secondary">Blocked Tags</p>
          <div className="flex flex-wrap gap-3">
            {TAG_BITS.map(({ bit, label }) => (
              <Checkbox
                key={bit}
                label={label}
                size="sm"
                isSelected={(blockedTagMask & bit) !== 0n}
                onChange={() => toggleTag(bit)}
              />
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <p className="mb-1 text-sm font-medium text-secondary">Landmarks</p>
          <span className="text-sm text-tertiary">
            {node.landmarks.join(', ') || '—'}
          </span>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button size="sm" iconLeading={Save01} type="submit" isDisabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

// --- Helper sub-components for empty states ---

function ConnectWalletPrompt() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Monitor04 className="size-12 text-quaternary" />
      <h2 className="font-display text-display-xs text-primary">Connect Your Wallet</h2>
      <p className="max-w-sm text-center text-sm text-tertiary">
        Connect a Solana wallet to access the node operator dashboard, manage your display
        node, and earn rewards.
      </p>
    </div>
  );
}

function RegisterNodePrompt({
  service,
  wallet,
  onRegistered,
}: {
  service: SamizdatService;
  wallet: UiWalletAccount;
  onRegistered: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, watch, setValue } = useForm<RegisterNodeForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(registerNodeSchema) as any,
    defaultValues: {
      nodeId: undefined,
      latitude: undefined,
      longitude: undefined,
      screenSize: undefined,
      resolutionWidth: undefined,
      resolutionHeight: undefined,
      landmarks: '',
      blockedTagMask: 0n,
      estimatedFootfall: undefined,
      establishmentType: '',
    },
  });

  const blockedTagMask = watch('blockedTagMask');
  const toggleTag = (bit: bigint) => setValue('blockedTagMask', blockedTagMask ^ bit);

  const onSubmit = async (data: RegisterNodeForm) => {
    setSubmitting(true);
    try {
      await service.registerNode({
        nodeId: data.nodeId,
        location: {
          latitude: Math.round(data.latitude * 1e7),
          longitude: Math.round(data.longitude * 1e7),
        },
        screenSize: parseScreenSize(data.screenSize),
        resolution: { width: data.resolutionWidth, height: data.resolutionHeight },
        landmarks: data.landmarks
          ? data.landmarks
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [],
        blockedTagMask: data.blockedTagMask,
        estimatedFootfall: data.estimatedFootfall,
        establishmentType: data.establishmentType,
      });

      // Poll until the account is queryable
      await pollUntilReady(() => service.getNode(wallet.address), {
        resourceName: 'Node account',
      });

      onRegistered();
    } catch (err) {
      console.error('Register node failed:', err);
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Monitor04 className="size-12 text-quaternary" />
        <h2 className="font-display text-display-xs text-primary">
          Register a Display Node
        </h2>
        <p className="max-w-sm text-center text-sm text-tertiary">
          Register your display node on-chain to start claiming campaigns and earning
          rewards.
        </p>
        <Button size="md" iconLeading={Plus} onClick={() => setShowForm(true)}>
          Register Node
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-8">
      <h2 className="mb-6 font-display text-display-xs text-primary">
        Register Display Node
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Controller
          name="nodeId"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              label="Node ID"
              placeholder="1"
              type="number"
              value={field.value?.toString() ?? ''}
              onChange={field.onChange}
              hint={fieldState.error?.message ?? 'Unique numeric ID'}
              isInvalid={!!fieldState.error}
            />
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="latitude"
            control={control}
            render={({ field, fieldState }) => (
              <Input
                label="Latitude"
                placeholder="40.7128"
                type="number"
                value={field.value?.toString() ?? ''}
                onChange={field.onChange}
                hint={fieldState.error?.message}
                isInvalid={!!fieldState.error}
              />
            )}
          />
          <Controller
            name="longitude"
            control={control}
            render={({ field, fieldState }) => (
              <Input
                label="Longitude"
                placeholder="-74.0060"
                type="number"
                value={field.value?.toString() ?? ''}
                onChange={field.onChange}
                hint={fieldState.error?.message}
                isInvalid={!!fieldState.error}
              />
            )}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-secondary">Screen Size</p>
          <div className="flex flex-wrap gap-3">
            {SCREEN_SIZES.map(size => {
              const label = screenSizeLabel(size);
              return (
                <Controller
                  key={size}
                  name="screenSize"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      label={label}
                      size="sm"
                      isSelected={field.value === label}
                      onChange={() => field.onChange(label)}
                    />
                  )}
                />
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="resolutionWidth"
            control={control}
            render={({ field, fieldState }) => (
              <Input
                label="Width (px)"
                placeholder="1920"
                type="number"
                value={field.value?.toString() ?? ''}
                onChange={field.onChange}
                hint={fieldState.error?.message}
                isInvalid={!!fieldState.error}
              />
            )}
          />
          <Controller
            name="resolutionHeight"
            control={control}
            render={({ field, fieldState }) => (
              <Input
                label="Height (px)"
                placeholder="1080"
                type="number"
                value={field.value?.toString() ?? ''}
                onChange={field.onChange}
                hint={fieldState.error?.message}
                isInvalid={!!fieldState.error}
              />
            )}
          />
        </div>
        <Controller
          name="estimatedFootfall"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              label="Estimated Footfall"
              placeholder="5000"
              type="number"
              value={field.value?.toString() ?? ''}
              onChange={field.onChange}
              hint={fieldState.error?.message ?? 'Daily foot traffic'}
              isInvalid={!!fieldState.error}
            />
          )}
        />
        <Controller
          name="establishmentType"
          control={control}
          render={({ field, fieldState }) => (
            <Input
              label="Establishment Type"
              placeholder="Mall, Transit Hub"
              value={field.value ?? ''}
              onChange={field.onChange}
              hint={fieldState.error?.message}
              isInvalid={!!fieldState.error}
            />
          )}
        />
        <Controller
          name="landmarks"
          control={control}
          render={({ field }) => (
            <Input
              label="Landmarks"
              placeholder="Times Square, Penn Station"
              value={field.value ?? ''}
              onChange={field.onChange}
              hint="Comma-separated nearby landmarks"
            />
          )}
        />
        <div>
          <p className="mb-2 text-sm font-medium text-secondary">Blocked Tags</p>
          <div className="flex flex-wrap gap-3">
            {TAG_BITS.map(({ bit, label }) => {
              const bitNum = bit;
              return (
                <Checkbox
                  key={bitNum}
                  label={label}
                  size="sm"
                  isSelected={(blockedTagMask & bitNum) !== 0n}
                  onChange={() => toggleTag(bitNum)}
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-secondary pt-4">
          <Button
            size="md"
            color="secondary"
            type="button"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </Button>
          <Button size="md" iconLeading={Plus} type="submit" isDisabled={submitting}>
            {submitting ? 'Registering...' : 'Register Node'}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function NodeDashboardPage() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  if (!selectedWalletAccount) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <ConnectWalletPrompt />
      </div>
    );
  }

  return <NodeDashboardContent />;
}

function NodeDashboardContent() {
  const service = useSamizdatService();
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  const [node, setNode] = useState<WithAddress<NodeAccount> | null>(null);
  const [campaigns, setCampaigns] = useState<WithAddress<CampaignAccount>[]>([]);
  const [playRecords, setPlayRecords] = useState<WithAddress<PlayRecord>[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedNode, setCheckedNode] = useState(false);
  const [claimingCampaign, setClaimingCampaign] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'marketplace' | 'history' | 'settings'>(
    'marketplace'
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const n = await service.getNode(selectedWalletAccount!.address);
      setNode(n);
      setCheckedNode(true);
      if (n) {
        const [camps, records] = await Promise.all([
          service.getCampaigns(),
          service.getPlayRecords(),
        ]);
        setCampaigns(camps.filter(c => c.status === CampaignStatus.Active));
        setPlayRecords(records);
      }
    } catch (err) {
      console.error('Failed to fetch node data:', err);
      setCheckedNode(true);
    } finally {
      setLoading(false);
    }
  }, [service, selectedWalletAccount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Loading ---
  if (loading && !checkedNode) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <Loading01 className="size-8 animate-spin text-brand-500" />
          <p className="font-mono text-sm text-tertiary">Loading on-chain data...</p>
        </div>
      </div>
    );
  }

  // --- No node registered ---
  if (!node) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <RegisterNodePrompt
          service={service}
          wallet={selectedWalletAccount!}
          onRegistered={fetchData}
        />
      </div>
    );
  }

  const handleClaim = async (campaign: WithAddress<CampaignAccount>) => {
    setClaimingCampaign(campaign.address);
    try {
      await service.claimCampaign(campaign.address, node.address, 0);
      await fetchData();
    } catch (err) {
      console.error('Claim failed:', err);
      alert(`Claim failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setClaimingCampaign(null);
    }
  };

  const availableCampaigns = campaigns;

  return (
    <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-display-sm text-primary">Node Operator</h1>
          <NodeStatusIndicator status={node.status} />
        </div>
        <p className="mt-1 font-mono text-xs text-quaternary">
          {shortenAddress(node.address, 8)}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-secondary bg-secondary p-5">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <Activity className="size-4" />
            Total Plays
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-primary">
            {num(node.totalPlays).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-secondary bg-secondary p-5">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <CurrencyDollar className="size-4 text-brand-500" />
            Total Earnings
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-brand-500">
            {lamportsToSol(node.totalEarnings).toFixed(2)} SOL
          </p>
        </div>
        <div className="rounded-xl border border-secondary bg-secondary p-5">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <Monitor04 className="size-4" />
            Screen
          </div>
          <p className="mt-2 text-lg font-semibold text-primary">
            {screenSizeLabel(node.screenSize)}{' '}
            <span className="font-mono text-sm text-quaternary">
              {node.resolution.width}×{node.resolution.height}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-secondary bg-secondary p-5">
          <div className="flex items-center gap-2 text-xs text-tertiary">
            <ArrowUp className="size-4 text-success-500" />
            Uptime
          </div>
          <p className="mt-2 font-mono text-2xl font-semibold text-success-500">99.7%</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-secondary">
        {[
          { key: 'marketplace' as const, label: 'Available Campaigns', icon: Zap },
          { key: 'history' as const, label: 'Play History', icon: Clock },
          { key: 'settings' as const, label: 'Node Settings', icon: Edit05 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition duration-100 ${
              activeTab === tab.key
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'marketplace' && (
          <motion.div
            key="marketplace"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-tertiary">
                {availableCampaigns.length} campaigns available
              </p>
              <Button size="sm" color="tertiary" iconLeading={FilterLines}>
                Filters
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableCampaigns.map(campaign => (
                <CampaignCard
                  key={String(campaign.campaignId)}
                  campaign={campaign}
                  onClaim={handleClaim}
                  isClaiming={claimingCampaign === campaign.address}
                />
              ))}
            </div>
            {availableCampaigns.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-tertiary">
                <Zap className="size-8" />
                <p className="text-sm">No active campaigns available right now</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {playRecords.length > 0 ? (
              <PlayHistoryTable records={playRecords} />
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-tertiary">
                <Clock className="size-8" />
                <p className="text-sm">
                  No play history yet — claim a campaign to get started
                </p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <NodeSettingsPanel node={node} service={service} onSaved={fetchData} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

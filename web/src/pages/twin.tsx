import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  CheckCircle,
  CurrencyDollar,
  Loading01,
  Monitor04,
  Play,
  Wifi,
  WifiOff,
} from '@untitledui/icons';
import { AnimatePresence, motion } from 'motion/react';

import { Badge, BadgeWithDot } from '@/components/base/badges/badges';
import { Button } from '@/components/base/buttons/button';
import { SelectedWalletAccountContext } from '@/context/selected-wallet-account-context';
import { useSamizdatService } from '@/providers/samizdat-service-provider';
import {
  type CampaignAccount,
  CampaignStatus,
  type NodeAccount,
  type WithAddress,
  geoToDecimal,
  lamportsToSol,
  screenSizeLabel,
  tagsFromMask,
} from '@/types/samizdat';

// ============================================================================
// Digital Twin — split-screen simulated display + control panel
// ============================================================================

type ScreenState = 'idle' | 'loading' | 'playing' | 'confirming' | 'confirmed';

interface StatusEvent {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'payment';
  timestamp: Date;
}

function NoSignalScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <WifiOff className="size-16 text-gray-600" style={{ animation: 'flicker 3s ease-in-out infinite' }} />
      <div className="text-center">
        <p
          className="font-mono text-2xl font-bold tracking-widest text-gray-500"
          style={{ animation: 'flicker 3s ease-in-out infinite' }}
        >
          NO SIGNAL
        </p>
        <p className="mt-2 font-mono text-xs text-gray-600">
          AWAITING CAMPAIGN CLAIM
        </p>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <motion.div
        className="size-12 rounded-full border-2 border-brand-500 border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <p className="font-mono text-sm text-brand-500">LOADING CONTENT...</p>
    </div>
  );
}

function PlayingScreen({ campaign }: { campaign: WithAddress<CampaignAccount> }) {
  const tags = tagsFromMask(campaign.tagMask);

  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center gap-6 p-8"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Simulated campaign content */}
      <div className="flex size-full flex-col items-center justify-center rounded-lg bg-linear-to-br from-brand-600/20 to-brand-500/5 p-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Monitor04 className="size-20 text-brand-500" />
        </motion.div>
        <motion.p
          className="mt-4 font-display text-3xl text-primary"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Campaign #{String(campaign.campaignId)}
        </motion.p>
        <motion.p
          className="mt-2 font-mono text-xs text-quaternary"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          CID: {campaign.cids[0]?.slice(0, 24)}...
        </motion.p>
        <motion.div
          className="mt-4 flex gap-2"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {tags.map(tag => (
            <Badge key={tag} color="brand" size="sm" type="pill-color">
              {tag}
            </Badge>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

function ConfirmedScreen({
  payment,
}: {
  campaign: WithAddress<CampaignAccount>;
  payment: bigint | number;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <CheckCircle className="size-20 text-success-500" />
      </motion.div>
      <motion.p
        className="font-display text-2xl text-primary"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Play Confirmed
      </motion.p>

      {/* Payment animation */}
      <motion.div
        className="flex items-center gap-2 rounded-lg bg-brand-600/20 px-4 py-2"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
      >
        <motion.div
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <CurrencyDollar className="size-5 text-brand-500" />
        </motion.div>
        <motion.span
          className="font-mono text-xl font-bold text-brand-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          +{lamportsToSol(payment)} SOL
        </motion.span>
        <motion.span
          className="text-xs text-tertiary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          → Node Operator
        </motion.span>
      </motion.div>
    </div>
  );
}

function StatusFeed({ events }: { events: StatusEvent[] }) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const typeColors = {
    info: 'text-tertiary',
    success: 'text-success-500',
    error: 'text-error-500',
    payment: 'text-brand-500',
  };

  return (
    <div
      ref={feedRef}
      className="flex h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-secondary bg-primary p-3"
    >
      {events.length === 0 && (
        <p className="py-4 text-center font-mono text-xs text-quaternary">
          No activity yet
        </p>
      )}
      <AnimatePresence>
        {events.map(event => (
          <motion.div
            key={event.id}
            className="flex items-start gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className="mt-0.5 font-mono text-[10px] text-quaternary">
              {event.timestamp.toLocaleTimeString()}
            </span>
            <span className={`font-mono text-xs ${typeColors[event.type]}`}>
              {event.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function DigitalTwinPage() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  if (!selectedWalletAccount) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Monitor04 className="size-12 text-quaternary" />
          <h2 className="font-display text-display-xs text-primary">Connect Your Wallet</h2>
          <p className="max-w-sm text-center text-sm text-tertiary">
            Connect a Solana wallet to access the Digital Twin simulator.
          </p>
        </div>
      </div>
    );
  }

  return <DigitalTwinContent />;
}

function DigitalTwinContent() {
  const service = useSamizdatService();
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  const [node, setNode] = useState<WithAddress<NodeAccount> | null>(null);
  const [availableCampaigns, setAvailableCampaigns] = useState<WithAddress<CampaignAccount>[]>([]);
  const [loading, setLoading] = useState(true);

  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [activeCampaign, setActiveCampaign] = useState<WithAddress<CampaignAccount> | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const eventId = useRef(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [n, camps] = await Promise.all([
        service.getNode(selectedWalletAccount!.address),
        service.getCampaigns(),
      ]);
      setNode(n);
      setAvailableCampaigns(camps.filter(c => c.status === CampaignStatus.Active));
    } catch (err) {
      console.error('Failed to load twin data:', err);
    } finally {
      setLoading(false);
    }
  }, [service, selectedWalletAccount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addEvent = useCallback(
    (message: string, type: StatusEvent['type'] = 'info') => {
      eventId.current += 1;
      setEvents(prev => [
        ...prev,
        { id: eventId.current, message, type, timestamp: new Date() },
      ]);
    },
    []
  );

  const handleClaim = useCallback(
    async (campaign: WithAddress<CampaignAccount>) => {
      if (screenState !== 'idle' && screenState !== 'confirmed') return;
      if (!node) return;

      setActiveCampaign(campaign);
      setScreenState('loading');
      addEvent(`Claiming Campaign #${String(campaign.campaignId)}...`);
      addEvent(`CID: ${campaign.cids[0]?.slice(0, 20)}...`, 'info');

      try {
        const playRecord = await service.claimCampaign(
          campaign.address,
          node.address,
          0
        );
        addEvent('Claim TX confirmed on-chain', 'success');

        // Transition to playing
        setScreenState('playing');
        addEvent('Content loaded — now playing', 'success');
        addEvent(
          `Bounty: ${lamportsToSol(campaign.bountyPerPlay)} SOL per play`,
          'info'
        );

        // Start 5-second countdown
        let remaining = 5;
        setCountdown(remaining);

        const interval = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);

          if (remaining <= 0) {
            clearInterval(interval);
            setCountdown(null);
            setScreenState('confirming');
            addEvent('Play complete — confirming on-chain...', 'info');

            // Confirm play on-chain
            service
              .confirmPlay(playRecord.address)
              .then(() => {
                setScreenState('confirmed');
                addEvent('Play confirmed on-chain ✓', 'success');
                addEvent(
                  `+${lamportsToSol(campaign.bountyPerPlay)} SOL → Node Operator`,
                  'payment'
                );
                fetchData(); // refresh data
              })
              .catch(err => {
                addEvent(
                  `Confirm failed: ${err instanceof Error ? err.message : String(err)}`,
                  'error'
                );
                setScreenState('idle');
              });
          }
        }, 1000);
      } catch (err) {
        addEvent(
          `Claim failed: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        );
        setScreenState('idle');
        setActiveCampaign(null);
      }
    },
    [screenState, addEvent, service, node, fetchData]
  );

  const handleReset = useCallback(() => {
    setScreenState('idle');
    setActiveCampaign(null);
    setCountdown(null);
    addEvent('Screen reset to idle', 'info');
  }, [addEvent]);

  // --- Loading ---
  if (loading) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <Loading01 className="size-8 animate-spin text-brand-500" />
          <p className="font-mono text-sm text-tertiary">Loading on-chain data...</p>
        </div>
      </div>
    );
  }

  // --- No node ---
  if (!node) {
    return (
      <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Monitor04 className="size-12 text-quaternary" />
          <h2 className="font-display text-display-xs text-primary">No Node Registered</h2>
          <p className="max-w-sm text-center text-sm text-tertiary">
            Register a display node first on the Node Operator page before using the Digital Twin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-360 px-4 py-8 md:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-display-sm text-primary">Digital Twin</h1>
        <p className="mt-1 text-sm text-tertiary">
          Simulate the full claim → display → confirm → pay cycle
        </p>
      </div>

      {/* Split Layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Simulated Display — 3 cols */}
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-secondary bg-[#0a0a0a]">
            {/* Screen chrome */}
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
              <div className="flex items-center gap-2">
                <Monitor04 className="size-4 text-gray-600" />
                <span className="font-mono text-xs text-gray-600">
                  NODE #{String(node.nodeId)} — {screenSizeLabel(node.screenSize)}{' '}
                  {node.resolution.width}×{node.resolution.height}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {screenState === 'playing' && countdown !== null && (
                  <span className="font-mono text-xs text-brand-500">
                    {countdown}s remaining
                  </span>
                )}
                {screenState !== 'idle' ? (
                  <Wifi className="size-3.5 text-success-500" />
                ) : (
                  <WifiOff className="size-3.5 text-gray-600" />
                )}
              </div>
            </div>

            {/* Screen content — 16:9 */}
            <div className="scanline-overlay relative aspect-video">
              <div className="relative z-10 h-full">
                <AnimatePresence mode="wait">
                  {screenState === 'idle' && (
                    <motion.div
                      key="idle"
                      className="h-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <NoSignalScreen />
                    </motion.div>
                  )}
                  {screenState === 'loading' && (
                    <motion.div
                      key="loading"
                      className="h-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <LoadingScreen />
                    </motion.div>
                  )}
                  {(screenState === 'playing' || screenState === 'confirming') &&
                    activeCampaign && (
                      <motion.div
                        key="playing"
                        className="h-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <PlayingScreen campaign={activeCampaign} />
                      </motion.div>
                    )}
                  {screenState === 'confirmed' && activeCampaign && (
                    <motion.div
                      key="confirmed"
                      className="h-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <ConfirmedScreen
                        campaign={activeCampaign}
                        payment={activeCampaign.bountyPerPlay}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Screen controls */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="pulse-dot inline-block size-2 rounded-full bg-brand-500" />
              <span className="font-mono text-xs uppercase text-tertiary">
                {screenState === 'idle' && 'Standby'}
                {screenState === 'loading' && 'Loading...'}
                {screenState === 'playing' && 'Now Playing'}
                {screenState === 'confirming' && 'Confirming...'}
                {screenState === 'confirmed' && 'Confirmed'}
              </span>
            </div>
            {(screenState === 'confirmed' || screenState === 'idle') && (
              <Button size="sm" color="secondary" onClick={handleReset}>
                Reset Screen
              </Button>
            )}
          </div>
        </div>

        {/* Right: Control Panel — 2 cols */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Node Info */}
          <div className="rounded-xl border border-secondary bg-secondary p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">Node Control</span>
              <BadgeWithDot color="success" type="modern" size="sm">
                Online
              </BadgeWithDot>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-quaternary">Location</span>
                <p className="font-mono text-primary">
                  {geoToDecimal(node.location.latitude).toFixed(2)}°N,{' '}
                  {Math.abs(geoToDecimal(node.location.longitude)).toFixed(2)}°W
                </p>
              </div>
              <div>
                <span className="text-quaternary">Footfall</span>
                <p className="font-mono text-primary">
                  {node.estimatedFootfall.toLocaleString()}/day
                </p>
              </div>
            </div>
          </div>

          {/* Claimable Campaigns */}
          <div className="rounded-xl border border-secondary bg-secondary p-4">
            <p className="mb-3 text-sm font-semibold text-primary">
              Claimable Campaigns
            </p>
            <div className="flex flex-col gap-2">
              {availableCampaigns.map(campaign => {
                const tags = tagsFromMask(campaign.tagMask);
                const isDisabled =
                  screenState !== 'idle' && screenState !== 'confirmed';

                return (
                  <div
                    key={String(campaign.campaignId)}
                    className="flex items-center justify-between rounded-lg border border-secondary bg-primary p-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-primary">
                          #{String(campaign.campaignId)}
                        </span>
                        <span className="font-mono text-xs text-brand-500">
                          {lamportsToSol(campaign.bountyPerPlay)} SOL
                        </span>
                      </div>
                      <div className="mt-1 flex gap-1">
                        {tags.map(tag => (
                          <Badge
                            key={tag}
                            color="brand"
                            size="sm"
                            type="pill-color"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      iconLeading={Play}
                      isDisabled={isDisabled}
                      onClick={() => handleClaim(campaign)}
                    >
                      Claim
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status Feed */}
          <div>
            <p className="mb-2 text-sm font-semibold text-primary">Activity Log</p>
            <StatusFeed events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}

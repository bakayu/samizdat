import { useRef } from 'react';

import {
  ArrowRight,
  CurrencyDollarCircle,
  Database01,
  Globe05,
  LinkExternal01,
  Monitor04,
  Send01,
  Shield01,
  Zap,
} from '@untitledui/icons';
import { motion, useInView } from 'motion/react';

import { Button } from '@/components/base/buttons/button';

// ============================================================================
// Landing Page — Soviet-era brutalist editorial aesthetic
// ============================================================================

function StaggerRevealText({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const words = text.split(' ');

  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="mr-[0.25em] inline-block"
          initial={{ y: 80, opacity: 0, rotateX: -40 }}
          animate={isInView ? { y: 0, opacity: 1, rotateX: 0 } : {}}
          transition={{
            duration: 0.6,
            delay: delay + i * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

function ProtocolFlowDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const steps = [
    { icon: Send01, label: 'Publisher', sublabel: 'Uploads content + funds campaign' },
    { icon: Database01, label: 'Solana', sublabel: 'On-chain matching & escrow' },
    { icon: Monitor04, label: 'Node', sublabel: 'Claims & displays content' },
    { icon: CurrencyDollarCircle, label: 'Payment', sublabel: 'Instant SOL settlement' },
  ];

  return (
    <div ref={ref} className="flex flex-col items-center justify-center gap-12 md:flex-row md:gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-0">
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <div className="flex size-16 items-center justify-center rounded-xl border border-secondary bg-secondary">
              <step.icon className="size-7 text-brand-500" />
            </div>
            <div className="text-center">
              <p className="font-mono text-sm font-semibold text-primary">
                {step.label}
              </p>
              <p className="max-w-35 text-xs text-tertiary">{step.sublabel}</p>
            </div>
          </motion.div>

          {i < steps.length - 1 && (
            <motion.div
              className="hidden h-px w-16 bg-border-secondary md:block lg:w-24"
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.4, delay: i * 0.15 + 0.3 }}
              style={{ originX: 0 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface FeatureCardProps {
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  index: number;
}

function FeatureCard({ icon: Icon, title, description, index }: FeatureCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      className="flex flex-col gap-4 rounded-xl border border-secondary bg-secondary p-6"
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <div className="flex size-12 items-center justify-center rounded-lg bg-brand-600/10">
        <Icon className="size-6 text-brand-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        <p className="mt-1 text-sm text-tertiary">{description}</p>
      </div>
    </motion.div>
  );
}

export function LandingPage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="noise-overlay relative overflow-hidden border-b border-secondary py-24 md:py-32 lg:py-40">
        <div className="relative z-10 mx-auto max-w-360 px-4 md:px-8">
          {/* Oversized typographic header */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <span className="pulse-dot inline-block size-2 rounded-full bg-brand-500" />
              <span className="font-mono text-xs uppercase tracking-widest text-brand-500">
                Live on Solana Devnet
              </span>
            </div>

            <h1 className="max-w-5xl font-display text-display-xl font-normal leading-[0.95] tracking-tight text-primary md:text-[5rem] lg:text-[6.5rem]">
              <StaggerRevealText text="Decentralized billboards." />
              <br />
              <StaggerRevealText
                text="Permissionless reach."
                delay={0.4}
              />
            </h1>

            <motion.p
              className="max-w-2xl text-lg text-tertiary md:text-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              A DePIN protocol connecting content publishers with physical display nodes.
              Fund campaigns, match screens, pay per play — all on-chain.
            </motion.p>

            <motion.div
              className="mt-4 flex flex-col gap-3 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
            >
              <Button href="/publisher" size="lg" iconTrailing={ArrowRight}>
                I'm a Publisher
              </Button>
              <Button
                href="/node"
                size="lg"
                color="secondary"
                iconTrailing={ArrowRight}
              >
                I'm an Operator
              </Button>
            </motion.div>
          </div>

          {/* Oversized bg accent text */}
          <div
            className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 select-none font-display text-[20rem] font-normal leading-none tracking-tighter text-brand-500/3 md:text-[28rem]"
            aria-hidden="true"
          >
            S
          </div>
        </div>
      </section>

      {/* Protocol Flow */}
      <section className="border-b border-secondary py-20 md:py-28">
        <div className="mx-auto max-w-360 px-4 md:px-8">
          <div className="mb-12 flex flex-col gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-brand-500">
              How it works
            </span>
            <h2 className="max-w-lg font-display text-display-md text-primary">
              From publisher to screen in four steps
            </h2>
          </div>

          <ProtocolFlowDiagram />
        </div>
      </section>

      {/* Feature Grid */}
      <section className="border-b border-secondary py-20 md:py-28">
        <div className="mx-auto max-w-360 px-4 md:px-8">
          <div className="mb-12 flex flex-col gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-brand-500">
              Protocol Features
            </span>
            <h2 className="max-w-lg font-display text-display-md text-primary">
              Built for scale. Secured by Solana.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Database01}
              title="Off-chain Content Storage"
              description="Campaign creative assets stored on Arweave/IPFS via CIDs. Solana stores only the references — keeping costs minimal."
              index={0}
            />
            <FeatureCard
              icon={Zap}
              title="On-chain Matching Engine"
              description="Target filters (geo, footfall, screen size, establishment type) match campaigns to qualified display nodes automatically."
              index={1}
            />
            <FeatureCard
              icon={CurrencyDollarCircle}
              title="Instant Per-Play Payments"
              description="Bounty escrowed upfront. Each confirmed play triggers instant SOL transfer from campaign vault to node operator."
              index={2}
            />
            <FeatureCard
              icon={Shield01}
              title="Content Tag Filtering"
              description="Bitmask-based content categories let node operators block unwanted content types (NSFW, political, betting)."
              index={3}
            />
            <FeatureCard
              icon={Globe05}
              title="Geo-targeted Campaigns"
              description="Fixed-point geo bounds (lat/lon × 1e7) enable precise geographic targeting down to neighborhood level."
              index={4}
            />
            <FeatureCard
              icon={LinkExternal01}
              title="Proof-of-Play Verification"
              description="Claim → timeout window → confirm cycle ensures honest reporting with on-chain audit trail for every play."
              index={5}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="noise-overlay relative py-24 md:py-32">
        <div className="relative z-10 mx-auto max-w-360 px-4 md:px-8">
          <div className="flex flex-col items-center gap-8 text-center">
            <h2 className="max-w-2xl font-display text-display-lg text-primary">
              Ready to broadcast?
            </h2>
            <p className="max-w-lg text-lg text-tertiary">
              Whether you're publishing content or operating screens, Samizdat connects
              you to a permissionless advertising network.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button href="/publisher" size="lg" iconLeading={Send01}>
                Launch a Campaign
              </Button>
              <Button
                href="/twin"
                size="lg"
                color="secondary"
                iconLeading={Monitor04}
              >
                Try the Digital Twin
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="pulse-dot inline-block size-2 rounded-full bg-success-500" />
                <span className="font-mono text-xs text-tertiary">
                  8 active campaigns
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="pulse-dot inline-block size-2 rounded-full bg-brand-500" />
                <span className="font-mono text-xs text-tertiary">
                  1,247 total plays
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

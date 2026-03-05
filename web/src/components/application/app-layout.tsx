import type { FC } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

import { Globe05, Monitor04, Send01, Signal01 } from '@untitledui/icons';

import { ConnectWalletMenu } from '@/components/application/connect-wallet-menu';
import { cx } from '@/utils/cx';

interface NavItem {
  label: string;
  href: string;
  icon: FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Protocol', href: '/', icon: Globe05 },
  { label: 'Publisher', href: '/publisher', icon: Send01 },
  { label: 'Node Operator', href: '/node', icon: Monitor04 },
  { label: 'Digital Twin', href: '/twin', icon: Signal01 },
];

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-secondary bg-primary/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-360 items-center justify-between px-4 md:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/samizdat/logo.svg" alt="Samizdat" className="size-8" />
            <span className="font-mono text-xl tracking-tight text-primary">
              samizdat
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map(item => {
                const isActive =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className={cx(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition duration-100 ease-linear',
                        isActive
                          ? 'bg-active text-primary'
                          : 'text-tertiary hover:text-secondary'
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Wallet */}
          <ConnectWalletMenu />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-secondary py-6">
        <div className="mx-auto flex max-w-360 items-center justify-between px-4 text-xs text-quaternary md:px-8">
          <span className="font-mono">SAMIZDAT PROTOCOL</span>
          <span className="font-mono">SOLANA DEVNET • {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

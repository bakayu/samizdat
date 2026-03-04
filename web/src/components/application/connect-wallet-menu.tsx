import { useCallback, useContext, useState } from 'react';

import { Wallet01, LogOut01, AlertCircle, ChevronDown } from '@untitledui/icons';
import { StandardConnect, StandardDisconnect } from '@wallet-standard/core';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import {
  uiWalletAccountBelongsToUiWallet,
  uiWalletAccountsAreSame,
  useConnect,
  useDisconnect,
  useWallets,
} from '@wallet-standard/react';

import { Button } from '@/components/base/buttons/button';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { SelectedWalletAccountContext } from '@/context/selected-wallet-account-context';
import { formatSol, useBalance } from '@/hooks/use-balance';
import { cx } from '@/utils/cx';

import { WalletAccountIcon } from './wallet-account-icon';
import { ChainContext } from '@/context/chain-context';

// ─── Connectable Wallet Item ────────────────────────────────────────────────

function ConnectableWalletItem({
  wallet,
  onAccountSelect,
  onDisconnect,
}: {
  wallet: UiWallet;
  onAccountSelect: (account: UiWalletAccount) => void;
  onDisconnect: (wallet: UiWallet) => void;
}) {
  const [isConnecting, connect] = useConnect(wallet);
  const [isDisconnecting, disconnect] = useDisconnect(wallet);
  const isPending = isConnecting || isDisconnecting;
  const isConnected = wallet.accounts.length > 0;
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  const handleClick = useCallback(async () => {
    if (isConnected) return; // Already connected — sub-accounts shown below
    try {
      const existingAccounts = [...wallet.accounts];
      const nextAccounts = await connect();
      // Prefer first new account
      for (const next of nextAccounts) {
        if (
          !existingAccounts.some(existing =>
            uiWalletAccountsAreSame(next, existing)
          )
        ) {
          onAccountSelect(next);
          return;
        }
      }
      if (nextAccounts[0]) {
        onAccountSelect(nextAccounts[0]);
      }
    } catch {
      /* wallet refused */
    }
  }, [connect, isConnected, onAccountSelect, wallet.accounts]);

  return (
    <div className="px-1.5 py-px">
      {/* Wallet row */}
      <button
        disabled={isPending}
        onClick={handleClick}
        className={cx(
          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition duration-100 ease-linear',
          'hover:bg-primary_hover',
          isPending && 'cursor-wait opacity-60'
        )}
      >
        {wallet.icon ? (
          <img
            src={wallet.icon}
            alt={wallet.name}
            className="size-5 shrink-0 rounded-sm"
          />
        ) : (
          <Wallet01 className="size-5 shrink-0 text-fg-quaternary" />
        )}
        <span className="grow truncate text-sm font-semibold text-secondary">
          {wallet.name}
        </span>
        {isConnected && (
          <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />
        )}
      </button>

      {/* Connected accounts */}
      {isConnected && (
        <div className="ml-7 border-l border-secondary pl-2.5">
          {wallet.accounts.map(account => {
            const isSelected =
              selectedWalletAccount &&
              uiWalletAccountsAreSame(selectedWalletAccount, account);

            return (
              <button
                key={account.address}
                onClick={() => onAccountSelect(account)}
                className={cx(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition duration-100 ease-linear',
                  'hover:bg-primary_hover',
                  isSelected && 'bg-active text-primary'
                )}
              >
                <span className="font-mono text-tertiary">
                  {account.address.slice(0, 4)}…{account.address.slice(-4)}
                </span>
                {isSelected && (
                  <span className="ml-auto text-[10px] text-brand-500">●</span>
                )}
              </button>
            );
          })}

          {/* Disconnect */}
          <button
            disabled={isDisconnecting}
            onClick={async () => {
              try {
                await disconnect();
                onDisconnect(wallet);
              } catch {
                /* swallow */
              }
            }}
            className="mt-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-error-primary transition hover:bg-error-primary/10"
          >
            <LogOut01 className="size-3.5" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Connected Wallet Display ───────────────────────────────────────────────

function ConnectedDisplay({ account }: { account: UiWalletAccount }) {
  const { balance } = useBalance(account);

  return (
    <span className="flex items-center gap-2">
      <WalletAccountIcon
        account={account}
        className="size-4 rounded-sm"
        width={16}
        height={16}
      />
      <span className="font-mono text-xs">
        {account.address.slice(0, 4)}…{account.address.slice(-4)}
      </span>
      {balance != null && (
        <span className="hidden text-xs text-tertiary sm:inline">
          {formatSol(balance)} SOL
        </span>
      )}
    </span>
  );
}

// ─── Main ConnectWalletMenu ─────────────────────────────────────────────────

export function ConnectWalletMenu() {
  const wallets = useWallets();
  const [selectedWalletAccount, setSelectedWalletAccount] = useContext(
    SelectedWalletAccountContext
  );
  const [menuKey, setMenuKey] = useState(0);
  const chainDetails = useContext(ChainContext);

  // Filter wallets by capability
  const connectable: UiWallet[] = [];
  for (const wallet of wallets) {
    if (
      wallet.features.includes(StandardConnect) &&
      wallet.features.includes(StandardDisconnect) && 
      wallet.chains.includes(chainDetails.chain)
    ) {
      connectable.push(wallet);
    }
  }

  return (
    <Dropdown.Root key={menuKey}>
      <Button size="sm" color="primary">
        {selectedWalletAccount ? (
          <ConnectedDisplay account={selectedWalletAccount} />
        ) : (
          <>
            <Wallet01 className="size-4" />
            Connect Wallet
          </>
        )}
        <ChevronDown className="ml-1 size-3.5 text-fg-quaternary" />
      </Button>

      <Dropdown.Popover className="w-72">
        <div className="py-1">
          {wallets.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-tertiary">
              <AlertCircle className="size-4 text-warning-primary" />
              No wallets detected in this browser.
            </div>
          ) : (
            <>
              {connectable.map(wallet => (
                <ConnectableWalletItem
                  key={`wallet:${wallet.name}`}
                  wallet={wallet}
                  onAccountSelect={account => {
                    setSelectedWalletAccount(account);
                    setMenuKey(k => k + 1);
                  }}
                  onDisconnect={wallet => {
                    if (
                      selectedWalletAccount &&
                      uiWalletAccountBelongsToUiWallet(
                        selectedWalletAccount,
                        wallet
                      )
                    ) {
                      setSelectedWalletAccount(undefined);
                    }
                  }}
                />
              ))}
            </>
          )}
        </div>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

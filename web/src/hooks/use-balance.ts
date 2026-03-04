import { useContext, useEffect, useState } from 'react';

import { address as toAddress, type Lamports } from '@solana/kit';

import { ConnectionContext } from '@/context/connection-context';

import type { UiWalletAccount } from '@wallet-standard/react';


/**
 * Simple hook to fetch and poll the SOL balance for a wallet account.
 * Polls every 10 seconds to keep the balance reasonably up to date.
 */
export function useBalance(account: UiWalletAccount | undefined) {
  const { connection } = useContext(ConnectionContext);
  const [balance, setBalance] = useState<Lamports | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!account) {
      setBalance(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchBalance() {
      try {
        const { value: lamports } = await connection.rpc
          .getBalance(toAddress(account!.address), { commitment: 'confirmed' })
          .send();

        if (!cancelled) {
          setBalance(lamports);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [account, connection]);

  return { balance, error };
}

/**
 * Format lamports as a human-readable SOL string.
 */
export function formatSol(lamports: Lamports): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 5 }).format(
    // Lamports is a bigint; convert to SOL
    Number(lamports) / 1e9
  );
}

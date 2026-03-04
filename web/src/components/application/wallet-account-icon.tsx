import type { UiWalletAccount } from '@wallet-standard/react';
import { uiWalletAccountBelongsToUiWallet, useWallets } from '@wallet-standard/react';

type WalletAccountIconProps = React.ComponentProps<'img'> &
  Readonly<{
    account: UiWalletAccount;
  }>;

export function WalletAccountIcon({ account, ...imgProps }: WalletAccountIconProps) {
  const wallets = useWallets();
  let icon: string | undefined;

  if (account.icon) {
    icon = account.icon;
  } else {
    for (const wallet of wallets) {
      if (uiWalletAccountBelongsToUiWallet(account, wallet)) {
        icon = wallet.icon;
        break;
      }
    }
  }

  return icon ? <img src={icon} {...imgProps} /> : null;
}

import { createContext } from 'react';

import type { UiWalletAccount } from '@wallet-standard/react';

export type SelectedWalletAccountState = UiWalletAccount | undefined;

export const SelectedWalletAccountContext = createContext<
  readonly [
    selectedWalletAccount: SelectedWalletAccountState,
    setSelectedWalletAccount: React.Dispatch<
      React.SetStateAction<SelectedWalletAccountState>
    >,
  ]
>([
  undefined,
  function setSelectedWalletAccount() {
    /* noop default */
  },
]);

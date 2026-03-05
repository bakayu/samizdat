import { createContext } from 'react';

import { connect, type Connection } from 'solana-kite';

export type ConnectionContextType = {
  connection: Connection;
};

const defaultConnectionContext: ConnectionContextType = {
  connection: connect('devnet'),
};

export const ConnectionContext = createContext<ConnectionContextType>(
  defaultConnectionContext
);

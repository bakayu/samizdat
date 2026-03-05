import { StrictMode } from 'react';

import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';

import { AppLayout } from '@/components/application/app-layout';
import { ChainContextProvider } from '@/context/chain-context-provider';
import { ConnectionContextProvider } from '@/context/connection-context-provider';
import { SelectedWalletAccountContextProvider } from '@/context/selected-wallet-account-context-provider';
import { LandingPage } from '@/pages/landing';
import { NodeDashboardPage } from '@/pages/node';
import { NotFound } from '@/pages/not-found';
import { PublisherDashboardPage } from '@/pages/publisher';
import { DigitalTwinPage } from '@/pages/twin';
import { RouteProvider } from '@/providers/router-provider';
import { SamizdatServiceProviderConnected } from '@/providers/samizdat-service-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import '@/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <ChainContextProvider>
        <SelectedWalletAccountContextProvider>
          <ConnectionContextProvider>
            <SamizdatServiceProviderConnected>
              <BrowserRouter basename="/samizdat">
                <RouteProvider>
                  <Routes>
                    <Route element={<AppLayout />}>
                      <Route index path="/" element={<LandingPage />} />
                      <Route path="/publisher" element={<PublisherDashboardPage />} />
                      <Route path="/node" element={<NodeDashboardPage />} />
                      <Route path="/twin" element={<DigitalTwinPage />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </RouteProvider>
              </BrowserRouter>
            </SamizdatServiceProviderConnected>
          </ConnectionContextProvider>
        </SelectedWalletAccountContextProvider>
      </ChainContextProvider>
    </ThemeProvider>
  </StrictMode>
);

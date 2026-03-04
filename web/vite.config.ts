import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: '/samizdat/',
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      globals: {
        Buffer: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@client': path.resolve(__dirname, './client/samizdat/src/generated'),
      // solana-kite uses dynamic import("fs/promises") which the node-polyfills
      // plugin can't resolve in the browser. Point at our own empty shim.
      'fs/promises': path.resolve(__dirname, './src/shims/empty.ts'),
    },
  },
});

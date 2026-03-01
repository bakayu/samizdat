import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from "path";
import { defineConfig } from "vite";

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
            "@": path.resolve(__dirname, "./src"),
        },
    },
});

/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/roller-stats/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Roller Stats',
        short_name: 'Roller Stats',
        lang: 'fr',
        start_url: '/roller-stats/',
        scope: '/roller-stats/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ECECEC',
        theme_color: '#1E1E1E',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] },
});

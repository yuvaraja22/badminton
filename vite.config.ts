/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Identifies this build. The app compares it with /version.json to spot newer deploys.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || new Date().toISOString();

function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
    },
  };
}

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    tailwindcss(),
    versionFile(),
    VitePWA({
      // Registered in src/lib/appUpdate.ts. New versions take over silently (no "Update" banner).
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Badminton Stats',
        short_name: 'Badminton',
        description: 'Fair match rotation, scores, player stats and session reports.',
        theme_color: '#f4f0e6',
        background_color: '#f4f0e6',
        display: 'standalone',
        id: '/',
        scope: '/',
        start_url: '/',
        // Shared links (e.g. a tournament) open in the installed app where the browser supports it.
        handle_links: 'preferred',
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        // Lets a browser tab ask whether the app is installed (Android Chrome), to suggest opening it there.
        related_applications: [{ platform: 'webapp', url: '/manifest.webmanifest' }],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Pages are NOT precached: they always come from the network when online, so the latest
        // deploy shows straight away. Hashed scripts, styles and icons are cached for offline use.
        globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            // Network first; the last copy of each page is used only offline or on a very slow network.
            // Sign-in pages (/__/auth/…, proxied to Firebase) are never cached.
            urlPattern: ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/__/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4, expiration: { maxEntries: 40 } },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The PDF renderer chunk is large; keep it cached so reports can be exported offline.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // The PDF renderer (~1.2 MB) is loaded only when a report is exported.
    chunkSizeWarningLimit: 1300,
    rolldownOptions: {
      output: {
        // Libraries in their own files, so a deploy (which changes the app's own code) doesn't make every
        // phone download Firebase and React again. Charts and the PDF renderer stay in their lazy chunks.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase|re2js|idb)[\\/]/, priority: 2 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

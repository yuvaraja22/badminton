import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Home-screen icons (maskable, Apple) sit on the court green instead of white padding.
const court = { resizeOptions: { background: '#11624b', fit: 'contain' as const } };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...court },
    apple: { ...minimal2023Preset.apple, ...court },
  },
  images: ['public/favicon.svg'],
});

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  site: 'https://lotmates.in',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory', assets: '_astro' },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    envPrefix: ['PUBLIC_', 'VITE_'],
    build: { target: 'esnext' },
    resolve: { alias: { '@': fileURLToPath(new URL('./src/app', import.meta.url)) } },
  },
});

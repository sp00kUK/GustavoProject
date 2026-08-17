import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { vtracerPlugin } from './server/vtracerBridge';

export default defineConfig({
  plugins: [react(), vtracerPlugin()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    watch: {
      ignored: ['**/*.md', '**/*.3mf', '**/*.stl', '**/*.zip', '**/temp_3mf/**', '**/scratch/**'],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});

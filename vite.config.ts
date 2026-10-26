/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { host: true },
  build: { chunkSizeWarningLimit: 600 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

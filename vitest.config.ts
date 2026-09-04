import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: 'frontend',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          globals: true,
          setupFiles: ['src/__tests__/setup.ts'],
        },
      },
      {
        test: {
          name: 'backend',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
          globals: true,
          setupFiles: ['tests/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}', 'server.ts'],
      exclude: ['src/__tests__/**', 'tests/**', 'node_modules/**', 'dist/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

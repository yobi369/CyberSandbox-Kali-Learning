import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: process.env.CYBERSANDBOX_API_TARGET ?? 'http://localhost:4000',
            changeOrigin: false,
          },
          '/health': {
            target: process.env.CYBERSANDBOX_API_TARGET ?? 'http://localhost:4000',
            changeOrigin: false,
          },
        },
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(rootDir, '.'),
        }
      }
    };
});

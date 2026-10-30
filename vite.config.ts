import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const APP_VERSION = '1.1.13';

export default defineConfig(() => {
  return {
    base: '/Bigwar/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'telegram-cache-busting',
        transformIndexHtml(html) {
          return html
            .replace(
              /(<script[^>]+src=["']\.?\/assets\/[^"'?]+)(["'])/g,
              `$1?v=${APP_VERSION}$2`
            )
            .replace(
              /(<link[^>]+href=["']\.?\/assets\/[^"'?]+)(["'])/g,
              `$1?v=${APP_VERSION}$2`
            );
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'docs',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name]-v${APP_VERSION}-[hash].js`,
          chunkFileNames: `assets/[name]-v${APP_VERSION}-[hash].js`,
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.jpg')) {
              return 'assets/[name]-v1.0.10-[hash].[ext]';
            }
            return `assets/[name]-v${APP_VERSION}-[hash].[ext]`;
          },
        },
      },
    },
    server: {
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

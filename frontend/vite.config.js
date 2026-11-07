import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolvePath = (path) => fileURLToPath(new URL(path, import.meta.url));

// The app is served by the Express backend from `frontend/dist`. Two HTML
// entry points keep the public website and the admin dashboard completely
// independent: they load different stylesheets and never leak admin UI into
// the public bundle.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    // The backend sends a strict CSP (script-src 'self'). Vite's default
    // module-preload polyfill is injected as an inline script, so it is
    // disabled here; the generated bundle only uses external module scripts.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        public: resolvePath('./index.html'),
        admin: resolvePath('./admin/index.html'),
      },
      output: {
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || '';
          if (name.endsWith('.css')) return 'assets/css/[name]-[hash][extname]';
          return 'assets/media/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/assets/uploads': 'http://127.0.0.1:3000',
    },
  },
});

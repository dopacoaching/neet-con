import { defineConfig } from 'vite';
// Vite 8 is Rolldown-based; @vitejs/plugin-react v6 is the version that
// supports it (peer: vite ^8.0.0) and avoids the deprecated esbuild/jsx path.
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the Express backend during development.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});

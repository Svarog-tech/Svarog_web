import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'vendor';
            if (id.includes('react-router')) return 'router';
            if (id.includes('framer-motion')) return 'ui';
            if (id.includes('@fortawesome')) return 'icons';
            if (id.includes('monaco-editor')) return 'editor';
            if (id.includes('dompurify') || id.includes('qrcode')) return 'security';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    host: 'localhost',
    strictPort: true,
    origin: 'http://localhost:3000',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            console.error('Proxy error:', err);
            if (res && !res.headersSent) {
              res.writeHead(500, {
                'Content-Type': 'application/json',
              });
              res.end(JSON.stringify({
                success: false,
                error: 'Backend server není dostupný. Ujistěte se, že server běží na portu 3001.',
              }));
            }
          });
        },
      },
    },
  },
});


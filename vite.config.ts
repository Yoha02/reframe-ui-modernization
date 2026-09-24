import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787',changeOrigin: true,configure(proxy) {
    proxy.on('proxyReq',(outgoing,incoming) => {
      if (incoming.headers.origin === 'http://127.0.0.1:5173') outgoing.setHeader('Origin','http://127.0.0.1:8787');
    });
  } } } },
  build: { outDir: 'dist/client' },
  test: { environment: 'jsdom', restoreMocks: true },
});

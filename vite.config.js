import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Göreli yollar: site kök dizinde de, kullanici.github.io/star-tower/ altında da çalışır
  base: './',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 900,
  },
});

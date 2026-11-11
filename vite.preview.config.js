// Tek dosyalık önizleme derlemesi (Claude artifact linki için). Asıl yayın vite.config.js ile yapılır.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_PREVIEW': JSON.stringify('1') },
  build: { outDir: 'dist-preview', chunkSizeWarningLimit: 2000 },
});

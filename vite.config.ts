import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'client',
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
    reportCompressedSize: true,
  },
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
});

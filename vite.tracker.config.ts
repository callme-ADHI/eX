import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/tracker.ts'),
      name: 'eX1Tracker',
      formats: ['iife'],
      fileName: () => 'tracker.js',
    },
    outDir: 'dist',
  },
});
